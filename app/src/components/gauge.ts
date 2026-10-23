import { css, html, svg } from "lit";
import { formatNumber } from "../format.ts";

/** Semi-circle gauge, filled to value/max; amber then red as it gets worse. */
export function gauge(label: string, value: number, max: number, unit: string, color: string, invert = false) {
  const pct = isNaN(value) ? 0 : Math.min(1, value / max);
  const r = 44, c = Math.PI * r;
  const good = invert ? 1 - pct : pct;
  const tone = isNaN(value) ? "grey" : good > 0.5 ? color : good > 0.2 ? "orange" : "red";
  return html`<div class="gauge" style="--rgb: var(--rgb-${tone})">
    ${svg`<svg viewBox="0 0 110 64" aria-hidden="true">
      <path d="M11 58 A44 44 0 0 1 99 58" fill="none" stroke="var(--kh-card-2)" stroke-width="10" stroke-linecap="round" />
      <path d="M11 58 A44 44 0 0 1 99 58" fill="none" stroke="rgb(var(--rgb))" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" style="transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" />
    </svg>`}
    <div class="g-value">${isNaN(value) ? "—" : formatNumber(value, 0)}<small> ${unit}</small></div>
    <div class="secondary">${label}</div>
  </div>`;
}

export const gaugeStyles = css`
  .gauge {
    display: grid;
    justify-items: center;
    text-align: center;
  }
  .gauge svg {
    width: 100%;
    max-width: 130px;
  }
  .g-value {
    margin-top: -22px;
    font-weight: 800;
    font-size: 1.125rem;
    font-variant-numeric: tabular-nums;
  }
  .g-value small {
    font-size: 0.75rem;
    color: var(--kh-text-2);
  }
`;
