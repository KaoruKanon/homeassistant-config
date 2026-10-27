import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, setBrightness, toggle } from "../actions.ts";
import { brightnessPercent, isActive, isDimmable, isUnavailable } from "../format.ts";
import { EntitiesController, store } from "../store.ts";
import { ui } from "./theme.ts";

const SLOP_PX = 8;

/**
 * A light, V3: the icon lights up, the brightness runs as a thin bar along
 * the bottom. Same gestures as V2: tap toggles, a sideways drag dims
 * (released = sent), a long press opens the light's popup, vertical moves
 * scroll the page.
 */
export class Kh3Light extends LitElement {
  static properties = { entityId: { attribute: "entity-id" }, name: {}, icon: {}, compact: { type: Boolean, reflect: true }, bulb: { type: Boolean, reflect: true }, preview: { state: true } };
  declare entityId: string;
  declare name: string;
  declare icon?: string;
  /** Inside a room tile: one line, icon and name, the brightness bar under them. */
  declare compact: boolean;
  /** In the home's house: a round bulb in its room, the brightness as a ring; a sideways drag dims from where it is. */
  declare bulb: boolean;
  /** Brightness shown while dragging. */
  declare preview?: number;
  private start?: { x: number; y: number; pct: number };
  private mode: "none" | "drag" | "scroll" = "none";
  private hold = 0;

  constructor() {
    super();
    this.compact = false;
    this.bulb = false;
    new EntitiesController(this, () => [this.entityId]);
  }

  static styles = [
    ui,
    css`
      :host {
        display: block;
      }
      .light {
        position: relative;
        overflow: hidden;
        height: 60px;
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        border-radius: var(--v3-r-item);
        background: var(--v3-well);
        touch-action: pan-y;
        cursor: pointer;
      }
      .bulb {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--v3-well-hi);
        color: var(--v3-muted);
        transition: background-color 220ms ease, color 220ms ease, box-shadow 220ms ease;
      }
      .on .bulb {
        background: rgb(var(--rgb-amber));
        color: #3a2600;
        box-shadow: 0 0 0 4px rgba(var(--rgb-amber), 0.18), 0 0 18px rgba(var(--rgb-amber), 0.45);
      }
      .on {
        background: linear-gradient(90deg, rgba(var(--rgb-amber), 0.14), rgba(var(--rgb-amber), 0.04)), var(--v3-well);
      }
      .name {
        font-weight: 600;
        font-size: 0.9375rem;
        line-height: 1.2;
      }
      .state {
        font-size: 0.8125rem;
        color: var(--v3-muted);
        font-variant-numeric: tabular-nums;
      }
      .bar {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: rgba(var(--rgb-amber), 0.16);
        opacity: 0;
        transition: opacity 200ms ease;
      }
      .bar i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: rgb(var(--rgb-amber));
        transform-origin: left;
        transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .on .bar,
      .dragging .bar {
        opacity: 1;
      }
      .dragging .bar i {
        transition: none;
      }
      .dragging .bar {
        height: 6px;
      }
      :host([compact]) .light {
        height: 40px;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 6px;
        padding: 0 10px 0 8px;
        border-radius: 12px;
        background: var(--v3-well-hi);
      }
      :host([compact]) .bulb {
        width: 24px;
        height: 24px;
        --mdc-icon-size: 15px;
      }
      :host([compact]) .on .bulb {
        box-shadow: 0 0 10px rgba(var(--rgb-amber), 0.55);
      }
      :host([compact]) .name {
        font-size: 0.8125rem;
      }
      :host([compact]) .state {
        display: none;
      }
      :host([compact]) .bar {
        left: 8px;
        right: 8px;
      }
      :host([bulb]) .light {
        width: var(--bulb, 48px);
        height: var(--bulb, 48px);
        padding: 0;
        display: grid;
        grid-template-columns: 1fr;
        place-items: center;
        border-radius: 50%;
        background: var(--bulb-off, rgb(255 255 255 / 0.12));
        overflow: visible;
      }
      :host([bulb]) .on.light {
        background: rgb(255 224 150 / 0.35);
      }
      :host([bulb]) .bulb {
        width: calc(var(--bulb, 48px) - 12px);
        height: calc(var(--bulb, 48px) - 12px);
        --mdc-icon-size: calc(var(--bulb, 48px) * 0.42);
        background: transparent;
        color: var(--bulb-ink, rgb(255 255 255 / 0.85));
      }
      :host([bulb]) .on .bulb {
        background: rgb(var(--rgb-amber));
        color: #3a2600;
        box-shadow: 0 0 22px 6px rgba(var(--rgb-amber), 0.7);
      }
      :host([bulb]) .light > span:nth-child(2),
      :host([bulb]) .bar {
        display: none;
      }
      .dial {
        position: absolute;
        inset: 0;
        pointer-events: none;
        transform: rotate(-90deg);
      }
      .dial circle {
        transition: stroke-dashoffset 260ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .dragging .dial circle {
        transition: none;
      }
      .tip {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        padding: 2px 8px;
        border-radius: 8px;
        background: rgb(20 24 40 / 0.85);
        color: #fff;
        font-size: 0.75rem;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
      }
      .unavailable {
        cursor: default;
      }
      .unavailable .bulb,
      .unavailable .name {
        opacity: 0.5;
      }
    `,
  ];

  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const s = store.get(this.entityId);
    this.start = { x: e.clientX, y: e.clientY, pct: isActive(s) ? (brightnessPercent(s) ?? 100) : 0 };
    this.mode = "none";
    window.clearTimeout(this.hold);
    this.hold = window.setTimeout(() => {
      if (this.mode === "none") {
        this.start = undefined;
        navigator.vibrate?.(15);
        openMoreInfo(this, this.entityId);
      }
    }, 500);
  };

  private move = (e: PointerEvent) => {
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (this.mode === "none" && Math.hypot(dx, dy) > SLOP_PX) {
      window.clearTimeout(this.hold);
      this.mode = Math.abs(dx) > Math.abs(dy) && isDimmable(store.get(this.entityId)) ? "drag" : "scroll";
      if (this.mode === "drag") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (this.mode === "drag") {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // A bulb is too small to point at a level: 150 px of drag go from off to full.
      const pct = this.bulb ? this.start.pct + (dx / 150) * 100 : ((e.clientX - r.left) / r.width) * 100;
      this.preview = Math.round(Math.min(100, Math.max(1, pct)));
    }
  };

  private up = async () => {
    window.clearTimeout(this.hold);
    const mode = this.mode, had = !!this.start;
    this.start = undefined;
    this.mode = "none";
    if (!had) return;
    if (mode === "drag" && this.preview !== undefined) {
      try {
        await setBrightness(this.entityId, this.preview);
      } finally {
        window.setTimeout(() => (this.preview = undefined), 800);
      }
    } else if (mode === "none") {
      navigator.vibrate?.(8);
      await toggle(this.entityId, this.name);
    }
  };

  private cancel = () => {
    window.clearTimeout(this.hold);
    this.start = undefined;
    this.mode = "none";
  };

  private key = (e: KeyboardEvent) => {
    const s = store.get(this.entityId);
    const pct = isActive(s) ? (brightnessPercent(s) ?? 100) : 0;
    if (e.key === "Enter" || e.key === " ") (e.preventDefault(), toggle(this.entityId, this.name));
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && isDimmable(s)) {
      e.preventDefault();
      setBrightness(this.entityId, Math.min(100, Math.max(1, pct + (e.key === "ArrowRight" ? 10 : -10))));
    }
  };

  render() {
    const s = store.get(this.entityId);
    if (!store.hass || !s) return nothing;
    const off = isUnavailable(s);
    const on = isActive(s);
    const pct = this.preview ?? (on ? (brightnessPercent(s) ?? 100) : 0);
    const label = off ? "Indisponible" : this.preview !== undefined || (on && isDimmable(s)) ? `${pct} %` : on ? "Allumée" : "Éteinte";
    return html`<div
      class="light ${on || this.preview !== undefined ? "on" : ""} ${this.preview !== undefined ? "dragging" : ""} ${off ? "unavailable" : ""}"
      role=${isDimmable(s) ? "slider" : "switch"}
      tabindex=${off ? "-1" : "0"}
      aria-label=${this.name}
      aria-checked=${isDimmable(s) ? nothing : String(on)}
      aria-valuemin=${isDimmable(s) ? "0" : nothing}
      aria-valuemax=${isDimmable(s) ? "100" : nothing}
      aria-valuenow=${isDimmable(s) ? pct : nothing}
      aria-valuetext=${label}
      aria-disabled=${off ? "true" : nothing}
      @pointerdown=${off ? nothing : this.down}
      @pointermove=${this.move}
      @pointerup=${this.up}
      @pointercancel=${this.cancel}
      @keydown=${off ? nothing : this.key}
    >
      <span class="bulb"><ha-icon icon=${this.icon ?? "mdi:lightbulb"}></ha-icon></span>
      <span style="min-width:0">
        <span class="name ellipsis" style="display:block">${this.name}</span>
        <span class="state">${label}</span>
      </span>
      <span class="bar" aria-hidden="true"><i style="transform: scaleX(${pct / 100})"></i></span>
      ${this.bulb && (on || this.preview !== undefined)
        ? html`<svg class="dial" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="rgb(var(--rgb-amber))" stroke-width="3"
            stroke-linecap="round" stroke-dasharray="138.2" stroke-dashoffset=${138.2 * (1 - pct / 100)} /></svg>`
        : nothing}
      ${this.bulb && this.preview !== undefined ? html`<span class="tip">${pct} %</span>` : nothing}
    </div>`;
  }
}
customElements.define("kh3-light", Kh3Light);
