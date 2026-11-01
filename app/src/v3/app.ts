import { LitElement, css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { cancelConfirmation } from "../components/confirm-dialog.ts";
import { installPressFeedback } from "../components/gestures.ts";
import { config } from "../config.ts";
import { house } from "../house.ts";
import { preloadPopups } from "../popups/open.ts";
import { currentPerson, roomsFor } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import type { PanelRoute } from "../types.ts";
import { f0, f1, num } from "./data.ts";
import "./home.ts";
import { icon } from "./icons.ts";
import { isKiosk } from "../kiosk.ts";
import { goTo, installDragScroll } from "./nav.ts";
import { isDark, loadFonts, loadTheme, themeShared, themeStyle, ui, type ThemeChoice } from "./theme.ts";

/** Pages after the home one, each its own chunk, loaded on first visit. */
const PAGES: Record<string, () => Promise<unknown>> = {
  maison: () => import("./pages/maison.ts"),
  climat: () => import("./pages/climat.ts"),
  medias: () => import("./pages/medias.ts"),
  meteo: () => import("./pages/meteo.ts"),
  energie: () => import("./pages/energie.ts"),
  bourse: () => import("./pages/bourse.ts"),
  famille: () => import("./pages/famille.ts"),
  systeme: () => import("./pages/systeme.ts"),
};

interface NavEntry {
  path: string;
  label: string;
  icon: string;
}

const NAV: NavEntry[] = [
  { path: "", label: "Accueil", icon: "home" },
  { path: "maison", label: "Maison", icon: "plan" },
  { path: "climat", label: "Climat", icon: "thermo" },
  { path: "medias", label: "Médias", icon: "playCircle" },
  { path: "meteo", label: "Météo", icon: "cloud" },
  { path: "energie", label: "Énergie", icon: "bolt" },
  { path: "bourse", label: "Bourse", icon: "trend" },
  { path: "famille", label: "Famille", icon: "people" },
  { path: "systeme", label: "Système", icon: "gear" },
];
/** Phones: four tabs and "Plus". */
const TABS = ["", "maison", "climat", "medias"];

/**
 * Maison V3: a rail on the left (wall tablet, PC), four tabs and "Plus" at the
 * bottom (phone). Pages are their own chunks; data, actions and popups are
 * shared with V1 and V2.
 */
export class Kh3App extends LitElement {
  static properties = {
    narrow: { type: Boolean },
    route: { attribute: false },
    phone: { state: true },
    theme: { state: true },
  };
  declare narrow: boolean;
  declare route?: PanelRoute;
  declare phone: boolean;
  declare theme: ThemeChoice;
  private loaded = new Set<string>();
  private resize = new ResizeObserver(([e]) => this.layout(e.contentRect.width));

  constructor() {
    super();
    this.phone = false;
    this.theme = loadTheme();
    loadFonts();
    new RegistryController(this);
    // The "Plus" sheet shows a few live values.
    new EntitiesController(this, () => [config.home.energy?.power, config.home.outdoorTemperature].filter((x): x is string => !!x));
  }

  static styles = [
    ui,
    css`
      :host {
        display: block;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--bg);
      }
      .shell {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr);
        gap: 14px;
        min-height: 100vh;
        min-height: 100dvh;
        padding: 16px;
      }
      :host([phone]) .shell {
        display: block;
        padding: 0;
      }
      main {
        min-width: 0;
      }
      /* Skip link: off screen until focused from the keyboard. */
      .skip {
        position: absolute;
        z-index: 10;
        left: 16px;
        top: -80px;
        padding: 12px 16px;
        border-radius: 14px;
        background: var(--surf);
        box-shadow: var(--shadow);
        font-weight: 600;
      }
      .skip:focus-visible {
        top: 16px;
      }
      :host([phone]) main {
        padding: max(16px, env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
      }

      /* Rail: icon over label, the current one on a lighter pad. */
      nav.rail {
        position: sticky;
        top: 16px;
        height: calc(100vh - 32px);
        height: calc(100dvh - 32px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 10px 0;
        border-radius: 22px;
        background: var(--surf);
        overflow-y: auto;
        scrollbar-width: none;
      }
      nav.rail a,
      nav.rail button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        width: 62px;
        padding: 7px 0;
        border-radius: 16px;
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        flex: none;
      }
      nav.rail a[aria-current="page"] {
        background: var(--surf2);
        color: var(--ink);
      }
      nav.rail .spacer {
        flex: 1;
        min-height: 4px;
      }

      /* Phone tab bar, floating above the content. */
      nav.tabs {
        position: fixed;
        z-index: 5;
        left: 12px;
        right: 12px;
        bottom: max(12px, env(safe-area-inset-bottom));
        display: flex;
        padding: 4px;
        border-radius: 24px;
        background: var(--navBg);
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        box-shadow: var(--shadow);
      }
      nav.tabs a,
      nav.tabs button {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-height: 52px;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        border-radius: 20px;
      }
      nav.tabs [aria-current="page"] {
        color: var(--blue);
      }

      /* "Plus" sheet (phone). */
      dialog {
        border: 0;
        padding: 10px 16px max(24px, env(safe-area-inset-bottom));
        margin: auto 0 0;
        width: 100%;
        max-width: 100%;
        border-radius: 28px 28px 0 0;
        background: var(--surf);
        color: var(--ink);
        max-height: 90dvh;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      dialog[open] {
        animation: rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      dialog::backdrop {
        background: rgba(5, 4, 15, 0.55);
      }
      @keyframes rise {
        from {
          transform: translateY(40px);
          opacity: 0;
        }
      }
      .grip {
        width: 40px;
        height: 5px;
        border-radius: 99px;
        background: var(--muted);
        opacity: 0.4;
        margin: 0 auto 12px;
      }
      .sheet-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .more {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .more a,
      .more button {
        display: flex;
        text-align: left;
        min-width: 0;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border-radius: 18px;
        background: var(--surf2);
      }
      .more .ico {
        width: 40px;
        height: 40px;
        border-radius: 12px;
      }
      .loading {
        height: 40vh;
      }
      .page {
        view-transition-name: kh3-page;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.layout(this.getBoundingClientRect().width || window.innerWidth);
    this.resize.observe(this);
    window.addEventListener("kh3-theme", this.onTheme);
    installPressFeedback(this.renderRoot as ShadowRoot);
    this.documentMeta(true);
    this.undrag = installDragScroll();
  }

  /**
   * While V3 is shown: pinch-zoom allowed (HA's page forbids it) and a page
   * description; HA's own values come back when leaving the panel.
   */
  private savedViewport?: string;
  private undrag?: () => void;
  private documentMeta(on: boolean): void {
    const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (vp) {
      if (on) {
        this.savedViewport = vp.content;
        vp.content = vp.content.replace(/,?\s*user-scalable=no/, "").replace(/,?\s*maximum-scale=[\d.]+/, "");
      } else if (this.savedViewport !== undefined) vp.content = this.savedViewport;
    }
    let desc = document.querySelector<HTMLMetaElement>('meta[name="description"][data-kh3]');
    if (on && !desc) {
      desc = document.createElement("meta");
      desc.name = "description";
      desc.dataset.kh3 = "";
      desc.content = "Kaoru Home : lumières, climat, médias, énergie et météo de la maison en un coup d'œil.";
      document.head.append(desc);
    } else if (!on) desc?.remove();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
    window.removeEventListener("kh3-theme", this.onTheme);
    themeShared(undefined, false);
    this.documentMeta(false);
    this.undrag?.();
    cancelConfirmation();
  }

  private onTheme = (e: Event) => (this.theme = (e as CustomEvent<ThemeChoice>).detail);

  private layout(width: number): void {
    this.phone = width < 700;
  }

  protected firstUpdated(): void {
    this.prefetch();
  }

  /** Once the home is up and the browser idle, the other pages load one by one. */
  private prefetch(): void {
    const idle = (f: () => void): void => void ("requestIdleCallback" in window ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 300));
    const queue = Object.keys(PAGES);
    const next = (): void => {
      const section = queue.shift();
      if (!section) return preloadPopups();
      if (this.loaded.has(section)) {
        idle(next);
        return;
      }
      PAGES[section]().then(
        () => (this.loaded.add(section), idle(next)),
        () => idle(next),
      );
    };
    // Not during the first load: on the first touch, else after 15 s.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      window.removeEventListener("pointerdown", start);
      idle(next);
    };
    window.addEventListener("pointerdown", start, { once: true, passive: true });
    setTimeout(start, 15_000);
  }

  private lastPage?: string;

  protected updated(): void {
    const page = this.route?.path ?? "";
    if (this.lastPage !== undefined && page !== this.lastPage) window.scrollTo({ top: 0 });
    this.lastPage = page;
  }

  /** Theme and layout attributes before painting, so nothing flashes. */
  protected willUpdate(): void {
    const system = !!store.hass?.themes.darkMode;
    this.setAttribute("style", themeStyle(this.theme, system));
    this.toggleAttribute("dark", isDark(this.theme, system));
    this.toggleAttribute("phone", this.phone);
    themeShared(this.theme, system);
  }

  private navigate(e: MouseEvent): void {
    const a = (e.composedPath() as HTMLElement[]).find((el) => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href);
    const prefix = this.route?.prefix;
    if (url.origin !== location.origin || !prefix) return;
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return;
    e.preventDefault();
    this.renderRoot.querySelector("dialog")?.close();
    goTo(url.pathname);
  }

  /** Skip link: focus the page (fragment links do not reach into the shadow root). */
  private skip = (e: Event) => {
    e.preventDefault();
    this.renderRoot.querySelector<HTMLElement>("main")?.focus();
  };

  private toggleMenu = () => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));

  private page(section: string, sub: string | undefined, prefix: string) {
    const hass = store.hass!;
    const model = house(hass);
    const person = currentPerson(hass);
    const key = person?.replace("person.", "");
    const rooms = roomsFor(model, (key && config.people[key]?.favoriteRooms) || []);
    if (section === "") return html`<kh3-home prefix=${prefix} .model=${model} .rooms=${rooms} .phone=${this.phone} .person=${person}></kh3-home>`;
    const load = PAGES[section];
    if (!load) return html`<p class="empty">Cette page n'existe pas. <a href=${prefix}>Revenir à l'accueil</a></p>`;
    if (!this.loaded.has(section)) {
      load().then(() => (this.loaded.add(section), this.requestUpdate()));
      return html`<div class="loading" role="status" aria-busy="true"><span class="sr">Chargement…</span></div>`;
    }
    const props = { prefix, model, rooms, phone: this.phone, sub, theme: this.theme, person };
    switch (section) {
      case "maison":
        return sub
          ? html`<kh3-piece .p=${props}></kh3-piece>`
          : html`<kh3-maison .p=${props}></kh3-maison>`;
      case "climat":
        return html`<kh3-climat .p=${props}></kh3-climat>`;
      case "medias":
        return html`<kh3-medias .p=${props}></kh3-medias>`;
      case "meteo":
        return html`<kh3-meteo .p=${props}></kh3-meteo>`;
      case "energie":
        return html`<kh3-energie .p=${props}></kh3-energie>`;
      case "bourse":
        return html`<kh3-bourse .p=${props}></kh3-bourse>`;
      case "famille":
        return html`<kh3-famille .p=${props}></kh3-famille>`;
      case "systeme":
        return html`<kh3-systeme .p=${props}></kh3-systeme>`;
    }
    return nothing;
  }

  private link(n: NavEntry, prefix: string, section: string) {
    return html`<a href=${n.path ? `${prefix}/${n.path}` : prefix} aria-current=${n.path === section ? "page" : nothing}>${icon(n.icon, 22)}${n.label}</a>`;
  }

  private summary(path: string): string {
    switch (path) {
      case "meteo":
        return `${f1(num(config.home.outdoorTemperature))}° dehors`;
      case "energie":
        return `${f0(num(config.home.energy?.power))} W maintenant`;
      case "bourse": {
        const s = store.get(config.home.stocks.find((x) => x.home)?.entity ?? "");
        const c = Number(s?.attributes.regularMarketChangePercent);
        return isNaN(c) ? "Valeurs suivies" : `S&P 500 ${c >= 0 ? "+" : "−"}${f1(Math.abs(c))} %`;
      }
      case "famille": {
        const away = Object.values(store.hass?.states ?? {}).filter((s) => s.entity_id.startsWith("person.") && !config.people[s.entity_id.slice(7)]?.device && s.state !== "home").length;
        return away ? `${away} absent${away > 1 ? "s" : ""}` : "Tout le monde est là";
      }
      case "systeme": {
        const n = Object.values(store.hass?.states ?? {}).filter((s) => s.entity_id.startsWith("update.") && s.state === "on").length;
        return n ? `${n} mise${n > 1 ? "s" : ""} à jour` : "Tout fonctionne";
      }
    }
    return "";
  }

  render() {
    if (!store.hass) return nothing;
    const prefix = this.route?.prefix ?? "/maison";
    let [section = "", sub] = (this.route?.path ?? "").replace(/^\//, "").split("/");
    // The plan (shared with V2) opens rooms under /pieces.
    if (section === "pieces") section = "maison";
    const others = NAV.filter((n) => !TABS.includes(n.path));
    return html`
      <div class="shell" @click=${this.navigate}>
        <a class="skip" href="#contenu" @click=${this.skip}>Aller au contenu</a>
        ${this.phone
          ? html`<nav class="tabs" aria-label="Navigation">
              ${NAV.filter((n) => TABS.includes(n.path)).map((n) => this.link(n, prefix, section))}
              <button aria-haspopup="dialog" aria-current=${TABS.includes(section) ? nothing : "page"}
                @click=${() => this.renderRoot.querySelector("dialog")?.showModal()}>${icon("more", 22)}Plus</button>
            </nav>
            <dialog aria-labelledby="kh3-more-t" @click=${(e: MouseEvent) => e.target === e.currentTarget && (e.currentTarget as HTMLDialogElement).close()}>
              <div class="grip" aria-hidden="true"></div>
              <div class="sheet-head"><h2 class="page-title" id="kh3-more-t" style="font-size:22px">Plus</h2>
                <button class="rb" aria-label="Fermer" @click=${() => this.renderRoot.querySelector("dialog")?.close()}>${icon("close", 18)}</button></div>
              <nav class="more" aria-label="Autres pages">
                ${others.map((n) => html`<a href=${`${prefix}/${n.path}`} aria-current=${n.path === section ? "page" : nothing}>
                  <span class="ico" style="background:var(--surf);color:var(--ink)">${icon(n.icon, 22)}</span>
                  <span><b style="display:block;font-size:15px">${n.label}</b><span class="st">${this.summary(n.path)}</span></span>
                </a>`)}
                <button type="button" @click=${() => (this.renderRoot.querySelector("dialog")?.close(), this.toggleMenu())}>
                  <span class="ico" style="background:var(--surf);color:var(--ink)">${icon("haLogo", 22)}</span>
                  <span><b style="display:block;font-size:15px">Home Assistant</b><span class="st">Paramètres, historique</span></span>
                </button>
              </nav>
            </dialog>`
          : html`<nav class="rail" aria-label="Navigation">
              ${this.narrow || isKiosk() ? html`<button aria-label="Menu Home Assistant" @click=${this.toggleMenu}>${icon("logs", 22)}Menu</button>` : nothing}
              ${NAV.filter((n) => n.path !== "systeme").map((n) => this.link(n, prefix, section))}
              <span class="spacer"></span>
              ${this.link(NAV.find((n) => n.path === "systeme")!, prefix, section)}
            </nav>`}
        <main id="contenu" tabindex="-1">${keyed(`${section}/${sub ?? ""}`, html`<div class="page">${this.page(section, sub, prefix)}</div>`)}</main>
      </div>
    `;
  }
}
customElements.define("kh3-app", Kh3App);
