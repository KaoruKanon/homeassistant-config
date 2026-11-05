import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { installIdleReturn } from "../src/kiosk.ts";

const MIN = 60_000;

describe("installIdleReturn", () => {
  let stop: () => void;
  let calls: number;
  const g = globalThis as Record<string, unknown>;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setInterval", "Date"] });
    g.window = new EventTarget();
    g.document = new EventTarget();
    calls = 0;
    stop = installIdleReturn(5 * MIN, () => calls++);
  });

  afterEach(() => {
    stop();
    mock.timers.reset();
    delete g.window;
    delete g.document;
  });

  test("goes home once after the delay without a touch", () => {
    mock.timers.tick(4 * MIN);
    assert.equal(calls, 0);
    mock.timers.tick(1 * MIN);
    assert.equal(calls, 1);
    mock.timers.tick(30 * MIN);
    assert.equal(calls, 1);
  });

  test("a touch restarts the delay and re-arms it", () => {
    mock.timers.tick(4 * MIN);
    (g.window as EventTarget).dispatchEvent(new Event("pointerdown"));
    mock.timers.tick(4 * MIN);
    assert.equal(calls, 0);
    mock.timers.tick(1 * MIN);
    assert.equal(calls, 1);
    (g.window as EventTarget).dispatchEvent(new Event("keydown"));
    mock.timers.tick(5 * MIN);
    assert.equal(calls, 2);
  });

  test("checks when the page shows again (timers paused while the screen is off)", () => {
    mock.timers.setTime(Date.now() + 10 * MIN); // the clock moved, no interval ran
    assert.equal(calls, 0);
    (g.document as EventTarget).dispatchEvent(new Event("visibilitychange"));
    assert.equal(calls, 1);
  });

  test("stopped: nothing more", () => {
    stop();
    mock.timers.tick(10 * MIN);
    assert.equal(calls, 0);
  });
});
