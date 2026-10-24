import { LitElement, css, html } from "lit";

let loading: Promise<boolean> | undefined;

/**
 * Home Assistant's own map (`ha-map`: MapLibre, vector tiles, theme-aware
 * markers with photos) is lazy-loaded by the frontend; creating a map card
 * once is the public way to get it defined.
 */
function ensureHaMap(): Promise<boolean> {
  if (customElements.get("ha-map")) return Promise.resolve(true);
  return (loading ??= (async () => {
    try {
      const helpers = await (window as unknown as { loadCardHelpers: () => Promise<any> }).loadCardHelpers();
      await helpers.createCardElement({ type: "map", entities: [] });
      await Promise.race([customElements.whenDefined("ha-map"), new Promise((_, no) => setTimeout(no, 10_000))]);
      return true;
    } catch {
      loading = undefined; // try again next time
      return false;
    }
  })());
}

/**
 * Map of people and tracked objects, drawn by Home Assistant's native map.
 * It reads the states through HA's context, so it must live inside the
 * <home-assistant> tree (the panel, or a popup mounted there).
 * `passive`: a picture of the map that does not catch scroll gestures.
 */
export class KhMiniMap extends LitElement {
  static properties = {
    entities: { attribute: false },
    height: { type: Number },
    passive: { type: Boolean },
    ready: { state: true },
    failed: { state: true },
    seen: { state: true },
  };
  declare entities: string[];
  declare height: number;
  declare passive: boolean;
  declare ready: boolean;
  declare failed: boolean;
  /** On screen at least once: MapLibre is heavy, it starts only then. */
  declare seen: boolean;
  private watch = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    this.watch.disconnect();
    this.seen = true;
    if (!this.ready) ensureHaMap().then((ok) => ((this.ready = ok), (this.failed = !ok)));
  });

  constructor() {
    super();
    this.entities = [];
    this.height = 240;
    this.passive = false;
    this.ready = !!customElements.get("ha-map");
    this.failed = false;
    this.seen = false;
  }

  static styles = css`
    :host {
      display: block;
    }
    .map,
    ha-map {
      display: block;
      width: 100%;
      overflow: hidden;
      border-radius: 18px;
      background: var(--kh-card-2);
    }
    .map {
      display: grid;
      place-items: center;
      color: var(--kh-text-2);
      font-weight: 600;
      font-size: 0.875rem;
    }
    .map a {
      color: inherit;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.watch.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.watch.disconnect();
  }

  render() {
    const h = `height:${this.height}px`;
    if (this.failed) return html`<div class="map" style=${h}><a href="/map">Ouvrir la carte de Home Assistant</a></div>`;
    if (!this.ready || !this.seen) return html`<div class="map" style=${h} aria-busy="true"></div>`;
    return html`<ha-map
      style=${h}
      .entities=${this.entities.map((entity_id) => ({ entity_id }))}
      .autoFit=${true}
      .fitZones=${false}
      .interactiveZones=${false}
      .zoom=${15}
      .themeMode=${"auto"}
      .renderPassive=${this.passive}
    ></ha-map>`;
  }
}
customElements.define("kh-mini-map", KhMiniMap);
