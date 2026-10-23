import { LitElement, css, html, nothing, svg } from "lit";
import { openMoreInfo, runScript } from "../actions.ts";
import "../components/energy-card.ts";
import "../components/light-pill.ts";
import { isPlayerActive } from "../components/media-card.ts";
import "../components/media-card.ts";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import { weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config, type Favorite } from "../config.ts";
import { formatNumber, stateLabel } from "../format.ts";
import { openOpenings, openPerson, openWifiQr } from "../popups/index.ts";
import { currentPerson, type HouseModel } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FROG: Record<string, string> = {
  sunny: "24, 159, 215", "mostly-sunny": "68, 176, 214", "partly-cloudy-day": "100, 165, 208", "mostly-cloudy-day": "114, 164, 209",
  "clear-night": "124, 76, 242", "mostly-clear": "133, 109, 229", "partly-cloudy-night": "137, 135, 218", "mostly-cloudy-night": "144, 152, 213",
  cloudy: "145, 169, 206", drizzle: "126, 172, 216", rainy: "40, 130, 221", snowy: "109, 144, 152", lightning: "162, 84, 130", fog: "184, 168, 168", hail: "103, 143, 164",
};

function greeting(h: number): string {
  if (h < 5 || h >= 22) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne journée";
  return "Bonne soirée";
}

/** Ring around a value (0..1) — people's phone battery, energy vs yesterday. */
function ring(f: number, size: number, stroke: number, color: string) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return svg`<svg width=${size} height=${size} viewBox="0 0 ${size} ${size}" style="position:absolute; inset:0; transform: rotate(-90deg)">
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--kh-card-2)" stroke-width=${stroke} />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} stroke-width=${stroke} stroke-linecap="round"
      stroke-dasharray=${c} stroke-dashoffset=${c * (1 - Math.min(1, Math.max(0, f)))} style="transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" />
  </svg>`;
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
      ].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
        container: v2 / inline-size;
      }
      /* Hero: the weather scene of the house, time and people on it. */
      .hero {
        position: relative;
        overflow: hidden;
        min-height: 230px;
        border-radius: 28px;
        padding: 22px 24px;
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
      .hero time {
        display: block;
        font-size: clamp(3rem, 7vw, 4.5rem);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .hero .date {
        font-weight: 600;
        opacity: 0.9;
        text-transform: capitalize;
      }
      .hero .hello {
        font-size: 1.125rem;
        font-weight: 700;
        margin-top: 6px;
      }
      .hero .side {
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 10px;
      }
      .hero .now {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 800;
        font-size: 1.5rem;
      }
      .hero .now img {
        width: 52px;
        height: 52px;
      }
      .hero .cond {
        font-weight: 600;
        opacity: 0.9;
      }
      .chips {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 38px;
        padding: 0 14px;
        border-radius: 19px;
        background: rgb(0 0 0 / 0.28);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
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
      .people {
        display: flex;
        gap: 10px;
      }
      .person {
        position: relative;
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
      }
      .person img,
      .person .initial {
        width: 44px;
        height: 44px;
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

      /* Bento: 12 tracks on wide screens, 6 on tablets, 2 on phones. */
      .bento {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        grid-auto-flow: row dense;
        gap: 16px;
      }
      .tile {
        grid-column: span var(--w, 4);
        min-width: 0;
        border-radius: 24px;
        padding: 16px;
        box-sizing: border-box;
        background: linear-gradient(160deg, rgba(var(--tint, var(--rgb-grey)), 0.16), rgba(var(--tint, var(--rgb-grey)), 0.03) 60%), var(--kh-card);
        display: grid;
        align-content: start;
        gap: 12px;
      }
      .tile.flush {
        padding: 0;
        background: none;
      }
      .tile h3 {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 1rem;
      }
      .tile h3 a {
        color: var(--kh-text-2);
        text-decoration: none;
        font-size: 0.8125rem;
        display: inline-flex;
        align-items: center;
      }
      .tile h3 .ic {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .tile h3 .ic ha-icon {
        --mdc-icon-size: 20px;
        color: rgb(var(--tint));
      }
      .pills {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
        gap: 10px;
      }
      .climate {
        display: grid;
        gap: 4px;
      }
      .room {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 2px 10px;
        padding: 8px 10px;
        border-radius: 14px;
        background: var(--kh-card-2);
        text-align: left;
        width: 100%;
      }
      .room .t {
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .room kh-sparkline {
        grid-column: 1 / -1;
      }
      .energy-big {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .gauge {
        position: relative;
        width: 108px;
        height: 108px;
        display: grid;
        place-items: center;
        flex: none;
      }
      .gauge b {
        font-size: 1.375rem;
        font-variant-numeric: tabular-nums;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .action {
        display: grid;
        justify-items: start;
        gap: 6px;
        padding: 12px;
        border-radius: 16px;
        background: rgba(var(--c), 0.18);
        font-weight: 700;
        text-align: left;
        color: inherit;
        text-decoration: none;
      }
      .action ha-icon {
        color: rgb(var(--c));
      }
      .ticker {
        display: flex;
        gap: 18px;
        overflow-x: auto;
        scrollbar-width: none;
        font-variant-numeric: tabular-nums;
      }
      .ticker button {
        flex: none;
        display: grid;
        text-align: left;
      }
      @container v2 (max-width: 1099px) {
        .bento {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
        .tile {
          grid-column: span var(--w6, 3);
        }
      }
      @container v2 (max-width: 679px) {
        .hero {
          grid-template-columns: 1fr;
          min-height: 260px;
        }
        .hero .side {
          justify-items: start;
          grid-row: 2;
        }
        .bento {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .tile {
          grid-column: span var(--w2, 2);
        }
        .pills {
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
    const bat = new Map(this.batteries().map((b) => [b.key, b]));
    const style = `--frog: ${FROG[frog] ?? "40, 130, 221"}; --scene: ${scene.startsWith("http") ? `url('${scene}')` : "none"}; --shift: ${place === "field" ? "20%" : place === "hills" ? "40%" : "10%"}`;

    return html`<section class="hero" style=${style}>
      <div>
        <time datetime=${this.now.toISOString()}>${time.format(this.now)}</time>
        <div class="date">${date.format(this.now)}</div>
        <div class="hello">${greeting(this.now.getHours())}${name ? ` ${name.replace(/^./, (c) => c.toUpperCase())}` : ""}</div>
      </div>
      <div class="side">
        ${weather
          ? html`<a class="now" href=${`${this.prefix}/meteo`} style="color:inherit; text-decoration:none">
              <img src=${weatherIcon(weather.state, night)} alt="" />${isNaN(temp) ? "" : `${formatNumber(temp)}°`}
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
                ${!isNaN(level) ? ring(level, 56, 4, level > 0.2 ? "#ffffff" : "rgb(244, 67, 54)") : nothing}
                ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="initial">${String(s.attributes.friendly_name ?? p).charAt(0)}</span>`}
                <span class="dot"></span>
              </button>`;
            })}
        </div>
      </div>
      <div class="chips">
        ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
        ${!isNaN(lights) ? html`<a class="chip" href=${`${this.prefix}/pieces`}><ha-icon icon="mdi:lightbulb-on"></ha-icon>${lights} allumée${lights > 1 ? "s" : ""}</a>` : nothing}
        ${windows > 0 ? html`<button class="chip alert" @click=${() => openOpenings(this.openings())}><ha-icon icon="mdi:window-open-variant"></ha-icon>${windows} ouverte${windows > 1 ? "s" : ""}</button>` : nothing}
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
    return html`<div class="energy-big">
      <div class="gauge">
        ${ring(f, 108, 10, "rgb(var(--rgb-orange))")}
        <div style="text-align:center"><b>${isNaN(kwh) ? "—" : formatNumber(kwh, 1)}</b><div class="secondary">kWh</div></div>
      </div>
      <div>
        <div class="primary">${isNaN(kwh) ? "" : `${formatNumber(kwh * e.pricePerKwh, 2)} € aujourd'hui`}</div>
        <div class="secondary">${last > 0 ? `Hier : ${formatNumber(last, 1)} kWh` : ""}</div>
        <div class="secondary">${isNaN(watts) ? "" : `${formatNumber(watts, 0)} W en ce moment`}</div>
      </div>
    </div>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const lights = h.lights.filter((l) => hass.states[l.entity]);
    const playing = [h.spotify, ...h.tvs].find((id) => !!id && isPlayerActive(id));

    return html`
      ${this.hero()}
      <div class="bento">
        <section class="tile" style="--tint: var(--rgb-amber); --w: 7; --w6: 6; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:lightbulb-group"></ha-icon>Lumières</span>
            <a href=${`${this.prefix}/pieces`}>Pièces<ha-icon icon="mdi:chevron-right"></ha-icon></a></h3>
          <div class="pills">${lights.map((l) => html`<kh-light-pill entity-id=${l.entity} name=${l.name} icon=${l.icon ?? nothing}></kh-light-pill>`)}</div>
        </section>

        <section class="tile ${playing ? "" : "flush"}" style="--tint: var(--rgb-purple); --w: 5; --w6: 6; --w2: 2">
          ${playing
            ? html`<h3><span class="ic"><ha-icon icon="mdi:play-circle"></ha-icon>En lecture</span>
                  <a href=${`${this.prefix}/medias`}>Médias<ha-icon icon="mdi:chevron-right"></ha-icon></a></h3>
                <kh-media-card entity-id=${playing} kind=${playing === h.spotify ? "music" : "tv"} name=${playing === h.spotify ? "Spotify" : nothing}></kh-media-card>`
            : html`<kh-jellyfin></kh-jellyfin>`}
        </section>

        <section class="tile" style="--tint: var(--rgb-green); --w: 4; --w6: 3; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:home-thermometer"></ha-icon>Climat</span>
            <a href=${`${this.prefix}/meteo`}>Météo<ha-icon icon="mdi:chevron-right"></ha-icon></a></h3>
          <div class="climate">
            ${this.rooms().length
              ? this.rooms().map((r) => {
                  const t = Number(hass.states[r.temperature!]?.state);
                  const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
                  return html`<button class="room" @click=${() => openMoreInfo(this, r.temperature!)}>
                    <span class="primary ellipsis">${r.name}</span>
                    <span class="t">${isNaN(t) ? "—" : `${formatNumber(t)}°`}<span class="secondary">${isNaN(hum) ? "" : ` ${formatNumber(hum, 0)} %`}</span></span>
                    <kh-sparkline compact hours="12" .entities=${[{ entity: r.temperature!, label: "", color: "var(--rgb-orange)", unit: "°C" }]}></kh-sparkline>
                  </button>`;
                })
              : html`<div class="secondary">Aucun thermomètre joignable</div>`}
          </div>
        </section>

        <section class="tile" style="--tint: var(--rgb-orange); --w: 4; --w6: 3; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:lightning-bolt"></ha-icon>Énergie</span>
            <a href=${`${this.prefix}/energie`}>Détail<ha-icon icon="mdi:chevron-right"></ha-icon></a></h3>
          ${this.energy()}
        </section>

        <section class="tile" style="--tint: var(--rgb-blue); --w: 4; --w6: 6; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:desktop-tower-monitor"></ha-icon>Ordinateurs</span></h3>
          <div class="actions">
            ${h.computers.map((c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`)}
          </div>
        </section>

        <section class="tile" style="--tint: var(--rgb-indigo); --w: 5; --w6: 3; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:gesture-tap-button"></ha-icon>Raccourcis</span></h3>
          <div class="actions">
            ${h.leave
              ? html`<button class="action" style="--c: var(--rgb-indigo)" @click=${() => runScript(h.leave!)}>
                  <ha-icon icon="mdi:hand-wave"></ha-icon>Partir<span class="secondary">Tout éteindre</span></button>`
              : nothing}
            ${h.wifiQr
              ? html`<button class="action" style="--c: var(--rgb-teal)" @click=${() => openWifiQr()}>
                  <ha-icon icon="mdi:qrcode"></ha-icon>Wi-Fi<span class="secondary">QR invités</span></button>`
              : nothing}
            <a class="action" style="--c: var(--rgb-blue)" href=${`${this.prefix}/medias`}><ha-icon icon="mdi:remote-tv"></ha-icon>Télécommande<span class="secondary">Box TV</span></a>
            <a class="action" style="--c: var(--rgb-grey)" href=${`${this.prefix}/systeme`}><ha-icon icon="mdi:cog"></ha-icon>Système<span class="secondary">Réseau, HA</span></a>
          </div>
        </section>

        <section class="tile" style="--tint: var(--rgb-teal); --w: 3; --w6: 3; --w2: 2">
          <h3><span class="ic"><ha-icon icon="mdi:chart-line"></ha-icon>Bourse</span>
            <a href=${`${this.prefix}/meteo`}>Tout<ha-icon icon="mdi:chevron-right"></ha-icon></a></h3>
          <div class="climate">
            ${h.stocks.slice(0, 3).map((s) => {
              const st = hass.states[s.entity];
              const ch = Number(st?.attributes.regularMarketChangePercent);
              return st
                ? html`<button class="room" @click=${() => openMoreInfo(this, s.entity)}>
                    <span class="primary ellipsis">${s.name}</span>
                    <span class="t" style="color: rgb(var(--rgb-${ch >= 0 ? "green" : "red"}))">${isNaN(ch) ? "" : `${ch >= 0 ? "+" : ""}${formatNumber(ch, 1)} %`}</span>
                  </button>`
                : nothing;
            })}
          </div>
        </section>
      </div>
    `;
  }
}
customElements.define("kh-home-v2", KhHomeV2);
