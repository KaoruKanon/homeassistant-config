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
      return [...r.lights, ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x)];
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
        padding: 12px;
        display: grid;
        gap: 10px;
        transition: background-color 200ms ease;
      }
      .card.lit {
        background: rgba(var(--rgb-amber), 0.18);
      }
      a.cover {
        position: absolute;
        inset: 0;
        border-radius: var(--kh-radius);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .head > div {
        flex: 1;
        min-width: 0;
      }
      .lights {
        position: relative; /* above the cover link */
        width: 44px;
        height: 44px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
        color: var(--kh-text-2);
      }
      .lights.on {
        background: rgb(var(--rgb-amber));
        color: #2b2003;
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-height: 26px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 26px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--kh-card-2);
        color: var(--kh-text-2);
      }
      .pill ha-icon {
        --mdc-icon-size: 16px;
      }
      .pill.amber {
        background: rgba(var(--rgb-amber), 0.25);
        color: var(--kh-text);
      }
      .pill.red {
        background: rgba(var(--rgb-red), 0.2);
        color: rgb(var(--rgb-red));
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
    const climate = [temp ? `${temp} °C` : "", hum ? `${hum} %` : ""].filter(Boolean).join(", ");

    return html`
      <div class="card ${lightsOn.length ? "lit" : ""}">
        <a class="cover" href=${this.href} aria-label="Ouvrir ${r.name}"></a>
        <div class="head">
          <span class="shape ${lightsOn.length ? "" : "off"}" style="--rgb: var(--rgb-amber)"><ha-icon icon=${r.icon}></ha-icon></span>
          <div>
            <div class="primary ellipsis">${r.name}</div>
            <div class="secondary">${unreachable ? "Appareils injoignables" : climate || "Pas de capteur"}</div>
          </div>
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
        </div>
        <div class="pills">
          ${lightsOn.length
            ? html`<span class="pill amber"><ha-icon icon="mdi:lightbulb-on"></ha-icon>${lightsOn.length}</span>`
            : nothing}
          ${open.length
            ? html`<span class="pill red"><ha-icon icon="mdi:window-open-variant"></ha-icon>${open.length === 1 ? "Fenêtre ouverte" : `${open.length} ouvertures`}</span>`
            : nothing}
          ${r.motion.some((id) => isActive(hass.states[id]))
            ? html`<span class="pill"><ha-icon icon="mdi:motion-sensor"></ha-icon>Présence</span>`
            : nothing}
        </div>
      </div>
    `;
  }
}
customElements.define("kh-room-card", KhRoomCard);
