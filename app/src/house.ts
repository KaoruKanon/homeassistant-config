import { setProtectedEntities } from "./actions.ts";
import { config } from "./config.ts";
import { buildHouse, type HouseModel } from "./rooms.ts";
import type { HomeAssistant } from "./types.ts";

let model: HouseModel | undefined;
let modelKey: unknown[] = [];

/**
 * The house model (rooms, power sensors, protected entities), shared by both
 * panels. Rebuilt only when the registry changed; protection is refreshed
 * with it, before anything can be toggled.
 */
export function house(hass: HomeAssistant): HouseModel {
  // States count too: after an HA restart the registry arrives before all states.
  const key = [hass.entities, hass.devices, hass.areas, Object.keys(hass.states).length];
  if (!model || key.some((k, i) => k !== modelKey[i])) {
    model = buildHouse(hass, config);
    setProtectedEntities(model.protected);
    modelKey = key;
  }
  return model;
}
