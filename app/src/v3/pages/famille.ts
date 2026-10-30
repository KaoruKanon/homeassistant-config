import { css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { ringPhone } from "../../actions.ts";
import { config } from "../../config.ts";
import { ago } from "../../format.ts";
import { openPerson, openTracker } from "../../popups/open.ts";
import { EntitiesController, store } from "../../store.ts";
import type { HassEntity, HomeAssistant } from "../../types.ts";
import { f0, f1, num } from "../data.ts";
import { icon } from "../icons.ts";
import { Page } from "../page.ts";
import { isDark } from "../theme.ts";

const TILE = 256;
const MAX_ZOOM = 17;
const MIN_ZOOM = 3;
/** Markers closer than this (px) are drawn as one group. */
const MERGE_PX = 44;
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Spot {
  id: string;
  kind: "person" | "object";
  key: string;
  name: string;
  lat: number;
  lon: number;
  home: boolean;
  picture?: string;
  icon: string;
  mdi: string;
}

/** Web Mercator: world pixel coordinates at a zoom level. */
function project(lat: number, lon: number, z: number): [number, number] {
  const s = TILE * 2 ** z;
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return [((lon + 180) / 360) * s, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s];
}

/** Distance in km (haversine). */
function km(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function position(s?: HassEntity): [number, number] | undefined {
  const lat = Number(s?.attributes.latitude), lon = Number(s?.attributes.longitude);
  return s?.attributes.latitude !== undefined && isFinite(lat) && isFinite(lon) ? [lat, lon] : undefined;
}

/** MDI name from the config to a V3 line icon. */
function objectIcon(mdi: string): string {
  if (/key/.test(mdi)) return "key";
  if (/wallet/.test(mdi)) return "wallet";
  if (/camera/.test(mdi)) return "camera";
  if (/bike|bicycle/.test(mdi)) return "bike";
  if (/scooter/.test(mdi)) return "scooter";
  if (/phone|cellphone/.test(mdi)) return "phone";
  return "pin";
}

/** "18:12", "hier 18:12", "lundi", "12 oct." for the start of a state. */
function sinceWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return timeFmt.format(d);
  if (days === 1) return `hier ${timeFmt.format(d)}`;
  if (days < 7) return dayFmt.format(d);
  return `le ${dateFmt.format(d)}`;
}

/** Zone name of a state (home, a zone, or away). */
function placeLabel(s: HassEntity): string {
  if (s.state === "home") return "À la maison";
  if (s.state === "not_home") return "Absent";
  if (s.state === "unknown" || s.state === "unavailable") return "Position inconnue";
  return cap(s.state);
}

/**
 * Famille: where everyone is. A light map of OpenStreetMap tiles (plain
 * images, no map library) with the family's avatars and tracked objects;
 * the people (home or away, phone battery, "Faire sonner") and the objects
 * on the side. On phones the people come first, then the map, then the objects.
 */
export class Kh3Famille extends Page {
  static properties = { ...Page.properties, size: { state: true }, zoomOffset: { state: true }, rung: { state: true } };
  /** Map box in CSS pixels. */
  declare size: { w: number; h: number };
  /** Zoom chosen with the +/- buttons, relative to the zoom that fits everyone. */
  declare zoomOffset: number;
  /** Person whose phone was just asked to ring. */
  declare rung?: string;
  private observer?: ResizeObserver;
  private observed?: Element;
  private rungTimer = 0;

  constructor() {
    super();
    this.size = { w: 0, h: 0 };
    this.zoomOffset = 0;
    new EntitiesController(this, () => this.watched());
  }

  private people(): string[] {
    return Object.keys(config.people).filter((k) => !config.people[k].device && store.hass?.states[`person.${k}`]);
  }

  private battery(key: string): { level?: string; charging?: string } {
    const fav = config.people[key]?.favorites?.find((f) => f.type === "battery");
    return fav && fav.type === "battery" ? { level: fav.entity, charging: fav.charging } : {};
  }

  private watched(): string[] {
    return [
      "zone.home",
      ...this.people().flatMap((k) => {
        const p = config.people[k].phone;
        const b = this.battery(k);
        return [`person.${k}`, p?.tracker, p?.ping, b.level, b.charging];
      }),
      ...config.system.trackers.map((t) => t.entity),
    ].filter((x): x is string => !!x);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.observer = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
      if (w !== this.size.w || h !== this.size.h) this.size = { w, h };
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observed = undefined;
    window.clearTimeout(this.rungTimer);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // The map box is re-created when the layout changes (phone, no positions): watch the current one.
    const map = this.renderRoot.querySelector(".map") ?? undefined;
    if (map !== this.observed && this.observer) {
      this.observer.disconnect();
      if (map) this.observer.observe(map);
      this.observed = map;
    }
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .wrap {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }
      header {
        margin: 0;
      }
      header .st {
        font-size: 14px;
      }
      .side {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 0;
        min-width: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .card .h {
        font-size: 17px;
      }

      /* People. */
      .pc {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 8px 8px;
        border-radius: 18px;
        background: var(--surf2);
        min-width: 0;
      }
      .who {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
        min-height: 64px;
        padding: 4px;
        border-radius: 14px;
        text-align: left;
      }
      .who .nm {
        font-size: 16px;
        font-weight: 700;
      }
      .who .st {
        display: block;
      }
      .av {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        flex: none;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: var(--violetTint);
        color: var(--violet);
        font-weight: 700;
        font-size: 20px;
        box-shadow: 0 0 0 3px var(--muted);
      }
      .av.home {
        box-shadow: 0 0 0 3px var(--teal);
      }
      .av img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .pc .btn {
        background: var(--surf);
        flex: none;
      }
      .pc .btn.done {
        color: var(--teal);
      }
      .low {
        color: var(--red);
        font-weight: 600;
      }

      /* Objects. */
      .objs {
        flex: 1;
        min-height: 0;
      }
      .objs .rows {
        overflow-y: auto;
        scrollbar-width: thin;
        min-height: 0;
      }
      .obj {
        min-height: 56px;
      }
      .obj .ico {
        background: var(--tealTint);
        color: var(--teal);
      }
      .obj.away .ico {
        background: var(--amberTint);
        color: var(--amberInk);
      }
      .obj.lost .ico {
        background: var(--redTint);
        color: var(--red);
      }
      .obj .grow {
        flex: 1;
        min-width: 0;
      }
      .obj > svg {
        color: var(--muted);
      }

      /* Map. */
      .map {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        background: var(--surf2);
        height: 300px;
        isolation: isolate;
      }
      .tiles {
        position: absolute;
        inset: 0;
      }
      .tiles img {
        position: absolute;
        width: 256px;
        height: 256px;
        user-select: none;
        pointer-events: none;
      }
      .tiles.dark img {
        filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.5);
      }
      .zone {
        position: absolute;
        border-radius: 999px;
        background: color-mix(in srgb, var(--teal) 18%, transparent);
        border: 2px solid color-mix(in srgb, var(--teal) 60%, transparent);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .group {
        position: absolute;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
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
        background: var(--violetTint);
        color: var(--violet);
        font-weight: 700;
        font-size: 17px;
        border: 3px solid var(--surf);
        box-shadow: var(--shadow);
      }
      .mk img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .mk.obj-mk {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: var(--tealTint);
        color: var(--teal);
      }
      .mk.obj-mk svg {
        width: 20px;
        height: 20px;
      }
      .tag {
        height: 28px;
        padding: 0 10px;
        border-radius: 99px;
        background: var(--surf);
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        white-space: nowrap;
        box-shadow: var(--shadow);
      }
      .zoom {
        position: absolute;
        right: 12px;
        top: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 1;
      }
      .zoom .rb {
        background: var(--surf);
        box-shadow: var(--shadow);
      }
      .attr {
        position: absolute;
        right: 8px;
        bottom: 8px;
        font-size: 11px;
        color: var(--ink);
        background: var(--surf);
        padding: 3px 8px;
        border-radius: 8px;
        z-index: 1;
      }
      .attr a {
        text-decoration: underline;
      }
      .nomap {
        display: grid;
        place-items: center;
        text-align: center;
        padding: 20px;
        color: var(--muted);
      }

      /* Tablet portrait: people and objects side by side under the map. */
      @container (min-width: 700px) {
        .map {
          height: 380px;
        }
        .side {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }
      }

      /* Wall tablet and desktop: map on the left, people and objects on the right. */
      @container (min-width: 1000px) {
        .wrap {
          grid-template-columns: minmax(0, 1fr) 400px;
          grid-template-rows: 56px minmax(0, 1fr);
          height: calc(100vh - 32px);
          height: calc(100dvh - 32px);
          min-height: 560px;
        }
        header {
          grid-column: 1 / 3;
        }
        .map {
          grid-column: 1;
          grid-row: 2;
          height: auto;
        }
        .side {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          align-items: stretch;
        }
      }
      @container (max-width: 699px) {
        .pc .btn {
          min-height: 44px;
        }
      }
    `,
  ];

  // ---- Data ----

  private spots(hass: HomeAssistant): Spot[] {
    const out: Spot[] = [];
    for (const k of this.people()) {
      const s = hass.states[`person.${k}`];
      const tracker = config.people[k].phone?.tracker;
      const pos = position(s) ?? position(tracker ? hass.states[tracker] : undefined);
      if (!pos) continue;
      out.push({
        id: s.entity_id, kind: "person", key: k, name: cap(String(s.attributes.friendly_name ?? k)), lat: pos[0], lon: pos[1],
        home: s.state === "home", picture: s.attributes.entity_picture as string | undefined, icon: "people", mdi: "mdi:account",
      });
    }
    for (const t of config.system.trackers) {
      const s = hass.states[t.entity];
      const pos = position(s);
      if (!s || !pos) continue;
      out.push({ id: t.entity, kind: "object", key: t.entity, name: t.name, lat: pos[0], lon: pos[1], home: s.state === "home", icon: objectIcon(t.icon), mdi: t.icon });
    }
    return out;
  }

  /** Highest zoom where every point (and the home zone) fits the box. */
  private fitZoom(points: [number, number][], w: number, h: number): number {
    if (points.length < 2) return 16;
    for (let z = MAX_ZOOM; z > MIN_ZOOM; z--) {
      const px = points.map(([la, lo]) => project(la, lo, z));
      const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
      if (Math.max(...xs) - Math.min(...xs) <= w - 120 && Math.max(...ys) - Math.min(...ys) <= h - 120) return Math.min(z, 16);
    }
    return MIN_ZOOM;
  }

  // ---- Map ----

  private marker(s: Spot): TemplateResult {
    const where = s.home ? "à la maison" : "ailleurs";
    if (s.kind === "person") {
      return html`<button class="mk" type="button" aria-label="${s.name}, ${where}" @click=${() => openPerson(s.key)}>
        ${s.picture ? html`<img src=${s.picture} alt="" width="48" height="48" loading="lazy" decoding="async" />` : s.name.charAt(0)}
      </button>`;
    }
    return html`<button class="mk obj-mk" type="button" aria-label="${s.name}, ${where}" @click=${() => openTracker(s.id, s.mdi)}>${icon(s.icon)}</button>`;
  }

  private map(hass: HomeAssistant, spots: Spot[]): TemplateResult {
    const zone = hass.states["zone.home"];
    const home = position(zone);
    const { w, h } = this.size;
    if (!spots.length) {
      return html`<section class="map nomap" aria-label="Carte">
        <div>${icon("pin", 28)}<p>Aucune position connue pour l'instant.</p></div>
      </section>`;
    }
    const pts: [number, number][] = spots.map((s) => [s.lat, s.lon]);
    if (home) pts.push(home);
    const fit = this.fitZoom(pts, w || 600, h || 400);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM + 1, fit + this.zoomOffset));
    // Centre: middle of everyone's box.
    const px = pts.map(([la, lo]) => project(la, lo, z));
    const cx = (Math.min(...px.map((p) => p[0])) + Math.max(...px.map((p) => p[0]))) / 2;
    const cy = (Math.min(...px.map((p) => p[1])) + Math.max(...px.map((p) => p[1]))) / 2;
    const left = cx - w / 2, top = cy - h / 2;
    const n = 2 ** z;
    const tiles: TemplateResult[] = [];
    if (w && h) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
          const x = ((tx % n) + n) % n;
          tiles.push(html`<img src="https://tile.openstreetmap.org/${z}/${x}/${ty}.png" alt="" width="256" height="256" loading="lazy" decoding="async"
            referrerpolicy="strict-origin-when-cross-origin" style="left:${Math.round(tx * TILE - left)}px;top:${Math.round(ty * TILE - top)}px" />`);
        }
      }
    }
    // Groups of markers that would overlap.
    const groups: { x: number; y: number; items: Spot[] }[] = [];
    for (const s of spots) {
      const [x, y] = project(s.lat, s.lon, z);
      const g = groups.find((g) => Math.hypot(g.x - x, g.y - y) < MERGE_PX);
      if (g) g.items.push(s);
      else groups.push({ x, y, items: [s] });
    }
    let zoneEl: TemplateResult | typeof nothing = nothing;
    if (home) {
      const [zx, zy] = project(home[0], home[1], z);
      const metersPerPx = (156543.03 * Math.cos((home[0] * Math.PI) / 180)) / n;
      const d = Math.max(24, (2 * (Number(zone!.attributes.radius) || 100)) / metersPerPx);
      zoneEl = html`<span class="zone" style="left:${zx - left}px;top:${zy - top}px;width:${d}px;height:${d}px"></span>`;
    }
    const dark = isDark(this.p.theme, matchMedia("(prefers-color-scheme: dark)").matches);
    return html`<section class="map" aria-label="Carte des positions">
      <div class="tiles ${dark ? "dark" : ""}" aria-hidden="true">${tiles}</div>
      ${zoneEl}
      ${w
        ? groups.map((g) => {
            const people = g.items.filter((s) => s.kind === "person");
            const objects = g.items.filter((s) => s.kind === "object");
            const allHome = g.items.every((s) => s.home);
            return html`<div class="group" style="left:${g.x - left}px;top:${g.y - top}px">
              ${people.length ? html`<div class="stack">${people.map((s) => this.marker(s))}</div>` : nothing}
              ${objects.length ? html`<div class="stack">${objects.map((s) => this.marker(s))}</div>` : nothing}
              ${allHome && people.length ? html`<span class="tag" aria-hidden="true">Maison</span>` : nothing}
            </div>`;
          })
        : nothing}
      <div class="zoom">
        <button class="rb" type="button" aria-label="Zoomer" ?disabled=${z >= MAX_ZOOM + 1} @click=${() => this.zoomOffset++}>${icon("plus")}</button>
        <button class="rb" type="button" aria-label="Dézoomer" ?disabled=${z <= MIN_ZOOM} @click=${() => this.zoomOffset--}>${icon("minus")}</button>
        ${this.zoomOffset
          ? html`<button class="rb" type="button" aria-label="Voir tout le monde" @click=${() => (this.zoomOffset = 0)}>${icon("people")}</button>`
          : nothing}
      </div>
      <span class="attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></span>
    </section>`;
  }

  // ---- People and objects ----

  private ring(key: string, notify: string): void {
    void ringPhone(notify);
    this.rung = key;
    window.clearTimeout(this.rungTimer);
    this.rungTimer = window.setTimeout(() => (this.rung = undefined), 5000);
  }

  private person(hass: HomeAssistant, key: string, home?: [number, number]): TemplateResult {
    const s = hass.states[`person.${key}`];
    const phone = config.people[key].phone;
    const name = cap(String(s.attributes.friendly_name ?? key));
    const at = s.state === "home";
    const pos = position(s) ?? position(phone?.tracker ? hass.states[phone.tracker] : undefined);
    const far = !at && pos && home ? km(pos, home) : undefined;
    const where = `${placeLabel(s)} depuis ${sinceWhen(s.last_changed)}${far !== undefined && far >= 0.2 ? `, à ${far < 10 ? f1(far) : f0(far)} km` : ""}`;
    const b = this.battery(key);
    const level = num(b.level);
    const charging = b.charging ? hass.states[b.charging]?.state === "on" : false;
    const wifi = phone?.ping ? hass.states[phone.ping]?.state === "on" : false;
    const phoneLine = [
      level !== undefined ? `Téléphone ${f0(level)} %` : "",
      charging ? "en charge" : "",
      wifi ? "Wi-Fi" : "",
    ].filter(Boolean).join(", ");
    const pic = s.attributes.entity_picture as string | undefined;
    return html`<div class="pc">
      <button class="who" type="button" aria-label="${name} : ${where}${phoneLine ? `. ${phoneLine}` : ""}" @click=${() => openPerson(key)}>
        <span class="av ${at ? "home" : ""}" aria-hidden="true">
          ${pic ? html`<img src=${pic} alt="" width="56" height="56" loading="lazy" decoding="async" />` : name.charAt(0)}
        </span>
        <span style="min-width:0" aria-hidden="true">
          <span class="nm ell">${name}</span>
          <span class="st ell">${where}</span>
          ${phoneLine
            ? html`<span class="st ell ${level !== undefined && level < 20 && !charging ? "low" : ""}">${phoneLine}</span>`
            : nothing}
        </span>
      </button>
      ${phone?.notify
        ? html`<button class="btn ${this.rung === key ? "done" : ""}" type="button" aria-label="Faire sonner le téléphone de ${name}"
            @click=${() => this.ring(key, phone.notify!)}>${icon(this.rung === key ? "check" : "bell", 16)}${this.rung === key ? "Ça sonne" : "Faire sonner"}</button>`
        : nothing}
    </div>`;
  }

  private objects(hass: HomeAssistant, home?: [number, number]): TemplateResult {
    const list = config.system.trackers.filter((t) => hass.states[t.entity]);
    return html`<section class="card objs" aria-label="Objets suivis">
      <h2 class="h">Objets suivis</h2>
      ${list.length
        ? html`<div class="rows">
            ${list.map((t) => {
              const s = hass.states[t.entity];
              const at = s.state === "home";
              const lost = !!s.attributes.is_lost;
              const pos = position(s);
              const far = !at && pos && home ? km(pos, home) : undefined;
              const seen = (s.attributes.last_seen as string | undefined) ?? s.last_updated;
              const label = lost
                ? "Signalé perdu"
                : at
                  ? "À la maison"
                  : `${s.state === "not_home" ? "Ailleurs" : placeLabel(s)}${far !== undefined ? `, à ${far < 10 ? f1(far) : f0(far)} km` : ""}`;
              return html`<button class="row obj ${at ? "" : "away"} ${lost ? "lost" : ""}" type="button" @click=${() => openTracker(t.entity, t.icon)}>
                <span class="ico">${icon(objectIcon(t.icon))}</span>
                <span class="grow"><span class="nm ell">${t.name}</span><span class="st ell" style="display:block">${label}, vu ${ago(seen)}</span></span>
                ${icon("chevronR", 18)}
              </button>`;
            })}
          </div>`
        : html`<p class="empty">Aucun objet suivi.</p>`}
    </section>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const keys = this.people();
    const home = position(hass.states["zone.home"]);
    const homeNames = keys.filter((k) => hass.states[`person.${k}`].state === "home").map((k) => cap(String(hass.states[`person.${k}`].attributes.friendly_name ?? k)));
    const summary = !keys.length
      ? ""
      : homeNames.length === keys.length
        ? "Tout le monde est à la maison"
        : homeNames.length
          ? `${homeNames.join(" et ")} à la maison`
          : "Personne à la maison";
    const people = html`<section class="card" aria-label="Personnes">
      <h2 class="h">Personnes</h2>
      ${keys.length ? keys.map((k) => this.person(hass, k, home)) : html`<p class="empty">Personne n'est suivi.</p>`}
    </section>`;
    const map = this.map(hass, this.spots(hass));
    return html`<div class="wrap">
      <header class="top">
        <h1 class="page-title">Famille</h1>
        <span class="st">${summary}</span>
      </header>
      ${this.p.phone
        ? html`${people}${map}${this.objects(hass, home)}`
        : html`${map}<div class="side">${people}${this.objects(hass, home)}</div>`}
    </div>`;
  }
}
customElements.define("kh3-famille", Kh3Famille);
