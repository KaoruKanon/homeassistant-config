import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, setBrightness, toggle } from "../actions.ts";
import { brightnessPercent, isActive, isDimmable, isUnavailable } from "../format.ts";
import { EntitiesController, store } from "../store.ts";
import { base } from "../styles.ts";

const SLOP_PX = 8;

/**
 * V2 light control: the whole pill is the dimmer. Tap toggles, a sideways
 * drag sets the brightness (released = sent), a long press opens the light
 * popup; vertical moves scroll the page as usual.
 */
export class KhLightPill extends LitElement {
  static properties = { entityId: { attribute: "entity-id" }, name: {}, icon: {}, tinted: { type: Boolean }, preview: { state: true } };
  declare entityId: string;
  declare name: string;
  declare icon?: string;
  /** Filled with the lamp's own colour (when it has one) instead of amber. */
  declare tinted: boolean;
  /** Brightness shown while dragging. */
  declare preview?: number;
  private start?: { x: number; y: number; t: number };
  private mode: "none" | "drag" | "scroll" = "none";
  private hold = 0;

  constructor() {
    super();
    new EntitiesController(this, () => [this.entityId]);
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .pill {
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 64px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 14px;
        box-sizing: border-box;
        border-radius: var(--pill-radius, 20px);
        background: var(--pill-bg, var(--kh-card));
        text-align: left;
        touch-action: pan-y;
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: linear-gradient(90deg, rgba(var(--lamp, var(--rgb-amber)), 0.55), rgba(var(--lamp, var(--rgb-orange)), 0.32));
        transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1);
        pointer-events: none;
      }
      .dragging .fill {
        transition: none;
      }
      .shape,
      .txt,
      .pct {
        position: relative;
      }
      .txt {
        flex: 1;
        min-width: 0;
      }
      .pct {
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .on .shape {
        background: rgb(var(--lamp, var(--rgb-amber)));
        color: #2b2003;
      }
      .unavailable {
        opacity: 0.45;
      }
    `,
  ];

  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.start = { x: e.clientX, y: e.clientY, t: Date.now() };
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
      // Mostly vertical: the user scrolls; mostly sideways: dimming.
      this.mode = Math.abs(dx) > Math.abs(dy) && isDimmable(store.get(this.entityId)) ? "drag" : "scroll";
      if (this.mode === "drag") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (this.mode === "drag") {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this.preview = Math.round(Math.min(100, Math.max(1, ((e.clientX - r.left) / r.width) * 100)));
    }
  };

  private up = async () => {
    window.clearTimeout(this.hold);
    const mode = this.mode;
    const had = !!this.start;
    this.start = undefined;
    this.mode = "none";
    if (!had) return;
    if (mode === "drag" && this.preview !== undefined) {
      const pct = this.preview;
      try {
        await setBrightness(this.entityId, pct);
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

  render() {
    const s = store.get(this.entityId);
    if (!store.hass || !s) return nothing;
    const on = isActive(s);
    const pct = this.preview ?? (on ? (brightnessPercent(s) ?? 100) : 0);
    const rgb = this.tinted ? (s.attributes.rgb_color as number[] | undefined) : undefined;
    return html`<div
      style=${rgb ? `--lamp: ${rgb.join(", ")}` : ""}
      class="pill ${on || this.preview ? "on" : ""} ${this.preview !== undefined ? "dragging" : ""} ${isUnavailable(s) ? "unavailable" : ""}"
      role="slider"
      tabindex="0"
      aria-label=${this.name}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${pct}
      aria-valuetext=${on ? `${pct} %` : "éteinte"}
      @pointerdown=${this.down}
      @pointermove=${this.move}
      @pointerup=${this.up}
      @pointercancel=${this.cancel}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") (e.preventDefault(), toggle(this.entityId, this.name));
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") setBrightness(this.entityId, pct + (e.key === "ArrowRight" ? 10 : -10));
      }}
    >
      <span class="fill" style="width:${pct}%"></span>
      <span class="shape ${on ? "" : "off"}"><ha-icon icon=${this.icon ?? "mdi:lightbulb"}></ha-icon></span>
      <span class="txt"><span class="primary ellipsis" style="display:block">${this.name}</span>
        <span class="secondary pct">${isUnavailable(s) ? "Indisponible" : on || this.preview !== undefined ? `${pct} %` : "Éteinte"}</span></span>
    </div>`;
  }
}
customElements.define("kh-light-pill", KhLightPill);
