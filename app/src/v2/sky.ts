import { config } from "../config.ts";
import { store } from "../store.ts";

/**
 * The sky outside, from the weather entity and the sun: what the plan's
 * windows show, and how strong and warm the sunlight coming in is.
 */
export interface Sky {
  /** Colour seen through the windows. */
  window: string;
  /** How much the windows glow (0..1). */
  glow: number;
  /** Sunlight: colour, strength (0..2.4), share of it that makes sun patches on the floor (0..1). */
  sunColor: string;
  sun: number;
  beam: number;
  /** Ambient light of the scene (0..1). */
  ambient: number;
  /** Sun position: compass bearing and elevation, in degrees. */
  azimuth: number;
  elevation: number;
}

const DAY: Record<string, [string, number, number]> = {
  // condition: window colour, sun strength factor, sun patch factor
  sunny: ["#7cc6ff", 1, 1],
  "clear-night": ["#1b2350", 0, 0],
  partlycloudy: ["#a3cbec", 0.75, 0.6],
  cloudy: ["#b4bec8", 0.4, 0.12],
  fog: ["#c9cfd4", 0.35, 0.05],
  rainy: ["#7d8a99", 0.3, 0],
  pouring: ["#66727f", 0.22, 0],
  "lightning-rainy": ["#5d6178", 0.22, 0],
  lightning: ["#6b6f8a", 0.3, 0],
  snowy: ["#e3ebf2", 0.5, 0.1],
  "snowy-rainy": ["#c8d2dc", 0.35, 0],
  hail: ["#aab4be", 0.3, 0],
  windy: ["#8fc3e8", 0.85, 0.7],
  "windy-variant": ["#a3cbec", 0.7, 0.5],
  exceptional: ["#9aa3ad", 0.4, 0],
};

export function currentSky(): Sky {
  const hass = store.hass;
  const sun = hass?.states["sun.sun"];
  const elevation = Number(sun?.attributes.elevation ?? (sun?.state === "above_horizon" ? 30 : -20));
  const azimuth = Number(sun?.attributes.azimuth ?? 180);
  const weather = config.weather.map((id) => hass?.states[id]).find((s) => s && s.state !== "unavailable");
  const [dayColor, strength, patch] = DAY[weather?.state ?? "sunny"] ?? DAY.sunny;

  if (elevation < -4) return { window: "#1b2350", glow: 0.25, sunColor: "#7f8cff", sun: 0.22, beam: 0, ambient: 0.14, azimuth, elevation };
  // Dawn and dusk: an orange sky, a low warm sun.
  const low = Math.max(0, Math.min(1, (elevation + 4) / 12)); // 0 at -4°, 1 at 8°
  const window = low < 1 ? mix("#ff9a6b", dayColor, low) : dayColor;
  const sunColor = elevation < 10 ? mix("#ffad5c", "#fff4e0", Math.max(0, elevation) / 10) : "#fff4e0";
  const height = Math.max(0, Math.min(1, elevation / 20));
  return {
    window,
    glow: 0.35 + 0.35 * low,
    sunColor,
    sun: 0.35 + 2 * strength * low * (0.4 + 0.6 * height),
    beam: patch * low * Math.min(1, Math.max(0, elevation) / 6),
    ambient: 0.18 + 0.2 * low,
    azimuth,
    elevation,
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}
