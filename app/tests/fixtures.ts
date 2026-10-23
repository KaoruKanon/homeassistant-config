// Hand-built `hass` objects for the unit tests. No browser, no Home Assistant.
import type { KaoruHomeConfig } from "../src/config.ts";
import type {
  AreaRegistryEntry,
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HassEntity,
  HomeAssistant,
} from "../src/types.ts";

export function state(entity_id: string, attributes: Record<string, unknown> = {}, s = "on"): HassEntity {
  return {
    entity_id,
    state: s,
    attributes,
    last_changed: "2026-01-01T00:00:00Z",
    last_updated: "2026-01-01T00:00:00Z",
  };
}

export interface FakeEntity {
  attributes?: Record<string, unknown>;
  state?: string;
  registry?: Omit<EntityRegistryEntry, "entity_id">;
  /** Present in states but not in the entity registry. */
  noRegistry?: boolean;
}

export function fakeHass(opts: {
  areas?: Record<string, string | Omit<AreaRegistryEntry, "area_id">>;
  devices?: Record<string, string | null>;
  entities?: Record<string, FakeEntity>;
  userId?: string;
}): HomeAssistant {
  const areas: Record<string, AreaRegistryEntry> = {};
  for (const [area_id, a] of Object.entries(opts.areas ?? {})) {
    areas[area_id] = typeof a === "string" ? { area_id, name: a } : { area_id, ...a };
  }
  const devices: Record<string, DeviceRegistryEntry> = {};
  for (const [id, area_id] of Object.entries(opts.devices ?? {})) {
    devices[id] = { id, area_id, name: id, name_by_user: null };
  }
  const states: Record<string, HassEntity> = {};
  const entities: Record<string, EntityRegistryEntry> = {};
  for (const [id, e] of Object.entries(opts.entities ?? {})) {
    states[id] = state(id, e.attributes, e.state);
    if (!e.noRegistry) entities[id] = { entity_id: id, ...e.registry };
  }
  return {
    states,
    entities,
    devices,
    areas,
    user: opts.userId ? { id: opts.userId, name: "Test", is_admin: false } : undefined,
    themes: { darkMode: false },
    language: "fr",
    callService: () => {
      throw new Error("tests must never call a Home Assistant service");
    },
  };
}

export function fakeConfig(overrides: Partial<KaoruHomeConfig> = {}): KaoruHomeConfig {
  return {
    hide: [],
    confirm: [],
    names: {},
    weather: [],
    roomOrder: [],
    roomIcons: {},
    people: {},
    home: { chips: {}, tvs: [], lights: [], computers: [], stocks: [] },
    media: { speakers: [], jellyfin: [] },
    weatherPage: {},
    energyPage: { plugs: [], fans: [] },
    system: { trackers: [], ha: {}, automations: [] },
    ...overrides,
  };
}
