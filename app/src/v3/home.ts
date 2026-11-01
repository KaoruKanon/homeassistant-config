import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { isPending, media, openMoreInfo, runScript, setBrightness, setInputNumber, setLights, toggle } from "../actions.ts";
import { config, type Computer } from "../config.ts";
import { brightnessPercent, isUnavailable, stateLabel } from "../format.ts";
import { openAlarm, openComputer, openMediaItem, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { entityName, type HouseModel, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { forecastDays } from "../weather-utils.ts";
import { goTo } from "./nav.ts";
import { energyHours, f0, f1, homeCalendars, jellyfinItems, minutes, num, since, todayEvents, type CalEvent } from "./data.ts";
import { icon, liveIcon, lightIcon, weatherIcon, weatherKind } from "./icons.ts";
import { Gesture } from "./page.ts";
import { ui } from "./theme.ts";
import { playerCard, playerStyles } from "./player.ts";
import { jellyfinLogo } from "../components/brand-icons.ts";

const openLight = (id: string) => void import("../popups/details.ts").then((m) => m.openLight(id));

/** One card of « En ce moment »: its size in cells (columns × rows) and how to draw it. */
interface NowCard {
  key: string;
  w: 1 | 2;
  h: 1 | 2;
  body: () => TemplateResult;
  tint?: string;
}

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function greeting(h: number): string {
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  if (h < 22) return "Bonne soirée";
  return "Bonne nuit";
}

/**
 * Accueil. On wide screens a fixed frame (header, devices, right column)
 * fills the screen without scrolling; everything whose presence changes
 * (media, alerts, rare devices, agenda, lights left on) goes into
 * « En ce moment », a grid of fixed cells that swipes by pages.
 * On phones the same blocks stack in one column.
 */
export class Kh3Home extends LitElement {
  static properties = {
    prefix: {},
    model: { attribute: false },
    rooms: { attribute: false },
    phone: { type: Boolean },
    person: {},
    filter: { state: true },
    events: { state: true },
    energy: { state: true },
    page: { state: true },
    drag: { state: true },
    now: { state: true },
  };
  declare prefix: string;
  declare model: HouseModel;
  declare rooms: Room[];
  declare phone: boolean;
  declare person?: string;
  /** "fav" or a room id. */
  declare filter: string;
  declare events: CalEvent[];
  declare energy?: Awaited<ReturnType<typeof energyHours>>;
  declare page: number;
  /** Brightness preview while a finger drags on a light tile. */
  declare drag?: { id: string; pct: number };
  declare now: Date;
  private gestures = new Map<string, Gesture>();
  private clock = 0;
  private slow = 0;

  constructor() {
    super();
    this.filter = "fav";
    this.events = [];
    this.page = 0;
    this.now = new Date();
    new RegistryController(this);
    new EntitiesController(this, () => this.watched());
  }

  private watched(): string[] {
    const h = config.home;
    const rooms = this.model?.rooms ?? [];
    return [
      ...Object.values(h.chips).filter((x): x is string => !!x),
      ...h.lights.map((l) => l.entity),
      ...h.computers.flatMap((c) => [c.entity, c.busy].filter((x): x is string => !!x)),
      ...h.tvs,
      ...rooms.flatMap((r) => [...r.lights, ...r.openings, r.temperature, r.humidity]).filter((x): x is string => !!x),
      ...(this.model?.unassignedLights ?? []),
      h.spotify, h.jellyfin, h.energy?.power, h.energy?.today, h.outdoorTemperature, h.nextRain, h.guestMode,
      h.frog?.image, h.frog?.status, h.forecast?.sensor, ...config.weather, "sun.sun",
      ...config.media.speakers,
      ...config.energyPage.fans, ...Object.values(h.fanTimers ?? {}),
      config.energyPage.spare?.plug, config.energyPage.spare?.remaining, config.energyPage.spare?.power,
      ...Object.keys(store.hass?.states ?? {}).filter((id) => id.startsWith("person.")),
    ].filter((x): x is string => !!x);
  }

  connectedCallback(): void {
    super.connectedCallback();
    const tick = () => {
      this.now = new Date();
      this.clock = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    this.loadSlow();
    this.slow = window.setInterval(() => this.loadSlow(), 5 * 60_000);
    window.addEventListener("kh-pending", this.onPending);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.clock);
    window.clearInterval(this.slow);
    window.removeEventListener("kh-pending", this.onPending);
  }

  private onPending = () => this.requestUpdate();

  /** Agenda and Linky history: fetched once, then every 5 minutes. */
  private async loadSlow(): Promise<void> {
    const [events, energy] = await Promise.all([todayEvents(homeCalendars(this.person), 7), energyHours()]);
    this.events = events;
    if (energy) this.energy = energy;
  }

  static styles = [
    ui,
    playerStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* Wide: the frame fills the screen, nothing scrolls but « En ce moment ». */
      .wall {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.48fr);
        grid-template-rows: 56px auto minmax(0, 1fr);
        gap: 14px;
        height: calc(100vh - 32px);
        height: calc(100dvh - 32px);
        min-height: 640px;
      }
      .wall > header {
        grid-column: 1 / 3;
      }
      .wall .devices {
        grid-column: 1;
        grid-row: 2;
      }
      .wall .now {
        grid-column: 1;
        grid-row: 3;
      }
      .wall aside {
        grid-column: 2;
        grid-row: 2 / 4;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      header {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .clock {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: none;
      }
      .clock .t {
        font-size: 46px;
        font-weight: 700;
        line-height: 1;
      }
      .clock .d {
        font-size: 13px;
        color: var(--muted);
      }
      .clock .g {
        font-size: 15px;
        font-weight: 600;
      }
      .chips {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .chip {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 48px;
        padding: 0 14px 0 6px;
        border-radius: 999px;
        background: var(--surf);
        min-width: 120px;
        text-align: left;
        flex: none;
        scroll-snap-align: start;
      }
      .chip .ico {
        border-radius: 999px;
      }
      .chip .l {
        display: block;
        font-size: 11px;
        color: var(--muted);
        line-height: 1.2;
      }
      .chip .v {
        display: block;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      .people {
        display: flex;
        gap: 8px;
        flex: none;
      }
      .avatar {
        width: 46px;
        height: 46px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--surf2);
        display: grid;
        place-items: center;
        font-weight: 700;
        border: 2.5px solid var(--muted);
      }
      .avatar.home {
        border-color: var(--teal);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* Devices. */
      .devices {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .filters {
        margin: 0 -16px;
        padding: 0 16px;
        scroll-padding-inline: 16px;
      }
      .filters .pill .t {
        font-weight: 500;
        color: var(--muted);
      }
      .filters .pill[aria-pressed="true"] .t {
        color: inherit;
        opacity: 0.75;
      }
      .group-head {
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 20px;
      }
      .group-head .h {
        font-size: 14px;
      }
      .link {
        font-size: 13px;
        font-weight: 600;
        color: var(--amberInk);
        line-height: 20px;
        /* 44 px hit area in a 20 px box: the heading row never changes height. */
        padding: 12px 0;
        margin: -12px 0;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .tile.on .ico {
        background: var(--amber);
        color: #3a2400;
      }
      .tile.on .st {
        color: var(--amberInk);
        font-weight: 600;
      }
      .tile.dev.on {
        background: var(--blueTint);
      }
      .tile.dev.on .ico {
        background: var(--blue);
        color: #fff;
      }
      .tile.dev.on .st {
        color: var(--ink);
        font-weight: 400;
      }
      .tile.dim {
        touch-action: pan-y;
      }
      .busy {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        width: 40%;
        background: var(--blue);
        animation: busy 1.4s ease-in-out infinite;
      }
      @keyframes busy {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(260%);
        }
      }
      .room-list {
        max-height: 196px;
        overflow-y: auto;
        scrollbar-width: thin;
      }

      /* « En ce moment ». */
      .now {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        min-width: 0;
      }
      .now-head {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 32px;
      }
      .now-head .h {
        font-size: 18px;
      }
      .dots {
        display: flex;
        gap: 5px;
      }
      .dots i {
        display: block;
        height: 6px;
        width: 6px;
        border-radius: 99px;
        background: var(--ink);
        opacity: 0.3;
        transition: width 0.2s, opacity 0.2s;
      }
      .dots i.on {
        width: 16px;
        opacity: 1;
      }
      .scroller {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
      }
      .scroller::-webkit-scrollbar {
        display: none;
      }
      .anchor {
        position: absolute;
        top: 0;
        width: 1px;
        height: 1px;
        scroll-snap-align: start;
      }
      .scroller {
        container-type: inline-size;
      }
      .cells {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: calc((100cqw - 36px) / 4);
        grid-template-rows: repeat(2, minmax(0, 1fr));
        gap: 12px;
        height: 100%;
      }
      .jelly {
        gap: 10px;
      }
      .jelly.one {
        padding: 0;
      }
      .dyn.jelly {
        padding: 0;
        position: relative;
      }
      .jf {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        background: var(--surf2);
        text-align: left;
        color: #fff;
      }
      .jf img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Eased fade to the card at the bottom, as on the player. */
      .jf::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, transparent 35%, rgba(8, 10, 18, 0.08) 45%, rgba(8, 10, 18, 0.25) 55%,
          rgba(8, 10, 18, 0.5) 66%, rgba(8, 10, 18, 0.74) 78%, rgba(8, 10, 18, 0.9) 90%);
      }
      .jf-logo {
        position: absolute;
        z-index: 1;
        top: 10px;
        left: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        width: 32px;
        height: 32px;
        justify-content: center;
        border-radius: 99px;
        background: rgba(8, 10, 18, 0.6);
      }
      .jf-text {
        position: absolute;
        z-index: 1;
        inset: auto 0 56px 0;
        padding: 0 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .jf-facts {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 6px;
      }
      .jf-watch {
        position: absolute;
        z-index: 2;
        left: 10px;
        right: 10px;
        bottom: 10px;
        height: 38px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(90deg, #aa5cc3, #00a4dc);
      }
      .jelly:not(:has(.jf-watch)) .jf-text {
        bottom: 12px;
      }
      /* Phone: a short card, laid out like the player but mirrored: the
         poster, as tall as the card, on the left and fading into it to the
         right; logo in its corner, text and « Regarder » beside it. */
      .carousel .jelly {
        width: calc(100vw - 32px);
        max-width: 520px;
      }
      .carousel .jf {
        background: var(--surf);
        color: var(--ink);
      }
      .carousel .jf::after {
        display: none;
      }
      .carousel .jf img {
        right: auto;
        width: 150px;
        --fade: linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.03) 10%, rgba(0, 0, 0, 0.1) 20%, rgba(0, 0, 0, 0.22) 30%,
          rgba(0, 0, 0, 0.38) 40%, rgba(0, 0, 0, 0.56) 50%, rgba(0, 0, 0, 0.73) 60%, rgba(0, 0, 0, 0.87) 70%, rgba(0, 0, 0, 0.96) 80%, #000 90%);
        -webkit-mask-image: var(--fade);
        mask-image: var(--fade);
      }
      .carousel .jf-logo {
        top: 8px;
        left: 8px;
        width: 28px;
        height: 28px;
      }
      .carousel .jf-text {
        inset: 12px 12px auto 118px;
        padding: 0;
      }
      .carousel .jf-text b,
      .carousel .jf-text span {
        text-shadow: 0 1px 8px var(--surf);
      }
      .carousel .fact {
        background: color-mix(in srgb, var(--surf2) 85%, transparent);
        color: var(--ink);
        flex: none;
      }
      /* One row: a badge that does not fit wraps out of sight, whole. */
      .carousel .jf-facts {
        height: 22px;
        overflow: hidden;
      }
      .carousel .jf-watch {
        left: 118px;
        right: 12px;
        bottom: 12px;
        height: 36px;
      }
      .fact {
        height: 22px;
        padding: 0 8px;
        border-radius: 99px;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .dyn {
        border-radius: 18px;
        background: var(--surf);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        text-align: left;
      }
      .dyn .top {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .dyn .grow {
        flex: 1;
      }
      .dyn .big {
        font-size: 26px;
        font-weight: 700;
        line-height: 1;
      }
      .dyn .ctl {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dyn .rb {
        width: 38px;
        height: 38px;
      }
      .dyn.media {
        padding: 0;
      }
      .bar {
        display: block;
        height: 4px;
        border-radius: 99px;
        background: var(--surf2);
        overflow: hidden;
      }
      .bar i {
        display: block;
        height: 100%;
        background: var(--brand, var(--violet));
        border-radius: 99px;
      }
      .play {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        background: var(--violet);
        color: #fff;
        display: grid;
        place-items: center;
      }
      .ev {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        min-width: 0;
      }
      .ev i {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        margin-top: 5px;
        flex: none;
        background: var(--blue);
      }
      .poster {
        position: relative;
        padding: 0;
        color: #fff;
        background: var(--surf2);
        border-radius: 12px;
        overflow: hidden;
        min-height: 0;
        width: 100%;
        height: 100%;
        text-align: left;
      }
      .poster img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .poster > span {
        position: absolute;
        inset: auto 0 0 0;
        padding: 26px 10px 9px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
      }
      .quiet {
        justify-content: center;
        align-items: flex-start;
        background: transparent;
        border: 1.5px dashed color-mix(in srgb, var(--muted) 35%, transparent);
      }

      /* Right column. */
      .weather {
        position: relative;
        border-radius: 22px;
        overflow: hidden;
        color: #fff;
        background: #2e2f6e;
        min-height: 200px;
        flex: none;
        text-align: left;
        display: block;
        width: 100%;
      }
      .weather img.frog {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .weather .shade {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(10, 10, 30, 0.45), transparent 45%, rgba(10, 10, 30, 0.2));
      }
      .weather .now-t {
        position: absolute;
        left: 18px;
        top: 14px;
        display: flex;
        align-items: flex-end;
        gap: 12px;
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
      }
      .weather .temp {
        font-size: 46px;
        font-weight: 700;
        line-height: 1;
      }
      .weather .days {
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 8px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 8px 6px;
        border-radius: 14px;
        /* No backdrop blur: the animated icons above it would re-blur every frame. */
        background: rgba(14, 14, 36, 0.66);
      }
      .weather .day {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }
      .rooms-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }
      .rt {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 10px;
        height: 50px;
        border-radius: 12px;
        background: var(--surf2);
        text-align: left;
        min-width: 0;
      }
      .energy {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-height: 120px;
      }
      .bars {
        flex: 1;
        min-height: 40px;
        display: flex;
        align-items: flex-end;
        gap: 3px;
      }
      .bars span {
        flex: 1;
        position: relative;
        height: 100%;
      }
      .bars b,
      .bars u {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 3px 3px 1px 1px;
      }
      .bars u {
        background: var(--surf2);
      }
      .bars b {
        background: var(--yellow);
      }
      .shortcuts {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sc {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 62px;
        padding: 0 12px;
        border-radius: 16px;
        background: var(--surf);
        text-align: left;
        min-width: 0;
        flex: none;
        width: calc((100% - 16px) / 3);
        scroll-snap-align: start;
      }
      .sc[aria-pressed="true"] {
        background: var(--amber);
        color: #2e1c00;
      }
      .sc-dots {
        display: flex;
        justify-content: center;
        gap: 0;
        margin: -10px 0 -12px;
      }
      .sc-dots button {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
      }
      .sc-dots i {
        width: 5px;
        height: 5px;
        border-radius: 99px;
        background: var(--ink);
        opacity: 0.3;
      }
      .sc-dots i.on {
        width: 16px;
        opacity: 1;
      }

      /* Phone: one column, horizontal rows swipe. */
      .phone header {
        flex-wrap: wrap;
      }
      .phone .clock .t {
        font-size: 34px;
      }
      /* Phone: clock and people stay on one line; the date gives way first. */
      .phone .clock {
        flex: 1;
        min-width: 0;
        gap: 10px;
      }
      .phone .clock > span {
        min-width: 0;
      }
      .phone .clock .d,
      .phone .clock .g {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .phone header {
        row-gap: 14px;
      }
      @container (max-width: 380px) {
        .phone .clock .t {
          font-size: 30px;
        }
        .phone .clock .d {
          font-size: 12px;
        }
        .phone .clock .g {
          font-size: 13px;
        }
        .phone .avatar {
          width: 34px;
          height: 34px;
        }
        .phone .people {
          gap: 6px;
        }
        .phone .chip .ico {
          width: 24px;
          height: 24px;
        }
        .phone .chip .ico svg {
          width: 15px;
          height: 15px;
        }
        .phone .chip .v {
          font-size: 12px;
        }
        .phone .chip .l {
          font-size: 10.5px;
        }
      }
      /* Phone: the state chips as a grid aligned on the cards, all visible. */
      .phone .chips {
        order: 3;
        flex: none;
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        overflow: visible;
        margin: 0;
        padding: 0;
      }
      .phone .chip {
        min-width: 0;
        height: 52px;
        padding: 0 8px 0 5px;
        gap: 6px;
        border-radius: 16px;
      }
      .phone .chip .ico {
        width: 28px;
        height: 28px;
      }
      .phone .chip .ico svg {
        width: 17px;
        height: 17px;
      }
      .phone .chip > span:last-child {
        min-width: 0;
      }
      .phone .chip .v {
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .phone .people {
        margin-left: auto;
      }
      .phone .avatar {
        width: 40px;
        height: 40px;
      }
      .phone .tiles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .phone .tile {
        background: var(--surf);
      }
      .phone .devices {
        background: none;
        padding: 0;
      }
      .phone .pill {
        background: var(--surf);
      }
      .phone .pill[aria-pressed="true"] {
        background: var(--ink);
      }
      .carousel {
        margin: 0 -16px;
        padding: 0 16px;
        gap: 10px;
        scroll-snap-type: x mandatory;
        scroll-padding-inline: 16px;
      }
      .carousel .dyn {
        flex: none;
        height: 150px;
        width: 150px;
        scroll-snap-align: start;
      }
      .carousel .dyn.w2 {
        width: 310px;
      }
      .carousel .dyn.media {
        width: calc(100vw - 32px);
        max-width: 520px;
        padding: 0;
      }
      .phone .weather {
        min-height: 180px;
      }
      .phone .energy .bars {
        flex: none;
        height: 72px;
      }
      @container (max-width: 1100px) {
        .wall .chip:nth-child(n + 4) {
          display: none;
        }
      }
    `,
  ];

  // ——— Header ———

  private header() {
    const hass = store.hass!;
    const h = config.home.chips;
    const lightsOn = num(h.lightsOn) ?? 0;
    const open = num(h.windowsOpen) ?? 0;
    const alarm = h.alarm ? hass.states[h.alarm] : undefined;
    const timer = h.timer ? hass.states[h.timer] : undefined;
    // The sensor says "Pas de timer" (or 0) when nothing runs: only a time counts as running.
    const timerOn = !!timer && /\d/.test(timer.state) && timer.state !== "0";
    const avg = num(h.temperature);
    const hums = this.model.rooms.map((r) => num(r.humidity)).filter((v): v is number => v !== undefined);
    const hum = hums.length ? hums.reduce((x, y) => x + y, 0) / hums.length : undefined;
    const chip = (ico: string, label: string, value: string, look: string, onClick?: () => void) => {
      const body = html`<span class="ico" style=${look}>${liveIcon(ico, (ico === "window" && open > 0) || (ico === "timer" && timerOn))}</span><span><span class="l">${label}</span><span class="v">${value}</span></span>`;
      return onClick ? html`<button class="chip" @click=${onClick}>${body}</button>` : html`<div class="chip">${body}</div>`;
    };
    const off = "background:var(--surf2);color:var(--muted)";
    const persons = Object.values(hass.states).filter((s) => s.entity_id.startsWith("person.") && !config.people[s.entity_id.slice(7)]?.device);
    return html`<header>
      <div class="clock">
        <time class="t num" datetime=${this.now.toISOString()}>${timeFmt.format(this.now)}</time>
        <span><span class="d" style="display:block">${dateFmt.format(this.now).replace(/^./, (c) => c.toUpperCase())}</span><span class="g">${greeting(this.now.getHours())}</span></span>
      </div>
      <div class="chips hs" role="group" aria-label="État de la maison">
        ${chip("thermo", "Climat", avg !== undefined ? `${f1(avg)}°${hum !== undefined ? `  ${f0(hum)} %` : ""}` : "—", "background:var(--tealTint);color:var(--teal)", () => goTo(`${this.prefix}/climat`))}
        ${chip("bulb", "Lumières", lightsOn ? `${f0(lightsOn)} allumée${lightsOn > 1 ? "s" : ""}` : "Éteintes", lightsOn ? "background:var(--amber);color:#3a2400" : off, () => goTo(`${this.prefix}/maison`))}
        ${chip("window", "Ouvertures", open ? `${f0(open)} ouverte${open > 1 ? "s" : ""}` : "Fermées", open ? "background:var(--red);color:#fff" : off, () => openOpenings(this.model.rooms.flatMap((r) => r.openings)))}
        ${alarm ? chip("shield", "Alarme", stateLabel(hass, alarm), alarm.state === "disarmed" ? off : "background:var(--redTint);color:var(--red)", () => openAlarm(alarm.entity_id)) : nothing}
        ${timer ? chip("timer", "Minuteur", timerOn ? stateLabel(hass, timer) : "Aucun", timerOn ? "background:var(--amberTint);color:var(--amberInk)" : off) : nothing}
      </div>
      <div class="people">
        ${persons.map((p) => {
          const pic = p.attributes.entity_picture as string | undefined;
          const name = (p.attributes.friendly_name as string) ?? p.entity_id;
          const home = p.state === "home";
          return html`<button class="avatar ${home ? "home" : ""}" aria-label="${name}, ${stateLabel(hass, p)}" @click=${() => openPerson(p.entity_id.slice(7))}>
            ${pic ? html`<img src=${pic} alt="" width="46" height="46" decoding="async" />` : name.charAt(0)}
          </button>`;
        })}
      </div>
    </header>`;
  }

  // ——— Devices ———

  private gesture(key: string, tap: () => void, hold: () => void, drag?: (r: number, done: boolean) => void): Gesture {
    let g = this.gestures.get(key);
    if (!g) this.gestures.set(key, (g = new Gesture(tap, hold, drag)));
    return g;
  }

  private lightTile(id: string, name: string, ico: string) {
    const s = store.get(id);
    const gone = isUnavailable(s);
    const on = s?.state === "on";
    const dimmable = !gone && (s?.attributes.supported_color_modes ?? []).some((m: string) => m !== "onoff");
    const preview = this.drag?.id === id ? this.drag.pct : undefined;
    const pct = preview ?? (on ? (brightnessPercent(s) ?? 100) : 0);
    const g = this.gesture(
      `l:${id}`,
      () => !gone && toggle(id, name),
      () => openLight(id),
      dimmable
        ? (r, done) => {
            if (r < 0) return (this.drag = undefined);
            const v = Math.max(1, Math.round(r * 100));
            this.drag = { id, pct: v };
            if (done) {
              void setBrightness(id, v);
              window.setTimeout(() => this.drag?.id === id && (this.drag = undefined), 1200);
            }
          }
        : undefined,
    );
    return html`<button class="tile ${on || preview ? "on" : ""} ${dimmable ? "dim" : ""}" aria-disabled=${gone ? "true" : "false"}
      aria-pressed=${on ? "true" : "false"} aria-label="${name}, ${gone ? "hors ligne" : on ? `allumée à ${pct} %` : "éteinte"}"
      @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel} @click=${g.click} @keydown=${g.key} @contextmenu=${g.contextmenu}>
      <span class="fill" style="width:${on || preview ? pct : 0}%"></span>
      <span class="ico">${liveIcon(ico, on)}</span>
      <span style="min-width:0"><span class="nm ell">${name}</span><span class="st ell" style="display:block">${gone ? "Hors ligne" : on || preview ? `${pct} %` : "Éteinte"}</span></span>
    </button>`;
  }

  private computerTile(c: Computer) {
    const s = store.get(c.entity);
    const on = s?.state === "on";
    const waiting = isPending(c.entity) || store.get(c.busy ?? "")?.state === "on";
    const g = this.gesture(`c:${c.entity}`, () => toggle(c.entity, c.name), () => openComputer(c));
    return html`<button class="tile dev ${on ? "on" : ""}" aria-label="${c.name}, ${waiting ? "en cours" : on ? "allumé" : "éteint"}"
      @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel} @click=${g.click} @keydown=${g.key} @contextmenu=${g.contextmenu}>
      <span class="ico">${liveIcon("monitor", on)}</span>
      <span style="min-width:0"><span class="nm ell">${c.name}</span><span class="st ell" style="display:block">${waiting ? (on ? "S'arrête…" : "Démarre…") : on ? "Allumé" : "Éteint"}</span></span>
      ${waiting ? html`<span class="busy" aria-hidden="true"></span>` : nothing}
    </button>`;
  }

  private tvTile(id: string) {
    const s = store.get(id);
    const name = entityName(store.hass!, id, config);
    const on = !!s && !["off", "unavailable", "standby", "unknown"].includes(s.state);
    const app = (s?.attributes.app_name ?? s?.attributes.source) as string | undefined;
    const g = this.gesture(`t:${id}`, () => s && s.state !== "unavailable" && media(id, on ? "turn_off" : "turn_on"), () => openMoreInfo(this, id));
    return html`<button class="tile dev ${on ? "on" : ""}" aria-disabled=${isUnavailable(s) ? "true" : "false"} aria-label="${name}, ${on ? "allumée" : "éteinte"}"
      @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel} @click=${g.click} @keydown=${g.key} @contextmenu=${g.contextmenu}>
      <span class="ico">${liveIcon("tv", on)}</span>
      <span style="min-width:0"><span class="nm ell">${name}</span><span class="st ell" style="display:block">${isUnavailable(s) ? "Hors ligne" : on ? (app ?? "Allumée") : "Éteinte"}</span></span>
    </button>`;
  }

  private devices() {
    const h = config.home;
    const anyOn = h.lights.some((l) => store.get(l.entity)?.state === "on");
    const room = this.filter === "fav" ? undefined : this.rooms.find((r) => r.id === this.filter);
    return html`<section class="devices ${this.phone ? "" : "card"}" aria-label="Appareils">
      <div class="hs filters" role="group" aria-label="Pièces">
        <button class="pill" aria-pressed=${this.filter === "fav" ? "true" : "false"} @click=${() => (this.filter = "fav")}>${icon("star", 16)}Favoris</button>
        <a class="pill" href="${this.prefix}/maison">${icon("plan", 16)}Plan</a>
        ${this.rooms.map((r) => {
          const t = num(r.temperature);
          return html`<button class="pill" aria-pressed=${this.filter === r.id ? "true" : "false"} @click=${() => (this.filter = r.id)}>
            ${r.name}${this.phone && t !== undefined ? html`<span class="t num">${f1(t)}°</span>` : nothing}
          </button>`;
        })}
      </div>
      ${room
        ? this.roomDevices(room)
        : html`
            <div class="group-head"><h2 class="h">Lumières</h2>
              ${anyOn ? html`<button class="link" @click=${() => setLights(h.lights.map((l) => l.entity), false)}>Tout éteindre</button>` : nothing}</div>
            <div class="tiles">${h.lights.map((l) => this.lightTile(l.entity, l.name, lightIcon(l.icon)))}</div>
            <div class="group-head"><h2 class="h">Ordinateurs et télés</h2></div>
            <div class="tiles">${h.computers.map((c) => this.computerTile(c))}${h.tvs.map((t) => this.tvTile(t))}</div>
          `}
    </section>`;
  }

  private roomDevices(room: Room) {
    const hass = store.hass!;
    const lights = room.lights;
    const anyOn = lights.some((id) => store.get(id)?.state === "on");
    const tvs = room.media.filter((id) => config.home.tvs.includes(id));
    const pcs = config.home.computers.filter((c) => config.plan?.computers[room.id] === c.entity);
    return html`
      <div class="group-head"><h2 class="h">${room.name}</h2>
        <span style="display:flex;gap:12px;align-items:center">
          ${anyOn ? html`<button class="link" @click=${() => setLights(lights, false)}>Tout éteindre</button>` : nothing}
          <a class="link" style="color:var(--blue)" href="${this.prefix}/maison/${room.id}">Ouvrir</a>
        </span></div>
      <div class="room-list"><div class="tiles">
        ${lights.map((id) => this.lightTile(id, entityName(hass, id, config, room.name), "bulb"))}
        ${pcs.map((c) => this.computerTile(c))}
        ${tvs.map((t) => this.tvTile(t))}
        ${!lights.length && !pcs.length && !tvs.length ? html`<p class="empty">Rien à piloter ici.</p>` : nothing}
      </div></div>`;
  }

  // ——— En ce moment ———

  /** Cards in priority order; what is already on screen elsewhere is not repeated. */
  private nowCards(): NowCard[] {
    const hass = store.hass!;
    const h = config.home;
    const cards: NowCard[] = [];

    // 1. Windows open (the header counts them; the card says which and for how long).
    const open = this.model.rooms.flatMap((r) => r.openings.map((id) => ({ id, room: r.name }))).filter((o) => store.get(o.id)?.state === "on");
    if (open.length) {
      const oldest = open.map((o) => store.get(o.id)!).sort((a, b) => Date.parse(a.last_changed) - Date.parse(b.last_changed))[0];
      const out = num(h.outdoorTemperature);
      cards.push({
        key: "window", w: 1, h: 1, tint: "background:var(--redTint)",
        body: () => html`<div class="top"><span class="ico" style="background:var(--red);color:#fff">${liveIcon("window", true)}</span>
            <span class="nm ell">${open.length > 1 ? `${open.length} fenêtres` : `Fenêtre ${open[0].room.toLowerCase()}`}</span></div>
          <span class="grow"></span><span class="big num" style="color:var(--red)">${since(oldest.last_changed)}</span>
          <span class="st">ouverte${out !== undefined ? `, ${f1(out)}° dehors` : ""}</span>`,
      });
    }

    // 2. Media playing (Spotify, a speaker).
    const players = [h.spotify, ...config.media.speakers].filter((x): x is string => !!x);
    const playing = players.map((id) => store.get(id)).find((s) => s && (s.state === "playing" || s.state === "paused") && s.attributes.media_title);
    if (playing) cards.push({ key: "media", w: 2, h: 1, body: () => playerCard(playing.entity_id) as TemplateResult });

    // 3. Rare devices you can drive from here.
    for (const fan of config.energyPage.fans) {
      const s = store.get(fan);
      if (s?.state !== "on") continue;
      const timer = h.fanTimers?.[fan];
      const t = num(timer);
      cards.push({
        key: fan, w: 1, h: 1,
        body: () => html`<div class="top"><span class="ico" style="background:var(--tealTint);color:var(--teal)">${liveIcon("fan", true)}</span>
            <span style="min-width:0"><span class="nm ell">Ventilateur</span><span class="st">${s.attributes.percentage ? `${s.attributes.percentage} %` : "En marche"}</span></span></div>
          <span class="grow"></span>
          ${timer
            ? html`<div class="ctl"><button class="rb" aria-label="Moins de temps" @click=${() => setInputNumber(timer, Math.max(0, (t ?? 0) - 15))}>${icon("minus", 18)}</button>
                <span class="num grow" style="text-align:center;font-weight:700" aria-live="polite">${t ? minutes(t) : "Sans arrêt"}</span>
                <button class="rb" aria-label="Plus de temps" @click=${() => setInputNumber(timer, (t ?? 0) + 15)}>${icon("plus", 18)}</button></div>`
            : html`<button class="btn" @click=${() => toggle(fan, "Ventilateur")}>Arrêter</button>`}`,
      });
    }
    const spare = config.energyPage.spare;
    if (spare && store.get(spare.plug)?.state === "on") {
      const left = num(spare.remaining);
      const w = num(spare.power);
      cards.push({
        key: "spare", w: 1, h: 1,
        body: () => html`<div class="top"><span class="ico" style="background:var(--yellowTint);color:var(--yellowInk)">${liveIcon("scooter", true)}</span>
            <span style="min-width:0"><span class="nm ell">${spare.name}</span><span class="st">${w !== undefined ? `En charge, ${f0(w)} W` : "En charge"}</span></span></div>
          <span class="grow"></span>
          <div class="ctl"><button class="rb" aria-label="Moins de temps" @click=${() => runScript(spare.decrement)}>${icon("minus", 18)}</button>
            <span class="num grow" style="text-align:center;font-weight:700" aria-live="polite">${minutes(left)}</span>
            <button class="rb" aria-label="Plus de temps" @click=${() => runScript(spare.increment)}>${icon("plus", 18)}</button></div>`,
      });
    }

    // 4. The agenda: always there; today's events, else the next ones.
    {
      const midnight = new Date(this.now);
      midnight.setHours(24, 0, 0, 0);
      const today = this.events.filter((e) => e.start < midnight);
      const shown = (today.length ? today : this.events).slice(0, 4);
      const more = (today.length ? today : this.events).length - shown.length;
      const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" });
      const when = (e: CalEvent) =>
        e.start < midnight ? (e.allDay ? "Aujourd'hui" : timeFmt.format(e.start)) : `${dayFmt.format(e.start).replace(".", "")}${e.allDay ? "" : `, ${timeFmt.format(e.start)}`}`;
      cards.push({
        key: "agenda", w: 1, h: 2,
        body: () => html`<div class="top"><span class="ico" style="background:var(--blueTint);color:var(--blue)">${icon("calendar")}</span><span class="nm ell">Agenda</span></div>
          ${today.length ? nothing : html`<span class="st">${this.events.length ? "Rien aujourd'hui, ensuite :" : "Rien cette semaine"}</span>`}
          ${shown.map((e) => html`<div class="ev"><i></i><span style="min-width:0"><span class="st num" style="font-weight:600;display:block">${when(e)}</span>
            <span class="ell" style="display:block;font-size:13px;font-weight:600">${e.title}</span></span></div>`)}
          <span class="grow"></span>
          ${more > 0 ? html`<span class="st" style="color:var(--blue);font-weight:600">+${more} autre${more > 1 ? "s" : ""}</span>` : nothing}`,
      });
    }

    // 5. A TV on (already a tile; the card adds the volume).
    for (const tv of h.tvs) {
      const s = store.get(tv);
      if (!s || ["off", "unavailable", "standby", "unknown"].includes(s.state)) continue;
      const name = entityName(hass, tv, config);
      cards.push({
        key: tv, w: 1, h: 1,
        body: () => html`<div class="top"><span class="ico" style="background:var(--violetTint);color:var(--violet)">${liveIcon("tv", true)}</span>
            <span style="min-width:0"><span class="nm ell">${name}</span><span class="st ell" style="display:block">${s.attributes.app_name ?? s.attributes.source ?? "Allumée"}</span></span></div>
          <span class="grow"></span>
          <div class="ctl"><button class="rb" aria-label="Éteindre ${name}" @click=${() => media(tv, "turn_off")}>${icon("power", 18)}</button>
            <button class="rb" aria-label="Moins fort" @click=${() => media(tv, "volume_down")}>${icon("minus", 18)}</button>
            <button class="rb" aria-label="Plus fort" @click=${() => media(tv, "volume_up")}>${icon("plus", 18)}</button></div>`,
      });
    }
    return cards;
  }

  /** The last film or series added on Jellyfin (the newest of the two lists). */
  private latestJellyfin(): Record<string, any> | undefined {
    const all = [config.home.jellyfin, ...config.media.jellyfin.map((j) => j.entity)].flatMap((id) => jellyfinItems(id));
    const when = (i: Record<string, any>) => Date.parse(i.airdate ?? i.aired ?? "") || 0;
    return all.sort((a, b) => when(b) - when(a))[0];
  }

  /**
   * Jellyfin, like the player: the poster fills the card and fades into it at
   * the bottom; the logo on top, title, facts and « Regarder » over it.
   */
  private jellyfinCard(item: Record<string, any>, place = "", cls = "") {
    const art = item.poster || item.fanart;
    const sub = [item.number, item.episode].filter(Boolean).join(", ") || (item.aired ?? "").slice(0, 4);
    const rating = item.rating ? String(item.rating).replace(/[★☆]/g, "").trim() : "";
    const facts = [item.runtime ? `${item.runtime} min` : "", item.genres ? String(item.genres).split(",")[0] : ""].filter(Boolean);
    return html`<div class="dyn jelly ${cls}" style=${place}>
      <button class="jf" @click=${() => openMediaItem(item)} aria-label="${item.title}, ajouté sur Jellyfin">
        ${art ? html`<img src=${art} alt="" width="200" height="300" loading="lazy" decoding="async" />` : nothing}
        <span class="jf-logo">${jellyfinLogo(20)}</span>
        <span class="jf-text">
          <b class="ell" style="display:block;font-size:16px;line-height:1.2">${item.title}</b>
          ${sub ? html`<span class="ell" style="display:block;font-size:12px;opacity:.85">${sub}</span>` : nothing}
          <span class="jf-facts">
            ${rating ? html`<span class="fact"><span style="color:#f5b83d;display:flex">${icon("star", 12)}</span>${rating}</span>` : nothing}
            ${facts.map((f) => html`<span class="fact">${f}</span>`)}
          </span>
        </span>
      </button>
      ${item.deep_link
        ? html`<a class="jf-watch" href=${item.deep_link} target="_blank" rel="noopener">${icon("play", 14)}Regarder</a>`
        : nothing}
    </div>`;
  }

  /**
   * Places the cards in 2-row columns, in priority order, each at the first
   * spot it fits (column by column). Returns each card's place and what is
   * left free: whole free columns at the end, and single free cells.
   */
  private pack(cards: NowCard[]) {
    const taken: boolean[][] = [];
    const free = (c: number, r: number) => !taken[c]?.[r];
    const take = (c: number, r: number) => ((taken[c] ??= [false, false])[r] = true);
    const spots = new Map<string, { c: number; r: number; w: number; h: number }>();
    let last = -1;
    for (const card of cards) {
      for (let c = 0; ; c++) {
        let row = -1;
        if (card.h === 2) row = free(c, 0) && free(c, 1) && (card.w === 1 || (free(c + 1, 0) && free(c + 1, 1))) ? 0 : -1;
        else for (const r of [0, 1]) if (free(c, r) && (card.w === 1 || free(c + 1, r))) { row = r; break; }
        if (row < 0) continue;
        for (let dc = 0; dc < card.w; dc++) for (let dr = 0; dr < card.h; dr++) take(c + dc, row + dr);
        spots.set(card.key, { c, r: row, w: card.w, h: card.h });
        last = Math.max(last, c + card.w - 1);
        break;
      }
    }
    const used = last + 1;
    const pages = Math.max(1, Math.ceil(used / 4));
    const places = new Map<string, string>();
    for (const [k, s] of spots) places.set(k, `grid-column:${s.c + 1} / span ${s.w};grid-row:${s.r + 1} / span ${s.h}`);
    const tall = new Set([...spots].filter(([, s]) => s.h === 2).map(([k]) => k));
    // Fixed cells (4 per page): cards keep their size. Whole free columns on a
    // single page get one « Tout est calme » card.
    const cols = pages * 4;
    let firstFree = cols;
    while (firstFree > 0 && free(firstFree - 1, 0) && free(firstFree - 1, 1)) firstFree--;
    let calm = pages === 1 && firstFree < cols ? `grid-column:${firstFree + 1} / span ${cols - firstFree};grid-row:1 / span 2` : undefined;
    // Else the longest free run in a row (e.g. under the player).
    for (const r of [0, 1]) {
      for (let c = 0; !calm && pages === 1 && c < cols; c++) {
        let n = 0;
        while (c + n < cols && free(c + n, r) && (r === 1 || !free(c + n, 1))) n++;
        if (n >= 2) calm = `grid-column:${c + 1} / span ${n};grid-row:${r + 1}`;
      }
    }
    return { places, pages, cols, calm, tall };
  }

  private nowZone() {
    const cards = this.nowCards();
    const latest = this.latestJellyfin();
    const label = cards.length === 0 ? "Rien de particulier" : `${cards.length} chose${cards.length > 1 ? "s" : ""}`;
    const card = (c: NowCard, place = "", grown = false) =>
      html`<div class="dyn ${c.key === "media" ? "media" : ""} ${c.w === 2 ? "w2" : ""} ${grown && c.h === 1 ? "grown" : ""}" style="${place};${c.tint ?? ""}">${c.body()}</div>`;
    if (this.phone) {
      return html`<section class="now" aria-label="En ce moment">
        <div class="now-head"><h2 class="h">En ce moment</h2><span class="st" aria-live="polite">${label}</span></div>
        <div class="hs carousel">${cards.map((c) => card(c))}${latest ? this.jellyfinCard(latest, "", "w2") : nothing}</div>
      </section>`;
    }
    const all: NowCard[] = latest ? [...cards, { key: "jellyfin", w: 1, h: 2, body: () => html`` }] : cards;
    const { places, pages, calm, tall } = this.pack(all);
    return html`<section class="now" aria-label="En ce moment">
      <div class="now-head"><h2 class="h">En ce moment</h2><span class="st" aria-live="polite">${label}</span><span style="flex:1"></span>
        ${pages > 1
          ? html`<div class="dots" aria-hidden="true">${Array.from({ length: pages }, (_, i) => html`<i class=${i === this.page ? "on" : ""}></i>`)}</div>
              <button class="rb" style="width:36px;height:36px;background:var(--surf)" aria-label=${this.page < pages - 1 ? "Voir la suite" : "Revenir au début"}
                @click=${() => this.scrollNow(this.page < pages - 1 ? this.page + 1 : 0)}>${icon(this.page < pages - 1 ? "chevronR" : "chevronL", 18)}</button>`
          : nothing}
      </div>
      <div class="scroller" @scroll=${this.onNowScroll}>
        ${Array.from({ length: pages }, (_, i) => html`<span class="anchor" style="left:calc(${i} * (100% + 12px))"></span>`)}
        <div class="cells">
          ${cards.map((c) => card(c, places.get(c.key), tall.has(c.key)))}
          ${latest ? this.jellyfinCard(latest, places.get("jellyfin")) : nothing}
          ${calm
            ? html`<div class="dyn quiet" style=${calm}><span class="ico" style="background:var(--tealTint);color:var(--teal)">${icon("check")}</span>
                <span class="nm">Tout est calme</span><span class="st">Rien d'autre d'allumé ou d'ouvert qui demande ton attention.</span></div>`
            : nothing}
        </div>
      </div>
    </section>`;
  }

  private onNowScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    const p = Math.round(el.scrollLeft / (el.clientWidth + 12));
    if (p !== this.page) this.page = p;
  };

  private scrollNow(p: number): void {
    const el = this.renderRoot.querySelector<HTMLElement>(".scroller");
    el?.scrollTo({ left: p * (el.clientWidth + 12), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // ——— Right column ———

  private weather() {
    const hass = store.hass!;
    const w = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const frog = config.home.frog ? hass.states[config.home.frog.image]?.state : undefined;
    const t0 = num(config.home.outdoorTemperature) ?? Number(w?.attributes.temperature);
    const t = Number.isFinite(t0) ? t0 : undefined;
    const days = forecastDays(3);
    const rain = config.home.nextRain ? hass.states[config.home.nextRain] : undefined;
    const rainAt = rain && !isNaN(Date.parse(rain.state)) ? Date.parse(rain.state) : undefined;
    const rainText = rainAt && rainAt - Date.now() < 3 * 3600_000 ? `Pluie vers ${timeFmt.format(new Date(rainAt))}` : "Pas de pluie dans l'heure";
    return html`<a class="weather" href="${this.prefix}/meteo" aria-label="Météo : ${[t !== undefined ? `${f1(t)} degrés` : "", w ? stateLabel(hass, w) : ""].filter(Boolean).join(", ")}" style="min-height:${this.phone ? 180 : 212}px">
      ${frog && frog !== "unknown" ? html`<img class="frog" src=${frog} alt="" width="640" height="360" decoding="async" fetchpriority="low" />` : nothing}
      <span class="shade"></span>
      <span class="now-t"><span class="temp num">${t !== undefined ? `${f1(t)}°` : "—"}</span>
        <span style="padding-bottom:4px"><span style="display:block;font-size:15px;font-weight:600">${w ? stateLabel(hass, w) : ""}</span>
          <span style="display:block;font-size:12px;opacity:.9">${rainText}</span></span></span>
      ${days.length
        ? html`<span class="days">${days.map((d, i) => html`<span class="day">
            <span style="font-size:13px;font-weight:600;opacity:.9">${i === 0 ? "Auj." : d.day.replace(/^./, (c) => c.toUpperCase())}</span>
            ${weatherIcon(weatherKind(d.condition, false), 28)}
            <span><span class="num" style="font-size:17px;font-weight:700">${f0(d.temperature)}°</span>
              ${d.templow !== undefined ? html`<span class="num" style="font-size:13px;opacity:.75;margin-left:6px">${f0(d.templow)}°</span>` : nothing}</span>
          </span>`)}</span>`
        : nothing}
    </a>`;
  }

  private roomTemps() {
    const rooms = this.rooms.filter((r) => r.temperature).slice(0, 6);
    if (!rooms.length) return nothing;
    const out = num(config.home.outdoorTemperature);
    return html`<section class="card" aria-label="Températures des pièces" style="padding:12px 14px;flex:none">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="color:var(--teal);display:flex">${icon("thermo", 18)}</span>
        <h2 class="h" style="font-size:15px">Pièces</h2><span style="flex:1"></span>${out !== undefined ? html`<span class="st">Dehors ${f1(out)}°</span>` : nothing}</div>
      <div class="rooms-grid">${rooms.map((r) => {
        const t = num(r.temperature), hum = num(r.humidity);
        return html`<a class="rt" href="${this.prefix}/maison/${r.id}">
          <span class="st ell">${r.name}</span>
          <span style="display:flex;align-items:baseline;gap:5px"><span class="num" style="font-size:16px;font-weight:700">${t !== undefined ? `${f1(t)}°` : "—"}</span>
            ${hum !== undefined ? html`<span class="num st">${f0(hum)} %</span>` : nothing}</span>
        </a>`;
      })}</div>
    </section>`;
  }

  private energyCard() {
    const e = config.home.energy;
    if (!e) return nothing;
    const watts = num(e.power);
    const kwh = num(e.today);
    const hour = this.now.getHours();
    const today = this.energy?.today ?? [];
    const yday = this.energy?.yesterday ?? [];
    const soFar = today.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const ySoFar = yday.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const delta = ySoFar > 0 && soFar > 0 ? ((soFar - ySoFar) / ySoFar) * 100 : undefined;
    const max = Math.max(0.05, ...today, ...yday);
    return html`<a class="card energy" href="${this.prefix}/energie" aria-label="Énergie : ${f0(watts)} W maintenant, ${f1(kwh)} kWh aujourd'hui" style="padding:12px 14px">
      <span style="display:flex;align-items:center;gap:8px"><span style="color:var(--yellow);display:flex">${icon("boltFill", 18)}</span>
        <span class="h" style="font-size:15px">Énergie</span><span style="flex:1"></span>
        <span class="num" style="font-size:13px;font-weight:600">${f0(watts)} W</span><span class="st">maintenant</span></span>
      <span style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:22px;font-weight:700">${f1(kwh)}</span>
        <span class="st">kWh aujourd'hui${kwh !== undefined ? `, ${f1(kwh * e.pricePerKwh)} €` : ""}</span><span style="flex:1"></span>
        ${delta !== undefined
          ? html`<span class="num" style="font-size:13px;font-weight:700;color:${delta <= 0 ? "var(--teal)" : "var(--red)"}">${delta <= 0 ? "−" : "+"}${f0(Math.abs(delta))} %</span><span class="st">vs hier</span>`
          : nothing}</span>
      <span class="bars" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => html`<span>
        <u style="height:${((yday[i] ?? 0) / max) * 100}%"></u>${i <= hour ? html`<b style="height:${((today[i] ?? 0) / max) * 100}%"></b>` : nothing}</span>`)}</span>
    </a>`;
  }

  private shortcuts() {
    const h = config.home;
    const guest = h.guestMode ? store.get(h.guestMode) : undefined;
    const items: TemplateResult[] = [];
    if (h.leave) items.push(html`<button class="sc" @click=${() => runScript(h.leave!)}><span style="color:var(--blue);display:flex">${icon("leave", 22)}</span><span class="nm">Partir</span></button>`);
    if (guest)
      items.push(html`<button class="sc" aria-pressed=${guest.state === "on" ? "true" : "false"} @click=${() => toggle(guest.entity_id, "Mode invité")}>
        <span style="display:flex;${guest.state === "on" ? "" : "color:var(--amberInk)"}">${icon("guest", 22)}</span>
        <span style="min-width:0"><span class="nm">Invités</span><span style="display:block;font-size:11px;font-weight:600">${guest.state === "on" ? "Activé" : "Désactivé"}</span></span></button>`);
    if (h.wifiQr) items.push(html`<button class="sc" @click=${() => openWifiQr()}><span style="color:var(--teal);display:flex">${icon("wifi", 22)}</span><span class="nm">Wi-Fi</span></button>`);
    if (config.media.box) items.push(html`<a class="sc" href="${this.prefix}/medias"><span style="color:var(--violet);display:flex">${icon("remote", 22)}</span><span class="nm">Box TV</span></a>`);
    items.push(html`<a class="sc" href="${this.prefix}/meteo"><span style="color:var(--blue);display:flex">${icon("radar", 22)}</span><span class="nm">Radar</span></a>`);
    const pages = Math.ceil(items.length / 3);
    return html`<section class="shortcuts" aria-label="Raccourcis">
      <div class="hs" style="gap:8px;scroll-snap-type:x mandatory" @scroll=${this.onScScroll}>${items}</div>
      ${pages > 1 ? html`<div class="sc-dots" role="group" aria-label="Pages de raccourcis">${Array.from({ length: pages }, (_, i) => html`<button aria-label="Raccourcis, page ${i + 1}" aria-current=${i === this.scPage ? "true" : "false"} @click=${(e: Event) => this.scrollShortcuts(e, i)}><i class=${i === this.scPage ? "on" : ""}></i></button>`)}</div>` : nothing}
    </section>`;
  }

  private scrollShortcuts(e: Event, page: number): void {
    const row = (e.currentTarget as HTMLElement).closest(".shortcuts")?.querySelector<HTMLElement>(".hs");
    row?.scrollTo({ left: page * (row.clientWidth + 8), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  private scPage = 0;
  private onScScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (p !== this.scPage) {
      this.scPage = p;
      this.requestUpdate();
    }
  };

  render() {
    if (!store.hass || !this.model) return nothing;
    if (this.phone) {
      return html`<h1 class="sr">Accueil</h1><div class="stack phone">
        ${this.header()}
        ${this.nowZone()}
        ${this.devices()}
        ${this.weather()}
        ${this.energyCard()}
        ${this.shortcuts()}
      </div>`;
    }
    return html`<h1 class="sr">Accueil</h1><div class="wall">
      ${this.header()}
      ${this.devices()}
      ${this.nowZone()}
      <aside>${this.weather()}${this.roomTemps()}${this.energyCard()}${this.shortcuts()}</aside>
    </div>`;
  }
}
customElements.define("kh3-home", Kh3Home);
