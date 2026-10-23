// Opens each details popup and takes a screenshot; never presses a button
// inside a popup (no "find my phone", no PC start). Read-only.
import { join } from "node:path";
import { chromium } from "playwright-core";
import { login, screens } from "./screens.mjs";
// Software WebGL: HA's native map (MapLibre) renders headless without stalling screenshots.
const GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

const url = process.env.HASS_URL ?? "http://localhost:8124";
const out = process.argv[2] ?? "screens";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: GL });
await login(browser);

for (const [name, device] of [["tablet", screens.tablet], ["mobile", screens.mobile]]) {
  const ctx = await browser.newContext({ ...device, colorScheme: "dark", locale: "fr-FR", storageState: join(out, ".auth.json") });
  const page = await ctx.newPage();
  await page.goto(`${url}/maison?as=kaoru`);
  await page.waitForSelector("kh-thermometer");
  await page.waitForTimeout(1200);
  const shot = async (label) => {
    await page.waitForSelector("kh-popup dialog[open]");
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(out, `popup-${name}-${label}.png`) });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log(name, label, (await page.locator("kh-popup").count()) === 0 ? "closed" : "STILL OPEN");
  };
  await page.locator("kh-thermometer button").click();
  await shot("thermometre");
  await page.locator("kh-hero button.person").first().click();
  await shot("personne");
  await page.locator("kh-others button.tile").nth(1).click();
  await shot("qr");
  // Long press on a PC tile: details popup, no toggle
  const pc = page.locator("kh-computer button").first();
  await pc.scrollIntoViewIfNeeded();
  const box = await pc.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  console.log(name, "confirm dialog after long press:", await page.locator("kh-confirm-dialog").count());
  await shot("pc");
  // Back gesture closes a popup
  await page.locator("kh-thermometer button").click();
  await page.waitForSelector("kh-popup dialog[open]");
  await page.goBack();
  await page.waitForTimeout(400);
  console.log(name, "back closes popup:", (await page.locator("kh-popup").count()) === 0, "url:", page.url());
  await ctx.close();
}
await browser.close();
