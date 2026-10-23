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
const PAGES = ["", "/v2", "/pieces", "/pieces/chambre_william", "/medias", "/meteo", "/energie", "/systeme"];
// Minimum widths (px) below which a component is unusable.
const MIN = { "KH-LIGHT-CARD": 165, "KH-MEDIA-CARD": 260, "KH-WEATHER-CARD": 300, "KH-BOX-REMOTE": 280, "KH-ENERGY-CARD": 280, "KH-TILE": 160, "KH-COMPUTER": 150 };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
await login(browser);
const problems = [];
// HA sidebar: expanded, collapsed to icons, hidden.
const SIDEBAR = (process.env.SIDEBAR ?? "docked,auto,always_hidden").split(",");
for (const [size, device] of Object.entries(SIZES)) for (const sidebar of SIDEBAR) {
  const ctx = await browser.newContext({ ...device, colorScheme: "dark", locale: "fr-FR", storageState: join(out, ".auth.json") });
  await ctx.addInitScript((m) => localStorage.setItem("dockedSidebar", JSON.stringify(m)), sidebar);
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
      // Cards sticking out of their column or overlapping a neighbour.
      const cards = [];
      const collect = (n) => { for (const el of n.querySelectorAll("*")) { if (el.tagName.startsWith("KH-") && !el.tagName.endsWith("-VIEW") && el.tagName !== "KH-HERO") cards.push(el); if (el.shadowRoot) collect(el.shadowRoot); } };
      collect(document);
      // Visible part only: clip by every scrolling/clipping ancestor (e.g. carousel pages off screen).
      const parentOf = (el) => el.assignedSlot ?? el.parentElement ?? el.getRootNode().host ?? null;
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        let box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        for (let a = parentOf(el); a && a !== document.documentElement; a = parentOf(a)) {
          if (a.nodeType !== 1) continue;
          const cs = getComputedStyle(a);
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
            const c = a.getBoundingClientRect();
            box = { left: Math.max(box.left, c.left), right: Math.min(box.right, c.right), top: Math.max(box.top, c.top), bottom: Math.min(box.bottom, c.bottom) };
          }
        }
        return { ...box, width: box.right - box.left, height: box.bottom - box.top };
      };
      const boxes = cards.map((el) => ({ el, r: visible(el) })).filter((b) => b.r.width > 1 && b.r.height > 1);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        const nested = boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el) || boxes[i].el.shadowRoot?.contains(boxes[j].el) || boxes[j].el.shadowRoot?.contains(boxes[i].el);
        if (nested) continue;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) { issues.push(`${boxes[i].el.tagName.toLowerCase()} overlaps ${boxes[j].el.tagName.toLowerCase()}`); }
      }
      const kh = (function find(n) { for (const el of n.querySelectorAll("*")) { if (el.tagName === "KAORU-HOME") return el; if (el.shadowRoot) { const f = find(el.shadowRoot); if (f) return f; } } })(document);
      const main = kh?.shadowRoot?.querySelector("main");
      if (main && main.scrollWidth > main.clientWidth + 1) issues.push(`panel content overflows (${main.scrollWidth} > ${main.clientWidth})`);
      return [...new Set(issues)].slice(0, 6);
    }, MIN);
    if (report.length) problems.push(`${size} sidebar=${sidebar} ${p || "/"}: ${report.join("; ")}`);
    if (p === "") await page.screenshot({ path: join(out, `audit-${size}-${sidebar}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "no layout problem found");
