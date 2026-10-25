import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, setLights } from "../actions.ts";
import "../components/light-pill.ts";
import "../components/sparkline.ts";
import "../components/tile.ts";
import { config } from "../config.ts";
import { formatNumber, isActive, stateIcon, stateLabel } from "../format.ts";
import { entityName, type HouseModel, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { frogSky } from "../weather-utils.ts";
import { roomScene, roomSceneStyles } from "./room-art.ts";
import { head, hero, v2 } from "./styles.ts";

/** One room: the other rooms on a row, its hero, then a tile per kind of device. */
export class KhV2Room extends LitElement {
  static properties = { room: { attribute: false }, rooms: { attribute: false }, model: { attribute: false }, prefix: {} };
  declare room: Room;
  declare rooms: Room[];
  declare model: HouseModel;
  declare prefix: string;
  private shown?: string;

  constructor() {
    super();
    new RegistryController(this);
    // Only what this view prints itself; pills and tiles watch their own entity.
    new EntitiesController(this, () => {
      const r = this.room;
      return r ? [...r.lights, ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x), "sun.sun"] : [];
    });
  }

  static styles = [
    base,
    v2,
    roomSceneStyles,
    css`
      /* The scene of the room is the whole hero background. */
      .hero {
        min-height: 200px;
        background: #2b3363;
      }
      .hero > :not(.art) {
        position: relative;
        z-index: 1;
      }
      .hero .art {
        position: absolute;
        inset: 0;
        container-type: size;
      }
      /* Phones: smaller furniture at the bottom right, no window under the title. */
      @container v2 (max-width: 679px) {
    @media (orientation: portrait) {
        .hero .art {
          --scene-max: 54cqw;
        }
        .hero .art .window {
          display: none;
        }
        }
  }
      .hero .art::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgb(0 0 0 / 0.38), rgb(0 0 0 / 0) 60%);
      }
      .switcher {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        padding: 0 0 14px;
      }
      .switcher a {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 14px;
        border-radius: 20px;
        background: var(--kh-card);
        color: inherit;
        text-decoration: none;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .switcher a ha-icon {
        --mdc-icon-size: 18px;
        color: var(--kh-text-2);
      }
      .switcher a[aria-current="page"] {
        background: rgb(var(--rgb-amber));
        color: #2b2003;
      }
      .switcher a[aria-current="page"] ha-icon {
        color: inherit;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
        gap: 10px;
      }
      .item.alert {
        background: rgba(var(--rgb-red), 0.18);
      }
    `,
  ];

  protected updated(): void {
    if (this.room?.id === this.shown) return;
    this.shown = this.room?.id;
    // Bring the current room into view in the row, without scrolling the page.
    const row = this.renderRoot.querySelector<HTMLElement>(".switcher");
    const chip = row?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2 });
  }

  /** Openings and presence: a state, red when it needs attention. */
  private states(ids: string[], alertWhenActive: boolean, rgb: string) {
    const hass = store.hass!;
    return html`<div class="list">
      ${ids.map((id) => {
        const s = hass.states[id];
        return html`<button class="item ${alertWhenActive && isActive(s) ? "alert" : ""}" @click=${() => openMoreInfo(this, id)}>
          <span class="shape ${isActive(s) ? "" : "off"}" style="--rgb: ${rgb}">${stateIcon(hass, s)}</span>
          <span class="primary ellipsis">${entityName(hass, id, config, this.room.name)}</span>
          <span class="secondary">${stateLabel(hass, s)}</span>
        </button>`;
      })}
    </div>`;
  }

  render() {
    const hass = store.hass;
    const r = this.room;
    if (!hass || !r) return nothing;
    const on = r.lights.filter((id) => isActive(hass.states[id]));
    const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
    const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
    const devices = [...r.switches, ...r.fans];
    const tiles = (ids: string[]) => html`<div class="tiles">
      ${ids.map((id) => html`<kh-tile entity-id=${id} name=${entityName(hass, id, config, r.name)} power-id=${this.model?.power[id] ?? nothing}></kh-tile>`)}
    </div>`;
    const graph = [
      ...(r.temperature ? [{ entity: r.temperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" }] : []),
      ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
    ];

    return html`
      <nav class="switcher" aria-label="Pièces">
        <a href=${`${this.prefix}/pieces`}><ha-icon icon="mdi:view-grid-outline"></ha-icon>Toutes</a>
        ${(this.rooms ?? []).map(
          (x) => html`<a href=${`${this.prefix}/pieces/${x.id}`} aria-current=${x.id === r.id ? "page" : nothing}>
            <ha-icon icon=${x.icon}></ha-icon>${x.name}
          </a>`,
        )}
      </nav>
      ${hero(
        on.length ? "amber" : "indigo",
        r.icon,
        "Pièce",
        r.name,
        r.lights.length ? (on.length ? `${on.length} lumière${on.length > 1 ? "s" : ""} sur ${r.lights.length} allumée${on.length > 1 ? "s" : ""}` : "Lumières éteintes") : "",
        html`${!isNaN(t) ? html`<span class="chip"><ha-icon icon="mdi:thermometer"></ha-icon>${formatNumber(t)} °C</span>` : nothing}
          ${!isNaN(hum) ? html`<span class="chip"><ha-icon icon="mdi:water-percent"></ha-icon>${formatNumber(hum, 0)} %</span>` : nothing}
          ${r.lights.length
            ? html`<button class="chip" @click=${() => setLights(r.lights, !on.length)}>
                <ha-icon icon=${on.length ? "mdi:lightbulb-off-outline" : "mdi:lightbulb-on-outline"}></ha-icon>${on.length ? "Tout éteindre" : "Tout allumer"}
              </button>`
            : nothing}`,
        html`<div class="art">${roomScene(r, on.length > 0, hass.states["sun.sun"]?.state === "below_horizon", frogSky())}</div>`,
      )}
      <div class="bento">
        ${r.lights.length
          ? html`<section class="tile" style="--tint: var(--rgb-amber); --w: ${graph.length ? 7 : 12}; --w6: 6; --w2: 2">
              ${head("mdi:lightbulb-group", "Lumières")}
              <div class="pills">
                ${r.lights.map((id) => html`<kh-light-pill entity-id=${id} name=${entityName(hass, id, config, r.name)}></kh-light-pill>`)}
              </div>
              <div class="secondary">Glisser pour la luminosité, appui long pour les couleurs.</div>
            </section>`
          : nothing}
        ${graph.length
          ? html`<section class="tile" style="--tint: var(--rgb-green); --w: ${r.lights.length ? 5 : 12}; --w6: 6; --w2: 2">
              ${head("mdi:home-thermometer", "Climat sur 24 h")}
              <kh-sparkline .entities=${graph}></kh-sparkline>
            </section>`
          : nothing}
        ${devices.length
          ? html`<section class="tile" style="--tint: var(--rgb-light-blue); --w: 6; --w6: 6; --w2: 2">
              ${head("mdi:power-plug", "Prises et appareils")}${tiles(devices)}
            </section>`
          : nothing}
        ${r.media.length
          ? html`<section class="tile" style="--tint: var(--rgb-purple); --w: 6; --w6: 6; --w2: 2">
              ${head("mdi:play-circle", "Médias")}${tiles(r.media)}
            </section>`
          : nothing}
        ${r.openings.length
          ? html`<section class="tile" style="--tint: var(--rgb-red); --w: 6; --w6: 3; --w2: 2">
              ${head("mdi:window-open-variant", "Ouvertures")}${this.states(r.openings, true, "var(--rgb-red)")}
            </section>`
          : nothing}
        ${r.motion.length
          ? html`<section class="tile" style="--tint: var(--rgb-indigo); --w: 6; --w6: 3; --w2: 2">
              ${head("mdi:motion-sensor", "Présence")}${this.states(r.motion, false, "var(--rgb-indigo)")}
            </section>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-v2-room", KhV2Room);
