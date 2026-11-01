import { LitElement, css, html, nothing, render, type PropertyValues, type TemplateResult } from "lit";
import type { GeoJSONSource, Map as GlMap, Marker as GlMarker, StyleSpecification } from "maplibre-gl";
import { icon } from "./icons.ts";

// Shared map of the V3 design (Famille page, person and tracker popups),
// drawn like Home Assistant's own map: MapLibre GL with VersaTiles vector
// tiles (no API key) and HA's colours. MapLibre is downloaded only when a
// map is first on screen (its own chunk).

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label: string;
  /** "person": round avatar; "object": tinted square with an icon. */
  kind?: "person" | "object";
  image?: string;
  /** V3 icon name (objects). */
  icon?: string;
  home?: boolean;
  /** Object tint; defaults to teal at home, amber away. */
  tone?: "teal" | "amber" | "red" | "blue" | "violet";
  onClick?: () => void;
}

export interface MapZone {
  lat: number;
  lon: number;
  /** Metres. */
  radius: number;
  label?: string;
}

const MIN_Z = 3;
const MAX_Z = 18;
/** Markers closer than this (px) are drawn as one group. */
const MERGE_PX = 44;
const PAD = 64;
const TILES = "https://tiles.versatiles.org";

// Home Assistant's "default" map colours (frontend 2026.10, over VersaTiles colorful).
const HA_LIGHT = {
  background: "#f5efe5", land: "#f5efe5", water: "#b8daec", labelWater: "#5487aa", natureWood: "#cfe4bc", natureGrass: "#e2eed8",
  naturePark: "#cfe4bc", natureLeisure: "#e2eed8", natureAgriculture: "#e8efe1", natureWetland: "#e5ecdf", natureSand: "#f3eadd",
  natureRock: "#f3eadd", glacier: "#faf6f0", areaResidential: "#f1e9da", areaCommercial: "#f7e0d8", areaIndustrial: "#f0e7cb",
  areaWaste: "#eee3d3", areaBurial: "#f1e9da", siteParking: "#efe7d6", siteSports: "#cfe4bc26", building: "#eadec7", buildingBg: "#e0cdae",
  roadStreet: "#fcfaf8", roadStreetBg: "#e9dbc4", roadTrunk: "#ffe7be", roadTrunkBg: "#ebd09f", roadMotorway: "#f1d6a5",
  roadMotorwayBg: "#e8bd6e", transitRail: "#ece0cb", transitSubway: "#ece2cf", transitCycle: "#f3eee2", transitFoot: "#f3eee2",
  boundary: "#dbc49f", boundaryDisputed: "#e5d7bd", label: "#4b473c", labelHalo: "#faf8f5cc", labelSymbol: "#8f8774",
  labelPoi: "#8f877466", labelShield: "#fbf8f3", labelHousenumber: "#8f87744d",
};
const HA_DARK = {
  background: "#191b2c", land: "#191b2c", water: "#27357a", labelWater: "#9cc0f0", natureWood: "#254948", natureGrass: "#213b39",
  naturePark: "#28504b", natureLeisure: "#213532", natureAgriculture: "#203233", natureWetland: "#253337", natureSand: "#2a2c3d",
  natureRock: "#2a2c3d", glacier: "#2a2c3d", areaResidential: "#1d2034", areaCommercial: "#29213a", areaIndustrial: "#242431",
  areaWaste: "#1d2034", areaBurial: "#1d2034", siteParking: "#1d2034", siteSports: "#25413926", building: "#21243c", buildingBg: "#2a2e4a",
  roadStreet: "#2b3052", roadStreetBg: "#1a1d33", roadTrunk: "#383e67", roadTrunkBg: "#22263f", roadMotorway: "#454d7d",
  roadMotorwayBg: "#2a2f4c", transitRail: "#2c3150", transitSubway: "#2c3150", transitCycle: "#2b3052", transitFoot: "#2b3052",
  boundary: "#3b4068", boundaryDisputed: "#3b4068", label: "#e7ecf8", labelHalo: "#12141fcc", labelSymbol: "#959dbd",
  labelPoi: "#959dbd66", labelShield: "#191b2c", labelHousenumber: "#959dbd4d",
};

type Lib = { gl: typeof import("maplibre-gl"); osm: typeof import("@versatiles/style").osm };
let loading: Promise<Lib> | undefined;

/** MapLibre + the VersaTiles style builder, once, on first use. */
function loadLib(): Promise<Lib> {
  return (loading ??= (async () => {
    const [gl, vs, worker] = await Promise.all([
      import("maplibre-gl"),
      import("@versatiles/style"),
      // The worker's code as text (Vite ?raw), in the lazy MapLibre chunk; run
      // from a blob, so neither its path nor the server's .mjs MIME type matters.
      // @ts-expect-error Vite query import, no type declarations in this project
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?raw") as Promise<{ default: string }>,
    ]);
    gl.setWorkerUrl(URL.createObjectURL(new Blob([worker.default], { type: "text/javascript" })));
    return { gl, osm: vs.osm };
  })().catch((e) => {
    loading = undefined;
    throw e;
  }));
}

/** MDI name from the config (tracked objects) to a V3 line icon. */
export function objectIcon(mdi?: string): string {
  const n = mdi ?? "";
  if (/key/.test(n)) return "key";
  if (/wallet/.test(n)) return "wallet";
  if (/camera/.test(n)) return "camera";
  if (/bike|bicycle/.test(n)) return "bike";
  if (/scooter/.test(n)) return "scooter";
  if (/phone|cellphone/.test(n)) return "phone";
  return "pin";
}

/** A circle of `radius` metres as a polygon ring (lon, lat). */
function circle(z: MapZone): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = z.radius / 111320, dLon = z.radius / (111320 * Math.cos((z.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([z.lon + dLon * Math.cos(a), z.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `<kh3-map>`: fits every marker and zone until the person moves the map
 * (drag, pinch, wheel, keys: MapLibre's own); "Voir tout le monde" brings the
 * fit back. Reads the V3 tokens (--surf, --teal...) from its ancestors.
 * `dark` picks HA's dark map; left unset, it follows the inherited color-scheme.
 */
export class Kh3Map extends LitElement {
  static properties = {
    markers: { attribute: false },
    zones: { attribute: false },
    dark: { attribute: false },
    fitMax: { type: Number, attribute: "fit-max" },
    zoom: { type: Number },
    label: { type: String },
    resetLabel: { type: String, attribute: "reset-label" },
    moved: { state: true },
    failed: { state: true },
    ready: { state: true },
  };
  declare markers: MapMarker[];
  declare zones: MapZone[];
  declare dark?: boolean;
  /** Highest zoom the fit may pick. */
  declare fitMax: number;
  /** Fixed zoom of the fit (centre still fits the markers). */
  declare zoom?: number;
  declare label: string;
  declare resetLabel: string;
  /** The person moved the map: no more automatic fit. */
  declare moved: boolean;
  declare failed: boolean;
  declare ready: boolean;

  private map?: GlMap;
  private lib?: Lib;
  private glMarkers: GlMarker[] = [];
  private styleDark?: boolean;
  private styleReady = false;
  /** The map moved since the last pointer down: the click is not a tap. */
  private dragged = false;
  private seen = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    this.seen.disconnect();
    void this.create();
  });

  constructor() {
    super();
    this.markers = [];
    this.zones = [];
    this.fitMax = 16;
    this.label = "Carte";
    this.resetLabel = "Voir tout le monde";
    this.moved = false;
    this.failed = false;
    this.ready = false;
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      height: 300px;
      border-radius: 22px;
      background: var(--surf2);
      isolation: isolate;
      color: var(--ink);
      -webkit-tap-highlight-color: transparent;
    }
    * {
      box-sizing: border-box;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
      border: 0;
      background: none;
      padding: 0;
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--blue);
      outline-offset: 2px;
    }
    .gl {
      position: absolute;
      inset: 0;
    }
    /* What MapLibre needs of its stylesheet (the rest is its own controls, unused). */
    .maplibregl-map {
      overflow: hidden;
      -webkit-tap-highlight-color: rgb(0 0 0 / 0);
      -webkit-touch-callout: none;
    }
    .maplibregl-canvas {
      position: absolute;
      left: 0;
      top: 0;
    }
    .maplibregl-canvas:focus-visible {
      outline: 3px solid var(--blue);
      outline-offset: -3px;
    }
    .maplibregl-canvas-container.maplibregl-interactive {
      cursor: grab;
    }
    .maplibregl-canvas-container.maplibregl-interactive:active {
      cursor: grabbing;
    }
    .maplibregl-canvas-container.maplibregl-touch-zoom-rotate,
    .maplibregl-canvas-container.maplibregl-touch-zoom-rotate .maplibregl-canvas {
      touch-action: pan-x pan-y;
    }
    .maplibregl-canvas-container.maplibregl-touch-drag-pan,
    .maplibregl-canvas-container.maplibregl-touch-drag-pan .maplibregl-canvas {
      touch-action: pinch-zoom;
    }
    .maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan,
    .maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan .maplibregl-canvas {
      touch-action: none;
    }
    .maplibregl-marker {
      position: absolute;
      top: 0;
      left: 0;
      will-change: transform;
    }

    /* Markers. */
    .group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      /* The avatars' middle sits on the position. */
      transform: translateY(calc(50% - 24px));
    }
    .stack {
      display: flex;
      align-items: center;
    }
    .stack > * + * {
      margin-left: -12px;
    }
    .mk {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      overflow: hidden;
      display: grid;
      place-items: center;
      flex: none;
      background: var(--violetTint);
      color: var(--violet);
      font-weight: 700;
      font-size: 17px;
      border: 3px solid var(--surf);
      box-shadow: 0 0 0 2.5px var(--muted), var(--shadow);
      transition: transform 0.12s;
    }
    .mk.home {
      box-shadow: 0 0 0 2.5px var(--teal), var(--shadow);
    }
    button.mk:active {
      transform: scale(0.94);
    }
    .mk img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    .mk.obj {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border-width: 2px;
      box-shadow: var(--shadow);
      background: var(--tealTint);
      color: var(--teal);
    }
    .mk.obj.amber {
      background: var(--amberTint);
      color: var(--amberInk);
    }
    .mk.obj.red {
      background: var(--redTint);
      color: var(--red);
    }
    .mk.obj.blue {
      background: var(--blueTint);
      color: var(--blue);
    }
    .mk.obj.violet {
      background: var(--violetTint);
      color: var(--violet);
    }
    .mk.obj svg {
      width: 20px;
      height: 20px;
    }
    .tag {
      height: 26px;
      padding: 0 10px;
      border-radius: 99px;
      background: var(--surf);
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      white-space: nowrap;
      box-shadow: var(--shadow);
      pointer-events: none;
    }

    /* Controls. */
    .ctl {
      position: absolute;
      right: 10px;
      top: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 2;
    }
    .ctl button {
      width: 44px;
      height: 44px;
      border-radius: 13px;
      display: grid;
      place-items: center;
      background: var(--surf);
      box-shadow: var(--shadow);
      transition: transform 0.12s;
    }
    .ctl button:active {
      transform: scale(0.92);
    }
    .ctl button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .ctl svg {
      width: 20px;
      height: 20px;
    }
    .attr {
      position: absolute;
      right: 8px;
      bottom: 8px;
      z-index: 2;
      font-size: 11px;
      line-height: 1.3;
      padding: 3px 8px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--surf) 88%, transparent);
      color: var(--ink);
    }
    .attr a {
      color: inherit;
      text-decoration: underline;
    }
    .msg {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
    }
    .msg a {
      color: inherit;
      text-decoration: underline;
    }
    @media (prefers-reduced-motion: reduce) {
      .mk,
      .ctl button {
        transition: none;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // Re-attached (page or popup shown again): start once visible.
    if (this.hasUpdated && !this.map) this.seen.observe(this);
  }

  firstUpdated(): void {
    this.seen.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.seen.disconnect();
    this.destroy();
  }

  private destroy(): void {
    this.glMarkers.forEach((m) => m.remove());
    this.glMarkers = [];
    this.map?.remove();
    this.map = undefined;
    this.ready = false;
    this.styleReady = false;
  }

  private isDark(): boolean {
    return this.dark ?? getComputedStyle(this).colorScheme.includes("dark");
  }

  private mapStyle(dark: boolean): StyleSpecification {
    this.styleDark = dark;
    const s = this.lib!.osm({ theme: dark ? "colorful-dark" : "colorful", colors: dark ? HA_DARK : HA_LIGHT, urls: { base: TILES } });
    // The TileJSON lists relative tile URLs, which MapLibre's (blob) worker
    // cannot resolve: give the source its absolute template directly.
    const sources = Object.fromEntries(
      Object.entries(s.sources).map(([k, v]) => [
        k,
        v.type === "vector" ? { type: "vector" as const, tiles: [`${TILES}/tiles/osm/{z}/{x}/{y}`], minzoom: 0, maxzoom: 14 } : v,
      ]),
    );
    return { ...s, sources, sky: { ...s.sky, "atmosphere-blend": 0.5 } };
  }

  private async create(): Promise<void> {
    try {
      this.lib = await loadLib();
    } catch {
      this.failed = true;
      return;
    }
    const box = this.renderRoot.querySelector<HTMLElement>(".gl");
    if (!this.isConnected || !box || this.map) return;
    const { gl } = this.lib;
    const fit = this.bounds();
    try {
      this.map = new gl.Map({
        container: box,
        style: this.mapStyle(this.isDark()),
        bounds: fit?.bounds,
        center: fit ? undefined : [2.35, 48.85],
        zoom: fit ? undefined : 5,
        fitBoundsOptions: { padding: PAD, maxZoom: this.zoom ?? this.fitMax },
        minZoom: MIN_Z,
        maxZoom: MAX_Z,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        localIdeographFontFamily: "sans-serif",
      });
    } catch {
      this.failed = true; // no WebGL
      return;
    }
    const map = this.map;
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.scrollZoom.setWheelZoomRate(1 / 200);
    map.getCanvas().setAttribute("aria-label", `${this.label}. Flèches pour se déplacer, plus et moins pour zoomer.`);
    map.getCanvas().setAttribute("role", "region");
    map.getCanvas().setAttribute("aria-roledescription", "carte");
    // A move started by the person (not by a fit) stops the automatic fit.
    map.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) {
        this.dragged = true;
        this.moved = true;
      }
    });
    map.on("zoomend", () => this.drawMarkers());
    map.on("style.load", () => {
      this.styleReady = true;
      this.drawZones();
    });
    map.on("load", () => (this.ready = true));
    map.getContainer().addEventListener("pointerdown", () => (this.dragged = false), true);
    map.getContainer().addEventListener(
      "click",
      (e) => {
        if (!this.dragged) return;
        this.dragged = false;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
    if (fit && this.zoom !== undefined) map.jumpTo({ center: fit.center, zoom: this.zoom });
    this.drawMarkers();
  }

  protected updated(changed: PropertyValues): void {
    if (!this.map) return;
    const dark = this.isDark();
    if (dark !== this.styleDark) {
      this.styleReady = false;
      this.map.setStyle(this.mapStyle(dark));
    }
    if (changed.has("zones")) this.drawZones();
    if (changed.has("markers")) {
      this.drawMarkers();
      if (!this.moved) this.fit(false);
    }
  }

  // ---- View ----

  private bounds(): { bounds: [[number, number], [number, number]]; center: [number, number] } | undefined {
    const pts: [number, number][] = this.markers.map((m) => [m.lon, m.lat]);
    for (const z of this.zones) pts.push(...circle(z).filter((_, i) => i % 16 === 0));
    if (!pts.length) return undefined;
    const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const w = Math.min(...lons), e = Math.max(...lons), s = Math.min(...lats), n = Math.max(...lats);
    return { bounds: [[w, s], [e, n]], center: [(w + e) / 2, (s + n) / 2] };
  }

  private fit(animate: boolean): void {
    const f = this.bounds();
    if (!this.map || !f) return;
    const duration = animate && !reducedMotion() ? 400 : 0;
    if (this.zoom !== undefined) this.map.easeTo({ center: f.center, zoom: this.zoom, duration });
    else this.map.fitBounds(f.bounds, { padding: PAD, maxZoom: this.fitMax, duration });
  }

  private reset = (): void => {
    this.fit(true);
    this.moved = false;
  };

  private zoomBy(dir: 1 | -1): void {
    if (!this.map) return;
    const opts = { duration: reducedMotion() ? 0 : 250 };
    if (dir > 0) this.map.zoomIn(opts);
    else this.map.zoomOut(opts);
    this.moved = true;
  }

  // ---- Layers ----

  /** The zones (home) as a tinted circle with an outline, in V3 teal. */
  private drawZones(): void {
    const map = this.map;
    if (!map || !this.styleReady) return;
    const teal = getComputedStyle(this).getPropertyValue("--teal").trim() || "#0E8576";
    const data = {
      type: "FeatureCollection" as const,
      features: this.zones.map((z) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [circle(z)] } })),
    };
    const src = map.getSource("kh-zones") as GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      map.setPaintProperty("kh-zones-fill", "fill-color", teal);
      map.setPaintProperty("kh-zones-line", "line-color", teal);
      return;
    }
    map.addSource("kh-zones", { type: "geojson", data });
    map.addLayer({ id: "kh-zones-fill", type: "fill", source: "kh-zones", paint: { "fill-color": teal, "fill-opacity": 0.16 } });
    map.addLayer({ id: "kh-zones-line", type: "line", source: "kh-zones", paint: { "line-color": teal, "line-opacity": 0.6, "line-width": 2 } });
  }

  private markerTemplate(m: MapMarker): TemplateResult {
    const label = `${m.label}, ${m.home ? "à la maison" : "ailleurs"}`;
    const obj = m.kind === "object";
    const tone = obj ? (m.tone ?? (m.home ? "teal" : "amber")) : "";
    const cls = `mk ${obj ? `obj ${tone}` : m.home ? "home" : ""}`;
    const inner = obj
      ? icon(m.icon ?? "pin")
      : m.image
        ? html`<img src=${m.image} alt="" width="48" height="48" decoding="async" draggable="false" />`
        : m.label.charAt(0).toUpperCase();
    return m.onClick
      ? html`<button class=${cls} type="button" aria-label=${label} @click=${m.onClick}>${inner}</button>`
      : html`<span class=${cls} role="img" aria-label=${label}>${inner}</span>`;
  }

  /** HTML markers; the ones that would overlap at this zoom share one group. */
  private drawMarkers(): void {
    const map = this.map;
    if (!map || !this.lib) return;
    this.glMarkers.forEach((m) => m.remove());
    this.glMarkers = [];
    const groups: { x: number; y: number; items: MapMarker[] }[] = [];
    for (const m of this.markers) {
      const p = map.project([m.lon, m.lat]);
      const g = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < MERGE_PX);
      if (g) g.items.push(m);
      else groups.push({ x: p.x, y: p.y, items: [m] });
    }
    for (const g of groups) {
      const people = g.items.filter((m) => m.kind !== "object");
      const objects = g.items.filter((m) => m.kind === "object");
      const allHome = g.items.every((m) => m.home);
      const el = document.createElement("div");
      render(
        html`<div class="group">
          ${people.length ? html`<div class="stack">${people.map((m) => this.markerTemplate(m))}</div>` : nothing}
          ${objects.length ? html`<div class="stack">${objects.map((m) => this.markerTemplate(m))}</div>` : nothing}
          ${allHome && people.length ? html`<span class="tag" aria-hidden="true">Maison</span>` : nothing}
        </div>`,
        el,
      );
      const first = g.items[0];
      const at = g.items.length > 1 ? map.unproject([g.x, g.y]) : { lng: first.lon, lat: first.lat };
      this.glMarkers.push(new this.lib.gl.Marker({ element: el, anchor: "center" }).setLngLat([at.lng, at.lat]).addTo(map));
    }
  }

  render() {
    return html`<div class="gl"></div>
      ${this.failed
        ? html`<div class="msg"><span>Carte indisponible. <a href="/map">Ouvrir la carte de Home Assistant</a></span></div>`
        : nothing}
      <div class="ctl">
        <button type="button" aria-label="Zoomer" ?disabled=${!this.ready} @click=${() => this.zoomBy(1)}>${icon("plus")}</button>
        <button type="button" aria-label="Dézoomer" ?disabled=${!this.ready} @click=${() => this.zoomBy(-1)}>${icon("minus")}</button>
        ${this.moved
          ? html`<button type="button" aria-label=${this.resetLabel} title=${this.resetLabel} @click=${this.reset}>${icon("people")}</button>`
          : nothing}
      </div>
      <span class="attr"
        >© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, ©
        <a href="https://versatiles.org" target="_blank" rel="noopener">VersaTiles</a></span
      >`;
  }
}
customElements.define("kh3-map", Kh3Map);

declare global {
  interface HTMLElementTagNameMap {
    "kh3-map": Kh3Map;
  }
}
