import { LitElement, css, html, nothing, svg } from "lit";
import { formatNumber } from "../format.ts";
import { store } from "../store.ts";

interface Point {
  t: number;
  v: number;
}

const hourFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Averages per step (`perHour` per hour): a trend, not every reading. */
function smooth(points: Point[], t0: number, perHour: number): Point[] {
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
  if (last && last.t >= t0) out.push({ t: Math.max(last.t, out.at(-1)?.t ?? t0), v: last.v });
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
 * Trend of one or two numeric sensors (e.g. temperature and humidity) from
 * the recorder: averaged, drawn as smooth filled curves across the whole
 * width (the time axis spans the data), min/max of the first series, and a
 * cursor to read any hour (hover or drag).
 */
export class KhSparkline extends LitElement {
  static properties = {
    entities: { attribute: false },
    hours: { type: Number },
    compact: { type: Boolean },
    height: { type: Number },
    series: { state: true },
    width: { state: true },
    cursor: { state: true },
  };
  declare entities: { entity: string; label: string; color: string; unit: string }[];
  declare hours: number;
  /** Small inline graph (cards): no legend, axis or cursor. */
  declare compact: boolean;
  declare height?: number;
  declare series: Point[][];
  declare width: number;
  /** Time under the finger or pointer. */
  declare cursor?: number;
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
      overflow: visible;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 16px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--kh-text-2);
      margin-bottom: 8px;
      min-height: 20px;
    }
    .legend b {
      color: var(--kh-text);
      font-variant-numeric: tabular-nums;
    }
    .legend .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      background: rgb(var(--c));
      vertical-align: -1px;
    }
    .legend .when {
      margin-left: auto;
    }
    .plot {
      touch-action: pan-y;
      cursor: crosshair;
    }
    text {
      font: 600 11px var(--kh-font, system-ui);
      fill: var(--kh-text-2);
      font-variant-numeric: tabular-nums;
    }
    path.line {
      stroke-dasharray: 3000;
      stroke-dashoffset: 3000;
      animation: draw 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    path.area {
      animation: fade 900ms ease-out;
    }
    .pulse {
      animation: pulse 2.4s ease-out infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 0.55;
      }
      100% {
        transform: scale(3.2);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      path.line,
      path.area,
      .pulse {
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

  private pointer(e: PointerEvent, t0: number, t1: number, pad: number): void {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left - pad) / (r.width - 2 * pad)));
    this.cursor = t0 + f * (t1 - t0);
  }

  render() {
    if (!this.series.some((s) => s.length > 0))
      return this.compact ? nothing : html`<div class="legend">Pas d'historique sur ${this.hours} h</div>`;
    const compact = this.compact;
    const W = this.width, H = this.height ?? (compact ? 52 : 150);
    // Compact graphs bleed to the edges of their card (left, right, bottom).
    const padX = compact ? 0 : 4, top = compact ? 8 : 14, bottom = compact ? 0 : 22;
    const now = Date.now(), from = now - this.hours * 3600_000;
    const perHour = this.hours <= 12 ? 2 : 1;
    const smoothed = this.series.map((raw) => smooth(raw, from, perHour));
    const all = smoothed.flat();
    // The time axis spans the data, so the curves always fill the width.
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(t0 + 3600_000, ...all.map((p) => p.t));
    const x = (t: number) => padX + ((t - t0) / (t1 - t0)) * (W - 2 * padX);
    const stale = now - t1 > 2 * 3600_000;

    const scales = smoothed.map((pts, i) => {
      const vs = pts.map((p) => p.v);
      const lo = Math.min(...vs), hi = Math.max(...vs);
      const span = Math.max(hi - lo, i === 0 ? 1 : 4), mid = (lo + hi) / 2;
      // Each series on its own scale, kept inside the plot.
      const y = (v: number) => top + (H - top - bottom) / 2 - ((v - mid) / span) * (H - top - bottom - 4);
      return { lo, hi, y };
    });
    const at = (pts: Point[], t: number) => pts.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), pts[0]);
    const cur = this.cursor !== undefined && !compact ? this.cursor : undefined;

    const legend = compact
      ? nothing
      : html`<div class="legend">
          ${this.entities.map((e, i) => {
            const pts = smoothed[i];
            if (!pts?.length) return nothing;
            const v = cur !== undefined ? at(pts, cur).v : Number(store.hass?.states[e.entity]?.state);
            const shown = isNaN(v) ? this.series[i].at(-1)?.v : v;
            return html`<span style="--c:${e.color}"><span class="dot"></span>${e.label}
              <b>${shown !== undefined ? `${formatNumber(shown)} ${e.unit}` : "—"}</b></span>`;
          })}
          <span class="when">${cur !== undefined ? hourFormat.format(new Date(cur)) : stale ? `relevé à ${hourFormat.format(new Date(t1))}` : ""}</span>
        </div>`;

    const first = this.entities[0];
    const s0 = scales[0];
    return html`
      ${legend}
      ${svg`<svg class="plot" viewBox="0 0 ${W} ${H}" height=${H} role="img" aria-label="Tendance sur ${this.hours} heures"
        @pointermove=${(e: PointerEvent) => !compact && this.pointer(e, t0, t1, padX)}
        @pointerdown=${(e: PointerEvent) => !compact && this.pointer(e, t0, t1, padX)}
        @pointerleave=${() => (this.cursor = undefined)}
        @pointercancel=${() => (this.cursor = undefined)}>
        <defs>${this.entities.map(
          (e, i) => svg`<linearGradient id="${this.gradient}-${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgb(${e.color})" stop-opacity=${i === 0 ? 0.42 : 0.22} />
            <stop offset="1" stop-color="rgb(${e.color})" stop-opacity=${compact ? 0.06 : 0} />
          </linearGradient>`,
        )}</defs>
        ${!compact && s0 && smoothed[0]?.length > 1
          ? svg`
            <line x1="0" x2=${W} y1=${s0.y(s0.hi)} y2=${s0.y(s0.hi)} stroke="var(--kh-line)" stroke-dasharray="3 5" />
            <line x1="0" x2=${W} y1=${s0.y(s0.lo)} y2=${s0.y(s0.lo)} stroke="var(--kh-line)" stroke-dasharray="3 5" />
            <text x=${W - 2} y=${s0.y(s0.hi) - 4} text-anchor="end">max ${formatNumber(s0.hi)} ${first.unit}</text>
            <text x=${W - 2} y=${s0.y(s0.lo) + 13} text-anchor="end">min ${formatNumber(s0.lo)} ${first.unit}</text>
            <text x=${padX} y=${H - 4}>${hourFormat.format(new Date(t0))}</text>
            <text x=${W / 2} y=${H - 4} text-anchor="middle">${hourFormat.format(new Date((t0 + t1) / 2))}</text>
            <text x=${W - padX} y=${H - 4} text-anchor="end">${stale ? hourFormat.format(new Date(t1)) : "maintenant"}</text>`
          : nothing}
        ${smoothed
          .map((pts, i) => ({ pts, i }))
          .reverse() // first series drawn last, on top
          .map(({ pts, i }) => {
            if (pts.length < 2) return nothing;
            const xy = pts.map((p) => [x(p.t), scales[i].y(p.v)] as [number, number]);
            const d = monotonePath(xy);
            const end = xy.at(-1)!;
            const color = this.entities[i].color;
            const base = H - bottom;
            return svg`
              <path class="area" d="${d} L${end[0].toFixed(1)} ${base} L${xy[0][0].toFixed(1)} ${base} Z" fill="url(#${this.gradient}-${i})" />
              <path class="line" d=${d} fill="none" stroke="rgb(${color})" stroke-width=${i === 0 ? 2.75 : 2}
                stroke-linecap="round" stroke-linejoin="round" opacity=${i === 0 ? 1 : 0.85} />
              ${compact
                ? nothing
                : svg`${stale ? nothing : svg`<circle class="pulse" cx=${end[0]} cy=${end[1]} r="3.5" fill="rgb(${color})" />`}
                  <circle cx=${end[0]} cy=${end[1]} r=${i === 0 ? 4 : 3} fill="rgb(${color})" stroke="var(--kh-dialog, #fff)" stroke-width="1.5" />`}`;
          })}
        ${cur !== undefined
          ? svg`<line x1=${x(cur)} x2=${x(cur)} y1=${top - 6} y2=${H - bottom} stroke="var(--kh-text-2)" stroke-width="1" />
            ${smoothed.map((pts, i) => {
              if (pts.length < 2) return nothing;
              const p = at(pts, cur);
              return svg`<circle cx=${x(p.t)} cy=${scales[i].y(p.v)} r="5" fill="rgb(${this.entities[i].color})" stroke="#fff" stroke-width="2" />`;
            })}`
          : nothing}
      </svg>`}
    `;
  }
}
customElements.define("kh-sparkline", KhSparkline);
