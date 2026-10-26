import { css, html, nothing, svg } from "lit";

/**
 * V3 design system. One rule above all: colour carries information. Surfaces
 * are neutral slate; a family colour (lights amber, media violet, climate
 * green…) shows on its card's icon and on what is on, never as a wash over
 * a whole tile. Three radii by level (card 22, item 14, pill), no shadows in
 * the dark theme, two typefaces: Onest for the interface, Bricolage Grotesque
 * for the clock, titles and key numbers.
 *
 * The shared --kh-* tokens and the --rgb-* palette are redefined here, so the
 * components V3 reuses from V2 (media card, favourites, popups) match it.
 */
export const theme = css`
  :host {
    --v3-bg: #e9edf2;
    --v3-surface: #ffffff;
    --v3-well: #f1f4f7;
    --v3-well-hi: #e6eaef;
    --v3-line: rgb(24 32 42 / 0.08);
    --v3-text: #18202a;
    --v3-muted: #5e6a77;
    --v3-faint: #8c96a1;
    --v3-veil: rgb(255 255 255 / 0.82);

    --v3-ui: "Onest", -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    --v3-display: "Bricolage Grotesque", "Onest", system-ui, sans-serif;
    --v3-r-card: 22px;
    --v3-r-item: 14px;
    --v3-gap: 14px;

    /* The Mushroom families, tuned to sit together on slate. "r, g, b". */
    --rgb-amber: 245, 168, 50;
    --rgb-yellow: 245, 196, 60;
    --rgb-orange: 245, 128, 56;
    --rgb-red: 236, 84, 92;
    --rgb-purple: 150, 110, 240;
    --rgb-jellyfin: 160, 100, 215;
    --rgb-indigo: 104, 118, 240;
    --rgb-blue: 56, 140, 240;
    --rgb-light-blue: 60, 170, 235;
    --rgb-teal: 30, 170, 165;
    --rgb-green: 50, 175, 120;
    --rgb-grey: 140, 150, 161;
    --rgb-spotify: 30, 215, 96;

    /* What the shared V1/V2 components read. */
    --kh-bg: var(--v3-bg);
    --kh-card: var(--v3-well);
    --kh-card-2: var(--v3-well-hi);
    --kh-line: var(--v3-line);
    --kh-text: var(--v3-text);
    --kh-text-2: var(--v3-muted);
    --kh-shadow: none;
    --kh-dialog: var(--v3-surface);
    --kh-font: var(--v3-ui);
    --kh-radius: var(--v3-r-item);
    --kh-radius-icon: 12px;
    --kh-alert: rgb(var(--rgb-red));
    --kh-on-alert: #ffffff;
    --kh-accent: rgb(var(--rgb-blue));
    --kh-on-accent: #ffffff;
    color-scheme: light;
  }
  :host([dark]) {
    --v3-bg: #1d232b;
    --v3-surface: #262d36;
    --v3-well: #2f3741;
    --v3-well-hi: #38414c;
    --v3-line: rgb(255 255 255 / 0.07);
    --v3-text: #eef2f6;
    --v3-muted: #9ba6b2;
    --v3-faint: #6f7a86;
    --v3-veil: rgb(29 35 43 / 0.78);

    --rgb-amber: 255, 184, 77;
    --rgb-yellow: 255, 208, 92;
    --rgb-orange: 255, 145, 80;
    --rgb-red: 255, 102, 108;
    --rgb-purple: 180, 146, 255;
    --rgb-jellyfin: 190, 130, 240;
    --rgb-indigo: 140, 152, 255;
    --rgb-blue: 98, 168, 255;
    --rgb-light-blue: 102, 196, 255;
    --rgb-teal: 72, 204, 196;
    --rgb-green: 92, 206, 154;
    --rgb-grey: 155, 166, 178;

    --kh-on-alert: #1d232b;
    --kh-on-accent: #10233a;
    color-scheme: dark;
  }
`;

/** Building blocks shared by the V3 pages. */
export const ui = css`
  :host {
    font-family: var(--v3-ui);
    font-size: 15px;
    font-weight: 450;
    line-height: 1.4;
    color: var(--v3-text);
    -webkit-font-smoothing: antialiased;
  }
  .card {
    position: relative;
    min-width: 0;
    box-sizing: border-box;
    padding: 16px;
    border-radius: var(--v3-r-card);
    background: var(--v3-surface);
    box-shadow: inset 0 0 0 1px var(--v3-line);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 12px;
  }
  /* Card header: the family icon in its colour, the title, an optional link. */
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: -0.005em;
  }
  .head .glyph {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: rgba(var(--fam, var(--rgb-grey)), 0.16);
    color: rgb(var(--fam, var(--rgb-grey)));
    --mdc-icon-size: 17px;
  }
  .head .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .head a,
  .head .aside {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 32px;
    padding: 0 4px 0 10px;
    border-radius: 16px;
    color: var(--v3-muted);
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    --mdc-icon-size: 18px;
  }
  .head a:hover {
    color: var(--v3-text);
    background: var(--v3-well);
  }
  .well {
    border-radius: var(--v3-r-item);
    background: var(--v3-well);
  }
  .muted {
    color: var(--v3-muted);
  }
  .num {
    font-family: var(--v3-display);
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
    letter-spacing: -0.01em;
  }
  .ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: inherit;
    -webkit-user-select: none;
    user-select: none;
    touch-action: manipulation;
  }
  button,
  a {
    -webkit-tap-highlight-color: transparent;
    transition: background-color 180ms ease, color 180ms ease, transform 160ms ease;
  }
  button:active:not(:disabled),
  a:active {
    transform: scale(0.97);
  }
  button:focus-visible,
  a:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid rgb(var(--rgb-blue));
    outline-offset: 2px;
  }
  ha-icon,
  ha-state-icon {
    display: inline-flex;
    --mdc-icon-size: 20px;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
      animation: none !important;
    }
  }
`;

/** Card header: family icon, title, optional link on the right. */
export function head(icon: string, title: string, link?: { href: string; label: string }, aside?: unknown) {
  return html`<h2 class="head">
    <span class="glyph" aria-hidden="true"><ha-icon icon=${icon}></ha-icon></span>
    <span class="title">${title}</span>
    ${aside ?? nothing}
    ${link ? html`<a href=${link.href}>${link.label}<ha-icon icon="mdi:chevron-right"></ha-icon></a>` : nothing}
  </h2>`;
}

/** Ring around an avatar: a phone's battery, 0..1. */
export function ring(f: number, size: number, stroke: number, color: string) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return svg`<svg class="ring" width=${size} height=${size} viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="rgb(255 255 255 / 0.25)" stroke-width=${stroke} />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} stroke-width=${stroke} stroke-linecap="round"
      stroke-dasharray=${c} stroke-dashoffset=${c * (1 - Math.min(1, Math.max(0, f)))} transform="rotate(-90 ${size / 2} ${size / 2})" />
  </svg>`;
}

/** Splits a list into pages of `n` (a kh-swipe page each). */
export function pagesOf<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/**
 * Wall layout: a landscape tablet, or a PC window shaped like one. Judged on
 * the width the panel really has (HA's sidebar excluded) and the window height.
 */
export function isWall(panelWidth: number): boolean {
  return panelWidth >= 900 && window.innerHeight <= 1100 && window.innerWidth > window.innerHeight;
}

/**
 * The two typefaces, served next to the bundle (fonts/). @font-face only
 * works from the document, not from a shadow root: added once to <head>.
 */
export function loadFonts(): void {
  if (document.getElementById("kh3-fonts")) return;
  const base = (window as { __khAssets?: string }).__khAssets ?? "/local/kaoru-home/";
  const style = document.createElement("style");
  style.id = "kh3-fonts";
  style.textContent = `
    @font-face { font-family: "Onest"; font-weight: 100 900; font-display: swap; src: url("${base}fonts/onest.woff2") format("woff2"); }
    @font-face { font-family: "Bricolage Grotesque"; font-weight: 200 800; font-display: swap; src: url("${base}fonts/bricolage-grotesque.woff2") format("woff2"); }
  `;
  document.head.append(style);
}
