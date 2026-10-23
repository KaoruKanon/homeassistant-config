import { LitElement, css, html, nothing } from "lit";
import { media, muteToggle, remoteApp, remoteKey } from "../actions.ts";
import { config } from "../config.ts";
import { stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

// Android TV package names of common apps, for a readable "Sur ..." line.
const APP_NAMES: [RegExp, string][] = [
  [/tf1/, "TF1+"], [/youtube/, "YouTube"], [/netflix/, "Netflix"], [/disney/, "Disney+"], [/canal/, "Canal+"],
  [/amazon|primevideo/, "Prime Video"], [/spotify/, "Spotify"], [/apple/, "Apple TV"], [/francetv|france\.tv/, "france.tv"],
  [/m6|6play/, "M6+"], [/arte/, "Arte"], [/plex/, "Plex"], [/jellyfin/, "Jellyfin"], [/bouygues|bbox|launcher/, "Accueil"],
];
const appName = (activity: string) => APP_NAMES.find(([re]) => re.test(activity.toLowerCase()))?.[1] ?? activity.split(".").pop() ?? activity;

const REPEAT_AFTER_MS = 420;
const REPEAT_EVERY_MS = 160;

/**
 * TV box remote, as on the old Appareil view: power and volume, a D-pad
 * (holding an arrow repeats it), Back / Home, and app launchers.
 */
export class KhBoxRemote extends LitElement {
  private repeat?: number;
  private delay?: number;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const b = config.media.box;
      return b ? [b.player, b.remote] : [];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .card {
        padding: 14px;
        display: grid;
        gap: 16px;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .head > div {
        flex: 1;
        min-width: 0;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      .btn {
        flex: 1;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
      }
      .pad {
        justify-self: center;
        display: grid;
        grid-template-columns: repeat(3, 64px);
        grid-template-rows: repeat(3, 64px);
        gap: 8px;
        touch-action: manipulation;
      }
      .pad button {
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: var(--kh-card-2);
      }
      .pad .ok {
        border-radius: 50%;
        background: rgba(var(--rgb-blue), 0.25);
        color: rgb(var(--rgb-blue));
        font-weight: 800;
      }
      .pad .corner {
        background: transparent;
        color: var(--kh-text-2);
      }
      .apps {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .app {
        display: grid;
        justify-items: center;
        gap: 4px;
        padding: 10px 4px;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
        font-size: 0.75rem;
        font-weight: 700;
      }
      .app ha-icon {
        --mdc-icon-size: 28px;
        color: rgb(var(--rgb));
      }
      .app.current {
        background: rgba(var(--rgb), 0.22);
        box-shadow: inset 0 0 0 2px rgba(var(--rgb), 0.6);
      }
    `,
  ];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stop();
  }

  private stop = (): void => {
    window.clearTimeout(this.delay);
    window.clearInterval(this.repeat);
  };

  /** Press = one key; hold = the key repeats until release. */
  private key(command: string, icon: string, label: string, cls = "") {
    const remote = config.media.box!.remote;
    const start = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.stop();
      remoteKey(remote, command);
      this.delay = window.setTimeout(() => {
        this.repeat = window.setInterval(() => remoteKey(remote, command), REPEAT_EVERY_MS);
      }, REPEAT_AFTER_MS);
    };
    return html`<button class=${cls} aria-label=${label} @pointerdown=${start} @pointerup=${this.stop} @pointerleave=${this.stop}
      @pointercancel=${this.stop} @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && remoteKey(remote, command)}>
      ${icon === "OK" ? "OK" : html`<ha-icon icon=${icon}></ha-icon>`}
    </button>`;
  }

  render() {
    const hass = store.hass;
    const b = config.media.box;
    if (!hass || !b) return nothing;
    const player = hass.states[b.player];
    const remote = hass.states[b.remote];
    const activity = (remote?.attributes.current_activity as string | undefined) ?? "";
    const on = remote?.state === "on" || (player && !["off", "unavailable", "standby"].includes(player.state));
    const current = b.apps.find((a) => activity && (activity === a.activity || activity.includes(a.name.toLowerCase().replace(" ", ""))));

    return html`<div class="card">
      <div class="head">
        <span class="shape ${on ? "on" : "off"}" style="--rgb: var(--rgb-blue)"><ha-icon icon="mdi:set-top-box"></ha-icon></span>
        <div>
          <div class="primary">Box Bouygues</div>
          <div class="secondary">${current ? `Sur ${current.name}` : activity ? `Sur ${appName(activity)}` : player ? stateLabel(hass, player) : ""}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn" aria-label="Allumer ou éteindre" @click=${() => media(b.player, on ? "turn_off" : "turn_on")}><ha-icon icon="mdi:power"></ha-icon></button>
        <button class="btn" aria-label="Baisser le volume" @click=${() => media(b.player, "volume_down")}><ha-icon icon="mdi:volume-minus"></ha-icon></button>
        <button class="btn" aria-label="Couper le son" @click=${() => muteToggle(b.player)}><ha-icon icon="mdi:volume-mute"></ha-icon></button>
        <button class="btn" aria-label="Monter le volume" @click=${() => media(b.player, "volume_up")}><ha-icon icon="mdi:volume-plus"></ha-icon></button>
        <button class="btn" aria-label="Lecture ou pause" @click=${() => media(b.player, "media_play_pause")}><ha-icon icon="mdi:play-pause"></ha-icon></button>
      </div>
      <div class="pad" role="group" aria-label="Croix directionnelle">
        ${this.key("BACK", "mdi:arrow-u-left-top", "Retour", "corner")}
        ${this.key("DPAD_UP", "mdi:chevron-up", "Haut")}
        ${this.key("HOME", "mdi:home-outline", "Accueil de la box", "corner")}
        ${this.key("DPAD_LEFT", "mdi:chevron-left", "Gauche")}
        ${this.key("DPAD_CENTER", "OK", "Valider", "ok")}
        ${this.key("DPAD_RIGHT", "mdi:chevron-right", "Droite")}
        <span></span>
        ${this.key("DPAD_DOWN", "mdi:chevron-down", "Bas")}
        <span></span>
      </div>
      <div class="apps">
        ${b.apps.map(
          (a) => html`<button class="app ${a === current ? "current" : ""}" style="--rgb: var(--rgb-${a.color})" @click=${() => remoteApp(b.remote, a.activity)}>
            <ha-icon icon=${a.icon}></ha-icon>${a.name}
          </button>`,
        )}
      </div>
    </div>`;
  }
}
customElements.define("kh-box-remote", KhBoxRemote);
