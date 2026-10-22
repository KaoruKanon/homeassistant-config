import { confirmAction } from "./components/confirm-dialog.ts";
import { config } from "./config.ts";
import { matches } from "./rooms.ts";
import { store } from "./store.ts";

// Every service call of the app goes through this module.

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "input_boolean"]);

/** Entities protected because of their device (set from the house model). */
let protectedByDevice: ReadonlySet<string> = new Set();

export function setProtectedEntities(ids: ReadonlySet<string>): void {
  protectedByDevice = ids;
}

export function canToggle(entityId: string): boolean {
  return TOGGLE_DOMAINS.has(entityId.split(".")[0]);
}

export function needsConfirmation(entityId: string): boolean {
  return matches(entityId, config.confirm) || protectedByDevice.has(entityId);
}

/**
 * Turns one entity on or off, from the state the person saw. Sends an
 * explicit turn_on / turn_off, never a toggle, so a state that changed in the
 * meantime cannot be flipped the wrong way. Returns false when nothing was sent.
 */
export async function toggle(entityId: string, label: string): Promise<boolean> {
  const seen = store.hass?.states[entityId]?.state;
  if (!store.hass || !canToggle(entityId) || seen === undefined || seen === "unavailable") return false;
  const turnOn = seen !== "on";

  if (needsConfirmation(entityId)) {
    const ok = await confirmAction(
      {
        title: turnOn ? `Allumer ${label} ?` : `Éteindre ${label} ?`,
        body: turnOn
          ? "Cette prise alimente du matériel du homelab."
          : "Cette prise alimente du matériel du homelab. L'éteindre coupe tout ce qui y est branché.",
        confirmLabel: turnOn ? "Allumer" : "Éteindre",
        danger: !turnOn,
      },
      entityId,
    );
    if (!ok) return false;
  }

  // Re-read after the (possibly long) confirmation: act only on the state the person saw.
  const hass = store.hass;
  if (!hass || hass.states[entityId]?.state !== seen) return false;
  await hass.callService(entityId.split(".")[0], turnOn ? "turn_on" : "turn_off", {}, { entity_id: entityId });
  return true;
}

/** Room-level action. Unprotected lights only: plugs and devices are never grouped. */
export async function setLights(entityIds: readonly string[], on: boolean): Promise<void> {
  const hass = store.hass;
  const lights = entityIds.filter((id) => id.startsWith("light.") && !needsConfirmation(id));
  if (!hass || lights.length === 0) return;
  await hass.callService("light", on ? "turn_on" : "turn_off", {}, { entity_id: lights });
}

/** Brightness of one light, in percent (1-100). */
export async function setBrightness(entityId: string, percent: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.") || needsConfirmation(entityId)) return;
  const pct = Math.min(100, Math.max(1, Math.round(percent)));
  await hass.callService("light", "turn_on", { brightness_pct: pct }, { entity_id: entityId });
}

/**
 * Opens Home Assistant's own detail dialog (brightness, colour, history).
 * Not for protected entities: that dialog has its own unguarded switch.
 */
export function openMoreInfo(from: HTMLElement, entityId: string): void {
  if (needsConfirmation(entityId)) return;
  from.dispatchEvent(
    new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }),
  );
}
