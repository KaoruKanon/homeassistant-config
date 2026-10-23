import { LitElement, css, html, nothing, svg } from "lit";
import { formatNumber } from "../format.ts";
import { store } from "../store.ts";

interface Point {
  t: number;
  v: number;
}

/** Hourly (or `perHour`) averages: a trend, not every reading. */
function smooth(points: Point[], t0: number, t1: number, perHour: number): Point[] {
  const step = 3600_000 / perHour;
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of points) {
    if (p.t < t0) continue;
    const k = Math.floor((p.t - t0) / step);
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += p.v;
    b.n++;
    buckets.set(k, b);
  }
  // Carry the value in force at t0 so the curve starts at the left edge.
  const before = [...points].reverse().find((p) => p.t < t0);
  const out: Point[] = before ? [{ t: t0, v: before.v }] : [];
  [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([k, b]) => out.push({ t: t0 + (k + 0.5) * step, v: b.sum / b.n }));
  const last = points.at(-1);
  if (last && last.t <= t1) out.push({ t: Math.max(last.t, out.at(-1)?.t ?? t0), v: last.v });
  return out;
}

/** Monotone cubic path (Fritsch–Carlson): smooth, never overshoots the data. */
function monotonePath(xy: [number, number][]): string {
  const n = xy.length;
  if (n < 2) return "";
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xy[i + 1][0] - xy[i][0] || 1e-6);
    m.push((xy[i + 1][1] - xy[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(xy[i][0] + h).toFixed(1)} ${(xy[i][1] + h * t[i]).toFixed(1)} ${(xy[i + 1][0] - h).toFixed(1)} ${(xy[i + 1][1] - h * t[i + 1]).toFixed(1)} ${xy[i + 1][0].toFixed(1)} ${xy[i + 1][1].toFixed(1)}`;
  }
  return d;
}

let uid = 0;

/**
 * Trend of one or two numeric sensors over the last hours (e.g. temperature
 * and humidity), from the recorder: hourly averages drawn as a smooth curve,
 * as wide as its card.
 */
export class KhSparkline extends LitElement {
  static properties = {
    entities: { attribute: false },
    hours: { type: Number },
    compact: { type: Boolean },
    series: { state: true },
    width: { state: true },
  };
  declare entities: { entity: string; label: string; color: string; unit: string }[];
  declare hours: number;
  /** Small inline graph (cards): no legend, lower. */
  declare compact: boolean;
  declare series: Point[][];
  declare width: number;
  private gradient = `kh-spark-${++uid}`;
  private resize = new ResizeObserver(([e]) => (this.width = Math.max(80, Math.round(e.contentRect.width))));

  constructor() {
    super();
    this.hours = 24;
    this.series = [];
    this.width = 320;
  }

  static styles = css`
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
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
    path.line {
      stroke-dasharray: 2000;
      stroke-dashoffset: 2000;
      animation: draw 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      path.line {
        animation: none;
        stroke-dashoffset: 0;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
    this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
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
    if (!this.series.some((s) => s.length > 0))
      return this.compact ? nothing : html`<div class="legend">Pas d'historique sur ${this.hours} h</div>`;
    const W = this.width, H = this.compact ? 52 : 110, pad = this.compact ? 4 : 8;
    const t1 = Date.now(), t0 = t1 - this.hours * 3600_000;
    const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
    const perHour = this.hours <= 12 ? 2 : 1;
    return html`
      ${this.compact
        ? nothing
        : html`<div class="legend">
            ${this.entities.map((e, i) => {
              const last = this.series[i]?.at(-1)?.v;
              return html`<span style="--c:${e.color}">${e.label}${last !== undefined ? ` ${formatNumber(last)} ${e.unit}` : ""}</span>`;
            })}
          </div>`}
      ${svg`<svg viewBox="0 0 ${W} ${H}" height=${H} role="img" aria-label="Tendance sur ${this.hours} heures">
        <defs>${this.entities.map(
          (e, i) => svg`<linearGradient id="${this.gradient}-${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgb(${e.color})" stop-opacity="0.35" />
            <stop offset="1" stop-color="rgb(${e.color})" stop-opacity="0" />
          </linearGradient>`,
        )}</defs>
        ${this.series.map((raw, i) => {
          const pts = smooth(raw, t0, t1, perHour);
          if (pts.length < 2) return nothing;
          const vs = pts.map((p) => p.v);
          const lo = Math.min(...vs), hi = Math.max(...vs), span = Math.max(hi - lo, i === 0 ? 1 : 4);
          const mid = (lo + hi) / 2;
          // Each series on its own scale, kept away from the edges.
          const y = (v: number) => H / 2 - ((v - mid) / span) * (H - 2 * pad - 6);
          const xy = pts.map((p) => [x(p.t), y(p.v)] as [number, number]);
          const d = monotonePath(xy);
          const end = xy.at(-1)!;
          return svg`
            ${i === 0 ? svg`<path d="${d} L${end[0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z" fill="url(#${this.gradient}-${i})" />` : nothing}
            <path class="line" d=${d} fill="none" stroke="rgb(${this.entities[i].color})" stroke-width=${i === 0 ? 2.5 : 1.75}
              stroke-linecap="round" stroke-linejoin="round" opacity=${i === 0 ? 1 : 0.8} />
            <circle cx=${end[0]} cy=${end[1]} r=${i === 0 ? 3.5 : 2.5} fill="rgb(${this.entities[i].color})" />`;
        })}
      </svg>`}
    `;
  }
}
customElements.define("kh-sparkline", KhSparkline);
