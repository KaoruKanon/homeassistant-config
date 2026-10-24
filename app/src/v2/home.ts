import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, runScript } from "../actions.ts";
import "../components/energy-card.ts";
import "../components/light-pill.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Favorite } from "../config.ts";
import { formatNumber, isActive, stateLabel } from "../format.ts";
import { alarmLook, openAlarm, openOpenings, openPerson, openWifiQr } from "../popups/open.ts";
import { currentPerson, type HouseModel } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { alarmBadge, badgeClass, badgeStyle, badgeStyles, lightsBadge, temperatureBadge, timerBadge, windowsBadge } from "../badges.ts";
import { base } from "../styles.ts";
import { FROG_SKY, forecastDays } from "../weather-utils.ts";
import { head, pagesOf, ring, v2 } from "./styles.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Wall tablet: tiles by importance, and their expected heights before measuring. */
const WALL_ORDER = ["media", "jellyfin", "lights", "energy", "climate", "days", "favorites", "computers", "stocks", "shortcuts"];
const WALL_ESTIMATE: Record<string, number> = {
  media: 240, jellyfin: 220, lights: 210, energy: 380, climate: 200, days: 170, favorites: 250, computers: 130, stocks: 100, shortcuts: 200,
};

/** One colour per thermometer in the Climat tile. */
const CLIMATE_COLORS = ["orange", "green", "purple", "teal", "amber", "indigo", "red", "blue"];

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

/**
 * V2 home: the weather frog scene as the hero, then a bento grid where tile
 * size follows importance, each family of tiles tinted with its colour.
 */
export class KhHomeV2 extends LitElement {
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true }, wall: { attribute: false } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  /** Wall layout, decided by the shell (landscape tablet or tablet-shaped window). */
  declare wall: boolean;
  private timer?: number;

  constructor() {
    super();
    this.now = new Date();
    this.wall = false;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        h.spotify, ...h.tvs, h.frog?.status, h.frog?.image, h.frog?.location, h.outdoorTemperature, h.nextRain,
        ...Object.values(h.chips), ...config.weather, h.energy?.today, h.energy?.power,
        ...Object.keys(config.people).map((p) => `person.${p}`),
        ...this.batteries().map((b) => b.entity), ...this.rooms().flatMap((r) => [r.temperature, r.humidity]),
      ].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    v2,
    badgeStyles,
    css`
      /* On the picture, the Lovelace tints are deepened to stay visible. */
      .scene .chip.b-tint {
        background: rgba(var(--b-bg), calc(var(--b-a) + 0.3));
      }
      /* Hero: the weather scene of the house, time and people on it. */
      .scene {
        position: relative;
        overflow: hidden;
        min-height: 150px;
        border-radius: 28px;
        padding: 16px 22px;
        display: grid;
        grid-template-columns: 1fr auto;
        align-content: space-between;
        color: #fff;
        background-color: rgb(var(--frog));
        /* The frog picture fills the whole banner (cropped on the sides, kept
           on the frog); a light veil of its sky colour on the top left keeps
           the time readable without cutting the picture in two. */
        background-image: linear-gradient(100deg, rgba(var(--frog), 0.7) 0%, rgba(var(--frog), 0.25) 38%, rgba(var(--frog), 0) 60%), var(--scene);
        background-size: 100% 100%, cover;
        background-position: top, var(--shift) 75%;
        background-repeat: no-repeat;
        text-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
        animation: kh-rise 420ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .scene time {
        display: block;
        font-size: clamp(2.4rem, 5vw, 3.4rem);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .scene .date {
        font-weight: 600;
        opacity: 0.9;
        text-transform: capitalize;
      }
      .scene .hello {
        font-size: 1rem;
        font-weight: 700;
        margin-top: 2px;
      }
      .scene .side {
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 10px;
      }
      .scene .now {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 800;
        font-size: 1.3rem;
      }
      .scene .now img {
        width: 42px;
        height: 42px;
      }
      /* A still frame of the icon, floating: animated SVG icons repaint the
         whole frog picture on every frame, a transform costs nothing. */
      .float {
        animation: kh-float 4s ease-in-out infinite alternate;
        will-change: transform;
      }
      @keyframes kh-float {
        from {
          transform: translateY(2px);
        }
        to {
          transform: translateY(-3px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .float {
          animation: none;
        }
      }
      .scene .cond {
        font-weight: 600;
        opacity: 0.9;
      }
      .chips {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 34px;
        padding: 0 12px;
        border-radius: 17px;
        background: rgb(0 0 0 / 0.34);
        color: #fff;
        font-weight: 700;
        font-size: 0.875rem;
        text-decoration: none;
      }
      .chip ha-icon {
        --mdc-icon-size: 18px;
      }
      .chip.alert {
        background: rgba(var(--rgb-red), 0.75);
      }
      .chip.blink {
        animation: kh-blink 1.2s ease-in-out infinite;
      }
      .people {
        display: flex;
        gap: 10px;
      }
      .person {
        position: relative;
        width: 46px;
        height: 46px;
        display: grid;
        place-items: center;
      }
      .person img,
      .person .initial {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        background: rgb(0 0 0 / 0.3);
        display: grid;
        place-items: center;
        font-weight: 800;
      }
      .person.away img {
        filter: grayscale(0.85) brightness(0.8);
      }
      .person .dot {
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid #fff;
        background: rgb(var(--rgb-green));
      }
      .person.away .dot {
        background: rgb(var(--rgb-red));
      }

      /* Climat: two columns of rooms, each with its colour and its 24 h
         graph running to the edges of its cell. */
      .climate {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        /* A last page with one room keeps the size of the others. */
        grid-auto-rows: max-content;
        align-content: start;
        gap: 8px;
      }
      .climate .room {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas: "shape name" "shape value" "graph graph";
        align-items: center;
        align-content: start;
        gap: 0 10px;
        padding: 10px 12px 0;
        border-radius: 16px;
        overflow: hidden;
        text-align: left;
        background: linear-gradient(160deg, rgba(var(--c), 0.14), rgba(var(--c), 0.02) 70%), var(--kh-card-2);
      }
      .climate .shape {
        grid-area: shape;
        width: 38px;
        height: 38px;
      }
      .climate .primary {
        grid-area: name;
      }
      .climate .v {
        grid-area: value;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .climate kh-sparkline {
        grid-area: graph;
        margin: 6px -12px 0;
      }
      /* Wall tablet: three columns, tiles at their natural height. */
      .wall {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        align-items: start;
      }
      .wslot {
        display: grid;
      }
      /* Wall tablet: a slim banner, the room goes to the tiles. */
      :host([wall]) .scene {
        min-height: 0;
        padding: 10px 18px;
        border-radius: 22px;
      }
      :host([wall]) .scene time {
        font-size: 2rem;
      }
      :host([wall]) .scene .date,
      :host([wall]) .scene .hello {
        font-size: 0.875rem;
        margin-top: 0;
      }
      :host([wall]) .scene .side {
        gap: 4px;
      }
      :host([wall]) .scene .now {
        font-size: 1.1rem;
      }
      :host([wall]) .scene .now img {
        width: 34px;
        height: 34px;
      }
      :host([wall]) .scene .person {
        width: 40px;
        height: 40px;
      }
      :host([wall]) .scene .person img,
      :host([wall]) .scene .person .initial {
        width: 32px;
        height: 32px;
      }
      :host([wall]) .scene .chips {
        margin-top: 6px;
      }
      :host([wall]) .scene .chip {
        height: 30px;
        font-size: 0.8125rem;
      }
      .wall kh-energy-card {
        --kh-kpi-min: 84px;
      }
      .wcol {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .wall .tile {
        gap: 10px;
        padding: 12px 14px;
      }
      .wall .pills {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .wall .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .wall .shortcuts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .wall .shortcuts .action {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
        row-gap: 0;
        padding: 10px 12px;
      }
      .wall .shortcuts .action ha-icon {
        grid-row: span 2;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .kpi {
        display: grid;
        gap: 2px;
        padding: 10px 12px;
        border-radius: 16px;
        background: var(--kh-card-2);
        text-align: left;
      }
      .kpi b {
        font-size: 1.6rem;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .kpi small {
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .days {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 4px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .days img {
        width: 40px;
        height: 40px;
      }
      .days .d {
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 8px 0;
        border-radius: 14px;
      }
      .days .d:first-child {
        background: var(--kh-card-2);
      }
      .shortcuts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
        gap: 10px;
      }
      .favs {
        display: grid;
        gap: 10px;
      }
      @media (max-height: 820px) and (min-width: 600px) {
        .scene {
          min-height: 150px;
          padding: 14px 20px;
        }
        .scene time {
          font-size: 2.6rem;
        }
      }
      @container v2 (max-width: 679px) {
        .scene {
          min-height: 168px;
          padding: 16px 18px;
        }
        .scene .side {
          gap: 6px;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const tick = () => {
      this.now = new Date();
      this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    this.timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.slotSizes.disconnect();
    window.clearTimeout(this.timer);
  }

  private batteries() {
    return Object.entries(config.people)
      .filter(([, p]) => !p.device)
      .map(([key, p]) => ({ key, ...(p.favorites?.find((f) => f.type === "battery") as Extract<Favorite, { type: "battery" }> | undefined) }))
      .filter((b) => !!b.entity) as { key: string; entity: string; charging?: string }[];
  }

  private rooms() {
    return (this.model?.rooms ?? []).filter((r) => r.temperature);
  }

  private hero() {
    const hass = store.hass!;
    const h = config.home;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const frog = st(h.frog?.status)?.state ?? "";
    const scene = st(h.frog?.image)?.state ?? "";
    const place = st(h.frog?.location)?.state;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = Number(st(h.outdoorTemperature)?.state ?? weather?.attributes.temperature);
    const night = st("sun.sun")?.state === "below_horizon";
    const me = currentPerson(hass);
    const name = me?.endsWith("tablet") ? "" : String(st(me)?.attributes.friendly_name ?? "");
    const rain = st(h.nextRain)?.state;
    const rainAt = rain && Date.parse(rain) > Date.now() ? time.format(new Date(rain)) : "";
    const lights = Number(st(h.chips.lightsOn)?.state);
    const windows = Number(st(h.chips.windowsOpen)?.state);
    const timer = st(h.chips.timer)?.state;
    const indoor = Number(st(h.chips.temperature)?.state);
    const alarm = st(h.chips.alarm);
    const timerOn = st(h.chips.timerActive)?.state === "active" || isActive(st(h.chips.timerActive));
    const bat = new Map(this.batteries().map((b) => [b.key, b]));
    const style = `--frog: ${FROG_SKY[frog] ?? "40, 130, 221"}; --scene: ${scene.startsWith("http") ? `url('${scene}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;

    return html`<section class="scene" style=${style}>
      <div>
        <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
        <div class="date">${date.format(this.now)}</div>
        <div class="hello">${greeting(this.now.getHours())}${name ? ` ${name.replace(/^./, (c) => c.toUpperCase())}` : ""}</div>
      </div>
      <div class="side">
        ${weather
          ? html`<a class="now" href=${`${this.prefix}/meteo`} style="color:inherit; text-decoration:none">
              <img class="float" src=${still(weatherIcon(weather.state, night))} alt="" />${isNaN(temp) ? "" : `${formatNumber(temp)}°`}
            </a>
            <div class="cond">${stateLabel(hass, weather)}</div>`
          : nothing}
        <div class="people">
          ${Object.keys(config.people)
            .filter((p) => !config.people[p].device)
            .map((p) => {
              const s = st(`person.${p}`);
              if (!s) return nothing;
              const home = s.state === "home";
              const b = bat.get(p);
              const level = b ? Number(st(b.entity)?.state) / 100 : NaN;
              return html`<button class="person ${home ? "" : "away"}" aria-label="${s.attributes.friendly_name} : ${home ? "à la maison" : "absent"}"
                @click=${() => openPerson(p)}>
                ${!isNaN(level) ? ring(level, this.wall ? 40 : 46, 3.5, level > 0.2 ? "#ffffff" : "rgb(244, 67, 54)") : nothing}
                ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
                <span class="dot"></span>
              </button>`;
            })}
        </div>
      </div>
      <div class="chips">
        ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
        ${!isNaN(indoor)
          ? html`<span class="chip ${badgeClass(temperatureBadge(indoor))}" style=${badgeStyle(temperatureBadge(indoor))}><ha-icon icon="mdi:home"></ha-icon>${formatNumber(indoor)}°</span>`
          : nothing}
        ${timer && !["unavailable", "unknown"].includes(timer)
          ? html`<span class="chip ${badgeClass(timerBadge(timerOn))}" style=${badgeStyle(timerBadge(timerOn))} aria-label="Minuteur de la cuisine : ${timer}">
              <ha-icon icon="mdi:google-assistant"></ha-icon>${timer}</span>`
          : nothing}
        ${!isNaN(lights)
          ? html`<a class="chip ${badgeClass(lightsBadge(lights))}" style=${badgeStyle(lightsBadge(lights))} href=${`${this.prefix}/pieces`}>
              <ha-icon icon=${lights > 0 ? "mdi:lightbulb" : "mdi:lightbulb-off"}></ha-icon>${lights} allumée${lights > 1 ? "s" : ""}</a>`
          : nothing}
        ${!isNaN(windows)
          ? html`<button class="chip ${badgeClass(windowsBadge(windows))}" style=${badgeStyle(windowsBadge(windows))} @click=${() => openOpenings(this.openings())}>
              <ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"}></ha-icon>${windows > 0 ? `${windows} ouverte${windows > 1 ? "s" : ""}` : "Fermé"}</button>`
          : nothing}
        ${alarm
          ? html`<button class="chip ${badgeClass(alarmBadge(alarm.state))}" style=${badgeStyle(alarmBadge(alarm.state))} @click=${() => openAlarm(alarm.entity_id)}>
              <ha-icon icon=${alarmLook(alarm.state).icon}></ha-icon>${alarmLook(alarm.state).label}</button>`
          : nothing}
      </div>
    </section>`;
  }

  private openings(): string[] {
    return Object.values(store.hass?.states ?? {})
      .filter((s) => s.entity_id.startsWith("binary_sensor.") && ["window", "door", "opening"].includes(s.attributes.device_class))
      .map((s) => s.entity_id);
  }

  /** Measured height of each wall tile (estimates until the first render). */
  private heights = new Map<string, number>();

  /**
   * Balance: the tallest tiles are placed first, each into the shortest of
   * three columns; inside a column the tiles keep their order of importance.
   */
  private columns(keys: string[]): string[][] {
    const size = (k: string) => (this.heights.get(k) ?? WALL_ESTIMATE[k] ?? 200) + 12;
    const cols: string[][] = [[], [], []];
    const h = [0, 0, 0];
    for (const k of [...keys].sort((a, b) => size(b) - size(a))) {
      const i = h.indexOf(Math.min(...h));
      cols[i].push(k);
      h[i] += size(k);
    }
    return cols.map((c) => c.sort((a, b) => keys.indexOf(a) - keys.indexOf(b)));
  }

  /** Tiles load their content later (Jellyfin, the energy graph): follow their size. */
  /** The arrangement in use: kept until the tiles change or a new one is clearly better. */
  private layout?: { keys: string; cols: string[][] };

  /** Height of the tallest column of an arrangement. */
  private tallest(cols: string[][]): number {
    return Math.max(...cols.map((c) => c.reduce((sum, k) => sum + (this.heights.get(k) ?? WALL_ESTIMATE[k] ?? 200) + 12, 0)));
  }

  /**
   * The wall's columns. A tile that changes column is rebuilt and briefly
   * changes height, which used to trigger a new arrangement, then the old
   * one again (the screen flickered). Now an arrangement is replaced only
   * when the tiles change or the new one is at least 60 px shorter, which
   * can only happen a few times, then stays.
   */
  private wallColumns(keys: string[]): string[][] {
    const id = keys.join(",");
    const fresh = this.columns(keys);
    if (!this.layout || this.layout.keys !== id || this.tallest(fresh) < this.tallest(this.layout.cols) - 60) this.layout = { keys: id, cols: fresh };
    return this.layout.cols;
  }

  private slotSizes = new ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      const k = (e.target as HTMLElement).dataset.k!, hNow = Math.round(e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight);
      const before = this.heights.get(k);
      if (before === undefined || Math.abs(before - hNow) > 8) {
        this.heights.set(k, hNow);
        changed = true;
      }
    }
    if (changed && this.layout && this.tallest(this.columns(this.layout.keys.split(","))) < this.tallest(this.layout.cols) - 60) this.requestUpdate();
  });

  protected updated(): void {
    this.toggleAttribute("wall", this.wall);
    this.slotSizes.disconnect();
    if (this.wall) this.renderRoot.querySelectorAll<HTMLElement>(".wslot").forEach((el) => this.slotSizes.observe(el));
  }

  /** Today's consumption and the power drawn now, nothing more. */
  private energy() {
    const hass = store.hass!;
    const e = config.home.energy!;
    const kwh = Number(hass.states[e.today]?.state);
    const watts = Number(hass.states[e.power]?.state);
    return html`<div class="kpis">
      <button class="kpi" @click=${() => openMoreInfo(this, e.today)}>
        <span class="secondary">Aujourd'hui</span>
        <b>${isNaN(kwh) ? "—" : formatNumber(kwh, 1)}<small> kWh</small></b>
        <span class="secondary">${isNaN(kwh) ? "" : `${formatNumber(kwh * e.pricePerKwh, 2)} €`}</span>
      </button>
      <button class="kpi" @click=${() => openMoreInfo(this, e.power)}>
        <span class="secondary">En ce moment</span>
        <b>${isNaN(watts) ? "—" : formatNumber(watts, 0)}<small> W</small></b>
      </button>
    </div>`;
  }

  private favorite(f: Favorite) {
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
    return nothing; // Jellyfin and the computers have their own tiles
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const p = this.prefix;
    const lights = h.lights.filter((l) => hass.states[l.entity]);
    const playing = [h.spotify, ...h.tvs].find((id) => !!id && isPlayerActive(id));
    const person = currentPerson(hass)?.replace("person.", "");
    const favorites = ((person && config.people[person]?.favorites) || config.people.tablet?.favorites || []).filter(
      (f) => f.type !== "jellyfin" && f.type !== "computers",
    );
    const days = forecastDays();
    const stocks = h.stocks.filter((s) => s.home && hass.states[s.entity]);

    const T = {
      lights: html`<section class="tile" style="--tint: var(--rgb-amber); --w: 7; --w6: 6; --w2: 2; --wt: 4">
          ${head("mdi:lightbulb-group", "Lumières", { href: `${p}/pieces`, label: "Pièces" })}
          <kh-swipe label="Lumières">
            ${pagesOf(lights, 6).map(
              (pg) => html`<div class="pills">${pg.map((l) => html`<kh-light-pill entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh-light-pill>`)}</div>`,
            )}
          </kh-swipe>
        </section>`,
      media: this.wall && !playing ? nothing : html`<section class="tile" style="--tint: var(--rgb-purple); --w: 5; --w6: 6; --w2: 2; --wt: 4">
          ${playing
            ? html`${head("mdi:play-circle", "En lecture", { href: `${p}/medias`, label: "Médias" })}
                <kh-media-card entity-id=${playing} kind=${playing === h.spotify ? "music" : "tv"} name=${playing === h.spotify ? "Spotify" : nothing}></kh-media-card>`
            : html`${head("mdi:filmstrip-box-multiple", "Ajouté sur Jellyfin", { href: `${p}/medias`, label: "Médias" })}<kh-jellyfin></kh-jellyfin>`}
        </section>`,
      jellyfin: this.wall && h.jellyfin ? html`<section class="tile" style="--tint: var(--rgb-jellyfin)">${head("mdi:filmstrip-box-multiple", "Ajouté sur Jellyfin", { href: `${this.prefix}/medias`, label: "Médias" })}<kh-jellyfin></kh-jellyfin></section>` : nothing,
      climate: html`<section class="tile" style="--tint: var(--rgb-green); --w: 6; --w6: 6; --w2: 2; --wt: 4">
          ${head("mdi:home-thermometer", "Climat", { href: `${p}/meteo`, label: "Météo" })}
          ${this.rooms().length
            ? html`<kh-swipe label="Climat">
              ${pagesOf(this.rooms().map((r, i) => ({ r, i })), this.wall ? 2 : 4).map(
                (pg) => html`<div class="climate">${pg.map(({ r, i }) => {
                  const t = Number(hass.states[r.temperature!]?.state);
                  const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
                  const c = CLIMATE_COLORS[i % CLIMATE_COLORS.length];
                  return html`<button class="room" style="--c: var(--rgb-${c})" @click=${() => openMoreInfo(this, r.temperature!)}>
                    <span class="shape" style="--rgb: var(--rgb-${c})"><ha-icon icon=${r.icon}></ha-icon></span>
                    <span class="primary ellipsis">${r.name}</span>
                    <span class="v">${isNaN(t) ? "—" : `${formatNumber(t)}°`}<span class="secondary">${isNaN(hum) ? "" : ` ${formatNumber(hum, 0)} %`}</span></span>
                    <kh-sparkline compact height="44" .entities=${[
                      { entity: r.temperature!, label: "Température", color: `var(--rgb-${c})`, unit: "°C" },
                      ...(r.humidity ? [{ entity: r.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
                    ]}></kh-sparkline>
                  </button>`;
                })}</div>`,
              )}
            </kh-swipe>`
            : html`<div class="secondary">Aucun thermomètre joignable</div>`}
        </section>`,
      energy: h.energy
          ? html`<section class="tile" style="--tint: var(--rgb-orange); --w: 3; --w6: 3; --w2: 2; --wt: 2">
              ${head("mdi:lightning-bolt", "Énergie", { href: `${p}/energie`, label: "Détail" })}
              ${this.wall ? html`<kh-energy-card compact></kh-energy-card>` : this.energy()}
            </section>`
          : nothing,
      favorites: favorites.length
          ? html`<section class="tile first-on-phone" style="--tint: var(--rgb-yellow); --w: 6; --w6: 6; --w2: 2; --wt: 3">
              ${head("mdi:star", "Favoris")}
              <kh-swipe label="Favoris">
                ${pagesOf(favorites, this.wall ? 1 : 2).map((pg) => html`<div class="favs">${pg.map((f) => this.favorite(f))}</div>`)}
              </kh-swipe>
            </section>`
          : nothing,
      days: days.length
          ? html`<section class="tile" style="--tint: var(--rgb-light-blue); --w: 6; --w6: 3; --w2: 2; --wt: ${favorites.length ? 3 : 6}">
              ${head("mdi:calendar-week", "Cinq jours", { href: `${p}/meteo`, label: "Météo" })}
              <div class="days" role="list">
                ${days.map(
                  (d) => html`<div class="d" role="listitem">
                    <span class="secondary" style="text-transform: capitalize">${d.day}</span>
                    <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt=${d.condition} />
                    <b>${formatNumber(d.temperature, 0)}°</b>
                    <span class="secondary">${d.templow !== undefined ? `${formatNumber(d.templow, 0)}°` : ""}</span>
                  </div>`,
                )}
              </div>
            </section>`
          : nothing,
      computers: html`<section class="tile" style="--tint: var(--rgb-blue); --w: 4; --w6: 3; --w2: 2; --wt: 2">
            ${head("mdi:desktop-tower-monitor", "Ordinateurs", { href: `${p}/energie`, label: "Énergie" })}
            <div class="row2">
              ${h.computers.map((c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`)}
            </div>
          </section>`,
      stocks: html`<section class="tile" style="--tint: var(--rgb-teal); --w: 4; --w6: 3; --w2: 2; --wt: 2">
            ${head("mdi:chart-line", "Bourse", { href: `${p}/meteo`, label: "Tout" })}
            <div class="list">
              ${(stocks.length ? stocks : h.stocks.slice(0, 3)).map((s) => {
                const st = hass.states[s.entity];
                const ch = Number(st?.attributes.regularMarketChangePercent);
                return st
                  ? html`<button class="item" style="grid-template-columns: minmax(0, 1fr) auto" @click=${() => openMoreInfo(this, s.entity)}>
                      <span class="primary ellipsis">${s.name}</span>
                      <span class="v" style="color: rgb(var(--rgb-${ch >= 0 ? "green" : "red"}))">${isNaN(ch) ? "" : `${ch >= 0 ? "+" : ""}${formatNumber(ch, 1)} %`}</span>
                    </button>`
                  : nothing;
              })}
            </div>
          </section>`,
      shortcuts: html`<section class="tile shortcuts-tile" style="--tint: var(--rgb-indigo); --w: 12; --w6: 6; --w2: 2">
          ${head("mdi:gesture-tap-button", "Raccourcis")}
          <div class="shortcuts">
            ${h.leave
              ? html`<button class="action" style="--c: var(--rgb-indigo)" @click=${() => runScript(h.leave!)}>
                  <ha-icon icon="mdi:hand-wave"></ha-icon>Partir<span class="secondary">${isActive(hass.states[h.leave]) ? "En cours…" : "Tout éteindre"}</span></button>`
              : nothing}
            ${h.wifiQr
              ? html`<button class="action" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}>
                  <ha-icon icon="mdi:qrcode"></ha-icon>Wi-Fi<span class="secondary">QR invités</span></button>`
              : nothing}
            <a class="action" style="--c: var(--rgb-purple)" href=${`${p}/medias`}><ha-icon icon="mdi:remote-tv"></ha-icon>Télécommande<span class="secondary">Box TV</span></a>
            <a class="action" style="--c: var(--rgb-light-blue)" href=${`${p}/meteo`}><ha-icon icon="mdi:radar"></ha-icon>Radar<span class="secondary">Pluie, Windy</span></a>
            <a class="action" style="--c: var(--rgb-indigo)" href=${`${p}/systeme`}><ha-icon icon="mdi:cog"></ha-icon>Système<span class="secondary">Réseau, HA</span></a>
          </div>
        </section>`,
    };

    // Wall tablet: three columns balanced by the height of each tile (each
    // goes to the shortest column, in order of importance), so the whole
    // home fits the screen without stretching anything.
    if (this.wall) {
      const tiles = T as Record<string, unknown>;
      const keys = WALL_ORDER.filter((k) => tiles[k] !== nothing && tiles[k] !== undefined);
      return html`
        ${this.hero()}
        <div class="wall">
          ${this.wallColumns(keys).map(
            (col) => html`<div class="wcol">${col.map((k) => html`<div class="wslot" data-k=${k}>${tiles[k]}</div>`)}</div>`,
          )}
        </div>
      `;
    }

    return html`
      ${this.hero()}
      <div class="bento">
        ${T.lights}${T.media}${T.climate}${T.energy}${T.favorites}${T.days}
        <div class="col" style="--w: 3; --w6: 6; --w2: 2">${T.computers}${T.stocks}</div>
        ${T.shortcuts}
      </div>
    `;
  }
}
customElements.define("kh-home-v2", KhHomeV2);
