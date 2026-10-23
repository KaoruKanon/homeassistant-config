import { until } from "lit/directives/until.js";
import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

// Google weather frog colours (from the Adaptive Mushroom theme), keyed by
// sensor.weather_frog_status.
const FROG_RGB: Record<string, string> = {
  sunny: "24, 159, 215",
  "mostly-sunny": "68, 176, 214",
  "partly-cloudy-day": "100, 165, 208",
  "mostly-cloudy-day": "114, 164, 209",
  "clear-night": "124, 76, 242",
  "mostly-clear": "133, 109, 229",
  "partly-cloudy-night": "137, 135, 218",
  "mostly-cloudy-night": "144, 152, 213",
  cloudy: "145, 169, 206",
  drizzle: "126, 172, 216",
  rainy: "40, 130, 221",
  snowy: "109, 144, 152",
  lightning: "162, 84, 130",
  fog: "184, 168, 168",
  hail: "103, 143, 164",
};

/** Animated Meteocons icon in www/weather for an HA condition. */
export function weatherIcon(condition: string, night = false, precipitation = 0): string {
  const slug: Record<string, string> = {
    sunny: night ? "clear-night" : "clear-day",
    "clear-night": "clear-night",
    partlycloudy: night ? "partly-cloudy-night" : "partly-cloudy-day",
    cloudy: "cloudy",
    fog: "fog",
    hail: "hail",
    lightning: "thunderstorms",
    "lightning-rainy": "thunderstorms-rain",
    pouring: "extreme-rain",
    rainy: precipitation > 0 && precipitation < 1 ? "drizzle" : "rain",
    snowy: "snow",
    "snowy-rainy": "sleet",
    windy: "wind",
    "windy-variant": "wind",
    exceptional: "extreme",
  };
  return `/local/weather/${slug[condition] ?? "not-available"}.svg`;
}

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Current weather over the Google weather frog, then a 5-day strip. */
const stills = new Map<string, Promise<string>>();
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * A still frame of an animated weather icon. The Meteocons animate in SMIL,
 * which the browser repaints on every frame for each image: a forecast row
 * of a dozen of them is enough to stall a tablet. Only the "now" icon moves;
 * lists use a frame drawn once on a canvas (cached per icon).
 */
export function stillIcon(src: string): Promise<string> {
  let p = stills.get(src);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () =>
        setTimeout(() => {
          try {
            const c = document.createElement("canvas");
            c.width = c.height = 160;
            c.getContext("2d")!.drawImage(img, 0, 0, 160, 160);
            resolve(c.toDataURL("image/png"));
          } catch {
            resolve(src);
          }
        }, 400); // a frame where the drops and rays are drawn
      img.onerror = () => resolve(src);
      img.src = src;
    });
    stills.set(src, p);
  }
  return p;
}

/** For `<img src=${still(...)}>`: blank until the still frame is ready. */
export const still = (src: string) => until(stillIcon(src), BLANK);

export class KhWeatherCard extends LitElement {
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const h = config.home;
      return [
        ...config.weather,
        h.outdoorTemperature,
        h.forecast?.sensor,
        h.frog?.status,
        h.frog?.image,
        h.frog?.location,
        h.nextRain,
        "sun.sun",
      ].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: grid;
        gap: var(--kh-gap);
      }
      .now {
        position: relative;
        min-height: 190px;
        padding: 14px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        overflow: hidden;
        color: #fff;
        text-align: left;
        width: 100%;
        box-sizing: border-box;
        background-repeat: no-repeat;
        aspect-ratio: 16 / 7;
      }
      .now img {
        width: 52px;
        height: 52px;
        margin: -6px 0 0 -6px;
      }
      .now .primary {
        font-size: 1rem;
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
      }
      .now .secondary {
        color: rgb(255 255 255 / 0.9);
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
      }
      .rain {
        margin-top: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgb(0 0 0 / 0.25);
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .days {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        padding: 12px 6px;
        text-align: center;
      }
      .day {
        display: grid;
        justify-items: center;
        gap: 2px;
      }
      .day img {
        width: 48px;
        height: 48px;
      }
      .day .t {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .day .low {
        color: var(--kh-text-2);
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .day .name {
        color: var(--kh-text-2);
        font-weight: 600;
        font-size: 0.875rem;
        text-transform: capitalize;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const h = config.home;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    if (!weather) return nothing;
    const night = hass.states["sun.sun"]?.state === "below_horizon";
    const frogStatus = h.frog ? hass.states[h.frog.status]?.state : undefined;
    const frogImage = h.frog ? hass.states[h.frog.image]?.state : undefined;
    const frogPlace = h.frog ? hass.states[h.frog.location]?.state : undefined;
    const rgb = (frogStatus && FROG_RGB[frogStatus]) || "40, 130, 221";
    const shift = frogPlace === "field" ? "20%" : frogPlace === "hills" ? "40%" : "10%";
    // The frog scene sits at the bottom; its sky colour fades into the card above it.
    const background = frogImage?.startsWith("http")
      ? `background-color: rgb(${rgb}); background-image: linear-gradient(to bottom, rgb(${rgb}) 0%, rgba(${rgb}, 0) 40%), url('${frogImage}'); background-size: 100% 100%, max(100%, 520px) auto; background-position: top, ${shift} bottom`
      : `background: rgb(${rgb})`;
    const outdoor = h.outdoorTemperature ? Number(hass.states[h.outdoorTemperature]?.state) : NaN;
    const temp = !isNaN(outdoor) ? outdoor : Number(weather.attributes.temperature);
    const rain = h.nextRain ? hass.states[h.nextRain]?.state : undefined;
    const rainAt = rain && !isNaN(Date.parse(rain)) ? timeFormat.format(new Date(rain)) : undefined;

    const forecastSensor = h.forecast ? hass.states[h.forecast.sensor] : undefined;
    const days = ((forecastSensor?.attributes.forecast?.[h.forecast!.source]?.forecast ?? []) as any[]).slice(0, 5);

    return html`
      <button class="card now" style=${background} @click=${() => openMoreInfo(this, weather.entity_id)}>
        <img src=${weatherIcon(weather.state, night)} alt="" />
        <div>
          <div class="primary">Actuellement : ${stateLabel(hass, weather)}</div>
          <div class="secondary">${isNaN(temp) ? "" : `${formatNumber(temp)} °C`}</div>
          ${rainAt ? html`<div class="rain"><ha-icon icon="mdi:umbrella-outline"></ha-icon>Pluie à ${rainAt}</div>` : nothing}
        </div>
      </button>
      ${days.length
        ? html`<div class="card days" role="list" aria-label="Prévisions sur 5 jours">
            ${days.map(
              (d) => html`<div class="day" role="listitem">
                <span class="name">${dayFormat.format(new Date(d.datetime)).replace(".", "")}</span>
                <img src=${still(weatherIcon(d.condition, false, d.precipitation ?? 0))} alt=${d.condition} />
                <span class="t">${formatNumber(d.temperature, 0)}°</span>
                <span class="low">${d.templow !== undefined ? `${formatNumber(d.templow, 0)}°` : ""}</span>
                <span class="low">${d.wind_speed !== undefined ? `${formatNumber(d.wind_speed, 0)} km/h` : ""}</span>
              </div>`,
            )}
          </div>`
        : nothing}
    `;
  }
}
customElements.define("kh-weather-card", KhWeatherCard);
