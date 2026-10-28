import { LitElement, css, html, nothing } from "lit";
import { cancelConfirmation } from "./components/confirm-dialog.ts";
import { takeOverHassToasts } from "./components/toast.ts";
import { applyKiosk } from "./kiosk.ts";
import { store } from "./store.ts";
import type { HomeAssistant, PanelRoute } from "./types.ts";

const TRANSLATED_DOMAINS = ["weather", "light", "switch", "fan", "media_player", "binary_sensor", "person", "automation"];

/**
 * The panel elements Home Assistant creates for `panel_custom` (kaoru-home,
 * kaoru-home-v2). They only hand `hass` to the store and download their app
 * the first time they are opened, so V1 and V2 never pay for each other.
 */
abstract class Panel extends LitElement {
  static properties = { narrow: { type: Boolean }, route: { attribute: false }, ready: { state: true } };
  declare narrow: boolean;
  declare route?: PanelRoute;
  declare ready: boolean;

  constructor() {
    super();
    this.ready = false;
    adoptEarlyHass(this);
    this.load().then(() => (this.ready = true));
  }

  protected abstract load(): Promise<unknown>;

  set hass(hass: HomeAssistant) {
    const first = !store.hass;
    feed(hass);
    if (first) this.requestUpdate(); // the app itself watches the store
  }

  get hass(): HomeAssistant | undefined {
    return store.hass;
  }

  connectedCallback(): void {
    super.connectedCallback();
    takeOverHassToasts(true);
    applyKiosk();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    takeOverHassToasts(false);
    cancelConfirmation(); // a question left open must not be answered later
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

/** Maison V1 (`panel_custom: name: kaoru-home`), under src/v1. */
class KaoruHomePanel extends Panel {
  protected load() {
    return import("./v1/app.ts");
  }

  render() {
    return this.ready && store.hass ? html`<kh-v1-app .narrow=${this.narrow} .route=${this.route}></kh-v1-app>` : nothing;
  }
}
customElements.define("kaoru-home", KaoruHomePanel);

/** Maison V1 bis (`panel_custom: name: kaoru-home-v1bis`): V1 with the plan on its home page (proposal). */
class KaoruHomeV1BisPanel extends Panel {
  protected load() {
    return import("./v1/app.ts");
  }

  render() {
    return this.ready && store.hass ? html`<kh-v1-app variant="bis" .narrow=${this.narrow} .route=${this.route}></kh-v1-app>` : nothing;
  }
}
customElements.define("kaoru-home-v1bis", KaoruHomeV1BisPanel);

/** Maison V1 ter (`panel_custom: name: kaoru-home-v1ter`): the plan across two columns (proposal). */
class KaoruHomeV1TerPanel extends KaoruHomeV1BisPanel {
  render() {
    return this.ready && store.hass ? html`<kh-v1-app variant="ter" .narrow=${this.narrow} .route=${this.route}></kh-v1-app>` : nothing;
  }
}
customElements.define("kaoru-home-v1ter", KaoruHomeV1TerPanel);

/** Maison V2 (`panel_custom: name: kaoru-home-v2`), under src/v2. */
class KaoruHomeV2Panel extends Panel {
  protected load() {
    return import("./v2/app.ts");
  }

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
