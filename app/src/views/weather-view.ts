import { LitElement, css, html, nothing, svg } from "lit";
import "../components/sparkline.ts";
import "../components/swipe.ts";
import "../components/weather-card.ts";
import { weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config } from "../config.ts";
import { formatNumber, stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { pageHead, pageStyles } from "./page.ts";

const hourFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/** Beaufort force from km/h. */
function beaufort(kmh: number): number {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = limits.findIndex((l) => kmh < l);
  return i === -1 ? 12 : i;
}

/** Moon phase 0..1 (0 = new moon), from the date. */
function moonPhase(d = new Date()): number {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14); // a new moon
  return (((d.getTime() - known) / 86400000 / synodic) % 1 + 1) % 1;
}

const MOON: [number, string, string][] = [
  [0.03, "Nouvelle lune", "mdi:moon-new"],
  [0.22, "Premier croissant", "mdi:moon-waxing-crescent"],
  [0.28, "Premier quartier", "mdi:moon-first-quarter"],
  [0.47, "Gibbeuse croissante", "mdi:moon-waxing-gibbous"],
  [0.53, "Pleine lune", "mdi:moon-full"],
  [0.72, "Gibbeuse décroissante", "mdi:moon-waning-gibbous"],
  [0.78, "Dernier quartier", "mdi:moon-last-quarter"],
  [0.97, "Dernier croissant", "mdi:moon-waning-crescent"],
  [1.01, "Nouvelle lune", "mdi:moon-new"],
];

/** Météo: now, condensed details, next hours, next days, radar, stocks. */
export class KhWeatherView extends LitElement {
  static properties = { hourly: { state: true } };
  declare hourly: any[];
  private unsub?: Promise<() => Promise<void>>;

  constructor() {
    super();
    this.hourly = [];
    new RegistryController(this);
    new EntitiesController(this, () => [
      ...Object.values(config.weatherPage).filter((v): v is string => typeof v === "string"),
      config.home.outdoorTemperature ?? "",
      "sun.sun",
    ]);
  }

  static styles = [
    base,
    pageStyles,
    css`
      .now {
        padding: 16px;
        display: grid;
        gap: 12px;
      }
      .temp {
        display: flex;
        align-items: baseline;
        gap: 14px;
        flex-wrap: wrap;
      }
      .temp .big {
        font-size: 3rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card-2);
        font-weight: 700;
        font-size: 0.875rem;
      }
      .chip ha-icon {
        --mdc-icon-size: 18px;
        color: rgb(var(--rgb, var(--rgb-grey)));
      }
      .arrow {
        display: inline-block;
        transition: transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .sun {
        padding: 16px;
        display: grid;
        gap: 6px;
      }
      .sun svg {
        width: 100%;
        height: auto;
      }
      .sun .times {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }
      .hours {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 64px;
        gap: 8px;
        overflow-x: auto;
        padding: 12px;
        scrollbar-width: thin;
      }
      .hour {
        display: grid;
        justify-items: center;
        gap: 2px;
        font-variant-numeric: tabular-nums;
      }
      .hour img {
        width: 40px;
        height: 40px;
      }
      .hour .t {
        font-weight: 700;
      }
      .hour small {
        color: var(--kh-text-2);
        font-weight: 600;
      }
      .radar-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0 28px;
      }
      iframe {
        width: 100%;
        height: clamp(320px, 62vh, 640px);
        border: 0;
        border-radius: var(--kh-radius);
        background: var(--kh-card);
        display: block;
      }
      @container kh (min-width: 1100px) {
        .radar-row {
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const id = config.weatherPage.hourly;
    const conn = store.hass?.connection;
    if (id && conn?.subscribeMessage) {
      this.unsub = conn.subscribeMessage<{ forecast: any[] }>((m) => (this.hourly = (m.forecast ?? []).slice(0, 16)), {
        type: "weather/subscribe_forecast",
        entity_id: id,
        forecast_type: "hourly",
      });
      this.unsub.catch(() => (this.hourly = []));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.then((u) => u()).catch(() => {});
  }

  /** Sun course today: dawn to dusk arc, the sun where it is now. */
  private sunArc(rise: number, set: number) {
    const now = Date.now();
    const W = 300, H = 110;
    const f = Math.min(1, Math.max(0, (now - rise) / (set - rise)));
    const up = now > rise && now < set;
    const x = 20 + f * (W - 40);
    const y = H - 18 - Math.sin(f * Math.PI) * (H - 36);
    return svg`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Course du soleil">
      <line x1="10" x2=${W - 10} y1=${H - 18} y2=${H - 18} stroke="var(--kh-line)" stroke-width="2" />
      <path d="M20 ${H - 18} Q ${W / 2} ${-H + 54} ${W - 20} ${H - 18}" fill="none" stroke="rgba(var(--rgb-amber), 0.35)" stroke-width="3" stroke-dasharray="4 6" />
      ${up ? svg`<circle cx=${x} cy=${y} r="11" fill="rgb(var(--rgb-amber))"><animate attributeName="r" values="10;12;10" dur="3s" repeatCount="indefinite" /></circle>` : nothing}
    </svg>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const w = config.weatherPage;
    const num = (id?: string) => (id ? Number(hass.states[id]?.state) : NaN);
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const sun = hass.states["sun.sun"];
    const day = sun?.state === "above_horizon";
    const temp = num(config.home.outdoorTemperature);
    const feels = num(w.feelsLike);
    const hum = num(w.humidity);
    const wind = num(w.windSpeed);
    const bearing = num(w.windBearing);
    const rain = num(w.rainChance);
    const clouds = num(w.cloudCover);
    const uv = num(w.uv);
    const moon = MOON.find(([max]) => moonPhase() < max)!;

    const nextRise = Date.parse(sun?.attributes.next_rising ?? "");
    const nextSet = Date.parse(sun?.attributes.next_setting ?? "");
    // Today's sunrise/sunset from the next ones (yesterday's rise if the sun is up).
    const rise = day ? nextRise - 86400000 : nextRise;
    const set = nextSet;
    const isNight = (t: number) =>
      isNaN(nextRise) || isNaN(nextSet) ? false : nextSet < nextRise ? t >= nextSet && t < nextRise : t < nextRise || t >= nextSet;

    const graph = [
      ...(config.home.outdoorTemperature ? [{ entity: config.home.outdoorTemperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" }] : []),
      ...(w.humidity ? [{ entity: w.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
    ];

    return html`
      ${pageHead("mdi:weather-partly-cloudy", "light-blue", "Météo", weather ? `${stateLabel(hass, weather)}, ${formatNumber(isNaN(temp) ? weather.attributes.temperature : temp)} °C` : "")}
      <div class="cols">
        <div>
          <h2>En ce moment</h2>
          <kh-weather-card></kh-weather-card>
        </div>
        <div>
          <h2>Détails</h2>
          <kh-swipe label="Détails météo">
            <div class="card now">
              <div class="temp">
                <span class="big">${isNaN(temp) ? "—" : `${formatNumber(temp)}°`}</span>
                <span class="secondary">${!isNaN(feels) ? `ressenti ${formatNumber(feels)}°` : ""}${!isNaN(hum) ? `, humidité ${formatNumber(hum, 0)} %` : ""}</span>
              </div>
              <kh-sparkline .entities=${graph}></kh-sparkline>
              <div class="chips">
                ${!isNaN(wind)
                  ? html`<span class="chip" style="--rgb: var(--rgb-teal)" title="Vent">
                      <ha-icon icon="mdi:weather-windy"></ha-icon>${formatNumber(wind, 0)} km/h, force ${beaufort(wind)}
                      ${!isNaN(bearing)
                        ? html`<span class="arrow" style="transform: rotate(${bearing + 180}deg)" aria-label="vers ${COMPASS[Math.round(bearing / 45) % 8]}">↑</span>${COMPASS[Math.round(bearing / 45) % 8]}`
                        : nothing}
                    </span>`
                  : nothing}
                ${!isNaN(rain) ? html`<span class="chip" style="--rgb: var(--rgb-blue)"><ha-icon icon="mdi:umbrella-outline"></ha-icon>${formatNumber(rain, 0)} %</span>` : nothing}
                ${!isNaN(clouds) ? html`<span class="chip"><ha-icon icon="mdi:cloud-outline"></ha-icon>${formatNumber(clouds, 0)} %</span>` : nothing}
                ${day && !isNaN(uv)
                  ? html`<span class="chip" style="--rgb: var(--rgb-${uv > 5 ? "red" : uv > 2 ? "orange" : "green"})"><ha-icon icon="mdi:sun-wireless-outline"></ha-icon>UV ${formatNumber(uv, 1)}</span>`
                  : html`<span class="chip" style="--rgb: var(--rgb-indigo)"><ha-icon icon=${moon[2]}></ha-icon>${moon[1]}</span>`}
              </div>
            </div>
            <div class="card sun">
              <div class="primary">Soleil</div>
              ${!isNaN(rise) && !isNaN(set) ? this.sunArc(rise, set) : nothing}
              <div class="times">
                <span><ha-icon icon="mdi:weather-sunset-up"></ha-icon> ${isNaN(rise) ? "" : hourFormat.format(new Date(rise))}</span>
                <span class="secondary">${!isNaN(rise) && !isNaN(set) ? `${Math.floor((set - rise) / 3600000)} h ${Math.round(((set - rise) % 3600000) / 60000)} de jour` : ""}</span>
                <span>${isNaN(set) ? "" : hourFormat.format(new Date(set))} <ha-icon icon="mdi:weather-sunset-down"></ha-icon></span>
              </div>
              <div class="secondary"><ha-icon icon=${moon[2]}></ha-icon> ${moon[1]}</div>
            </div>
          </kh-swipe>
        </div>
      </div>
      ${this.hourly.length
        ? html`<h2>Prochaines heures</h2>
            <div class="card hours" role="list">
              ${this.hourly.map(
                (f) => html`<div class="hour" role="listitem">
                  <small>${hourFormat.format(new Date(f.datetime))}</small>
                  <img src=${weatherIcon(f.condition, f.is_daytime === undefined ? isNight(Date.parse(f.datetime)) : !f.is_daytime, f.precipitation ?? 0)} alt=${f.condition} />
                  <span class="t">${formatNumber(f.temperature, 0)}°</span>
                  <small>${f.precipitation_probability !== undefined ? `${f.precipitation_probability} %` : ""}</small>
                </div>`,
              )}
            </div>`
        : nothing}
      <div class="radar-row">
        <div>
          <h2>Radar de pluie</h2>
          ${w.windy
            ? html`<iframe
                title="Radar Windy"
                src="https://embed.windy.com/embed2.html?lat=${w.windy.lat}&lon=${w.windy.lon}&zoom=8&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=&calendar=now&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=%C2%B0C"
              ></iframe>`
            : nothing}
        </div>
        <div>
          <h2>Bourse</h2>
          <div class="stack">${config.home.stocks.map((s) => html`<kh-stock entity-id=${s.entity} name=${s.name}></kh-stock>`)}</div>
        </div>
      </div>
    `;
  }
}
customElements.define("kh-weather-view", KhWeatherView);
