import { LitElement, css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { cancelConfirmation } from "../components/confirm-dialog.ts";
import { installPressFeedback, scrollToTop } from "../components/gestures.ts";
import { closePopup, openPopup } from "../components/popup.ts";
import { preloadPopups } from "../popups/open.ts";
import { config } from "../config.ts";
import { house } from "../house.ts";
import { currentPerson, roomsFor } from "../rooms.ts";
import { RegistryController, store } from "../store.ts";
import { base, tokens } from "../styles.ts";
import { isWall } from "./styles.ts";
import type { PanelRoute } from "../types.ts";
import "./home.ts";

/** Pages after the home one, loaded on first visit. */
const PAGES: Record<string, () => Promise<unknown>> = {
  pieces: () => Promise.all([import("./rooms.ts"), import("./room.ts")]),
  medias: () => import("./media.ts"),
  meteo: () => import("./weather.ts"),
  energie: () => import("./energy.ts"),
  systeme: () => import("./system.ts"),
};

/** Navigation: each page has its colour, used by the dock and its hero. */
const NAV = [
  { path: "", label: "Accueil", icon: "mdi:home-variant", color: "blue" },
  { path: "pieces", label: "Maison", icon: "mdi:floor-plan", color: "amber" },
  { path: "medias", label: "Médias", icon: "mdi:play-circle", color: "purple" },
  { path: "meteo", label: "Météo", icon: "mdi:weather-partly-cloudy", color: "light-blue" },
  { path: "energie", label: "Énergie", icon: "mdi:lightning-bolt", color: "orange" },
  { path: "systeme", label: "Système", icon: "mdi:cog", color: "indigo" },
];
/** Phones keep four roomy entries and "Plus". */
const PHONE = ["", "pieces", "medias", "meteo"];

/**
 * Maison V2: its own panel and shell (floating dock at the bottom on every
 * screen), the bento pages under ./, and the data, actions and popups shared
 * with V1.
 */
export class KhV2App extends LitElement {
  static properties = { narrow: { type: Boolean }, route: { attribute: false }, phone: { state: true }, wall: { state: true } };
  declare narrow: boolean;
  declare route?: PanelRoute;
  declare phone: boolean;
  /** Wall tablet: the menu becomes a rail on the left, out of the tiles' way. */
  declare wall: boolean;
  private loaded = new Set<string>();
  private resize = new ResizeObserver(([e]) => {
    this.phone = e.contentRect.width < 680;
    this.wall = !this.phone && isWall(e.contentRect.width);
  });

  constructor() {
    super();
    this.phone = false;
    this.wall = false;
    new RegistryController(this);
  }

  static styles = [
    tokens,
    base,
    css`
      :host {
        display: block;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--kh-bg);
        background-attachment: fixed;
      }
      main {
        box-sizing: border-box;
        width: 100%;
        max-width: 1440px;
        margin: 0 auto;
        padding: max(16px, env(safe-area-inset-top)) 24px calc(120px + env(safe-area-inset-bottom));
      }
      /* A short settle, not a fade from blank: changing menu must not feel like a reload. */
      .page {
        animation: kh-settle 200ms ease-out;
      }
      @keyframes kh-settle {
        from {
          opacity: 0.6;
          transform: translateY(6px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .page {
          animation: none;
        }
      }
      .loading {
        height: 40vh;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      nav {
        position: fixed;
        z-index: 2;
        left: 50%;
        bottom: max(14px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        display: flex;
        gap: 4px;
        padding: 6px;
        border-radius: 26px;
        background: rgb(40 44 48 / 0.78);
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.3);
      }
      :host(:not([dark])) nav {
        background: rgb(255 255 255 / 0.85);
        box-shadow: 0 8px 26px rgb(0 0 0 / 0.16);
      }
      nav a,
      nav button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 48px;
        padding: 0 14px;
        border-radius: 20px;
        color: var(--kh-text-2);
        text-decoration: none;
        font-weight: 700;
        font-size: 0.875rem;
        white-space: nowrap;
        transition: background-color 250ms ease, color 250ms ease;
      }
      nav ha-icon {
        --mdc-icon-size: 22px;
      }
      nav [aria-current="page"] {
        color: var(--kh-text);
        background: rgba(var(--c), 0.28);
      }
      nav [aria-current="page"] ha-icon {
        color: rgb(var(--c));
      }
      /* Phones: the dock spans the width, labels under the icons. */
      /* Wall layout: a rail of icons in its own column on the left of the
         panel (beside the HA sidebar, never under it), vertically centred. */
      :host([wall]) .shell {
        display: grid;
        /* Same 24 px on both sides: HA sidebar to rail, last card to edge. */
        grid-template-columns: calc(24px + 68px + 20px) minmax(0, 1fr);
        min-height: 100dvh;
      }
      :host([wall]) main {
        grid-column: 2;
        grid-row: 1;
        max-width: 1600px;
        padding: max(16px, env(safe-area-inset-top)) 24px 16px 0;
      }
      nav.rail {
        grid-column: 1;
        grid-row: 1;
        position: sticky;
        top: 50%;
        left: auto;
        bottom: auto;
        align-self: start;
        margin-left: 24px;
        transform: translateY(-50%);
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        width: max-content;
      }
      nav.rail a,
      nav.rail button {
        width: 52px;
        height: 52px;
        padding: 0;
        justify-content: center;
        border-radius: 16px;
      }
      nav.phone {
        left: 10px;
        right: 10px;
        transform: none;
      }
      nav.phone a,
      nav.phone button {
        flex: 1;
        min-width: 0;
        height: 56px;
        padding: 0;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        font-size: 0.6875rem;
        border-radius: 20px;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
    cancelConfirmation(); // a question left open must not be answered later
  }

  protected firstUpdated(): void {
    installPressFeedback(this.renderRoot as ShadowRoot);
    this.prefetch();
  }

  /**
   * Once the first page is up and the browser idle, the other pages and the
   * popups are downloaded one by one: opening a menu later is instant.
   */
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
    // Changing page (not a popup, not a room swipe on the same page): back to the top.
    const page = this.route?.path ?? "";
    if (this.lastPage !== undefined && page !== this.lastPage) scrollToTop(this);
    this.lastPage = page;
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
    this.toggleAttribute("wall", this.wall && !this.phone);
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

  /** "Plus" on phones: the other pages and the HA menu. */
  private more(prefix: string): void {
    const go = (path: string) => {
      // Closing the sheet goes back one history step: navigate once it is done.
      window.addEventListener("popstate", () => goTo(`${prefix}/${path}`), { once: true });
      closePopup();
    };
    openPopup({
      title: "Plus",
      icon: "mdi:dots-horizontal-circle-outline",
      color: "indigo",
      watch: [],
      body: () => html`
        ${NAV.filter((n) => !PHONE.includes(n.path)).map(
          (n) => html`<button class="row" @click=${() => go(n.path)}>
            <span class="shape" style="--rgb: var(--rgb-${n.color})"><ha-icon icon=${n.icon}></ha-icon></span>
            <div><div class="primary">${n.label}</div></div>
          </button>`,
        )}
        <button class="row" @click=${() => (closePopup(), this.toggleMenu())}>
          <span class="shape"><ha-icon icon="mdi:menu"></ha-icon></span>
          <div><div class="primary">Menu Home Assistant</div><div class="secondary">Paramètres, historique, carte…</div></div>
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
        return html`<kh-home-v2 prefix=${prefix} .model=${model} .wall=${this.wall}></kh-home-v2>`;
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
    return html`<p>Page introuvable.</p>`;
  }

  render() {
    if (!store.hass) return nothing;
    const prefix = this.route?.prefix ?? "/maison-v2";
    const [section = "", sub] = (this.route?.path ?? "").replace(/^\//, "").split("/");
    const items = this.phone ? NAV.filter((n) => PHONE.includes(n.path)) : NAV;
    const elsewhere = this.phone && !PHONE.includes(section);
    return html`
      <div class="shell" @click=${this.navigate}>
        <main>${keyed(`${section}/${sub ?? ""}`, html`<div class="page">${this.page(section, sub, prefix)}</div>`)}</main>
        <nav class=${this.phone ? "phone" : this.wall ? "rail" : ""} aria-label="Navigation">
          ${items.map(
            (n) => html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} style="--c: var(--rgb-${n.color})"
              aria-current=${n.path === section ? "page" : nothing}>
              <ha-icon icon=${n.icon}></ha-icon>${this.phone || (n.path === section && !this.wall) ? n.label : html`<span class="sr">${n.label}</span>`}
            </a>`,
          )}
          ${this.phone
            ? html`<button aria-haspopup="dialog" style="--c: var(--rgb-indigo)" aria-current=${elsewhere ? "page" : nothing}
                @click=${() => this.more(prefix)}><ha-icon icon="mdi:dots-horizontal-circle-outline"></ha-icon>Plus</button>`
            : this.narrow
              ? html`<button aria-label="Menu Home Assistant" @click=${this.toggleMenu}><ha-icon icon="mdi:menu"></ha-icon></button>`
              : nothing}
        </nav>
      </div>
    `;
  }
}
customElements.define("kh-v2-app", KhV2App);

/** Navigates inside the panel (HA's router listens to location-changed). */
function goTo(path: string): void {
  history.pushState(null, "", path + location.search); // keeps ?as= previews
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}
