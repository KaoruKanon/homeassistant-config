import { LitElement, css, html, nothing } from "lit";
import { isPending, openMoreInfo, runScript, toggle } from "../actions.ts";
import "../components/energy-card.ts";
import { pcPress } from "../components/gestures.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Computer, type Favorite, type HomeLight } from "../config.ts";
import { formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { alarmLook, openAlarm, openComputer, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { currentPerson, type HouseModel, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import type { HomeAssistant } from "../types.ts";
import { FROG_SKY, forecastDays } from "../weather-utils.ts";
import "./light.ts";
import { head, pagesOf, ring, ui } from "./theme.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** One colour per room, the same everywhere on the home. */
const ROOM_COLORS = ["orange", "green", "purple", "teal", "amber", "indigo", "red", "blue"];

type Mode = "wall" | "wide" | "medium" | "phone";

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const upper = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** Area of an entity; a light group takes the area of its first member. */
function areaOf(hass: HomeAssistant, id: string): string | undefined {
  const members = hass.states[id]?.attributes.entity_id;
  const probe = Array.isArray(members) && members.length ? members[0] : id;
  const e = hass.entities[probe] ?? hass.entities[id];
  return e?.area_id ?? (e?.device_id ? (hass.devices[e.device_id]?.area_id ?? undefined) : undefined);
}

/**
 * V3 home, organised like a home app rather than a wall of widgets:
 *
 *   ┌ Dehors ─────┐ ┌ Résumé: lumières, climat, alarme, ouvertures, minuteur ┐
 *   │ frog scene  │ ├ Pièces: climate, 24 h curve and lights of each room     ┤
 *   │ who is home │ ├ Médias ──────┬ Énergie (Linky graph) ┬ Favoris ────────┤
 *   │ five days   │ │              │ Ordinateurs           │                 │
 *   │ shortcuts   │ └──────────────┴───────────────────────┴─────────────────┘
 *
 * The left column is the ambient screen (time, weather, who is home), the
 * right one the house. One fixed arrangement per screen: wall tablet and PC
 * as above, portrait tablet in two stacks, phone in one.
 */
export class Kh3Home extends LitElement {
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true }, wall: { type: Boolean } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  declare wall: boolean;
  private timer?: number;
  private width = 1200;
  private mode: Mode = "wide";
  private sizer = new ResizeObserver(([e]) => {
    this.width = e.contentRect.width;
    if (this.pickMode() !== this.mode) this.requestUpdate();
  });

  constructor() {
    super();
    this.now = new Date();
    this.wall = false;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        h.spotify, ...h.tvs, h.frog?.status, h.frog?.image, h.frog?.location, h.outdoorTemperature, h.nextRain, h.guestMode, h.leave,
        ...Object.values(h.chips), ...config.weather, "sun.sun",
        ...Object.keys(config.people).map((p) => `person.${p}`), ...this.batteries().flatMap((b) => [b.entity, b.charging]),
        ...(this.model?.rooms ?? []).flatMap((r) => [r.temperature, r.humidity, ...r.lights]),
        ...h.lights.map((l) => l.entity), ...h.computers.flatMap((c) => [c.entity, c.busy]), ...h.stocks.map((s) => s.entity),
      ].filter((x): x is string => !!x);
    });
  }

  private pickMode(): Mode {
    return this.wall ? "wall" : this.width >= 1100 ? "wide" : this.width >= 600 ? "medium" : "phone";
  }

  connectedCallback(): void {
    super.connectedCallback();
    const tick = () => {
      this.now = new Date();
      this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    window.addEventListener("kh-pending", this.onPending);
    // The arrangement is decided before the first render: nothing moves once drawn.
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
    this.mode = this.pickMode();
    this.setAttribute("mode", this.mode);
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  private onPending = () => this.requestUpdate();

  static styles = [
    ui,
    css`
      :host {
        display: block;
        --side: 344px;
      }

      /* ---------- Arrangements ---------- */
      .home {
        display: grid;
        grid-template-columns: var(--side) minmax(0, 1fr);
        gap: var(--v3-gap);
        align-items: start;
      }
      .ambient,
      .main,
      .stack {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--v3-gap);
        align-content: start;
        min-width: 0;
      }
      .lower {
        display: grid;
        grid-template-columns: var(--lc, minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr));
        gap: var(--v3-gap);
        align-items: start;
      }
      :host([mode="wall"]) {
        --v3-gap: 10px;
        --side: 320px;
      }
      :host([mode="medium"]) .home,
      :host([mode="phone"]) .home {
        grid-template-columns: minmax(0, 1fr);
      }
      :host([mode="medium"]) .lower {
        --lc: repeat(2, minmax(0, 1fr));
      }
      :host([mode="phone"]) {
        --v3-gap: 12px;
      }

      /* ---------- Dehors: the frog's scene ---------- */
      .scene {
        position: relative;
        overflow: hidden;
        min-height: 236px;
        border-radius: var(--v3-r-card);
        padding: 18px 20px;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto 1fr auto;
        color: #fff;
        background-color: rgb(var(--frog));
        background-image: var(--scene);
        background-size: cover;
        background-position: var(--shift) 78%;
        isolation: isolate;
        text-shadow: 0 1px 10px rgb(0 0 0 / 0.28);
      }
      .scene::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          linear-gradient(180deg, rgba(var(--frog), 0.8) 0%, rgba(var(--frog), 0.25) 44%, rgba(var(--frog), 0) 62%),
          linear-gradient(0deg, rgb(10 16 24 / 0.4) 0%, rgb(10 16 24 / 0) 30%);
      }
      .scene .row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      time {
        display: block;
        font-family: var(--v3-display);
        font-size: 3.5rem;
        font-weight: 650;
        line-height: 0.92;
        letter-spacing: -0.04em;
        font-variant-numeric: tabular-nums;
      }
      .when {
        margin-top: 8px;
        font-size: 0.9375rem;
        font-weight: 500;
        line-height: 1.3;
      }
      .now {
        display: grid;
        justify-items: end;
        color: inherit;
        text-decoration: none;
        text-align: right;
      }
      .now img {
        width: 48px;
        height: 48px;
        margin: -6px -4px -2px 0;
      }
      .now .t {
        font-family: var(--v3-display);
        font-size: 1.625rem;
        font-weight: 600;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .now .c {
        font-size: 0.8125rem;
        opacity: 0.92;
      }
      .scene .foot {
        grid-row: 3;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 8px;
      }
      .rain {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        background: rgb(12 18 26 / 0.45);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 0.8125rem;
        font-weight: 500;
        --mdc-icon-size: 16px;
      }
      .avatars {
        display: flex;
        gap: 4px;
        margin-left: auto;
      }
      .avatar {
        position: relative;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        flex: none;
      }
      .avatar .ring {
        position: absolute;
        inset: 0;
      }
      .avatar img,
      .avatar .initial {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        display: grid;
        place-items: center;
        background: var(--v3-well-hi);
        font-weight: 700;
      }
      .away .avatar img {
        filter: grayscale(0.9) brightness(0.85);
      }
      .avatar .dot {
        position: absolute;
        right: 2px;
        bottom: 2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgb(var(--rgb-green));
        box-shadow: 0 0 0 2px var(--dot-edge, var(--v3-surface));
      }
      .away .avatar .dot {
        background: var(--v3-faint);
      }
      .scene .avatar {
        --dot-edge: rgb(var(--frog));
      }

      /* Who is home, where the others are, their phone's battery. */
      .people {
        display: grid;
        gap: 2px;
      }
      .person {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 2px 10px 2px 2px;
        border-radius: var(--v3-r-item);
        width: 100%;
        box-sizing: border-box;
      }
      .person:hover {
        background: var(--v3-well);
      }
      .person .n {
        font-weight: 600;
        line-height: 1.2;
      }
      .person .s {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .person .b {
        font-size: 0.8125rem;
        color: var(--v3-muted);
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        --mdc-icon-size: 16px;
      }
      .person .b.low {
        color: rgb(var(--rgb-red));
      }
      .person .b.charging ha-icon {
        color: rgb(var(--rgb-green));
      }

      /* Five days: each day's range against the week's. */
      .days {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        text-align: center;
      }
      .day {
        display: grid;
        justify-items: center;
        gap: 3px;
        padding: 6px 0 8px;
        border-radius: var(--v3-r-item);
      }
      .day:first-child {
        background: var(--v3-well);
      }
      .day .d {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .day:first-child .d {
        color: var(--v3-text);
        font-weight: 600;
      }
      .day img {
        width: 36px;
        height: 36px;
      }
      :host(:not([dark])) .day img {
        filter: drop-shadow(0 1px 1.5px rgb(24 32 42 / 0.35));
      }
      .day .hi {
        font-weight: 600;
      }
      .day .lo {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .range {
        position: relative;
        width: 4px;
        height: 24px;
        border-radius: 2px;
        background: var(--v3-well-hi);
      }
      .range i {
        position: absolute;
        left: 0;
        right: 0;
        border-radius: 2px;
        background: linear-gradient(0deg, rgb(var(--rgb-light-blue)), rgb(var(--rgb-amber)));
      }
      .ticker {
        display: grid;
        gap: 4px;
      }
      .tick {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        min-height: 36px;
        align-items: center;
        padding: 0 12px;
        border-radius: 12px;
        background: var(--v3-well);
        width: 100%;
        box-sizing: border-box;
        font-size: 0.875rem;
      }
      .tick .v {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .up {
        color: rgb(var(--rgb-green));
      }
      .down {
        color: rgb(var(--rgb-red));
      }

      /* Shortcuts: what the house can do in one tap, and what it does. */
      .shortcuts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .sc {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
        min-height: 48px;
        padding: 6px 10px;
        box-sizing: border-box;
        border-radius: var(--v3-r-item);
        background: var(--v3-well);
        color: inherit;
        text-decoration: none;
        text-align: left;
      }
      .sc ha-icon {
        grid-row: span 2;
        color: rgb(var(--c));
        --mdc-icon-size: 22px;
      }
      .sc b {
        font-weight: 600;
        font-size: 0.875rem;
        line-height: 1.2;
      }
      .sc small {
        font-size: 0.75rem;
        color: var(--v3-muted);
        line-height: 1.2;
      }
      .sc.on {
        background: rgba(var(--c), 0.16);
        box-shadow: inset 0 0 0 1.5px rgba(var(--c), 0.6);
      }
      .sc:hover {
        background: var(--v3-well-hi);
      }

      /* ---------- Résumé (Apple Home's status row) ---------- */
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        gap: 8px;
      }
      .sum {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
        min-height: 60px;
        padding: 8px 12px 8px 10px;
        box-sizing: border-box;
        border-radius: 18px;
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        color: inherit;
        text-decoration: none;
        text-align: left;
      }
      .sum .ic {
        grid-row: span 2;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--v3-well);
        color: rgb(var(--c));
        --mdc-icon-size: 20px;
      }
      .sum.hot .ic {
        background: rgb(var(--c));
        color: #fff;
      }
      :host([dark]) .sum.hot .ic {
        color: #10161d;
      }
      .sum.hot {
        background: linear-gradient(120deg, rgba(var(--c), 0.16), rgba(var(--c), 0.02) 70%), var(--v3-surface);
        box-shadow: inset 0 0 0 1px rgba(var(--c), 0.3);
      }
      .sum b {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--v3-muted);
        line-height: 1.2;
      }
      .sum span:last-child {
        font-weight: 600;
        line-height: 1.25;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .sum.blink .ic {
        animation: blink 1.2s ease-in-out infinite;
      }
      @keyframes blink {
        50% {
          opacity: 0.45;
        }
      }
      .sum:hover {
        background: var(--v3-well);
      }
      :host([mode="phone"]) .summary {
        display: flex;
        overflow-x: auto;
        scrollbar-width: none;
        margin: 0 -12px;
        padding: 0 12px;
        scroll-padding: 0 12px;
        scroll-snap-type: x mandatory;
      }
      :host([mode="phone"]) .summary::-webkit-scrollbar {
        display: none;
      }
      :host([mode="phone"]) .sum {
        flex: none;
        min-width: 150px;
        scroll-snap-align: start;
      }

      /* ---------- Pièces ---------- */
      .rooms {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        grid-auto-flow: row dense;
        gap: 8px;
      }
      .room {
        position: relative;
        overflow: hidden;
        min-height: 118px;
        padding: 12px;
        box-sizing: border-box;
        border-radius: 18px;
        background: var(--v3-surface);
        box-shadow: inset 0 0 0 1px var(--v3-line);
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 2px;
        isolation: isolate;
      }
      .room.wide {
        grid-column: span 2;
      }
      .room.lit {
        background: linear-gradient(150deg, rgba(var(--rgb-amber), 0.14), rgba(var(--rgb-amber), 0) 60%), var(--v3-surface);
      }
      /* The whole tile opens the room; its lights sit above that link. */
      .room > a.open {
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: inherit;
      }
      .room > a.open:hover {
        background: rgb(127 127 127 / 0.05);
      }
      .room .rh {
        position: relative;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      }
      .room .ic {
        width: 28px;
        height: 28px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        background: rgba(var(--c), 0.16);
        color: rgb(var(--c));
        --mdc-icon-size: 17px;
      }
      .room .n {
        font-weight: 600;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .room .t {
        font-size: 1.375rem;
        font-weight: 600;
        line-height: 1;
      }
      .room .meta {
        position: relative;
        padding-left: 36px;
        font-size: 0.8125rem;
        color: var(--v3-muted);
        pointer-events: none;
        min-height: 1.2em;
      }
      .room .spark {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: -1;
        opacity: 0.6;
        pointer-events: none;
      }
      .room .switches {
        position: relative;
        z-index: 1;
        align-self: end;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 6px;
        margin-top: 8px;
      }

      /* ---------- Médias, Énergie, Ordinateurs, Favoris ---------- */
      .energy {
        --kh-card: transparent;
        --kh-card-2: var(--v3-well);
        --kh-kpi-min: 84px;
      }
      .energy kh-energy-card {
        margin: -14px;
      }
      .rows {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
        gap: 6px;
      }
      .pc {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        min-height: 48px;
        padding: 6px 10px 6px 8px;
        border-radius: var(--v3-r-item);
        background: var(--v3-well);
        width: 100%;
        box-sizing: border-box;
        text-align: left;
      }
      .pc .ic {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: var(--v3-well-hi);
        color: var(--v3-muted);
        --mdc-icon-size: 18px;
      }
      .pc.on .ic {
        background: rgb(var(--rgb-blue));
        color: #fff;
      }
      .pc .n {
        font-weight: 600;
        line-height: 1.2;
      }
      .pc .s {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      /* Starting or shutting down: a bar runs along the bottom until done. */
      .pc.busy::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, rgb(var(--rgb-blue)), transparent) no-repeat;
        background-size: 40% 100%;
        animation: progress 1.3s ease-in-out infinite;
      }
      @keyframes progress {
        from {
          background-position: -40% 0;
        }
        to {
          background-position: 140% 0;
        }
      }
      .favs {
        display: grid;
        gap: 8px;
      }

      /* ---------- Wall tablet: one screen, no scroll ---------- */
      :host([mode="wall"]) .card {
        padding: 12px;
        gap: 10px;
      }
      :host([mode="wall"]) .scene {
        min-height: 196px;
        padding: 14px 16px;
      }
      :host([mode="wall"]) time {
        font-size: 3rem;
      }
      :host([mode="wall"]) .sum {
        min-height: 54px;
      }
      :host([mode="wall"]) .room {
        min-height: 142px;
        padding: 10px;
      }
      :host([mode="wall"]) .sc {
        min-height: 40px;
        padding: 4px 10px;
      }
      :host([mode="wall"]) .day {
        padding: 4px 0 6px;
      }
      :host([mode="wall"]) .day {
        gap: 2px;
      }
      :host([mode="wall"]) .day img {
        width: 28px;
        height: 28px;
      }
      :host([mode="wall"]) .range {
        height: 16px;
      }

      /* ---------- Phone ---------- */
      :host([mode="phone"]) .scene {
        min-height: 250px;
      }
      :host([mode="phone"]) time {
        font-size: 3.75rem;
      }
      :host([mode="phone"]) .rooms {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    `,
  ];

  private batteries() {
    return Object.entries(config.people)
      .filter(([, p]) => !p.device)
      .map(([key, p]) => ({ key, ...(p.favorites?.find((f) => f.type === "battery") as Extract<Favorite, { type: "battery" }> | undefined) }))
      .filter((b) => !!b.entity) as { key: string; entity: string; charging?: string }[];
  }

  private residents(): string[] {
    return Object.keys(config.people).filter((p) => !config.people[p].device && store.hass?.states[`person.${p}`]);
  }

  private openings(): string[] {
    return Object.values(store.hass?.states ?? {})
      .filter((s) => s.entity_id.startsWith("binary_sensor.") && ["window", "door", "opening"].includes(s.attributes.device_class))
      .map((s) => s.entity_id);
  }

  private avatar(p: string) {
    const hass = store.hass!;
    const s = hass.states[`person.${p}`];
    const b = this.batteries().find((x) => x.key === p);
    const level = b ? Number(hass.states[b.entity]?.state) / 100 : NaN;
    return html`<span class="avatar">
      ${!isNaN(level) ? ring(level, 44, 3, level > 0.2 ? "rgb(var(--rgb-green))" : "rgb(var(--rgb-red))") : nothing}
      ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
      <span class="dot"></span>
    </span>`;
  }

  /* ---------------- Dehors ---------------- */

  private scene() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const frog = st(h.frog?.status)?.state ?? "";
    const pic = st(h.frog?.image)?.state ?? "";
    const place = st(h.frog?.location)?.state;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = Number(st(h.outdoorTemperature)?.state ?? weather?.attributes.temperature);
    const night = st("sun.sun")?.state === "below_horizon";
    const me = currentPerson(hass);
    const name = me?.endsWith("tablet") ? "" : String(st(me)?.attributes.friendly_name ?? "");
    const rain = st(h.nextRain)?.state;
    const rainAt = rain && Date.parse(rain) > Date.now() ? time.format(new Date(rain)) : "";
    const style = `--frog: ${FROG_SKY[frog] ?? "40, 130, 221"}; --scene: ${/^(https?:)?\//.test(pic) ? `url('${pic}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;
    return html`<section class="scene" style=${style} aria-label="Maintenant">
      <div class="row">
        <div>
          <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
          <div class="when">${upper(date.format(this.now))}<br />${greeting(this.now.getHours())}${name ? ` ${upper(name)}` : ""}</div>
        </div>
        ${weather
          ? html`<a class="now" href=${`${this.prefix}/meteo`} aria-label="Météo : ${stateLabel(hass, weather)}${isNaN(temp) ? "" : `, ${formatNumber(temp)} degrés`}">
              <img src=${still(weatherIcon(weather.state, night))} alt="" />
              <span class="t">${isNaN(temp) ? "—" : `${formatNumber(temp)}°`}</span>
              <span class="c">${stateLabel(hass, weather)}</span>
            </a>`
          : nothing}
      </div>
      <div class="foot">
        ${rainAt ? html`<span class="rain"><ha-icon icon="mdi:umbrella-outline"></ha-icon>Pluie à ${rainAt}</span>` : html`<span></span>`}
        ${this.mode === "phone"
          ? html`<span class="avatars">${this.residents().map((p) => {
              const s = hass.states[`person.${p}`];
              return html`<button class=${s.state === "home" ? "" : "away"} aria-label="${s.attributes.friendly_name} : ${s.state === "home" ? "à la maison" : "absent"}"
                @click=${() => openPerson(p)}>${this.avatar(p)}</button>`;
            })}</span>`
          : nothing}
      </div>
    </section>`;
  }

  private people() {
    const hass = store.hass!;
    const list = this.residents();
    if (!list.length) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-green)" aria-label="Qui est à la maison">
      <div class="people">
        ${list.map((p) => {
          const s = hass.states[`person.${p}`];
          const home = s.state === "home";
          const where = home ? "À la maison" : s.state === "not_home" ? "Absent" : upper(stateLabel(hass, s));
          const b = this.batteries().find((x) => x.key === p);
          const level = b ? Number(hass.states[b.entity]?.state) : NaN;
          const charging = b?.charging ? isActive(hass.states[b.charging]) : false;
          return html`<button class="person ${home ? "" : "away"}" @click=${() => openPerson(p)}>
            ${this.avatar(p)}
            <span style="min-width:0"><span class="n ellipsis" style="display:block">${upper(String(s.attributes.friendly_name ?? p))}</span><span class="s">${where}</span></span>
            ${!isNaN(level)
              ? html`<span class="b ${level <= 20 && !charging ? "low" : ""} ${charging ? "charging" : ""}" aria-label="Batterie ${formatNumber(level, 0)} %${charging ? ", en charge" : ""}">
                  <ha-icon icon=${charging ? "mdi:battery-charging" : level <= 20 ? "mdi:battery-alert-variant-outline" : "mdi:battery-outline"}></ha-icon>${formatNumber(level, 0)} %</span>`
              : nothing}
          </button>`;
        })}
      </div>
    </section>`;
  }

  private outlook() {
    const hass = store.hass!;
    const days = forecastDays();
    const h = config.home;
    const stocks = h.stocks.filter((s) => s.home && hass.states[s.entity]);
    const shown = stocks.length ? stocks : h.stocks.filter((s) => hass.states[s.entity]).slice(0, 1);
    if (!days.length && !shown.length) return nothing;
    const lo = Math.min(...days.map((d) => d.templow ?? d.temperature));
    const hi = Math.max(...days.map((d) => d.temperature));
    const span = Math.max(1, hi - lo);
    return html`<section class="card" style="--fam: var(--rgb-light-blue)">
      ${head("mdi:calendar-week", "Cinq jours", { href: `${this.prefix}/meteo`, label: "Météo" })}
      ${days.length
        ? html`<div class="days" role="list">
            ${days.map((d) => {
              const low = d.templow ?? d.temperature;
              return html`<div class="day" role="listitem" aria-label="${d.day} : ${formatNumber(d.temperature, 0)} degrés au plus haut, ${formatNumber(low, 0)} au plus bas">
                <span class="d">${upper(d.day)}</span>
                <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt="" />
                <span class="hi num">${formatNumber(d.temperature, 0)}°</span>
                <span class="range" aria-hidden="true"><i style="bottom: ${((low - lo) / span) * 100}%; top: ${((hi - d.temperature) / span) * 100}%"></i></span>
                <span class="lo num">${formatNumber(low, 0)}°</span>
              </div>`;
            })}
          </div>`
        : nothing}
      ${shown.length
        ? html`<div class="ticker">
            ${shown.map((s) => {
              const ch = Number(hass.states[s.entity]?.attributes.regularMarketChangePercent);
              return html`<button class="tick" @click=${() => openMoreInfo(this, s.entity)}>
                <span class="ellipsis">${s.name}</span>
                <span class="v ${ch >= 0 ? "up" : "down"}">${isNaN(ch) ? "—" : `${ch >= 0 ? "+" : "−"}${formatNumber(Math.abs(ch), 1)} %`}</span>
              </button>`;
            })}
          </div>`
        : nothing}
    </section>`;
  }

  private shortcuts() {
    const hass = store.hass!;
    const h = config.home;
    const p = this.prefix;
    const guest = h.guestMode ? hass.states[h.guestMode] : undefined;
    const leaving = h.leave ? isActive(hass.states[h.leave]) : false;
    return html`<section class="card" style="--fam: var(--rgb-indigo)">
      ${head("mdi:gesture-tap-button", "Raccourcis")}
      <div class="shortcuts">
        ${h.leave
          ? html`<button class="sc" style="--c: var(--rgb-indigo)" @click=${() => runScript(h.leave!)}>
              <ha-icon icon="mdi:hand-wave-outline"></ha-icon><b>Partir</b><small class="ellipsis">${leaving ? "En cours…" : "Tout éteindre"}</small></button>`
          : nothing}
        ${guest
          ? html`<button class="sc ${isActive(guest) ? "on" : ""}" style="--c: var(--rgb-amber)" aria-pressed=${String(isActive(guest))}
              @click=${() => toggle(h.guestMode!, "le mode invité")}>
              <ha-icon icon="mdi:account-group-outline"></ha-icon><b>Mode invité</b><small class="ellipsis">${isActive(guest) ? "Départs sans effet" : "Désactivé"}</small></button>`
          : nothing}
        ${h.wifiQr
          ? html`<button class="sc" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}>
              <ha-icon icon="mdi:qrcode"></ha-icon><b>Wi-Fi</b><small>QR invités</small></button>`
          : nothing}
        <a class="sc" style="--c: var(--rgb-purple)" href=${`${p}/medias`}><ha-icon icon="mdi:remote-tv"></ha-icon><b>Télécommande</b><small>Box TV</small></a>
        <a class="sc" style="--c: var(--rgb-light-blue)" href=${`${p}/meteo`}><ha-icon icon="mdi:radar"></ha-icon><b>Radar</b><small>Pluie, Windy</small></a>
        <a class="sc" style="--c: var(--rgb-grey)" href=${`${p}/systeme`}><ha-icon icon="mdi:cog-outline"></ha-icon><b>Système</b><small>Réseau, HA</small></a>
      </div>
    </section>`;
  }

  /* ---------------- La maison ---------------- */

  /** The old chips, as Apple Home's status buttons: a state and an action each. */
  private summary() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const lights = Number(st(h.chips.lightsOn)?.state);
    const windows = Number(st(h.chips.windowsOpen)?.state);
    const timer = st(h.chips.timer)?.state;
    const timerOn = st(h.chips.timerActive)?.state === "active" || isActive(st(h.chips.timerActive));
    const indoor = Number(st(h.chips.temperature)?.state);
    const alarm = st(h.chips.alarm);
    const look = alarm ? alarmLook(alarm.state) : undefined;
    const armed = !!alarm && alarm.state !== "disarmed";
    return html`<nav class="summary" aria-label="Résumé de la maison">
      <a class="sum ${lights > 0 ? "hot" : ""}" style="--c: var(--rgb-amber)" href=${`${this.prefix}/pieces`}>
        <span class="ic"><ha-icon icon=${lights > 0 ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon></span>
        <b>Lumières</b><span>${isNaN(lights) ? "—" : lights > 0 ? plural(lights, "allumée", "allumées") : "Tout éteint"}</span>
      </a>
      <a class="sum ${indoor >= 26 || indoor < 17 ? "hot" : ""}" style="--c: var(--rgb-${indoor >= 26 ? "orange" : indoor < 17 ? "light-blue" : "green"})" href=${`${this.prefix}/meteo`}>
        <span class="ic"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon></span>
        <b>Climat</b><span>${isNaN(indoor) ? "—" : `${formatNumber(indoor)}° dedans`}</span>
      </a>
      ${alarm && look
        ? html`<button class="sum ${armed || look.alert ? "hot" : ""}" style="--c: var(--rgb-${look.alert ? "red" : armed ? "indigo" : "green"})" @click=${() => openAlarm(alarm.entity_id)}>
            <span class="ic"><ha-icon icon=${look.icon}></ha-icon></span><b>Alarme</b><span>${look.label}</span>
          </button>`
        : nothing}
      <button class="sum ${windows > 0 ? "hot" : ""}" style="--c: var(--rgb-light-blue)" @click=${() => openOpenings(this.openings())}>
        <span class="ic"><ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"}></ha-icon></span>
        <b>Ouvertures</b><span>${isNaN(windows) ? "—" : windows > 0 ? plural(windows, "ouverte", "ouvertes") : "Fermées"}</span>
      </button>
      ${h.chips.timer
        ? html`<button class="sum ${timerOn ? "hot blink" : ""}" style="--c: var(--rgb-teal)" @click=${() => h.chips.timerActive && openMoreInfo(this, h.chips.timerActive)}>
            <span class="ic"><ha-icon icon="mdi:google-assistant"></ha-icon></span>
            <b>Minuteur</b><span>${timerOn && timer && !["unavailable", "unknown"].includes(timer) ? timer : "Aucun"}</span>
          </button>`
        : nothing}
    </nav>`;
  }

  /** Each room once: its climate and 24 h curve, and its lights (the home ones, with their dimmer). */
  private rooms() {
    const hass = store.hass!;
    const all = this.model?.rooms ?? [];
    const lightsOf = new Map<string, HomeLight[]>();
    for (const l of config.home.lights) {
      if (!hass.states[l.entity]) continue;
      const area = areaOf(hass, l.entity);
      if (area) lightsOf.set(area, [...(lightsOf.get(area) ?? []), l]);
    }
    const rooms = all.filter((r) => r.temperature || lightsOf.has(r.id));
    if (!rooms.length) return nothing;
    return html`<section class="rooms" aria-label="Pièces">
      ${rooms.map((r) => this.room(r, all.indexOf(r), lightsOf.get(r.id) ?? []))}
    </section>`;
  }

  private room(r: Room, i: number, lights: HomeLight[]) {
    const hass = store.hass!;
    const c = `var(--rgb-${ROOM_COLORS[i % ROOM_COLORS.length]})`;
    const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
    const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
    const on = r.lights.filter((id) => isActive(hass.states[id])).length;
    const meta = [isNaN(hum) ? "" : `${formatNumber(hum, 0)} % d'humidité`, on ? plural(on, "lumière allumée", "lumières allumées") : ""]
      .filter(Boolean)
      .join(", ");
    return html`<article class="room ${lights.length > 1 ? "wide" : ""} ${on ? "lit" : ""}" style="--c: ${c}">
      <a class="open" href=${`${this.prefix}/pieces/${r.id}`} aria-label="Ouvrir ${r.name}"></a>
      <div class="rh">
        <span class="ic"><ha-icon icon=${r.icon}></ha-icon></span>
        <span class="n">${r.name}</span>
        ${r.temperature ? html`<span class="t num ${isNaN(t) ? "muted" : ""}">${isNaN(t) ? "—" : `${formatNumber(t)}°`}</span>` : nothing}
      </div>
      <div class="meta">${meta}</div>
      ${r.temperature
        ? html`<kh-sparkline class="spark" compact height="48" .entities=${[
            { entity: r.temperature, label: "Température", color: c, unit: "°C" },
            ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
          ]}></kh-sparkline>`
        : nothing}
      ${lights.length
        ? html`<div class="switches">${lights.map((l) => html`<kh3-light compact entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh3-light>`)}</div>`
        : nothing}
    </article>`;
  }

  /** Now playing and the latest on Jellyfin: two pages when something plays. */
  private media() {
    const h = config.home;
    const playing = [h.spotify, ...h.tvs].find((id) => !!id && isPlayerActive(id));
    const player = playing
      ? html`<kh-media-card entity-id=${playing} kind=${playing === h.spotify ? "music" : "tv"} name=${playing === h.spotify ? "Spotify" : nothing}></kh-media-card>`
      : undefined;
    const jelly = h.jellyfin ? html`<kh-jellyfin></kh-jellyfin>` : undefined;
    if (!player && !jelly) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-${playing ? "purple" : "jellyfin"})">
      ${head(playing ? "mdi:play-circle" : "mdi:filmstrip-box-multiple", playing ? "En lecture" : "Ajouté sur Jellyfin", { href: `${this.prefix}/medias`, label: "Médias" })}
      ${player && jelly ? html`<kh-swipe label="Médias">${player}${jelly}</kh-swipe>` : (player ?? jelly)}
    </section>`;
  }

  private energy() {
    if (!config.home.energy) return nothing;
    return html`<section class="card energy" style="--fam: var(--rgb-orange)">
      ${head("mdi:lightning-bolt", "Énergie", { href: `${this.prefix}/energie`, label: "Détail" })}
      <kh-energy-card compact></kh-energy-card>
    </section>`;
  }

  private computer(c: Computer) {
    const hass = store.hass!;
    const s = hass.states[c.entity];
    if (!s) return nothing;
    const on = isActive(s);
    const waiting = isPending(c.entity);
    const busy = waiting || (c.busy ? isActive(hass.states[c.busy]) : false);
    const press = pcPress(c.entity, () => toggle(c.entity, c.name), () => openComputer(c));
    const label = isUnavailable(s) ? "Injoignable" : busy ? (waiting ? (on ? "Arrêt…" : "Démarrage…") : "En cours…") : on ? "Allumé" : "Éteint";
    return html`<button class="pc ${on ? "on" : ""} ${busy ? "busy" : ""}" aria-pressed=${String(on)} aria-busy=${String(busy)}
      aria-description="Appui : allumer ou éteindre ; appui long : détails"
      @pointerdown=${press.down} @pointerup=${press.cancel} @pointermove=${press.move} @pointercancel=${press.cancel}
      @pointerleave=${press.cancel} @contextmenu=${press.contextmenu} @click=${press.click}>
      <span class="ic"><ha-icon icon="mdi:desktop-tower-monitor"></ha-icon></span>
      <span style="min-width:0"><span class="n ellipsis" style="display:block">${c.name}</span><span class="s">${label}</span></span>
    </button>`;
  }

  private computers() {
    const list = config.home.computers;
    if (!list.length) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-blue)">
      ${head("mdi:desktop-tower-monitor", "Ordinateurs", { href: `${this.prefix}/energie`, label: "Énergie" })}
      <div class="rows">${list.map((c) => this.computer(c))}</div>
    </section>`;
  }

  private favoriteList(): Favorite[] {
    const hass = store.hass!;
    const person = currentPerson(hass)?.replace("person.", "");
    return ((person && config.people[person]?.favorites) || config.people.tablet?.favorites || []).filter(
      (f) => f.type !== "jellyfin" && f.type !== "computers",
    );
  }

  private favorites() {
    const list = this.favoriteList();
    if (!list.length) return nothing;
    const one = (f: Favorite) => {
      switch (f.type) {
        case "battery":
          return html`<kh-battery .spec=${f}></kh-battery>`;
        case "calendar":
          return html`<kh-calendar .spec=${f}></kh-calendar>`;
        case "thermometer":
          return html`<kh-thermometer .spec=${f}></kh-thermometer>`;
        case "automation":
          return html`<kh-automation .spec=${f}></kh-automation>`;
      }
      return nothing;
    };
    const per = this.mode === "phone" ? 3 : 2;
    return html`<section class="card" style="--fam: var(--rgb-yellow)">
      ${head("mdi:star-outline", "Favoris")}
      ${list.length > per
        ? html`<kh-swipe label="Favoris">${pagesOf(list, per).map((pg) => html`<div class="favs">${pg.map(one)}</div>`)}</kh-swipe>`
        : html`<div class="favs">${list.map(one)}</div>`}
    </section>`;
  }

  render() {
    if (!store.hass) return nothing;
    const favs = this.favoriteList().length > 0;
    switch (this.mode) {
      case "phone":
        return html`<div class="home">
          ${this.scene()}${this.summary()}${this.favorites()}${this.rooms()}${this.media()}${this.energy()}
          ${this.computers()}${this.outlook()}${this.shortcuts()}
        </div>`;
      case "medium":
        return html`<div class="home">
          ${this.scene()}${this.summary()}${this.rooms()}
          <div class="lower">
            <div class="stack">${this.media()}${this.favorites()}${this.people()}</div>
            <div class="stack">${this.energy()}${this.computers()}${this.outlook()}${this.shortcuts()}</div>
          </div>
        </div>`;
      default:
        return html`<div class="home">
          <aside class="ambient">${this.scene()}${this.people()}${this.outlook()}${this.shortcuts()}</aside>
          <div class="main">
            ${this.summary()}${this.rooms()}
            <div class="lower" style=${favs ? "" : "--lc: minmax(0, 1.25fr) minmax(0, 1fr)"}>
              ${this.media()}
              <div class="stack">${this.energy()}${this.computers()}</div>
              ${favs ? this.favorites() : nothing}
            </div>
          </div>
        </div>`;
    }
  }
}
customElements.define("kh3-home", Kh3Home);
