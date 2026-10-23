import { LitElement, css, html, nothing } from "lit";
import { media, muteToggle, openMoreInfo, setVolume, type MediaCommand } from "../actions.ts";
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
      .cover {
        position: absolute;
        inset: 0;
        z-index: -1;
        background-size: cover;
        background-position: center;
      }
      .cover::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgb(20 22 24 / 0.92) 0%, rgb(20 22 24 / 0.7) 55%, rgb(20 22 24 / 0.35) 100%);
      }
      .card.has-cover {
        color: #fff;
        --kh-text-2: rgb(255 255 255 / 0.75);
        min-height: 150px;
        align-content: space-between;
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
      .has-cover .btn {
        background: rgb(255 255 255 / 0.14);
        backdrop-filter: blur(6px);
      }
      .btn.narrow {
        flex: 0 0 52px;
      }
      .progress {
        height: 4px;
        border-radius: 2px;
        background: rgb(255 255 255 / 0.25);
        overflow: hidden;
      }
      .progress span {
        display: block;
        height: 100%;
        background: rgb(var(--rgb-spotify));
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
    return html`<div class="progress" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <span style="width:${pct}%"></span>
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
    return html`
      <div class="card ${cover ? "has-cover" : ""}" style="--rgb: var(--rgb-${this.icon ? "blue" : "spotify"})">
        ${cover ? html`<div class="cover" style="background-image:url('${cover}')"></div>` : nothing}
        <button class="head" @click=${() => openMoreInfo(this, this.entityId)}>
          <span class="shape ${playing ? "playing" : isPlayerActive(this.entityId) ? "" : "off"}"><ha-icon icon=${this.icon ?? "mdi:spotify"}></ha-icon></span>
          <div>
            <div class="primary ellipsis">${title}</div>
            <div class="secondary ellipsis">${artist || stateLabel(hass, s)}</div>
          </div>
        </button>
        ${this.progress()}
        <div class="row">
          ${this.btn("mdi:skip-previous", "Piste précédente", "media_previous_track")}
          ${this.btn(playing ? "mdi:pause" : "mdi:play", playing ? "Pause" : "Lecture", "media_play_pause")}
          ${this.btn("mdi:skip-next", "Piste suivante", "media_next_track")}
        </div>
        ${typeof a.volume_level === "number"
          ? html`<div class="row">
              <ha-icon icon="mdi:volume-high" aria-hidden="true"></ha-icon>
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(Math.round(a.volume_level * 100))}
                aria-label="Volume"
                @change=${(e: Event) => setVolume(this.entityId, Number((e.target as HTMLInputElement).value) / 100)}
              />
            </div>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-media-card", KhMediaCard);
