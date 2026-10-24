import { LitElement, css, html, nothing } from "lit";
import { media, muteToggle, openMoreInfo, type MediaCommand } from "../actions.ts";
import { stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const IDLE = new Set(["off", "idle", "standby", "unavailable", "unknown"]);

/** Whether a player is worth showing on the home view. */
export function isPlayerActive(entityId: string): boolean {
  const s = store.get(entityId);
  return !!s && !IDLE.has(s.state);
}

/**
 * A media player: Spotify-like players get their cover art as background, a
 * progress bar and transport buttons; TVs get power and volume.
 */
export class KhMediaCard extends LitElement {
  static properties = { entityId: { attribute: "entity-id" }, name: {}, kind: {}, icon: {}, now: { state: true } };
  declare entityId: string;
  declare name?: string;
  /** "music" (cover, transport) or "tv" (power, volume) */
  declare kind: "music" | "tv";
  /** Icon of a music player that is not Spotify (e.g. a speaker). */
  declare icon?: string;
  declare now: number;
  private tick?: number;

  constructor() {
    super();
    this.kind = "music";
    this.now = Date.now();
    new RegistryController(this);
    new EntitiesController(this, () => [this.entityId]);
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .card {
        position: relative;
        overflow: hidden;
        padding: 12px;
        display: grid;
        gap: 12px;
        isolation: isolate;
      }
      /* Music: the album art on the right of the card, fading in from the left
         (the old Lovelace Spotify card), the text and controls on the left. */
      .art {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(260px, 60%);
        z-index: -1;
        background-size: cover;
        background-position: center;
        -webkit-mask-image: linear-gradient(to right, transparent, black 70%);
        mask-image: linear-gradient(to right, transparent, black 70%);
      }
      .card.music {
        background: var(--kh-card);
      }
      .card.music .head .primary,
      .card.music .head .secondary {
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        text-align: left;
      }
      .head > div {
        min-width: 0;
      }
      .shape.playing ha-icon {
        animation: kh-shake 1.2s ease-in-out infinite;
      }
      .shape.tv-on {
        animation: kh-blink 2.4s ease-in-out infinite;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      .btn {
        flex: 1;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
      }
      .card.music {
        grid-template-columns: minmax(0, 1fr);
      }
      /* The keys share the width (up to 52 px each), so the card never grows. */
      .music .btn {
        flex: 1 1 0;
        min-width: 0;
        max-width: 52px;
        background: rgb(74 74 74 / 0.7);
        color: #fff;
      }
      .music .controls {
        display: flex;
        gap: 8px;
      }
      .music .shape {
        background: var(--kh-card-2);
        color: rgb(30, 215, 96);
      }
      .btn.narrow {
        flex: 0 0 52px;
      }
      /* The thick progress bar of the old mini-media-player. */
      .progress {
        position: relative;
        height: 42px;
        border-radius: var(--kh-radius-icon);
        background: rgba(30, 215, 96, 0.2);
        overflow: hidden;
      }
      .progress.paused {
        background: rgb(74 74 74 / 0.7);
      }
      .progress .fill {
        display: block;
        height: 100%;
        background: rgb(30, 215, 96);
        transition: width 1s linear;
      }
      .progress.paused .fill {
        background: rgb(255 255 255 / 0.55);
      }
      .progress .time {
        position: absolute;
        inset: 0 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8125rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: #fff;
        text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
      }
      input[type="range"] {
        flex: 1;
        min-width: 0;
        accent-color: rgb(var(--rgb, var(--rgb-blue)));
      }
    `,
  ];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.tick);
    this.tick = undefined;
  }

  protected updated(): void {
    // A 1 s clock only while music plays, for the progress bar.
    const playing = store.get(this.entityId)?.state === "playing" && this.kind === "music";
    if (playing && !this.tick) this.tick = window.setInterval(() => (this.now = Date.now()), 1000);
    if (!playing && this.tick) {
      window.clearInterval(this.tick);
      this.tick = undefined;
    }
  }

  private btn(icon: string, label: string, command: MediaCommand, narrow = false) {
    return html`<button class="btn ${narrow ? "narrow" : ""}" aria-label=${label} @click=${() => media(this.entityId, command)}>
      <ha-icon icon=${icon}></ha-icon>
    </button>`;
  }

  private progress() {
    const a = store.get(this.entityId)?.attributes ?? {};
    const duration = Number(a.media_duration);
    const position = Number(a.media_position);
    if (!duration || isNaN(position)) return nothing;
    const updated = Date.parse(a.media_position_updated_at ?? "") || this.now;
    const live = store.get(this.entityId)?.state === "playing" ? (this.now - updated) / 1000 : 0;
    const pct = Math.min(100, ((position + live) / duration) * 100);
    const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
    const paused = store.get(this.entityId)?.state !== "playing";
    return html`<div class="progress ${paused ? "paused" : ""}" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <span class="fill" style="width:${pct}%"></span>
      <span class="time"><span>${fmt(Math.min(duration, position + live))}</span><span>${fmt(duration)}</span></span>
    </div>`;
  }

  render() {
    const hass = store.hass;
    const s = store.get(this.entityId);
    if (!hass || !s) return nothing;
    const a = s.attributes;
    const name = this.name ?? a.friendly_name;

    if (this.kind === "tv") {
      const on = isPlayerActive(this.entityId);
      return html`
        <div class="card" style="--rgb: var(--rgb-blue)">
          <button class="head" @click=${() => openMoreInfo(this, this.entityId)}>
            <span class="shape ${on ? "tv-on" : "off"}"><ha-icon icon="mdi:television"></ha-icon></span>
            <div>
              <div class="primary ellipsis">${name}</div>
              <div class="secondary">${a.source && on ? `${stateLabel(hass, s)}, ${a.source}` : stateLabel(hass, s)}</div>
            </div>
          </button>
          <div class="row">
            ${this.btn("mdi:power", on ? `Éteindre ${name}` : `Allumer ${name}`, on ? "turn_off" : "turn_on")}
            ${on
              ? html`${this.btn("mdi:volume-minus", "Baisser le volume", "volume_down", true)}
                  <button class="btn narrow" aria-label=${a.is_volume_muted ? "Rétablir le son" : "Couper le son"} @click=${() => muteToggle(this.entityId)}>
                    <ha-icon icon=${a.is_volume_muted ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
                  </button>
                  ${this.btn("mdi:volume-plus", "Monter le volume", "volume_up", true)}`
              : nothing}
          </div>
        </div>
      `;
    }

    const playing = s.state === "playing";
    const cover = a.entity_picture as string | undefined;
    const title = a.media_title ?? name;
    // Idle: the player's name; playing: the track (name stays in the icon tooltip).
    const artist = [a.media_artist, a.media_album_name].filter(Boolean).join(", ");
    const vol = typeof a.volume_level === "number" ? Math.round(a.volume_level * 100) : undefined;
    return html`
      <div class="card music" style="--rgb: var(--rgb-${this.icon ? "blue" : "spotify"})">
        ${cover ? html`<div class="art" style="background-image:url('${cover}')"></div>` : nothing}
        <button class="head" @click=${() => openMoreInfo(this, this.entityId)}>
          <span class="shape ${playing ? "playing" : isPlayerActive(this.entityId) ? "" : "off"}"><ha-icon icon=${this.icon ?? "mdi:spotify"}></ha-icon></span>
          <div>
            <div class="primary ellipsis">${title}</div>
            <div class="secondary ellipsis">${artist || stateLabel(hass, s)}</div>
          </div>
        </button>
        <div class="controls">
          ${this.btn(playing ? "mdi:pause" : "mdi:play", playing ? "Pause" : "Lecture", "media_play_pause")}
          ${this.btn("mdi:skip-previous", "Piste précédente", "media_previous_track")}
          ${this.btn("mdi:skip-next", "Piste suivante", "media_next_track")}
          ${vol !== undefined
            ? html`${this.btn("mdi:volume-minus", "Baisser le volume", "volume_down")}
                ${this.btn("mdi:volume-plus", "Monter le volume", "volume_up")}`
            : nothing}
        </div>
        ${this.progress()}
      </div>
    `;
  }
}
customElements.define("kh-media-card", KhMediaCard);
