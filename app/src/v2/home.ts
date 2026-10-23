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
import { alarmLook, openAlarm, openOpenings, openPerson, openWifiQr } from "../popups/index.ts";
import { currentPerson, entityName, type HouseModel } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { FROG_SKY, forecastDays } from "../weather-utils.ts";
import { head, pagesOf, ring, v2 } from "./styles.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

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
  static properties = { prefix: {}, model: { attribute: false }, now: { state: true } };
  declare prefix: string;
  declare model?: HouseModel;
  declare now: Date;
  private timer?: number;

  constructor() {
    super();
    this.now = new Date();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        h.spotify, ...h.tvs, h.frog?.status, h.frog?.image, h.frog?.location, h.outdoorTemperature, h.nextRain,
        ...Object.values(h.chips), ...config.weather, h.energy?.today, h.energy?.power,
        ...Object.keys(config.people).map((p) => `person.${p}`),
        ...this.batteries().map((b) => b.entity), ...this.rooms().flatMap((r) => [r.temperature, r.humidity]),
        ...Object.values(this.model?.power ?? {}),
      ].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    v2,
    css`
      /* Hero: the weather scene of the house, time and people on it. */
      .scene {
        position: relative;
        overflow: hidden;
        min-height: 176px;
        border-radius: 28px;
        padding: 18px 22px;
        display: grid;
        grid-template-columns: 1fr auto;
        align-content: space-between;
        color: #fff;
        background-color: rgb(var(--frog));
        background-image: linear-gradient(180deg, rgb(var(--frog)) 0%, rgba(var(--frog), 0) 55%), var(--scene);
        background-size: 100% 100%, max(100%, 640px) auto;
        background-position: top, var(--shift) bottom;
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
      .energy-big {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .energy-facts .watts {
        font-size: 1.75rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .energy-facts .watts small {
        font-size: 0.9rem;
        font-weight: 700;
        opacity: 0.8;
      }
      .energy-facts .primary {
        margin-top: 6px;
      }
      .consumers {
        display: grid;
        gap: 8px;
      }
      .consumer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 8px;
        font-size: 0.875rem;
        font-weight: 600;
      }
      .consumer b {
        font-variant-numeric: tabular-nums;
      }
      .consumer .bar {
        grid-column: 1 / -1;
        height: 6px;
        border-radius: 3px;
        background: var(--kh-card-2);
        overflow: hidden;
      }
      .consumer .bar span {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: rgb(var(--rgb-orange));
        transition: width 600ms ease;
      }
      /* The day's power curve along the bottom of the tile, edge to edge. */
      kh-sparkline.power {
        margin: 0 -16px -16px;
      }
      .gauge {
        position: relative;
        width: 96px;
        height: 96px;
        display: grid;
        place-items: center;
        flex: none;
      }
      .gauge b {
        font-size: 1.375rem;
        font-variant-numeric: tabular-nums;
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
                ${!isNaN(level) ? ring(level, 46, 3.5, level > 0.2 ? "#ffffff" : "rgb(244, 67, 54)") : nothing}
                ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
                <span class="dot"></span>
              </button>`;
            })}
        </div>
      </div>
      <div class="chips">
        ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
        ${!isNaN(lights) ? html`<a class="chip" href=${`${this.prefix}/pieces`}><ha-icon icon="mdi:lightbulb-on"></ha-icon>${lights} allumée${lights > 1 ? "s" : ""}</a>` : nothing}
        ${!isNaN(indoor) ? html`<span class="chip"><ha-icon icon="mdi:home-thermometer"></ha-icon>${formatNumber(indoor)}° dedans</span>` : nothing}
        ${!isNaN(windows)
          ? html`<button class="chip ${windows > 0 ? "alert" : ""}" @click=${() => openOpenings(this.openings())}>
              <ha-icon icon=${windows > 0 ? "mdi:window-open-variant" : "mdi:window-closed-variant"}></ha-icon>${windows > 0 ? `${windows} ouverte${windows > 1 ? "s" : ""}` : "Fermé"}</button>`
          : nothing}
        ${alarm
          ? html`<button class="chip ${alarmLook(alarm.state).alert ? "alert blink" : ""}" @click=${() => openAlarm(alarm.entity_id)}>
              <ha-icon icon=${alarmLook(alarm.state).icon}></ha-icon>${alarmLook(alarm.state).label}</button>`
          : nothing}
        ${timer && timer !== "Pas de timer" ? html`<span class="chip"><ha-icon icon="mdi:timer-outline"></ha-icon>${timer}</span>` : nothing}
      </div>
    </section>`;
  }

  private openings(): string[] {
    return Object.values(store.hass?.states ?? {})
      .filter((s) => s.entity_id.startsWith("binary_sensor.") && ["window", "door", "opening"].includes(s.attributes.device_class))
      .map((s) => s.entity_id);
  }

  private energy() {
    const hass = store.hass!;
    const e = config.home.energy;
    if (!e) return nothing;
    const today = hass.states[e.today];
    const kwh = Number(today?.state);
    const last = Number(today?.attributes.last_period);
    const f = !isNaN(kwh) && last > 0 ? kwh / last : 0;
    const watts = Number(hass.states[e.power]?.state);
    // What draws the most right now: the plugs with a power sensor.
    const top = Object.entries(this.model?.power ?? {})
      .map(([sw, sensor]) => ({ name: entityName(hass, sw, config), w: Number(hass.states[sensor]?.state) }))
      .filter((x) => x.w > 1)
      .sort((a, b) => b.w - a.w)
      .slice(0, 3);
    const max = Math.max(1, watts || 0, ...top.map((x) => x.w));
    return html`<div class="energy-big">
        <div class="gauge">
          ${ring(f, 96, 9, "rgb(var(--rgb-orange))")}
          <div style="text-align:center"><b>${isNaN(kwh) ? "—" : formatNumber(kwh, 1)}</b><div class="secondary">kWh</div></div>
        </div>
        <div class="energy-facts">
          <div class="watts">${isNaN(watts) ? "—" : formatNumber(watts, 0)}<small> W</small></div>
          <div class="secondary">en ce moment</div>
          <div class="primary">${isNaN(kwh) ? "" : `${formatNumber(kwh * e.pricePerKwh, 2)} € aujourd'hui`}</div>
          <div class="secondary">${last > 0 ? `Hier ${formatNumber(last, 1)} kWh, ${formatNumber(last * e.pricePerKwh, 2)} €` : ""}${last > 0 && !isNaN(kwh) ? html`<br />${formatNumber(f * 100, 0)} % de la journée d'hier` : ""}</div>
        </div>
      </div>
      ${top.length
        ? html`<div class="consumers" aria-label="Ce qui consomme le plus">
            ${top.map(
              (x) => html`<div class="consumer">
                <span class="ellipsis">${x.name}</span><b>${formatNumber(x.w, 0)} W</b>
                <span class="bar"><span style="width:${Math.round((x.w / max) * 100)}%"></span></span>
              </div>`,
            )}
          </div>`
        : nothing}
      <kh-sparkline class="power" compact height="46" .entities=${[{ entity: e.power, label: "Puissance", color: "var(--rgb-orange)", unit: "W" }]}></kh-sparkline>`;
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

    return html`
      ${this.hero()}
      <div class="bento">
        <section class="tile" style="--tint: var(--rgb-amber); --w: 7; --w6: 6; --w2: 2">
          ${head("mdi:lightbulb-group", "Lumières", { href: `${p}/pieces`, label: "Pièces" })}
          <kh-swipe label="Lumières">
            ${pagesOf(lights, 6).map(
              (pg) => html`<div class="pills">${pg.map((l) => html`<kh-light-pill entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh-light-pill>`)}</div>`,
            )}
          </kh-swipe>
        </section>

        <section class="tile ${playing ? "" : "flush"}" style="--tint: var(--rgb-purple); --w: 5; --w6: 6; --w2: 2">
          ${playing
            ? html`${head("mdi:play-circle", "En lecture", { href: `${p}/medias`, label: "Médias" })}
                <kh-media-card entity-id=${playing} kind=${playing === h.spotify ? "music" : "tv"} name=${playing === h.spotify ? "Spotify" : nothing}></kh-media-card>`
            : html`<kh-jellyfin></kh-jellyfin>`}
        </section>

        <section class="tile" style="--tint: var(--rgb-green); --w: 8; --w6: 6; --w2: 2">
          ${head("mdi:home-thermometer", "Climat", { href: `${p}/meteo`, label: "Météo" })}
          ${this.rooms().length
            ? html`<kh-swipe label="Climat">
              ${pagesOf(this.rooms().map((r, i) => ({ r, i })), 4).map(
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
        </section>

        <div class="col" style="--w: 4; --w6: 6; --w2: 2">
          ${h.energy
            ? html`<section class="tile" style="--tint: var(--rgb-orange); --w: 4; --w6: 3; --w2: 2">
                ${head("mdi:lightning-bolt", "Énergie", { href: `${p}/energie`, label: "Détail" })}
                ${this.energy()}
              </section>`
            : nothing}
          ${days.length
            ? html`<section class="tile" style="--tint: var(--rgb-light-blue); --w: 5; --w6: 6; --w2: 2">
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
            : nothing}
        </div>

        ${favorites.length
          ? html`<section class="tile first-on-phone" style="--tint: var(--rgb-yellow); --w: 4; --w6: 6; --w2: 2">
              ${head("mdi:star", "Favoris")}
              <kh-swipe label="Favoris">
                ${pagesOf(favorites, 2).map((pg) => html`<div class="favs">${pg.map((f) => this.favorite(f))}</div>`)}
              </kh-swipe>
            </section>`
          : nothing}
        <section class="tile" style="--tint: var(--rgb-blue); --w: 4; --w6: 3; --w2: 2">
          ${head("mdi:desktop-tower-monitor", "Ordinateurs", { href: `${p}/energie`, label: "Énergie" })}
          <div class="row2">
            ${h.computers.map((c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`)}
          </div>
        </section>
        <section class="tile" style="--tint: var(--rgb-teal); --w: 4; --w6: 3; --w2: 2">
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
        </section>

        <section class="tile" style="--tint: var(--rgb-indigo); --w: 12; --w6: 6; --w2: 2">
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
        </section>
      </div>
    `;
  }
}
customElements.define("kh-home-v2", KhHomeV2);
