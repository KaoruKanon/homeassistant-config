import { LitElement, css, html, nothing } from "lit";
import { media, seek } from "../actions.ts";
import { config } from "../config.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, store } from "../store.ts";
import { icon } from "./icons.ts";
import { ui } from "./theme.ts";

const SPOTIFY = html`<svg viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="Spotify"><circle cx="12" cy="12" r="12" fill="#1ED760"></circle><path d="M6 9.2c4-1.2 8.6-.8 12 1.2M6.6 12.6c3.3-.9 7-.6 9.8 1M7.2 15.8c2.6-.7 5.4-.4 7.6.8" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

const mmss = (sec: number) => (isNaN(sec) ? "" : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`);

/**
 * The player card (after V1): the cover, square, sits on the right and fades
 * into the card; titles, timeline and buttons over it on the left. Its height
 * is set by its slot (fixed), its width follows the space.
 */
function playerBody(id: string) {
  const s = store.get(id);
  if (!s) return nothing;
  const a = s.attributes;
  const art = a.entity_picture as string | undefined;
  const dur = Number(a.media_duration), pos = Number(a.media_position);
  const updated = Date.parse(a.media_position_updated_at ?? "");
  const at = s.state === "playing" && !isNaN(updated) ? pos + (Date.now() - updated) / 1000 : pos;
  const progress = dur > 0 && !isNaN(at) ? Math.min(100, (at / dur) * 100) : 0;
  const where = [a.app_name ?? entityName(store.hass!, id, config), a.source].filter(Boolean).join(", ");
  const spotify = /spotify/i.test(`${id} ${a.app_name ?? ""}`);
  const brand = spotify ? "#1DB954" : "var(--violet)";
  const playing = s.state === "playing";
  return html`<div class="pl" style="--brand:${brand}">
    ${art ? html`<img class="pl-art" src=${art} alt="" width="300" height="300" decoding="async" />` : nothing}
    <div class="pl-body">
      <span class="st ell pl-src">${spotify ? SPOTIFY : nothing}${playing ? html`<span class="kh-eq" aria-hidden="true" style="color:${brand}"><i></i><i></i><i></i></span>` : nothing}${where}</span>
      <span class="num ell pl-title">${a.media_title}</span>
      <span class="ell pl-artist">${[a.media_artist, a.media_album_name].filter(Boolean).join(", ")}</span>
      <span class="pl-grow"></span>
      <span class="pl-bar" role="slider" tabindex="0" aria-label="Position dans le morceau" aria-valuemin="0" aria-valuemax=${Math.round(dur) || 0}
        aria-valuenow=${Math.round(at) || 0} aria-valuetext="${mmss(at)} sur ${mmss(dur)}"
        @pointerdown=${(e: PointerEvent) => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
        @pointerup=${(e: PointerEvent) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (dur > 0) void seek(id, ((e.clientX - r.left) / r.width) * dur);
        }}
        @keydown=${(e: KeyboardEvent) => {
          const d = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0;
          if (d && dur > 0) (e.preventDefault(), void seek(id, Math.min(dur, Math.max(0, at + d))));
        }}><i style="width:${progress}%"></i></span>
      <span class="st num pl-times"><span>${mmss(at)}</span><span>${mmss(dur)}</span></span>
      <span class="pl-grow"></span>
      <div class="pl-ctl">
        <button class="pl-b" aria-label="Précédent" @click=${() => media(id, "media_previous_track")}>${icon("prev", 18)}</button>
        <button class="pl-play" aria-label=${playing ? "Pause" : "Lecture"} @click=${() => media(id, "media_play_pause")}>${icon(playing ? "pause" : "play", 18)}</button>
        <button class="pl-b" aria-label="Suivant" @click=${() => media(id, "media_next_track")}>${icon("next", 18)}</button>
        <span class="pl-grow"></span>
        <button class="pl-b pl-vol" aria-label="Moins fort" @click=${() => media(id, "volume_down")}>${icon("minus", 18)}</button>
        <button class="pl-b pl-vol" aria-label="Plus fort" @click=${() => media(id, "volume_up")}>${icon("plus", 18)}</button>
      </div>
    </div>
  </div>`;
}

export const playerStyles = css`
  .pl {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
    border-radius: inherit;
    container-type: size;
    isolation: isolate;
  }
  /* Square cover, as tall as the card, fading into it from the left. */
  .pl-art {
    position: absolute;
    top: 0;
    right: 0;
    height: 100cqh;
    width: 100cqh;
    max-width: 62%;
    object-fit: cover;
    z-index: -1;
    /* Eased fade (many stops): no visible edge where the cover starts. */
    --fade: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.03) 10%, rgba(0, 0, 0, 0.1) 20%, rgba(0, 0, 0, 0.22) 30%,
      rgba(0, 0, 0, 0.38) 40%, rgba(0, 0, 0, 0.56) 50%, rgba(0, 0, 0, 0.73) 60%, rgba(0, 0, 0, 0.87) 70%, rgba(0, 0, 0, 0.96) 80%, #000 90%);
    -webkit-mask-image: var(--fade);
    mask-image: var(--fade);
  }
  .pl-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 12px 14px 10px;
    min-width: 0;
  }
  .pl-src {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 62%;
  }
  .pl-title {
    font-size: clamp(16px, 13cqh, 26px);
    font-weight: 700;
    line-height: 1.15;
    margin-top: 2px;
    max-width: 70%;
    text-shadow: 0 1px 8px var(--surf);
  }
  .pl-artist {
    font-size: 13px;
    color: var(--muted);
    max-width: 62%;
    text-shadow: 0 1px 8px var(--surf);
  }
  /* The free height splits evenly above and below the timeline. */
  .pl-grow {
    flex: 1;
    min-height: 8px;
  }
  .pl-bar {
    position: relative;
    display: block;
    height: 4px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--ink) 22%, transparent);
    cursor: pointer;
    touch-action: none;
  }
  .pl-bar::before {
    content: "";
    position: absolute;
    inset: -12px 0;
  }
  .pl-bar i {
    display: block;
    transition: width 1s linear;
    height: 100%;
    border-radius: 99px;
    background: var(--brand);
  }
  .pl-times {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-top: 3px;
  }
  .pl-ctl {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pl-b {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex: none;
    color: var(--ink);
    background: color-mix(in srgb, var(--surf) 70%, transparent);
  }
  .pl-play {
    width: 42px;
    height: 42px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    flex: none;
    background: var(--brand);
    color: #04120a;
  }
  /* Short cards: no times line; very narrow ones: no volume buttons. */
  @container (max-height: 150px) {
    .pl-times {
      display: none;
    }
    .pl-title {
      font-size: 17px;
    }
    .pl-b {
      width: 34px;
      height: 34px;
    }
    .pl-play {
      width: 38px;
      height: 38px;
    }
  }
  @container (max-width: 300px) {
    .pl-vol {
      display: none;
    }
  }
`;

/**
 * The player as its own element: while it plays it redraws itself every
 * second (timeline and times), without touching the rest of the page.
 */
class Kh3Player extends LitElement {
  static properties = { entity: {} };
  declare entity: string;
  private tick = 0;

  constructor() {
    super();
    new EntitiesController(this, () => (this.entity ? [this.entity] : []));
  }

  static styles = [
    ui,
    playerStyles,
    css`
      :host {
        display: block;
        flex: 1;
        width: 100%;
        min-width: 0;
        height: 100%;
        border-radius: inherit;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.tick = window.setInterval(() => store.get(this.entity)?.state === "playing" && this.requestUpdate(), 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.tick);
  }

  render() {
    return this.entity ? playerBody(this.entity) : nothing;
  }
}
customElements.define("kh3-player", Kh3Player);

/** The player card for a media player entity. */
export const playerCard = (id: string) => html`<kh3-player .entity=${id}></kh3-player>`;
