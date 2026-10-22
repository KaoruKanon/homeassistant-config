import { LitElement, css, html, nothing } from "lit";
import { canToggle, needsConfirmation, openMoreInfo, setBrightness, toggle } from "../actions.ts";
import {
  brightnessPercent,
  isActive,
  isDimmable,
  isUnavailable,
  sensorValue,
  stateIcon,
  stateLabel,
} from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const PENDING_TIMEOUT_MS = 6000;

/**
 * One device. A tap toggles it when it can be toggled, otherwise opens the
 * Home Assistant detail dialog; the corner button always opens the dialog.
 */
export class KhTile extends LitElement {
  static properties = {
    entityId: { attribute: "entity-id" },
    name: {},
    powerId: { attribute: "power-id" },
    pending: { state: true },
    dragging: { state: true },
  };
  declare entityId: string;
  declare name: string;
  declare powerId?: string;
  declare pending: boolean;
  /** Brightness shown while the slider is being moved. */
  declare dragging?: number;

  private lastState?: string;
  private pendingTimer?: number;

  constructor() {
    super();
    new RegistryController(this);
    this.pending = false;
    new EntitiesController(this, () => (this.powerId ? [this.entityId, this.powerId] : [this.entityId]));
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
        position: relative;
      }
      .tile {
        width: 100%;
        min-height: 96px;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 6px;
        text-align: left;
        padding: 14px 14px 12px;
        box-sizing: border-box;
        border-radius: var(--kh-radius);
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
        transition: background-color 160ms ease, border-color 160ms ease;
      }
      .icon {
        color: var(--kh-text-2);
        height: 24px;
      }
      .name {
        font-weight: 700;
        line-height: 1.2;
        align-self: end;
        padding-right: 28px;
        overflow-wrap: anywhere;
      }
      .state {
        color: var(--kh-text-2);
        font-size: 0.875rem;
      }
      .tile.on.light {
        background: var(--kh-warm-soft);
        border-color: transparent;
      }
      .tile.on.light .icon {
        color: var(--kh-warm);
      }
      .tile.on:not(.light) {
        background: var(--kh-accent-soft);
        border-color: transparent;
      }
      .tile.on:not(.light) .icon {
        color: var(--kh-accent);
      }
      .tile.unavailable {
        opacity: 0.55;
        border-style: dashed;
        cursor: default;
      }
      .tile.pending {
        cursor: progress;
      }
      .tile.pending .state::after {
        content: " · envoi…";
      }
      .guard {
        color: var(--kh-alert);
        font-size: 0.75rem;
        font-weight: 700;
      }
      .tile.dimmable {
        padding-bottom: 44px;
      }
      .dim {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 10px;
        margin: 0;
        height: 28px;
        accent-color: var(--kh-warm);
        cursor: pointer;
      }
      .more {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: var(--kh-text-2);
      }
      .more ha-icon {
        --mdc-icon-size: 20px;
      }
    `,
  ];

  protected updated(): void {
    const state = store.get(this.entityId)?.state;
    if (this.pending && state !== this.lastState) this.clearPending();
    this.lastState = state;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.pendingTimer);
  }

  private clearPending(): void {
    this.pending = false;
    window.clearTimeout(this.pendingTimer);
  }

  private async onTap(): Promise<void> {
    const s = store.get(this.entityId);
    if (isUnavailable(s) || this.pending) return;
    if (!canToggle(this.entityId)) {
      openMoreInfo(this, this.entityId);
      return;
    }
    this.pending = true;
    this.pendingTimer = window.setTimeout(() => this.clearPending(), PENDING_TIMEOUT_MS);
    try {
      if (!(await toggle(this.entityId, this.name))) this.clearPending();
    } catch {
      this.clearPending();
    }
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const s = store.get(this.entityId);
    const domain = this.entityId.split(".")[0];
    const power = sensorValue(hass, this.powerId, 0);
    const dimmable = isDimmable(s) && isActive(s);
    const pct = this.dragging ?? brightnessPercent(s);
    const state =
      stateLabel(hass, s) + (power && isActive(s) ? ` · ${power} W` : "") + (dimmable && pct ? ` · ${pct} %` : "");
    const classes = [
      "tile",
      domain,
      isActive(s) ? "on" : "",
      isUnavailable(s) ? "unavailable" : "",
      this.pending ? "pending" : "",
      dimmable ? "dimmable" : "",
    ].join(" ");

    return html`
      <button
        class=${classes}
        aria-pressed=${canToggle(this.entityId) ? String(isActive(s)) : nothing}
        aria-disabled=${isUnavailable(s) ? "true" : nothing}
        @click=${this.onTap}
      >
        <span class="icon">${stateIcon(hass, s)}</span>
        <span class="name">${this.name}</span>
        <span class="state">${state}</span>
        ${needsConfirmation(this.entityId) ? html`<span class="guard">Confirmation demandée</span>` : nothing}
      </button>
      ${dimmable
        ? html`<input
            class="dim"
            type="range"
            min="1"
            max="100"
            .value=${String(pct ?? 100)}
            aria-label="Luminosité de ${this.name}"
            @input=${(e: Event) => (this.dragging = Number((e.target as HTMLInputElement).value))}
            @change=${async (e: Event) => {
              await setBrightness(this.entityId, Number((e.target as HTMLInputElement).value));
              this.dragging = undefined;
            }}
          />`
        : nothing}
      <button class="more" aria-label="Détails de ${this.name}" @click=${() => openMoreInfo(this, this.entityId)}>
        <ha-icon icon="mdi:dots-horizontal"></ha-icon>
      </button>
    `;
  }
}
customElements.define("kh-tile", KhTile);
