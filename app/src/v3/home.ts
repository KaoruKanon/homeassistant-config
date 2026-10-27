import { LitElement, css, html, nothing } from "lit";
import { isPending, media, openMoreInfo, runScript, setVolume, toggle } from "../actions.ts";
import { alarmBadge, badgeClass, badgeStyle, badgeStyles, lightsBadge, temperatureBadge, timerBadge, windowsBadge } from "../badges.ts";
import "../components/energy-card.ts";
import { pcPress } from "../components/gestures.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Computer, type Favorite } from "../config.ts";
import { brightnessPercent, formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { alarmLook, openAlarm, openComputer, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { currentPerson, type HouseModel } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { FROG_SKY, forecastDays } from "../weather-utils.ts";
import "./light.ts";
import { pagesOf, ring, ui } from "./theme.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** One colour per room in Climat, the same from one visit to the next. */
const ROOM_COLORS = ["orange", "green", "purple", "teal", "amber", "indigo", "red", "blue"];

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const upper = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/**
 * V3 home, « la météo en fond d'écran ». The weather frog's landscape is no
 * longer a banner: it is the wallpaper of the whole home, so the screen
 * changes with the weather and the hour. Frosted-glass panels sit on it:
 *
 *   time, date, weather and the family on the sky; the house's chips
 *   ┌ the stage: what plays now, big ──────────┐ ┌ lights, as glowing ───┐
 *   │ (else what is new on Jellyfin)           │ │ discs                 │
 *   └──────────────────────────────────────────┘ └───────────────────────┘
 *   ┌ Énergie ─┐ ┌ Climat ─┐ ┌ Cinq jours ─┐ ┌ Favoris ─┐
 *   [ one glass bar: computers, stocks, shortcuts                       ]
 *
 * On the wall tablet it all fits one screen; on a phone it is one column.
 */
export class Kh3Home extends LitElement {
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true }, wall: { type: Boolean } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  declare wall: boolean;
  private timer?: number;
  private seconds?: number;
  private width = 1200;
  private sizer = new ResizeObserver(([e]) => {
    const before = this.phone;
    this.width = e.contentRect.width;
    if (before !== this.phone) this.requestUpdate();
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
        ...Object.keys(config.people).map((p) => `person.${p}`), ...this.batteries().map((b) => b.entity),
        ...(this.model?.rooms ?? []).flatMap((r) => [r.temperature, r.humidity]),
        ...h.lights.map((l) => l.entity), ...h.computers.flatMap((c) => [c.entity, c.busy]), ...h.stocks.map((s) => s.entity),
      ].filter((x): x is string => !!x);
    });
  }

  private get phone(): boolean {
    return !this.wall && this.width < 760;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const tick = () => {
      this.now = new Date();
      this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    // The track's progress moves every second, only while something plays.
    this.seconds = window.setInterval(() => this.playing() && this.requestUpdate(), 1000);
    window.addEventListener("kh-pending", this.onPending);
    this.width = this.getBoundingClientRect().width || window.innerWidth;
    this.sizer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
    window.clearInterval(this.seconds);
    this.sizer.disconnect();
    window.removeEventListener("kh-pending", this.onPending);
  }

  protected willUpdate(): void {
    this.setAttribute("layout", this.wall ? "wall" : this.phone ? "phone" : "wide");
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  private onPending = () => this.requestUpdate();

  static styles = [
    ui,
    badgeStyles,
    css`
      :host {
        display: block;
        position: relative;
        --gap: 12px;
        /* Solid surfaces and hairlines: no blur, no wash. */
        --page: #121418;
        --glass: #1a1d23;
        --glass-hi: rgb(255 255 255 / 0.09);
        --glass-line: rgb(255 255 255 / 0.07);
        --ink: #f2f4f7;
        --ink-2: rgb(242 244 247 / 0.58);
        --well: rgb(255 255 255 / 0.045);
        --lift: none;
      }
      :host(:not([dark])) {
        --page: #f2f3f5;
        --glass: #ffffff;
        --glass-hi: rgb(17 24 39 / 0.07);
        --glass-line: rgb(17 24 39 / 0.08);
        --ink: #111827;
        --ink-2: rgb(17 24 39 / 0.56);
        --well: #f4f5f7;
        --lift: 0 1px 2px rgb(16 24 40 / 0.05);
      }
      :host([layout="wall"]) {
        --gap: 10px;
      }

      /* ---------- Background: plain; the picture lives in the header only ---------- */
      .wallpaper {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: var(--page);
      }
      .home {
        position: relative;
        z-index: 1;
        isolation: isolate;
        display: grid;
        gap: var(--gap);
        color: var(--ink);
      }
      :host([layout="wall"]) .home {
        height: calc(100dvh - 20px);
        grid-template-rows: auto minmax(0, 1fr) auto auto;
      }

      .glass {
        position: relative;
        min-width: 0;
        box-sizing: border-box;
        border-radius: 20px;
        background: var(--glass);
        box-shadow: inset 0 0 0 1px var(--glass-line), var(--lift);
        /* What the shared components inside read. */
        --kh-text: var(--ink);
        --kh-text-2: var(--ink-2);
        --kh-card: var(--well);
        --kh-card-2: var(--glass-hi);
        --v3-text: var(--ink);
        --v3-muted: var(--ink-2);
        --v3-well: var(--well);
        --v3-well-hi: var(--glass-hi);
      }
      .panel {
        padding: 14px 16px 16px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
        gap: 10px;
      }
      :host([layout="wall"]) .panel {
        padding: 12px 14px 14px;
      }
      .title {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 26px;
        font-size: 0.9375rem;
        font-weight: 600;
        text-wrap: balance;
      }
      .title ha-icon {
        color: rgb(var(--c));
        --mdc-icon-size: 20px;
      }
      .title span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .title a {
        flex: none;
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        padding: 0 4px 0 10px;
        border-radius: 16px;
        color: var(--ink-2);
        font-size: 0.8125rem;
        font-weight: 500;
        text-decoration: none;
        --mdc-icon-size: 18px;
      }
      .title a:hover {
        color: var(--ink);
        background: var(--well);
      }

      /* ---------- On the sky: time, weather, family, chips ---------- */
      .sky {
        position: relative;
        display: grid;
        gap: var(--gap);
      }
      /* The weather frog, sharp, at its own 1920 × 317 ratio (a little taller on narrow screens). */
      .banner {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px;
        aspect-ratio: 1920 / 317;
        min-height: 168px;
        padding: 0 28px;
        box-sizing: border-box;
        border-radius: 20px;
        color: #fff;
        text-shadow: 0 1px 10px rgb(0 0 0 / 0.28);
        background-color: rgb(var(--frog));
        background-image: linear-gradient(90deg, rgba(var(--frog), 0.7) 0%, rgba(var(--frog), 0.2) 32%, rgba(var(--frog), 0) 52%), var(--scene);
        background-size: 100% 100%, cover;
        background-position: 0 0, var(--shift) 70%;
      }
      :host([layout="wall"]) .banner {
        min-height: 150px;
        padding: 0 22px;
      }
      /* Narrow screens: a taller crop of the picture, never wider than the screen. */
      :host([layout="phone"]) .banner {
        aspect-ratio: auto;
        min-height: 240px;
        padding: 20px;
        align-items: end;
        grid-template-columns: minmax(0, 1fr);
      }
      :host([layout="phone"]) .banner .side {
        position: absolute;
        top: 16px;
        right: 16px;
      }
      time {
        display: block;
        font-size: 5rem;
        font-weight: 200;
        line-height: 0.85;
        letter-spacing: -0.05em;
        font-variant-numeric: tabular-nums;
      }
      :host([layout="wall"]) time {
        font-size: 4rem;
      }
      .when {
        margin-top: 8px;
        font-size: 1.125rem;
        font-weight: 500;
      }
      .side {
        display: grid;
        justify-items: end;
        gap: 8px;
      }
      .now {
        display: flex;
        align-items: center;
        gap: 6px;
        color: inherit;
        text-decoration: none;
        border-radius: 18px;
        padding: 2px 6px;
      }
      .now img {
        width: 64px;
        height: 64px;
      }
      .now b {
        display: block;
        font-size: 2.25rem;
        font-weight: 300;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .now span {
        font-size: 0.875rem;
        font-weight: 500;
      }
      .avatars {
        display: flex;
        gap: 6px;
      }
      .avatar {
        position: relative;
        width: 46px;
        height: 46px;
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
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        display: grid;
        place-items: center;
        background: rgb(0 0 0 / 0.3);
        font-weight: 700;
      }
      .avatar.away img {
        filter: grayscale(0.9) brightness(0.85);
      }
      .avatar .dot {
        position: absolute;
        right: 2px;
        bottom: 2px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        border: 2px solid #fff;
        box-sizing: border-box;
        background: rgb(var(--rgb-green));
      }
      .avatar.away .dot {
        background: rgb(var(--rgb-red));
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 34px;
        padding: 0 14px;
        border-radius: 17px;
        background: var(--glass);
        box-shadow: inset 0 0 0 1px var(--glass-line), var(--lift);
        color: var(--ink);
        font-weight: 600;
        font-size: 0.8125rem;
        text-decoration: none;
        --mdc-icon-size: 17px;
      }
      .chip ha-icon {
        color: var(--b-ic, var(--ink-2));
      }
      :host(:not([dark])) .chip:not(.b-tint) ha-icon {
        color: var(--ink-2);
      }
      .chip.b-tint {
        background: rgba(var(--b-bg), var(--b-a));
        box-shadow: inset 0 0 0 1px rgba(var(--b-bg), 0.35);
      }
      .chip.blink ha-icon {
        animation: blink 1.2s ease-in-out infinite;
      }
      @keyframes blink {
        50% {
          opacity: 0.35;
        }
      }

      /* ---------- The stage and the lights ---------- */
      .middle {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
        gap: var(--gap);
        min-height: 0;
      }
      .stage {
        overflow: hidden;
        min-height: 300px;
        display: grid;
      }
      :host([layout="wall"]) .stage {
        min-height: 0;
      }
      .stage kh-swipe {
        min-height: 0;
      }
      .stage .page {
        position: relative;
        height: 100%;
        box-sizing: border-box;
      }
      /* Now playing: the cover, big, its own colours blurred behind. */
      .player {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 22px;
        padding: 22px;
        isolation: isolate;
        overflow: hidden;
        height: 100%;
        box-sizing: border-box;
      }
      .player .blur {
        position: absolute;
        inset: -40px;
        z-index: -1;
        background-image: var(--cover);
        background-size: cover;
        background-position: center;
        filter: blur(40px) saturate(1.4);
        opacity: 0.55;
      }
      .player .art {
        width: clamp(140px, 22vh, 220px);
        aspect-ratio: 1;
        border-radius: 20px;
        object-fit: cover;
        background: var(--well);
        box-shadow: 0 18px 40px rgb(0 0 0 / 0.4);
        display: grid;
        place-items: center;
        --mdc-icon-size: 64px;
      }
      .player .src {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--ink-2);
        --mdc-icon-size: 18px;
      }
      .player h2 {
        margin: 6px 0 2px;
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 1.15;
        letter-spacing: -0.01em;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-wrap: balance;
      }
      .player .by {
        color: var(--ink-2);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .progress {
        margin-top: 16px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        font-size: 0.75rem;
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
      }
      .progress .track {
        height: 4px;
        border-radius: 2px;
        background: var(--glass-hi);
        overflow: hidden;
      }
      .progress .track i {
        display: block;
        height: 100%;
        background: var(--ink);
        transform-origin: left;
      }
      .controls {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .controls button {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        --mdc-icon-size: 26px;
      }
      .controls button:hover {
        background: var(--well);
      }
      .controls .play {
        width: 64px;
        height: 64px;
        background: var(--ink);
        color: #10141c;
        --mdc-icon-size: 32px;
      }
      :host(:not([dark])) .controls .play {
        color: #fff;
      }
      .controls .play:hover {
        background: var(--ink);
        opacity: 0.9;
      }
      .controls .vol {
        margin-left: auto;
      }
      .stage .jelly {
        padding: 14px 16px 16px;
        display: grid;
        align-content: center;
        gap: 10px;
      }
      .discs {
        align-content: center;
        flex: 1;
      }

      /* Lights: glowing discs, tap to switch, slide to dim. */
      .discs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px 6px;
        --bulb: 68px;
        --bulb-off: var(--well);
        --bulb-ink: var(--ink-2);
      }
      :host([layout="wall"]) .discs {
        --bulb: 58px;
        gap: 8px 6px;
      }
      .disc {
        display: grid;
        justify-items: center;
        gap: 4px;
        text-align: center;
        min-width: 0;
      }
      .disc b {
        font-size: 0.8125rem;
        font-weight: 600;
        max-width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .disc small {
        margin-top: -4px;
        font-size: 0.75rem;
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
      }
      .disc.off {
        opacity: 0.45;
      }

      /* ---------- The row of panels ---------- */
      .row {
        position: relative;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--gap);
        align-items: stretch;
      }
      .energy kh-energy-card {
        display: block;
        margin: -14px -14px -12px;
        --kh-card: transparent;
        --kh-kpi-min: 76px;
      }
      .rooms {
        display: grid;
        gap: 6px;
      }
      .room {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas: "n v" "g g";
        align-items: baseline;
        padding: 6px 10px 0;
        border-radius: 14px;
        overflow: hidden;
        background: var(--well);
        width: 100%;
        box-sizing: border-box;
        text-align: left;
      }
      .room .n {
        grid-area: n;
        font-weight: 600;
        font-size: 0.875rem;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .room .v {
        grid-area: v;
        font-size: 1.25rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
      .room .v small {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--ink-2);
        margin-left: 4px;
      }
      .room kh-sparkline {
        grid-area: g;
        margin: 2px -10px 0;
      }
      .days {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        text-align: center;
      }
      .day {
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 6px 0 8px;
        border-radius: 14px;
        font-variant-numeric: tabular-nums;
      }
      .day:first-child {
        background: var(--well);
      }
      .day .d {
        font-size: 0.75rem;
        color: var(--ink-2);
        font-weight: 600;
      }
      .day img {
        width: 38px;
        height: 38px;
      }
      .day .hi {
        font-size: 1.125rem;
        font-weight: 400;
      }
      .day .lo {
        font-size: 0.8125rem;
        color: var(--ink-2);
      }
      .favs {
        display: grid;
        gap: 8px;
      }

      /* ---------- One glass bar: computers, stocks, shortcuts ---------- */
      .bar {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 6px;
        border-radius: 22px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .bar::-webkit-scrollbar {
        display: none;
      }
      .bar .sep {
        flex: none;
        width: 1px;
        height: 32px;
        margin: 0 6px;
        background: var(--glass-line);
      }
      .act {
        position: relative;
        overflow: hidden;
        flex: 1 1 0;
        min-width: 0;
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
        min-height: 52px;
        padding: 0 12px 0 6px;
        border-radius: 16px;
        color: inherit;
        text-decoration: none;
        text-align: left;
      }
      .act:hover {
        background: var(--well);
      }
      .act .ic {
        grid-row: span 2;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(var(--c), 0.22);
        color: rgb(var(--c));
        --mdc-icon-size: 20px;
      }
      .act.on .ic {
        background: rgb(var(--c));
        color: #fff;
        box-shadow: 0 0 14px rgba(var(--c), 0.6);
      }
      .act b,
      .act small {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .act b {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .act small {
        font-size: 0.75rem;
        color: var(--ink-2);
      }
      .act.busy::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, rgb(var(--c)), transparent) no-repeat;
        background-size: 50% 100%;
        animation: progress 1.3s ease-in-out infinite;
      }
      @keyframes progress {
        from {
          background-position: -50% 0;
        }
        to {
          background-position: 150% 0;
        }
      }
      .up {
        color: rgb(var(--rgb-green));
      }
      .down {
        color: rgb(var(--rgb-red));
      }

      /* ---------- Phone ---------- */
      :host([layout="phone"]) .sky {
        padding: 10px 4px 0;
      }
      :host([layout="phone"]) time {
        font-size: 4.5rem;
      }
      :host([layout="phone"]) .now img {
        width: 48px;
        height: 48px;
      }
      :host([layout="phone"]) .now b {
        font-size: 1.75rem;
      }
      :host([layout="phone"]) .middle,
      :host([layout="phone"]) .row {
        grid-template-columns: minmax(0, 1fr);
      }
      :host([layout="phone"]) .player {
        grid-template-columns: minmax(0, 1fr);
        justify-items: center;
        text-align: center;
      }
      :host([layout="phone"]) .player .controls,
      :host([layout="phone"]) .player .src {
        justify-content: center;
      }
      :host([layout="phone"]) .bar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      :host([layout="phone"]) .bar .sep {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .chip.blink ha-icon,
        .act.busy::after {
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

  private residents(): string[] {
    return Object.keys(config.people).filter((p) => !config.people[p].device && store.hass?.states[`person.${p}`]);
  }

  private openings(): string[] {
    return Object.values(store.hass?.states ?? {})
      .filter((s) => s.entity_id.startsWith("binary_sensor.") && ["window", "door", "opening"].includes(s.attributes.device_class))
      .map((s) => s.entity_id);
  }

  private get night(): boolean {
    return store.hass?.states["sun.sun"]?.state === "below_horizon";
  }

  private playing(): string | undefined {
    const h = config.home;
    return [h.spotify, ...h.tvs].find((id) => !!id && isPlayerActive(id));
  }

  private favoriteList(): Favorite[] {
    const hass = store.hass!;
    const person = currentPerson(hass)?.replace("person.", "");
    return ((person && config.people[person]?.favorites) || config.people.tablet?.favorites || []).filter(
      (f) => f.type !== "jellyfin" && f.type !== "computers",
    );
  }

  /* ---------------- On the sky ---------------- */

  private sky() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = Number(st(h.outdoorTemperature)?.state ?? weather?.attributes.temperature);
    const me = currentPerson(hass);
    const name = me?.endsWith("tablet") ? "" : String(st(me)?.attributes.friendly_name ?? "");
    return html`<header class="sky">
      <div class="banner">
      <div>
        <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
        <div class="when">${upper(date.format(this.now))}. ${greeting(this.now.getHours())}${name ? ` ${upper(name)}` : ""}.</div>
      </div>
      <div class="side">
        ${weather
          ? html`<a class="now" href=${`${this.prefix}/meteo`} aria-label="Météo : ${stateLabel(hass, weather)}${isNaN(temp) ? "" : `, ${formatNumber(temp)} degrés`}">
              <img src=${weatherIcon(weather.state, this.night)} alt="" width="64" height="64" />
              <span><b>${isNaN(temp) ? "—" : `${formatNumber(temp)}°`}</b>${stateLabel(hass, weather)}</span>
            </a>`
          : nothing}
        ${this.avatars()}
      </div>
      </div>
      ${this.chips()}
    </header>`;
  }

  private avatars() {
    const hass = store.hass!;
    return html`<div class="avatars">
      ${this.residents().map((p) => {
        const s = hass.states[`person.${p}`];
        const home = s.state === "home";
        const b = this.batteries().find((x) => x.key === p);
        const level = b ? Number(hass.states[b.entity]?.state) / 100 : NaN;
        return html`<button class="avatar ${home ? "" : "away"}" aria-label="${s.attributes.friendly_name} : ${home ? "à la maison" : "absent"}${isNaN(level) ? "" : `, batterie ${Math.round(level * 100)} %`}"
          @click=${() => openPerson(p)}>
          ${!isNaN(level) ? ring(level, 46, 3, level > 0.2 ? "#ffffff" : "rgb(255, 102, 108)") : nothing}
          ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" width="36" height="36" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
          <span class="dot"></span>
        </button>`;
      })}
    </div>`;
  }

  /** The V2 chips: rain, inside, the Google timer, lights, windows, alarm. */
  private chips() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const rain = st(h.nextRain)?.state;
    const rainAt = rain && Date.parse(rain) > Date.now() ? time.format(new Date(rain)) : "";
    const lights = Number(st(h.chips.lightsOn)?.state);
    const windows = Number(st(h.chips.windowsOpen)?.state);
    const timer = st(h.chips.timer)?.state;
    const timerOn = st(h.chips.timerActive)?.state === "active" || isActive(st(h.chips.timerActive));
    const indoor = Number(st(h.chips.temperature)?.state);
    const alarm = st(h.chips.alarm);
    return html`<div class="chips" aria-live="polite">
      ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella" aria-hidden="true"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
      ${!isNaN(indoor)
        ? html`<span class="chip ${badgeClass(temperatureBadge(indoor))}" style=${badgeStyle(temperatureBadge(indoor))}><ha-icon icon="mdi:home" aria-hidden="true"></ha-icon>${formatNumber(indoor)}° dedans</span>`
        : nothing}
      ${timer && !["unavailable", "unknown"].includes(timer)
        ? html`<span class="chip ${badgeClass(timerBadge(timerOn))} ${timerOn ? "blink" : ""}" style=${badgeStyle(timerBadge(timerOn))}><ha-icon icon="mdi:google-assistant" aria-hidden="true"></ha-icon>${timer}</span>`
        : nothing}
      ${!isNaN(lights)
        ? html`<a class="chip ${badgeClass(lightsBadge(lights))}" style=${badgeStyle(lightsBadge(lights))} href=${`${this.prefix}/pieces`}>
            <ha-icon icon=${lights > 0 ? "mdi:lightbulb" : "mdi:lightbulb-off"} aria-hidden="true"></ha-icon>${lights > 0 ? plural(lights, "allumée", "allumées") : "Tout éteint"}</a>`
        : nothing}
      ${!isNaN(windows)
        ? html`<button class="chip ${badgeClass(windowsBadge(windows))}" style=${badgeStyle(windowsBadge(windows))} @click=${() => openOpenings(this.openings())}>
            <ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"} aria-hidden="true"></ha-icon>${windows > 0 ? plural(windows, "ouverte", "ouvertes") : "Fermé"}</button>`
        : nothing}
      ${alarm
        ? html`<button class="chip ${badgeClass(alarmBadge(alarm.state))}" style=${badgeStyle(alarmBadge(alarm.state))} @click=${() => openAlarm(alarm.entity_id)}>
            <ha-icon icon=${alarmLook(alarm.state).icon} aria-hidden="true"></ha-icon>${alarmLook(alarm.state).label}</button>`
        : nothing}
    </div>`;
  }

  /* ---------------- The stage ---------------- */

  /** What plays now, big: cover, title, progress, controls. */
  private player(id: string) {
    const s = store.hass!.states[id];
    const a = s.attributes;
    const music = id === config.home.spotify;
    const cover = a.entity_picture as string | undefined;
    const duration = Number(a.media_duration);
    const updated = Date.parse(a.media_position_updated_at ?? "") || Date.now();
    const position = Number(a.media_position) + (s.state === "playing" ? (Date.now() - updated) / 1000 : 0);
    const known = !isNaN(duration) && duration > 0 && !isNaN(position);
    const by = [a.media_artist, a.media_album_name].filter(Boolean).join(", ") || (music ? "" : String(a.app_name ?? ""));
    const vol = Number(a.volume_level);
    return html`<div class="page player" style=${cover ? `--cover: url('${cover}')` : ""}>
      ${cover ? html`<div class="blur" aria-hidden="true"></div>` : nothing}
      ${cover
        ? html`<img class="art" src=${cover} alt="" width="200" height="200" />`
        : html`<span class="art" aria-hidden="true"><ha-icon icon=${music ? "mdi:music" : "mdi:television-play"}></ha-icon></span>`}
      <div style="min-width:0">
        <div class="src"><ha-icon icon=${music ? "mdi:spotify" : "mdi:television"} aria-hidden="true"></ha-icon>${music ? "Spotify" : a.friendly_name}</div>
        <h2>${a.media_title ?? stateLabel(store.hass!, s)}</h2>
        ${by ? html`<div class="by">${by}</div>` : nothing}
        ${known
          ? html`<div class="progress" aria-label="Lecture : ${clock(position)} sur ${clock(duration)}">
              <span>${clock(Math.min(position, duration))}</span>
              <span class="track"><i style="transform: scaleX(${Math.min(1, position / duration)})"></i></span>
              <span>${clock(duration)}</span>
            </div>`
          : nothing}
        <div class="controls">
          <button aria-label="Précédent" @click=${() => media(id, "media_previous_track")}><ha-icon icon="mdi:skip-previous" aria-hidden="true"></ha-icon></button>
          <button class="play" aria-label=${s.state === "playing" ? "Mettre en pause" : "Lire"} @click=${() => media(id, "media_play_pause")}>
            <ha-icon icon=${s.state === "playing" ? "mdi:pause" : "mdi:play"} aria-hidden="true"></ha-icon></button>
          <button aria-label="Suivant" @click=${() => media(id, "media_next_track")}><ha-icon icon="mdi:skip-next" aria-hidden="true"></ha-icon></button>
          <button class="vol" aria-label="Baisser le volume" @click=${() => (isNaN(vol) ? media(id, "volume_down") : setVolume(id, vol - 0.05))}><ha-icon icon="mdi:volume-minus" aria-hidden="true"></ha-icon></button>
          <button aria-label="Monter le volume" @click=${() => (isNaN(vol) ? media(id, "volume_up") : setVolume(id, vol + 0.05))}><ha-icon icon="mdi:volume-plus" aria-hidden="true"></ha-icon></button>
        </div>
      </div>
    </div>`;
  }

  private stage() {
    const playing = this.playing();
    const jelly = config.home.jellyfin
      ? html`<div class="page jelly">
          <h2 class="title" style="--c: var(--rgb-jellyfin)"><ha-icon icon="mdi:filmstrip-box-multiple" aria-hidden="true"></ha-icon><span>Ajouté sur Jellyfin</span>
            <a href=${`${this.prefix}/medias`}>Médias<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
          <kh-jellyfin></kh-jellyfin>
        </div>`
      : undefined;
    const player = playing ? this.player(playing) : undefined;
    if (!player && !jelly) return nothing;
    return html`<section class="glass stage" aria-label="Médias">
      ${player && jelly ? html`<kh-swipe label="Médias">${player}${jelly}</kh-swipe>` : (player ?? jelly)}
    </section>`;
  }

  private lights() {
    const hass = store.hass!;
    const lights = config.home.lights.filter((l) => hass.states[l.entity]);
    const on = lights.filter((l) => isActive(hass.states[l.entity])).length;
    return html`<section class="glass panel" aria-label="Lumières">
      <h2 class="title" style="--c: var(--rgb-amber)"><ha-icon icon="mdi:lightbulb-group" aria-hidden="true"></ha-icon>
        <span>${on ? plural(on, "lumière allumée", "lumières allumées") : "Lumières"}</span>
        <a href=${`${this.prefix}/pieces`}>Pièces<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <div class="discs">
        ${lights.map((l) => {
          const s = hass.states[l.entity];
          const pct = isActive(s) ? brightnessPercent(s) : undefined;
          return html`<div class="disc ${isUnavailable(s) ? "off" : ""}">
            <kh3-light bulb entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh3-light>
            <b>${l.name}</b>
            <small>${isUnavailable(s) ? "Injoignable" : isActive(s) ? (pct !== undefined ? `${pct} %` : "Allumée") : "Éteinte"}</small>
          </div>`;
        })}
      </div>
    </section>`;
  }

  /* ---------------- The row ---------------- */

  private energy() {
    if (!config.home.energy) return nothing;
    return html`<section class="glass panel energy" aria-label="Énergie">
      <h2 class="title" style="--c: var(--rgb-orange)"><ha-icon icon="mdi:lightning-bolt" aria-hidden="true"></ha-icon><span>Énergie</span>
        <a href=${`${this.prefix}/energie`}>Détail<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <kh-energy-card compact></kh-energy-card>
    </section>`;
  }

  private climate() {
    const hass = store.hass!;
    const rooms = (this.model?.rooms ?? []).filter((r) => r.temperature);
    const per = this.phone ? 5 : 2;
    return html`<section class="glass panel" aria-label="Climat">
      <h2 class="title" style="--c: var(--rgb-green)"><ha-icon icon="mdi:home-thermometer" aria-hidden="true"></ha-icon><span>Climat</span>
        <a href=${`${this.prefix}/meteo`}>Météo<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      ${rooms.length
        ? html`<kh-swipe label="Climat">
            ${pagesOf(rooms.map((r, i) => ({ r, i })), per).map(
              (pg) => html`<div class="rooms">${pg.map(({ r, i }) => {
                const t = Number(hass.states[r.temperature!]?.state);
                const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
                const c = `var(--rgb-${ROOM_COLORS[i % ROOM_COLORS.length]})`;
                return html`<button class="room" @click=${() => openMoreInfo(this, r.temperature!)}
                  aria-label="${r.name} : ${isNaN(t) ? "pas de mesure" : `${formatNumber(t)} degrés`}${isNaN(hum) ? "" : `, ${formatNumber(hum, 0)} % d'humidité`}">
                  <span class="n">${r.name}</span>
                  <span class="v">${isNaN(t) ? "—" : `${formatNumber(t)}°`}${isNaN(hum) ? nothing : html`<small>${formatNumber(hum, 0)}&nbsp;%</small>`}</span>
                  <kh-sparkline compact height="30" .entities=${[
                    { entity: r.temperature!, label: "Température", color: c, unit: "°C" },
                    ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
                  ]}></kh-sparkline>
                </button>`;
              })}</div>`,
            )}
          </kh-swipe>`
        : html`<div style="color: var(--ink-2)">Aucun thermomètre ne répond.</div>`}
    </section>`;
  }

  private days() {
    const days = forecastDays();
    if (!days.length) return nothing;
    return html`<section class="glass panel" aria-label="Cinq jours">
      <h2 class="title" style="--c: var(--rgb-light-blue)"><ha-icon icon="mdi:calendar-week" aria-hidden="true"></ha-icon><span>Cinq jours</span>
        <a href=${`${this.prefix}/meteo`}>Météo<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></a></h2>
      <div class="days" role="list">
        ${days.map(
          (d) => html`<div class="day" role="listitem" aria-label="${d.day} : ${formatNumber(d.temperature, 0)} degrés${d.templow !== undefined ? `, ${formatNumber(d.templow, 0)} au plus bas` : ""}">
            <span class="d">${upper(d.day)}</span>
            <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt="" width="38" height="38" />
            <span class="hi">${formatNumber(d.temperature, 0)}°</span>
            <span class="lo">${d.templow !== undefined ? `${formatNumber(d.templow, 0)}°` : ""}</span>
          </div>`,
        )}
      </div>
    </section>`;
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
    return html`<section class="glass panel" aria-label="Favoris">
      <h2 class="title" style="--c: var(--rgb-yellow)"><ha-icon icon="mdi:star" aria-hidden="true"></ha-icon><span>Favoris</span></h2>
      <kh-swipe label="Favoris">${pagesOf(list, this.phone ? 3 : 1).map((pg) => html`<div class="favs">${pg.map(one)}</div>`)}</kh-swipe>
    </section>`;
  }

  /* ---------------- The bar ---------------- */

  private computer(c: Computer) {
    const hass = store.hass!;
    const s = hass.states[c.entity];
    if (!s) return nothing;
    const on = isActive(s);
    const waiting = isPending(c.entity);
    const busy = waiting || (c.busy ? isActive(hass.states[c.busy]) : false);
    const press = pcPress(c.entity, () => toggle(c.entity, c.name), () => openComputer(c));
    const label = isUnavailable(s) ? "Injoignable" : busy ? (waiting ? (on ? "Arrêt…" : "Démarrage…") : "En cours…") : on ? "Allumé" : "Éteint";
    return html`<button class="act ${on ? "on" : ""} ${busy ? "busy" : ""}" style="--c: var(--rgb-blue)" aria-pressed=${String(on)}
      aria-description="Appui : allumer ou éteindre ; appui long : détails"
      @pointerdown=${press.down} @pointerup=${press.cancel} @pointermove=${press.move} @pointercancel=${press.cancel}
      @pointerleave=${press.cancel} @contextmenu=${press.contextmenu} @click=${press.click}>
      <span class="ic"><ha-icon icon="mdi:desktop-tower-monitor" aria-hidden="true"></ha-icon></span><b>${c.name}</b><small>${label}</small>
    </button>`;
  }

  private bar() {
    const hass = store.hass!;
    const h = config.home;
    const p = this.prefix;
    const guest = h.guestMode ? hass.states[h.guestMode] : undefined;
    const leaving = h.leave ? isActive(hass.states[h.leave]) : false;
    const stocks = h.stocks.filter((s) => s.home && hass.states[s.entity]);
    const shown = stocks.length ? stocks : h.stocks.filter((s) => hass.states[s.entity]).slice(0, 1);
    return html`<nav class="glass bar" aria-label="Ordinateurs, bourse et raccourcis">
      ${h.computers.map((c) => this.computer(c))}
      <span class="sep" aria-hidden="true"></span>
      ${shown.map((s) => {
        const ch = Number(hass.states[s.entity]?.attributes.regularMarketChangePercent);
        return html`<button class="act" style="--c: var(--rgb-teal)" @click=${() => openMoreInfo(this, s.entity)}>
          <span class="ic"><ha-icon icon="mdi:chart-line" aria-hidden="true"></ha-icon></span><b>${s.name}</b>
          <small class=${ch >= 0 ? "up" : "down"}>${isNaN(ch) ? "—" : `${ch >= 0 ? "+" : "−"}${formatNumber(Math.abs(ch), 1)} %`}</small>
        </button>`;
      })}
      <span class="sep" aria-hidden="true"></span>
      ${h.leave
        ? html`<button class="act" style="--c: var(--rgb-indigo)" @click=${() => runScript(h.leave!)}>
            <span class="ic"><ha-icon icon="mdi:hand-wave" aria-hidden="true"></ha-icon></span><b>Partir</b><small>${leaving ? "En cours…" : "Tout éteindre"}</small></button>`
        : nothing}
      ${guest
        ? html`<button class="act ${isActive(guest) ? "on" : ""}" style="--c: var(--rgb-amber)" aria-pressed=${String(isActive(guest))}
            @click=${() => toggle(h.guestMode!, "le mode invité")}>
            <span class="ic"><ha-icon icon="mdi:account-group" aria-hidden="true"></ha-icon></span><b>Mode invité</b><small>${isActive(guest) ? "Départs sans effet" : "Désactivé"}</small></button>`
        : nothing}
      ${h.wifiQr
        ? html`<button class="act" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}>
            <span class="ic"><ha-icon icon="mdi:qrcode" aria-hidden="true"></ha-icon></span><b>Wi-Fi</b><small>QR invités</small></button>`
        : nothing}
      <a class="act" style="--c: var(--rgb-purple)" href=${`${p}/medias`}><span class="ic"><ha-icon icon="mdi:remote-tv" aria-hidden="true"></ha-icon></span><b>Télécommande</b><small>Box TV</small></a>
      <a class="act" style="--c: var(--rgb-light-blue)" href=${`${p}/meteo`}><span class="ic"><ha-icon icon="mdi:radar" aria-hidden="true"></ha-icon></span><b>Radar</b><small>Pluie, Windy</small></a>
      <a class="act" style="--c: var(--rgb-indigo)" href=${`${p}/systeme`}><span class="ic"><ha-icon icon="mdi:cog" aria-hidden="true"></ha-icon></span><b>Système</b><small>Réseau, HA</small></a>
    </nav>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const frog = st(h.frog?.status)?.state ?? "";
    const pic = st(h.frog?.image)?.state ?? "";
    const place = st(h.frog?.location)?.state;
    const style = `--frog: ${FROG_SKY[frog] ?? "40, 130, 221"}; --scene: ${/^(https?:)?\//.test(pic) ? `url('${pic}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;
    return html`
      <div class="wallpaper" style=${style} aria-hidden="true"></div>
      <div class="home" style=${style}>
        ${this.sky()}
        <div class="middle">${this.stage()}${this.lights()}</div>
        <div class="row">${this.energy()}${this.climate()}${this.days()}${this.favorites()}</div>
        ${this.bar()}
      </div>
    `;
  }
}
customElements.define("kh3-home", Kh3Home);
