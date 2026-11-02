import { LitElement, css, html, nothing, svg, type SVGTemplateResult, type TemplateResult } from "lit";
import { store } from "../store.ts";
import { tokens } from "../styles.ts";
import { icon } from "../v3/icons.ts";
import { ui } from "../v3/theme.ts";

// ---- Shared by the overlays (popup, confirmation, toast) ----

/**
 * V3 token names on the overlays' host. They live on document.body, outside
 * the panel: while V3 is shown its shell sets the real values on the host
 * (themeShared, a document rule that beats :host); in V1/V2 these fall back
 * to the old --kh-* / --rgb-* look.
 */
export const overlayTokens = css`
  :host {
    --bg: var(--kh-card-2);
    --surf: var(--kh-dialog);
    --surf2: var(--kh-card-2);
    --ink: var(--kh-text);
    --muted: var(--kh-text-2);
    --blue: rgb(var(--rgb-blue));
    --blueTint: rgba(var(--rgb-blue), 0.18);
    --amber: rgb(var(--rgb-amber));
    --amberTint: rgba(var(--rgb-amber), 0.2);
    --amberInk: #8a4b00;
    --yellow: rgb(var(--rgb-yellow));
    --yellowTint: rgba(var(--rgb-yellow), 0.2);
    --yellowInk: #6e5600;
    --violet: rgb(var(--rgb-purple));
    --violetTint: rgba(var(--rgb-purple), 0.18);
    --teal: rgb(var(--rgb-teal));
    --tealTint: rgba(var(--rgb-teal), 0.18);
    --red: rgb(var(--rgb-red));
    --redTint: rgba(var(--rgb-red), 0.16);
    --warm: rgba(var(--rgb-amber), 0.12);
    --shadow: 0 8px 30px rgb(0 0 0 / 0.25);
  }
  :host([dark]) {
    --amberInk: #ffcb85;
    --yellowInk: #ffe48a;
  }
`;

export type Tone = "blue" | "amber" | "yellow" | "violet" | "teal" | "red" | "grey";

/** Mushroom colour name (config, format.ts) to a V3 tone. */
export function toneOf(color?: string): Tone {
  switch (color) {
    case "blue":
    case "light-blue":
      return "blue";
    case "amber":
    case "orange":
      return "amber";
    case "yellow":
      return "yellow";
    case "purple":
    case "indigo":
    case "jellyfin":
      return "violet";
    case "green":
    case "teal":
    case "spotify":
      return "teal";
    case "red":
      return "red";
    default:
      return "grey";
  }
}

/** Tone classes: --c (solid), --ct (tint), --ci (ink on the tint). Inherited by .ico. */
export const toneCss = css`
  .t-blue {
    --c: var(--blue);
    --ct: var(--blueTint);
    --ci: var(--blue);
  }
  .t-amber {
    --c: var(--amber);
    --ct: var(--amberTint);
    --ci: var(--amberInk);
  }
  .t-yellow {
    --c: var(--yellow);
    --ct: var(--yellowTint);
    --ci: var(--yellowInk);
  }
  .t-violet {
    --c: var(--violet);
    --ct: var(--violetTint);
    --ci: var(--violet);
  }
  .t-teal {
    --c: var(--teal);
    --ct: var(--tealTint);
    --ci: var(--teal);
  }
  .t-red {
    --c: var(--red);
    --ct: var(--redTint);
    --ci: var(--red);
  }
  .t-grey {
    --c: var(--muted);
    --ct: var(--bg);
    --ci: var(--muted);
  }
  .ico {
    background: var(--ct, var(--bg));
    color: var(--ci, var(--muted));
  }
`;

/** Icons the overlays need that icons.ts does not draw. */
const LOCAL: Record<string, SVGTemplateResult> = {
  lock: svg`<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>`,
  unlock: svg`<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 7.6-1.8"></path>`,
  user: svg`<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>`,
  gps: svg`<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2.5"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>`,
  directions: svg`<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"></path><path d="M9 14.5V11h5.5M12.5 8.5L15 11l-2.5 2.5"></path>`,
  alert: svg`<path d="M10.3 4.2a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-2.8z"></path><path d="M12 10v4.5M12 17.5h.01"></path>`,
  info: svg`<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5h.01"></path>`,
  qr: svg`<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 14h3v3M21 14v.01M14 21h.01M17.5 17.5V21H21v-3"></path>`,
  tablet: svg`<rect x="4" y="2" width="16" height="20" rx="2.5"></rect><path d="M11 18h2"></path>`,
  backspace: svg`<path d="M8 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7z"></path><path d="M11 9.5l5 5M16 9.5l-5 5"></path>`,
  sparkle: svg`<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"></path>`,
  film: svg`<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"></path>`,
  shieldOff: svg`<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"></path><path d="M4 4l16 16"></path>`,
  shieldCheck: svg`<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"></path><path d="M9 12l2 2 4-4"></path>`,
  question: svg`<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01"></path>`,
};

/** MDI icons met in the config and entities, to a V3 / local icon. */
const MDI: [RegExp, string][] = [
  [/^close$/, "close"],
  [/^shield-off/, "shieldOff"],
  [/^shield|^security/, "shield"],
  [/bell/, "bell"],
  [/lock-open/, "unlock"],
  [/lock/, "lock"],
  [/desktop|monitor|laptop/, "monitor"],
  [/tablet/, "tablet"],
  [/television|^tv/, "tv"],
  [/speaker/, "speaker"],
  [/sleep|moon|night/, "moon"],
  [/plug|socket/, "plug"],
  [/^power/, "power"],
  [/timer|clock/, "timer"],
  [/restart|refresh|reload|sync/, "refresh"],
  [/directions/, "directions"],
  [/crosshairs|gps/, "gps"],
  [/map-marker|pin/, "pin"],
  [/home/, "home"],
  [/account|person|face/, "user"],
  [/wifi/, "wifi"],
  [/key/, "key"],
  [/wallet/, "wallet"],
  [/camera/, "camera"],
  [/bike|bicycle/, "bike"],
  [/scooter/, "scooter"],
  [/cellphone|phone/, "phone"],
  [/flash|lightning|bolt/, "bolt"],
  [/checkbox|motion|run|walk/, "motion"],
  [/lightbulb|lamp|ceiling|light/, "bulb"],
  [/led-strip/, "led"],
  [/thermometer|thermostat/, "thermo"],
  [/water|humidity/, "drop"],
  [/battery/, "battery"],
  [/window|blinds/, "window"],
  [/door/, "door"],
  [/qrcode/, "qr"],
  [/film|movie|filmstrip/, "film"],
  [/fan/, "fan"],
  [/play|music/, "playCircle"],
  [/chart|trend|gauge/, "trend"],
  [/calendar/, "calendar"],
  [/weather/, "cloud"],
  [/information/, "info"],
  [/alert/, "alert"],
  [/check/, "check"],
  [/creation|robot|auto/, "sparkle"],
  [/radar/, "radar"],
];

/** V3 name of an "mdi:…" icon, if one fits. */
export function v3IconName(mdi: string): string | undefined {
  const n = mdi.replace(/^mdi:/, "");
  return MDI.find(([re]) => re.test(n))?.[1];
}

/**
 * An icon for the overlays: a V3 / local name, or an "mdi:…" name mapped to
 * one; MDI icons without an equivalent stay Home Assistant's ha-icon.
 */
export function glyph(name: string, size = 20, label?: string): TemplateResult {
  const v3 = name.startsWith("mdi:") ? v3IconName(name) : name;
  if (!v3) return html`<ha-icon icon=${name} style="--mdc-icon-size:${size}px" aria-label=${label ?? nothing}></ha-icon>`;
  if (!(v3 in LOCAL)) return icon(v3, size, label);
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" role=${label ? "img" : "presentation"} aria-hidden=${label ? nothing : "true"}
    aria-label=${label ?? nothing}>${LOCAL[v3]}</svg>`;
}

// ---- Toast ----

export interface ToastSpec {
  message: string;
  kind?: "info" | "error" | "success";
  /** A button in the toast (e.g. HA's "Restart"). */
  action?: { text: string; run: () => void };
  /** Milliseconds; 0 keeps it until closed. */
  duration?: number;
  /** Home Assistant's toast id: the same id updates the toast in place. */
  id?: string;
}

// Home Assistant's own messages are in English: the ones met in this house, in French.
const FRENCH: [RegExp, string][] = [
  [/^.*invalid alarm code.*$/i, "Code de l'alarme incorrect"],
  [/^restart of home assistant is required to finish downloading or updating (.+?)\.?$/i, "Redémarrage de Home Assistant nécessaire pour finir la mise à jour de $1"],
  [/^failed to (?:call service|perform the action) ([\w.]+)\.? ?(.*)$/i, "L'action $1 a échoué. $2"],
  [/^.*(unable to connect|connection lost).*$/i, "Connexion à Home Assistant perdue"],
  [/^.*entity ([\w.]+) not found.*$/i, "Appareil introuvable ($1)"],
  [/^.*is unavailable.*$/i, "L'appareil ne répond pas"],
];

export function inFrench(message: string): string {
  for (const [re, fr] of FRENCH) if (re.test(message)) return message.replace(re, fr).trim();
  return message;
}

const LOOK = {
  info: { icon: "info", tone: "t-blue" },
  error: { icon: "alert", tone: "t-red" },
  success: { icon: "check", tone: "t-teal" },
};

/** A toast at the top of the screen, in the V3 style; one at a time. */
class KhToast extends LitElement {
  static properties = { spec: { attribute: false }, leaving: { state: true }, live: { state: true } };
  declare spec: ToastSpec;
  declare leaving: boolean;
  /** The message enters the live region after the first frame, so it is announced. */
  declare live: boolean;
  private timer = 0;

  constructor() {
    super();
    this.leaving = false;
    this.live = false;
  }

  static styles = [
    tokens,
    overlayTokens,
    ui,
    toneCss,
    css`
      /* A manual popover: in the top layer, above an open popup too. */
      :host {
        position: fixed;
        inset: auto;
        top: max(12px, env(safe-area-inset-top));
        left: 50%;
        transform: translateX(-50%);
        width: min(520px, calc(100vw - 24px));
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
        font-family: var(--kh-font);
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 20px;
        background: var(--surf);
        color: var(--ink);
        box-shadow: var(--shadow), 0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent);
        animation: drop 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .leaving .toast {
        animation: lift 200ms ease-in forwards;
      }
      .msg {
        flex: 1;
        min-width: 0;
        font-weight: 600;
        font-size: 14px;
        line-height: 1.35;
      }
      .act {
        flex: none;
        height: 40px;
        padding: 0 14px;
        border-radius: 12px;
        background: var(--blueTint);
        color: var(--blue);
        font-weight: 700;
        font-size: 13px;
      }
      .x {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: var(--muted);
      }
      .x svg {
        width: 18px;
        height: 18px;
      }
      @media (max-width: 699px) {
        .act,
        .x {
          height: 44px;
          min-width: 44px;
        }
      }
      @keyframes drop {
        from {
          transform: translateY(-16px);
          opacity: 0;
        }
      }
      @keyframes lift {
        to {
          transform: translateY(-12px);
          opacity: 0;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.arm();
    requestAnimationFrame(() => (this.live = true));
  }

  /** New text for the same toast (a countdown...): no new entrance, the timer restarts. */
  refresh(spec: ToastSpec): void {
    this.spec = spec;
    this.arm();
  }

  private arm(): void {
    window.clearTimeout(this.timer);
    const d = this.spec.duration ?? (this.spec.action ? 8000 : 4500);
    if (d) this.timer = window.setTimeout(() => this.close(), d);
  }

  close(): void {
    window.clearTimeout(this.timer);
    this.leaving = true;
    window.setTimeout(() => this.remove(), 200);
  }

  render() {
    const s = this.spec;
    const kind = s.kind ?? "info";
    const look = LOOK[kind];
    return html`<div class=${this.leaving ? "leaving" : ""}>
      <div class="toast">
        <span class="ico ${look.tone}">${glyph(look.icon)}</span>
        <span class="msg" role=${kind === "error" ? "alert" : "status"} aria-live=${kind === "error" ? "assertive" : "polite"} aria-atomic="true"
          >${this.live ? s.message : ""}</span
        >
        ${s.action
          ? html`<button class="act" @click=${() => (s.action!.run(), this.close())}>${s.action.text}</button>`
          : nothing}
        <button class="x" aria-label="Fermer" @click=${() => this.close()}>${icon("close")}</button>
      </div>
    </div>`;
  }
}
customElements.define("kh-toast", KhToast);

let current: KhToast | undefined;

export function showToast(spec: ToastSpec): void {
  if (current?.isConnected && !current.leaving && spec.id && current.spec.id === spec.id) return current.refresh(spec);
  current?.close();
  const el = document.createElement("kh-toast") as KhToast;
  el.spec = spec;
  if (store.hass?.themes.darkMode) el.setAttribute("dark", "");
  el.setAttribute("popover", "manual");
  // On the document (not in HA's shadow root): the V3 theme rule reaches it there.
  document.body.append(el);
  try {
    el.showPopover();
  } catch {
    /* no popover support: stays a fixed element */
  }
  current = el;
}

/**
 * While a Kaoru Home panel is open, Home Assistant's own notifications
 * (bottom, English) show as our toast instead (top, French).
 */
let panels = 0;
const PERSISTENT_MAX = 120_000;
const onHassNotification = (e: Event) => {
  const d = (e as CustomEvent).detail as
    | { id?: string; message?: string; action?: { text: string; action: () => void }; duration?: number }
    | undefined;
  if (!d) return;
  e.stopPropagation();
  // An empty message is how Home Assistant takes its toast back (e.g. reconnected).
  if (!d.message) {
    if (current && !current.leaving && (!d.id || current.spec.id === d.id)) current.close();
    return;
  }
  showToast({
    id: d.id,
    message: inFrench(String(d.message)),
    kind: /fail|error|invalid|unable|échou/i.test(String(d.message)) ? "error" : "info",
    action: d.action ? { text: d.action.text === "Restart" ? "Redémarrer" : d.action.text, run: d.action.action } : undefined,
    // Kept until Home Assistant takes it back, but never more than 2 minutes.
    duration: d.duration === -1 || d.duration === 0 ? PERSISTENT_MAX : d.duration,
  });
};

export function takeOverHassToasts(on: boolean): void {
  panels += on ? 1 : -1;
  if (on && panels === 1) window.addEventListener("hass-notification", onHassNotification, true);
  if (!on && panels === 0) window.removeEventListener("hass-notification", onHassNotification, true);
}
