import { LitElement, css, html, nothing } from "lit";
import { config } from "./config.ts";
import { buildHouse, currentPerson, roomsFor, type HouseModel } from "./rooms.ts";
import { RegistryController, store } from "./store.ts";
import { base, tokens } from "./styles.ts";
import type { HomeAssistant, PanelRoute } from "./types.ts";
import "./views/home-view.ts";
import "./views/room-view.ts";

const TRANSLATED_DOMAINS = ["weather", "light", "switch", "fan", "media_player", "binary_sensor", "person"];

// Fonts must be declared on the document: @font-face does not work inside a shadow root.
function loadFonts(): void {
  if (document.getElementById("kaoru-home-fonts")) return;
  const dir = import.meta.url.replace(/[^/]*$/, "") + "fonts/";
  const face = (family: string, file: string, weight: number) =>
    `@font-face{font-family:"${family}";src:url("${dir}${file}") format("woff2");font-weight:${weight};font-display:swap}`;
  const style = document.createElement("style");
  style.id = "kaoru-home-fonts";
  style.textContent = [
    face("Atkinson Hyperlegible", "atkinson-hyperlegible-400.woff2", 400),
    face("Atkinson Hyperlegible", "atkinson-hyperlegible-700.woff2", 700),
    face("Dela Gothic One", "dela-gothic-one-400.woff2", 400),
  ].join("");
  document.head.append(style);
}

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
    loadFonts();
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
        container: kh / inline-size;
      }
      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 1fr;
      }
      nav.rail {
        display: none;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 8px 0;
      }
      .topbar button,
      .back {
        width: var(--kh-tap);
        height: var(--kh-tap);
        display: grid;
        place-items: center;
        border-radius: 50%;
      }
      .chips {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        padding: 4px 0;
      }
      .chips a {
        flex: none;
        padding: 10px 16px;
        border-radius: 999px;
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
        color: var(--kh-text);
        text-decoration: none;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .chips a[aria-current="page"] {
        background: var(--kh-accent);
        border-color: var(--kh-accent);
        color: #fff;
      }
      .content {
        min-width: 0;
      }
      main {
        padding: 8px 16px 32px;
        min-width: 0;
        max-width: 1400px;
      }
      @container kh (min-width: 900px) {
        .shell {
          grid-template-columns: 232px 1fr;
        }
        nav.rail {
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: sticky;
          top: 0;
          height: 100vh;
          box-sizing: border-box;
          padding: 24px 12px;
          border-right: 1px solid var(--kh-line);
          overflow-y: auto;
        }
        nav.rail .brand {
          font-family: var(--kh-display);
          font-size: 1.25rem;
          padding: 0 12px 20px;
        }
        nav.rail a {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: var(--kh-tap);
          padding: 0 12px;
          border-radius: var(--kh-radius-sm);
          color: var(--kh-text);
          text-decoration: none;
        }
        nav.rail a ha-icon {
          color: var(--kh-text-2);
        }
        nav.rail a[aria-current="page"] {
          background: var(--kh-accent-soft);
          font-weight: 700;
        }
        nav.rail a[aria-current="page"] ha-icon {
          color: var(--kh-accent);
        }
        .chips,
        .back {
          display: none;
        }
        main {
          padding: 24px 32px 48px;
        }
      }
    `,
  ];

  /** Rebuilds the house model only when the registry changed. */
  private house(hass: HomeAssistant): HouseModel {
    const key = [hass.entities, hass.devices, hass.areas];
    if (!this.model || key.some((k, i) => k !== this.modelKey[i])) {
      this.model = buildHouse(hass, config);
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
    if (url.origin !== location.origin || !this.route || !url.pathname.startsWith(this.route.prefix)) return;
    e.preventDefault();
    history.pushState(null, "", url.pathname);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  private toggleMenu(): void {
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  protected updated(): void {
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
    this.renderRoot
      .querySelector('.chips a[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const model = this.house(hass);
    const person = currentPerson(hass)?.replace("person.", "");
    const rooms = roomsFor(model, (person && config.people[person]?.favoriteRooms) || []);
    const prefix = this.route?.prefix ?? "/maison";
    const roomId = (this.route?.path ?? "").replace(/^\//, "").split("/")[0];
    const room = rooms.find((r) => r.id === roomId);
    const link = (id: string | null, label: string, icon: string) => html`<a
      href=${id ? `${prefix}/${id}` : prefix}
      aria-current=${(id ?? "") === (room?.id ?? "") ? "page" : nothing}
      ><ha-icon icon=${icon}></ha-icon>${label}</a
    >`;

    return html`
      <div class="shell" @click=${this.navigate}>
        <nav class="rail" aria-label="Pièces">
          <div class="brand">Maison</div>
          ${link(null, "Accueil", "mdi:home-variant-outline")} ${rooms.map((r) => link(r.id, r.name, r.icon))}
        </nav>
        <div class="content">
          ${this.narrow
            ? html`<div class="topbar">
                <button aria-label="Menu Home Assistant" @click=${this.toggleMenu}><ha-icon icon="mdi:menu"></ha-icon></button>
              </div>`
            : nothing}
          <main>
            ${room
              ? html`<nav class="chips" aria-label="Pièces">
                    <a href=${prefix}>Accueil</a>
                    ${rooms.map(
                      (r) => html`<a href=${`${prefix}/${r.id}`} aria-current=${r.id === room.id ? "page" : nothing}>${r.name}</a>`,
                    )}
                  </nav>
                  <kh-room-view .room=${room} .model=${model}></kh-room-view>`
              : html`<kh-home-view .model=${model} .rooms=${rooms} prefix=${prefix}></kh-home-view>`}
          </main>
        </div>
      </div>
    `;
  }
}
customElements.define("kaoru-home", KaoruHomePanel);
