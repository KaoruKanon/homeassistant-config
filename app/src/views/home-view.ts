import { LitElement, css, html, nothing } from "lit";
import "../components/energy-card.ts";
import "../components/hero.ts";
import "../components/light-pill.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/swipe.ts";
import "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Favorite } from "../config.ts";
import { currentPerson, roomsFor } from "../rooms.ts";
import { house } from "../house.ts";
import "../v2/floorplan.ts";

import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/**
 * The home view of the old dashboard, rebuilt: Media and Favoris, Lumières
 * and Énergie, Météo, News and Autres. Three columns on the wall tablet, two
 * on a small tablet, one on a phone.
 */
export class KhHomeView extends LitElement {
  static properties = { prefix: {}, variant: {}, columns: { state: true } };
  declare prefix: string;
  /**
   * Home page proposals with the apartment plan: "bis" puts it in the left
   * column, "ter" lays it across the first two columns with the cards below.
   */
  declare variant?: string;
  /** 1, 2 or 3 columns, from the view's own width (columns stay >= ~400 px). */
  declare columns: number;
  private resize = new ResizeObserver(([e]) => {
    const w = e.contentRect.width;
    const n = w >= 1240 ? 3 : w >= 828 ? 2 : 1;
    if (n !== this.columns) this.columns = n;
  });

  constructor() {
    super();
    this.columns = 1;
    new RegistryController(this);
    // Only what decides which blocks show; each block watches its own data.
    new EntitiesController(this, () => [config.home.spotify, ...config.home.tvs].filter((x): x is string => !!x));
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .cols {
        display: grid;
        grid-template-columns: repeat(var(--n, 1), minmax(0, 1fr));
        gap: 0 28px;
        align-items: start;
      }
      .wide {
        grid-column: span 2;
      }
      .col {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      h2 {
        margin: 16px 0 6px;
        font-size: 1.5rem;
        font-weight: 700;
      }
      h2 a {
        color: inherit;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      h2 a ha-icon {
        --mdc-icon-size: 24px;
        color: var(--kh-text-2);
      }
      .stack {
        display: grid;
        gap: var(--kh-gap);
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--kh-gap);
      }
      .energy {
        padding: 14px 16px 10px;
      }
      .plan {
        padding: 6px;
        overflow: hidden;
      }
      /* Light pills (the whole pill dims): two per row, never narrower than 150 px. */
      .lights {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        --pill-radius: var(--kh-radius);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
  }

  private heading(label: string, path?: string) {
    return html`<h2>
      ${path
        ? html`<a href=${`${this.prefix}/${path}`}>${label}<ha-icon icon="mdi:chevron-right"></ha-icon></a>`
        : label}
    </h2>`;
  }

  private favorite(f: Favorite) {
    switch (f.type) {
      case "battery":
        return html`<kh-battery .spec=${f}></kh-battery>`;
      case "jellyfin":
        return html`<kh-jellyfin></kh-jellyfin>`;
      case "calendar":
        return html`<kh-calendar .spec=${f}></kh-calendar>`;
      case "thermometer":
        return html`<kh-thermometer .spec=${f}></kh-thermometer>`;
      case "automation":
        return html`<kh-automation .spec=${f}></kh-automation>`;
      case "computers":
        return html`<div class="pair">
          ${config.home.computers.map(
            (c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`,
          )}
        </div>`;
    }
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const person = currentPerson(hass)?.replace("person.", "");
    const favorites = (person && config.people[person]?.favorites) || config.people.tablet?.favorites || [];
    const spotifyOn = !!h.spotify && isPlayerActive(h.spotify);
    const tvsOn = h.tvs.filter((id) => isPlayerActive(id));
    const lights = h.lights.filter((l) => hass.states[l.entity]);
    const rooms = this.variant === "bis" || this.variant === "ter" ? roomsFor(house(hass), (person && config.people[person]?.favoriteRooms) || []) : [];
    // Lights as swipeable pages of 6 (the old swipe-card): denser on every screen.
    const pages: (typeof lights)[] = [];
    for (let i = 0; i < lights.length; i += 6) pages.push(lights.slice(i, i + 6));

    const S = {
      media:
        spotifyOn || tvsOn.length
          ? html`<section>${this.heading("Media", "medias")}
              <div class="stack">
                ${spotifyOn ? html`<kh-media-card entity-id=${h.spotify!} kind="music" name="Spotify"></kh-media-card>` : nothing}
                ${tvsOn.map((id) => html`<kh-media-card entity-id=${id} kind="tv"></kh-media-card>`)}
              </div></section>`
          : nothing,
      favorites: favorites.length
        ? html`<section>${this.heading("Favoris")}<div class="stack">${favorites.map((f) => this.favorite(f))}</div></section>`
        : nothing,
      lights: html`<section>${this.heading("Lumières", "pieces")}
        <kh-swipe label="Lumières">
          ${pages.map(
            (pg) => html`<div class="lights">
              ${pg.map((l) => html`<kh-light-pill tinted entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh-light-pill>`)}
            </div>`,
          )}
        </kh-swipe></section>`,
      // Home: the compact card (one line of figures and the graph), the details on the Énergie page.
      energy: h.energy ? html`<section>${this.heading("Énergie", "energie")}<div class="card energy"><kh-energy-card compact></kh-energy-card></div></section>` : nothing,
      weather: html`<section>${this.heading("Météo", "meteo")}<kh-weather-card></kh-weather-card></section>`,
      news: h.stocks.some((s) => s.home)
        ? html`<section>${this.heading("News", "meteo")}
            <div class="stack">${h.stocks.filter((s) => s.home).map((s) => html`<kh-stock entity-id=${s.entity} name=${s.name}></kh-stock>`)}</div></section>`
        : nothing,
      others: html`<section>${this.heading("Autres")}<kh-others></kh-others></section>`,
      // V1 bis only: the plan (2D / 3D) on the home page, and each room's temperature.
      plan: html`<section>${this.heading("Plan", "pieces")}<div class="card plan"><kh-floorplan ?landscape=${this.variant === "bis"} .rooms=${rooms} prefix=${this.prefix}></kh-floorplan></div></section>`,
      climate: rooms.some((r) => r.temperature)
        ? html`<section>${this.heading("Températures", "meteo")}
            <div class="pair">
              ${rooms
                .filter((r) => r.temperature)
                .map((r) => html`<kh-thermometer .spec=${{ type: "thermometer", name: r.name, temperature: r.temperature!, humidity: r.humidity }}></kh-thermometer>`)}
            </div></section>`
        : nothing,
    };
    // Independent column stacks of about the same height: no row alignment, so no holes.
    const layout: (keyof typeof S)[][] =
      this.variant === "bis" || this.variant === "ter"
        ? this.columns >= 3
          ? [["plan", "media"], ["energy", "favorites", "news"], ["weather", "lights", "climate", "others"]]
          : this.columns === 2
            ? [["plan", "media", "energy", "favorites"], ["weather", "lights", "climate", "news", "others"]]
            : [["plan", "media", "lights", "favorites", "energy", "weather", "climate", "news", "others"]]
        : this.columns >= 3
          ? [["media", "favorites"], ["lights", "energy"], ["weather", "news", "others"]]
          : this.columns === 2
            ? [["media", "favorites", "lights", "energy"], ["weather", "news", "others"]]
            : [["media", "favorites", "lights", "energy", "weather", "news", "others"]];

    const col = (keys: (keyof typeof S)[]) => html`<div class="col">${keys.map((k) => S[k])}</div>`;
    if (this.variant === "ter" && this.columns >= 2) {
      // The plan across two columns, the other cards in two stacks below it.
      const three = this.columns >= 3;
      return html`
        <kh-hero .mapHref=${`${this.prefix}/pieces`}></kh-hero>
        <div class="cols" style="--n:${three ? 3 : 2}">
          <div class="wide">
            ${S.plan}
            <div class="cols" style="--n:2">
              ${col(three ? ["media", "favorites"] : ["media", "favorites", "energy"])}
              ${col(three ? ["energy", "news"] : ["weather", "lights", "climate", "news", "others"])}
            </div>
          </div>
          ${three ? col(["weather", "lights", "climate", "others"]) : nothing}
        </div>
      `;
    }
    return html`
      <kh-hero .mapHref=${`${this.prefix}/pieces`}></kh-hero>
      <div class="cols" style="--n:${layout.length}">
        ${layout.map((col) => html`<div class="col">${col.map((k) => S[k])}</div>`)}
      </div>
    `;
  }
}
customElements.define("kh-home-view", KhHomeView);
