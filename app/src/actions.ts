import { confirmAction } from "./components/confirm-dialog.ts";
import { config } from "./config.ts";
import { matches } from "./rooms.ts";
import { store } from "./store.ts";

// Every service call of the app goes through this module.

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "input_boolean"]);

export function canToggle(entityId: string): boolean {
  return TOGGLE_DOMAINS.has(entityId.split(".")[0]);
}

export function needsConfirmation(entityId: string): boolean {
  return matches(entityId, config.confirm);
}

/** Toggles one entity; returns false when nothing was sent. */
export async function toggle(entityId: string, label: string): Promise<boolean> {
  const hass = store.hass;
  if (!hass || !canToggle(entityId)) return false;

  if (needsConfirmation(entityId)) {
    const isOn = hass.states[entityId]?.state === "on";
    const ok = await confirmAction({
      title: isOn ? `Éteindre ${label} ?` : `Allumer ${label} ?`,
      body: isOn
        ? "Cette prise alimente du matériel du homelab. L'éteindre coupe tout ce qui y est branché."
        : "Cette prise alimente du matériel du homelab.",
      confirmLabel: isOn ? "Éteindre" : "Allumer",
      danger: isOn,
    });
    if (!ok) return false;
  }

  await hass.callService(entityId.split(".")[0], "toggle", {}, { entity_id: entityId });
  return true;
}

/** Room-level action. Lights only: plugs and devices are never grouped. */
export async function setLights(entityIds: readonly string[], on: boolean): Promise<void> {
  const hass = store.hass;
  const lights = entityIds.filter((id) => id.startsWith("light."));
  if (!hass || lights.length === 0) return;
  await hass.callService("light", on ? "turn_on" : "turn_off", {}, { entity_id: lights });
}

/** Brightness of one light, in percent (1-100). */
export async function setBrightness(entityId: string, percent: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.")) return;
  const pct = Math.min(100, Math.max(1, Math.round(percent)));
  await hass.callService("light", "turn_on", { brightness_pct: pct }, { entity_id: entityId });
}

/** Opens Home Assistant's own detail dialog (brightness, colour, history). */
export function openMoreInfo(from: HTMLElement, entityId: string): void {
  from.dispatchEvent(
    new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }),
  );
}
