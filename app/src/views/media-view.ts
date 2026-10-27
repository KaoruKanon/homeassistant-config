import { LitElement, css, html, nothing } from "lit";
import "../components/box-remote.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/posters.ts";
import "../components/widgets.ts";
import { config } from "../config.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { pageHead, pageStyles } from "./page.ts";

/** Médias: Spotify, TVs, the box remote, speakers, Jellyfin. */
export class KhMediaView extends LitElement {
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [config.home.spotify, ...config.home.tvs, ...config.media.speakers].filter((x): x is string => !!x));
  }

  static styles = [
    base,
    pageStyles,
    css`
      .posters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--kh-gap);
      }
      @container kh (max-width: 759px) {
        .posters {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const m = config.media;
    const playing = [h.spotify, ...h.tvs, ...m.speakers].filter((id): id is string => !!id && isPlayerActive(id));
    const sub = playing.length
      ? `${playing.length === 1 ? "1 lecteur actif" : `${playing.length} lecteurs actifs`}`
      : "Rien ne joue";
    return html`
      ${pageHead("mdi:play-box-multiple-outline", "blue", "Médias", sub)}
      <div class="cols">
        <!-- Music and what Jellyfin added on one side, the TVs and their remote on the other: two columns of about the same height. -->
        <div>
          ${h.spotify ? html`<h2>Spotify</h2><kh-media-card entity-id=${h.spotify} kind="music" name="Spotify"></kh-media-card>` : nothing}
          ${m.speakers.length
            ? html`<h2>Enceintes</h2>
                <div class="stack">
                  ${m.speakers.map((id) => html`<kh-media-card entity-id=${id} kind="music" icon="mdi:speaker"></kh-media-card>`)}
                </div>`
            : nothing}
          ${h.jellyfin ? html`<h2>Ajouté sur Jellyfin</h2><kh-jellyfin></kh-jellyfin>` : nothing}
        </div>
        <div>
          <h2>Télévisions</h2>
          <div class="stack">${h.tvs.map((id) => html`<kh-media-card entity-id=${id} kind="tv"></kh-media-card>`)}</div>
          ${m.box ? html`<h2>Box TV</h2><kh-box-remote></kh-box-remote>` : nothing}
        </div>
      </div>
      <!-- Films and series side by side (one under the other on a phone). -->
      <div class="posters">
        ${m.jellyfin.map((j) => html`<div><h2>Ajoutés récemment : ${j.title.toLowerCase()}</h2><kh-posters entity-id=${j.entity}></kh-posters></div>`)}
      </div>
    `;
  }
}
customElements.define("kh-media-view", KhMediaView);
