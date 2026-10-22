import { LitElement, css, html, nothing } from "lit";
import "../components/hero.ts";
import "../components/now-strip.ts";
import "../components/room-card.ts";
import "../components/tile.ts";
import { config } from "../config.ts";
import type { HouseModel, Room } from "../rooms.ts";
import { currentPerson, entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

export class KhHomeView extends LitElement {
  static properties = {
    model: { attribute: false },
    rooms: { attribute: false },
    prefix: {},
  };
  declare model: HouseModel;
  declare rooms: Room[];
  declare prefix: string;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const hass = store.hass;
      const person = hass && currentPerson(hass)?.replace("person.", "");
      return (person && config.people[person]?.shortcuts) || [];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      h2 {
        font-size: 1rem;
        font-weight: 700;
        color: var(--kh-text-2);
        margin: 8px 0 12px;
      }
      .rooms {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
        gap: var(--kh-gap);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--kh-gap);
      }
      section + section {
        margin-top: 28px;
      }
      .facade {
        margin-bottom: 28px;
      }
      .hint {
        color: var(--kh-text-2);
        font-size: 0.875rem;
        margin: -4px 0 12px;
      }
      @container kh (max-width: 599px) {
        .rooms {
          grid-template-columns: repeat(2, 1fr);
          --kh-card-min: 104px;
          --kh-card-pad: 12px;
        }
        .tiles {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ];

  /** Out of its room, a device name says which room it is in. */
  private shortcutName(id: string): string {
    const hass = store.hass!;
    const room = this.model.rooms.find((r) => [...r.lights, ...r.switches, ...r.fans, ...r.media].includes(id));
    const name = entityName(hass, id, config, room?.name);
    return room && !name.toLowerCase().includes(room.name.toLowerCase()) ? `${name} (${room.name})` : name;
  }

  render() {
    const hass = store.hass;
    if (!hass || !this.model) return nothing;
    const loose = this.model.unassignedLights;
    const person = currentPerson(hass)?.replace("person.", "");
    const shortcuts = ((person && config.people[person]?.shortcuts) || []).filter((id) => hass.states[id]);
    return html`
      <kh-hero></kh-hero>
      <section class="facade" aria-label="Pièces">
        <div class="rooms">
          ${this.rooms.map(
            (r) => html`<kh-room-card .room=${r} href=${`${this.prefix}/${r.id}`}></kh-room-card>`,
          )}
        </div>
      </section>
      <kh-now-strip .model=${this.model}></kh-now-strip>
      ${shortcuts.length
        ? html`<section aria-labelledby="mine-title">
            <h2 id="mine-title">Pour toi</h2>
            <div class="tiles">
              ${shortcuts.map((id) => html`<kh-tile entity-id=${id} name=${this.shortcutName(id)}></kh-tile>`)}
            </div>
          </section>`
        : nothing}
      ${loose.length
        ? html`<section aria-labelledby="loose-title">
            <h2 id="loose-title">Lumières sans pièce</h2>
            <p class="hint">Attribue-leur une pièce dans Home Assistant pour les retrouver au bon endroit.</p>
            <div class="tiles">
              ${loose.map((id) => html`<kh-tile entity-id=${id} name=${entityName(hass, id, config)}></kh-tile>`)}
            </div>
          </section>`
        : nothing}
    `;
  }
}
customElements.define("kh-home-view", KhHomeView);
