import { LitElement, css, html, nothing, svg } from "lit";
import { formatNumber } from "../format.ts";
import { base } from "../styles.ts";

export interface SankeyFlow {
  name: string;
  watts: number;
  /** Opens the device's details. */
  open?: () => void;
}

const COLORS = ["#ff9800", "#03a9f4", "#9c27b0", "#4caf50", "#e85d75", "#ffc107", "#009688", "#3f51b5"];

/**
 * Where the power goes right now: the meter on the left, one band per
 * device on the right, its width proportional to the watts it draws; what
 * the plugs do not measure is "Reste de la maison". Tap a band or a name to
 * highlight it, tap the name again for the device.
 */
export class KhSankey extends LitElement {
  static properties = { total: { type: Number }, flows: { attribute: false }, width: { state: true }, picked: { state: true } };
  declare total: number;
  declare flows: SankeyFlow[];
  declare width: number;
  declare picked?: number;
  private resize = new ResizeObserver(([e]) => (this.width = Math.max(260, Math.round(e.contentRect.width))));

  constructor() {
    super();
    this.total = NaN;
    this.flows = [];
    this.width = 600;
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .band {
        cursor: pointer;
        transition: opacity 200ms ease;
      }
      .dim {
        opacity: 0.18;
      }
      text {
        font: 600 13px var(--kh-font, system-ui);
        fill: var(--kh-text);
      }
      text.sub {
        font-size: 12px;
        fill: var(--kh-text-2);
        font-variant-numeric: tabular-nums;
      }
      text.big {
        font-size: 20px;
        font-weight: 800;
      }
      .name {
        cursor: pointer;
      }
      .empty {
        color: var(--kh-text-2);
        padding: 12px 0;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
  }

  render() {
    const measured = this.flows.filter((f) => f.watts > 0).sort((a, b) => b.watts - a.watts);
    const sum = measured.reduce((s, f) => s + f.watts, 0);
    const total = !isNaN(this.total) && this.total > 0 ? Math.max(this.total, sum) : sum;
    if (total <= 0) return html`<div class="empty">Pas de mesure de puissance pour le moment.</div>`;
    // Small consumers grouped, so every band stays readable.
    const min = total * 0.03;
    const shown = measured.filter((f) => f.watts >= min);
    const small = measured.filter((f) => f.watts < min);
    const items: SankeyFlow[] = [...shown];
    if (small.length) items.push({ name: small.length === 1 ? small[0].name : `${small.length} autres appareils`, watts: small.reduce((s, f) => s + f.watts, 0) });
    if (total - sum > total * 0.01) items.push({ name: "Reste de la maison", watts: total - sum });

    const W = this.width;
    const narrow = W < 480;
    const gap = 10, nodeW = 14;
    const labelW = narrow ? 120 : 190;
    const x0 = narrow ? 0 : 110, x1 = W - labelW - nodeW;
    const rowMin = 34;
    const H = Math.max(180, items.length * (rowMin + gap));
    const usable = H - gap * (items.length - 1);
    const scale = usable / total;
    // Right nodes: each at least rowMin high for its label, the rest by watts.
    let y = 0;
    const right = items.map((f) => {
      const h = Math.max(4, f.watts * scale);
      const node = { f, y, h, slot: Math.max(rowMin, h) };
      y += node.slot + gap;
      return node;
    });
    const totalH = y - gap;
    const leftH = Math.min(totalH, total * scale);
    const leftY = (totalH - leftH) / 2;
    let ly = leftY;

    return html`${svg`<svg viewBox="${narrow ? -4 : -4} -8 ${W + 8} ${totalH + 16}" role="img" aria-label="Répartition de la consommation">
      ${narrow
        ? nothing
        : svg`<text class="big" x="0" y=${leftY + leftH / 2 - 4}>${formatNumber(total, 0)} W</text>
            <text class="sub" x="0" y=${leftY + leftH / 2 + 14}>en ce moment</text>`}
      <rect x=${x0} y=${leftY} width=${nodeW} height=${leftH} rx="4" fill="#ffb74d" />
      ${right.map((n, i) => {
        const band = n.f.watts * scale;
        const sy0 = ly, sy1 = ly + band;
        ly += band;
        const ty0 = n.y + (n.slot - n.h) / 2, ty1 = ty0 + n.h;
        const ax = x0 + nodeW, bx = x1, mx = (ax + bx) / 2;
        const color = n.f.name === "Reste de la maison" ? "#9e9e9e" : COLORS[i % COLORS.length];
        const dim = this.picked !== undefined && this.picked !== i;
        const pick = () => (this.picked = this.picked === i ? undefined : i);
        return svg`<g class="band ${dim ? "dim" : ""}" @click=${pick}>
            <path d="M${ax} ${sy0} C${mx} ${sy0} ${mx} ${ty0} ${bx} ${ty0} L${bx} ${ty1} C${mx} ${ty1} ${mx} ${sy1} ${ax} ${sy1} Z" fill=${color} opacity="0.38" />
            <rect x=${x1} y=${ty0} width=${nodeW} height=${n.h} rx="3" fill=${color} />
            <title>${n.f.name} : ${formatNumber(n.f.watts, 0)} W</title>
          </g>
          <g class="name ${dim ? "dim" : ""}" @click=${() => (this.picked === i && n.f.open ? n.f.open() : pick())}>
            <text x=${x1 + nodeW + 10} y=${n.y + n.slot / 2 - 2}>${n.f.name.length > (narrow ? 14 : 24) ? `${n.f.name.slice(0, narrow ? 13 : 23)}…` : n.f.name}</text>
            <text class="sub" x=${x1 + nodeW + 10} y=${n.y + n.slot / 2 + 14}>${formatNumber(n.f.watts, 0)} W, ${formatNumber((n.f.watts / total) * 100, 0)} %</text>
          </g>`;
      })}
    </svg>`}`;
  }
}
customElements.define("kh-sankey", KhSankey);
