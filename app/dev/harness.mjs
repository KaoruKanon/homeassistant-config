// Component tests of the built panel in Chrome, with a fake `hass`: no Home
// Assistant, no device. Service calls are recorded, never sent.
//
//   npm run build && node dev/harness.mjs [out-dir]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const out = process.argv[2];
const bundle = readFileSync(new URL("../../www/kaoru-home/kaoru-home.js", import.meta.url), "utf8");

const fakeHass = () => {
  const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: "", last_updated: "" });
  const states = {
    "light.desk": st("light.desk", "on", { friendly_name: "Lampe bureau", supported_color_modes: ["brightness"], brightness: 128 }),
    "light.ceiling": st("light.ceiling", "off", { friendly_name: "Plafonnier", supported_color_modes: ["onoff"] }),
    "switch.smart_plug_homelab_switch": st("switch.smart_plug_homelab_switch", "on", { friendly_name: "Prise homelab" }),
    "sensor.smart_plug_homelab_active_power": st("sensor.smart_plug_homelab_active_power", "42", { device_class: "power" }),
    "binary_sensor.window": st("binary_sensor.window", "on", { friendly_name: "Fenêtre Bureau", device_class: "window" }),
    "sensor.temp": st("sensor.temp", "21.4", { device_class: "temperature" }),
    // the same plug exposed as a light through "change device type" (switch_as_x)
    "light.homelab_as_light": st("light.homelab_as_light", "on", { friendly_name: "Homelab lumière", supported_color_modes: ["onoff"] }),
  };
  const onPlug = (id) => id.includes("plug") || id.includes("homelab_as_light");
  const entities = Object.fromEntries(
    Object.keys(states).map((id) => [
      id,
      { entity_id: id, area_id: onPlug(id) ? null : "bureau", device_id: onPlug(id) ? "dev-plug" : null, platform: id === "light.homelab_as_light" ? "switch_as_x" : "demo" },
    ]),
  );
  return {
    states,
    entities,
    devices: { "dev-plug": { id: "dev-plug", area_id: "bureau", name: "Prise", name_by_user: null } },
    areas: { bureau: { area_id: "bureau", name: "Bureau", icon: null } },
    user: { id: "u1", name: "Test", is_admin: false },
    themes: { darkMode: false },
    language: "fr",
    calls: [],
    callService(domain, service, data, target) {
      this.calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route("http://harness.test/**", (route) =>
  route.request().url().endsWith(".js")
    ? route.fulfill({ contentType: "text/javascript", body: bundle })
    : route.fulfill({ contentType: "text/html", body: "<!doctype html><body style='margin:0'></body>" }),
);
await page.goto("http://harness.test/maison/pieces/bureau");
await page.addScriptTag({ url: "http://harness.test/kaoru-home.js", type: "module" });
await page.evaluate((src) => {
  const hass = eval(`(${src})`)();
  window.__hass = hass;
  const el = document.createElement("kaoru-home");
  el.route = { prefix: "/maison", path: "/pieces/bureau" };
  el.hass = hass;
  document.body.append(el);
}, fakeHass.toString());
await page.waitForSelector("kh-light-card");

const results = [];
const check = (name, ok, extra = "") => { const line = `${ok ? "OK  " : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`; results.push(line); console.error(line); };
const calls = () => page.evaluate(() => window.__hass.calls.splice(0));

// Slider -> light.turn_on brightness_pct
await page.locator('kh-light-card[entity-id="light.desk"] input[type="range"]').evaluate((el) => {
  el.value = "30";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
let c = await calls();
check("slider sends light.turn_on brightness_pct 30", c.length === 1 && c[0].service === "turn_on" && c[0].data.brightness_pct === 30, JSON.stringify(c));
check("no slider on an on/off-only light", (await page.locator('kh-light-card[entity-id="light.ceiling"] input[type="range"]').count()) === 0);

// Tuya plug: no shortcut to HA's unguarded detail dialog
check("protected plug has no detail button", (await page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"]').evaluate((el) => el.shadowRoot.querySelector(".more") === null)));

// A double tap must not reach the confirm button
const plugTile = page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"] button.tile');
await plugTile.click();
await page.waitForSelector("kh-confirm-dialog dialog[open]");
await page.locator("kh-confirm-dialog button.confirm").click(); // ~immediately after opening
c = await calls();
check("tap-through on confirm is ignored", c.length === 0, JSON.stringify(c));
// The plug changes state while the question is open: the dialog closes, nothing is sent
await page.evaluate(() => {
  const h = window.__hass;
  const plug = { ...h.states["switch.smart_plug_homelab_switch"], state: "off" };
  const next = { ...h, states: { ...h.states, "switch.smart_plug_homelab_switch": plug } };
  window.__hass = next;
  document.querySelector("kaoru-home").hass = next;
});
await page.waitForTimeout(300);
check("dialog closes when the plug state changes", (await page.locator("kh-confirm-dialog").count()) === 0);
c = await calls();
check("nothing sent after the state change", c.length === 0, JSON.stringify(c));
// Back to on; a deliberate confirm sends an explicit turn_off
await page.evaluate(() => {
  const h = window.__hass;
  const plug = { ...h.states["switch.smart_plug_homelab_switch"], state: "on" };
  const next = { ...h, states: { ...h.states, "switch.smart_plug_homelab_switch": plug } };
  window.__hass = next;
  document.querySelector("kaoru-home").hass = next;
});
await plugTile.click();
await page.waitForSelector("kh-confirm-dialog dialog[open]");
await page.waitForTimeout(650);
await page.locator("kh-confirm-dialog button.confirm").click();
c = await calls();
check("deliberate confirm sends switch.turn_off", c.length === 1 && c[0].domain === "switch" && c[0].service === "turn_off", JSON.stringify(c));
// HA now reports the plug as off.
await page.evaluate(() => {
  const h = window.__hass;
  const plug = { ...h.states["switch.smart_plug_homelab_switch"], state: "off" };
  const next = { ...h, states: { ...h.states, "switch.smart_plug_homelab_switch": plug } };
  window.__hass = next;
  document.querySelector("kaoru-home").hass = next;
});

// Tuya plug: cancel sends nothing
await page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"] button.tile').click();
await page.waitForSelector("kh-confirm-dialog dialog[open]");
check("homelab plug asks for confirmation", true);
if (out) await page.screenshot({ path: join(out, "harness-confirm.png") });
await page.locator("kh-confirm-dialog button.cancel").click();
c = await calls();
check("cancel sends no service call to the plug", c.length === 0, JSON.stringify(c));
await page.evaluate(() => {
  const h = window.__hass;
  const plug = { ...h.states["switch.smart_plug_homelab_switch"], state: "on" };
  const next = { ...h, states: { ...h.states, "switch.smart_plug_homelab_switch": plug } };
  window.__hass = next;
  document.querySelector("kaoru-home").hass = next;
});
check("plug tile shows its power", (await page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"]').evaluate((el) => el.shadowRoot.textContent)).includes("42 W"));

// Room action never includes plugs
await page.locator("kh-room-view button.all").click();
c = await calls();
check(
  "room action targets lights only, never the plug-as-light",
  c.length === 1 && c[0].target.entity_id.every((id) => id.startsWith("light.")) && !c[0].target.entity_id.includes("light.homelab_as_light"),
  JSON.stringify(c),
);

// Open window is flagged
check("open window flagged", (await page.locator("kh-room-view").evaluate((el) => el.shadowRoot.querySelector(".status.alert")?.textContent ?? "")).includes("Fenêtre"));

await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
