/**
 * Next buses at one stop and a V'Lille station, from the Ilévia REST sensors
 * (packages/ilevia.yaml). Which stop, lines and station is a secret of their
 * requests: everything shown here (names, lines, directions) comes from the data.
 */

export interface BusFeature {
  properties?: { nom_station?: string; code_ligne?: string; sens_ligne?: string; heure_estimee_depart?: string };
}

export interface BusRow {
  line: string;
  /** The direction, e.g. "Gare Nord". */
  to: string;
  /** Departures still to come, soonest first. */
  at: Date[];
}

const SMALL = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "sur", "sous", "aux", "au", "lez"]);

/** Ilévia's capitals in French title case: "PLACE DE LA GARE" → "Place de la Gare". */
export function busName(s: string): string {
  let first = true;
  return s.toLowerCase().replace(/[\p{L}.]+/gu, (w) => {
    const keep = !first && SMALL.has(w);
    first = false;
    return keep ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }).replace(/\b([dl])'(\p{L})/giu, (_, a: string, b: string) => `${a.toLowerCase()}'${b.toUpperCase()}`);
}

/**
 * Ilévia gives local times with a wrong "Z" ("2026-11-07T17:20:42Z" is
 * 17:20 in Lille): read without the zone, they are taken as local time.
 */
export function busTime(s: string): Date | undefined {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/.exec(s);
  if (!m) return undefined;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * The stop's name and one row per line and direction, by line. A bus due in
 * the last minute still counts (« à l'arrêt »); a row with nothing to come is left out.
 */
export function busDepartures(features: unknown, now: Date): { stop?: string; rows: BusRow[] } {
  const all = Array.isArray(features) ? (features as BusFeature[]) : [];
  const rows = new Map<string, BusRow>();
  let stop: string | undefined;
  for (const { properties: p } of all) {
    const at = busTime(p?.heure_estimee_depart ?? "");
    if (!p?.code_ligne || !at || at.getTime() <= now.getTime() - 60_000) continue;
    stop ??= p.nom_station ? busName(p.nom_station) : undefined;
    const key = `${p.code_ligne}\u0000${p.sens_ligne ?? ""}`;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { line: p.code_ligne, to: busName(p.sens_ligne ?? ""), at: [] }));
    row.at.push(at);
  }
  for (const r of rows.values()) r.at.sort((a, b) => a.getTime() - b.getTime());
  const sorted = [...rows.values()].sort((a, b) => a.line.localeCompare(b.line, "fr", { numeric: true }) || a.to.localeCompare(b.to, "fr"));
  return { stop, rows: sorted };
}

/** "à l'arrêt", "1 min", "12 min", then the time from an hour on. */
export function busWait(at: Date, now: Date, timeFmt: Intl.DateTimeFormat): string {
  const m = Math.floor((at.getTime() - now.getTime()) / 60_000);
  if (m < 1) return "à l'arrêt";
  if (m < 60) return `${m} min`;
  return timeFmt.format(at);
}

/** The next two waits, "min" written once: ["5", "11 min"], ["à l'arrêt", "11 min"], ["40 min", "18:30"]. */
export function busWaits(at: Date[], now: Date, timeFmt: Intl.DateTimeFormat): string[] {
  const w = at.slice(0, 2).map((d) => busWait(d, now, timeFmt));
  return w.map((s, i) => (s.endsWith(" min") && w[i + 1]?.endsWith(" min") ? s.slice(0, -4) : s));
}

export interface BikeStation {
  name: string;
  bikes: number;
  docks: number;
  /** In service and connected: its counts are live. */
  ok: boolean;
}

/** The V'Lille sensor (state: bikes; attributes: nom, nb_places_dispo, etat, etat_connexion). */
export function bikeStation(state: { state: string; attributes: Record<string, unknown> } | undefined): BikeStation | undefined {
  const name = state?.attributes.nom;
  if (!state || typeof name !== "string") return undefined;
  const bikes = Number(state.state);
  const docks = Number(state.attributes.nb_places_dispo);
  const ok = state.attributes.etat === "EN SERVICE" && state.attributes.etat_connexion === "CONNECTÉ" && Number.isFinite(bikes) && Number.isFinite(docks);
  return { name, bikes: ok ? bikes : 0, docks: ok ? docks : 0, ok };
}
