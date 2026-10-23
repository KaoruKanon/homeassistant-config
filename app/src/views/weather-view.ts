import { LitElement, css, html, nothing } from "lit";
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

/** Météo: now and its details, next hours, next days, sun, radar, stocks. */
export class KhWeatherView extends LitElement {
  static properties = { hourly: { state: true }, radar: { state: true } };
  declare hourly: any[];
  declare radar: boolean;
  private unsub?: Promise<() => Promise<void>>;

  constructor() {
    super();
    this.hourly = [];
    this.radar = false;
    new RegistryController(this);
    new EntitiesController(this, () => [...Object.values(config.weatherPage).filter((v): v is string => typeof v === "string"), "sun.sun"]);
  }

  static styles = [
    base,
    pageStyles,
    css`
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
      .details {
        --min: 150px;
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
      }
      .arrow {
        display: inline-block;
        transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      iframe {
        width: 100%;
        aspect-ratio: 4 / 3;
        border: 0;
        border-radius: var(--kh-radius);
        background: var(--kh-card);
      }
      .radar-cta {
        width: 100%;
        min-height: 120px;
        display: grid;
        place-items: center;
        gap: 6px;
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

  private detail(icon: string, color: string, label: string, value: string) {
    return html`<div class="card detail">
      <span class="shape" style="--rgb: var(--rgb-${color})">${icon.startsWith("mdi:") ? html`<ha-icon icon=${icon}></ha-icon>` : icon}</span>
      <div><div class="secondary">${label}</div><div class="primary">${value}</div></div>
    </div>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const w = config.weatherPage;
    const num = (id?: string) => (id ? Number(hass.states[id]?.state) : NaN);
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const sun = hass.states["sun.sun"];
    const day = sun?.state === "above_horizon";
    const wind = num(w.windSpeed);
    const bearing = num(w.windBearing);
    const uv = num(w.uv);
    const phase = moonPhase();
    const moon = MOON.find(([max]) => phase < max)!;
    // Night for a forecast hour: between the next sunset and the next sunrise.
    const nextRise = Date.parse(sun?.attributes.next_rising ?? ""), nextSet = Date.parse(sun?.attributes.next_setting ?? "");
    const isNight = (t: number) =>
      isNaN(nextRise) || isNaN(nextSet) ? false : nextSet < nextRise ? t >= nextSet && t < nextRise : t < nextRise || t >= nextSet;
    const rise = sun?.attributes.next_rising ? hourFormat.format(new Date(sun.attributes.next_rising)) : "";
    const set = sun?.attributes.next_setting ? hourFormat.format(new Date(sun.attributes.next_setting)) : "";

    return html`
      ${pageHead("mdi:weather-partly-cloudy", "light-blue", "Météo", weather ? `${stateLabel(hass, weather)}, ${formatNumber(num(config.home.outdoorTemperature) || weather.attributes.temperature)} °C` : "")}
      <div class="cols">
        <div>
          <h2>Maintenant</h2>
          <kh-weather-card></kh-weather-card>
        </div>
        <div>
          <h2>Détails</h2>
          <div class="grid details">
            ${!isNaN(num(w.feelsLike)) ? this.detail("mdi:thermometer", "orange", "Ressenti", `${formatNumber(num(w.feelsLike))} °C`) : nothing}
            ${!isNaN(num(w.humidity)) ? this.detail("mdi:water-percent", "light-blue", "Humidité", `${formatNumber(num(w.humidity), 0)} %`) : nothing}
            ${!isNaN(wind)
              ? this.detail("mdi:weather-windy", "teal", "Vent", `${formatNumber(wind, 0)} km/h, force ${beaufort(wind)}${!isNaN(bearing) ? ` ${COMPASS[Math.round(bearing / 45) % 8]}` : ""}`)
              : nothing}
            ${!isNaN(num(w.rainChance)) ? this.detail("mdi:umbrella-outline", "blue", "Risque de pluie", `${formatNumber(num(w.rainChance), 0)} %`) : nothing}
            ${!isNaN(num(w.cloudCover)) ? this.detail("mdi:cloud-outline", "grey", "Nuages", `${formatNumber(num(w.cloudCover), 0)} %`) : nothing}
            ${day && !isNaN(uv)
              ? this.detail("mdi:sun-wireless-outline", uv > 5 ? "red" : uv > 2 ? "orange" : "green", "Indice UV", formatNumber(uv, 1))
              : this.detail(moon[2], "indigo", "Lune", moon[1])}
            ${rise ? this.detail("mdi:weather-sunset-up", "amber", "Lever du soleil", rise) : nothing}
            ${set ? this.detail("mdi:weather-sunset-down", "orange", "Coucher du soleil", set) : nothing}
          </div>
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
      <div class="cols">
        <div>
          <h2>Radar de pluie</h2>
          ${this.radar && w.windy
            ? html`<iframe
                title="Radar Windy"
                loading="lazy"
                src="https://embed.windy.com/embed2.html?lat=${w.windy.lat}&lon=${w.windy.lon}&zoom=8&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=&calendar=now&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=%C2%B0C"
              ></iframe>`
            : html`<button class="card radar-cta" @click=${() => (this.radar = true)}>
                <span class="shape" style="--rgb: var(--rgb-blue)"><ha-icon icon="mdi:radar"></ha-icon></span>
                <span class="primary">Afficher le radar Windy</span>
              </button>`}
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
