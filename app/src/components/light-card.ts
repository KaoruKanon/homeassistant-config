import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, setBrightness, toggle } from "../actions.ts";
import { brightnessPercent, isActive, isDimmable, isUnavailable } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { Press } from "./gestures.ts";

/**
 * Light card of the old dashboard: the whole card warms up when the light is
 * on; a wide bar sets the brightness, the small button opens colour settings.
 */
export class KhLightCard extends LitElement {
  static properties = {
    entityId: { attribute: "entity-id" },
    name: {},
    icon: {},
    dragging: { state: true },
  };
  declare entityId: string;
  declare name: string;
  declare icon?: string;
  declare dragging?: number;
  private press = new Press(
    () => toggle(this.entityId, this.name),
    () => openMoreInfo(this, this.entityId),
  );

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [this.entityId]);
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
        --rgb: var(--rgb-orange);
      }
      .card {
        padding: 12px;
        display: grid;
        gap: 12px;
        transition: background-color 200ms ease;
      }
      .card.on {
        background: rgba(var(--rgb), 0.22);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        text-align: left;
      }
      .head > div {
        min-width: 0;
      }
      .card.on .shape {
        background: rgba(var(--rgb), 0.35);
      }
      .controls {
        display: flex;
        gap: 10px;
      }
      input[type="range"] {
        flex: 1;
        min-width: 0;
        margin: 0;
        height: 44px;
        border-radius: var(--kh-radius-icon);
        appearance: none;
        -webkit-appearance: none;
        background: linear-gradient(
          to right,
          rgb(var(--rgb)) 0 var(--pct),
          rgba(var(--rgb), 0.2) var(--pct) 100%
        );
        cursor: pointer;
      }
      .card:not(.on) input[type="range"] {
        background: var(--kh-card-2);
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 6px;
        height: 24px;
        border-radius: 3px;
        background: rgb(255 255 255 / 0.85);
      }
      input[type="range"]::-moz-range-thumb {
        width: 6px;
        height: 24px;
        border: 0;
        border-radius: 3px;
        background: rgb(255 255 255 / 0.85);
      }
      .card:not(.on) input[type="range"]::-webkit-slider-thumb {
        background: transparent;
      }
      .square {
        width: 44px;
        height: 44px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--kh-radius-icon);
        background: rgba(var(--rgb), 0.2);
        color: var(--kh-text);
      }
      .card:not(.on) .square {
        background: var(--kh-card-2);
      }
      .card.unavailable {
        opacity: 0.5;
      }
    `,
  ];

  private lastState?: string;

  protected updated(): void {
    // A light switched off elsewhere mid-drag: drop the stale value.
    const state = store.get(this.entityId)?.state;
    if (this.lastState === "on" && state !== "on") this.dragging = undefined;
    this.lastState = state;
  }

  render() {
    const s = store.get(this.entityId);
    if (!store.hass) return nothing;
    const on = isActive(s);
    const pct = this.dragging ?? (on ? (brightnessPercent(s) ?? 100) : 0);
    const state = isUnavailable(s) ? "Indisponible" : on ? (isDimmable(s) ? `${pct} %` : "Allumé") : "Éteint";
    return html`
      <div class="card ${on ? "on" : ""} ${isUnavailable(s) ? "unavailable" : ""}">
        <button
          class="head"
          aria-pressed=${String(on)}
          aria-description="Appui long : couleur et réglages"
          @pointerdown=${this.press.down}
          @pointerup=${this.press.cancel}
          @pointerleave=${this.press.cancel}
          @contextmenu=${this.press.contextmenu}
          @click=${this.press.click}
        >
          <span class="shape ${on ? "" : "off"}">
            <ha-icon icon=${this.icon ?? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline")}></ha-icon>
          </span>
          <div>
            <div class="primary ellipsis">${this.name}</div>
            <div class="secondary">${state}</div>
          </div>
        </button>
        ${isDimmable(s) ? html`<div class="controls">
          <input
            type="range"
            min="1"
            max="100"
            style="--pct:${pct}%"
            .value=${String(Math.max(1, pct))}
            ?disabled=${isUnavailable(s)}
            aria-label="Luminosité de ${this.name}"
            @input=${(e: Event) => (this.dragging = Number((e.target as HTMLInputElement).value))}
            @change=${async (e: Event) => {
              try {
                await setBrightness(this.entityId, Number((e.target as HTMLInputElement).value));
              } finally {
                this.dragging = undefined;
              }
            }}
          />
          <button class="square" aria-label="Couleur et température de ${this.name}" @click=${() => openMoreInfo(this, this.entityId)}>
            <ha-icon icon="mdi:thermometer"></ha-icon>
          </button>
        </div>` : nothing}
      </div>
    `;
  }
}
customElements.define("kh-light-card", KhLightCard);
