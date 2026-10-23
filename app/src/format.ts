import { html, nothing } from "lit";
import type { HassEntity, HomeAssistant } from "./types.ts";

const ACTIVE_STATES = new Set(["on", "open", "playing", "paused", "home", "heat", "cool"]);

export const isActive = (s?: HassEntity) => !!s && ACTIVE_STATES.has(s.state);
export const isUnavailable = (s?: HassEntity) => !s || s.state === "unavailable";

// French labels, whatever the language of the HA profile (the panel is French).
const WEATHER_FR: Record<string, string> = {
  "clear-night": "Nuit claire", cloudy: "Nuageux", exceptional: "Exceptionnel", fog: "Brouillard", hail: "Grêle",
  lightning: "Orage", "lightning-rainy": "Orage et pluie", partlycloudy: "Éclaircies", pouring: "Averses",
  rainy: "Pluvieux", snowy: "Neige", "snowy-rainy": "Pluie et neige", sunny: "Ensoleillé", windy: "Venteux",
  "windy-variant": "Venteux et nuageux",
};
const STATE_FR: Record<string, string> = {
  on: "Allumé", off: "Éteint", home: "À la maison", not_home: "Absent", playing: "En lecture", paused: "En pause",
  idle: "Inactif", standby: "En veille", buffering: "Chargement", open: "Ouvert", closed: "Fermé", unknown: "Inconnu",
  armed_away: "Armée (absence)", armed_home: "Armée (présence)", disarmed: "Désarmée", triggered: "Déclenchée",
  pending: "En attente", arming: "Activation", active: "En cours",
};
const BINARY_FR: Record<string, [string, string]> = {
  window: ["Ouverte", "Fermée"], door: ["Ouverte", "Fermée"], opening: ["Ouvert", "Fermé"], garage_door: ["Ouverte", "Fermée"],
  motion: ["Mouvement", "Calme"], occupancy: ["Occupé", "Libre"], presence: ["Présent", "Absent"], plug: ["Branché", "Débranché"],
  battery_charging: ["En charge", "Pas en charge"], connectivity: ["Connecté", "Déconnecté"], moisture: ["Humide", "Sec"],
  smoke: ["Fumée", "Rien"], problem: ["Problème", "OK"], running: ["En marche", "Arrêté"],
};

export function stateLabel(hass: HomeAssistant, s?: HassEntity): string {
  if (!s) return "Introuvable";
  if (s.state === "unavailable") return "Indisponible";
  const domain = s.entity_id.split(".")[0];
  if (domain === "weather") return WEATHER_FR[s.state] ?? s.state;
  if (domain === "binary_sensor") {
    const pair = BINARY_FR[s.attributes.device_class as string];
    if (pair && (s.state === "on" || s.state === "off")) return s.state === "on" ? pair[0] : pair[1];
  }
  if (domain === "sensor" || domain === "number" || domain === "input_number") {
    return hass.formatEntityState?.(s) ?? s.state; // numbers and units: HA formats them well
  }
  return STATE_FR[s.state] ?? hass.formatEntityState?.(s) ?? s.state;
}

const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, digits = 1): string {
  let f = numberFormats.get(digits);
  if (!f) numberFormats.set(digits, (f = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits })));
  return f.format(value);
}

/** Numeric state of a sensor, formatted, or undefined when not a number. */
export function sensorValue(hass: HomeAssistant, entityId?: string, digits = 1): string | undefined {
  const s = entityId ? hass.states[entityId] : undefined;
  if (!s || s.state === "" || isNaN(Number(s.state))) return undefined;
  return formatNumber(Number(s.state), digits);
}

// Default icons that read well at a glance; an icon set in HA always wins.
const DOMAIN_ICONS: Record<string, [on: string, off: string]> = {
  light: ["mdi:lightbulb-on", "mdi:lightbulb-outline"],
  switch: ["mdi:power-plug", "mdi:power-plug-outline"],
  fan: ["mdi:fan", "mdi:fan"],
};

export function stateIcon(hass: HomeAssistant, s?: HassEntity) {
  if (!s) return nothing;
  const pair = DOMAIN_ICONS[s.entity_id.split(".")[0]];
  if (pair && !s.attributes.icon) return html`<ha-icon icon=${isActive(s) ? pair[0] : pair[1]}></ha-icon>`;
  return html`<ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>`;
}

/** A light whose brightness can be set (anything but on/off only). */
export function isDimmable(s?: HassEntity): boolean {
  if (!s || !s.entity_id.startsWith("light.")) return false;
  const modes = (s.attributes.supported_color_modes as string[] | undefined) ?? [];
  return modes.some((m) => m !== "onoff");
}

/** Current brightness in percent, or undefined when off or unknown. */
export function brightnessPercent(s?: HassEntity): number | undefined {
  const b = s?.attributes.brightness;
  return typeof b === "number" ? Math.max(1, Math.round((b / 255) * 100)) : undefined;
}
