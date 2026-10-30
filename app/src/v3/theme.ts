import { css } from "lit";

// Maison V3 design tokens. One light palette and four dark ones; the choice
// (Auto / Clair / Sombre + palette) is made in Système and kept per screen.

export type Palette = "ardoise" | "foret" | "ocean" | "graphite";
export type Mode = "auto" | "light" | "dark";
export interface ThemeChoice {
  mode: Mode;
  palette: Palette;
}

type Tokens = Record<string, string>;

const LIGHT: Tokens = {
  bg: "#ECEFF7", surf: "#FFFFFF", surf2: "#F2F4FA", ink: "#1B1E33", muted: "#596079",
  blue: "#2F6FDB", blueTint: "#E2ECFF", amber: "#FF9F1C", amberInk: "#8A4B00", amberTint: "#FFEBD1",
  yellow: "#F2C200", yellowInk: "#6E5600", yellowTint: "#FFF6CC", violet: "#6A4FE8", violetTint: "#ECE8FF",
  teal: "#0E8576", tealTint: "#DDF5F1", red: "#CF2F35", redTint: "#FFE4E4", warm: "#FFE3B8",
  navBg: "rgba(255,255,255,.88)", shadow: "0 8px 30px rgba(20,24,60,.12)",
};

const DARK: Record<Palette, Tokens> = {
  ardoise: {
    bg: "#0F1318", surf: "#181E26", surf2: "#222A34", ink: "#ECF0F5", muted: "#9AA6B5",
    blue: "#6FA8FF", blueTint: "#1A2A40", amber: "#FFAE45", amberInk: "#FFCB85", amberTint: "#33281A",
    yellow: "#FFD84D", yellowInk: "#FFE48A", yellowTint: "#332E18", violet: "#A99BFF", violetTint: "#242844",
    teal: "#4FD8C4", tealTint: "#143331", red: "#FF7380", redTint: "#3A1E24", warm: "#3D3020",
    navBg: "rgba(24,30,38,.88)", shadow: "0 8px 30px rgba(0,0,0,.4)",
  },
  foret: {
    bg: "#0D1411", surf: "#151F1A", surf2: "#1F2B25", ink: "#EAF2EC", muted: "#9DB0A5",
    blue: "#7AB0FF", blueTint: "#1B2C3A", amber: "#FFB347", amberInk: "#FFD08A", amberTint: "#33291A",
    yellow: "#F5D547", yellowInk: "#FBE38A", yellowTint: "#30301A", violet: "#B3A2FF", violetTint: "#262A3E",
    teal: "#5FD9B6", tealTint: "#153A2E", red: "#FF7A70", redTint: "#3A1E1C", warm: "#3B3120",
    navBg: "rgba(21,31,26,.88)", shadow: "0 8px 30px rgba(0,0,0,.4)",
  },
  ocean: {
    bg: "#0B1419", surf: "#122028", surf2: "#1A2C36", ink: "#E6F1F4", muted: "#93ABB5",
    blue: "#66B3FF", blueTint: "#15324A", amber: "#FFB547", amberInk: "#FFD08A", amberTint: "#362A16",
    yellow: "#FFE15C", yellowInk: "#FFEA94", yellowTint: "#333016", violet: "#A99BFF", violetTint: "#252A4E",
    teal: "#3EE0C0", tealTint: "#0F3A36", red: "#FF6F6F", redTint: "#3E1E22", warm: "#3F3220",
    navBg: "rgba(18,32,40,.88)", shadow: "0 8px 30px rgba(0,0,0,.4)",
  },
  graphite: {
    bg: "#121212", surf: "#1C1B1A", surf2: "#272523", ink: "#F2EFEA", muted: "#ADA79E",
    blue: "#7AA7F0", blueTint: "#1E2838", amber: "#FFA94D", amberInk: "#FFC98C", amberTint: "#352819",
    yellow: "#F5D547", yellowInk: "#FBE38A", yellowTint: "#322D16", violet: "#B49CF5", violetTint: "#2C2638",
    teal: "#5CCFB9", tealTint: "#17302B", red: "#FF7A70", redTint: "#3A1E1C", warm: "#40301F",
    navBg: "rgba(28,27,26,.88)", shadow: "0 8px 30px rgba(0,0,0,.4)",
  },
};

export const PALETTES: { id: Palette; name: string }[] = [
  { id: "ardoise", name: "Ardoise" },
  { id: "foret", name: "Forêt" },
  { id: "ocean", name: "Océan" },
  { id: "graphite", name: "Graphite" },
];

/** Swatch colours for the theme picker: background, surface, accent. */
export function swatch(p: Palette): [string, string, string] {
  const t = DARK[p];
  return [t.bg, t.surf2, t.blue];
}

const KEY = "kh3-theme";
const DEFAULT: ThemeChoice = { mode: "auto", palette: "ardoise" };

export function loadTheme(): ThemeChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && ["auto", "light", "dark"].includes(v.mode) && v.palette in DARK) return v;
  } catch {
    /* private browsing */
  }
  return DEFAULT;
}

/** Saves the choice for this screen and tells the shell to repaint. */
export function saveTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    /* not kept, still applied */
  }
  window.dispatchEvent(new CustomEvent("kh3-theme", { detail: choice }));
}

/** The CSS custom properties of a theme, as an inline style. */
export function themeStyle(choice: ThemeChoice, systemDark: boolean): string {
  const dark = choice.mode === "dark" || (choice.mode === "auto" && systemDark);
  const t = dark ? DARK[choice.palette] : LIGHT;
  return Object.entries(t)
    .map(([k, v]) => `--${k}:${v}`)
    .concat(`color-scheme:${dark ? "dark" : "light"}`)
    .join(";");
}

export function isDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice.mode === "dark" || (choice.mode === "auto" && systemDark);
}

/**
 * The details popups, the confirmation and the toasts are shared with V1/V2
 * and live outside the panel: give them the V3 colours while V3 is shown
 * (a document rule on their host beats their own :host defaults).
 */
export function themeShared(choice: ThemeChoice | undefined, systemDark: boolean): void {
  let el = document.getElementById("kh3-shared-theme");
  if (!choice) return el?.remove();
  const dark = isDark(choice, systemDark);
  const t = dark ? DARK[choice.palette] : LIGHT;
  if (!el) {
    el = document.createElement("style");
    el.id = "kh3-shared-theme";
    document.head.append(el);
  }
  el.textContent = `kh-popup, kh-confirm-dialog, kh-toast {
    --kh-dialog: ${t.surf}; --kh-card: ${t.surf2}; --kh-card-2: ${t.surf2}; --kh-line: ${t.surf2};
    --kh-text: ${t.ink}; --kh-text-2: ${t.muted}; --kh-accent: ${t.blue}; --kh-on-accent: ${dark ? "#0b1a26" : "#ffffff"};
    --kh-alert: ${t.red}; --kh-on-alert: #ffffff; --kh-radius: 16px; --kh-radius-icon: 12px;
    --kh-font: "Instrument Sans", system-ui, sans-serif; color-scheme: ${dark ? "dark" : "light"};
  }`;
}

/** Fonts served next to the bundle (no third-party request). */
export function loadFonts(): void {
  if (document.getElementById("kh3-fonts")) return;
  const base = (window as { __khAssets?: string }).__khAssets ?? "/local/kaoru-home/";
  const style = document.createElement("style");
  style.id = "kh3-fonts";
  style.textContent = `
    @font-face { font-family: "Instrument Sans"; font-weight: 400 700; font-display: swap; src: url("${base}fonts/instrument-sans.woff2") format("woff2"); }
    @font-face { font-family: "Bricolage Grotesque"; font-weight: 200 800; font-display: swap; src: url("${base}fonts/bricolage-grotesque.woff2") format("woff2"); }
  `;
  document.head.append(style);
}

/**
 * Shared styles of every V3 surface: type, cards, tiles, chips, buttons,
 * horizontal scrollers, focus, and the motion that answers a state.
 */
export const ui = css`
  :host {
    font-family: "Instrument Sans", system-ui, sans-serif;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  * {
    box-sizing: border-box;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    border: 0;
    background: none;
    padding: 0;
    touch-action: manipulation;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button:focus-visible,
  a:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }
  button:disabled {
    cursor: default;
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  svg {
    flex: none;
  }
  .num {
    font-family: "Bricolage Grotesque", system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .h {
    font-family: "Bricolage Grotesque", system-ui, sans-serif;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-size: 16px;
  }
  .page-title {
    font-family: "Bricolage Grotesque", system-ui, sans-serif;
    font-weight: 700;
    font-size: 30px;
    letter-spacing: -0.01em;
  }
  .st {
    font-size: 12px;
    line-height: 1.3;
    color: var(--muted);
  }
  .ell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .card {
    background: var(--surf);
    border-radius: 22px;
    padding: 16px;
    min-width: 0;
    min-height: 0;
  }
  .ico {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    flex: none;
    background: var(--bg);
    color: var(--muted);
    transition: background-color 0.2s, color 0.2s;
  }
  .ico svg {
    width: 20px;
    height: 20px;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 60px;
    padding: 0 12px;
    border-radius: 16px;
    background: var(--surf2);
    text-align: left;
    min-width: 0;
    position: relative;
    overflow: hidden;
    transition: transform 0.12s;
    user-select: none;
  }
  .tile:active {
    transform: scale(0.97);
  }
  .tile .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--amberTint);
    transition: width 0.25s;
  }
  .tile > :not(.fill) {
    position: relative;
  }
  .tile[aria-disabled="true"] {
    opacity: 0.5;
  }
  .nm {
    display: block;
    font-weight: 600;
    font-size: 14px;
    line-height: 1.25;
  }
  .rb {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    background: var(--surf2);
    display: grid;
    place-items: center;
    flex: none;
    transition: transform 0.12s;
  }
  .rb:active {
    transform: scale(0.92);
  }
  .rb svg {
    width: 20px;
    height: 20px;
  }
  .btn {
    height: 40px;
    padding: 0 14px;
    border-radius: 12px;
    background: var(--surf2);
    font-size: 13px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    white-space: nowrap;
  }
  .btn svg {
    width: 16px;
    height: 16px;
  }
  .pill {
    height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--surf2);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    scroll-snap-align: start;
  }
  .pill[aria-pressed="true"],
  .pill[aria-current="page"] {
    background: var(--ink);
    color: var(--bg);
  }
  .seg {
    display: flex;
    padding: 3px;
    border-radius: 12px;
    background: var(--surf2);
  }
  .seg button {
    height: 34px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
  }
  .seg button[aria-pressed="true"] {
    background: var(--surf);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  .hs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
  }
  .hs::-webkit-scrollbar {
    display: none;
  }
  .switch {
    width: 46px;
    height: 28px;
    border-radius: 99px;
    flex: none;
    position: relative;
    background: var(--bg);
    transition: background-color 0.2s;
  }
  .switch::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 99px;
    background: var(--muted);
    transition: transform 0.2s, background-color 0.2s;
  }
  .switch[aria-checked="true"]::after {
    transform: translateX(18px);
    background: #fff;
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
  }

  /* Motion that shows a state; all of it stops when less motion is asked. */
  .kh-spin {
    transform-box: view-box;
    transform-origin: 12px 12px;
    animation: kh-spin 16s linear infinite;
  }
  .kh-spin9 {
    transform-box: view-box;
    transform-origin: 9px 9px;
    animation: kh-spin 16s linear infinite;
  }
  .kh-fast {
    animation-duration: 1.1s;
  }
  @keyframes kh-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .kh-drop {
    animation: kh-drop 1.2s linear infinite;
  }
  .kh-d2 {
    animation-delay: 0.4s;
  }
  .kh-d3 {
    animation-delay: 0.8s;
  }
  @keyframes kh-drop {
    0% {
      transform: translateY(-2px);
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      transform: translateY(3px);
      opacity: 0;
    }
  }
  .kh-drift {
    animation: kh-drift 4s ease-in-out infinite;
  }
  @keyframes kh-drift {
    50% {
      transform: translateX(1.2px);
    }
  }
  .kh-glow {
    animation: kh-glow 3s ease-in-out infinite;
  }
  @keyframes kh-glow {
    50% {
      opacity: 0.6;
    }
  }
  .kh-pulse {
    animation: kh-pulse 1.8s ease-in-out infinite;
  }
  @keyframes kh-pulse {
    50% {
      opacity: 0.6;
      transform: scale(0.93);
    }
  }
  .kh-eq {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 11px;
  }
  .kh-eq i {
    width: 3px;
    border-radius: 1px;
    background: currentColor;
    animation: kh-eq 0.9s ease-in-out infinite;
  }
  .kh-eq i:nth-child(2) {
    animation-delay: 0.3s;
  }
  .kh-eq i:nth-child(3) {
    animation-delay: 0.6s;
  }
  @keyframes kh-eq {
    0%,
    100% {
      height: 3px;
    }
    50% {
      height: 11px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;
