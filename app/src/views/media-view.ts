import { LitElement, css, html, nothing } from "lit";
import "../components/box-remote.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/posters.ts";
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

  static styles = [base, pageStyles, css``];

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
        <div>
          ${h.spotify ? html`<h2>Spotify</h2><kh-media-card entity-id=${h.spotify} kind="music" name="Spotify"></kh-media-card>` : nothing}
          <h2>Télévisions</h2>
          <div class="stack">${h.tvs.map((id) => html`<kh-media-card entity-id=${id} kind="tv"></kh-media-card>`)}</div>
          ${m.speakers.length
            ? html`<h2>Enceintes</h2>
                <div class="stack">
                  ${m.speakers.map((id) => html`<kh-media-card entity-id=${id} kind="music" icon="mdi:speaker"></kh-media-card>`)}
                </div>`
            : nothing}
        </div>
        <div>${m.box ? html`<h2>Box TV</h2><kh-box-remote></kh-box-remote>` : nothing}</div>
      </div>
      ${m.jellyfin.map((j) => html`<h2>Ajoutés récemment : ${j.title.toLowerCase()}</h2><kh-posters entity-id=${j.entity}></kh-posters>`)}
    `;
  }
}
customElements.define("kh-media-view", KhMediaView);
