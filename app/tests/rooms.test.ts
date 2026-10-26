import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildHouse, currentPerson, entityName, matches, roomsFor } from "../src/rooms.ts";
import { fakeConfig, fakeHass } from "./fixtures.ts";

describe("matches", () => {
  test("exact ids", () => {
    assert.equal(matches("light.salon", ["light.salon"]), true);
    assert.equal(matches("light.salon_2", ["light.salon"]), false);
  });

  test("wildcards anywhere in the pattern", () => {
    assert.equal(matches("light.desk_screen", ["light.*_screen"]), true);
    assert.equal(matches("light.desk_screen_2", ["light.*_screen"]), false);
    assert.equal(matches("switch.plug_child_lock_1", ["switch.*_child_lock*"]), true);
    assert.equal(matches("switch.anything", ["switch.*"]), true);
    assert.equal(matches("light.anything", ["switch.*"]), false);
  });

  test("dots and other regexp characters are literal", () => {
    assert.equal(matches("lightXsalon", ["light.*"]), false);
    assert.equal(matches("sensor.a+b", ["sensor.a+*"]), true);
    assert.equal(matches("sensor.aab", ["sensor.a+*"]), false);
  });

  test("any pattern of the list, none for an empty list", () => {
    assert.equal(matches("fan.salon", ["light.*", "fan.*"]), true);
    assert.equal(matches("fan.salon", []), false);
  });
});

describe("buildHouse", () => {
  test("groups entities by entity area, then by device area", () => {
    const hass = fakeHass({
      areas: { salon: "Salon", cuisine: "Cuisine" },
      devices: { lamp: "salon", plug: "cuisine" },
      entities: {
        "light.lamp": { registry: { device_id: "lamp" } },
        // Entity area wins over its device area.
        "light.moved": { registry: { device_id: "lamp", area_id: "cuisine" } },
        "switch.plug": { registry: { device_id: "plug" } },
        "fan.ceiling": { registry: { area_id: "salon" } },
        "media_player.tv": { registry: { area_id: "salon" } },
      },
    });
    const { rooms } = buildHouse(hass, fakeConfig());
    const salon = rooms.find((r) => r.id === "salon")!;
    const cuisine = rooms.find((r) => r.id === "cuisine")!;
    assert.deepEqual(salon.lights, ["light.lamp"]);
    assert.deepEqual(salon.fans, ["fan.ceiling"]);
    assert.deepEqual(salon.media, ["media_player.tv"]);
    assert.deepEqual(cuisine.lights, ["light.moved"]);
    assert.deepEqual(cuisine.switches, ["switch.plug"]);
  });

  test("sorts binary sensors and sensors by device class", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      entities: {
        "binary_sensor.window": { attributes: { device_class: "window" }, registry: { area_id: "salon" } },
        "binary_sensor.door": { attributes: { device_class: "door" }, registry: { area_id: "salon" } },
        "binary_sensor.pir": { attributes: { device_class: "motion" }, registry: { area_id: "salon" } },
        "binary_sensor.other": { attributes: { device_class: "moisture" }, registry: { area_id: "salon" } },
        "sensor.temp_1": { attributes: { device_class: "temperature" }, registry: { area_id: "salon" } },
        "sensor.temp_2": { attributes: { device_class: "temperature" }, registry: { area_id: "salon" } },
        "sensor.hum": { attributes: { device_class: "humidity" }, registry: { area_id: "salon" } },
      },
    });
    const [salon] = buildHouse(hass, fakeConfig()).rooms;
    assert.deepEqual(salon.openings, ["binary_sensor.door", "binary_sensor.window"]);
    assert.deepEqual(salon.motion, ["binary_sensor.pir"]);
    assert.equal(salon.temperature, "sensor.temp_1");
    assert.equal(salon.humidity, "sensor.hum");
  });

  test("skips light groups, in rooms and unassigned", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      entities: {
        "light.a": { registry: { area_id: "salon" } },
        "light.group": { attributes: { entity_id: ["light.a"] }, registry: { area_id: "salon" } },
        "light.loose_group": { attributes: { entity_id: ["light.a"] } },
      },
    });
    const house = buildHouse(hass, fakeConfig());
    assert.deepEqual(house.rooms[0].lights, ["light.a"]);
    assert.deepEqual(house.unassignedLights, []);
  });

  test("skips hidden, entity_category and config.hide entities", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      entities: {
        "light.shown": { registry: { area_id: "salon" } },
        "light.hidden": { registry: { area_id: "salon", hidden: true } },
        "switch.diag": { registry: { area_id: "salon", entity_category: "diagnostic" } },
        "switch.cfg": { registry: { area_id: "salon", entity_category: "config" } },
        "light.tablet_screen": { registry: { area_id: "salon" } },
        "light.loose_screen": {},
      },
    });
    const house = buildHouse(hass, fakeConfig({ hide: ["light.*_screen"] }));
    assert.deepEqual(house.rooms[0].lights, ["light.shown"]);
    assert.deepEqual(house.rooms[0].switches, []);
    assert.deepEqual(house.unassignedLights, []);
  });

  test("skips registry entries without a state and states without a registry entry", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      entities: { "light.no_registry": { noRegistry: true } },
    });
    hass.entities["light.no_state"] = { entity_id: "light.no_state", area_id: "salon" };
    const house = buildHouse(hass, fakeConfig());
    assert.deepEqual(house.rooms, []);
    assert.deepEqual(house.unassignedLights, []);
  });

  test("attaches the power sensor of the same device to a switch", () => {
    const hass = fakeHass({
      areas: { labo: "Labo" },
      devices: { plug: "labo", other: "labo" },
      entities: {
        "switch.plug": { registry: { device_id: "plug" } },
        "sensor.plug_power": { attributes: { device_class: "power" }, registry: { device_id: "plug" } },
        "sensor.plug_energy": { attributes: { device_class: "energy" }, registry: { device_id: "plug" } },
        "switch.other": { registry: { device_id: "other" } },
        "switch.no_device": { registry: { area_id: "labo" } },
      },
    });
    const { power } = buildHouse(hass, fakeConfig());
    assert.deepEqual(power, { "switch.plug": "sensor.plug_power" });
  });

  test("power sensors count even when the device has no area", () => {
    const hass = fakeHass({
      areas: { labo: "Labo" },
      devices: { plug: null },
      entities: {
        "switch.plug": { registry: { device_id: "plug", area_id: "labo" } },
        "sensor.plug_power": { attributes: { device_class: "power" }, registry: { device_id: "plug" } },
      },
    });
    assert.deepEqual(buildHouse(hass, fakeConfig()).power, { "switch.plug": "sensor.plug_power" });
  });

  test("lists lights with no area, and only lights", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      devices: { loose: null },
      entities: {
        "light.no_area": {},
        "light.device_no_area": { registry: { device_id: "loose" } },
        "light.unknown_area": { registry: { area_id: "garage" } },
        "switch.no_area": {},
      },
    });
    const house = buildHouse(hass, fakeConfig());
    assert.deepEqual(house.unassignedLights, ["light.no_area", "light.device_no_area", "light.unknown_area"]);
    assert.deepEqual(house.rooms, []);
  });

  test("drops empty rooms, keeps a room with only a temperature", () => {
    const hass = fakeHass({
      areas: { salon: "Salon", vide: "Vide", cave: "Cave" },
      entities: {
        "sensor.cave_temp": { attributes: { device_class: "temperature" }, registry: { area_id: "cave" } },
        "light.salon": { registry: { area_id: "salon" } },
      },
    });
    assert.deepEqual(buildHouse(hass, fakeConfig()).rooms.map((r) => r.id), ["cave", "salon"]);
  });

  test("orders rooms by config.roomOrder, then by name", () => {
    const hass = fakeHass({
      areas: { b: "Bureau", s: "Salon", a: "Atelier", c: "Cuisine" },
      entities: {
        "light.b": { registry: { area_id: "b" } },
        "light.s": { registry: { area_id: "s" } },
        "light.a": { registry: { area_id: "a" } },
        "light.c": { registry: { area_id: "c" } },
      },
    });
    const rooms = buildHouse(hass, fakeConfig({ roomOrder: ["s", "c"] })).rooms;
    assert.deepEqual(rooms.map((r) => r.id), ["s", "c", "a", "b"]);
  });

  test("sorts entities of a room by their short name", () => {
    const hass = fakeHass({
      areas: { salon: "Salon" },
      entities: {
        "light.z": { attributes: { friendly_name: "Salon Applique" }, registry: { area_id: "salon" } },
        "light.a": { attributes: { friendly_name: "Plafonnier salon" }, registry: { area_id: "salon" } },
      },
    });
    assert.deepEqual(buildHouse(hass, fakeConfig()).rooms[0].lights, ["light.z", "light.a"]);
  });

  test("room icon: area icon, then config.roomIcons, then a default", () => {
    const hass = fakeHass({
      areas: { a: { name: "A", icon: "mdi:star" }, b: "B", c: "C" },
      entities: {
        "light.a": { registry: { area_id: "a" } },
        "light.b": { registry: { area_id: "b" } },
        "light.c": { registry: { area_id: "c" } },
      },
    });
    const icons = buildHouse(hass, fakeConfig({ roomIcons: { a: "mdi:no", b: "mdi:sofa" } })).rooms.map((r) => r.icon);
    assert.deepEqual(icons, ["mdi:star", "mdi:sofa", "mdi:home-outline"]);
  });
});

describe("roomsFor", () => {
  const hass = fakeHass({
    areas: { a: "A", b: "B", c: "C", d: "D" },
    entities: {
      "light.a": { registry: { area_id: "a" } },
      "light.b": { registry: { area_id: "b" } },
      "light.c": { registry: { area_id: "c" } },
      "light.d": { registry: { area_id: "d" } },
    },
  });
  const model = buildHouse(hass, fakeConfig());

  test("favourites first, in their own order, then the house order", () => {
    assert.deepEqual(roomsFor(model, ["c", "a"]).map((r) => r.id), ["c", "a", "b", "d"]);
  });

  test("unknown favourites are ignored", () => {
    assert.deepEqual(roomsFor(model, ["zz", "d"]).map((r) => r.id), ["d", "a", "b", "c"]);
  });

  test("no favourites keeps the house order and does not mutate the model", () => {
    assert.deepEqual(roomsFor(model).map((r) => r.id), ["a", "b", "c", "d"]);
    roomsFor(model, ["d"]);
    assert.deepEqual(model.rooms.map((r) => r.id), ["a", "b", "c", "d"]);
  });
});

describe("entityName", () => {
  const hass = fakeHass({
    entities: {
      "light.salon_plafond": { attributes: { friendly_name: "Plafonnier Salon" } },
      "light.salon_lampe": { attributes: { friendly_name: "salon lampe  sur pied" } },
      "light.salon": { attributes: { friendly_name: "Salon" } },
      "light.switch_wall_salon": { attributes: { friendly_name: "Switch wall salon" } },
      "light.no_name": {},
    },
  });
  const cfg = fakeConfig({
    names: { "light.switch_wall_*": "Lumière", "light.salon_lampe": "Lampe" },
  });

  test("strips the room name, case insensitive, and capitalizes", () => {
    assert.equal(entityName(hass, "light.salon_plafond", fakeConfig(), "Salon"), "Plafonnier");
    assert.equal(entityName(hass, "light.salon_lampe", fakeConfig(), "Salon"), "Lampe sur pied");
  });

  test("keeps the friendly name when nothing would be left", () => {
    assert.equal(entityName(hass, "light.salon", fakeConfig(), "Salon"), "Salon");
  });

  test("keeps the friendly name without a room", () => {
    assert.equal(entityName(hass, "light.salon_plafond", fakeConfig()), "Plafonnier Salon");
  });

  test("falls back to the entity id", () => {
    assert.equal(entityName(hass, "light.no_name", fakeConfig()), "light.no_name");
    assert.equal(entityName(hass, "light.missing", fakeConfig()), "light.missing");
  });

  test("config.names patterns win, wildcards included", () => {
    assert.equal(entityName(hass, "light.switch_wall_salon", cfg, "Salon"), "Lumière");
    assert.equal(entityName(hass, "light.salon_lampe", cfg, "Salon"), "Lampe");
    assert.equal(entityName(hass, "light.salon_plafond", cfg, "Salon"), "Plafonnier");
  });
});

describe("currentPerson", () => {
  const entities = {
    "person.kaoru": { attributes: { user_id: "u1" } },
    "person.papa": { attributes: { user_id: "u2" } },
    // Not a person, even with a matching user_id.
    "sensor.fake": { attributes: { user_id: "u3" } },
  };

  test("finds the person linked to the logged-in user", () => {
    assert.equal(currentPerson(fakeHass({ entities, userId: "u2" })), "person.papa");
  });

  test("undefined without a user or a linked person", () => {
    assert.equal(currentPerson(fakeHass({ entities })), undefined);
    assert.equal(currentPerson(fakeHass({ entities, userId: "u3" })), undefined);
    assert.equal(currentPerson(fakeHass({ entities, userId: "nobody" })), undefined);
  });
});
