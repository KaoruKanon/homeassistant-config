import { html, nothing } from "lit";
import type { HassEntity, HomeAssistant } from "./types.ts";

const ACTIVE_STATES = new Set(["on", "open", "playing", "paused", "home", "heat", "cool"]);

export const isActive = (s?: HassEntity) => !!s && ACTIVE_STATES.has(s.state);
export const isUnavailable = (s?: HassEntity) => !s || s.state === "unavailable";

export function stateLabel(hass: HomeAssistant, s?: HassEntity): string {
  if (!s) return "Introuvable";
  if (s.state === "unavailable") return "Indisponible";
  return hass.formatEntityState?.(s) ?? s.state;
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
