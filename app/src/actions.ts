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
        body: confirmBody(entityId, turnOn),
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

function confirmBody(entityId: string, turnOn: boolean): string {
  if (entityId.startsWith("switch.smart_plug_")) {
    return turnOn
      ? "Cette prise alimente du matériel du homelab."
      : "Cette prise alimente du matériel du homelab. L'éteindre coupe tout ce qui y est branché.";
  }
  if (/^switch\..*_sleep$/.test(entityId)) return "L'ordinateur va passer en veille.";
  if (/^switch\..*_reboot$/.test(entityId)) return "L'ordinateur va redémarrer : enregistre ton travail avant.";
  if (entityId.startsWith("switch.wol_")) return "L'ordinateur va démarrer.";
  if (entityId.startsWith("switch.computer_")) {
    return turnOn ? "L'ordinateur va démarrer." : "L'ordinateur va s'éteindre : enregistre ton travail avant.";
  }
  return turnOn ? "L'appareil va s'allumer." : "L'appareil va s'éteindre.";
}

/** Media player commands; the protected guard does not apply to players. */
export type MediaCommand =
  | "media_play_pause"
  | "media_next_track"
  | "media_previous_track"
  | "volume_up"
  | "volume_down"
  | "turn_on"
  | "turn_off";

export async function media(entityId: string, command: MediaCommand): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("media_player.")) return;
  await hass.callService("media_player", command, {}, { entity_id: entityId });
}

export async function setVolume(entityId: string, level: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("media_player.")) return;
  await hass.callService("media_player", "volume_set", { volume_level: Math.min(1, Math.max(0, level)) }, { entity_id: entityId });
}

export async function muteToggle(entityId: string): Promise<void> {
  const hass = store.hass;
  const s = hass?.states[entityId];
  if (!hass || !s || !entityId.startsWith("media_player.")) return;
  await hass.callService("media_player", "volume_mute", { is_volume_muted: !s.attributes.is_volume_muted }, { entity_id: entityId });
}

/** Runs a script (e.g. "Partir"); scripts never target protected plugs here. */
export async function runScript(entityId: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("script.")) return;
  await hass.callService("script", "turn_on", {}, { entity_id: entityId });
}

export async function setAutomation(entityId: string, on: boolean): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("automation.")) return;
  await hass.callService("automation", on ? "turn_on" : "turn_off", {}, { entity_id: entityId });
}

/** Asks an integration to refresh a sensor now (e.g. PC stats). */
export async function refresh(entityIds: string[]): Promise<void> {
  const hass = store.hass;
  if (!hass || entityIds.length === 0) return;
  await hass.callService("homeassistant", "update_entity", {}, { entity_id: entityIds });
}

/** Runs an automation now (e.g. take a PC screenshot). */
export async function triggerAutomation(entityId: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("automation.")) return;
  await hass.callService("automation", "trigger", { skip_condition: true }, { entity_id: entityId });
}

/** Makes a phone ring loudly, even in silent mode ("Trouver mon téléphone"). */
export async function ringPhone(notifyService: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !/^mobile_app_[a-z0-9_]+$/.test(notifyService)) return;
  await hass.callService("notify", notifyService, {
    title: "Trouver mon téléphone",
    message: "Kaoru Home te cherche",
    data: { ttl: 0, priority: "high", channel: "alarm_stream" },
  });
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
