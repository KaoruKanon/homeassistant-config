// Exercises taps on the dev01 simulated devices only (app/dev/sim.yaml).
// Any other entity is refused before a click is sent.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { login, screens } from "./screens.mjs";

const SIM = new Set(["light.lampe_de_bureau", "light.plafonnier", "switch.prise_protegee"]);
const url = process.env.HASS_URL ?? "http://localhost:8124";
const out = process.argv[2] ?? "screens";

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
await login(browser);
const context = await browser.newContext({ ...screens.tablet, locale: "fr-FR", storageState: join(out, ".auth.json") });
const page = await context.newPage();
await page.goto(`${url}/maison/labo`);
await page.waitForSelector("kh-tile");
await page.waitForTimeout(1000);

const state = (id) => page.evaluate((id) => document.querySelector("home-assistant").hass.states[id]?.state, id);
const waitState = (id, want) =>
  page.waitForFunction(([id, want]) => document.querySelector("home-assistant").hass.states[id]?.state === want, [id, want], { timeout: 5000 });
async function tap(id) {
  if (!SIM.has(id)) throw new Error(`refused: ${id} is not a simulated entity`);
  await page.locator(`kh-tile[entity-id="${id}"] button.tile`).click();
}
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);

// Light toggles and latency (tap -> state changed in the UI's hass)
for (const id of ["light.lampe_de_bureau"]) {
  const before = await state(id);
  const want = before === "on" ? "off" : "on";
  const t0 = Date.now(); await tap(id); await waitState(id, want);
  check(`tap ${id} ${before}->${want}`, true, `${Date.now() - t0} ms`);
  await page.screenshot({ path: join(out, "interact-light-on.png") });
  await tap(id); await waitState(id, before); check(`tap ${id} back to ${before}`, true);
}

// Protected plug: cancel keeps the state, confirm applies it
const plug = "switch.prise_protegee";
const p0 = await state(plug);
await tap(plug);
await page.waitForSelector("kh-confirm-dialog dialog[open]");
await page.screenshot({ path: join(out, "interact-confirm.png") });
await page.locator("kh-confirm-dialog button.cancel").click();
await page.waitForTimeout(800);
check("cancel keeps plug state", (await state(plug)) === p0, `${p0}`);
await tap(plug);
await page.waitForSelector("kh-confirm-dialog dialog[open]");
await page.waitForTimeout(650); /* confirm is armed 500 ms after opening */ await page.locator("kh-confirm-dialog button.confirm").click();
const p1 = p0 === "on" ? "off" : "on";
await waitState(plug, p1); check(`confirm switches plug to ${p1}`, true);
await tap(plug); await page.waitForSelector("kh-confirm-dialog dialog[open]"); await page.waitForTimeout(650); /* confirm is armed 500 ms after opening */ await page.locator("kh-confirm-dialog button.confirm").click(); await waitState(plug, p0);
check(`plug back to ${p0}`, true);

// Room action: lights only
await page.locator("kh-room-view button.all").click();
await waitState("light.lampe_de_bureau", "on"); await waitState("light.plafonnier", "on");
check("room 'Tout allumer' turns both sim lights on", (await state(plug)) === p0, "plug untouched");
await page.screenshot({ path: join(out, "interact-room-on.png") });
await page.locator("kh-room-view button.all").click();
await waitState("light.lampe_de_bureau", "off"); await waitState("light.plafonnier", "off");
check("room 'Tout éteindre' turns both off", true);

console.log(results.join("\n"));
await browser.close();
