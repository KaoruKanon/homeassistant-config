import { LitElement, css, html, nothing } from "lit";
import { config } from "./config.ts";
import { setProtectedEntities } from "./actions.ts";
import { cancelConfirmation } from "./components/confirm-dialog.ts";
import { buildHouse, currentPerson, roomsFor, type HouseModel } from "./rooms.ts";
import { RegistryController, store } from "./store.ts";
import { base, tokens } from "./styles.ts";
import type { HomeAssistant, PanelRoute } from "./types.ts";
import "./views/home-view.ts";
import "./views/room-view.ts";
import "./views/rooms-view.ts";
import "./views/soon-view.ts";

const TRANSLATED_DOMAINS = ["weather", "light", "switch", "fan", "media_player", "binary_sensor", "person", "automation"];

/** Main navigation, by theme. Pages not rebuilt yet point to the old dashboard. */
const NAV = [
  { path: "", label: "Accueil", icon: "mdi:home" },
  { path: "pieces", label: "Maison", icon: "mdi:floor-plan" },
  { path: "medias", label: "Médias", icon: "mdi:play-box-multiple-outline" },
  { path: "meteo", label: "Météo", icon: "mdi:weather-partly-cloudy" },
  { path: "energie", label: "Énergie", icon: "mdi:lightning-bolt-outline" },
  { path: "systeme", label: "Système", icon: "mdi:cog-outline" },
];

/**
 * The panel element Home Assistant creates for `panel_custom: name: kaoru-home`.
 * It receives a new `hass` on every state change of the house; that object
 * goes to the store, and only the affected components re-render.
 */
class KaoruHomePanel extends LitElement {
  static properties = {
    narrow: { type: Boolean },
    route: { attribute: false },
  };
  declare narrow: boolean;
  declare route?: PanelRoute;

  private model?: HouseModel;
  private modelKey: unknown[] = [];

  constructor() {
    super();
    new RegistryController(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelConfirmation(); // a question left open must not be answered later
  }

  set hass(hass: HomeAssistant) {
    const first = !store.hass;
    store.set(hass);
    // State labels ("Pluie", "Allumé"…) come from translations HA loads on demand.
    if (first) hass.loadBackendTranslation?.("entity_component", TRANSLATED_DOMAINS);
  }

  get hass(): HomeAssistant | undefined {
    return store.hass;
  }

  static styles = [
    tokens,
    base,
    css`
      :host {
        display: block;
        min-height: 100%;
        background: var(--kh-bg);
        background-attachment: fixed;
        container: kh / inline-size;
      }
      .shell {
        min-height: 100vh;
        min-height: 100dvh;
      }
      main {
        box-sizing: border-box;
        padding: max(12px, env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
        max-width: 1600px;
        margin: 0 auto;
      }
      /* Phone: floating bar at the bottom, as on the old dashboard. */
      nav.bar {
        position: fixed;
        z-index: 2;
        left: 12px;
        right: 12px;
        bottom: max(12px, env(safe-area-inset-bottom));
        display: flex;
        justify-content: space-around;
        padding: 8px;
        border-radius: 22px;
        background: rgb(60 64 68 / 0.55);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      :host(:not([dark])) nav.bar {
        background: rgb(255 255 255 / 0.7);
        box-shadow: 0 2px 12px rgb(0 0 0 / 0.12);
      }
      nav a,
      nav button {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--kh-text-2);
        text-decoration: none;
        background: var(--kh-card-2);
      }
      nav ha-icon {
        --mdc-icon-size: 24px;
      }
      nav a[aria-current="page"] {
        background: var(--kh-text);
        color: var(--kh-bg);
      }
      :host([dark]) nav a[aria-current="page"] {
        background: #f2f3f4;
        color: #1f2326;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      @container kh (min-width: 760px) {
        .shell {
          display: grid;
          grid-template-columns: 92px 1fr;
        }
        /* Tablet and PC: floating rail of icons on the left. */
        nav.bar {
          position: sticky;
          top: 24px;
          left: auto;
          right: auto;
          bottom: auto;
          margin: 24px 0 0 16px;
          align-self: start;
          flex-direction: column;
          gap: 10px;
          padding: 10px;
          width: 52px;
          justify-content: flex-start;
        }
        nav a,
        nav button {
          width: 52px;
          height: 52px;
        }
        main {
          padding: 24px 32px 48px 20px;
          margin: 0;
          width: 100%;
        }
      }
    `,
  ];

  /** Rebuilds the house model only when the registry changed. */
  private house(hass: HomeAssistant): HouseModel {
    // States count too: after an HA restart the registry arrives before all states.
    const key = [hass.entities, hass.devices, hass.areas, Object.keys(hass.states).length];
    if (!this.model || key.some((k, i) => k !== this.modelKey[i])) {
      this.model = buildHouse(hass, config);
      setProtectedEntities(this.model.protected);
      this.modelKey = key;
    }
    return this.model;
  }

  private navigate(e: MouseEvent): void {
    const a = (e.composedPath() as HTMLElement[]).find((el) => el instanceof HTMLAnchorElement) as
      | HTMLAnchorElement
      | undefined;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href);
    const prefix = this.route?.prefix;
    if (url.origin !== location.origin || !prefix) return;
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return;
    e.preventDefault();
    history.pushState(null, "", url.pathname + location.search); // keeps ?as= previews
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  private toggleMenu(): void {
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  protected updated(): void {
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const model = this.house(hass);
    const person = currentPerson(hass)?.replace("person.", "");
    const rooms = roomsFor(model, (person && config.people[person]?.favoriteRooms) || []);
    const prefix = this.route?.prefix ?? "/maison";
    const [section = "", sub] = (this.route?.path ?? "").replace(/^\//, "").split("/");
    const room = section === "pieces" && sub ? rooms.find((r) => r.id === sub) : undefined;

    let page;
    if (section === "") page = html`<kh-home-view prefix=${prefix}></kh-home-view>`;
    else if (section === "pieces" && room)
      page = html`<kh-room-view .room=${room} .model=${model} .rooms=${rooms} prefix=${prefix}></kh-room-view>`;
    else if (section === "pieces") page = html`<kh-rooms-view .rooms=${rooms} prefix=${prefix}></kh-rooms-view>`;
    else page = html`<kh-soon-view section=${section}></kh-soon-view>`;

    return html`
      <div class="shell" @click=${this.navigate}>
        <nav class="bar" aria-label="Navigation">
          ${NAV.map(
            (n) => html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} aria-current=${n.path === section ? "page" : nothing} title=${n.label}>
              <ha-icon icon=${n.icon}></ha-icon><span class="sr">${n.label}</span>
            </a>`,
          )}
          ${this.narrow
            ? html`<button aria-label="Menu Home Assistant" @click=${this.toggleMenu}><ha-icon icon="mdi:menu"></ha-icon></button>`
            : nothing}
        </nav>
        <main>${page}</main>
      </div>
    `;
  }
}
customElements.define("kaoru-home", KaoruHomePanel);
