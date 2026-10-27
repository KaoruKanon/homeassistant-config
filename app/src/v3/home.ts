import { LitElement, css, html, nothing } from "lit";
import { isPending, openMoreInfo, runScript, toggle } from "../actions.ts";
import { alarmBadge, badgeClass, badgeStyle, badgeStyles, lightsBadge, temperatureBadge, timerBadge, windowsBadge } from "../badges.ts";
import "../components/energy-card.ts";
import { pcPress } from "../components/gestures.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Computer, type Favorite } from "../config.ts";
import { formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { alarmLook, openAlarm, openComputer, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { currentPerson, type HouseModel } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import "../v2/floorplan.ts";
import { houseScene, roomScene, roomSceneStyles } from "../v2/room-art.ts";
import { energyScene, mediaScene, sceneStyles } from "../v2/scenes.ts";
import { FROG_SKY, forecastDays, frogSky } from "../weather-utils.ts";
import "./light.ts";
import { head, pagesOf, ring, ui } from "./theme.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** One colour per room, the same everywhere on the home. */
const ROOM_COLORS = ["orange", "green", "purple", "teal", "amber", "indigo", "red", "blue"];

/** The three home layouts proposed for V3, to compare on the real house. */
export const EXAMPLES = [
  { key: "a", label: "Maison de Tomo" },
  { key: "b", label: "Une scène par tuile" },
  { key: "c", label: "Plan vivant" },
] as const;
type Example = (typeof EXAMPLES)[number]["key"];

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const upper = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/**
 * V3 home, three illustrated proposals built from the same tiles:
 *  a. Maison de Tomo: the weather frog and the doll's house side by side, lit
 *     rooms glowing with their temperature, the family on the lawn.
 *  b. Une scène par tuile: the V2 arrangement, the big tiles each topped by a
 *     living scene (Tomo on the sofa when something plays, the wind turbine
 *     turning with the power drawn, the favourite room lit by its lamps).
 *  c. Plan vivant: the flat's plan in the middle, the tiles around it.
 * Tiles keep the V2 colours (a wash of their family colour) and fill the
 * screen; on the wall tablet everything fits without scrolling.
 */
export class Kh3Home extends LitElement {
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true }, wall: { type: Boolean }, example: { state: true } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  declare wall: boolean;
  declare example: Example;
  private timer?: number;
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
    const asked = new URLSearchParams(location.search).get("exemple");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("kh3-example");
    } catch {
      /* private mode: no memory of the choice */
    }
    this.example = (EXAMPLES.find((e) => e.key === (asked ?? saved))?.key ?? "a") as Example;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        h.spotify, ...h.tvs, h.frog?.status, h.frog?.image, h.frog?.location, h.outdoorTemperature, h.nextRain, h.guestMode, h.leave,
        ...Object.values(h.chips), ...config.weather, h.energy?.power, "sun.sun",
        ...Object.keys(config.people).map((p) => `person.${p}`), ...this.batteries().map((b) => b.entity),
        ...(this.model?.rooms ?? []).flatMap((r) => [r.temperature, r.humidity, ...r.lights]),
        ...h.lights.map((l) => l.entity), ...h.computers.flatMap((c) => [c.entity, c.busy]), ...h.stocks.map((s) => s.entity),
      ].filter((x): x is string => !!x);
    });
  }

  private get phone(): boolean {
    return !this.wall && this.width < 680;
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
    this.setAttribute("layout", this.wall ? "wall" : this.phone ? "phone" : "wide");
    this.toggleAttribute("dark", !!store.hass?.themes.darkMode);
  }

  private onPending = () => this.requestUpdate();

  private pick(e: Example): void {
    this.example = e;
    try {
      localStorage.setItem("kh3-example", e);
    } catch {
      /* private mode */
    }
  }

  static styles = [
    ui,
    badgeStyles,
    roomSceneStyles,
    sceneStyles,
    css`
      :host {
        display: block;
        --v3-gap: 12px;
      }
      /* V2 colours: each tile washed with its family colour, see-through wells. */
      .card {
        background: linear-gradient(160deg, rgba(var(--fam, var(--rgb-grey)), 0.2), rgba(var(--fam, var(--rgb-grey)), 0.05) 62%), var(--v3-surface);
        box-shadow: none;
        --v3-well: rgb(0 0 0 / 0.045);
        --v3-well-hi: rgb(0 0 0 / 0.08);
        --kh-card: var(--v3-well);
        --kh-card-2: var(--v3-well-hi);
      }
      :host([dark]) .card {
        --v3-well: rgb(255 255 255 / 0.06);
        --v3-well-hi: rgb(255 255 255 / 0.1);
      }
      .head .glyph {
        background: rgb(var(--fam, var(--rgb-grey)));
        color: #fff;
      }
      :host([dark]) .head .glyph {
        color: #151a20;
      }

      /* ---------- Arrangements ---------- */
      .cols {
        margin-top: var(--v3-gap);
        display: grid;
        grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr));
        gap: var(--v3-gap);
        align-items: start;
      }
      .col {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--v3-gap);
        min-width: 0;
      }
      .col > .cols {
        margin-top: 0;
      }
      :host([layout="wall"]) {
        --v3-gap: 10px;
      }
      :host([layout="wall"]) .card {
        padding: 12px;
        gap: 10px;
      }
      :host([layout="phone"]) .cols {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      /* ---------- The weather frog: banner (b, c) or panel (a) ---------- */
      .frog {
        position: relative;
        overflow: hidden;
        border-radius: 26px;
        padding: 16px 20px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto 1fr auto;
        min-height: 168px;
        color: #fff;
        background-color: rgb(var(--frog));
        background-image: linear-gradient(100deg, rgba(var(--frog), 0.72) 0%, rgba(var(--frog), 0.2) 40%, rgba(var(--frog), 0) 62%), var(--scene);
        background-size: 100% 100%, cover;
        background-position: top, var(--shift) 78%;
        background-repeat: no-repeat;
        text-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
      }
      time {
        display: block;
        font-family: var(--v3-display);
        font-size: 3.25rem;
        font-weight: 700;
        line-height: 0.95;
        letter-spacing: -0.035em;
        font-variant-numeric: tabular-nums;
      }
      .when {
        margin-top: 6px;
        font-weight: 600;
        line-height: 1.3;
      }
      .side {
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 6px;
      }
      .now {
        display: flex;
        align-items: center;
        gap: 4px;
        color: inherit;
        text-decoration: none;
        font-family: var(--v3-display);
        font-size: 1.6rem;
        font-weight: 700;
      }
      .now img {
        width: 46px;
        height: 46px;
        animation: float 4s ease-in-out infinite alternate;
      }
      @keyframes float {
        from {
          transform: translateY(2px);
        }
        to {
          transform: translateY(-3px);
        }
      }
      .cond {
        font-weight: 600;
        font-size: 0.875rem;
      }
      .avatars {
        display: flex;
        gap: 6px;
      }
      .avatar {
        position: relative;
        width: 44px;
        height: 44px;
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
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        display: grid;
        place-items: center;
        background: rgb(0 0 0 / 0.3);
        font-weight: 700;
      }
      .avatar.away img {
        filter: grayscale(0.9) brightness(0.8);
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
        grid-column: 1 / -1;
        grid-row: 3;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        background: rgb(0 0 0 / 0.34);
        color: #fff;
        font-weight: 600;
        font-size: 0.8125rem;
        text-decoration: none;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        --mdc-icon-size: 17px;
      }
      .chip.b-tint {
        background: rgba(var(--b-bg), calc(var(--b-a) + 0.3));
      }
      .chip.blink ha-icon {
        animation: blink 1.2s ease-in-out infinite;
      }
      @keyframes blink {
        50% {
          opacity: 0.35;
        }
      }

      /* ---------- a: the doll's house ---------- */
      .stage {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--v3-gap);
      }
      .stage .frog {
        min-height: 236px;
      }
      .house {
        position: relative;
        overflow: hidden;
        border-radius: 26px;
        min-height: 236px;
        color: #fff;
        background: rgb(var(--sky));
      }
      .house.night {
        background: #18204a;
      }
      /* The 800 × 240 frame scaled to the panel's height, the house (its right
         part) brought into view. */
      .house .art svg {
        position: absolute;
        right: 1%;
        bottom: 0;
        height: 100%;
        width: auto;
        aspect-ratio: 800 / 240;
      }
      .house .caption {
        position: absolute;
        z-index: 2;
        left: 18px;
        top: 16px;
        display: grid;
        gap: 2px;
        text-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
        pointer-events: none;
      }
      .house .caption b {
        font-family: var(--v3-display);
        font-size: 1.375rem;
        font-weight: 700;
      }
      .house .caption span {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .lawn {
        position: absolute;
        z-index: 2;
        left: 16px;
        bottom: 14px;
      }

      /* ---------- b: a living scene on top of the big tiles ---------- */
      .scened {
        position: relative;
        height: 96px;
        margin: -16px -16px 0;
        overflow: hidden;
        border-radius: var(--v3-r-card) var(--v3-r-card) 0 0;
        container-type: size;
        --scene-max: 400cqw;
      }
      :host([layout="wall"]) .scened {
        margin: -12px -12px 0;
        height: 80px;
      }

      /* ---------- c: the plan ---------- */
      .slim .frog {
        min-height: 0;
        padding: 12px 18px;
      }
      .slim time {
        font-size: 2.5rem;
      }
      .slim .when {
        margin-top: 2px;
        font-size: 0.875rem;
      }
      .slim .chips {
        margin-top: 6px;
      }
      .plan {
        padding: 0;
        overflow: hidden;
      }
      .plan kh-floorplan {
        display: block;
      }

      /* ---------- Tiles ---------- */
      .lights {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .climate {
        display: grid;
        gap: 6px;
      }
      .room {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        grid-template-areas: "ic n v" "g g g";
        align-items: center;
        column-gap: 10px;
        padding: 8px 10px 0;
        border-radius: var(--v3-r-item);
        overflow: hidden;
        background: linear-gradient(160deg, rgba(var(--c), 0.18), rgba(var(--c), 0.03) 70%), var(--v3-well);
        width: 100%;
        box-sizing: border-box;
        text-align: left;
      }
      .room .ic {
        grid-area: ic;
        width: 34px;
        height: 34px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: rgba(var(--c), 0.24);
        color: rgb(var(--c));
        --mdc-icon-size: 19px;
      }
      .room .n {
        grid-area: n;
        font-weight: 600;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .room .v {
        grid-area: v;
        text-align: right;
        font-weight: 700;
        font-size: 1.125rem;
      }
      .room .v small {
        display: block;
        font-family: var(--v3-ui);
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--v3-muted);
      }
      .room kh-sparkline {
        grid-area: g;
        margin: 4px -10px 0;
      }
      .energy {
        --kh-card: transparent;
        --kh-kpi-min: 84px;
      }
      .energy kh-energy-card {
        margin: -14px;
      }
      :host([layout="wall"]) .energy kh-energy-card {
        margin: -14px -12px -12px;
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
        border-radius: var(--v3-r-item);
      }
      .day:first-child {
        background: var(--v3-well);
      }
      .day .d {
        font-size: 0.8125rem;
        color: var(--v3-muted);
        font-weight: 500;
      }
      .day img {
        width: 38px;
        height: 38px;
      }
      .day .hi {
        font-weight: 700;
      }
      .day .lo {
        font-size: 0.8125rem;
        color: var(--v3-muted);
      }
      .rows {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 118px), 1fr));
        gap: 6px;
      }
      .pc {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        min-height: 50px;
        padding: 6px 10px 6px 8px;
        border-radius: var(--v3-r-item);
        background: var(--v3-well);
        width: 100%;
        box-sizing: border-box;
        text-align: left;
      }
      .pc .ic {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: var(--v3-well-hi);
        color: var(--v3-muted);
        --mdc-icon-size: 19px;
      }
      .pc.on {
        background: linear-gradient(120deg, rgba(var(--rgb-blue), 0.3), rgba(var(--rgb-blue), 0.08));
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
      .ticks {
        display: grid;
        gap: 6px;
      }
      .tick {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        min-height: 42px;
        align-items: center;
        padding: 0 12px;
        border-radius: var(--v3-r-item);
        background: var(--v3-well);
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
      .shortcuts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .sc {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
        min-height: 46px;
        padding: 5px 10px;
        box-sizing: border-box;
        border-radius: var(--v3-r-item);
        background: linear-gradient(120deg, rgba(var(--c), 0.26), rgba(var(--c), 0.08));
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
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .sc.on {
        box-shadow: inset 0 0 0 2px rgba(var(--c), 0.8);
      }
      .favs {
        display: grid;
        gap: 8px;
      }

      /* ---------- The example picker ---------- */
      .picker {
        position: fixed;
        z-index: 4;
        right: 16px;
        bottom: calc(16px + env(safe-area-inset-bottom));
        display: flex;
        gap: 2px;
        padding: 4px;
        border-radius: 22px;
        background: var(--v3-veil);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
      }
      :host([layout="phone"]) .picker {
        bottom: calc(92px + env(safe-area-inset-bottom));
      }
      .picker button {
        height: 36px;
        padding: 0 14px;
        border-radius: 18px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--v3-muted);
      }
      .picker button[aria-pressed="true"] {
        background: rgb(var(--rgb-blue));
        color: #fff;
      }
      :host([layout="phone"]) .picker .long {
        display: none;
      }

      /* ---------- Phone ---------- */
      :host([layout="phone"]) .stage {
        grid-template-columns: minmax(0, 1fr);
      }
      :host([layout="phone"]) .frog {
        min-height: 220px;
      }
      :host([layout="phone"]) .house {
        min-height: 200px;
      }
    `,
  ];

  /* ---------------- The stage ---------------- */

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

  private avatars() {
    const hass = store.hass!;
    return html`<div class="avatars">
      ${this.residents().map((p) => {
        const s = hass.states[`person.${p}`];
        const home = s.state === "home";
        const b = this.batteries().find((x) => x.key === p);
        const level = b ? Number(hass.states[b.entity]?.state) / 100 : NaN;
        return html`<button class="avatar ${home ? "" : "away"}" aria-label="${s.attributes.friendly_name} : ${home ? "à la maison" : "absent"}" @click=${() => openPerson(p)}>
          ${!isNaN(level) ? ring(level, 44, 3, level > 0.2 ? "#ffffff" : "rgb(255, 102, 108)") : nothing}
          ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
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
    return html`<div class="chips">
      ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
      ${!isNaN(indoor)
        ? html`<span class="chip ${badgeClass(temperatureBadge(indoor))}" style=${badgeStyle(temperatureBadge(indoor))}><ha-icon icon="mdi:home"></ha-icon>${formatNumber(indoor)}°</span>`
        : nothing}
      ${timer && !["unavailable", "unknown"].includes(timer)
        ? html`<span class="chip ${badgeClass(timerBadge(timerOn))} ${timerOn ? "blink" : ""}" style=${badgeStyle(timerBadge(timerOn))}><ha-icon icon="mdi:google-assistant"></ha-icon>${timer}</span>`
        : nothing}
      ${!isNaN(lights)
        ? html`<a class="chip ${badgeClass(lightsBadge(lights))}" style=${badgeStyle(lightsBadge(lights))} href=${`${this.prefix}/pieces`}>
            <ha-icon icon=${lights > 0 ? "mdi:lightbulb" : "mdi:lightbulb-off"}></ha-icon>${lights > 0 ? plural(lights, "allumée", "allumées") : "Tout éteint"}</a>`
        : nothing}
      ${!isNaN(windows)
        ? html`<button class="chip ${badgeClass(windowsBadge(windows))}" style=${badgeStyle(windowsBadge(windows))} @click=${() => openOpenings(this.openings())}>
            <ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"}></ha-icon>${windows > 0 ? plural(windows, "ouverte", "ouvertes") : "Fermé"}</button>`
        : nothing}
      ${alarm
        ? html`<button class="chip ${badgeClass(alarmBadge(alarm.state))}" style=${badgeStyle(alarmBadge(alarm.state))} @click=${() => openAlarm(alarm.entity_id)}>
            <ha-icon icon=${alarmLook(alarm.state).icon}></ha-icon>${alarmLook(alarm.state).label}</button>`
        : nothing}
    </div>`;
  }

  /** The weather frog: time, weather, and the family unless the house shows it. */
  private frog(withPeople: boolean) {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const frog = st(h.frog?.status)?.state ?? "";
    const pic = st(h.frog?.image)?.state ?? "";
    const place = st(h.frog?.location)?.state;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = Number(st(h.outdoorTemperature)?.state ?? weather?.attributes.temperature);
    const me = currentPerson(hass);
    const name = me?.endsWith("tablet") ? "" : String(st(me)?.attributes.friendly_name ?? "");
    const style = `--frog: ${FROG_SKY[frog] ?? "40, 130, 221"}; --scene: ${/^(https?:)?\//.test(pic) ? `url('${pic}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;
    return html`<section class="frog" style=${style} aria-label="Maintenant">
      <div>
        <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
        <div class="when">${upper(date.format(this.now))}<br />${greeting(this.now.getHours())}${name ? ` ${upper(name)}` : ""}</div>
      </div>
      <div class="side">
        ${weather
          ? html`<a class="now" href=${`${this.prefix}/meteo`}><img src=${still(weatherIcon(weather.state, this.night))} alt="" />${isNaN(temp) ? "" : `${formatNumber(temp)}°`}</a>
              <div class="cond">${stateLabel(hass, weather)}</div>`
          : nothing}
        ${withPeople ? this.avatars() : nothing}
      </div>
      ${this.chips()}
    </section>`;
  }

  /** a: the doll's house, one cell per room, lit and labelled with its temperature. */
  private house() {
    const hass = store.hass!;
    const rooms = this.model?.rooms ?? [];
    const cells = rooms.map((r) => {
      const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
      return { room: r, lit: r.lights.some((id) => isActive(hass.states[id])), label: isNaN(t) ? undefined : `${formatNumber(t)}°` };
    });
    const lit = cells.filter((c) => c.lit).length;
    const home = this.residents().filter((p) => hass.states[`person.${p}`]?.state === "home").length;
    return html`<section class="house ${this.night ? "night" : ""}" style="--sky: ${frogSky()}" aria-label="La maison">
      <a href=${`${this.prefix}/pieces`} style="position:absolute; inset:0; z-index:1" aria-label="Voir les pièces"></a>
      <div class="art">${houseScene(cells, this.night, frogSky())}</div>
      <div class="caption">
        <b>${lit ? plural(lit, "pièce allumée", "pièces allumées") : "Tout est éteint"}</b>
        <span>${home ? `${plural(home, "personne", "personnes")} à la maison` : "Personne à la maison"}</span>
      </div>
      <div class="lawn">${this.avatars()}</div>
    </section>`;
  }

  /* ---------------- Tiles ---------------- */

  private lights(scened = false) {
    const hass = store.hass!;
    const lights = config.home.lights.filter((l) => hass.states[l.entity]);
    const on = lights.filter((l) => isActive(hass.states[l.entity])).length;
    const rooms = this.model?.rooms ?? [];
    const fav = rooms.find((r) => r.id === "chambre_william") ?? rooms[0];
    return html`<section class="card" style="--fam: var(--rgb-amber)">
      ${scened && fav ? html`<div class="scened">${roomScene(fav, on > 0, this.night, frogSky(), true)}</div>` : nothing}
      ${head("mdi:lightbulb-group", "Lumières", { href: `${this.prefix}/pieces`, label: "Pièces" }, on ? html`<span class="aside">${on} sur ${lights.length}</span>` : nothing)}
      <kh-swipe label="Lumières">
        ${pagesOf(lights, 6).map((pg) => html`<div class="lights">${pg.map((l) => html`<kh3-light entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh3-light>`)}</div>`)}
      </kh-swipe>
    </section>`;
  }

  /** Climate as in V2: each room in its colour, temperature, humidity and their 24 h curves. */
  private climate(per: number) {
    const hass = store.hass!;
    const rooms = (this.model?.rooms ?? []).filter((r) => r.temperature);
    return html`<section class="card" style="--fam: var(--rgb-green)">
      ${head("mdi:home-thermometer", "Climat", { href: `${this.prefix}/meteo`, label: "Météo" })}
      ${rooms.length
        ? html`<kh-swipe label="Climat">
            ${pagesOf(rooms.map((r, i) => ({ r, i })), per).map(
              (pg) => html`<div class="climate">${pg.map(({ r, i }) => {
                const t = Number(hass.states[r.temperature!]?.state);
                const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
                const c = `var(--rgb-${ROOM_COLORS[i % ROOM_COLORS.length]})`;
                return html`<button class="room" style="--c: ${c}" @click=${() => openMoreInfo(this, r.temperature!)}>
                  <span class="ic"><ha-icon icon=${r.icon}></ha-icon></span>
                  <span class="n">${r.name}</span>
                  <span class="v num">${isNaN(t) ? "—" : `${formatNumber(t)}°`}${isNaN(hum) ? nothing : html`<small>${formatNumber(hum, 0)} %</small>`}</span>
                  <kh-sparkline compact height="34" .entities=${[
                    { entity: r.temperature!, label: "Température", color: c, unit: "°C" },
                    ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
                  ]}></kh-sparkline>
                </button>`;
              })}</div>`,
            )}
          </kh-swipe>`
        : html`<div class="muted">Aucun thermomètre ne répond.</div>`}
    </section>`;
  }

  /** Now playing and the latest on Jellyfin (two pages when something plays). */
  private media(scened = false) {
    const h = config.home;
    const playing = [h.spotify, ...h.tvs].find((id) => !!id && isPlayerActive(id));
    const player = playing
      ? html`<kh-media-card entity-id=${playing} kind=${playing === h.spotify ? "music" : "tv"} name=${playing === h.spotify ? "Spotify" : nothing}></kh-media-card>`
      : undefined;
    const jelly = h.jellyfin ? html`<kh-jellyfin></kh-jellyfin>` : undefined;
    if (!player && !jelly) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-${playing ? "purple" : "jellyfin"})">
      ${scened ? html`<div class="scened">${mediaScene(!!playing, this.night, frogSky())}</div>` : nothing}
      ${head(playing ? "mdi:play-circle" : "mdi:filmstrip-box-multiple", playing ? "En lecture" : "Ajouté sur Jellyfin", { href: `${this.prefix}/medias`, label: "Médias" })}
      ${player && jelly ? html`<kh-swipe label="Médias">${player}${jelly}</kh-swipe>` : (player ?? jelly)}
    </section>`;
  }

  private energy(scened = false) {
    const e = config.home.energy;
    if (!e) return nothing;
    const watts = Number(store.hass!.states[e.power]?.state);
    return html`<section class="card energy" style="--fam: var(--rgb-orange)">
      ${scened ? html`<div class="scened">${energyScene(watts, this.night, frogSky())}</div>` : nothing}
      ${head("mdi:lightning-bolt", "Énergie", { href: `${this.prefix}/energie`, label: "Détail" })}
      <kh-energy-card compact></kh-energy-card>
    </section>`;
  }

  /** Five days; today's icon is the animated one. */
  private days() {
    const days = forecastDays();
    if (!days.length) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-light-blue)">
      ${head("mdi:calendar-week", "Cinq jours", { href: `${this.prefix}/meteo`, label: "Météo" })}
      <div class="days" role="list">
        ${days.map((d, i) => {
          const icon = weatherIcon(d.condition, false, d.precipitation ?? 0);
          return html`<div class="day" role="listitem">
            <span class="d">${upper(d.day)}</span>
            <img src=${i === 0 ? icon : still(icon)} alt=${d.condition} />
            <span class="hi num">${formatNumber(d.temperature, 0)}°</span>
            <span class="lo num">${d.templow !== undefined ? `${formatNumber(d.templow, 0)}°` : ""}</span>
          </div>`;
        })}
      </div>
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
    const label = isUnavailable(s) ? "Indisponible" : busy ? (waiting ? (on ? "Arrêt…" : "Démarrage…") : "En cours…") : on ? "Allumé" : "Éteint";
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

  private stocks() {
    const hass = store.hass!;
    const h = config.home;
    const list = h.stocks.filter((s) => s.home && hass.states[s.entity]);
    const shown = list.length ? list : h.stocks.filter((s) => hass.states[s.entity]).slice(0, 3);
    if (!shown.length) return nothing;
    return html`<section class="card" style="--fam: var(--rgb-teal)">
      ${head("mdi:chart-line", "Bourse", { href: `${this.prefix}/meteo`, label: "Tout" })}
      <div class="ticks">
        ${shown.map((s) => {
          const ch = Number(hass.states[s.entity]?.attributes.regularMarketChangePercent);
          return html`<button class="tick" @click=${() => openMoreInfo(this, s.entity)}>
            <span class="ellipsis">${s.name}</span>
            <span class=${ch >= 0 ? "up" : "down"}>${isNaN(ch) ? "—" : `${ch >= 0 ? "+" : "−"}${formatNumber(Math.abs(ch), 1)} %`}</span>
          </button>`;
        })}
      </div>
    </section>`;
  }

  private favoriteList(): Favorite[] {
    const hass = store.hass!;
    const person = currentPerson(hass)?.replace("person.", "");
    return ((person && config.people[person]?.favorites) || config.people.tablet?.favorites || []).filter(
      (f) => f.type !== "jellyfin" && f.type !== "computers",
    );
  }

  private favorites(per: number) {
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
    return html`<section class="card" style="--fam: var(--rgb-yellow)">
      ${head("mdi:star", "Favoris")}
      <kh-swipe label="Favoris">${pagesOf(list, per).map((pg) => html`<div class="favs">${pg.map(one)}</div>`)}</kh-swipe>
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
              <ha-icon icon="mdi:hand-wave"></ha-icon><b>Partir</b><small>${leaving ? "En cours…" : "Tout éteindre"}</small></button>`
          : nothing}
        ${guest
          ? html`<button class="sc ${isActive(guest) ? "on" : ""}" style="--c: var(--rgb-amber)" aria-pressed=${String(isActive(guest))}
              @click=${() => toggle(h.guestMode!, "le mode invité")}>
              <ha-icon icon="mdi:account-group"></ha-icon><b>Mode invité</b><small>${isActive(guest) ? "Départs sans effet" : "Désactivé"}</small></button>`
          : nothing}
        ${h.wifiQr
          ? html`<button class="sc" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}><ha-icon icon="mdi:qrcode"></ha-icon><b>Wi-Fi</b><small>QR invités</small></button>`
          : nothing}
        <a class="sc" style="--c: var(--rgb-purple)" href=${`${p}/medias`}><ha-icon icon="mdi:remote-tv"></ha-icon><b>Télécommande</b><small>Box TV</small></a>
        <a class="sc" style="--c: var(--rgb-light-blue)" href=${`${p}/meteo`}><ha-icon icon="mdi:radar"></ha-icon><b>Radar</b><small>Pluie, Windy</small></a>
        <a class="sc" style="--c: var(--rgb-indigo)" href=${`${p}/systeme`}><ha-icon icon="mdi:cog"></ha-icon><b>Système</b><small>Réseau, HA</small></a>
      </div>
    </section>`;
  }

  /** c: the flat's plan (2D or 3D), lights and devices live on it. */
  private plan() {
    return html`<section class="card plan" style="--fam: var(--rgb-amber)">
      <kh-floorplan .rooms=${this.model?.rooms ?? []} prefix=${this.prefix}></kh-floorplan>
    </section>`;
  }

  /* ---------------- The three examples ---------------- */

  private cols(cols: unknown[][], template?: string) {
    return html`<div class="cols" style=${template ? `grid-template-columns: ${template}` : `--n: ${cols.length}`}>
      ${cols.map((c) => html`<div class="col">${c}</div>`)}
    </div>`;
  }

  private exampleA() {
    const stage = html`<div class="stage">${this.frog(false)}${this.house()}</div>`;
    if (this.phone)
      return html`${stage}${this.cols([[this.favorites(3), this.lights(), this.media(), this.climate(3), this.energy(), this.days(), this.computers(), this.stocks(), this.shortcuts()]])}`;
    return html`${stage}${this.cols([
      [this.lights(), this.favorites(1)],
      [this.media(), this.stocks(), this.computers()],
      [this.energy(), this.climate(2)],
      [this.days(), this.shortcuts()],
    ])}`;
  }

  private exampleB() {
    const banner = this.frog(true);
    if (this.phone)
      return html`${banner}${this.cols([[this.favorites(3), this.lights(true), this.media(true), this.energy(true), this.climate(3), this.days(), this.computers(), this.stocks(), this.shortcuts()]])}`;
    return html`${banner}${this.cols([
      [this.lights(true), this.favorites(1)],
      [this.media(true), this.computers()],
      [this.energy(true), this.shortcuts()],
      [this.climate(2), this.days(), this.stocks()],
    ])}`;
  }

  /** c: the plan carries the lights, TVs and PCs (same gestures as their tiles), so it replaces the Ordinateurs tile. */
  private exampleC() {
    const banner = this.frog(true);
    if (this.phone)
      return html`${banner}${this.cols([[this.plan(), this.favorites(3), this.lights(), this.media(), this.energy(), this.climate(3), this.days(), this.computers(), this.stocks(), this.shortcuts()]])}`;
    return html`<div class="slim">${banner}</div>${this.cols(
      [
        [this.plan(), this.cols([[this.climate(1)], [this.days()], [this.favorites(1)]])],
        [this.lights(), this.shortcuts()],
        [this.media(), this.energy(), this.stocks()],
      ],
      "minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1fr)",
    )}`;
  }

  render() {
    if (!store.hass) return nothing;
    const body = this.example === "b" ? this.exampleB() : this.example === "c" ? this.exampleC() : this.exampleA();
    return html`${body}
      <div class="picker" role="group" aria-label="Exemples d'accueil">
        ${EXAMPLES.map(
          (e) => html`<button aria-pressed=${String(this.example === e.key)} @click=${() => this.pick(e.key)}>
            ${e.key.toUpperCase()}<span class="long"> ${e.label}</span>
          </button>`,
        )}
      </div>`;
  }
}
customElements.define("kh3-home", Kh3Home);
