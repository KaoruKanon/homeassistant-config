import { css, html, nothing, svg } from "lit";
import { config } from "../../config.ts";
import { EntitiesController, store } from "../../store.ts";
import { history, resample, statistics, type Point } from "../data.ts";
import { icon } from "../icons.ts";
import { Page } from "../page.ts";

type PeriodId = "1d" | "1w" | "1m" | "1y" | "5y";

interface Period {
  id: PeriodId;
  label: string;
  /** "sur 1 mois" */
  long: string;
  ms: number;
  /** Long-term statistics period; none = recorder history (1 day). */
  stat?: "hour" | "day" | "week" | "month";
  /** Step used for the best / worst tiles. */
  step: [best: string, worst: string, unit: string];
}

const DAY = 86400000;
const PERIODS: Period[] = [
  { id: "1d", label: "1 j", long: "1 jour", ms: DAY, step: ["Meilleure heure", "Pire heure", "heure"] },
  { id: "1w", label: "1 sem.", long: "1 semaine", ms: 7 * DAY, stat: "hour", step: ["Meilleure séance", "Pire séance", "séance"] },
  { id: "1m", label: "1 mois", long: "1 mois", ms: 30 * DAY, stat: "day", step: ["Meilleure séance", "Pire séance", "séance"] },
  { id: "1y", label: "1 an", long: "1 an", ms: 365 * DAY, stat: "week", step: ["Meilleure semaine", "Pire semaine", "semaine"] },
  { id: "5y", label: "5 ans", long: "5 ans", ms: 5 * 365 * DAY, stat: "month", step: ["Meilleur mois", "Pire mois", "mois"] },
];
const COLORS = ["var(--teal)", "var(--blue)", "var(--amber)", "var(--violet)", "var(--ink)"];
const REFRESH_MS = 5 * 60_000;
const W = 800, H = 260;

const hm = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dm = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const wdh = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit" });
const mon = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const my = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** French number with a real minus sign. */
function fr(n: number, digits = 2): string {
  const s = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n));
  return n < 0 && Number(s.replace(/\s/g, "").replace(",", ".")) !== 0 ? `−${s}` : s;
}
const signed = (n: number, digits = 1) => `${n > 0 && fr(n, digits) !== fr(0, digits) ? "+" : ""}${fr(n, digits)}`;
const priceDigits = (v: number) => (Math.abs(v) >= 10000 ? 0 : 2);

interface Series {
  cur: Point[];
  prev?: Point[];
}

/** Points inside [from, to), led by the last value known at `from`. */
function windowOf(pts: Point[], from: number, to: number): Point[] {
  let carry: Point | undefined;
  const inside: Point[] = [];
  for (const p of pts) {
    if (p.t < from) carry = p;
    else if (p.t < to) inside.push(p);
  }
  return carry ? [{ t: from, v: carry.v }, ...inside] : inside;
}

/** Bucket of a time for the best / worst step of a period. */
function stepKey(t: number, period: PeriodId): string {
  const d = new Date(t);
  if (period === "1d") return `${d.toDateString()} ${d.getHours()}`;
  if (period === "1y") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toDateString();
  }
  if (period === "5y") return `${d.getFullYear()}-${d.getMonth()}`;
  return d.toDateString();
}

function stepLabel(t: number, period: PeriodId): string {
  const d = new Date(t);
  if (period === "1d") return `vers ${d.getHours()} h`;
  if (period === "1y") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `semaine du ${dm.format(d)}`;
  }
  if (period === "5y") return `en ${my.format(d)}`;
  return `le ${wd.format(d)} ${dm.format(d)}`;
}

/** Changes (%) from one step to the next: the best and the worst. */
function extremes(pts: Point[], period: PeriodId): { best?: { v: number; t: number }; worst?: { v: number; t: number } } {
  if (pts.length < 2) return {};
  const closes = new Map<string, Point>();
  for (const p of pts.slice(1)) closes.set(stepKey(p.t, period), p);
  let prev = pts[0].v;
  let best: { v: number; t: number } | undefined, worst: typeof best;
  for (const p of closes.values()) {
    if (!prev) continue;
    const ch = (p.v / prev - 1) * 100;
    if (!best || ch > best.v) best = { v: ch, t: p.t };
    if (!worst || ch < worst.v) worst = { v: ch, t: p.t };
    prev = p.v;
  }
  return { best, worst };
}

function pearson(a: number[], b: number[]): number | undefined {
  const n = Math.min(a.length, b.length);
  if (n < 4) return undefined;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : undefined;
}

// Kept while the panel is open: back on the page, the same view.
const kept: { sel: string[]; period: PeriodId; prev: boolean } = { sel: [], period: "1m", prev: true };

/**
 * Bourse: the followed values (Yahoo Finance sensors). One value: its price
 * over the period with the previous period dashed over it; several: their
 * change in % since the start, one colour each. Tiles below say what the
 * period was like, from the recorder's statistics.
 */
export class Kh3Bourse extends Page {
  static properties = {
    ...Page.properties,
    sel: { state: true },
    period: { state: true },
    prev: { state: true },
    hover: { state: true },
    loading: { state: true },
  };
  declare sel: string[];
  declare period: PeriodId;
  declare prev: boolean;
  /** Cursor on the chart, 0..1 across the period. */
  declare hover?: number;
  declare loading: boolean;
  private data = new Map<string, Series>();
  private timer = 0;

  constructor() {
    super();
    const stocks = config.home.stocks;
    this.sel = kept.sel.filter((id) => stocks.some((s) => s.entity === id));
    if (!this.sel.length && stocks.length) this.sel = [(stocks.find((s) => s.home) ?? stocks[0]).entity];
    this.period = kept.period;
    this.prev = kept.prev;
    this.loading = false;
    new EntitiesController(this, () => config.home.stocks.map((s) => s.entity));
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.ensure();
    this.timer = window.setInterval(() => {
      this.data.clear();
      void this.ensure();
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private get per(): Period {
    return PERIODS.find((p) => p.id === this.period) ?? PERIODS[2];
  }

  /** Loads the series of the chosen values for the chosen period, once. */
  private async ensure(): Promise<void> {
    const per = this.per;
    const missing = this.sel.filter((id) => !this.data.has(`${id}|${per.id}`));
    if (!missing.length) return;
    this.loading = true;
    await Promise.all(missing.map(async (id) => this.data.set(`${id}|${per.id}`, await this.load(id, per))));
    this.loading = false;
  }

  private async load(id: string, per: Period): Promise<Series> {
    const now = Date.now(), from = now - per.ms, before = from - per.ms;
    let pts: Point[] = [];
    if (!per.stat) pts = (await history([id], 48))?.[id] ?? [];
    if (pts.length < 3) {
      const rows = await statistics(id, new Date(before - per.ms * 0.1), per.stat ?? "hour", ["mean"]);
      pts = (rows ?? [])
        .filter((r) => typeof r.mean === "number")
        .map((r) => ({ t: typeof r.start === "number" ? r.start : Date.parse(r.start), v: r.mean! }));
    }
    const cur = windowOf(pts, from, now + 1);
    // Ends on the live price.
    const live = Number(store.get(id)?.state);
    if (!isNaN(live) && cur.length) cur.push({ t: now, v: live });
    const prev = windowOf(pts, before, from);
    return { cur, prev: prev.length > 1 ? prev : undefined };
  }

  private pick(id: string): void {
    const on = this.sel.includes(id);
    // One value at least stays chosen.
    this.sel = on ? (this.sel.length > 1 ? this.sel.filter((x) => x !== id) : this.sel) : config.home.stocks.map((s) => s.entity).filter((x) => x === id || this.sel.includes(x));
    kept.sel = this.sel;
    this.hover = undefined;
    void this.ensure();
  }

  private setPeriod(id: PeriodId): void {
    this.period = kept.period = id;
    this.hover = undefined;
    void this.ensure();
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .wrap {
        display: grid;
        gap: 14px;
        grid-template-columns: minmax(0, 1fr);
      }
      header {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 56px;
        flex-wrap: wrap;
      }
      header .grow {
        flex: 1;
      }
      .periods {
        background: var(--surf);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .periods button {
        flex: none;
      }
      .periods button[aria-pressed="true"] {
        background: var(--surf2);
        box-shadow: none;
      }
      aside {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }
      .vals {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .val {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 16px;
        border: 2px solid transparent;
        background: var(--surf2);
        text-align: left;
        width: 100%;
        min-height: 64px;
        transition: background-color 0.2s, border-color 0.2s;
      }
      .val[aria-pressed="true"] {
        background: var(--surf);
        border-color: var(--c);
      }
      .val .dot {
        width: 12px;
        height: 12px;
        border-radius: 4px;
        flex: none;
        background: var(--c);
      }
      .val[aria-pressed="false"] .dot {
        opacity: 0.45;
      }
      .yr {
        display: block;
        position: relative;
        height: 4px;
        border-radius: 2px;
        background: var(--bg);
        margin-top: 6px;
      }
      .yr i {
        position: absolute;
        top: -3px;
        width: 4px;
        height: 10px;
        border-radius: 2px;
        background: var(--c);
        transform: translateX(-50%);
      }
      .up {
        color: var(--teal);
      }
      .down {
        color: var(--red);
      }
      .prev-card {
        padding: 14px;
        gap: 8px;
        display: flex;
        flex-direction: column;
      }
      .sw-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 44px;
        text-align: left;
      }
      .sw-row[aria-disabled="true"] {
        opacity: 0.55;
        cursor: default;
      }
      .switch.on {
        background: var(--teal);
      }
      .switch.on::after {
        transform: translateX(18px);
        background: #fff;
      }

      .chart {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .chart-head {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .legend {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        font-size: 12px;
        color: var(--muted);
      }
      .legend span {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .legend i {
        width: 14px;
        height: 3px;
        border-radius: 2px;
      }
      .plot {
        flex: 1;
        min-height: 220px;
        display: flex;
        gap: 8px;
      }
      .yaxis {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: right;
        width: 64px;
        flex: none;
        padding: 0 0 20px;
      }
      .area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .area .surface {
        flex: 1;
        min-height: 0;
        position: relative;
        touch-action: pan-y;
        cursor: crosshair;
        border-radius: 8px;
      }
      .area svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .xaxis {
        display: flex;
        justify-content: space-between;
        height: 20px;
        align-items: flex-end;
      }
      .cursor {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        background: var(--muted);
        pointer-events: none;
      }
      .tip {
        position: absolute;
        top: 6px;
        padding: 8px 10px;
        border-radius: 12px;
        background: var(--surf2);
        box-shadow: var(--shadow);
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        gap: 3px;
        z-index: 1;
      }
      .tip i {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 3px;
        margin-right: 6px;
      }
      .insights {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .ins {
        border-radius: 16px;
        background: var(--surf);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .ins .v {
        font-size: 22px;
        font-weight: 700;
      }
      .center {
        flex: 1;
        display: grid;
        place-items: center;
        text-align: center;
      }

      @container (min-width: 900px) {
        .wrap {
          grid-template-columns: 300px minmax(0, 1fr);
          grid-template-rows: 56px minmax(380px, 1fr) auto;
        }
        header {
          grid-column: 1 / 3;
          flex-wrap: nowrap;
        }
        aside {
          grid-column: 1;
          grid-row: 2 / 4;
          overflow: auto;
        }
        .chart {
          grid-column: 2;
          grid-row: 2;
        }
        .insights {
          grid-column: 2;
          grid-row: 3;
        }
        @media (min-height: 720px) {
          .wrap {
            height: calc(100vh - 32px);
            height: calc(100dvh - 32px);
            grid-template-rows: 56px minmax(0, 1fr) auto;
          }
        }
      }
      /* Narrower: the chart right under the values, the switch after the tiles. */
      @container (max-width: 899px) {
        aside {
          display: contents;
        }
        .chart {
          order: 1;
        }
        .insights {
          order: 2;
        }
        .prev-card {
          order: 3;
        }
        .foot {
          order: 4;
        }
      }
      /* Phone: the values swipe, the tiles go two by two. */
      @container (max-width: 599px) {
        .vals {
          flex-direction: row;
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          margin: 0 -16px;
          padding: 2px 16px;
          scroll-padding-inline: 16px;
        }
        .vals::-webkit-scrollbar {
          display: none;
        }
        .val {
          flex: none;
          width: 230px;
          scroll-snap-align: start;
        }
        .periods {
          width: 100%;
        }
        .periods button {
          flex: 1;
          padding: 0 8px;
          height: 44px;
        }
        .plot {
          min-height: 220px;
          height: 240px;
          flex: none;
        }
        .yaxis {
          width: 48px;
        }
        .insights {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .chart-head .big {
          font-size: 24px !important;
        }
        .tip {
          font-size: 11px;
        }
      }
    `,
  ];

  // ——— Header and list ———

  private market() {
    const s = store.get(this.sel[0]);
    if (!s) return nothing;
    const state = String(s.attributes.marketState ?? "");
    const label = state === "REGULAR" ? "Marché ouvert" : /^PRE/.test(state) ? "Avant l'ouverture" : /^POST/.test(state) ? "Après la clôture" : "Marché fermé";
    const t = Date.parse(String(s.attributes.regularMarketTime ?? ""));
    const when = isNaN(t) ? "" : new Date(t).toDateString() === new Date().toDateString() ? hm.format(t) : `${dm.format(t)} à ${hm.format(t)}`;
    return html`<span class="st" style="font-size:13px">${label}${when ? `, dernière cotation ${when}` : ""}</span>`;
  }

  private value(stock: { entity: string; name: string }, i: number) {
    const s = store.get(stock.entity);
    const on = this.sel.includes(stock.entity);
    const price = Number(s?.state);
    const ch = Number(s?.attributes.regularMarketChangePercent);
    const cur = String(s?.attributes.currencySymbol ?? "");
    const lo = Number(s?.attributes.fiftyTwoWeekLow), hi = Number(s?.attributes.fiftyTwoWeekHigh);
    const pos = !isNaN(price) && hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : undefined;
    const label = `${stock.name}, ${isNaN(price) ? "indisponible" : `${fr(price, priceDigits(price))} ${cur}`}${isNaN(ch) ? "" : `, ${signed(ch, 2)} % aujourd'hui`}`;
    return html`<button class="val" style="--c:${COLORS[i % COLORS.length]}" aria-pressed=${on ? "true" : "false"} aria-label=${label} @click=${() => this.pick(stock.entity)}>
      <span class="dot"></span>
      <span style="flex:1;min-width:0">
        <span class="nm ell">${stock.name}</span>
        <span class="st ell" style="display:block">${s?.attributes.symbol ?? ""}</span>
        ${pos !== undefined ? html`<span class="yr" title="Sur 52 semaines : ${fr(lo, priceDigits(lo))} à ${fr(hi, priceDigits(hi))} ${cur}"><i style="left:${pos}%"></i></span>` : nothing}
      </span>
      <span style="text-align:right;flex:none">
        <span class="num" style="display:block;font-weight:700">${isNaN(price) ? "—" : `${fr(price, priceDigits(price))} ${cur}`}</span>
        <span class="num ${ch >= 0 ? "up" : "down"}" style="display:block;font-size:12px;font-weight:700">${isNaN(ch) ? "" : `${signed(ch, 2)} %`}</span>
      </span>
    </button>`;
  }

  // ——— Chart ———

  /** What the chart draws: one line per chosen value, plus the period before when asked. */
  private model() {
    const per = this.per;
    const stocks = config.home.stocks.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] })).filter((s) => this.sel.includes(s.entity));
    const single = stocks.length === 1;
    const now = Date.now(), from = now - per.ms;
    const lines = stocks
      .map((s) => {
        const d = this.data.get(`${s.entity}|${per.id}`);
        const pts = d?.cur ?? [];
        const v0 = pts[0]?.v;
        const perf = pts.length > 1 && v0 ? (pts[pts.length - 1].v / v0 - 1) * 100 : undefined;
        const vals = single || !v0 ? pts : pts.map((p) => ({ t: p.t, v: (p.v / v0 - 1) * 100 }));
        return { ...s, raw: pts, pts: vals, perf, prevRaw: d?.prev };
      });
    const drawn = lines.filter((l) => l.pts.length > 1);
    const main = lines[0];
    // The period before, moved onto this one and started from the same price.
    let prev: Point[] | undefined;
    if (single && this.prev && main?.prevRaw && main.raw.length > 1 && main.prevRaw[0].v) {
      const k = main.raw[0].v / main.prevRaw[0].v;
      prev = main.prevRaw.map((p) => ({ t: p.t + per.ms, v: p.v * k }));
    }
    const all = drawn.flatMap((l) => l.pts.map((p) => p.v)).concat(prev?.map((p) => p.v) ?? []);
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
    lo -= pad;
    hi += pad;
    const x = (t: number) => ((t - from) / per.ms) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    return { per, single, lines, drawn, prev, lo, hi, x, y, from, now };
  }

  private path(pts: Point[], x: (t: number) => number, y: (v: number) => number): string {
    return pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  }

  private onMove = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.hover = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  private onLeave = () => (this.hover = undefined);
  private onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -0.02 : 0.02;
      this.hover = Math.min(1, Math.max(0, (this.hover ?? 1) + step));
    } else if (e.key === "Escape") this.hover = undefined;
  };

  private tipDate(t: number): string {
    switch (this.period) {
      case "1d":
        return hm.format(t);
      case "1w":
        return wdh.format(t).replace(/\s(\d{2})$/, " $1 h");
      case "5y":
        return my.format(t);
      default:
        return dm.format(t);
    }
  }

  private xLabels(from: number, now: number): string[] {
    return [0, 1 / 3, 2 / 3, 1].map((f, i) => {
      const t = from + (now - from) * f;
      if (i === 3) return this.period === "1d" ? "maint." : "auj.";
      switch (this.period) {
        case "1d":
          return hm.format(t);
        case "1w":
          return wd.format(t);
        case "1y":
          return mon.format(t);
        case "5y":
          return String(new Date(t).getFullYear());
        default:
          return dm.format(t);
      }
    });
  }

  private chart(m: ReturnType<Kh3Bourse["model"]>) {
    const { single, lines, drawn, prev, lo, hi, x, y, from, now } = m;
    const main = lines[0];
    const s = main ? store.get(main.entity) : undefined;
    const cur = String(s?.attributes.currencySymbol ?? "");
    const price = Number(s?.state);
    const day = Number(s?.attributes.regularMarketChangePercent);
    const best = [...lines].filter((l) => l.perf !== undefined).sort((a, b) => b.perf! - a.perf!)[0];
    const fmtY = (v: number) => (single ? `${fr(v, hi - lo < 5 ? 2 : hi - lo < 50 ? 1 : 0)} ${cur}` : `${signed(v, 1)} %`);
    const sub = single
      ? [
          s?.attributes.symbol,
          !isNaN(Number(s?.attributes.regularMarketDayLow)) && Number(s?.attributes.regularMarketDayHigh) > 0
            ? `séance de ${fr(Number(s?.attributes.regularMarketDayLow), priceDigits(price))} à ${fr(Number(s?.attributes.regularMarketDayHigh), priceDigits(price))} ${cur}`
            : "",
          s?.attributes.fiftyDayAverage ? `moyenne 50 jours ${fr(Number(s.attributes.fiftyDayAverage), priceDigits(price))} ${cur}` : "",
        ].filter(Boolean).join(", ")
      : `Évolution en % depuis le début de la période (${m.per.long})`;

    // Cursor: the value of each line nearest to it.
    let tip: unknown = nothing;
    if (this.hover !== undefined && drawn.length) {
      const t = from + (now - from) * this.hover;
      const near = (pts: Point[]) => pts.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b), pts[0]);
      const rows = drawn.map((l) => ({ l, p: near(l.pts) }));
      const pp = prev && prev.length ? near(prev) : undefined;
      const left = this.hover * 100;
      tip = html`<span class="cursor" style="left:${left}%"></span>
        <span class="tip" style="${left > 60 ? `right:${100 - left + 1}%` : `left:${left + 1}%`}">
          <b>${this.tipDate(rows[0].p.t)}</b>
          ${rows.map((r) => html`<span><i style="background:${r.l.color}"></i>${single ? "" : `${r.l.name} `}<b class="num">${fmtY(r.p.v)}</b></span>`)}
          ${pp ? html`<span><i style="background:var(--muted)"></i>Avant <b class="num">${fmtY(pp.v)}</b></span>` : nothing}
        </span>`;
    }

    const summary = drawn.map((l) => `${l.name} ${l.perf !== undefined ? `${signed(l.perf)} %` : ""}`).join(", ");
    return html`<section class="card chart" aria-label="Graphique">
      <div class="chart-head">
        <div style="flex:1;min-width:0">
          <h2 style="font-size:16px;font-weight:700">${single ? main?.name : `Comparaison de ${lines.length} valeurs`}</h2>
          <p class="st">${sub}</p>
        </div>
        <div style="text-align:right;flex:none">
          ${single
            ? html`<div class="num big" style="font-size:32px;font-weight:700;line-height:1">${isNaN(price) ? "—" : `${fr(price, priceDigits(price))} ${cur}`}</div>
                <div class="num ${day >= 0 ? "up" : "down"}" style="font-size:14px;font-weight:700;margin-top:4px">${isNaN(day) ? "" : `${signed(day, 2)} % aujourd'hui`}</div>`
            : best
              ? html`<div class="num big ${best.perf! >= 0 ? "up" : "down"}" style="font-size:32px;font-weight:700;line-height:1">${signed(best.perf!)} %</div>
                  <div class="st" style="margin-top:4px">meilleure : ${best.name}</div>`
              : nothing}
        </div>
      </div>
      <div class="legend">
        ${lines.map((l) => html`<span><i style="background:${l.color}"></i>${l.name}</span>`)}
        ${prev ? html`<span><i style="background:repeating-linear-gradient(90deg,var(--muted) 0 4px,transparent 4px 7px)"></i>Période précédente, même départ</span>` : nothing}
      </div>
      ${!drawn.length
        ? html`<div class="center plot"><p class="empty" role="status">${this.loading ? "Chargement de l'historique…" : "Pas encore d'historique pour cette période."}</p></div>`
        : html`<div class="plot">
            <div class="yaxis st num" aria-hidden="true"><span>${fmtY(hi)}</span><span>${fmtY((hi + lo) / 2)}</span><span>${fmtY(lo)}</span></div>
            <div class="area">
              <div class="surface" tabindex="0" role="img" aria-label="Courbe sur ${m.per.long} : ${summary}. Flèches gauche et droite pour lire les valeurs."
                @pointermove=${this.onMove} @pointerdown=${this.onMove} @pointerleave=${this.onLeave} @keydown=${this.onKey} @blur=${this.onLeave}>
                <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 0.5H${W}M0 ${H / 2}H${W}M0 ${H - 0.5}H${W}" vector-effect="non-scaling-stroke" style="stroke:var(--surf2);stroke-width:1;fill:none"></path>
                  ${!single && lo < 0 && hi > 0
                    ? svg`<path d="M0 ${y(0)}H${W}" vector-effect="non-scaling-stroke" style="stroke:var(--muted);stroke-opacity:.5;stroke-width:1;fill:none"></path>`
                    : nothing}
                  ${single && drawn[0]
                    ? svg`<path d="${this.path(drawn[0].pts, x, y)} L${x(drawn[0].pts[drawn[0].pts.length - 1].t)} ${H} L${x(drawn[0].pts[0].t)} ${H} Z"
                        style="fill:${drawn[0].color};opacity:.14"></path>`
                    : nothing}
                  ${prev
                    ? svg`<path d=${this.path(prev, x, y)} vector-effect="non-scaling-stroke" style="fill:none;stroke:var(--muted);stroke-width:2;stroke-dasharray:6 5;opacity:.85"></path>`
                    : nothing}
                  ${[...drawn].reverse().map((l) => svg`<path d=${this.path(l.pts, x, y)} vector-effect="non-scaling-stroke"
                    style="fill:none;stroke:${l.color};stroke-width:${single ? 3 : 2.5};stroke-linejoin:round;stroke-linecap:round"></path>`)}
                </svg>
                ${tip}
              </div>
              <div class="xaxis st num" aria-hidden="true">${this.xLabels(from, now).map((l) => html`<span>${l}</span>`)}</div>
            </div>
          </div>`}
    </section>`;
  }

  // ——— Tiles ———

  private insights(m: ReturnType<Kh3Bourse["model"]>) {
    const { per, single, lines, drawn } = m;
    type Tile = { l: string; v: string; d: string; c?: string };
    // Until the history arrives, the tiles keep their room (no shift below).
    if (!drawn.length) return this.tiles([0, 1, 2, 3].map(() => ({ l: "\u00a0", v: "\u00a0", d: "\u00a0" })));
    const tone = (n?: number) => (n === undefined ? "" : n >= 0 ? "var(--teal)" : "var(--red)");
    let tiles: Tile[];
    if (single) {
      const l = drawn[0];
      const cur = String(store.get(l.entity)?.attributes.currencySymbol ?? "");
      const start = l.raw[0].v;
      const prevPerf = l.prevRaw && l.prevRaw.length > 1 && l.prevRaw[0].v ? (l.prevRaw[l.prevRaw.length - 1].v / l.prevRaw[0].v - 1) * 100 : undefined;
      const { best, worst } = extremes(l.raw, per.id);
      const [bestName, worstName] = per.step;
      tiles = [
        { l: `Sur ${per.long}`, v: l.perf !== undefined ? `${signed(l.perf)} %` : "—", d: `${fr(start, priceDigits(start))} ${cur} au départ`, c: tone(l.perf) },
        prevPerf !== undefined && l.perf !== undefined
          ? { l: "Avant / après", v: `${signed(l.perf - prevPerf)} pts`, d: `contre ${signed(prevPerf)} % la période d'avant` }
          : { l: "Avant / après", v: "—", d: "Pas d'historique de la période d'avant" },
        best ? { l: bestName, v: `${signed(best.v)} %`, d: stepLabel(best.t, per.id), c: tone(best.v) } : { l: bestName, v: "—", d: "Pas assez de données" },
        worst ? { l: worstName, v: `${signed(worst.v)} %`, d: stepLabel(worst.t, per.id), c: tone(worst.v) } : { l: worstName, v: "—", d: "Pas assez de données" },
      ];
    } else {
      const ranked = lines.filter((l) => l.perf !== undefined).sort((a, b) => b.perf! - a.perf!);
      const top = ranked[0], last = ranked[ranked.length - 1];
      // Do they move together? Correlation of their steps, pair by pair.
      const to = m.now, from = m.from, n = 40;
      const steps = drawn.map((l) => {
        const r = resample(l.pts, from, to, n).map((v) => v ?? 0);
        return r.slice(1).map((v, i) => v - r[i]);
      });
      const rs: number[] = [];
      for (let i = 0; i < steps.length; i++) for (let j = i + 1; j < steps.length; j++) {
        const r = pearson(steps[i], steps[j]);
        if (r !== undefined) rs.push(r);
      }
      const r = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : undefined;
      const together =
        r === undefined
          ? { v: "—", d: "Pas assez de données" }
          : r > 0.6
            ? { v: "Corrélées", d: `Elles montent et baissent ensemble (${fr(r, 2)})` }
            : r < -0.3
              ? { v: "Opposées", d: `Quand l'une monte, l'autre baisse (${fr(r, 2)})` }
              : { v: "Indépendantes", d: `Chacune suit sa route (${fr(r, 2)})` };
      tiles = [
        top ? { l: "En tête", v: top.name, d: `${signed(top.perf!)} % sur ${per.long}`, c: tone(top.perf) } : { l: "En tête", v: "—", d: "" },
        last ? { l: "En retrait", v: last.name, d: `${signed(last.perf!)} % sur ${per.long}`, c: tone(last.perf) } : { l: "En retrait", v: "—", d: "" },
        top && last ? { l: "Écart", v: `${fr(top.perf! - last.perf!, 1)} pts`, d: "entre la meilleure et la moins bonne" } : { l: "Écart", v: "—", d: "" },
        { l: "Ensemble", ...together },
      ];
    }
    return this.tiles(tiles);
  }

  private tiles(tiles: { l: string; v: string; d: string; c?: string }[]) {
    return html`<section class="insights" aria-label="À retenir">
      ${tiles.map((t) => html`<div class="ins">
        <span class="st" style="font-weight:600">${t.l}</span>
        <span class="v num ell" style="color:${t.c || "var(--ink)"}">${t.v}</span>
        <span class="st">${t.d}</span>
      </div>`)}
    </section>`;
  }

  render() {
    if (!store.hass) return nothing;
    const stocks = config.home.stocks;
    if (!stocks.length) return html`<div class="top"><h1 class="page-title">Bourse</h1></div><p class="empty">Aucune valeur suivie.</p>`;
    const m = this.model();
    const single = m.single;
    return html`<div class="wrap">
      <header>
        <h1 class="page-title">Bourse</h1>
        ${this.market()}
        <span class="grow"></span>
        <div class="seg periods" role="group" aria-label="Période">
          ${PERIODS.map((p) => html`<button aria-pressed=${p.id === this.period ? "true" : "false"} aria-label=${`Sur ${p.long}`} @click=${() => this.setPeriod(p.id)}>${p.label}</button>`)}
        </div>
      </header>
      <aside>
        <p class="st" style="font-weight:600;padding:0 4px">Valeurs suivies, touche pour les comparer</p>
        <div class="vals" role="group" aria-label="Valeurs suivies">${stocks.map((s, i) => this.value(s, i))}</div>
        <div class="card prev-card">
          <button class="sw-row" role="switch" aria-checked=${this.prev && single ? "true" : "false"} aria-disabled=${single ? "false" : "true"}
            @click=${() => single && (this.prev = kept.prev = !this.prev)}>
            <span style="flex:1;min-width:0"><span class="nm">Avant / après</span><span class="st" style="display:block">Superpose la période précédente</span></span>
            <span class="switch ${this.prev && single ? "on" : ""}" aria-hidden="true"></span>
          </button>
          <p class="st">${single ? "Pointillés : la période d'avant, ramenée au même prix de départ." : "Valable pour une seule valeur à la fois."}</p>
        </div>
        <p class="st foot" style="padding:0 4px;margin-top:auto">${icon("trend", 14)} Cours Yahoo Finance, en différé.</p>
      </aside>
      ${this.chart(m)}
      ${this.insights(m)}
    </div>`;
  }
}
customElements.define("kh3-bourse", Kh3Bourse);
