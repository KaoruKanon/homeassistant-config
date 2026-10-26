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
        container-type: inline-size;
      }
      /* Condensed: name and keys on the left, the D-pad on the right, the
         apps as a row of round icons underneath. */
      .card {
        padding: 12px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: "head pad" "keys pad" "apps apps";
        gap: 10px 14px;
        align-items: start;
      }
      .head {
        grid-area: head;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .head > div {
        flex: 1;
        min-width: 0;
      }
      .keys {
        grid-area: keys;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .btn {
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--kh-card-2);
      }
      .btn.power.on {
        color: rgb(var(--rgb-red));
      }
      .pad {
        grid-area: pad;
        display: grid;
        grid-template-columns: repeat(3, 44px);
        grid-template-rows: repeat(3, 44px);
        gap: 4px;
        touch-action: manipulation;
      }
      .pad button {
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: var(--kh-card-2);
      }
      .pad .ok {
        border-radius: 50%;
        background: rgba(var(--rgb-blue), 0.25);
        color: rgb(var(--rgb-blue));
        font-weight: 800;
        font-size: 0.8125rem;
      }
      .apps {
        grid-area: apps;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .app {
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(var(--rgb), 0.16);
      }
      .app ha-icon {
        --mdc-icon-size: 22px;
        color: rgb(var(--rgb));
      }
      .app.current {
        box-shadow: 0 0 0 2px rgb(var(--rgb));
      }
      @container (max-width: 330px) {
        .card {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas: "head" "pad" "keys" "apps";
        }
        .pad {
          justify-self: center;
        }
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
      <div class="keys">
        <button class="btn power ${on ? "on" : ""}" aria-label="Allumer ou éteindre" @click=${() => media(b.player, on ? "turn_off" : "turn_on")}><ha-icon icon="mdi:power"></ha-icon></button>
        <button class="btn" aria-label="Baisser le volume" @click=${() => media(b.player, "volume_down")}><ha-icon icon="mdi:volume-minus"></ha-icon></button>
        <button class="btn" aria-label="Couper le son" @click=${() => muteToggle(b.player)}><ha-icon icon="mdi:volume-mute"></ha-icon></button>
        <button class="btn" aria-label="Monter le volume" @click=${() => media(b.player, "volume_up")}><ha-icon icon="mdi:volume-plus"></ha-icon></button>
        <button class="btn" aria-label="Lecture ou pause" @click=${() => media(b.player, "media_play_pause")}><ha-icon icon="mdi:play-pause"></ha-icon></button>
        ${this.key("BACK", "mdi:arrow-u-left-top", "Retour", "btn")}
        ${this.key("HOME", "mdi:home-outline", "Accueil de la box", "btn")}
      </div>
      <div class="pad" role="group" aria-label="Croix directionnelle">
        <span></span>
        ${this.key("DPAD_UP", "mdi:chevron-up", "Haut")}
        <span></span>
        ${this.key("DPAD_LEFT", "mdi:chevron-left", "Gauche")}
        ${this.key("DPAD_CENTER", "OK", "Valider", "ok")}
        ${this.key("DPAD_RIGHT", "mdi:chevron-right", "Droite")}
        <span></span>
        ${this.key("DPAD_DOWN", "mdi:chevron-down", "Bas")}
        <span></span>
      </div>
      <div class="apps">
        ${b.apps.map(
          (a) => html`<button class="app ${a === current ? "current" : ""}" style="--rgb: var(--rgb-${a.color})" title=${a.name} aria-label="Ouvrir ${a.name}"
            @click=${() => remoteApp(b.remote, a.activity)}>
            <ha-icon icon=${a.icon}></ha-icon>
          </button>`,
        )}
      </div>
    </div>`;
  }
}
customElements.define("kh-box-remote", KhBoxRemote);
