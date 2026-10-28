// Screenshots of Kaoru Home on the three target screens, against the dev01
// test instance. Uses the system Chrome through playwright-core.
//
//   HASS_PASSWORD_FILE=~/.config/hass-dev/claude.pw node dev/screens.mjs [out-dir] [path...]
//
// Read-only: it only navigates, it never taps a device.
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
// Software WebGL: HA's native map (MapLibre) renders headless without stalling screenshots.
const GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

const url = process.env.HASS_URL ?? "http://localhost:8124";
const user = process.env.HASS_USER ?? "claude";
const password = readFileSync(process.env.HASS_PASSWORD_FILE, "utf8").trim();
const out = process.argv[2] ?? "screens";
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/maison", "/maison/pieces/labo"];
const chrome = process.env.CHROME ?? "/usr/bin/google-chrome";
const statePath = join(out, ".auth.json");

export const screens = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, hasTouch: true },
  pc: { viewport: { width: 1920, height: 1080 } },
};

export async function login(browser) {
  const context = await browser.newContext(existsSync(statePath) ? { storageState: statePath } : {});
  const page = await context.newPage();
  await page.goto(`${url}/maison`);
  const form = page.locator("input[name=username]");
  await page.locator("input[name=username], kaoru-home").first().waitFor({ timeout: 30000 });
  if (await form.isVisible()) {
    await form.fill(user);
    await page.locator("input[name=password]").fill(password);
    await page.keyboard.press("Enter");
  }
  await page.waitForSelector("kaoru-home", { timeout: 30000 });
  await context.storageState({ path: statePath });
  await context.close();
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, args: GL });
  await login(browser);
  for (const [name, device] of Object.entries(screens)) {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ ...device, colorScheme: scheme, locale: "fr-FR", storageState: statePath });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      for (const p of paths) {
        await page.goto(`${url}${p}`);
        await page.waitForSelector("kaoru-home, kaoru-home-v1bis, kaoru-home-v1ter, kaoru-home-v2", { timeout: 30000 });
        await page.waitForTimeout(1500);
        const file = join(out, `${name}-${scheme}${p.replaceAll("/", "_")}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(file);
      }
      if (errors.length) console.log(`  console errors (${name}/${scheme}):`, errors.slice(0, 5));
      await context.close();
    }
  }
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
