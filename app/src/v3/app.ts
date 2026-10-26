import { LitElement, css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { cancelConfirmation } from "../components/confirm-dialog.ts";
import { scrollToTop } from "../components/gestures.ts";
import { closePopup, openPopup } from "../components/popup.ts";
import { preloadPopups } from "../popups/open.ts";
import { config } from "../config.ts";
import { house } from "../house.ts";
import { currentPerson, roomsFor } from "../rooms.ts";
import { RegistryController, store } from "../store.ts";
import type { PanelRoute } from "../types.ts";
import "./home.ts";
import { isWall, loadFonts, theme, ui } from "./theme.ts";

/**
 * Pages after the home one, loaded on first visit. Until each gets its V3
 * version, the V2 page is shown inside the V3 shell (it reads the V3 tokens).
 */
const PAGES: Record<string, () => Promise<unknown>> = {
  pieces: () => Promise.all([import("../v2/rooms.ts"), import("../v2/room.ts")]),
  medias: () => import("../v2/media.ts"),
  meteo: () => import("../v2/weather.ts"),
  energie: () => import("../v2/energy.ts"),
  systeme: () => import("../v2/system.ts"),
};

/** Navigation: one colour per theme, shown on its entry when current. */
const NAV = [
  { path: "", label: "Accueil", icon: "mdi:home-variant-outline", active: "mdi:home-variant", color: "blue" },
  { path: "pieces", label: "Maison", icon: "mdi:floor-plan", active: "mdi:floor-plan", color: "amber" },
  { path: "medias", label: "Médias", icon: "mdi:play-circle-outline", active: "mdi:play-circle", color: "purple" },
  { path: "meteo", label: "Météo", icon: "mdi:weather-partly-cloudy", active: "mdi:weather-partly-cloudy", color: "light-blue" },
  { path: "energie", label: "Énergie", icon: "mdi:lightning-bolt-outline", active: "mdi:lightning-bolt", color: "orange" },
  { path: "systeme", label: "Système", icon: "mdi:cog-outline", active: "mdi:cog", color: "indigo" },
];
/** Phones: four entries and "Plus". */
const PHONE = ["", "pieces", "medias", "meteo"];

/**
 * Maison V3: its own panel and shell. A rail on the left (tablet, PC), a tab
 * bar at the bottom (phone); data, actions and popups shared with V1 and V2.
 */
export class Kh3App extends LitElement {
  static properties = { narrow: { type: Boolean }, route: { attribute: false }, phone: { state: true }, wall: { state: true } };
  declare narrow: boolean;
  declare route?: PanelRoute;
  declare phone: boolean;
  declare wall: boolean;
  private loaded = new Set<string>();
  private resize = new ResizeObserver(([e]) => this.layout(e.contentRect.width));

  constructor() {
    super();
    this.phone = false;
    this.wall = false;
    loadFonts();
    new RegistryController(this);
  }

  static styles = [
    theme,
    ui,
    css`
      :host {
        display: block;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--v3-bg);
        --rail: 84px;
      }
      /* The rail is a column of the panel, not fixed to the window: HA's own
         sidebar may sit on its left. */
      .shell {
        display: grid;
        grid-template-columns: var(--rail) minmax(0, 1fr);
        min-height: 100vh;
        min-height: 100dvh;
      }
      :host([phone]) .shell {
        display: block;
      }
      main {
        box-sizing: border-box;
        width: 100%;
        max-width: 1480px;
        margin: 0 auto;
        padding: max(20px, env(safe-area-inset-top)) 24px 32px;
      }
      :host([wall]) main {
        padding: 10px 12px;
        max-width: none;
      }
      :host([phone]) main {
        padding: max(12px, env(safe-area-inset-top)) 12px calc(88px + env(safe-area-inset-bottom));
      }
      .page {
        animation: settle 180ms ease-out;
      }
      @keyframes settle {
        from {
          opacity: 0.7;
        }
      }
      .loading {
        height: 40vh;
      }

      /* Rail: the six themes, icon over label, the current one in its colour. */
      nav.rail {
        position: sticky;
        z-index: 3;
        top: 0;
        height: 100vh;
        height: 100dvh;
        box-sizing: border-box;
        padding: max(16px, env(safe-area-inset-top)) 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: var(--v3-surface);
        box-shadow: inset -1px 0 0 var(--v3-line);
      }
      :host([wall]) nav.rail {
        justify-content: center;
        gap: 2px;
      }
      nav.rail .menu {
        margin-bottom: 8px;
      }
      nav.rail a,
      nav.rail button {
        display: grid;
        justify-items: center;
        gap: 3px;
        padding: 8px 0 7px;
        border-radius: 16px;
        color: var(--v3-muted);
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 500;
        --mdc-icon-size: 22px;
      }
      nav.rail a .pad {
        display: grid;
        place-items: center;
        width: 52px;
        height: 30px;
        border-radius: 15px;
        transition: background-color 200ms ease, color 200ms ease;
      }
      nav.rail a:hover .pad {
        background: var(--v3-well);
      }
      nav.rail [aria-current="page"] {
        color: var(--v3-text);
        font-weight: 600;
      }
      nav.rail [aria-current="page"] .pad {
        background: rgba(var(--c), 0.18);
        color: rgb(var(--c));
      }

      /* Tab bar on phones: full width, above the home indicator. */
      nav.tabs {
        position: fixed;
        z-index: 3;
        left: 0;
        right: 0;
        bottom: 0;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        padding: 6px 6px max(8px, env(safe-area-inset-bottom));
        background: var(--v3-veil);
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        box-shadow: inset 0 1px 0 var(--v3-line);
      }
      nav.tabs a,
      nav.tabs button {
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 6px 0 4px;
        color: var(--v3-muted);
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 500;
        --mdc-icon-size: 22px;
      }
      nav.tabs .pad {
        display: grid;
        place-items: center;
        width: 56px;
        height: 30px;
        border-radius: 15px;
      }
      nav.tabs [aria-current="page"] {
        color: var(--v3-text);
        font-weight: 600;
      }
      nav.tabs [aria-current="page"] .pad {
        background: rgba(var(--c), 0.2);
        color: rgb(var(--c));
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    // Decide the layout before the first render: nothing jumps once drawn.
    this.layout(this.getBoundingClientRect().width || window.innerWidth);
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
    cancelConfirmation();
  }

  private layout(width: number): void {
    this.phone = width < 680 && window.innerHeight >= window.innerWidth;
    this.wall = !this.phone && isWall(width);
  }

  protected firstUpdated(): void {
    this.prefetch();
  }

  /** Once the home is up and the browser idle, the other pages and popups load one by one. */
  private prefetch(): void {
    const idle = (f: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 200));
    const queue = Object.keys(PAGES);
    const next = (): void => {
      const section = queue.shift();
      if (!section) preloadPopups();
      else if (this.loaded.has(section)) idle(next);
      else PAGES[section]().then(() => (this.loaded.add(section), idle(next)), () => idle(next));
    };
    setTimeout(() => idle(next), 1500);
  }

  private lastPage?: string;

  protected updated(): void {
    const page = this.route?.path ?? "";
    if (this.lastPage !== undefined && page !== this.lastPage) scrollToTop(this);
    this.lastPage = page;
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
    this.toggleAttribute("wall", this.wall);
    this.toggleAttribute("phone", this.phone);
  }

  private navigate(e: MouseEvent): void {
    const a = (e.composedPath() as HTMLElement[]).find((el) => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href);
    const prefix = this.route?.prefix;
    if (url.origin !== location.origin || !prefix) return;
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return;
    e.preventDefault();
    goTo(url.pathname);
  }

  private toggleMenu = () => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));

  /** "Plus" on phones: the other themes and HA's menu. */
  private more(prefix: string): void {
    const go = (path: string) => {
      window.addEventListener("popstate", () => goTo(`${prefix}/${path}`), { once: true });
      closePopup();
    };
    openPopup({
      title: "Plus",
      icon: "mdi:dots-horizontal",
      color: "indigo",
      watch: [],
      body: () => html`
        ${NAV.filter((n) => !PHONE.includes(n.path)).map(
          (n) => html`<button class="row" @click=${() => go(n.path)}>
            <span class="shape" style="--rgb: var(--rgb-${n.color})"><ha-icon icon=${n.active}></ha-icon></span>
            <div><div class="primary">${n.label}</div></div>
          </button>`,
        )}
        <button class="row" @click=${() => (closePopup(), this.toggleMenu())}>
          <span class="shape"><ha-icon icon="mdi:menu"></ha-icon></span>
          <div><div class="primary">Menu Home Assistant</div><div class="secondary">Paramètres, historique, carte</div></div>
        </button>
      `,
    });
  }

  private page(section: string, sub: string | undefined, prefix: string) {
    const hass = store.hass!;
    const model = house(hass);
    const load = PAGES[section];
    if (load && !this.loaded.has(section)) {
      load().then(() => (this.loaded.add(section), this.requestUpdate()));
      return html`<div class="loading" aria-busy="true"></div>`;
    }
    const person = currentPerson(hass)?.replace("person.", "");
    const rooms = roomsFor(model, (person && config.people[person]?.favoriteRooms) || []);
    switch (section) {
      case "":
        return html`<kh3-home prefix=${prefix} .model=${model} .wall=${this.wall}></kh3-home>`;
      case "pieces": {
        const room = sub ? rooms.find((r) => r.id === sub) : undefined;
        return room
          ? html`<kh-v2-room .room=${room} .rooms=${rooms} .model=${model} prefix=${prefix}></kh-v2-room>`
          : html`<kh-v2-rooms .rooms=${rooms} .model=${model} prefix=${prefix}></kh-v2-rooms>`;
      }
      case "medias":
        return html`<kh-v2-media prefix=${prefix}></kh-v2-media>`;
      case "meteo":
        return html`<kh-v2-weather prefix=${prefix}></kh-v2-weather>`;
      case "energie":
        return html`<kh-v2-energy .power=${model.power} prefix=${prefix}></kh-v2-energy>`;
      case "systeme":
        return html`<kh-v2-system prefix=${prefix}></kh-v2-system>`;
    }
    return html`<p>Cette page n'existe pas. <a href=${prefix}>Revenir à l'accueil</a></p>`;
  }

  private entry(n: (typeof NAV)[number], prefix: string, section: string) {
    const current = n.path === section;
    return html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} style="--c: var(--rgb-${n.color})" aria-current=${current ? "page" : nothing}>
      <span class="pad"><ha-icon icon=${current ? n.active : n.icon}></ha-icon></span>${n.label}
    </a>`;
  }

  render() {
    if (!store.hass) return nothing;
    const prefix = this.route?.prefix ?? "/maison-v3";
    const [section = "", sub] = (this.route?.path ?? "").replace(/^\//, "").split("/");
    const elsewhere = !PHONE.includes(section);
    return html`
      <div class="shell" @click=${this.navigate}>
        ${this.phone
          ? html`<nav class="tabs" aria-label="Navigation">
              ${NAV.filter((n) => PHONE.includes(n.path)).map((n) => this.entry(n, prefix, section))}
              <button aria-haspopup="dialog" style="--c: var(--rgb-indigo)" aria-current=${elsewhere ? "page" : nothing} @click=${() => this.more(prefix)}>
                <span class="pad"><ha-icon icon="mdi:dots-horizontal"></ha-icon></span>Plus
              </button>
            </nav>`
          : html`<nav class="rail" aria-label="Navigation">
              ${this.narrow
                ? html`<button class="menu" aria-label="Menu Home Assistant" @click=${this.toggleMenu}><ha-icon icon="mdi:menu"></ha-icon></button>`
                : nothing}
              ${NAV.map((n) => this.entry(n, prefix, section))}
            </nav>`}
        <main>${keyed(`${section}/${sub ?? ""}`, html`<div class="page">${this.page(section, sub, prefix)}</div>`)}</main>
      </div>
    `;
  }
}
customElements.define("kh3-app", Kh3App);

/** Navigates inside the panel (HA's router listens to location-changed). */
function goTo(path: string): void {
  history.pushState(null, "", path + location.search);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}
