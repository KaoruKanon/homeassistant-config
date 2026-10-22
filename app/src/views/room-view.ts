import { LitElement, css, html, nothing } from "lit";
import { setLights } from "../actions.ts";
import "../components/tile.ts";
import { config } from "../config.ts";
import { isActive, sensorValue, stateIcon, stateLabel } from "../format.ts";
import type { HouseModel, Room } from "../rooms.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

export class KhRoomView extends LitElement {
  static properties = { room: { attribute: false }, model: { attribute: false } };
  declare room: Room;
  declare model: HouseModel;

  constructor() {
    super();
    new RegistryController(this);
    // Only what this view prints itself; tiles watch their own entity.
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
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: 12px 24px;
        margin: 8px 0 24px;
      }
      h1 {
        font-family: var(--kh-display);
        font-weight: 400;
        font-size: 2.25rem;
        line-height: 1.1;
        margin: 0;
      }
      .climate {
        color: var(--kh-text-2);
        font-variant-numeric: tabular-nums;
        margin-top: 6px;
      }
      .climate strong {
        color: var(--kh-text);
      }
      .all {
        min-height: var(--kh-tap);
        padding: 0 18px;
        border-radius: 999px;
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      h2 {
        font-size: 1rem;
        color: var(--kh-text-2);
        margin: 0 0 12px;
      }
      section + section {
        margin-top: 28px;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
        gap: var(--kh-gap);
      }
      ul.status {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
        gap: 8px var(--kh-gap);
      }
      ul.status li {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: var(--kh-tap);
        padding: 0 14px;
        border-radius: var(--kh-radius-sm);
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
      }
      ul.status li .label {
        flex: 1;
      }
      ul.status li .value {
        color: var(--kh-text-2);
      }
      ul.status li.alert {
        border-color: var(--kh-alert);
        background: var(--kh-alert-soft);
      }
      ul.status li.alert .value {
        color: var(--kh-alert);
        font-weight: 700;
      }
      @container kh (max-width: 599px) {
        h1 {
          font-size: 1.75rem;
        }
        .tiles {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ];

  private tiles(ids: string[]) {
    const hass = store.hass!;
    return html`<div class="tiles">
      ${ids.map(
        (id) => html`<kh-tile
          entity-id=${id}
          name=${entityName(hass, id, config, this.room.name)}
          power-id=${this.model.power[id] ?? nothing}
        ></kh-tile>`,
      )}
    </div>`;
  }

  private statusList(ids: string[], alertWhenActive: boolean) {
    const hass = store.hass!;
    return html`<ul class="status">
      ${ids.map((id) => {
        const s = hass.states[id];
        const alert = alertWhenActive && isActive(s);
        return html`<li class=${alert ? "alert" : ""}>
          ${stateIcon(hass, s)}
          <span class="label">${entityName(hass, id, config, this.room.name)}</span>
          <span class="value">${stateLabel(hass, s)}</span>
        </li>`;
      })}
    </ul>`;
  }

  render() {
    const hass = store.hass;
    const r = this.room;
    if (!hass || !r) return nothing;
    const anyOn = r.lights.some((id) => isActive(hass.states[id]));
    const temp = sensorValue(hass, r.temperature);
    const hum = sensorValue(hass, r.humidity, 0);
    const devices = [...r.switches, ...r.fans];

    return html`
      <header>
        <div>
          <h1>${r.name}</h1>
          ${temp || hum
            ? html`<div class="climate">
                ${temp ? html`<strong>${temp}°</strong>` : nothing}${temp && hum ? " · " : ""}${hum
                  ? html`${hum} % d'humidité`
                  : nothing}
              </div>`
            : nothing}
        </div>
        ${r.lights.length
          ? html`<button class="all" @click=${() => setLights(r.lights, !anyOn)}>
              <ha-icon icon=${anyOn ? "mdi:lightbulb-off-outline" : "mdi:lightbulb-on-outline"}></ha-icon>
              ${anyOn ? "Tout éteindre" : "Tout allumer"}
            </button>`
          : nothing}
      </header>
      ${r.lights.length ? html`<section><h2>Lumières</h2>${this.tiles(r.lights)}</section>` : nothing}
      ${devices.length ? html`<section><h2>Prises et appareils</h2>${this.tiles(devices)}</section>` : nothing}
      ${r.media.length ? html`<section><h2>Médias</h2>${this.tiles(r.media)}</section>` : nothing}
      ${r.openings.length ? html`<section><h2>Ouvertures</h2>${this.statusList(r.openings, true)}</section>` : nothing}
      ${r.motion.length ? html`<section><h2>Présence</h2>${this.statusList(r.motion, false)}</section>` : nothing}
    `;
  }
}
customElements.define("kh-room-view", KhRoomView);
