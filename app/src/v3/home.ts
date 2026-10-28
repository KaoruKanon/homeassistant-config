import { LitElement, css, html, nothing } from "lit";
import { isPending, needsConfirmation, openMoreInfo, runScript, setLights, toggle } from "../actions.ts";
import "../components/energy-card.ts";
import { pcPress } from "../components/gestures.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/swipe.ts";
import "../v2/floorplan.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Computer, type Favorite } from "../config.ts";
import { formatNumber, isActive, isUnavailable, stateIcon, stateLabel } from "../format.ts";
import { alarmLook, openAlarm, openComputer, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { currentPerson, entityName, type HouseModel, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { FROG_SKY, forecastDays } from "../weather-utils.ts";
import "./light.ts";
import { ring, ui } from "./theme.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** The colour of a device's icon while it is on, by kind. */
const KIND_COLOR: Record<string, string> = {
  light: "amber",
  switch: "blue",
  computer: "blue",
  fan: "teal",
  media_player: "purple",
  opening: "light-blue",
  motion: "green",
};

const FAVORITES = "favoris";
const PLAN = "plan";

/** The device categories, in the order they are shown, with their heading. */
const GROUPS: [Device["kind"], string][] = [
  ["light", "Lumières"],
  ["computer", "Ordinateurs"],
  ["switch", "Prises et appareils"],
  ["fan", "Ventilation"],
  ["media_player", "Télévisions et enceintes"],
  ["opening", "Ouvertures"],
];

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const upper = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

interface Device {
  id: string;
  name: string;
  kind: keyof typeof KIND_COLOR;
  icon?: string;
  computer?: Computer;
}

/**
 * V3 home, after V1 (itself after Apple Home), UI Lovelace Minimalist and
 * Cansaas. One reading order, the same on every screen:
 *
 *   1. who and when: time, greeting; the house's state as categories;
 *      the family;
 *   2. what to do in one tap: the shortcuts;
 *   3. the rooms: a filter per room (Favoris first), the chosen room's
 *      climate and lights, then its devices, all in one tile shape;
 *   4. beside them, what the day holds: now playing (only while something
 *      plays), the weather, the energy, the agenda.
 *
 * Section titles sit outside the cards; colour only marks what is on.
 */
export class Kh3Home extends LitElement {
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true }, wall: { type: Boolean }, room: { state: true } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  declare wall: boolean;
  /** The room filter: "favoris" or an area id. */
  declare room: string;
  private timer?: number;
  private width = 1200;
  private sizer = new ResizeObserver(([e]) => {
    const before = this.layout;
    this.width = e.contentRect.width;
    if (before !== this.layout) this.requestUpdate();
  });

  constructor() {
    super();
    this.now = new Date();
    this.wall = false;
    this.room = new URLSearchParams(location.search).get("piece") ?? FAVORITES;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        h.spotify, ...h.tvs, h.frog?.status, h.frog?.image, h.frog?.location, h.outdoorTemperature, h.guestMode, h.leave,
        ...Object.values(h.chips), ...config.weather, "sun.sun",
        ...Object.keys(config.people).map((p) => `person.${p}`), ...this.batteries().map((b) => b.entity),
        ...this.favoriteList().flatMap((f) => ("entity" in f ? [f.entity] : [])),
        ...this.devices().map((d) => d.id), ...h.computers.map((c) => c.busy),
        ...(this.model?.rooms ?? []).flatMap((r) => [r.temperature, r.humidity, ...r.lights]),
      ].filter((x): x is string => !!x);
    });
  }

  private get layout(): "wall" | "wide" | "phone" {
    return this.wall ? "wall" : this.width >= 900 ? "wide" : "phone";
  }

  connectedCallback(): void {
    super.connectedCallback();
    const tick = () => {
      this.now = new Date();
      this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    window.addEventListener("kh-pending", this.onPending);
    this.width = this.getBoundingClientRect().width || window.innerWidth;
    this.sizer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
    this.sizer.disconnect();
    window.removeEventListener("kh-pending", this.onPending);
  }

  protected willUpdate(): void {
    this.setAttribute("layout", this.layout);
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  private onPending = () => this.requestUpdate();

  /** Chooses a room filter and records it in the address (?piece=), keeping the other parameters. */
  private pick(room: string): void {
    this.room = room;
    const url = new URL(location.href);
    if (room === FAVORITES) url.searchParams.delete("piece");
    else url.searchParams.set("piece", room);
    history.replaceState(history.state, "", url);
  }

  static styles = [
    ui,
    css`
      :host {
        display: block;
        --gap: 20px;
        --tile-h: 72px;
      }
      :host([layout="wall"]) {
        --gap: 14px;
        --tile-h: 66px;
      }

      /* ---------- Page ---------- */
      /* Three columns, as the original dashboard: the rooms; media and energy;
         the day (weather, agenda, stocks) with the shortcuts at the bottom. */
      .page {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr);
        grid-template-areas: "top top top" "rooms media side";
        gap: var(--gap) calc(var(--gap) * 1.25);
        align-items: start;
      }
      /* The plan wants width: it takes the rooms' and the media's columns. */
      .page.planned {
        grid-template-areas: "top top top" "rooms rooms side";
      }
      .page.planned .media {
        display: none;
      }
      :host([layout="wall"]) .page {
        height: calc(100dvh - 20px);
        grid-template-rows: auto minmax(0, 1fr);
      }
      :host([layout="phone"]) .page,
      :host([layout="phone"]) .page.planned {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: "top" "media" "rooms" "side";
      }
      :host([layout="phone"]) .page.planned .media {
        display: grid;
      }
      .main,
      .media,
      .side {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--gap);
        align-content: start;
        min-width: 0;
      }
      .main {
        grid-area: rooms;
      }
      .media {
        grid-area: media;
      }
      .side {
        grid-area: side;
      }
      :host([layout="wall"]) .main,
      :host([layout="wall"]) .media,
      :host([layout="wall"]) .side {
        min-height: 0;
        height: 100%;
      }
      :host([layout="wall"]) .main {
        grid-template-rows: minmax(0, 1fr);
      }
      /* Device categories inside a room. */
      .groups {
        display: grid;
        gap: 14px;
        align-content: start;
        min-height: 0;
        overflow: auto;
        scrollbar-width: thin;
      }
      .sub {
        margin: 0 0 8px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--v3-muted);
      }
      .plan {
        padding: 6px;
        overflow: hidden;
        min-height: 0;
      }
      .plan kh-floorplan {
        display: block;
      }
      section {
        display: grid;
        gap: 10px;
        min-width: 0;
      }

      /* Section titles, outside the cards, with their link (V1, Apple Home). */
      .h {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-wrap: balance;
      }
      .h a {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: inherit;
        text-decoration: none;
        border-radius: 8px;
        --mdc-icon-size: 22px;
      }
      .h a ha-icon {
        color: var(--v3-muted);
      }
      .h a:hover ha-icon {
        color: var(--v3-text);
      }
      :host([layout="wall"]) .h {
        font-size: 1.25rem;
      }

      .card {
        padding: 14px;
        gap: 10px;
      }

      /* ---------- 1. Top: time, greeting, categories, family ---------- */
      .top {
        grid-area: top;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px;
      }
      time {
        display: block;
        font-size: 2.5rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .hello {
        margin-top: 4px;
        color: var(--v3-muted);
        font-weight: 500;
      }
      .cats {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 14px 0 6px;
        border-radius: 22px;
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        color: inherit;
        text-decoration: none;
        white-space: nowrap;
        text-align: left;
      }
      .cat .ic {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--v3-well);
        color: var(--v3-muted);
        --mdc-icon-size: 18px;
      }
      .cat.on .ic {
        background: rgba(var(--c), 0.2);
        color: rgb(var(--c));
      }
      .cat.alert {
        box-shadow: inset 0 0 0 1.5px rgb(var(--rgb-red));
      }
      .cat.alert .ic {
        background: rgb(var(--rgb-red));
        color: #fff;
      }
      .cat b {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--v3-muted);
        line-height: 1.1;
      }
      .cat span:last-child {
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .cat:hover {
        background: var(--v3-well);
      }
      .cat.blink .ic {
        animation: blink 1.2s ease-in-out infinite;
      }
      @keyframes blink {
        50% {
          opacity: 0.4;
        }
      }
      .people {
        display: flex;
        gap: 6px;
      }
      .avatar {
        position: relative;
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 50%;
      }
      .avatar .ring {
        position: absolute;
        inset: 0;
      }
      .avatar img,
      .avatar .initial {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        object-fit: cover;
        display: grid;
        place-items: center;
        background: var(--v3-well);
        font-weight: 700;
      }
      .avatar.away img {
        filter: grayscale(0.9);
        opacity: 0.7;
      }
      .avatar .dot {
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--v3-bg);
        box-sizing: border-box;
        background: rgb(var(--rgb-green));
      }
      .avatar.away .dot {
        background: var(--v3-faint);
      }
      :host([layout="phone"]) .top {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      :host([layout="phone"]) .cats {
        grid-column: 1 / -1;
        grid-row: 2;
        justify-content: flex-start;
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        margin: 0 -12px;
        padding: 0 12px;
      }
      :host([layout="phone"]) .cats::-webkit-scrollbar {
        display: none;
      }

      /* ---------- 2. Shortcuts (Minimalist's scenes) ---------- */
      /* Autres (V1): two per row, the icon beside its label. */
      .shortcuts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .sc {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        grid-template-rows: auto auto;
        align-content: center;
        align-items: center;
        column-gap: 12px;
        min-height: var(--tile-h);
        padding: 0 12px;
        box-sizing: border-box;
        border-radius: var(--v3-r-item);
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        color: inherit;
        text-decoration: none;
        text-align: left;
        min-width: 0;
      }
      .sc .ic {
        grid-row: span 2;
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: rgba(var(--c), 0.18);
        color: rgb(var(--c));
        --mdc-icon-size: 22px;
      }
      .sc.on .ic {
        background: rgb(var(--c));
        color: #fff;
      }
      .sc.on {
        box-shadow: inset 0 0 0 1.5px rgba(var(--c), 0.7);
      }
      .sc b {
        font-size: 0.9375rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .sc small {
        font-size: 0.8125rem;
        color: var(--v3-muted);
        line-height: 1.25;
      }
      .sc b {
        min-width: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        overflow-wrap: anywhere;
      }
      .sc small {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .sc:hover {
        background: var(--v3-well-hi);
      }

      /* ---------- 3. Rooms: filters (Cansaas), header, one tile shape ---------- */
      .rooms {
        min-height: 0;
        grid-template-rows: auto auto auto minmax(0, 1fr);
      }
      .rooms.noroom {
        grid-template-rows: auto auto minmax(0, 1fr);
      }
      .filters {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        margin: 0 -4px;
        padding: 2px 4px;
      }
      .filters::-webkit-scrollbar {
        display: none;
      }
      .filter {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 0 14px 0 10px;
        border-radius: 20px;
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        color: var(--v3-muted);
        font-size: 0.875rem;
        font-weight: 600;
        white-space: nowrap;
        --mdc-icon-size: 18px;
      }
      .filter .lit {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgb(var(--rgb-amber));
      }
      .filter[aria-pressed="true"] {
        background: var(--v3-text);
        color: var(--v3-bg);
        box-shadow: none;
      }
      .filter:hover:not([aria-pressed="true"]) {
        color: var(--v3-text);
      }
      .roomhead {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        min-height: 40px;
      }
      .roomhead .facts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        color: var(--v3-muted);
        font-size: 0.875rem;
      }
      .roomhead .facts span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        --mdc-icon-size: 16px;
      }
      .roomhead .facts b {
        color: var(--v3-text);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 20px;
        background: var(--v3-well);
        color: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        text-decoration: none;
        --mdc-icon-size: 18px;
      }
      .btn:hover {
        background: var(--v3-well-hi);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
        grid-auto-rows: var(--tile-h);
        gap: 10px;
        align-content: start;
        --v3-well: var(--v3-surface);
        --v3-well-hi: var(--kh-card-2);
      }
      :host([layout="phone"]) .tiles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow: visible;
      }
      .tiles kh3-light {
        height: 100%;
      }
      /* One tile shape for every device: tinted icon, name, state. */
      .tile {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        height: 100%;
        padding: 0 12px;
        box-sizing: border-box;
        border-radius: var(--v3-r-item);
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        color: inherit;
        text-align: left;
        width: 100%;
      }
      .tile .ic {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--kh-card-2);
        color: var(--v3-muted);
        --mdc-icon-size: 20px;
      }
      .tile.on .ic {
        background: rgba(var(--c), 0.2);
        color: rgb(var(--c));
      }
      .tile .n {
        display: block;
        font-weight: 600;
        font-size: 0.9375rem;
        line-height: 1.2;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .tile .s {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .tile .lock {
        color: var(--v3-faint);
        --mdc-icon-size: 16px;
      }
      .tile.off {
        opacity: 0.5;
      }
      .tile:hover {
        background: var(--v3-well-hi);
      }
      .tile.busy::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: 0;
        width: 50%;
        height: 3px;
        background: linear-gradient(90deg, transparent, rgb(var(--c)), transparent);
        animation: progress 1.3s ease-in-out infinite;
      }
      @keyframes progress {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(200%);
        }
      }
      .empty {
        padding: 16px;
        border-radius: var(--v3-r-item);
        background: var(--v3-surface);
        color: var(--v3-muted);
      }

      /* ---------- 4. Side: now playing, weather, energy, agenda ---------- */
      .weather {
        padding: 0;
        overflow: hidden;
        gap: 0;
      }
      .frog {
        position: relative;
        aspect-ratio: 2.6;
        background-color: rgb(var(--frog));
        background-image: linear-gradient(90deg, rgba(var(--frog), 0.65), rgba(var(--frog), 0) 60%), var(--scene);
        background-size: 100% 100%, cover;
        background-position: 0 0, var(--shift) 70%;
        color: #fff;
        text-shadow: 0 1px 8px rgb(0 0 0 / 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
        text-decoration: none;
      }
      .frog img {
        width: 52px;
        height: 52px;
      }
      .frog b {
        display: block;
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .frog span {
        font-weight: 500;
        font-size: 0.875rem;
      }
      .days {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        padding: 8px 8px 10px;
        text-align: center;
      }
      .day {
        display: grid;
        justify-items: center;
        gap: 2px;
        font-variant-numeric: tabular-nums;
      }
      .day .d {
        font-size: 0.75rem;
        color: var(--v3-muted);
        font-weight: 600;
      }
      .day img {
        width: 34px;
        height: 34px;
      }
      :host(:not([dark])) .day img {
        filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.3));
      }
      .day .hi {
        font-weight: 700;
        font-size: 0.9375rem;
      }
      .day .lo {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .energy {
        padding: 0;
        --kh-card: var(--v3-surface);
        --kh-card-2: var(--v3-well);
        --kh-kpi-min: 88px;
      }
      .stock {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        min-height: 44px;
        padding: 0 14px;
        border-radius: var(--v3-r-item);
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        width: 100%;
        box-sizing: border-box;
        font-weight: 600;
      }
      .up {
        color: rgb(var(--rgb-green));
      }
      .down {
        color: rgb(var(--rgb-red));
      }
      :host([layout="wall"]) .side {
        grid-template-rows: auto;
        overflow: auto;
        scrollbar-width: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .cat.blink .ic,
        .tile.busy::after {
          animation: none;
        }
      }
    `,
  ];

  /* ---------------- Data ---------------- */

  private batteries() {
    return Object.entries(config.people)
      .filter(([, p]) => !p.device)
      .map(([key, p]) => ({ key, ...(p.favorites?.find((f) => f.type === "battery") as Extract<Favorite, { type: "battery" }> | undefined) }))
      .filter((b) => !!b.entity) as { key: string; entity: string }[];
  }

  private favoriteList(): Favorite[] {
    const hass = store.hass;
    if (!hass) return [];
    const person = currentPerson(hass)?.replace("person.", "");
    return (person && config.people[person]?.favorites) || config.people.tablet?.favorites || [];
  }

  private openings(): string[] {
    return Object.values(store.hass?.states ?? {})
      .filter((s) => s.entity_id.startsWith("binary_sensor.") && ["window", "door", "opening"].includes(s.attributes.device_class))
      .map((s) => s.entity_id);
  }

  private get night(): boolean {
    return store.hass?.states["sun.sun"]?.state === "below_horizon";
  }

  private rooms(): Room[] {
    return (this.model?.rooms ?? []).filter((r) => r.lights.length + r.switches.length + r.fans.length + r.media.length + r.openings.length > 0 || r.temperature);
  }

  /** The devices of the chosen filter, lights first, then plugs and PCs, fans, media, openings. */
  private devices(): Device[] {
    const hass = store.hass;
    if (!hass) return [];
    const h = config.home;
    if (this.room === FAVORITES) {
      return [
        ...h.lights.filter((l) => hass.states[l.entity]).map((l) => ({ id: l.entity, name: l.name, kind: "light" as const, icon: l.icon })),
        ...h.computers.filter((c) => hass.states[c.entity]).map((c) => ({ id: c.entity, name: c.name, kind: "computer" as const, computer: c })),
        ...h.tvs.filter((id) => hass.states[id]).map((id) => ({ id, name: this.tvName(id), kind: "media_player" as const })),
      ];
    }
    const r = this.model?.rooms.find((x) => x.id === this.room);
    if (!r) return [];
    const name = (id: string) => entityName(hass, id, config, r.name);
    const pcId = config.plan?.computers[r.id];
    const pc = h.computers.find((c) => c.entity === pcId);
    return [
      ...r.lights.map((id) => ({ id, name: name(id), kind: "light" as const })),
      ...(pc ? [{ id: pc.entity, name: pc.name, kind: "computer" as const, computer: pc }] : []),
      ...r.switches.map((id) => ({ id, name: name(id), kind: "switch" as const })),
      ...r.fans.map((id) => ({ id, name: name(id), kind: "fan" as const })),
      ...r.media.map((id) => ({ id, name: name(id), kind: "media_player" as const })),
      ...r.openings.map((id) => ({ id, name: name(id), kind: "opening" as const })),
    ].filter((d) => hass.states[d.id]);
  }

  /** "TV Salon": a TV is named after the room it stands in. */
  private tvName(id: string): string {
    const hass = store.hass!;
    const area = Object.entries(config.plan?.tvs ?? {}).find(([, tv]) => tv === id)?.[0];
    const room = this.model?.rooms.find((r) => r.id === area);
    return room ? `TV ${room.name.replace(/^Chambre /, "")}` : entityName(hass, id, config);
  }

  /* ---------------- 1. Top ---------------- */

  private top() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const me = currentPerson(hass);
    const name = me?.endsWith("tablet") ? "" : String(st(me)?.attributes.friendly_name ?? "");
    const lights = Number(st(h.chips.lightsOn)?.state);
    const windows = Number(st(h.chips.windowsOpen)?.state);
    const timer = st(h.chips.timer)?.state;
    const timerOn = st(h.chips.timerActive)?.state === "active" || isActive(st(h.chips.timerActive));
    const temps = this.rooms().map((r) => Number(hass.states[r.temperature ?? ""]?.state)).filter((t) => !isNaN(t));
    const indoor = Number(st(h.chips.temperature)?.state);
    const climate = temps.length > 1 ? `${formatNumber(Math.min(...temps), 0)}–${formatNumber(Math.max(...temps), 0)}°` : !isNaN(indoor) ? `${formatNumber(indoor)}°` : "—";
    const alarm = st(h.chips.alarm);
    const look = alarm ? alarmLook(alarm.state) : undefined;
    return html`<header class="top">
      <div>
        <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
        <div class="hello">${upper(date.format(this.now))}. ${greeting(this.now.getHours())}${name ? ` ${upper(name)}` : ""}.</div>
      </div>
      <nav class="cats" aria-label="État de la maison">
        <a class="cat ${temps.length || !isNaN(indoor) ? "on" : ""}" style="--c: var(--rgb-green)" href=${`${this.prefix}/meteo`}>
          <span class="ic" aria-hidden="true"><ha-icon icon="mdi:thermometer"></ha-icon></span><span><b>Climat</b>${climate}</span></a>
        <button class="cat ${lights > 0 ? "on" : ""}" style="--c: var(--rgb-amber)" @click=${() => this.pick(FAVORITES)}>
          <span class="ic" aria-hidden="true"><ha-icon icon=${lights > 0 ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon></span>
          <span><b>Lumières</b>${isNaN(lights) ? "—" : lights > 0 ? plural(lights, "allumée", "allumées") : "Éteintes"}</span></button>
        <button class="cat ${windows > 0 ? "on" : ""}" style="--c: var(--rgb-light-blue)" @click=${() => openOpenings(this.openings())}>
          <span class="ic" aria-hidden="true"><ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"}></ha-icon></span>
          <span><b>Ouvertures</b>${isNaN(windows) ? "—" : windows > 0 ? plural(windows, "ouverte", "ouvertes") : "Fermées"}</span></button>
        ${alarm && look
          ? html`<button class="cat ${alarm.state !== "disarmed" ? "on" : ""} ${look.alert ? "alert" : ""}" style="--c: var(--rgb-indigo)" @click=${() => openAlarm(alarm.entity_id)}>
              <span class="ic" aria-hidden="true"><ha-icon icon=${look.icon}></ha-icon></span><span><b>Alarme</b>${look.label}</span></button>`
          : nothing}
        ${h.chips.timer && timer
          ? html`<button class="cat ${timerOn ? "on blink" : ""}" style="--c: var(--rgb-teal)" @click=${() => h.chips.timerActive && openMoreInfo(this, h.chips.timerActive)}>
              <span class="ic" aria-hidden="true"><ha-icon icon="mdi:google-assistant"></ha-icon></span>
              <span><b>Minuteur</b>${timerOn && !["unavailable", "unknown"].includes(timer) ? timer : "Aucun"}</span></button>`
          : nothing}
      </nav>
      <div class="people">${this.people()}</div>
    </header>`;
  }

  private people() {
    const hass = store.hass!;
    return Object.keys(config.people)
      .filter((p) => !config.people[p].device && hass.states[`person.${p}`])
      .map((p) => {
        const s = hass.states[`person.${p}`];
        const home = s.state === "home";
        const b = this.batteries().find((x) => x.key === p);
        const level = b ? Number(hass.states[b.entity]?.state) / 100 : NaN;
        return html`<button class="avatar ${home ? "" : "away"}"
          aria-label="${s.attributes.friendly_name} : ${home ? "à la maison" : "absent"}${isNaN(level) ? "" : `, batterie ${Math.round(level * 100)} %`}"
          @click=${() => openPerson(p)}>
          ${!isNaN(level) ? ring(level, 48, 3, level > 0.2 ? "rgb(var(--rgb-green))" : "rgb(var(--rgb-red))") : nothing}
          ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" width="38" height="38" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
          <span class="dot"></span>
        </button>`;
      });
  }

  /* ---------------- 2. Shortcuts ---------------- */

  private shortcuts() {
    const hass = store.hass!;
    const h = config.home;
    const guest = h.guestMode ? hass.states[h.guestMode] : undefined;
    const leaving = h.leave ? isActive(hass.states[h.leave]) : false;
    const automations = this.favoriteList().filter((f): f is Extract<Favorite, { type: "automation" }> => f.type === "automation" && !!hass.states[f.entity]);
    return html`<section class="shortcuts-section" aria-labelledby="sc-title">
      <h2 class="h" id="sc-title">Autres</h2>
      <div class="shortcuts">
        ${h.leave
          ? html`<button class="sc" style="--c: var(--rgb-indigo)" @click=${() => runScript(h.leave!)}>
              <span class="ic" aria-hidden="true"><ha-icon icon="mdi:hand-wave"></ha-icon></span><b>Partir</b><small>${leaving ? "En cours…" : "Lumières et TV"}</small></button>`
          : nothing}
        ${guest
          ? html`<button class="sc ${isActive(guest) ? "on" : ""}" style="--c: var(--rgb-amber)" aria-pressed=${String(isActive(guest))}
              @click=${() => toggle(h.guestMode!, "le mode invité")}>
              <span class="ic" aria-hidden="true"><ha-icon icon="mdi:account-group"></ha-icon></span><b>Mode invité</b><small>${isActive(guest) ? "Activé" : "Désactivé"}</small></button>`
          : nothing}
        ${automations.map((a) => {
          const on = isActive(hass.states[a.entity]);
          return html`<button class="sc ${on ? "on" : ""}" style="--c: var(--rgb-purple)" aria-pressed=${String(on)} @click=${() => toggle(a.entity, a.name)}>
            <span class="ic" aria-hidden="true"><ha-icon icon="mdi:robot-outline"></ha-icon></span><b>${a.name}</b><small>${on ? "Activée" : "Désactivée"}</small></button>`;
        })}
        ${h.wifiQr
          ? html`<button class="sc" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}>
              <span class="ic" aria-hidden="true"><ha-icon icon="mdi:qrcode"></ha-icon></span><b>Wi-Fi</b><small>QR invités</small></button>`
          : nothing}
        <a class="sc" style="--c: var(--rgb-purple)" href=${`${this.prefix}/medias`}>
          <span class="ic" aria-hidden="true"><ha-icon icon="mdi:remote-tv"></ha-icon></span><b>Télécommande</b><small>Box TV</small></a>
        <a class="sc" style="--c: var(--rgb-light-blue)" href=${`${this.prefix}/meteo`}>
          <span class="ic" aria-hidden="true"><ha-icon icon="mdi:radar"></ha-icon></span><b>Radar</b><small>Pluie, Windy</small></a>
      </div>
    </section>`;
  }

  /* ---------------- 3. Rooms ---------------- */

  private roomsSection() {
    const hass = store.hass!;
    const rooms = this.rooms();
    const r = rooms.find((x) => x.id === this.room);
    const devices = this.room === PLAN ? [] : this.devices();
    return html`<section class="rooms ${r ? "" : "noroom"}" aria-labelledby="rooms-title">
      <h2 class="h" id="rooms-title"><a href=${`${this.prefix}/pieces`}>Pièces<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <div class="filters" role="group" aria-label="Choisir une pièce">
        <button class="filter" aria-pressed=${String(this.room === FAVORITES)} @click=${() => this.pick(FAVORITES)}>
          <ha-icon icon="mdi:star" aria-hidden="true"></ha-icon>Favoris</button>
        <button class="filter" aria-pressed=${String(this.room === PLAN)} @click=${() => this.pick(PLAN)}>
          <ha-icon icon="mdi:floor-plan" aria-hidden="true"></ha-icon>Plan</button>
        ${rooms.map((x) => {
          const lit = x.lights.some((id) => isActive(hass.states[id]));
          return html`<button class="filter" aria-pressed=${String(this.room === x.id)} @click=${() => this.pick(x.id)}
            aria-label=${lit ? `${x.name}, lumière allumée` : x.name}>
            <ha-icon icon=${x.icon} aria-hidden="true"></ha-icon>${x.name}${lit ? html`<span class="lit" aria-hidden="true"></span>` : nothing}</button>`;
        })}
      </div>
      ${r ? this.roomHead(r) : nothing}
      ${this.room === PLAN
        ? html`<div class="card plan"><kh-floorplan .rooms=${this.model?.rooms ?? []} prefix=${this.prefix}></kh-floorplan></div>`
        : devices.length
          ? html`<div class="groups">
              ${GROUPS.map(([kind, title]) => {
                const list = devices.filter((d) => d.kind === kind);
                return list.length ? html`<div><h3 class="sub">${title}</h3><div class="tiles">${list.map((d) => this.tile(d))}</div></div>` : nothing;
              })}
            </div>`
          : html`<p class="empty">Aucun appareil dans cette pièce. Ouvrez la pièce pour voir ses capteurs.</p>`}
    </section>`;
  }

  private roomHead(r: Room) {
    const hass = store.hass!;
    const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
    const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
    const on = r.lights.filter((id) => isActive(hass.states[id]));
    const reachable = r.lights.filter((id) => !isUnavailable(hass.states[id]));
    return html`<div class="roomhead">
      <div class="facts">
        ${isNaN(t) ? nothing : html`<span><ha-icon icon="mdi:thermometer" aria-hidden="true"></ha-icon><b>${formatNumber(t)}°</b></span>`}
        ${isNaN(hum) ? nothing : html`<span><ha-icon icon="mdi:water-percent" aria-hidden="true"></ha-icon><b>${formatNumber(hum, 0)}&nbsp;%</b></span>`}
        ${r.lights.length
          ? html`<span><ha-icon icon="mdi:lightbulb-outline" aria-hidden="true"></ha-icon>${on.length ? html`<b>${on.length}</b>&nbsp;sur ${r.lights.length} allumée${on.length > 1 ? "s" : ""}` : "Lumières éteintes"}</span>`
          : nothing}
      </div>
      ${reachable.length
        ? html`<button class="btn" @click=${() => setLights(r.lights, on.length === 0)}>
            <ha-icon icon=${on.length ? "mdi:lightbulb-off-outline" : "mdi:lightbulb-on-outline"} aria-hidden="true"></ha-icon>${on.length ? "Tout éteindre" : "Tout allumer"}</button>`
        : nothing}
      <a class="btn" href=${`${this.prefix}/pieces/${r.id}`}>Ouvrir la pièce<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a>
    </div>`;
  }

  private tile(d: Device) {
    const hass = store.hass!;
    const s = hass.states[d.id];
    if (d.kind === "light") return html`<kh3-light entity-id=${d.id} name=${d.name} icon=${d.icon ?? nothing}></kh3-light>`;
    const c = `var(--rgb-${KIND_COLOR[d.kind]})`;
    const off = isUnavailable(s);
    const on = isActive(s) || (d.kind === "media_player" && isPlayerActive(d.id));
    if (d.kind === "computer" && d.computer) {
      const waiting = isPending(d.id);
      const busy = waiting || (d.computer.busy ? isActive(hass.states[d.computer.busy]) : false);
      const press = pcPress(d.id, () => toggle(d.id, d.name), () => openComputer(d.computer!));
      const label = off ? "Indisponible" : busy ? (waiting ? (on ? "Arrêt…" : "Démarrage…") : "En cours…") : on ? "Allumé" : "Éteint";
      return html`<button class="tile ${on ? "on" : ""} ${busy ? "busy" : ""} ${off ? "off" : ""}" style="--c: ${c}" aria-pressed=${String(on)}
        aria-description="Appui : allumer ou éteindre ; appui long : détails"
        @pointerdown=${press.down} @pointerup=${press.cancel} @pointermove=${press.move} @pointercancel=${press.cancel}
        @pointerleave=${press.cancel} @contextmenu=${press.contextmenu} @click=${press.click}>
        <span class="ic" aria-hidden="true"><ha-icon icon="mdi:desktop-tower-monitor"></ha-icon></span>
        <span style="min-width:0"><span class="n">${d.name}</span><span class="s">${label}</span></span><span></span>
      </button>`;
    }
    // Plugs and fans switch (protected ones ask first); media and sensors open their details.
    const switches = d.kind === "switch" || d.kind === "fan";
    const label = off ? "Indisponible" : stateLabel(hass, s);
    return html`<button class="tile ${on ? "on" : ""} ${off ? "off" : ""}" style="--c: ${c}" aria-pressed=${switches ? String(on) : nothing}
      @click=${() => (switches && !off ? toggle(d.id, d.name) : openMoreInfo(this, d.id))}>
      <span class="ic" aria-hidden="true">${stateIcon(hass, s)}</span>
      <span style="min-width:0"><span class="n">${d.name}</span><span class="s">${label}</span></span>
      ${switches && needsConfirmation(d.id) ? html`<ha-icon class="lock" icon="mdi:shield-lock-outline" aria-label="Demande une confirmation"></ha-icon>` : html`<span></span>`}
    </button>`;
  }

  /* ---------------- 4. Side ---------------- */

  /** What plays now (Spotify, the TVs), then the latest on Jellyfin: one card, one page each. */
  private media() {
    const h = config.home;
    const playing = [h.spotify, ...h.tvs].filter((id): id is string => !!id && isPlayerActive(id));
    const pages = [
      ...playing.map((id) => html`<kh-media-card entity-id=${id} kind=${id === h.spotify ? "music" : "tv"} name=${id === h.spotify ? "Spotify" : this.tvName(id)}></kh-media-card>`),
      ...(h.jellyfin ? [html`<kh-jellyfin></kh-jellyfin>`] : []),
    ];
    if (!pages.length) return nothing;
    return html`<section aria-labelledby="m-title">
      <h2 class="h" id="m-title"><a href=${`${this.prefix}/medias`}>${playing.length ? "En lecture" : "Ajouté sur Jellyfin"}<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      ${pages.length > 1 ? html`<kh-swipe label="Médias">${pages}</kh-swipe>` : pages[0]}
    </section>`;
  }

  private weather() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const frog = st(h.frog?.status)?.state ?? "";
    const pic = st(h.frog?.image)?.state ?? "";
    const place = st(h.frog?.location)?.state;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = Number(st(h.outdoorTemperature)?.state ?? weather?.attributes.temperature);
    const days = forecastDays();
    const style = `--frog: ${FROG_SKY[frog] ?? "40, 130, 221"}; --scene: ${/^(https?:)?\//.test(pic) ? `url('${pic}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;
    return html`<section aria-labelledby="w-title">
      <h2 class="h" id="w-title"><a href=${`${this.prefix}/meteo`}>Météo<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <div class="card weather">
        <a class="frog" style=${style} href=${`${this.prefix}/meteo`} aria-label="Météo : ${weather ? stateLabel(hass, weather) : ""}${isNaN(temp) ? "" : `, ${formatNumber(temp)} degrés`}">
          ${weather ? html`<img src=${still(weatherIcon(weather.state, this.night))} alt="" width="52" height="52" />` : nothing}
          <span><b>${isNaN(temp) ? "—" : `${formatNumber(temp)}°`}</b>${weather ? stateLabel(hass, weather) : ""}</span>
        </a>
        ${days.length
          ? html`<div class="days" role="list">
              ${days.map(
                (d) => html`<div class="day" role="listitem" aria-label="${d.day} : ${formatNumber(d.temperature, 0)} degrés${d.templow !== undefined ? `, ${formatNumber(d.templow, 0)} au plus bas` : ""}">
                  <span class="d">${upper(d.day)}</span>
                  <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt="" width="34" height="34" />
                  <span class="hi">${formatNumber(d.temperature, 0)}°</span>
                  <span class="lo">${d.templow !== undefined ? `${formatNumber(d.templow, 0)}°` : ""}</span>
                </div>`,
              )}
            </div>`
          : nothing}
      </div>
    </section>`;
  }

  private energy() {
    if (!config.home.energy) return nothing;
    return html`<section aria-labelledby="e-title">
      <h2 class="h" id="e-title"><a href=${`${this.prefix}/energie`}>Énergie<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <div class="card energy"><kh-energy-card compact></kh-energy-card></div>
    </section>`;
  }

  private agenda() {
    const cal = this.favoriteList().find((f): f is Extract<Favorite, { type: "calendar" }> => f.type === "calendar");
    if (!cal) return nothing;
    return html`<section aria-labelledby="a-title">
      <h2 class="h" id="a-title">Agenda</h2>
      <kh-calendar .spec=${cal}></kh-calendar>
    </section>`;
  }

  private stocks() {
    const hass = store.hass!;
    const h = config.home;
    const list = h.stocks.filter((s) => s.home && hass.states[s.entity]);
    const shown = list.length ? list : h.stocks.filter((s) => hass.states[s.entity]).slice(0, 1);
    if (!shown.length) return nothing;
    return html`<section aria-labelledby="s-title">
      <h2 class="h" id="s-title"><a href=${`${this.prefix}/meteo`}>Bourse<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      ${shown.map((s) => {
        const ch = Number(hass.states[s.entity]?.attributes.regularMarketChangePercent);
        return html`<button class="stock" @click=${() => openMoreInfo(this, s.entity)}>
          <span>${s.name}</span><span class=${ch >= 0 ? "up" : "down"}>${isNaN(ch) ? "—" : `${ch >= 0 ? "+" : "−"}${formatNumber(Math.abs(ch), 1)} %`}</span>
        </button>`;
      })}
    </section>`;
  }

  render() {
    if (!store.hass) return nothing;
    return html`<div class="page ${this.room === PLAN ? "planned" : ""}">
      <h1 class="sr">Accueil</h1>
      ${this.top()}
      <div class="main">${this.roomsSection()}</div>
      <div class="media">${this.media()}${this.energy()}${this.agenda()}</div>
      <aside class="side">${this.weather()}${this.shortcuts()}${this.stocks()}</aside>
    </div>`;
  }
}
customElements.define("kh3-home", Kh3Home);
