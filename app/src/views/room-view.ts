import { LitElement, css, html, nothing } from "lit";
import { setLights } from "../actions.ts";
import "../components/energy-devices.ts";
import "../components/light-card.ts";
import "../components/sparkline.ts";
import "../components/tile.ts";
import { config } from "../config.ts";
import { isActive, sensorValue, stateIcon, stateLabel } from "../format.ts";
import type { HouseModel, Room } from "../rooms.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/** One room: a row of rooms on top, then its lights, devices, media, sensors. */
export class KhRoomView extends LitElement {
  static properties = { room: { attribute: false }, model: { attribute: false }, rooms: { attribute: false }, prefix: {} };
  declare room: Room;
  declare model: HouseModel;
  declare rooms: Room[];
  declare prefix: string;
  private shown?: string;

  constructor() {
    super();
    new RegistryController(this);
    // Only what this view prints itself; cards and tiles watch their own entity.
    new EntitiesController(this, () => {
      const r = this.room;
      if (!r) return [];
      return [...r.lights, ...r.switches, ...r.fans, ...r.media, ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x)];
    });
  }

  static styles = [
    base,
    css`
      .graph {
        padding: 12px 16px;
      }
      :host {
        display: block;
      }
      .rooms {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        padding: 2px 0 8px;
      }
      .rooms a {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 14px;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card);
        color: inherit;
        text-decoration: none;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .rooms a ha-icon {
        --mdc-icon-size: 18px;
        color: var(--kh-text-2);
      }
      .rooms a[aria-current="page"] {
        background: rgba(var(--rgb-amber), 0.3);
      }
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0 4px;
      }
      h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 2rem;
        margin: 0;
      }
      .climate {
        margin-top: 4px;
      }
      .all {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        padding: 0 16px;
        border-radius: var(--kh-radius-icon);
        background: rgba(var(--rgb-amber), 0.22);
        font-weight: 700;
      }
      h2 {
        font-size: 1.375rem;
        margin: 20px 0 8px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--kh-gap);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
      }
      .status > div {
        flex: 1;
        min-width: 0;
      }
      .status.alert {
        background: rgba(var(--rgb-red), 0.16);
      }
      @container kh (max-width: 599px) {
        .grid {
          grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
        }
      }
    `,
  ];

  protected updated(): void {
    if (this.room?.id === this.shown) return;
    this.shown = this.room?.id;
    // Bring the current room into view in the row, without scrolling the page.
    const row = this.renderRoot.querySelector<HTMLElement>(".rooms");
    const chip = row?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2 });
  }

  private status(ids: string[], alertWhenActive: boolean, rgb: string) {
    const hass = store.hass!;
    return html`<div class="grid">
      ${ids.map((id) => {
        const s = hass.states[id];
        const alert = alertWhenActive && isActive(s);
        return html`<div class="card status ${alert ? "alert" : ""}">
          <span class="shape ${isActive(s) ? "" : "off"}" style="--rgb:${rgb}">${stateIcon(hass, s)}</span>
          <div>
            <div class="primary ellipsis">${entityName(hass, id, config, this.room.name)}</div>
            <div class="secondary">${stateLabel(hass, s)}</div>
          </div>
        </div>`;
      })}
    </div>`;
  }

  render() {
    const hass = store.hass;
    const r = this.room;
    if (!hass || !r) return nothing;
    const anyOn = r.lights.some((id) => isActive(hass.states[id]));
    const temp = sensorValue(hass, r.temperature);
    const hum = sensorValue(hass, r.humidity, 0);
    const climate = [temp ? `${temp} °C` : "", hum ? `${hum} % d'humidité` : ""].filter(Boolean).join(", ");
    const devices = r.switches; // fans get their own card (speed, oscillation, timer)
    const graph = [
      ...(r.temperature ? [{ entity: r.temperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" }] : []),
      ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
    ];
    const tiles = (ids: string[]) => html`<div class="grid">
      ${ids.map(
        (id) => html`<kh-tile entity-id=${id} name=${entityName(hass, id, config, r.name)} power-id=${this.model.power[id] ?? nothing}></kh-tile>`,
      )}
    </div>`;

    return html`
      <nav class="rooms" aria-label="Pièces">
        ${(this.rooms ?? []).map(
          (x) => html`<a href=${`${this.prefix}/pieces/${x.id}`} aria-current=${x.id === r.id ? "page" : nothing}>
            <ha-icon icon=${x.icon}></ha-icon>${x.name}
          </a>`,
        )}
      </nav>
      <header>
        <div>
          <h1><span class="shape" style="--rgb: var(--rgb-amber)"><ha-icon icon=${r.icon}></ha-icon></span>${r.name}</h1>
          ${climate ? html`<div class="secondary climate">${climate}</div>` : nothing}
        </div>
        ${r.lights.length
          ? html`<button class="all" @click=${() => setLights(r.lights, !anyOn)}>
              <ha-icon icon=${anyOn ? "mdi:lightbulb-off-outline" : "mdi:lightbulb-on-outline"}></ha-icon>
              ${anyOn ? "Tout éteindre" : "Tout allumer"}
            </button>`
          : nothing}
      </header>
      ${r.lights.length
        ? html`<h2>Lumières</h2>
            <div class="grid">
              ${r.lights.map((id) => html`<kh-light-card entity-id=${id} name=${entityName(hass, id, config, r.name)}></kh-light-card>`)}
            </div>`
        : nothing}
      ${graph.length ? html`<h2>Climat sur 24 h</h2><div class="card graph"><kh-sparkline .entities=${graph}></kh-sparkline></div>` : nothing}
      ${r.fans.length ? html`<h2>Ventilation</h2><div class="grid">${r.fans.map((id) => html`<kh-fan entity-id=${id}></kh-fan>`)}</div>` : nothing}
      ${devices.length ? html`<h2>Prises et appareils</h2>${tiles(devices)}` : nothing}
      ${r.media.length ? html`<h2>Médias</h2>${tiles(r.media)}` : nothing}
      ${r.openings.length ? html`<h2>Ouvertures</h2>${this.status(r.openings, true, "var(--rgb-red)")}` : nothing}
      ${r.motion.length ? html`<h2>Présence</h2>${this.status(r.motion, false, "var(--rgb-indigo)")}` : nothing}
    `;
  }
}
customElements.define("kh-room-view", KhRoomView);
