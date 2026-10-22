import { css } from "lit";

/**
 * Design tokens. Defined once on the panel host (and on the confirm dialog,
 * which lives outside it); every component reads them through var().
 */
export const tokens = css`
  :host {
    --kh-bg: #f3f1f7;
    --kh-surface: #ffffff;
    --kh-surface-2: #ebe7f2;
    --kh-line: #ddd8e6;
    --kh-text: #1d1726;
    --kh-text-2: #625a70;
    --kh-accent: #7e4ff0;
    --kh-accent-soft: #ece4ff;
    --kh-warm: #a86f00;
    --kh-warm-soft: #fff0cc;
    --kh-alert: #c0352f;
    --kh-alert-soft: #fde6e4;
    --kh-ok: #1f7a52;

    --kh-font: "Atkinson Hyperlegible", system-ui, sans-serif;
    --kh-display: "Dela Gothic One", "Atkinson Hyperlegible", system-ui, sans-serif;
    --kh-radius: 14px;
    --kh-radius-sm: 10px;
    --kh-gap: 12px;
    --kh-tap: 48px;
    color-scheme: light;
  }
  :host([dark]) {
    --kh-bg: #0e0a15;
    --kh-surface: #17111f;
    --kh-surface-2: #221a2e;
    --kh-line: #342b44;
    --kh-text: #ece7f3;
    --kh-text-2: #a79fb8;
    --kh-accent: #a982ff;
    --kh-accent-soft: #2a1f45;
    --kh-warm: #f2b84b;
    --kh-warm-soft: #3a2c12;
    --kh-alert: #ff8a80;
    --kh-alert-soft: #3d1a1c;
    --kh-ok: #6fd6a6;
    color-scheme: dark;
  }
`;

/** Buttons and focus rings shared by components. */
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
  a:focus-visible {
    outline: 3px solid var(--kh-accent);
    outline-offset: 2px;
  }
  ha-state-icon,
  ha-icon {
    --mdc-icon-size: 24px;
    display: inline-flex;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
