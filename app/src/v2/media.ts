import { LitElement, css, html, nothing } from "lit";
import "../components/box-remote.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/posters.ts";
import "../components/widgets.ts";
import { config } from "../config.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { head, hero, v2 } from "./styles.ts";

/** Médias: what plays first, the TV remote, then Jellyfin's latest additions. */
export class KhV2Media extends LitElement {
  static properties = { prefix: {} };
  declare prefix: string;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [config.home.spotify, ...config.home.tvs, ...config.media.speakers].filter((x): x is string => !!x));
  }

  static styles = [
    base,
    v2,
    css`
      .stack {
        display: grid;
        gap: 10px;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const m = config.media;
    const players = [h.spotify, ...h.tvs, ...m.speakers].filter((id): id is string => !!id && !!hass.states[id]);
    const playing = players.filter((id) => isPlayerActive(id));
    const card = (id: string) =>
      id === h.spotify
        ? html`<kh-media-card entity-id=${id} kind="music" name="Spotify"></kh-media-card>`
        : h.tvs.includes(id)
          ? html`<kh-media-card entity-id=${id} kind="tv"></kh-media-card>`
          : html`<kh-media-card entity-id=${id} kind="music" icon="mdi:speaker"></kh-media-card>`;
    const idle = players.filter((id) => !playing.includes(id));

    return html`
      ${hero(
        "purple",
        "mdi:play-circle",
        "Médias",
        playing.length ? (playing.length === 1 ? "1 lecture" : `${playing.length} lectures`) : "Rien ne joue",
        playing.length ? playing.map((id) => (id === h.spotify ? "Spotify" : entityName(hass, id, config))).join(", ") : "Spotify, télévisions, enceintes et Jellyfin",
        m.box
          ? html`<button class="chip" @click=${() => this.renderRoot.querySelector("#remote")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <ha-icon icon="mdi:remote-tv"></ha-icon>Télécommande</button>`
          : nothing,
      )}
      <div class="bento">
        <div class="col" style="--w: 7; --w6: 6; --w2: 2">
          ${playing.length
            ? html`<section class="tile" style="--tint: var(--rgb-purple); --w: 7; --w6: 6; --w2: 2">
                ${head("mdi:play-circle", "En lecture")}
                <div class="stack">${playing.map(card)}</div>
              </section>`
            : html`<section class="tile flush" style="--w: 7; --w6: 6; --w2: 2"><kh-jellyfin></kh-jellyfin></section>`}
          ${idle.length
            ? html`<section class="tile" style="--tint: var(--rgb-indigo); --w: 7; --w6: 6; --w2: 2">
                ${head("mdi:speaker-multiple", "Lecteurs")}
                <div class="stack">${idle.map(card)}</div>
              </section>`
            : nothing}
        </div>
        ${m.box
          ? html`<section class="tile" id="remote" style="--tint: var(--rgb-blue); --w: 5; --w6: 6; --w2: 2">
              ${head("mdi:remote-tv", "Box TV")}
              <kh-box-remote></kh-box-remote>
            </section>`
          : nothing}
        ${m.jellyfin.map(
          (j) => html`<section class="tile" style="--tint: var(--rgb-jellyfin); --w: 12; --w6: 6; --w2: 2">
            ${head("mdi:filmstrip-box-multiple", `Ajoutés récemment : ${j.title.toLowerCase()}`)}
            <kh-posters entity-id=${j.entity}></kh-posters>
          </section>`,
        )}
      </div>
    `;
  }
}
customElements.define("kh-v2-media", KhV2Media);
