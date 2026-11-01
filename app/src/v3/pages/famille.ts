import { css, html, nothing, type TemplateResult } from "lit";
import { ringPhone } from "../../actions.ts";
import { config } from "../../config.ts";
import { ago } from "../../format.ts";
import { openPerson, openTracker } from "../../popups/open.ts";
import { EntitiesController, store } from "../../store.ts";
import type { HassEntity, HomeAssistant } from "../../types.ts";
import { f0, f1, num } from "../data.ts";
import { icon } from "../icons.ts";
import { objectIcon, type MapMarker } from "../map.ts";
import { Page } from "../page.ts";
import { isDark } from "../theme.ts";

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
  lost?: boolean;
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
 * Famille: where everyone is. The shared V3 map (CARTO tiles like Home
 * Assistant's map; drag, pinch, wheel) with the family's avatars and tracked
 * objects; the people (home or away, phone battery, "Faire sonner") and the
 * objects on the side. On phones the people come first, then the map, then the objects.
 */
export class Kh3Famille extends Page {
  static properties = { ...Page.properties, rung: { state: true } };
  /** Person whose phone was just asked to ring. */
  declare rung?: string;
  private rungTimer = 0;

  constructor() {
    super();
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.rungTimer);
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
        display: block;
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        background: var(--surf2);
        height: 300px;
        isolation: isolate;
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
      out.push({ id: t.entity, kind: "object", key: t.entity, name: t.name, lat: pos[0], lon: pos[1], home: s.state === "home", icon: objectIcon(t.icon), mdi: t.icon, lost: !!s.attributes.is_lost });
    }
    return out;
  }

  // ---- Map ----

  private map(hass: HomeAssistant, spots: Spot[]): TemplateResult {
    if (!spots.length) {
      return html`<section class="map nomap" aria-label="Carte">
        <div>${icon("pin", 28)}<p>Aucune position connue pour l'instant.</p></div>
      </section>`;
    }
    const zone = hass.states["zone.home"];
    const home = position(zone);
    const markers: MapMarker[] = spots.map((s) => ({
      id: s.id,
      lat: s.lat,
      lon: s.lon,
      label: s.name,
      kind: s.kind,
      image: s.picture,
      icon: s.icon,
      home: s.home,
      tone: s.kind === "object" ? (s.lost ? "red" : s.home ? "teal" : "amber") : undefined,
      onClick: s.kind === "person" ? () => openPerson(s.key) : () => openTracker(s.id, s.mdi),
    }));
    const dark = isDark(this.p.theme, matchMedia("(prefers-color-scheme: dark)").matches);
    return html`<kh3-map
      class="map"
      label="Carte des positions"
      .markers=${markers}
      .zones=${home ? [{ lat: home[0], lon: home[1], radius: Number(zone!.attributes.radius) || 100, label: "Maison" }] : []}
      .dark=${dark}
    ></kh3-map>`;
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
            @click=${() => this.ring(key, phone.notify!)}>${icon(this.rung === key ? "check" : "bell", 16)}${this.rung === key ? "Ça sonne" : "Faire sonner"}</button>
            <span class="sr" aria-live="polite">${this.rung === key ? `Le téléphone de ${name} sonne` : ""}</span>`
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
