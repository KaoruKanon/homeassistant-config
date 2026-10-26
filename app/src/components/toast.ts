import { LitElement, css, html, nothing } from "lit";
import { store } from "../store.ts";
import { base, tokens } from "../styles.ts";

export interface ToastSpec {
  message: string;
  kind?: "info" | "error" | "success";
  /** A button in the toast (e.g. HA's "Restart"). */
  action?: { text: string; run: () => void };
  /** Milliseconds; 0 keeps it until closed. */
  duration?: number;
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

const ICON = { info: "mdi:information-outline", error: "mdi:alert-circle-outline", success: "mdi:check-circle-outline" };

/** A toast at the top of the screen, in the panel's style; one at a time. */
class KhToast extends LitElement {
  static properties = { spec: { attribute: false }, leaving: { state: true } };
  declare spec: ToastSpec;
  declare leaving: boolean;
  private timer = 0;

  constructor() {
    super();
    this.leaving = false;
  }

  static styles = [
    tokens,
    base,
    css`
      /* A manual popover: in the top layer, above an open popup too. */
      :host {
        position: fixed;
        inset: auto;
        top: max(12px, env(safe-area-inset-top));
        left: 50%;
        transform: translateX(-50%);
        width: min(560px, calc(100vw - 24px));
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 10px 10px 14px;
        border-radius: 18px;
        background: var(--kh-dialog);
        color: var(--kh-text);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
        border: 1px solid var(--kh-line);
        animation: drop 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .leaving .toast {
        animation: lift 220ms ease-in forwards;
      }
      .shape {
        width: 36px;
        height: 36px;
        flex: none;
      }
      .msg {
        flex: 1;
        min-width: 0;
        font-weight: 600;
        font-size: 0.9375rem;
        line-height: 1.35;
      }
      .act {
        flex: none;
        height: 36px;
        padding: 0 14px;
        border-radius: 12px;
        background: rgba(var(--rgb-blue), 0.22);
        color: rgb(var(--rgb-blue));
        font-weight: 800;
      }
      .close {
        flex: none;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: var(--kh-text-2);
      }
      @keyframes drop {
        from {
          transform: translateY(-30px);
          opacity: 0;
        }
      }
      @keyframes lift {
        to {
          transform: translateY(-24px);
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .toast,
        .leaving .toast {
          animation: none;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const d = this.spec.duration ?? (this.spec.action ? 8000 : 4500);
    if (d) this.timer = window.setTimeout(() => this.close(), d);
  }

  close(): void {
    window.clearTimeout(this.timer);
    this.leaving = true;
    window.setTimeout(() => this.remove(), 220);
  }

  render() {
    const s = this.spec;
    const kind = s.kind ?? "info";
    const color = kind === "error" ? "red" : kind === "success" ? "green" : "blue";
    return html`<div class=${this.leaving ? "leaving" : ""}>
      <div class="toast" role=${kind === "error" ? "alert" : "status"}>
        <span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${ICON[kind]}></ha-icon></span>
        <span class="msg">${s.message}</span>
        ${s.action
          ? html`<button class="act" @click=${() => (s.action!.run(), this.close())}>${s.action.text}</button>`
          : nothing}
        <button class="close" aria-label="Fermer" @click=${() => this.close()}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
    </div>`;
  }
}
customElements.define("kh-toast", KhToast);

let current: KhToast | undefined;

export function showToast(spec: ToastSpec): void {
  current?.close();
  const el = document.createElement("kh-toast") as KhToast;
  el.spec = spec;
  if (store.hass?.themes.darkMode) el.setAttribute("dark", "");
  el.setAttribute("popover", "manual");
  (document.querySelector("home-assistant")?.shadowRoot ?? document.body).append(el);
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
const onHassNotification = (e: Event) => {
  const d = (e as CustomEvent).detail as { message?: string; action?: { text: string; action: () => void }; duration?: number } | undefined;
  if (!d?.message) return;
  e.stopPropagation();
  showToast({
    message: inFrench(String(d.message)),
    kind: /fail|error|invalid|unable|échou/i.test(String(d.message)) ? "error" : "info",
    action: d.action ? { text: d.action.text === "Restart" ? "Redémarrer" : d.action.text, run: d.action.action } : undefined,
    duration: d.duration === -1 ? 0 : d.duration,
  });
};

export function takeOverHassToasts(on: boolean): void {
  panels += on ? 1 : -1;
  if (on && panels === 1) window.addEventListener("hass-notification", onHassNotification, true);
  if (!on && panels === 0) window.removeEventListener("hass-notification", onHassNotification, true);
}
