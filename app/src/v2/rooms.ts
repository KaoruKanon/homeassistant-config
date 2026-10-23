import { LitElement, css, html, nothing } from "lit";
import { setLights } from "../actions.ts";
import "../components/light-pill.ts";
import { config } from "../config.ts";
import { formatNumber, isActive, isUnavailable } from "../format.ts";
import { alarmLook, openAlarm, openOpenings } from "../popups/index.ts";
import { entityName, type HouseModel, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { frogSky } from "../weather-utils.ts";
import { houseScene, roomScene, roomSceneStyles } from "./room-art.ts";
import { head, hero, v2 } from "./styles.ts";

/** Maison: the whole house in one hero, then one tile per room. */
export class KhV2Rooms extends LitElement {
  static properties = { rooms: { attribute: false }, model: { attribute: false }, prefix: {} };
  declare rooms: Room[];
  declare model: HouseModel;
  declare prefix: string;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () =>
      (this.rooms ?? []).flatMap((r) => [...r.lights, ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x)]).concat("sun.sun", config.home.chips.alarm ?? "sun.sun"),
    );
  }

  static styles = [
    base,
    v2,
    roomSceneStyles,
    css`
      /* The hero: the whole house, cut open. */
      .hero {
        min-height: 210px;
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
      .hero .art::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgb(0 0 0 / 0.32), rgb(0 0 0 / 0) 55%);
      }
      @container v2 (max-width: 679px) {
        .hero .art {
          --scene-max: 42cqw;
        }
      }
      /* Each tile is the scene of its room, the text on its left wall. */
      /* The whole card opens the room (the cover link); only the light switch
         takes its own taps. */
      .room > :not(.art, .cover) {
        position: relative;
        pointer-events: none;
      }
      .room .switch {
        pointer-events: auto;
      }
      .room .art {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        container-type: size;
        --scene-max: 62cqw;
      }
      .room .art::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgb(0 0 0 / 0.42), rgb(0 0 0 / 0) 65%);
      }
      .room {
        color: #fff;
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
        background: #2b3363;
        overflow: hidden;
      }
      .room .facts {
        color: rgb(255 255 255 / 0.85);
      }
      .room .facts .warn {
        color: #ffb4a8;
      }
      .room .shape.off {
        background: rgb(0 0 0 / 0.25);
        color: #fff;
      }
      .room .switch {
        background: rgb(0 0 0 / 0.3);
        color: #fff;
      }
      .room .switch.on {
        background: rgb(var(--rgb-amber));
        color: #2b2003;
      }
      .room .dots i {
        background: rgb(255 255 255 / 0.25);
      }
      .room {
        position: relative;
        min-height: 150px;
        align-content: space-between;
        transition: background-color 300ms ease;
      }
      .room.lit {
        --tint: var(--rgb-amber);
        background: linear-gradient(160deg, rgba(var(--rgb-amber), 0.42), rgba(var(--rgb-orange), 0.12) 70%), var(--kh-card);
      }
      .room.alert {
        box-shadow: inset 0 0 0 2px rgba(var(--rgb-red), 0.7);
      }
      a.cover {
        position: absolute;
        inset: 0;
        border-radius: inherit;
      }
      .top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }
      .top .shape {
        width: 48px;
        height: 48px;
        border-radius: 16px;
      }
      .top .shape ha-icon {
        --mdc-icon-size: 26px;
      }
      .switch {
        position: relative; /* above the cover link */
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: var(--kh-card-2);
        color: var(--kh-text-2);
      }
      .switch.on {
        background: rgb(var(--rgb-amber));
        color: #2b2003;
      }
      .name {
        font-size: 1.125rem;
        font-weight: 800;
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        color: var(--kh-text-2);
        font-weight: 600;
        font-size: 0.8125rem;
      }
      .facts span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .facts ha-icon {
        --mdc-icon-size: 16px;
      }
      .facts .warn {
        color: rgb(var(--rgb-red));
      }
      .dots {
        display: flex;
        gap: 4px;
      }
      .dots i {
        width: 18px;
        height: 6px;
        border-radius: 3px;
        background: var(--kh-card-2);
      }
      .dots i.on {
        background: rgb(var(--rgb-amber));
      }
    `,
  ];

  private roomTile(r: Room) {
    const hass = store.hass!;
    const on = r.lights.filter((id) => isActive(hass.states[id]));
    const open = r.openings.filter((id) => isActive(hass.states[id]));
    const presence = r.motion.some((id) => isActive(hass.states[id]));
    const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
    const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
    const reachable = r.lights.some((id) => !isUnavailable(hass.states[id]));
    return html`<section class="tile room ${on.length ? "lit" : ""} ${open.length ? "alert" : ""}" style="--tint: var(--rgb-amber); --w: 3; --w6: 2; --w2: 1">
      <div class="art">${roomScene(r, on.length > 0, hass.states["sun.sun"]?.state === "below_horizon", frogSky(), true)}</div>
      <a class="cover" href=${`${this.prefix}/pieces/${r.id}`} aria-label="Ouvrir ${r.name}"></a>
      <div class="top">
        <span class="shape ${on.length ? "" : "off"}" style="--rgb: var(--rgb-amber)"><ha-icon icon=${r.icon}></ha-icon></span>
        ${reachable
          ? html`<button class="switch ${on.length ? "on" : ""}" aria-pressed=${String(!!on.length)}
              aria-label=${on.length ? `Éteindre les lumières de ${r.name}` : `Allumer les lumières de ${r.name}`}
              @click=${() => setLights(r.lights, !on.length)}>
              <ha-icon icon=${on.length ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon>
            </button>`
          : nothing}
      </div>
      <div>
        <div class="name ellipsis">${r.name}</div>
        <div class="facts">
          ${!isNaN(t) ? html`<span><ha-icon icon="mdi:thermometer"></ha-icon>${formatNumber(t)}°</span>` : nothing}
          ${!isNaN(hum) ? html`<span><ha-icon icon="mdi:water-percent"></ha-icon>${formatNumber(hum, 0)} %</span>` : nothing}
          ${open.length ? html`<span class="warn"><ha-icon icon="mdi:window-open-variant"></ha-icon>${open.length} ouverte${open.length > 1 ? "s" : ""}</span>` : nothing}
          ${presence ? html`<span><ha-icon icon="mdi:motion-sensor"></ha-icon>Présence</span>` : nothing}
        </div>
      </div>
      ${r.lights.length
        ? html`<div class="dots" aria-label="${on.length} lumière${on.length > 1 ? "s" : ""} allumée${on.length > 1 ? "s" : ""} sur ${r.lights.length}">
            ${r.lights.map((id) => html`<i class=${isActive(hass.states[id]) ? "on" : ""}></i>`)}
          </div>`
        : nothing}
    </section>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const rooms = this.rooms ?? [];
    const lights = rooms.flatMap((r) => r.lights);
    const on = lights.filter((id) => isActive(hass.states[id]));
    const openings = rooms.flatMap((r) => r.openings);
    const open = openings.filter((id) => isActive(hass.states[id]));
    const temps = rooms.map((r) => (r.temperature ? Number(hass.states[r.temperature]?.state) : NaN)).filter((v) => !isNaN(v));
    const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : NaN;
    const alarm = config.home.chips.alarm ? hass.states[config.home.chips.alarm] : undefined;
    const loose = (this.model?.unassignedLights ?? []).filter((id) => hass.states[id]);

    return html`
      ${hero(
        "amber",
        "mdi:floor-plan",
        `${rooms.length} pièces`,
        "Maison",
        on.length ? `${on.length} lumière${on.length > 1 ? "s" : ""} allumée${on.length > 1 ? "s" : ""}` : "Tout est éteint",
        html`${!isNaN(avg) ? html`<span class="chip"><ha-icon icon="mdi:home-thermometer"></ha-icon>${formatNumber(avg)}° en moyenne</span>` : nothing}
          ${open.length
            ? html`<button class="chip alert" @click=${() => openOpenings(openings)}><ha-icon icon="mdi:window-open-variant"></ha-icon>${open.length} ouverte${open.length > 1 ? "s" : ""}</button>`
            : html`<span class="chip"><ha-icon icon="mdi:window-closed-variant"></ha-icon>Tout est fermé</span>`}
          ${alarm
            ? html`<button class="chip ${alarmLook(alarm.state).alert ? "alert" : ""}" @click=${() => openAlarm(alarm.entity_id)}>
                <ha-icon icon=${alarmLook(alarm.state).icon}></ha-icon>${alarmLook(alarm.state).label}</button>`
            : nothing}
          ${on.length
            ? html`<button class="chip" @click=${() => setLights(on, false)}><ha-icon icon="mdi:lightbulb-off-outline"></ha-icon>Tout éteindre</button>`
            : nothing}`,
        html`<div class="art">${houseScene(
          rooms.map((r) => ({ room: r, lit: r.lights.some((id) => isActive(hass.states[id])) })),
          hass.states["sun.sun"]?.state === "below_horizon",
          frogSky(),
        )}</div>`,
      )}
      <div class="bento">
        ${rooms.map((r) => this.roomTile(r))}
        ${loose.length
          ? html`<section class="tile" style="--tint: var(--rgb-grey); --w: 12; --w6: 6; --w2: 2">
              ${head("mdi:lightbulb-question-outline", "Lumières sans pièce")}
              <div class="pills">${loose.map((id) => html`<kh-light-pill entity-id=${id} name=${entityName(hass, id, config)}></kh-light-pill>`)}</div>
            </section>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-v2-rooms", KhV2Rooms);
