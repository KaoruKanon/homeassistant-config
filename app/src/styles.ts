import { css } from "lit";

/**
 * Design tokens, after the Adaptive Mushroom theme of the old dashboard.
 * Defined on the panel host (and on the confirm dialog, which lives outside
 * it); every component reads them through var().
 */
export const tokens = css`
  :host {
    --kh-bg: #efefef;
    --kh-card: #fafafa;
    --kh-card-2: rgb(0 0 0 / 0.05);
    --kh-line: rgb(0 0 0 / 0.08);
    --kh-text: #212121;
    --kh-text-2: #727272;
    --kh-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
    --kh-dialog: #ffffff;

    /* Mushroom colours, as "r, g, b" for tints */
    --rgb-amber: 255, 160, 0;
    --rgb-orange: 255, 152, 0;
    --rgb-blue: 33, 150, 243;
    --rgb-light-blue: 3, 169, 244;
    --rgb-green: 76, 175, 80;
    --rgb-red: 244, 67, 54;
    --rgb-purple: 156, 39, 176;
    --rgb-indigo: 63, 81, 181;
    --rgb-teal: 0, 150, 136;
    --rgb-grey: 158, 158, 158;
    --rgb-yellow: 255, 193, 7;
    --rgb-spotify: 30, 215, 96;
    --rgb-jellyfin: 170, 92, 195;

    --kh-alert: #d32f2f;
    --kh-on-alert: #ffffff;
    --kh-accent: rgb(var(--rgb-blue));
    --kh-on-accent: #ffffff;

    --kh-font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, system-ui, sans-serif;
    --kh-radius: 16px;
    --kh-radius-icon: 12px;
    --kh-gap: 12px;
    --kh-tap: 48px;
    color-scheme: light;
  }
  :host([dark]) {
    --kh-bg: linear-gradient(160deg, #2c3338 0%, #1f2326 55%, #1a1d20 100%);
    --kh-card: rgb(115 115 115 / 0.15);
    --kh-card-2: rgb(255 255 255 / 0.06);
    --kh-line: rgb(255 255 255 / 0.06);
    --kh-text: #e9eaeb;
    --kh-text-2: #9ea4a9;
    --kh-shadow: none;
    --kh-dialog: #2a2f33;
    --kh-alert: #ef5350;
    --kh-on-alert: #1a1d20;
    --kh-on-accent: #0b1a26;
    color-scheme: dark;
  }
`;

/** Shared bits: buttons, focus ring, the Mushroom "shape icon", motion. */
export const base = css`
  :host {
    font-family: var(--kh-font);
    color: var(--kh-text);
    -webkit-tap-highlight-color: transparent;
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 3px solid rgb(var(--rgb-blue));
    outline-offset: 2px;
  }
  ha-state-icon,
  ha-icon {
    --mdc-icon-size: 22px;
    display: inline-flex;
  }
  .card {
    background: var(--kh-card);
    border-radius: var(--kh-radius);
    box-shadow: var(--kh-shadow);
  }
  /* Tinted square behind an icon; --rgb sets the colour. */
  .shape {
    flex: none;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: var(--kh-radius-icon);
    background: rgba(var(--rgb, var(--rgb-grey)), 0.2);
    color: rgb(var(--rgb, var(--rgb-grey)));
  }
  .shape.off {
    background: var(--kh-card-2);
    color: var(--kh-text-2);
  }
  .primary {
    font-weight: 700;
    font-size: 0.9375rem;
    line-height: 1.25;
  }
  .secondary {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--kh-text-2);
    line-height: 1.3;
  }
  .ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  @keyframes kh-blink {
    50% {
      opacity: 0.35;
    }
  }
  @keyframes kh-breathe {
    50% {
      box-shadow: 0 0 0 5px rgba(var(--rgb, var(--rgb-green)), 0.25);
    }
  }
  @keyframes kh-shake {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-8deg) scale(1.05); }
    75% { transform: rotate(8deg) scale(1.05); }
  }
  @keyframes kh-charge {
    from { clip-path: inset(100% 0 0 0); }
    to { clip-path: inset(0 0 0 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
