import { LitElement, css, html, nothing, svg } from "lit";
import { openMoreInfo } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

interface HourStat {
  start: number;
  change?: number | null;
}

const REFRESH_MS = 10 * 60_000;

/** Power now, today's kWh and cost, and today's consumption per hour. */
export class KhEnergyCard extends LitElement {
  static properties = { hours: { state: true } };
  declare hours: { hour: number; kwh: number }[];
  private timer?: number;

  constructor() {
    super();
    this.hours = [];
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
        padding: 12px;
        display: grid;
        gap: 12px;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
      }
      svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .axis {
        fill: var(--kh-text-2);
        font-size: 10px;
        font-family: var(--kh-font);
      }
      .grid {
        stroke: var(--kh-line);
      }
      .bar {
        fill: rgb(var(--rgb-orange));
      }
      .now {
        stroke: rgb(var(--rgb-light-blue));
        stroke-dasharray: 3 3;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
    this.timer = window.setInterval(() => this.load(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private async load(): Promise<void> {
    const e = config.home.energy;
    const conn = store.hass?.connection;
    if (!e || !conn) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const res = await conn.sendMessagePromise<Record<string, HourStat[]>>({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        statistic_ids: [e.meter],
        period: "hour",
        types: ["change"],
      });
      this.hours = (res[e.meter] ?? []).map((r) => ({ hour: new Date(r.start).getHours(), kwh: Math.max(0, r.change ?? 0) }));
    } catch {
      this.hours = [];
    }
  }

  private chart() {
    const W = 320, H = 120, left = 26, bottom = 18, top = 6;
    const max = Math.max(0.1, ...this.hours.map((h) => h.kwh));
    const x = (hour: number) => left + (hour / 24) * (W - left - 4);
    const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
    const bw = (W - left - 4) / 24 - 2;
    const now = new Date();
    const nowX = x(now.getHours() + now.getMinutes() / 60);
    return svg`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Consommation par heure aujourd'hui">
      ${[0, 0.5, 1].map((f) => svg`<line class="grid" x1=${left} x2=${W - 4} y1=${y(max * f)} y2=${y(max * f)} />
        <text class="axis" x=${left - 4} y=${y(max * f) + 3} text-anchor="end">${formatNumber(max * f, 1)}</text>`)}
      ${this.hours.map((h) => svg`<rect class="bar" rx="2" x=${x(h.hour) + 1} y=${y(h.kwh)} width=${bw} height=${Math.max(0, y(0) - y(h.kwh))}><title>${h.hour} h : ${formatNumber(h.kwh, 2)} kWh</title></rect>`)}
      <line class="now" x1=${nowX} x2=${nowX} y1=${top} y2=${y(0)} />
      ${[0, 6, 12, 18].map((hr) => svg`<text class="axis" x=${x(hr)} y=${H - 4}>${hr} h</text>`)}
    </svg>`;
  }

  render() {
    const hass = store.hass;
    const e = config.home.energy;
    if (!hass || !e) return nothing;
    const power = hass.states[e.power];
    const watts = Number(power?.state);
    const kwh = Number(hass.states[e.today]?.state);
    return html`
      <div class="card">
        <button class="head" @click=${() => openMoreInfo(this, e.today)}>
          <span class="shape" style="--rgb: var(--rgb-orange)"><ha-icon icon="mdi:lightning-bolt"></ha-icon></span>
          <div>
            <div class="primary">Actuellement : ${isNaN(watts) ? "indisponible" : `${formatNumber(watts, 0)} W`}</div>
            <div class="secondary">
              ${isNaN(kwh) ? "" : `Aujourd'hui : ${formatNumber(kwh, 2)} kWh, ${formatNumber(kwh * e.pricePerKwh, 2)} €`}
            </div>
          </div>
        </button>
        ${this.hours.length ? this.chart() : nothing}
      </div>
    `;
  }
}
customElements.define("kh-energy-card", KhEnergyCard);
