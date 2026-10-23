import { LitElement, css, html, nothing } from "lit";
import "../components/energy-card.ts";
import "../components/hero.ts";
import "../components/light-card.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Favorite } from "../config.ts";
import { currentPerson } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/**
 * The home view of the old dashboard, rebuilt: Media and Favoris, Lumières
 * and Énergie, Météo, News and Autres. Three columns on the wall tablet, two
 * on a small tablet, one on a phone.
 */
export class KhHomeView extends LitElement {
  static properties = { prefix: {} };
  declare prefix: string;

  constructor() {
    super();
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
        grid-template-columns: minmax(0, 1fr);
        gap: 8px 28px;
        align-items: start;
      }
      .col {
        display: grid;
        gap: 8px;
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
      /* Light cards: as many as fit, never narrower than 170 px. */
      .lights {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: var(--kh-gap);
      }
      /* Columns are never narrower than ~400 px: 1, 2 or 3 of them. */
      @container kh (min-width: 972px) {
        .cols {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .col.c3 {
          grid-column: 1 / -1;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 28px;
        }
        .col.c3 > .weather {
          grid-row: span 4;
        }
      }
      @container kh (min-width: 1400px) {
        .cols {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .col.c3 {
          grid-column: auto;
          grid-template-columns: minmax(0, 1fr);
        }
        .col.c3 > .weather {
          grid-row: auto;
        }
      }
    `,
  ];

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

    return html`
      <kh-hero .mapHref=${`${this.prefix}/pieces`}></kh-hero>
      <div class="cols">
        <div class="col c1">
          ${spotifyOn || tvsOn.length
            ? html`${this.heading("Media", "medias")}
                <div class="stack">
                  ${spotifyOn ? html`<kh-media-card entity-id=${h.spotify!} kind="music" name="Spotify"></kh-media-card>` : nothing}
                  ${tvsOn.map((id) => html`<kh-media-card entity-id=${id} kind="tv"></kh-media-card>`)}
                </div>`
            : nothing}
          ${favorites.length
            ? html`${this.heading("Favoris")}
                <div class="stack">${favorites.map((f) => this.favorite(f))}</div>`
            : nothing}
        </div>
        <div class="col c2">
          ${this.heading("Lumières", "pieces")}
          <div class="lights">
            ${h.lights
              .filter((l) => hass.states[l.entity])
              .map((l) => html`<kh-light-card entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh-light-card>`)}
          </div>
          ${h.energy ? html`${this.heading("Énergie", "energie")}<kh-energy-card></kh-energy-card>` : nothing}
        </div>
        <div class="col c3">
          <div class="weather">${this.heading("Météo", "meteo")}<kh-weather-card></kh-weather-card></div>
          ${h.stocks.some((s) => s.home)
            ? html`<div>
                ${this.heading("News", "meteo")}
                <div class="stack">${h.stocks.filter((s) => s.home).map((s) => html`<kh-stock entity-id=${s.entity} name=${s.name}></kh-stock>`)}</div>
              </div>`
            : nothing}
          <div>${this.heading("Autres")}<kh-others></kh-others></div>
        </div>
      </div>
    `;
  }
}
customElements.define("kh-home-view", KhHomeView);
