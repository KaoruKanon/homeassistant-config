import { LitElement, css, html, nothing, svg } from "lit";
import { formatNumber } from "../format.ts";
import { store } from "../store.ts";

interface Point {
  t: number;
  v: number;
}

/**
 * Last hours of one or two numeric sensors as lines (e.g. temperature and
 * humidity), from the recorder history. Loads once when shown.
 */
export class KhSparkline extends LitElement {
  static properties = { entities: { attribute: false }, hours: { type: Number }, series: { state: true } };
  declare entities: { entity: string; label: string; color: string; unit: string }[];
  declare hours: number;
  declare series: Point[][];

  constructor() {
    super();
    this.hours = 24;
    this.series = [];
  }

  static styles = css`
    :host {
      display: block;
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .legend {
      display: flex;
      gap: 14px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--kh-text-2);
      margin-bottom: 4px;
    }
    .legend span::before {
      content: "";
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      background: rgb(var(--c));
      vertical-align: -1px;
    }
    .axis {
      fill: var(--kh-text-2);
      font-size: 10px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  private async load(): Promise<void> {
    const conn = store.hass?.connection;
    if (!conn || !this.entities?.length) return;
    const start = new Date(Date.now() - this.hours * 3600_000).toISOString();
    try {
      const res = await conn.sendMessagePromise<Record<string, { s: string; lu: number }[]>>({
        type: "history/history_during_period",
        start_time: start,
        entity_ids: this.entities.map((e) => e.entity),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      this.series = this.entities.map((e) =>
        (res[e.entity] ?? []).map((p) => ({ t: p.lu * 1000, v: Number(p.s) })).filter((p) => !isNaN(p.v)),
      );
    } catch {
      this.series = [];
    }
  }

  render() {
    if (!this.series.some((s) => s.length > 1)) return html`<div class="legend">Pas d'historique sur ${this.hours} h</div>`;
    const W = 320, H = 90, pad = 4;
    const t0 = Date.now() - this.hours * 3600_000, t1 = Date.now();
    const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
    return html`
      <div class="legend">
        ${this.entities.map((e, i) => {
          const last = this.series[i]?.at(-1)?.v;
          return html`<span style="--c:${e.color}">${e.label}${last !== undefined ? ` ${formatNumber(last)} ${e.unit}` : ""}</span>`;
        })}
      </div>
      ${svg`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Historique sur ${this.hours} heures">
        ${this.series.map((pts, i) => {
          if (pts.length < 2) return nothing;
          const vs = pts.map((p) => p.v);
          const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
          const y = (v: number) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
          const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
          return svg`<path d=${d} fill="none" stroke="rgb(${this.entities[i].color})" stroke-width="2" stroke-linejoin="round" />`;
        })}
      </svg>`}
    `;
  }
}
customElements.define("kh-sparkline", KhSparkline);
