import { LitElement, css, html, nothing } from "lit";
import { config } from "./config.ts";
import { cancelConfirmation } from "./components/confirm-dialog.ts";
import { installPressFeedback } from "./components/gestures.ts";
import { closePopup, openPopup } from "./components/popup.ts";
import { keyed } from "lit/directives/keyed.js";
import { house } from "./house.ts";
import { currentPerson, roomsFor } from "./rooms.ts";
import { RegistryController, store } from "./store.ts";
import { base, tokens } from "./styles.ts";
import type { HomeAssistant, PanelRoute } from "./types.ts";
import "./views/home-view.ts";
import "./views/room-view.ts";
import "./views/rooms-view.ts";

const TRANSLATED_DOMAINS = ["weather", "light", "switch", "fan", "media_player", "binary_sensor", "person", "automation"];

/** Theme pages, loaded on first visit so the home view stays light. */
const PAGES: Record<string, { tag: string; load: () => Promise<unknown> }> = {
  medias: { tag: "kh-media-view", load: () => import("./views/media-view.ts") },
  meteo: { tag: "kh-weather-view", load: () => import("./views/weather-view.ts") },
  energie: { tag: "kh-energy-view", load: () => import("./views/energy-view.ts") },
  systeme: { tag: "kh-system-view", load: () => import("./views/system-view.ts") },
};

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

  constructor() {
    super();
    new RegistryController(this);
    adoptEarlyHass(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelConfirmation(); // a question left open must not be answered later
  }

  set hass(hass: HomeAssistant) {
    feed(hass);
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
        min-width: 0;
        box-sizing: border-box;
        padding: max(12px, env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
        max-width: 1600px;
        margin: 0 auto;
      }
      /* Phone: floating bar at the bottom, 5 roomy entries with labels. */
      nav.rail {
        display: none;
      }
      nav.bar {
        position: fixed;
        z-index: 2;
        left: 10px;
        right: 10px;
        bottom: max(10px, env(safe-area-inset-bottom));
        display: flex;
        padding: 6px 4px;
        border-radius: 24px;
        background: rgb(52 56 60 / 0.72);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
      }
      :host(:not([dark])) nav.bar {
        background: rgb(255 255 255 / 0.82);
        box-shadow: 0 4px 18px rgb(0 0 0 / 0.14);
      }
      nav.bar a,
      nav.bar button {
        flex: 1;
        min-width: 0;
        display: grid;
        justify-items: center;
        gap: 3px;
        padding: 4px 0 2px;
        color: var(--kh-text-2);
        text-decoration: none;
        font-size: 0.6875rem;
        font-weight: 700;
        background: none;
      }
      nav.bar .pill {
        width: 56px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        transition: background-color 250ms ease;
      }
      nav.bar a[aria-current="page"] {
        color: var(--kh-text);
      }
      nav.bar a[aria-current="page"] .pill {
        background: rgba(var(--rgb-blue), 0.3);
      }
      nav ha-icon {
        --mdc-icon-size: 24px;
      }
      /* Tablet and PC: floating rail of icons on the left. */
      nav.rail a,
      nav.rail button {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--kh-text-2);
        text-decoration: none;
        background: var(--kh-card-2);
      }
      nav.rail a[aria-current="page"] {
        background: var(--kh-text);
        color: var(--kh-bg);
      }
      :host([dark]) nav.rail a[aria-current="page"] {
        background: #f2f3f4;
        color: #1f2326;
      }
      .loading {
        height: 40vh;
      }
      .page {
        animation: kh-rise 320ms cubic-bezier(0.22, 1, 0.36, 1);
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
          grid-template-columns: 112px minmax(0, 1fr);
        }
        nav.bar {
          display: none;
        }
        nav.rail {
          position: sticky;
          top: 24px;
          margin: 24px 0 0 24px;
          align-self: start;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 10px;
          width: 52px;
          border-radius: 22px;
          background: var(--kh-card);
        }
        main {
          padding: 24px 24px 48px 0;
          margin: 0 auto;
          width: 100%;
        }
      }
    `,
  ];

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

  /** "Plus" on phones: the other pages and the HA menu, in a sheet. */
  private more(prefix: string): void {
    const go = (path: string) => {
      // Closing the sheet goes back one history step: navigate once that is done.
      window.addEventListener("popstate", () => goTo(`${prefix}/${path}`), { once: true });
      closePopup();
    };
    openPopup({
      title: "Plus",
      icon: "mdi:dots-horizontal-circle-outline",
      color: "blue",
      watch: [],
      body: () => html`
        ${MORE.map(
          (n) => html`<button class="row" @click=${() => go(n.path)}>
            <span class="shape" style="--rgb: var(--rgb-blue)"><ha-icon icon=${n.icon}></ha-icon></span>
            <div><div class="primary">${n.label}</div></div>
          </button>`,
        )}
        <button class="row" @click=${() => {
          closePopup();
          this.toggleMenu();
        }}>
          <span class="shape"><ha-icon icon="mdi:menu"></ha-icon></span>
          <div><div class="primary">Menu Home Assistant</div><div class="secondary">Paramètres, historique, carte…</div></div>
        </button>
      `,
    });
  }

  private toggleMenu(): void {
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  protected firstUpdated(): void {
    installPressFeedback(this.renderRoot as ShadowRoot);
  }

  protected updated(): void {
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const model = house(hass);
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
    else if (PAGES[section]) {
      const p = PAGES[section];
      if (customElements.get(p.tag)) page = staticPage(p.tag, model.power);
      else {
        p.load().then(() => this.requestUpdate());
        page = html`<div class="loading" aria-busy="true"></div>`;
      }
    } else page = html`<p>Page introuvable.</p>`;

    return html`
      <div class="shell" @click=${this.navigate}>
        <nav class="rail" aria-label="Navigation">
          ${NAV.map(
            (n) => html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} aria-current=${n.path === section ? "page" : nothing} title=${n.label}>
              <ha-icon icon=${n.icon}></ha-icon><span class="sr">${n.label}</span>
            </a>`,
          )}
          ${this.narrow
            ? html`<button aria-label="Menu Home Assistant" @click=${this.toggleMenu}><ha-icon icon="mdi:menu"></ha-icon></button>`
            : nothing}
        </nav>
        <nav class="bar" aria-label="Navigation">
          ${BAR.map(
            (n) => html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} aria-current=${n.path === section ? "page" : nothing}>
              <span class="pill"><ha-icon icon=${n.icon}></ha-icon></span>${n.label}
            </a>`,
          )}
          <button aria-haspopup="dialog" @click=${() => this.more(prefix)}>
            <span class="pill" style=${MORE.some((n) => n.path === section) ? "background: rgba(var(--rgb-blue), 0.3)" : ""}>
              <ha-icon icon="mdi:dots-horizontal-circle-outline"></ha-icon>
            </span>Plus
          </button>
        </nav>
        <main>${keyed(section, html`<div class="page">${page}</div>`)}</main>
      </div>
    `;
  }
}
customElements.define("kaoru-home", KaoruHomePanel);

/**
 * The "Maison V2" panel (`panel_custom: name: kaoru-home-v2`): a separate app
 * under src/v2, downloaded the first time it is opened so V1 never pays for it.
 */
class KaoruHomeV2Panel extends LitElement {
  static properties = { narrow: { type: Boolean }, route: { attribute: false }, ready: { state: true } };
  declare narrow: boolean;
  declare route?: PanelRoute;
  declare ready: boolean;

  constructor() {
    super();
    this.ready = false;
    adoptEarlyHass(this);
    import("./v2/app.ts").then(() => (this.ready = true));
  }

  set hass(hass: HomeAssistant) {
    const first = !store.hass;
    feed(hass);
    if (first) this.requestUpdate(); // the app itself watches the store
  }

  get hass(): HomeAssistant | undefined {
    return store.hass;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return this.ready && store.hass ? html`<kh-v2-app .narrow=${this.narrow} .route=${this.route}></kh-v2-app>` : nothing;
  }
}
customElements.define("kaoru-home-v2", KaoruHomeV2Panel);

/** Every new `hass` goes to the store; only the affected components re-render. */
function feed(hass: HomeAssistant): void {
  const first = !store.hass;
  store.set(hass);
  // State labels ("Pluie", "Allumé"…) come from translations HA loads on demand.
  if (first) hass.loadBackendTranslation?.("entity_component", TRANSLATED_DOMAINS);
}

/**
 * HA may set `hass` before the loader has defined the panel element: the
 * value then sits on the instance and hides the setter. Re-apply it.
 */
function adoptEarlyHass(el: { hass?: HomeAssistant }): void {
  if (Object.prototype.hasOwnProperty.call(el, "hass")) {
    const early = el.hass!;
    delete el.hass;
    el.hass = early;
  }
}

/** Navigates inside the panel (HA's router listens to location-changed). */
function goTo(path: string): void {
  history.pushState(null, "", path + location.search);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

/** Phone bar: four pages and "Plus"; the rest open from "Plus". */
const BAR = NAV.filter((n) => ["", "pieces", "medias", "meteo"].includes(n.path));
const MORE = NAV.filter((n) => !BAR.includes(n));

/** Renders a lazily defined page element by tag name. */
function staticPage(tag: string, power: Record<string, string>) {
  const el = document.createElement(tag) as HTMLElement & { power?: Record<string, string> };
  el.power = power;
  return el;
}
