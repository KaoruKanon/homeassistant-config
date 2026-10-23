// Layout audit: every page on many screen sizes, portrait and landscape.
// Flags horizontal overflow and cards squeezed below a usable width, and
// saves a screenshot of the home view per size. Read-only.
//   HASS_PASSWORD_FILE=... node dev/layout-audit.mjs <out-dir>
import { join } from "node:path";
import { chromium } from "playwright-core";
import { login } from "./screens.mjs";

const url = process.env.HASS_URL ?? "http://localhost:8124";
const out = process.argv[2] ?? "screens";
const SIZES = {
  "phone-portrait": { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "phone-landscape": { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "ipad-portrait": { viewport: { width: 820, height: 1180 }, hasTouch: true },
  "ipad-landscape": { viewport: { width: 1180, height: 820 }, hasTouch: true },
  "wall-tablet": { viewport: { width: 1280, height: 800 }, hasTouch: true },
  "macbook-14": { viewport: { width: 1512, height: 982 } },
  "macbook-16": { viewport: { width: 1728, height: 1117 } },
  "full-hd": { viewport: { width: 1920, height: 1080 } },
};
const PAGES = ["", "/pieces", "/pieces/chambre_william", "/medias", "/meteo", "/energie", "/systeme"];
// Minimum widths (px) below which a component is unusable.
const MIN = { "KH-LIGHT-CARD": 165, "KH-MEDIA-CARD": 260, "KH-WEATHER-CARD": 300, "KH-BOX-REMOTE": 280, "KH-ENERGY-CARD": 280, "KH-TILE": 160, "KH-COMPUTER": 150 };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
await login(browser);
const problems = [];
for (const [size, device] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ ...device, colorScheme: "dark", locale: "fr-FR", storageState: join(out, ".auth.json") });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(`${url}/maison${p}?as=kaoru`);
    await page.waitForSelector("kaoru-home");
    await page.waitForTimeout(p === "" ? 1600 : 1100);
    const report = await page.evaluate((MIN) => {
      const issues = [];
      const root = document.querySelector("home-assistant");
      if (document.scrollingElement.scrollWidth > innerWidth + 1) {
        // Name the widest element sticking out on the right.
        let worst = null, right = innerWidth + 1;
        const scan = (n) => { for (const el of n.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.width && r.right > right) { right = r.right; worst = el; } if (el.shadowRoot) scan(el.shadowRoot); } };
        scan(document);
        const name = worst ? `${worst.tagName.toLowerCase()}${worst.className && typeof worst.className === "string" ? "." + worst.className.split(" ")[0] : ""}` : "?";
        issues.push(`page scrolls sideways (${document.scrollingElement.scrollWidth} > ${innerWidth}, ${name} ends at ${Math.round(right)})`);
      }
      const walk = (node) => {
        for (const el of node.querySelectorAll("*")) {
          const min = MIN[el.tagName];
          if (min) {
            const w = el.getBoundingClientRect().width;
            if (w > 0 && w < min) issues.push(`${el.tagName.toLowerCase()} ${Math.round(w)} px < ${min}`);
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(root.shadowRoot ?? root);
      const kh = (function find(n) { for (const el of n.querySelectorAll("*")) { if (el.tagName === "KAORU-HOME") return el; if (el.shadowRoot) { const f = find(el.shadowRoot); if (f) return f; } } })(document);
      const main = kh?.shadowRoot?.querySelector("main");
      if (main && main.scrollWidth > main.clientWidth + 1) issues.push(`panel content overflows (${main.scrollWidth} > ${main.clientWidth})`);
      return [...new Set(issues)].slice(0, 6);
    }, MIN);
    if (report.length) problems.push(`${size} ${p || "/"}: ${report.join("; ")}`);
    if (p === "") await page.screenshot({ path: join(out, `audit-${size}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "no layout problem found");
