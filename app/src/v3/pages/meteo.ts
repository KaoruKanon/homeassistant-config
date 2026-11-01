import { css, html, nothing, svg } from "lit";
import { config } from "../../config.ts";
import { stateLabel } from "../../format.ts";
import { EntitiesController, store } from "../../store.ts";
import { COMPASS, beaufort, forecastDays, frogSky, hourFormat, moon, subscribeHourly, sunTimes, windyUrl } from "../../weather-utils.ts";
import { f0, f1, history, linePath, num, resample, type Point } from "../data.ts";
import { icon, weatherIcon, weatherKind } from "../icons.ts";
import { Page } from "../page.ts";

const REFRESH_MS = 10 * 60_000;
/** Where the wind blows to (rotated by its bearing + 180°). */
const windArrow = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M6 10l6-6 6 6"></path></svg>`;
const BUCKETS = 48;

/** Moon phase 0..1 (0 = new moon) and how much of it is lit. */
function moonLight(d = new Date()): number {
  const phase = ((((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588853) % 1) + 1) % 1;
  return Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
}

/**
 * Météo: now over the weather frog's picture, sun and moon, the next hours,
 * seven days with their range, outdoor temperature and humidity over 24 h,
 * and the Windy rain radar. Icons move with the weather.
 */
export class Kh3Meteo extends Page {
  static properties = { ...Page.properties, hourly: { state: true }, curves: { state: true } };
  declare hourly: any[];
  declare curves?: Record<string, Point[]>;
  private unsub?: () => void;
  private timer = 0;

  constructor() {
    super();
    this.hourly = [];
    new EntitiesController(this, () =>
      [
        ...config.weather,
        ...Object.values(config.weatherPage).filter((v): v is string => typeof v === "string"),
        config.home.outdoorTemperature,
        config.home.forecast?.sensor,
        config.home.nextRain,
        config.home.frog?.image,
        config.home.frog?.status,
        config.home.frog?.location,
        "sun.sun",
      ].filter((x): x is string => !!x),
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.unsub = subscribeHourly((h) => (this.hourly = h));
    void this.load();
    this.timer = window.setInterval(() => void this.load(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
    window.clearInterval(this.timer);
  }

  private curveIds(): string[] {
    return [config.home.outdoorTemperature, config.weatherPage.humidity].filter((x): x is string => !!x);
  }

  private async load(): Promise<void> {
    const res = await history(this.curveIds(), 24);
    if (res) this.curves = res;
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .wrap {
        display: grid;
        gap: 14px;
        grid-template-columns: minmax(0, 1fr);
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .h {
        font-size: 17px;
      }

      /* Now, over the frog. */
      .hero {
        position: relative;
        border-radius: 22px;
        overflow: hidden;
        color: #fff;
        min-height: 220px;
      }
      .hero img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .hero .shade {
        position: absolute;
        inset: 0;
        background: linear-gradient(100deg, rgba(10, 10, 30, 0.6), rgba(10, 10, 30, 0.15) 55%, transparent),
          linear-gradient(0deg, rgba(10, 10, 30, 0.45), transparent 40%);
      }
      .hero .now {
        position: absolute;
        left: 24px;
        top: 18px;
        right: 16px;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
      }
      .hero .temp {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 64px;
        font-weight: 700;
        line-height: 1;
      }
      .hero .chips {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 14px;
        display: flex;
        gap: 8px;
      }
      .chip {
        height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(14, 14, 36, 0.66);
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        flex: none;
        scroll-snap-align: start;
      }
      .arrow {
        display: inline-flex;
        transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      /* Sun and moon. */
      .sun svg {
        width: 100%;
        flex: 1;
        min-height: 60px;
      }
      .times {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }

      /* Next hours. */
      .hours {
        padding: 12px 16px;
        justify-content: center;
      }
      .hour {
        flex: none;
        width: 68px;
        padding: 8px 0;
        border-radius: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        color: var(--blue);
        scroll-snap-align: start;
      }
      .hour:first-child {
        background: var(--surf2);
      }
      .hour .num {
        color: var(--ink);
      }
      .rainy {
        color: var(--blue) !important;
        font-weight: 700;
      }

      /* Seven days. */
      .day {
        display: grid;
        grid-template-columns: 44px 28px 34px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-height: 32px;
        color: var(--blue);
      }
      .day > span:first-child,
      .day .hi {
        color: var(--ink);
      }
      .range {
        height: 6px;
        border-radius: 99px;
        background: var(--surf2);
        position: relative;
      }
      .range i {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 99px;
        background: linear-gradient(90deg, var(--blue), var(--amber));
      }

      /* 24 h. */
      .curves svg {
        flex: 1;
        width: 100%;
        min-height: 110px;
        display: block;
      }
      .legend {
        display: flex;
        gap: 14px;
        font-size: 12px;
        color: var(--muted);
        flex-wrap: wrap;
      }
      .legend span {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .legend i {
        width: 12px;
        height: 3px;
        border-radius: 2px;
      }
      .axis {
        display: flex;
        justify-content: space-between;
      }

      /* Radar. */
      .radar iframe {
        flex: 1;
        width: 100%;
        min-height: 360px;
        border: 0;
        border-radius: 14px;
        display: block;
        background: var(--surf2);
      }

      /* Medium: two columns. */
      @container (min-width: 600px) {
        .wrap {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .hero,
        .hours,
        .radar {
          grid-column: 1 / 3;
        }
      }
      /* Wall tablet and desktop: one screen. */
      @container (min-width: 1000px) {
        .wrap {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 340px;
          grid-template-rows: 220px 150px minmax(320px, auto);
        }
        .hero {
          grid-column: 1 / 3;
          grid-row: 1;
        }
        .sun {
          grid-column: 3;
          grid-row: 1;
        }
        .hours {
          grid-column: 1 / 4;
          grid-row: 2;
        }
        .days {
          grid-column: 1;
          grid-row: 3;
        }
        .curves {
          grid-column: 2;
          grid-row: 3;
        }
        .radar {
          grid-column: 3;
          grid-row: 3;
        }
        .radar iframe {
          min-height: 0;
        }
        @media (min-height: 720px) {
          .wrap {
            height: calc(100vh - 32px);
            height: calc(100dvh - 32px);
            grid-template-rows: 220px 150px minmax(0, 1fr);
          }
        }
      }
      /* Phone: chips and hours swipe. */
      @container (max-width: 599px) {
        .hero {
          min-height: 240px;
        }
        .hero .temp {
          font-size: 54px;
        }
        .hero .chips {
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
        }
        .hours {
          padding: 10px;
        }
      }
    `,
  ];

  private hero() {
    const hass = store.hass!;
    const w = config.weatherPage;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const temp = num(config.home.outdoorTemperature) ?? (weather ? Number(weather.attributes.temperature) : undefined);
    const feels = num(w.feelsLike) ?? (weather ? Number(weather.attributes.apparent_temperature) : undefined);
    const hum = num(w.humidity), wind = num(w.windSpeed), bearing = num(w.windBearing);
    const rain = num(w.rainChance), clouds = num(w.cloudCover), uv = num(w.uv);
    const { day } = sunTimes();
    const frog = config.home.frog;
    const image = frog ? hass.states[frog.image]?.state : undefined;
    const place = frog ? hass.states[frog.location]?.state : undefined;
    const shift = place === "field" ? "20%" : place === "hills" ? "40%" : "10%";
    const dir = bearing !== undefined ? COMPASS[Math.round(bearing / 45) % 8] : "";
    const next = config.home.nextRain ? Date.parse(hass.states[config.home.nextRain]?.state ?? "") : NaN;
    const rainAt = !isNaN(next) && next > Date.now() ? hourFormat.format(new Date(next)) : "";
    const [moonLabel] = moon();
    const label = weather ? stateLabel(hass, weather) : "";
    return html`<section class="hero" aria-label="Maintenant" style="background:rgb(${frogSky()})">
      ${image && /^(https?:)?\//.test(image) ? html`<img src=${image} alt="" width="1280" height="440" decoding="async" fetchpriority="high" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} style="object-position:${shift} 75%" />` : nothing}
      <span class="shade"></span>
      <div class="now">
        <div class="temp num">${temp !== undefined && !isNaN(temp) ? `${f1(temp)}°` : "—"}${weather ? weatherIcon(weatherKind(weather.state, !day), 44) : nothing}</div>
        <div style="font-size:18px;font-weight:600;margin-top:4px">${label}</div>
        <div style="font-size:13px;opacity:.92">${[feels !== undefined && !isNaN(feels) ? `Ressenti ${f1(feels)}°` : "", hum !== undefined ? `humidité ${f0(hum)} %` : ""].filter(Boolean).join(", ")}</div>
      </div>
      <div class="chips" role="list" aria-label="Conditions">
        ${wind !== undefined
          ? html`<span class="chip" role="listitem">${icon("wind", 16)}Vent ${f0(wind)} km/h${dir ? html`, ${dir}
                <span class="arrow" style="transform:rotate(${(bearing ?? 0) + 180}deg)" aria-hidden="true">${windArrow}</span>` : nothing}
              <span class="sr">, force ${beaufort(wind)}</span></span>`
          : nothing}
        ${rain !== undefined ? html`<span class="chip" role="listitem">${icon("umbrella", 16)}Pluie ${f0(rain)} %${rainAt ? `, vers ${rainAt}` : ""}</span>` : nothing}
        ${clouds !== undefined ? html`<span class="chip" role="listitem">${icon("cloud", 16)}Nuages ${f0(clouds)} %</span>` : nothing}
        ${day && uv !== undefined
          ? html`<span class="chip" role="listitem">${icon("sun", 16)}UV ${f0(uv)}</span>`
          : html`<span class="chip" role="listitem">${icon("moon", 16)}${moonLabel}</span>`}
      </div>
    </section>`;
  }

  private sun() {
    const { rise, set } = sunTimes();
    const ok = !isNaN(rise) && !isNaN(set);
    const now = Date.now();
    const f = ok ? Math.min(1, Math.max(0, (now - rise) / (set - rise))) : 0;
    const up = ok && now > rise && now < set;
    // Quadratic arc from (10,80) to (290,80), control (150,-20): the sun on it.
    const x = (1 - f) ** 2 * 10 + 2 * (1 - f) * f * 150 + f * f * 290;
    const y = (1 - f) ** 2 * 80 + 2 * (1 - f) * f * -20 + f * f * 80;
    const length = ok ? set - rise : 0;
    const [moonLabel] = moon();
    return html`<section class="card sun" aria-label="Soleil et lune">
      <h2 class="h">Soleil et lune</h2>
      <svg viewBox="0 0 300 90" role="img" aria-label=${up ? "Le soleil est levé" : "Le soleil est couché"}>
        <line x1="0" x2="300" y1="80" y2="80" style="stroke:var(--surf2);stroke-width:2"></line>
        <path d="M10 80 Q150 -20 290 80" style="fill:none;stroke:var(--muted);stroke-opacity:.45;stroke-width:3;stroke-dasharray:5 6"></path>
        ${up
          ? svg`<path d="M10 80 Q${10 + (150 - 10) * f} ${80 - 100 * f} ${x} ${y}" style="fill:none;stroke:var(--amber);stroke-width:3"></path>
              <circle class="kh-pulse" cx=${x} cy=${y} r="9" style="fill:var(--amber);transform-box:fill-box;transform-origin:center"></circle>`
          : svg`<circle cx="290" cy="80" r="7" style="fill:var(--muted);opacity:.6"></circle>`}
      </svg>
      <div class="times">
        <span>Lever <span class="num" style="font-weight:700">${ok ? hourFormat.format(new Date(rise)) : "—"}</span></span>
        <span>Coucher <span class="num" style="font-weight:700">${ok ? hourFormat.format(new Date(set)) : "—"}</span></span>
      </div>
      <p class="st">${length > 0 ? `${Math.floor(length / 3600000)} h ${String(Math.round((length % 3600000) / 60000)).padStart(2, "0")} de jour. ` : ""}${moonLabel}, éclairée à ${moonLight()} %</p>
    </section>`;
  }

  private hours() {
    const { isNight } = sunTimes();
    if (!this.hourly.length) {
      return html`<section class="card hours" aria-label="Prochaines heures"><p class="empty">Prévisions heure par heure indisponibles pour le moment.</p></section>`;
    }
    return html`<section class="card hours" aria-label="Prochaines heures">
      <div class="hs" role="list">
        ${this.hourly.map((h, i) => {
          const t = Date.parse(h.datetime);
          const night = h.is_daytime === undefined ? isNight(t) : !h.is_daytime;
          const p = h.precipitation_probability as number | undefined;
          const time = i === 0 ? "Maint." : hourFormat.format(new Date(t));
          return html`<div class="hour" role="listitem" aria-label="${i === 0 ? "Maintenant" : time}, ${f0(h.temperature)} degrés${p !== undefined ? `, pluie ${p} %` : ""}">
            <span class="st" aria-hidden="true">${time}</span>
            ${weatherIcon(weatherKind(h.condition, night), 26)}
            <span class="num" style="font-size:17px;font-weight:700" aria-hidden="true">${f0(h.temperature)}°</span>
            <span class="st num ${p !== undefined && p >= 30 ? "rainy" : ""}" aria-hidden="true">${p !== undefined ? `${p} %` : ""}</span>
          </div>`;
        })}
      </div>
    </section>`;
  }

  private days() {
    // The daily forecast says "clear-night" for clear days: a day icon is wanted here.
    const days = forecastDays(7).map((d) => ({ ...d, condition: d.condition === "clear-night" ? "sunny" : d.condition }));
    if (!days.length) return html`<section class="card days" aria-label="Sept jours"><h2 class="h">Sept jours</h2><p class="empty">Pas de prévisions pour le moment.</p></section>`;
    const lo = Math.min(...days.map((d) => d.templow ?? d.temperature));
    const hi = Math.max(...days.map((d) => d.temperature));
    const span = Math.max(1, hi - lo);
    return html`<section class="card days" aria-label="Sept jours">
      <h2 class="h">Sept jours</h2>
      <div role="list" style="display:flex;flex-direction:column;flex:1;gap:2px">
        ${days.map((d, i) => {
          const low = d.templow ?? d.temperature;
          const name = i === 0 ? "Auj." : d.day.replace(/^./, (c) => c.toUpperCase());
          return html`<div class="day" role="listitem" aria-label="${i === 0 ? "Aujourd'hui" : name}, de ${f0(low)} à ${f0(d.temperature)} degrés">
            <span style="font-weight:600" aria-hidden="true">${name}</span>
            <span style="display:grid;place-items:center">${weatherIcon(weatherKind(d.condition, false), 24)}</span>
            <span class="num st" style="text-align:right;font-size:14px" aria-hidden="true">${f0(low)}°</span>
            <span class="range" aria-hidden="true"><i style="left:${((low - lo) / span) * 100}%;right:${100 - ((d.temperature - lo) / span) * 100}%"></i></span>
            <span class="num hi" style="font-weight:700;font-size:14px" aria-hidden="true">${f0(d.temperature)}°</span>
          </div>`;
        })}
      </div>
    </section>`;
  }

  private curvesCard() {
    const [tId, hId] = [config.home.outdoorTemperature, config.weatherPage.humidity];
    if (!tId && !hId) return nothing;
    const to = Date.now(), from = to - 24 * 3600_000;
    const temps = tId && this.curves?.[tId]?.length ? resample(this.curves[tId], from, to, BUCKETS) : [];
    const hums = hId && this.curves?.[hId]?.length ? resample(this.curves[hId], from, to, BUCKETS) : [];
    const known = temps.filter((v): v is number => v !== undefined);
    const W = 300, H = 160, top = 12, bottom = 8;
    const tMin = known.length ? Math.min(...known) : 0, tMax = known.length ? Math.max(...known) : 1;
    const pad = Math.max(0.5, (tMax - tMin) * 0.12);
    const yT = (v: number) => top + (1 - (v - (tMin - pad)) / (tMax - tMin + 2 * pad)) * (H - top - bottom);
    const yH = (v: number) => top + (1 - v / 100) * (H - top - bottom);
    const pts = (arr: (number | undefined)[], y: (v: number) => number) =>
      arr.flatMap((v, i) => (v === undefined ? [] : [{ x: (i / (BUCKETS - 1)) * W, y: y(v) }]));
    const tp = pts(temps, yT), hp = pts(hums, yH);
    const tLine = linePath(tp);
    const axis = [24, 18, 12, 6, 0].map((h) => (h === 0 ? "maint." : `${new Date(to - h * 3600_000).getHours()} h`));
    const tNow = num(tId), hNow = num(hId);
    return html`<section class="card curves" aria-label="Dehors sur 24 heures">
      <div class="card-head"><h2 class="h">Dehors sur 24 h</h2>
        ${known.length ? html`<span class="st num">min ${f1(tMin)}°, max ${f1(tMax)}°</span>` : nothing}</div>
      ${tp.length < 2 && hp.length < 2
        ? html`<p class="empty" style="flex:1">Pas encore d'historique.</p>`
        : html`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
              aria-label="Température de ${f1(tMin)} à ${f1(tMax)} degrés sur 24 heures${hNow !== undefined ? `, humidité ${f0(hNow)} % maintenant` : ""}">
              ${tp.length > 1
                ? svg`<path d="${tLine} L${tp[tp.length - 1].x} ${H} L${tp[0].x} ${H} Z" style="fill:var(--amberTint)"></path>
                    <path d=${tLine} vector-effect="non-scaling-stroke" style="fill:none;stroke:var(--amber);stroke-width:3;stroke-linecap:round"></path>`
                : nothing}
              ${hp.length > 1
                ? svg`<path d=${linePath(hp)} vector-effect="non-scaling-stroke" style="fill:none;stroke:var(--blue);stroke-width:2;stroke-dasharray:4 4"></path>`
                : nothing}
            </svg>
            <div class="axis st num" aria-hidden="true">${axis.map((a) => html`<span>${a}</span>`)}</div>`}
      <div class="legend">
        ${tId ? html`<span><i style="background:var(--amber)"></i>Température${tNow !== undefined ? html` <b class="num" style="color:var(--ink)">${f1(tNow)}°</b>` : nothing}</span>` : nothing}
        ${hId ? html`<span><i style="background:var(--blue)"></i>Humidité${hNow !== undefined ? html` <b class="num" style="color:var(--ink)">${f0(hNow)} %</b>` : nothing}</span>` : nothing}
      </div>
    </section>`;
  }

  private radar() {
    const w = config.weatherPage.windy;
    if (!w) return nothing;
    return html`<section class="card radar" aria-label="Radar de pluie">
      <div class="card-head"><h2 class="h">Radar pluie</h2><span class="st">Windy</span></div>
      <iframe title="Radar de pluie Windy" loading="lazy" src=${windyUrl(w.lat, w.lon)} referrerpolicy="no-referrer"></iframe>
    </section>`;
  }

  render() {
    if (!store.hass) return nothing;
    return html`<h1 class="sr">Météo</h1>
      <div class="wrap">${this.hero()}${this.sun()}${this.hours()}${this.days()}${this.curvesCard()}${this.radar()}</div>`;
  }
}
customElements.define("kh3-meteo", Kh3Meteo);
