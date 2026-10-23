import { LitElement, css, html, nothing } from "lit";
import "../components/sparkline.ts";
import { still, weatherIcon } from "../components/weather-card.ts";
import "../components/widgets.ts";
import { config } from "../config.ts";
import { formatNumber, stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { COMPASS, beaufort, forecastDays, frogSky, hourFormat, moon, subscribeHourly, sunArc, sunTimes, windyUrl } from "../weather-utils.ts";
import { head, hero, v2 } from "./styles.ts";

/** Météo: now in the hero, then hours, days, sun, radar and the markets. */
export class KhV2Weather extends LitElement {
  static properties = { prefix: {}, hourly: { state: true } };
  declare prefix: string;
  declare hourly: any[];
  private unsub?: () => void;

  constructor() {
    super();
    this.hourly = [];
    new RegistryController(this);
    new EntitiesController(this, () => [
      ...config.weather,
      ...Object.values(config.weatherPage).filter((v): v is string => typeof v === "string"),
      config.home.outdoorTemperature ?? "",
      config.home.forecast?.sensor ?? "",
      config.home.nextRain ?? "",
      config.home.frog?.image ?? "",
      config.home.frog?.status ?? "",
      config.home.frog?.location ?? "",
      "sun.sun",
    ]);
  }

  static styles = [
    base,
    v2,
    css`
      .hero .art.photo {
        background-size: 100% 100%, cover;
        background-repeat: no-repeat;
      }
      .arrow {
        display: inline-block;
        transition: transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .hours {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 64px;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .hour {
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 8px 0;
        border-radius: 16px;
        font-variant-numeric: tabular-nums;
      }
      .hour:first-child {
        background: var(--kh-card-2);
      }
      .hour img {
        width: 40px;
        height: 40px;
      }
      .hour small {
        color: var(--kh-text-2);
        font-weight: 600;
      }
      .rain {
        color: rgb(var(--rgb-blue));
      }
      .day {
        display: grid;
        grid-template-columns: 44px 36px 34px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 8px;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
      }
      .day img {
        width: 36px;
        height: 36px;
      }
      .day .low {
        color: var(--kh-text-2);
        text-align: right;
      }
      .range {
        position: relative;
        height: 8px;
        border-radius: 4px;
        background: var(--kh-card-2);
      }
      .range i {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 4px;
        background: linear-gradient(90deg, rgb(var(--rgb-light-blue)), rgb(var(--rgb-orange)));
      }
      .sun svg {
        width: 100%;
        height: auto;
      }
      .times {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }
      iframe {
        width: 100%;
        height: clamp(320px, 58vh, 600px);
        border: 0;
        border-radius: 18px;
        display: block;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.unsub = subscribeHourly((h) => (this.hourly = h));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  /** The weather frog's picture of the moment behind the hero, as on the home view. */
  private frogPicture() {
    const f = config.home.frog;
    const st = (id?: string) => (id ? store.hass?.states[id]?.state : undefined);
    const image = st(f?.image) ?? "";
    if (!image.startsWith("http")) return nothing;
    const sky = frogSky();
    const place = st(f?.location);
    const shift = place === "field" ? "20%" : place === "hills" ? "40%" : "10%";
    return html`<div class="art photo" style="background-color: rgb(${sky}); background-image: linear-gradient(100deg, rgba(${sky}, 0.7) 0%, rgba(${sky}, 0.25) 38%, rgba(${sky}, 0) 60%), url('${image}'); background-position: top, ${shift} 75%"></div>`;
  }

  private days() {
    const days = forecastDays(7);
    if (!days.length) return nothing;
    const lows = days.map((d) => d.templow ?? d.temperature), highs = days.map((d) => d.temperature);
    const min = Math.min(...lows), max = Math.max(...highs), span = Math.max(1, max - min);
    return html`<div class="list">
      ${days.map((d) => {
        const lo = d.templow ?? d.temperature;
        return html`<div class="day">
          <span style="text-transform: capitalize">${d.day}</span>
          <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt=${d.condition} />
          <span class="low">${formatNumber(lo, 0)}°</span>
          <span class="range"><i style="left:${((lo - min) / span) * 100}%; right:${100 - ((d.temperature - min) / span) * 100}%"></i></span>
          <span>${formatNumber(d.temperature, 0)}°</span>
        </div>`;
      })}
    </div>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const w = config.weatherPage;
    const num = (id?: string) => (id ? Number(hass.states[id]?.state) : NaN);
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const outdoor = num(config.home.outdoorTemperature);
    const temp = !isNaN(outdoor) ? outdoor : Number(weather?.attributes.temperature);
    const feels = num(w.feelsLike), hum = num(w.humidity), wind = num(w.windSpeed), bearing = num(w.windBearing);
    const rain = num(w.rainChance), clouds = num(w.cloudCover), uv = num(w.uv);
    const { day, rise, set, isNight } = sunTimes();
    const [moonLabel, moonIcon] = moon();
    const nextRain = config.home.nextRain ? hass.states[config.home.nextRain]?.state : undefined;
    const rainAt = nextRain && Date.parse(nextRain) > Date.now() ? hourFormat.format(new Date(nextRain)) : "";
    const dir = !isNaN(bearing) ? COMPASS[Math.round(bearing / 45) % 8] : "";
    const graph = [
      ...(config.home.outdoorTemperature ? [{ entity: config.home.outdoorTemperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" }] : []),
      ...(w.humidity ? [{ entity: w.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
    ];

    return html`
      ${hero(
        day ? "light-blue" : "indigo",
        "mdi:weather-partly-cloudy",
        weather ? stateLabel(hass, weather) : "Météo",
        isNaN(temp) ? "—" : `${formatNumber(temp)}°`,
        [!isNaN(feels) ? `Ressenti ${formatNumber(feels)}°` : "", !isNaN(hum) ? `humidité ${formatNumber(hum, 0)} %` : ""].filter(Boolean).join(", "),
        html`${!isNaN(wind)
            ? html`<span class="chip"><ha-icon icon="mdi:weather-windy"></ha-icon>${formatNumber(wind, 0)} km/h, force ${beaufort(wind)}
                ${dir ? html`<span class="arrow" style="transform: rotate(${bearing + 180}deg)" aria-label="vers ${dir}">↑</span>${dir}` : nothing}</span>`
            : nothing}
          ${rainAt ? html`<span class="chip"><ha-icon icon="mdi:umbrella"></ha-icon>Pluie à ${rainAt}</span>` : nothing}
          ${!isNaN(rain) ? html`<span class="chip"><ha-icon icon="mdi:umbrella-outline"></ha-icon>${formatNumber(rain, 0)} %</span>` : nothing}
          ${!isNaN(clouds) ? html`<span class="chip"><ha-icon icon="mdi:cloud-outline"></ha-icon>${formatNumber(clouds, 0)} %</span>` : nothing}
          ${day && !isNaN(uv)
            ? html`<span class="chip"><ha-icon icon="mdi:sun-wireless-outline"></ha-icon>UV ${formatNumber(uv, 1)}</span>`
            : html`<span class="chip"><ha-icon icon=${moonIcon}></ha-icon>${moonLabel}</span>`}`,
        this.frogPicture(),
      )}
      <div class="bento">
        ${this.hourly.length
          ? html`<section class="tile" style="--tint: var(--rgb-light-blue); --w: 12; --w6: 6; --w2: 2">
              ${head("mdi:clock-outline", "Prochaines heures")}
              <div class="hours" role="list">
                ${this.hourly.map(
                  (f) => html`<div class="hour" role="listitem">
                    <small>${hourFormat.format(new Date(f.datetime))}</small>
                    <img src=${still(weatherIcon(f.condition, f.is_daytime === undefined ? isNight(Date.parse(f.datetime)) : !f.is_daytime, f.precipitation ?? 0))} alt=${f.condition} />
                    <b>${formatNumber(f.temperature, 0)}°</b>
                    <small class=${f.precipitation_probability > 30 ? "rain" : ""}>${f.precipitation_probability !== undefined ? `${f.precipitation_probability} %` : ""}</small>
                  </div>`,
                )}
              </div>
            </section>`
          : nothing}
        <div class="col" style="--w: 7; --w6: 6; --w2: 2">
          ${graph.length
            ? html`<section class="tile" style="--tint: var(--rgb-orange); --w: 7; --w6: 6; --w2: 2">
                ${head("mdi:chart-bell-curve-cumulative", "Dehors sur 24 h")}
                <kh-sparkline .entities=${graph}></kh-sparkline>
              </section>`
            : nothing}
          ${config.home.stocks.length
            ? html`<section class="tile" style="--tint: var(--rgb-teal); --w: 4; --w6: 3; --w2: 2">
                ${head("mdi:chart-line", "Bourse")}
                <div class="list">${config.home.stocks.map((s) => html`<kh-stock entity-id=${s.entity} name=${s.name}></kh-stock>`)}</div>
              </section>`
            : nothing}
        </div>
        <div class="col" style="--w: 5; --w6: 6; --w2: 2">
          <section class="tile" style="--tint: var(--rgb-blue); --w: 5; --w6: 6; --w2: 2">
            ${head("mdi:calendar-week", "Sept jours")}
            ${this.days()}
          </section>
          <section class="tile sun" style="--tint: var(--rgb-amber); --w: 4; --w6: 3; --w2: 2">
            ${head("mdi:white-balance-sunny", "Soleil")}
            ${!isNaN(rise) && !isNaN(set) ? sunArc(rise, set) : nothing}
            <div class="times">
              <span><ha-icon icon="mdi:weather-sunset-up"></ha-icon> ${isNaN(rise) ? "" : hourFormat.format(new Date(rise))}</span>
              <span>${isNaN(set) ? "" : hourFormat.format(new Date(set))} <ha-icon icon="mdi:weather-sunset-down"></ha-icon></span>
            </div>
            <div class="secondary">
              ${!isNaN(rise) && !isNaN(set) ? `${Math.floor((set - rise) / 3600000)} h ${Math.round(((set - rise) % 3600000) / 60000)} de jour, ` : ""}${moonLabel.toLowerCase()}
            </div>
          </section>
        </div>
        ${w.windy
          ? html`<section class="tile" style="--tint: var(--rgb-blue); --w: 12; --w6: 6; --w2: 2">
              ${head("mdi:radar", "Radar de pluie")}
              <iframe title="Radar Windy" loading="lazy" src=${windyUrl(w.windy.lat, w.windy.lon)}></iframe>
            </section>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-v2-weather", KhV2Weather);
