import type { KaoruHomeConfig } from "./config.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

export interface Room {
  id: string;
  name: string;
  icon: string;
  lights: string[];
  switches: string[];
  fans: string[];
  media: string[];
  openings: string[];
  motion: string[];
  temperature?: string;
  humidity?: string;
}

export interface HouseModel {
  rooms: Room[];
  /** Lights with no area: shown so they can be found, and assigned in HA. */
  unassignedLights: string[];
  /** Power sensor of the same device, keyed by switch entity id. */
  power: Record<string, string>;
}

const OPENING_CLASSES = new Set(["window", "door", "opening", "garage_door"]);
const MOTION_CLASSES = new Set(["motion", "occupancy", "presence"]);

export function matches(entityId: string, patterns: readonly string[]): boolean {
  return patterns.some((p) =>
    p.includes("*")
      ? new RegExp(`^${p.split("*").map(escapeRegExp).join(".*")}$`).test(entityId)
      : p === entityId,
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

const domainOf = (entityId: string) => entityId.slice(0, entityId.indexOf("."));

function isGroup(state: HassEntity | undefined): boolean {
  return Array.isArray(state?.attributes.entity_id);
}

export function buildHouse(hass: HomeAssistant, cfg: KaoruHomeConfig): HouseModel {
  const rooms = new Map<string, Room>();
  for (const area of Object.values(hass.areas)) {
    rooms.set(area.area_id, {
      id: area.area_id,
      name: area.name,
      icon: area.icon || cfg.roomIcons[area.area_id] || "mdi:home-outline",
      lights: [],
      switches: [],
      fans: [],
      media: [],
      openings: [],
      motion: [],
    });
  }

  const unassignedLights: string[] = [];
  const powerByDevice = new Map<string, string>();
  const switchDevice = new Map<string, string>();

  for (const entry of Object.values(hass.entities)) {
    const id = entry.entity_id;
    const state = hass.states[id];
    if (!state || entry.hidden || entry.entity_category || matches(id, cfg.hide)) continue;
    const domain = domainOf(id);
    const deviceClass = state.attributes.device_class as string | undefined;

    if (domain === "sensor" && deviceClass === "power" && entry.device_id) {
      if (!powerByDevice.has(entry.device_id)) powerByDevice.set(entry.device_id, id);
    }

    const areaId =
      entry.area_id ?? (entry.device_id ? hass.devices[entry.device_id]?.area_id : null) ?? null;
    const room = areaId ? rooms.get(areaId) : undefined;

    if (!room) {
      if (domain === "light" && !isGroup(state)) unassignedLights.push(id);
      continue;
    }

    switch (domain) {
      case "light":
        if (!isGroup(state)) room.lights.push(id);
        break;
      case "switch":
        room.switches.push(id);
        if (entry.device_id) switchDevice.set(id, entry.device_id);
        break;
      case "fan":
        room.fans.push(id);
        break;
      case "media_player":
        room.media.push(id);
        break;
      case "binary_sensor":
        if (deviceClass && OPENING_CLASSES.has(deviceClass)) room.openings.push(id);
        else if (deviceClass && MOTION_CLASSES.has(deviceClass)) room.motion.push(id);
        break;
      case "sensor":
        if (deviceClass === "temperature") room.temperature ??= id;
        else if (deviceClass === "humidity") room.humidity ??= id;
        break;
    }
  }

  const power: Record<string, string> = {};
  for (const [switchId, deviceId] of switchDevice) {
    const sensor = powerByDevice.get(deviceId);
    if (sensor) power[switchId] = sensor;
  }

  const order = (id: string) => {
    const i = cfg.roomOrder.indexOf(id);
    return i === -1 ? cfg.roomOrder.length : i;
  };
  const list = [...rooms.values()]
    .filter((r) => r.lights.length + r.switches.length + r.fans.length + r.media.length +
      r.openings.length + r.motion.length > 0 || r.temperature)
    .sort((a, b) => order(a.id) - order(b.id) || a.name.localeCompare(b.name, "fr"));

  for (const r of list) {
    for (const key of ["lights", "switches", "fans", "media", "openings", "motion"] as const) {
      r[key].sort((a, b) => entityName(hass, a, cfg, r.name).localeCompare(entityName(hass, b, cfg, r.name), "fr"));
    }
  }

  return { rooms: list, unassignedLights, power };
}

/** Rooms in the order a given person wants them: favourites first. */
export function roomsFor(model: HouseModel, favorites: readonly string[] = []): Room[] {
  const rank = (r: Room) => {
    const i = favorites.indexOf(r.id);
    return i === -1 ? favorites.length : i;
  };
  return [...model.rooms].sort((a, b) => rank(a) - rank(b));
}

/** Short, human name: config override, else friendly name without the room. */
export function entityName(
  hass: HomeAssistant,
  entityId: string,
  cfg: KaoruHomeConfig,
  roomName?: string,
): string {
  for (const [pattern, name] of Object.entries(cfg.names)) {
    if (matches(entityId, [pattern])) return name;
  }
  const friendly = (hass.states[entityId]?.attributes.friendly_name as string | undefined) ?? entityId;
  if (!roomName) return friendly;
  const stripped = friendly
    .replace(new RegExp(escapeRegExp(roomName), "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped.length > 1 ? capitalize(stripped) : friendly;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The person entity linked to the logged-in user, if any. */
export function currentPerson(hass: HomeAssistant): string | undefined {
  const userId = hass.user?.id;
  if (!userId) return undefined;
  return Object.values(hass.states).find(
    (s) => s.entity_id.startsWith("person.") && s.attributes.user_id === userId,
  )?.entity_id;
}
