import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HassStore } from "../src/store.ts";
import type { HomeAssistant } from "../src/types.ts";
import { fakeHass, state } from "./fixtures.ts";

function base(): HomeAssistant {
  return fakeHass({
    areas: { salon: "Salon" },
    entities: {
      "light.a": { registry: { area_id: "salon" } },
      "light.b": { registry: { area_id: "salon" } },
      "sensor.c": { state: "20" },
    },
    userId: "u1",
  });
}

/** Next `hass` as Home Assistant hands it: new states object, unchanged entities kept. */
function withState(hass: HomeAssistant, id: string, s: string): HomeAssistant {
  return { ...hass, states: { ...hass.states, [id]: state(id, hass.states[id]?.attributes, s) } };
}

function counter() {
  const fn = () => {
    fn.calls++;
  };
  fn.calls = 0;
  return fn;
}

describe("HassStore entity listeners", () => {
  test("first hass wakes every listener", () => {
    const store = new HassStore();
    const a = counter();
    const b = counter();
    store.subscribe(["light.a"], a);
    store.subscribe(["sensor.c"], b);
    store.set(base());
    assert.equal(a.calls, 1);
    assert.equal(b.calls, 1);
  });

  test("wakes only listeners whose entity object changed", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const a = counter();
    const b = counter();
    const c = counter();
    store.subscribe(["light.a"], a);
    store.subscribe(["light.b"], b);
    store.subscribe(["sensor.c"], c);
    store.set(withState(h, "light.a", "off"));
    assert.deepEqual([a.calls, b.calls, c.calls], [1, 0, 0]);
  });

  test("a new states object with the same entity objects wakes nobody", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const a = counter();
    store.subscribe(["light.a", "light.b"], a);
    store.set({ ...h, states: { ...h.states } });
    store.set({ ...h });
    assert.equal(a.calls, 0);
  });

  test("a listener on several changed entities is woken once", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const a = counter();
    store.subscribe(["light.a", "light.b"], a);
    store.set(withState(withState(h, "light.a", "off"), "light.b", "off"));
    assert.equal(a.calls, 1);
  });

  test("entities appearing or disappearing count as a change", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const added = counter();
    const removed = counter();
    store.subscribe(["light.new"], added);
    store.subscribe(["sensor.c"], removed);
    const { ["sensor.c"]: _gone, ...rest } = h.states;
    store.set({ ...h, states: { ...rest, "light.new": state("light.new") } });
    assert.equal(added.calls, 1);
    assert.equal(removed.calls, 1);
  });

  test("unsubscribe stops the listener, others stay", () => {
    const store = new HassStore();
    let h = base();
    store.set(h);
    const a = counter();
    const b = counter();
    const off = store.subscribe(["light.a"], a);
    store.subscribe(["light.a"], b);
    off();
    h = withState(h, "light.a", "off");
    store.set(h);
    assert.equal(a.calls, 0);
    assert.equal(b.calls, 1);
  });

  test("get reads the latest state", () => {
    const store = new HassStore();
    assert.equal(store.get("light.a"), undefined);
    const h = withState(base(), "light.a", "off");
    store.set(h);
    assert.equal(store.get("light.a")?.state, "off");
  });

  test("registry changes do not wake entity listeners", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const a = counter();
    store.subscribe(["light.a"], a);
    store.set({ ...h, areas: { ...h.areas } });
    assert.equal(a.calls, 0);
  });
});

describe("HassStore registry listeners", () => {
  const changes: Record<string, (h: HomeAssistant) => HomeAssistant> = {
    entities: (h) => ({ ...h, entities: { ...h.entities } }),
    areas: (h) => ({ ...h, areas: { ...h.areas } }),
    devices: (h) => ({ ...h, devices: { ...h.devices } }),
    user: (h) => ({ ...h, user: { ...h.user!, name: "Other" } }),
    themes: (h) => ({ ...h, themes: { darkMode: true } }),
    localize: (h) => ({ ...h, localize: () => "" }),
  };

  for (const [key, change] of Object.entries(changes)) {
    test(`fires on ${key} change`, () => {
      const store = new HassStore();
      const h = base();
      store.set(h);
      const r = counter();
      store.subscribeRegistry(r);
      store.set(change(h));
      assert.equal(r.calls, 1);
    });
  }

  test("fires on the first hass", () => {
    const store = new HassStore();
    const r = counter();
    store.subscribeRegistry(r);
    store.set(base());
    assert.equal(r.calls, 1);
  });

  test("does not fire on a state change only", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const r = counter();
    store.subscribeRegistry(r);
    store.set(withState(h, "light.a", "off"));
    assert.equal(r.calls, 0);
  });

  test("unsubscribe stops it", () => {
    const store = new HassStore();
    const h = base();
    store.set(h);
    const r = counter();
    const off = store.subscribeRegistry(r);
    off();
    store.set(changes.areas(h));
    assert.equal(r.calls, 0);
  });
});
