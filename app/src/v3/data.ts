import { recall, remember } from "../cache.ts";
import { config } from "../config.ts";
import { store } from "../store.ts";
import type { HassEntity } from "../types.ts";

// Data the V3 pages fetch beyond live states: history, statistics, calendar
// events, to-do items. Each fetch is cached a minute (same graph on two
// pages, or a quick back-and-forth, costs nothing).

export interface Point {
  t: number;
  v: number;
}

const FRESH_MS = 60_000;

async function cached<T>(key: string, load: () => Promise<T>, fresh = FRESH_MS): Promise<T | undefined> {
  const saved = recall<T>(key);
  if (saved && saved.age < fresh) return saved.value;
  try {
    const value = await load();
    remember(key, value);
    return value;
  } catch {
    return saved?.value;
  }
}

/** Numeric history of a few sensors over the last hours. */
export function history(ids: string[], hours = 24): Promise<Record<string, Point[]> | undefined> {
  const conn = store.hass?.connection;
  if (!conn || !ids.length) return Promise.resolve(undefined);
  return cached(`h3|${hours}|${ids.join()}`, async () => {
    const res = await conn.sendMessagePromise<Record<string, { s: string; lu: number }[]>>({
      type: "history/history_during_period",
      start_time: new Date(Date.now() - hours * 3600_000).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    const out: Record<string, Point[]> = {};
    for (const id of ids) out[id] = (res[id] ?? []).map((p) => ({ t: p.lu * 1000, v: Number(p.s) })).filter((p) => !isNaN(p.v));
    return out;
  });
}

type Stat = { start: number | string; change?: number; mean?: number; state?: number };

/** Long-term statistics (hourly / daily / monthly) of one sensor. */
export function statistics(id: string, from: Date, period: "5minute" | "hour" | "day" | "week" | "month", types: string[]): Promise<Stat[] | undefined> {
  const conn = store.hass?.connection;
  if (!conn) return Promise.resolve(undefined);
  return cached(`s3|${id}|${period}|${from.toISOString().slice(0, 13)}|${types}`, async () => {
    const res = await conn.sendMessagePromise<Record<string, Stat[]>>({
      type: "recorder/statistics_during_period",
      start_time: from.toISOString(),
      statistic_ids: [id],
      period,
      types,
    });
    return res[id] ?? [];
  });
}

/** Linky energy per hour today and yesterday, per day for the last week. */
export async function energyHours(): Promise<{ today: number[]; yesterday: number[]; days: { date: number; kwh: number }[] } | undefined> {
  const e = config.home.energy;
  if (!e) return undefined;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const yesterday = new Date(midnight.getTime() - 86400000);
  const weekAgo = new Date(midnight.getTime() - 6 * 86400000);
  const [hours, days] = await Promise.all([statistics(e.meter, yesterday, "hour", ["change"]), statistics(e.meter, weekAgo, "day", ["change"])]);
  if (!hours) return undefined;
  const today = Array(24).fill(0), yday = Array(24).fill(0);
  for (const r of hours) {
    const d = new Date(r.start);
    (d >= midnight ? today : yday)[d.getHours()] += Math.max(0, r.change ?? 0);
  }
  return { today, yesterday: yday, days: (days ?? []).map((r) => ({ date: new Date(r.start).getTime(), kwh: Math.max(0, r.change ?? 0) })) };
}

export interface CalEvent {
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  calendar: string;
}

/** Events of the given calendars from today over `days` days (REST calendar API, else the next event of each). */
export async function todayEvents(ids: string[], days = 1): Promise<CalEvent[]> {
  const hass = store.hass as any;
  // Only calendars that exist (a removed one answers 400 and pollutes the console).
  ids = ids.filter((id) => hass?.states[id] && hass.states[id].state !== "unavailable");
  if (!hass || !ids.length) return [];
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 86400000);
  if (typeof hass.callApi === "function") {
    const list = await cached(`cal3|${days}|${ids.join()}|${from.toDateString()}`, async () => {
      const all = await Promise.all(
        ids.map((id) =>
          (hass.callApi("GET", `calendars/${id}?start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`) as Promise<any[]>)
            .then((evs) => evs.map((e) => ({ ...e, calendar: id })))
            .catch(() => []),
        ),
      );
      return all.flat().map((e) => ({
        title: e.summary as string,
        start: (e.start?.dateTime ?? e.start?.date) as string,
        end: (e.end?.dateTime ?? e.end?.date) as string,
        allDay: !e.start?.dateTime,
        calendar: e.calendar as string,
      }));
    }, 5 * 60_000);
    if (list) {
      return list
        .map((e) => ({ ...e, start: new Date(e.start), end: e.end ? new Date(e.end) : undefined }))
        .filter((e) => e.allDay || !e.end || e.end.getTime() > Date.now())
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
    }
  }
  return ids
    .map((id) => hass.states[id] as HassEntity | undefined)
    .filter((s): s is HassEntity => !!s?.attributes.message && !!s.attributes.start_time)
    .map((s) => ({
      title: s.attributes.message,
      start: new Date(String(s.attributes.start_time).replace(" ", "T")),
      allDay: !!s.attributes.all_day,
      calendar: s.entity_id,
    }))
    .filter((e) => e.start < to);
}

/** Calendars shown on the home view: the person's favourites, else every calendar. */
export function homeCalendars(person?: string): string[] {
  const key = person?.replace("person.", "");
  const fav = key ? config.people[key]?.favorites?.find((f) => f.type === "calendar") : undefined;
  if (fav && fav.type === "calendar") return fav.entities;
  for (const p of Object.values(config.people)) {
    const f = p.favorites?.find((x) => x.type === "calendar");
    if (f && f.type === "calendar") return f.entities;
  }
  return [];
}

/** Jellyfin items of a "recently added" sensor (first item is the header). */
export function jellyfinItems(id?: string): Record<string, any>[] {
  const s = id ? store.hass?.states[id] : undefined;
  return ((s?.attributes.data as any[] | undefined) ?? []).slice(1).filter((i) => i.title);
}

/** Number of a sensor, or undefined. */
export function num(id?: string): number | undefined {
  const s = id ? store.hass?.states[id] : undefined;
  if (!s) return undefined;
  const n = Number(s.state);
  return isNaN(n) ? undefined : n;
}

const fr1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const fr0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const fr2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const f1 = (n?: number) => (n === undefined ? "—" : fr1.format(n));
export const f0 = (n?: number) => (n === undefined ? "—" : fr0.format(n));
export const f2 = (n?: number) => (n === undefined ? "—" : fr2.format(n));
/** Signed percent, with a real minus sign. */
export const pct = (n: number, digits = 1) => `${n >= 0 ? "+" : "−"}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Math.abs(n))} %`;

/** "il y a 25 min" style duration since an ISO date. */
export function since(iso?: string): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
  return `${Math.floor(h / 24)} j`;
}

/** Minutes as "1 h 10" or "25 min". */
export function minutes(m?: number): string {
  if (m === undefined || isNaN(m)) return "—";
  const r = Math.max(0, Math.round(m));
  return r >= 60 ? `${Math.floor(r / 60)} h${r % 60 ? ` ${String(r % 60).padStart(2, "0")}` : ""}` : `${r} min`;
}

/** Smooth path through points scaled to a box (monotone-ish Catmull-Rom). */
export function linePath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Resamples a history to one point per bucket (average), for light, smooth curves. */
export function resample(points: Point[], from: number, to: number, buckets: number): (number | undefined)[] {
  const out: (number | undefined)[] = Array(buckets).fill(undefined);
  const sums = Array(buckets).fill(0), counts = Array(buckets).fill(0);
  const step = (to - from) / buckets;
  let last: number | undefined;
  for (const p of points) {
    if (p.t < from) {
      last = p.v;
      continue;
    }
    const i = Math.min(buckets - 1, Math.floor((p.t - from) / step));
    sums[i] += p.v;
    counts[i]++;
  }
  for (let i = 0; i < buckets; i++) {
    if (counts[i]) last = sums[i] / counts[i];
    out[i] = last;
  }
  return out;
}

/**
 * Ready-to-draw series: the gaps before the first and after the last reading
 * hold the nearest value (the curve spans the whole width), then a light
 * moving average takes off the steps of sensors that report by 0.1°.
 */
export function smoothSeries(vals: (number | undefined)[], radius = 1): (number | undefined)[] {
  const first = vals.findIndex((v) => v !== undefined);
  if (first < 0) return vals;
  const filled = vals.map((v, i) => v ?? (i < first ? vals[first] : undefined));
  for (let i = 1; i < filled.length; i++) if (filled[i] === undefined) filled[i] = filled[i - 1];
  return filled.map((_, i) => {
    let sum = 0, n = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(filled.length - 1, i + radius); k++) {
      sum += filled[k]!;
      n++;
    }
    return sum / n;
  });
}
