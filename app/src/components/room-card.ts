import { LitElement, css, html, nothing } from "lit";
import { setLights } from "../actions.ts";
import { isActive, sensorValue } from "../format.ts";
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
      .card {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto 1fr;
        gap: 4px 12px;
        min-height: 128px;
        padding: 16px;
        box-sizing: border-box;
        border-radius: var(--kh-radius);
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
      }
      a.cover {
        position: absolute;
        inset: 0;
        border-radius: var(--kh-radius);
      }
      .title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 1.0625rem;
      }
      .title ha-icon {
        color: var(--kh-text-2);
      }
      .climate {
        grid-column: 1;
        color: var(--kh-text-2);
        font-variant-numeric: tabular-nums;
      }
      .climate strong {
        color: var(--kh-text);
        font-size: 1.375rem;
      }
      .status {
        grid-column: 1 / -1;
        align-self: end;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pill {
        font-size: 0.8125rem;
        padding: 3px 10px;
        border-radius: 999px;
        background: var(--kh-surface-2);
        color: var(--kh-text-2);
      }
      .pill.warm {
        background: var(--kh-warm-soft);
        color: var(--kh-text);
      }
      .pill.alert {
        background: var(--kh-alert-soft);
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
        background: var(--kh-surface-2);
        color: var(--kh-text-2);
      }
      .lights.on {
        background: var(--kh-warm-soft);
        color: var(--kh-warm);
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

    return html`
      <div class="card">
        <a class="cover" href=${this.href} aria-label="Ouvrir ${r.name}"></a>
        <div class="title"><ha-icon icon=${r.icon}></ha-icon>${r.name}</div>
        ${r.lights.length
          ? html`<button
              class="lights ${lightsOn.length ? "on" : ""}"
              aria-label=${lightsOn.length ? `Éteindre les lumières de ${r.name}` : `Allumer les lumières de ${r.name}`}
              @click=${() => setLights(r.lights, lightsOn.length === 0)}
            >
              <ha-icon icon=${lightsOn.length ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon>
            </button>`
          : nothing}
        <div class="climate">
          ${temp ? html`<strong>${temp}°</strong>` : nothing} ${hum ? html` · ${hum} %` : nothing}
        </div>
        <div class="status">
          ${lightsOn.length
            ? html`<span class="pill warm">${lightsOn.length === 1 ? "1 lumière allumée" : `${lightsOn.length} lumières allumées`}</span>`
            : nothing}
          ${open.length
            ? html`<span class="pill alert">${open.length === 1 ? "1 ouverture" : `${open.length} ouvertures`}</span>`
            : nothing}
          ${!lightsOn.length && !open.length ? html`<span class="pill">Tout est calme</span>` : nothing}
        </div>
      </div>
    `;
  }
}
customElements.define("kh-room-card", KhRoomCard);
