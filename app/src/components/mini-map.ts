import { LitElement, css, html, nothing } from "lit";
import { store } from "../store.ts";

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  picture?: string;
  icon?: string;
  /** GPS accuracy in metres, drawn as a halo. */
  accuracy?: number;
}

const TILE = 256;

// Web Mercator: degrees -> world pixels at zoom z.
const px = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const py = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};

/**
 * Small map without a map library: OpenStreetMap tiles laid out around the
 * markers (darkened with the theme), markers with a photo
 * or an icon. Zoom fits every marker.
 */
export class KhMiniMap extends LitElement {
  static properties = { markers: { attribute: false }, height: { type: Number }, width: { state: true } };
  declare markers: MapMarker[];
  declare height: number;
  declare width: number;
  private resize = new ResizeObserver(([e]) => (this.width = Math.round(e.contentRect.width)));

  constructor() {
    super();
    this.markers = [];
    this.height = 220;
    this.width = 0;
  }

  static styles = css`
    :host {
      display: block;
    }
    .map {
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      background: #1d2124;
    }
    img.tile.dark {
      /* Night map from the standard tiles: invert, then bring the hues back. */
      filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.7);
    }
    img.tile {
      position: absolute;
      width: 256px;
      height: 256px;
      user-select: none;
      -webkit-user-drag: none;
    }
    .halo {
      position: absolute;
      border-radius: 50%;
      background: rgba(33, 150, 243, 0.18);
      border: 1px solid rgba(33, 150, 243, 0.5);
      transform: translate(-50%, -50%);
    }
    .marker {
      position: absolute;
      transform: translate(-50%, -100%);
      display: grid;
      justify-items: center;
      animation: drop 520ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .marker .pin {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 3px 10px rgb(0 0 0 / 0.4);
      background: #2196f3;
      display: grid;
      place-items: center;
      color: #fff;
      overflow: hidden;
    }
    .marker .pin img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .marker .stem {
      width: 3px;
      height: 8px;
      background: #fff;
    }
    .marker .label {
      margin-bottom: 4px;
      padding: 2px 8px;
      border-radius: 8px;
      background: rgb(0 0 0 / 0.6);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .credit {
      position: absolute;
      right: 6px;
      bottom: 4px;
      font-size: 0.625rem;
      color: rgb(255 255 255 / 0.75);
      text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
    }
    @keyframes drop {
      from {
        transform: translate(-50%, -160%);
        opacity: 0;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
  }

  render() {
    const W = this.width, H = this.height;
    const ms = this.markers.filter((m) => isFinite(m.lat) && isFinite(m.lon));
    if (!W || !ms.length) return html`<div class="map" style="height:${H}px"></div>`;
    // Highest zoom where every marker fits with a margin.
    let z = 16;
    for (; z > 3; z--) {
      const xs = ms.map((m) => px(m.lon, z)), ys = ms.map((m) => py(m.lat, z));
      if (Math.max(...xs) - Math.min(...xs) < W - 90 && Math.max(...ys) - Math.min(...ys) < H - 90) break;
    }
    const xs = ms.map((m) => px(m.lon, z)), ys = ms.map((m) => py(m.lat, z));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2 - 16;
    const left = cx - W / 2, top = cy - H / 2;
    const dark = !!store.hass?.themes.darkMode;
    const tiles = [];
    const n = 2 ** z;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + W) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + H) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push(html`<img class="tile ${dark ? "dark" : ""}" alt="" loading="lazy" draggable="false"
          style="left:${tx * TILE - left}px; top:${ty * TILE - top}px"
          src="https://tile.openstreetmap.org/${z}/${wx}/${ty}.png" />`);
      }
    }
    // Metres per pixel at this latitude and zoom, for the accuracy halo.
    const mpp = (lat: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
    return html`<div class="map" style="height:${H}px" role="img" aria-label="Carte : ${ms.map((m) => m.label).join(", ")}">
      ${tiles}
      ${ms.map((m) => {
        const x = px(m.lon, z) - left, y = py(m.lat, z) - top;
        const r = m.accuracy ? Math.min(160, m.accuracy / mpp(m.lat)) : 0;
        return html`${r > 12 ? html`<span class="halo" style="left:${x}px; top:${y}px; width:${2 * r}px; height:${2 * r}px"></span>` : nothing}
          <span class="marker" style="left:${x}px; top:${y}px">
            <span class="label">${m.label}</span>
            <span class="pin">${m.picture ? html`<img src=${m.picture} alt="" />` : html`<ha-icon icon=${m.icon ?? "mdi:map-marker"}></ha-icon>`}</span>
            <span class="stem"></span>
          </span>`;
      })}
      <span class="credit">© les contributeurs d'OpenStreetMap</span>
    </div>`;
  }
}
customElements.define("kh-mini-map", KhMiniMap);
