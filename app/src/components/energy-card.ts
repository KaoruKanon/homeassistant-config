import { LitElement, css, html, nothing, svg } from "lit";
import { openMoreInfo } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

interface Stat {
  start: number;
  change?: number | null;
}

interface Bar {
  key: number;
  label: string;
  kwh: number;
  ghost?: number;
  now?: boolean;
}

const REFRESH_MS = 10 * 60_000;
const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/**
 * Énergie: power now, today's kWh and cost, versus yesterday at the same
 * hour, peak hour; today per hour (yesterday in the background) or the last
 * 7 days. Tap a bar for its value.
 */
export class KhEnergyCard extends LitElement {
  static properties = {
    today: { state: true },
    yesterday: { state: true },
    days: { state: true },
    view: { state: true },
    picked: { state: true },
    width: { state: true },
    compact: { type: Boolean },
  };
  /** Home tile: one line of figures over a low graph of today; details on the Énergie page. */
  declare compact: boolean;
  declare today: number[];
  declare yesterday: number[];
  declare days: { date: Date; kwh: number }[];
  declare view: "day" | "week";
  declare picked?: number;
  declare width: number;
  private timer?: number;
  private resize = new ResizeObserver(([e]) => (this.width = Math.max(240, Math.round(e.contentRect.width))));

  constructor() {
    super();
    this.today = [];
    this.yesterday = [];
    this.days = [];
    this.view = "day";
    this.width = 320;
    this.compact = false;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const e = config.home.energy;
      return e ? [e.power, e.today] : [];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .card {
        padding: 14px;
        display: grid;
        gap: 14px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(var(--kh-kpi-min, 118px), 1fr));
        gap: 10px;
      }
      .kpi {
        display: grid;
        gap: 2px;
        padding: 10px 12px;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
        text-align: left;
      }
      .kpi .v {
        font-size: 1.25rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .kpi .v small {
        font-size: 0.75rem;
        color: var(--kh-text-2);
        margin-left: 2px;
      }
      .kpi .k {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--kh-text-2);
      }
      .up {
        color: rgb(var(--rgb-red));
      }
      .down {
        color: rgb(var(--rgb-green));
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .seg {
        display: inline-flex;
        padding: 3px;
        border-radius: 12px;
        background: var(--kh-card-2);
      }
      .seg button {
        height: 34px;
        padding: 0 14px;
        border-radius: 9px;
        font-weight: 700;
        font-size: 0.8125rem;
        color: var(--kh-text-2);
      }
      .seg button[aria-pressed="true"] {
        background: var(--kh-card);
        color: var(--kh-text);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        touch-action: pan-y;
      }
      .axis {
        fill: var(--kh-text-2);
        font-size: 11px;
        font-family: var(--kh-font);
      }
      .grid {
        stroke: var(--kh-line);
      }
      .bar {
        fill: rgb(var(--rgb-orange));
        transform-origin: bottom;
        transform-box: fill-box;
        animation: grow 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        cursor: pointer;
      }
      .bar.now {
        fill: rgb(var(--rgb-amber));
      }
      .bar.dim {
        opacity: 0.45;
      }
      .ghost {
        fill: var(--kh-text-2);
        opacity: 0.18;
      }
      .tip {
        fill: var(--kh-text);
        font-size: 12px;
        font-weight: 700;
        font-family: var(--kh-font);
      }
      .legend {
        display: flex;
        gap: 14px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--kh-text-2);
      }
      .legend i {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
        vertical-align: -1px;
      }
      /* Compact: the figures on one line, separated by thin dots. */
      .line {
        display: flex;
        flex-wrap: nowrap;
        align-items: baseline;
        gap: 6px 14px;
        overflow: hidden;
        white-space: nowrap;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--kh-text-2);
        margin-bottom: 4px;
      }
      .line b {
        font-size: 1.05rem;
        color: var(--kh-text);
        font-variant-numeric: tabular-nums;
      }
      .line .up b {
        color: rgb(var(--rgb-red));
      }
      .line .down b {
        color: rgb(var(--rgb-green));
      }
      .line button {
        color: inherit;
      }
      @keyframes grow {
        from {
          transform: scaleY(0);
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
    this.timer = window.setInterval(() => this.load(), REFRESH_MS);
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.resize.disconnect();
  }

  private async load(): Promise<void> {
    const e = config.home.energy;
    const conn = store.hass?.connection;
    if (!e || !conn) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const yesterday = new Date(midnight.getTime() - 86400000);
    const weekAgo = new Date(midnight.getTime() - 6 * 86400000);
    const ask = (start: Date, period: "hour" | "day") =>
      conn.sendMessagePromise<Record<string, Stat[]>>({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        statistic_ids: [e.meter],
        period,
        types: ["change"],
      });
    try {
      const [hours, days] = await Promise.all([ask(yesterday, "hour"), ask(weekAgo, "day")]);
      const t = Array(24).fill(0), y = Array(24).fill(0);
      for (const r of hours[e.meter] ?? []) {
        const d = new Date(r.start);
        (d >= midnight ? t : y)[d.getHours()] += Math.max(0, r.change ?? 0);
      }
      this.today = t;
      this.yesterday = y;
      this.days = (days[e.meter] ?? []).map((r) => ({ date: new Date(r.start), kwh: Math.max(0, r.change ?? 0) }));
    } catch {
      this.today = [];
    }
  }

  private chart(bars: Bar[], unit: (kwh: number) => string) {
    const W = this.width - (this.compact ? 0 : 28), H = this.compact ? 96 : 150, left = 34, bottom = 20, top = this.compact ? 14 : 18;
    const max = Math.max(0.1, ...bars.map((b) => Math.max(b.kwh, b.ghost ?? 0)));
    const slot = (W - left) / bars.length;
    const bw = Math.max(3, slot - (bars.length > 10 ? 3 : 10));
    const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
    const picked = this.picked !== undefined ? bars.find((b) => b.key === this.picked) : undefined;
    const every = bars.length > 10 ? 6 : 1;
    return svg`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Consommation">
      ${[0, 0.5, 1].map((f) => svg`<line class="grid" x1=${left} x2=${W} y1=${y(max * f)} y2=${y(max * f)} />
        <text class="axis" x=${left - 6} y=${y(max * f) + 4} text-anchor="end">${formatNumber(max * f, max < 1 ? 2 : 1)}</text>`)}
      ${bars.map((b, i) => {
        const x = left + i * slot + (slot - bw) / 2;
        return svg`
          ${b.ghost ? svg`<rect class="ghost" rx="3" x=${x} y=${y(b.ghost)} width=${bw} height=${Math.max(0, y(0) - y(b.ghost))} />` : nothing}
          <rect class="bar ${b.now ? "now" : ""} ${picked && picked !== b ? "dim" : ""}" rx="3" x=${x} y=${y(b.kwh)} width=${bw}
            height=${Math.max(b.kwh > 0 ? 2 : 0, y(0) - y(b.kwh))} style="animation-delay:${i * 18}ms"
            @click=${() => (this.picked = this.picked === b.key ? undefined : b.key)}><title>${b.label} : ${unit(b.kwh)}</title></rect>
          ${i % every === 0 ? svg`<text class="axis" x=${x + bw / 2} y=${H - 4} text-anchor="middle">${b.label}</text>` : nothing}`;
      })}
      ${picked
        ? svg`<text class="tip" x=${Math.min(W - 4, Math.max(left + 4, left + bars.indexOf(picked) * slot + slot / 2))} y=${Math.max(13, y(picked.kwh) - 6)}
            text-anchor="middle">${unit(picked.kwh)}</text>`
        : nothing}
    </svg>`;
  }

  render() {
    const hass = store.hass;
    const e = config.home.energy;
    if (!hass || !e) return nothing;
    const watts = Number(hass.states[e.power]?.state);
    const kwh = Number(hass.states[e.today]?.state);
    const hour = new Date().getHours();
    const soFarYesterday = this.yesterday.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const soFarToday = this.today.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const delta = soFarYesterday > 0 ? ((soFarToday - soFarYesterday) / soFarYesterday) * 100 : NaN;
    const peak = this.today.reduce((best, v, i) => (v > this.today[best] ? i : best), 0);
    const euro = (k: number) => `${formatNumber(k * e.pricePerKwh, 2)} €`;

    const bars: Bar[] =
      this.view === "day"
        ? this.today.map((v, i) => ({ key: i, label: `${i} h`, kwh: v, ghost: this.yesterday[i], now: i === hour }))
        : this.days.map((d, i) => ({
            key: i,
            label: DAY.format(d.date).replace(".", ""),
            kwh: d.kwh,
            now: d.date.toDateString() === new Date().toDateString(),
          }));
    const unit = (k: number) => `${formatNumber(k, 2)} kWh, ${euro(k)}`;

    if (this.compact) {
      const has = this.today.some((v) => v > 0);
      return html`<div class="line" role="list">
          <button role="listitem" @click=${() => openMoreInfo(this, e.power)}><b>${isNaN(watts) ? "—" : formatNumber(watts, 0)}</b> W</button>
          <button role="listitem" @click=${() => openMoreInfo(this, e.today)}><b>${isNaN(kwh) ? "—" : formatNumber(kwh, 2)}</b> kWh, ${isNaN(kwh) ? "—" : euro(kwh)}</button>
          ${!isNaN(delta) ? html`<span role="listitem" class=${delta > 0 ? "up" : "down"}><b>${delta > 0 ? "+" : ""}${formatNumber(delta, 0)} %</b> vs hier</span>` : nothing}
          ${has ? html`<span role="listitem">pic <b>${peak} h</b></span>` : nothing}
        </div>
        ${bars.length ? this.chart(bars, unit) : html`<div class="secondary">Pas encore de statistiques</div>`}`;
    }

    return html`
      <div class="card">
        <div class="kpis">
          <button class="kpi" @click=${() => openMoreInfo(this, e.power)}>
            <span class="k">En ce moment</span>
            <span class="v">${isNaN(watts) ? "—" : formatNumber(watts, 0)}<small>W</small></span>
          </button>
          <button class="kpi" @click=${() => openMoreInfo(this, e.today)}>
            <span class="k">Aujourd'hui</span>
            <span class="v">${isNaN(kwh) ? "—" : formatNumber(kwh, 2)}<small>kWh</small></span>
            <span class="k">${isNaN(kwh) ? "" : euro(kwh)}</span>
          </button>
          <div class="kpi">
            <span class="k">Vs hier même heure</span>
            <span class="v ${delta > 0 ? "up" : "down"}">${isNaN(delta) ? "—" : `${delta > 0 ? "+" : ""}${formatNumber(delta, 0)}`}<small>%</small></span>
          </div>
          <div class="kpi">
            <span class="k">Pic du jour</span>
            <span class="v">${this.today.some((v) => v > 0) ? `${peak} h` : "—"}</span>
            <span class="k">${this.today.some((v) => v > 0) ? `${formatNumber(this.today[peak], 2)} kWh` : ""}</span>
          </div>
        </div>
        <div class="head">
          <div class="legend">
            ${this.view === "day"
              ? html`<span><i style="background: rgb(var(--rgb-orange))"></i>Aujourd'hui</span><span><i style="background: var(--kh-text-2); opacity: .35"></i>Hier</span>`
              : html`<span>7 derniers jours</span>`}
          </div>
          <div class="seg" role="group" aria-label="Période">
            <button aria-pressed=${String(this.view === "day")} @click=${() => ((this.view = "day"), (this.picked = undefined))}>Jour</button>
            <button aria-pressed=${String(this.view === "week")} @click=${() => ((this.view = "week"), (this.picked = undefined))}>7 jours</button>
          </div>
        </div>
        ${bars.length ? this.chart(bars, unit) : html`<div class="secondary">Pas encore de statistiques</div>`}
      </div>
    `;
  }
}
customElements.define("kh-energy-card", KhEnergyCard);
