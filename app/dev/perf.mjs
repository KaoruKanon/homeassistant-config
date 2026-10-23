// Cold-load comparison of the current Lovelace dashboard and Kaoru Home on
// the wall-tablet profile, CPU slowed down 4x (a mid-range tablet).
// Read-only: it navigates and measures, it never taps anything.
//
//   HASS_PASSWORD_FILE=... node dev/perf.mjs <out-dir> [runs]
import { join } from "node:path";
import { chromium } from "playwright-core";
import { login, screens } from "./screens.mjs";

const url = process.env.HASS_URL ?? "http://localhost:8124";
const out = process.argv[2] ?? "screens";
const runs = Number(process.argv[3] ?? 3);

// "Ready" = the first piece of real content of each dashboard is on screen.
const only = process.env.ONLY;
const allTargets = {
  lovelace: { path: "/lovelace/home", ready: ["MUSHROOM-TEMPLATE-CARD", "MUSHROOM-CHIPS-CARD", "HUI-ENTITIES-CARD"] },
  "kaoru-home": { path: "/maison", ready: ["KH-LIGHT-CARD"] },
};

const targets = only ? { [only]: allTargets[only] } : allTargets;

const observe = `
  window.__kh = { tbt: 0, longTasks: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__kh.longTasks++; window.__kh.tbt += Math.max(0, e.duration - 50); } })
    .observe({ type: "longtask", buffered: true });
`;

function deepHas(tags) {
  const seen = new Set();
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (tags.includes(el.tagName)) return true;
      if (el.shadowRoot && !seen.has(el.shadowRoot)) {
        seen.add(el.shadowRoot);
        if (walk(el.shadowRoot)) return true;
      }
    }
    return false;
  };
  return walk(document);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
await login(browser);
const rows = [];
for (const [name, t] of Object.entries(targets)) {
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ ...screens.tablet, locale: "fr-FR", storageState: join(out, ".auth.json") });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(observe);
    const t0 = Date.now();
    await page.goto(`${url}${t.path}`);
    await page.waitForFunction(deepHas, t.ready, { timeout: 60000, polling: 50 });
    const ready = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const m = await page.evaluate(() => {
      const res = performance.getEntriesByType("resource");
      const sum = (f) => res.filter(f).reduce((a, r) => a + (r.encodedBodySize || 0), 0);
      return {
        requests: res.length,
        jsKB: Math.round(sum((r) => /\.js(\?|$)/.test(r.name)) / 1024),
        customKB: Math.round(sum((r) => /\/(hacsfiles|local)\//.test(r.name)) / 1024),
        tbt: Math.round(window.__kh.tbt),
        longTasks: window.__kh.longTasks,
        domNodes: (function count(root) {
          let n = 0;
          for (const el of root.querySelectorAll("*")) { n++; if (el.shadowRoot) n += count(el.shadowRoot); }
          return n;
        })(document),
      };
    });
    rows.push({ name, run: i + 1, readyMs: ready, ...m });
    await context.close();
  }
}
await browser.close();
console.table(rows);
const med = (name, k) => {
  const v = rows.filter((r) => r.name === name).map((r) => r[k]).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};
console.log("median", Object.keys(targets).map((n) =>
  `${n}: ready ${med(n, "readyMs")} ms, TBT ${med(n, "tbt")} ms, JS ${med(n, "jsKB")} KB, custom ${med(n, "customKB")} KB, ${med(n, "requests")} req, ${med(n, "domNodes")} nodes`).join(" | "));
