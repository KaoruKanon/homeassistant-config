import { confirmAction } from "./components/confirm-dialog.ts";
import { inFrench, showToast } from "./components/toast.ts";
import { config } from "./config.ts";
import { matches } from "./rooms.ts";
import { store } from "./store.ts";

// Every service call of the app goes through this module, and its errors end
// as a toast at the top, in French (not HA's English toast at the bottom).

/** Calls a service; on failure shows why and returns false. */
async function call(domain: string, service: string, data: Record<string, unknown> = {}, target?: Record<string, unknown>): Promise<boolean> {
  const hass = store.hass;
  if (!hass) return false;
  try {
    await hass.callService(domain, service, data, target, false);
    return true;
  } catch (err) {
    const message = (err as { message?: string })?.message ?? String(err);
    showToast({ kind: "error", message: inFrench(message) });
    return false;
  }
}

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

  // A PC starts on a tap; only switching it off asks first.
  const askFirst = needsConfirmation(entityId) && !(turnOn && matches(entityId, config.confirmOffOnly ?? []));
  if (askFirst) {
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
  await call(entityId.split(".")[0], turnOn ? "turn_on" : "turn_off", {}, { entity_id: entityId });
  if (matches(entityId, config.confirmOffOnly ?? [])) markPending(entityId, turnOn);
  return true;
}

/**
 * Devices that take a while to change (a PC starting or shutting down):
 * what was asked and when, until the state follows (or 3 minutes pass).
 */
const pending = new Map<string, { on: boolean; since: number }>();
const PENDING_MS = 180_000;

function markPending(entityId: string, on: boolean): void {
  pending.set(entityId, { on, since: Date.now() });
  window.dispatchEvent(new CustomEvent("kh-pending", { detail: entityId }));
  // Views waiting on it are told when the wait runs out, even if the state never changes.
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("kh-pending", { detail: entityId })), PENDING_MS + 500);
}

/** True while a start or a stop asked from here is still under way. */
export function isPending(entityId: string): boolean {
  const p = pending.get(entityId);
  if (!p) return false;
  const reached = isActiveState(store.hass?.states[entityId]?.state) === p.on;
  if (reached || Date.now() - p.since > PENDING_MS) {
    pending.delete(entityId);
    return false;
  }
  return true;
}

const isActiveState = (state?: string) => state === "on";

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
  await call("media_player", command, {}, { entity_id: entityId });
}

export async function setVolume(entityId: string, level: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("media_player.")) return;
  await call("media_player", "volume_set", { volume_level: Math.min(1, Math.max(0, level)) }, { entity_id: entityId });
}

export async function muteToggle(entityId: string): Promise<void> {
  const hass = store.hass;
  const s = hass?.states[entityId];
  if (!hass || !s || !entityId.startsWith("media_player.")) return;
  await call("media_player", "volume_mute", { is_volume_muted: !s.attributes.is_volume_muted }, { entity_id: entityId });
}

/** Runs a script (e.g. "Partir"); scripts never target protected plugs here. */
export async function runScript(entityId: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("script.")) return;
  await call("script", "turn_on", {}, { entity_id: entityId });
}

export async function setAutomation(entityId: string, on: boolean): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("automation.")) return;
  await call("automation", on ? "turn_on" : "turn_off", {}, { entity_id: entityId });
}

/** Asks an integration to refresh a sensor now (e.g. PC stats). */
export async function refresh(entityIds: string[]): Promise<void> {
  const hass = store.hass;
  if (!hass || entityIds.length === 0) return;
  await call("homeassistant", "update_entity", {}, { entity_id: entityIds });
}

/** Runs an automation now (e.g. take a PC screenshot). */
export async function triggerAutomation(entityId: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("automation.")) return;
  await call("automation", "trigger", { skip_condition: true }, { entity_id: entityId });
}

export type AlarmMode = "arm_away" | "arm_home" | "arm_night" | "arm_vacation" | "disarm";

/** Arms or disarms the alarm, with the code when it asks for one. */
export async function setAlarm(entityId: string, mode: AlarmMode, code?: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("alarm_control_panel.")) return;
  await call("alarm_control_panel", `alarm_${mode}`, code ? { code } : {}, { entity_id: entityId });
}

/** Makes a phone ring loudly, even in silent mode ("Trouver mon téléphone"). */
export async function ringPhone(notifyService: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !/^mobile_app_[a-z0-9_]+$/.test(notifyService)) return;
  await call("notify", notifyService, {
    title: "Trouver mon téléphone",
    message: "Kaoru Home te cherche",
    data: { ttl: 0, priority: "high", channel: "alarm_stream" },
  });
}

/** One key of a TV box remote (DPAD_UP, BACK, HOME...). */
export async function remoteKey(remote: string, command: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !remote.startsWith("remote.")) return;
  await call("remote", "send_command", { command }, { entity_id: remote });
}

/** Opens an app on a TV box (YouTube, Netflix...). */
export async function remoteApp(remote: string, activity: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !remote.startsWith("remote.")) return;
  await call("remote", "turn_on", { activity }, { entity_id: remote });
}

export async function setFanSpeed(fan: string, percentage: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !fan.startsWith("fan.")) return;
  await call("fan", "set_percentage", { percentage: Math.round(percentage) }, { entity_id: fan });
}

export async function setFanOscillation(fan: string, oscillating: boolean): Promise<void> {
  const hass = store.hass;
  if (!hass || !fan.startsWith("fan.")) return;
  await call("fan", "oscillate", { oscillating }, { entity_id: fan });
}

/** Presses an HA button entity (e.g. reload the tablet browser). */
export async function pressButton(entityId: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("button.")) return;
  await call("button", "press", {}, { entity_id: entityId });
}

export async function setNumber(entityId: string, value: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("number.")) return;
  await call("number", "set_value", { value }, { entity_id: entityId });
}

/** Restarts Home Assistant, after an explicit confirmation. */
export async function restartHomeAssistant(): Promise<boolean> {
  const hass = store.hass;
  if (!hass?.user?.is_admin) return false;
  const ok = await confirmAction({
    title: "Redémarrer Home Assistant ?",
    body: "La maison ne répondra plus pendant une à deux minutes.",
    confirmLabel: "Redémarrer",
    danger: true,
  });
  if (!ok) return false;
  await call("homeassistant", "restart", {});
  return true;
}

/** Room-level action. Unprotected lights only: plugs and devices are never grouped. */
export async function setLights(entityIds: readonly string[], on: boolean): Promise<void> {
  const hass = store.hass;
  const lights = entityIds.filter((id) => id.startsWith("light.") && !needsConfirmation(id));
  if (!hass || lights.length === 0) return;
  await call("light", on ? "turn_on" : "turn_off", {}, { entity_id: lights });
}

/** Brightness of one light, in percent (1-100). */
export async function setBrightness(entityId: string, percent: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.") || needsConfirmation(entityId)) return;
  const pct = Math.min(100, Math.max(1, Math.round(percent)));
  await call("light", "turn_on", { brightness_pct: pct }, { entity_id: entityId });
}

/** Details of an entity, in the app's own popups (popups/details.ts). */
export function openMoreInfo(_from: HTMLElement, entityId: string): void {
  void import("./popups/details.ts").then((m) => m.openDetails(entityId));
}

/**
 * Home Assistant's own detail dialog, offered as "Plus d'infos" from our
 * popups. Not for protected entities: it has its own unguarded switch.
 */
export function openNativeMoreInfo(entityId: string): void {
  if (needsConfirmation(entityId)) return;
  document
    .querySelector("home-assistant")
    ?.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

export async function setColorTemp(entityId: string, kelvin: number): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.") || needsConfirmation(entityId)) return;
  await call("light", "turn_on", { color_temp_kelvin: Math.round(kelvin) }, { entity_id: entityId });
}

export async function setHue(entityId: string, hs: [number, number]): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.") || needsConfirmation(entityId)) return;
  await call("light", "turn_on", { hs_color: hs }, { entity_id: entityId });
}

export async function setEffect(entityId: string, effect: string): Promise<void> {
  const hass = store.hass;
  if (!hass || !entityId.startsWith("light.") || needsConfirmation(entityId)) return;
  await call("light", "turn_on", { effect }, { entity_id: entityId });
}
