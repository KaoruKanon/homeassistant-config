import { nothing, svg } from "lit";
import { config } from "./config.ts";
import { store } from "./store.ts";

// Weather helpers shared by the Météo pages of V1 and V2.

export const hourFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/** Beaufort force from km/h. */
export function beaufort(kmh: number): number {
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

/** Today's moon: [label, icon]. */
export function moon(): [string, string] {
  const m = MOON.find(([max]) => moonPhase() < max)!;
  return [m[1], m[2]];
}

/** Today's sunrise and sunset, and a night test for forecast hours. */
export function sunTimes() {
  const sun = store.hass?.states["sun.sun"];
  const day = sun?.state === "above_horizon";
  const nextRise = Date.parse(sun?.attributes.next_rising ?? "");
  const nextSet = Date.parse(sun?.attributes.next_setting ?? "");
  // Today's rise from the next one (yesterday's + 24 h if the sun is up).
  const rise = day ? nextRise - 86400000 : nextRise;
  const isNight = (t: number) =>
    isNaN(nextRise) || isNaN(nextSet) ? false : nextSet < nextRise ? t >= nextSet && t < nextRise : t < nextRise || t >= nextSet;
  return { day, rise, set: nextSet, isNight };
}

/** Sun course today: dawn to dusk arc, the sun where it is now. */
export function sunArc(rise: number, set: number) {
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

/** Hourly forecast (next 16 h); returns the unsubscribe function. */
export function subscribeHourly(onForecast: (hours: any[]) => void): () => void {
  const id = config.weatherPage.hourly;
  const conn = store.hass?.connection;
  if (!id || !conn?.subscribeMessage) return () => {};
  const unsub = conn.subscribeMessage<{ forecast: any[] }>((m) => onForecast((m.forecast ?? []).slice(0, 16)), {
    type: "weather/subscribe_forecast",
    entity_id: id,
    forecast_type: "hourly",
  });
  unsub.catch(() => onForecast([]));
  return () => void unsub.then((u) => u()).catch(() => {});
}

/** Windy radar embed for the house. */
export function windyUrl(lat: number, lon: number): string {
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=8&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=&calendar=now&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=%C2%B0C`;
}

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/** Next days from the forecast sensor of the home view (config.home.forecast). */
export function forecastDays(count = 5): { day: string; condition: string; temperature: number; templow?: number; precipitation?: number; wind?: number }[] {
  const f = config.home.forecast;
  const s = f ? store.hass?.states[f.sensor] : undefined;
  return ((s?.attributes.forecast?.[f!.source]?.forecast ?? []) as any[]).slice(0, count).map((d) => ({
    day: dayFormat.format(new Date(d.datetime)).replace(".", ""),
    condition: d.condition,
    temperature: d.temperature,
    templow: d.templow,
    precipitation: d.precipitation,
    wind: d.wind_speed,
  }));
}

/** Sky colour ("r, g, b") of each weather frog scene, as in the frog's own pictures. */
export const FROG_SKY: Record<string, string> = {
  sunny: "24, 159, 215", "mostly-sunny": "68, 176, 214", "partly-cloudy-day": "100, 165, 208", "mostly-cloudy-day": "114, 164, 209",
  "clear-night": "124, 76, 242", "mostly-clear": "133, 109, 229", "partly-cloudy-night": "137, 135, 218", "mostly-cloudy-night": "144, 152, 213",
  cloudy: "145, 169, 206", drizzle: "126, 172, 216", rainy: "40, 130, 221", snowy: "109, 144, 152", lightning: "162, 84, 130", fog: "184, 168, 168", hail: "103, 143, 164",
};

/** The sky colour of the weather frog of the moment. */
export function frogSky(): string {
  const status = config.home.frog ? store.hass?.states[config.home.frog.status]?.state : undefined;
  return (status && FROG_SKY[status]) || "40, 130, 221";
}
