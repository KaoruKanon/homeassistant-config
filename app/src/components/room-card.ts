import { LitElement, css, html, nothing } from "lit";
import { setLights } from "../actions.ts";
import { isActive, isUnavailable, sensorValue } from "../format.ts";
import type { Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/** Summary of a room on the home view: climate, what is on, what is open. */
export class KhRoomCard extends LitElement {
  static properties = { room: { attribute: false }, href: {} };
  declare room: Room;
  declare href: string;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const r = this.room;
      if (!r) return [];
      return [...r.lights, ...r.openings, ...[r.temperature, r.humidity].filter((x): x is string => !!x)];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      /* A room is a window on the house front: it glows when its lights are on. */
      .card {
        position: relative;
        isolation: isolate;
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto 1fr auto;
        gap: 6px 12px;
        min-height: var(--kh-card-min, 136px);
        padding: var(--kh-card-pad, 16px);
        box-sizing: border-box;
        border-radius: 6px;
        background: var(--kh-surface);
        border: 1.5px solid var(--kh-line);
        overflow: hidden;
        transition: border-color 400ms ease;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background: radial-gradient(130% 100% at 30% 0%, var(--kh-lamp-glow), transparent 75%);
        opacity: var(--glow, 0);
        transition: opacity 400ms ease;
      }
      .card.lit {
        border-color: var(--kh-lamp-frame);
      }
      .card.open::after {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        border-style: solid;
        border-width: 0 18px 18px 0;
        border-color: transparent var(--kh-alert) transparent transparent;
      }
      a.cover {
        position: absolute;
        inset: 0;
      }
      .name {
        font-family: var(--kh-display);
        font-size: 1.125rem;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }
      .climate {
        grid-column: 1;
        align-self: end;
        font-variant-numeric: tabular-nums;
        color: var(--kh-text-2);
      }
      .climate strong {
        color: var(--kh-text);
        font-size: 1.625rem;
        margin-right: 6px;
      }
      .status {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        font-size: 0.875rem;
        color: var(--kh-text-2);
        min-height: 1.25em;
      }
      .status .lamp::before {
        content: "";
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 6px;
        border-radius: 50%;
        background: var(--kh-lamp);
        vertical-align: 1px;
      }
      .status .lamp {
        color: var(--kh-text);
      }
      .status .alert {
        color: var(--kh-alert);
        font-weight: 700;
      }
      .lights {
        position: relative; /* above the cover link */
        grid-column: 2;
        grid-row: 1 / 3;
        align-self: start;
        width: var(--kh-tap);
        height: var(--kh-tap);
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1.5px solid var(--kh-line);
        background: var(--kh-surface);
        color: var(--kh-text-2);
      }
      .lights.on {
        background: var(--kh-lamp);
        border-color: var(--kh-lamp);
        color: #241a05;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    const r = this.room;
    if (!hass || !r) return nothing;
    const lightsOn = r.lights.filter((id) => isActive(hass.states[id]));
    const open = r.openings.filter((id) => isActive(hass.states[id]));
    const temp = sensorValue(hass, r.temperature);
    const hum = sensorValue(hass, r.humidity, 0);
    const watched = [...r.lights, ...r.openings, r.temperature, r.humidity].filter((x): x is string => !!x);
    const unreachable = watched.length > 0 && watched.every((id) => isUnavailable(hass.states[id]));
    const lightsReachable = r.lights.some((id) => !isUnavailable(hass.states[id]));
    // Any light on gives a clear glow; a fully lit room glows the most.
    const glow = lightsOn.length ? 0.55 + 0.45 * (lightsOn.length / r.lights.length) : 0;
    const label = `${r.name}${lightsOn.length ? `, ${lightsOn.length} allumée${lightsOn.length > 1 ? "s" : ""}` : ""}${
      open.length ? `, ${open.length} ouverture${open.length > 1 ? "s" : ""}` : ""
    }`;

    return html`
      <div class="card ${lightsOn.length ? "lit" : ""} ${open.length ? "open" : ""}" style="--glow:${glow}">
        <a class="cover" href=${this.href} aria-label="Ouvrir ${label}"></a>
        <div class="name">${r.name}</div>
        ${lightsReachable
          ? html`<button
              class="lights ${lightsOn.length ? "on" : ""}"
              aria-label=${lightsOn.length ? `Éteindre les lumières de ${r.name}` : `Allumer les lumières de ${r.name}`}
              aria-pressed=${lightsOn.length ? "true" : "false"}
              @click=${() => setLights(r.lights, lightsOn.length === 0)}
            >
              <ha-icon icon=${lightsOn.length ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon>
            </button>`
          : nothing}
        <div class="climate">
          ${temp ? html`<strong>${temp}°</strong>` : nothing}${hum ? html`${hum} %` : nothing}
        </div>
        <div class="status">
          ${lightsOn.length
            ? html`<span class="lamp">${lightsOn.length === 1 ? "1 lumière" : `${lightsOn.length} lumières`}</span>`
            : nothing}
          ${open.length
            ? html`<span class="alert">${open.length === 1 ? "Fenêtre ouverte" : `${open.length} ouvertures`}</span>`
            : nothing}
          ${unreachable ? html`<span>Appareils injoignables</span>` : nothing}
        </div>
      </div>
    `;
  }
}
customElements.define("kh-room-card", KhRoomCard);
