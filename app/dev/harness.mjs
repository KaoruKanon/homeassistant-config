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
  };
  const entities = Object.fromEntries(
    Object.keys(states).map((id) => [id, { entity_id: id, area_id: id.includes("plug") ? null : "bureau", device_id: id.includes("plug") ? "dev-plug" : null }]),
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
await page.goto("http://harness.test/maison/bureau");
await page.addScriptTag({ url: "http://harness.test/kaoru-home.js", type: "module" });
await page.evaluate((src) => {
  const hass = eval(`(${src})`)();
  window.__hass = hass;
  const el = document.createElement("kaoru-home");
  el.route = { prefix: "/maison", path: "/bureau" };
  el.hass = hass;
  document.body.append(el);
}, fakeHass.toString());
await page.waitForSelector("kh-tile");

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);
const calls = () => page.evaluate(() => window.__hass.calls.splice(0));

// Slider -> light.turn_on brightness_pct
await page.locator('kh-tile[entity-id="light.desk"] input.dim').evaluate((el) => {
  el.value = "30";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
let c = await calls();
check("slider sends light.turn_on brightness_pct 30", c.length === 1 && c[0].service === "turn_on" && c[0].data.brightness_pct === 30, JSON.stringify(c));
check("no slider on an on/off-only light", (await page.locator('kh-tile[entity-id="light.ceiling"] input.dim').count()) === 0);

// Tuya plug: cancel sends nothing
await page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"] button.tile').click();
await page.waitForSelector("kh-confirm-dialog dialog[open]");
check("homelab plug asks for confirmation", true);
if (out) await page.screenshot({ path: join(out, "harness-confirm.png") });
await page.locator("kh-confirm-dialog button.cancel").click();
c = await calls();
check("cancel sends no service call to the plug", c.length === 0, JSON.stringify(c));
check("plug tile shows its power", (await page.locator('kh-tile[entity-id="switch.smart_plug_homelab_switch"]').evaluate((el) => el.shadowRoot.textContent)).includes("42 W"));

// Room action never includes plugs
await page.locator("kh-room-view button.all").click();
c = await calls();
check("room action targets lights only", c.length === 1 && c[0].target.entity_id.every((id) => id.startsWith("light.")), JSON.stringify(c));

// Open window is flagged
check("open window flagged", (await page.locator("kh-room-view").evaluate((el) => el.shadowRoot.querySelector("li.alert")?.textContent ?? "")).includes("Fenêtre"));

console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
