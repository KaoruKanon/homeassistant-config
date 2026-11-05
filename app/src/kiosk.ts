/**
 * Kiosk (the wall tablet): `?kiosk` in the URL turns on Home Assistant's own
 * kiosk mode (no sidebar, no header; the menu still opens as a drawer), and
 * that browser remembers it, so a later navigation without `?kiosk` keeps it.
 * `?kiosk=0` turns it off again.
 */
const KEY = "kh-kiosk";

export function isKiosk(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return new URLSearchParams(location.search).has("kiosk");
  }
}

export function applyKiosk(): void {
  const q = new URLSearchParams(location.search);
  try {
    if (q.get("kiosk") === "0") localStorage.removeItem(KEY);
    else if (q.has("kiosk")) localStorage.setItem(KEY, "1");
  } catch {
    /* no storage: only while ?kiosk is in the URL */
  }
  if (isKiosk()) window.dispatchEvent(new CustomEvent("hass-kiosk-mode", { detail: { enable: true } }));
}

const TOUCH = ["pointerdown", "keydown", "wheel"];

/**
 * Calls `back` once after `ms` without a touch, then again only after the next
 * touch. Checked on an interval and when the page shows again, not with a
 * single timeout: Fully Kiosk pauses the WebView's timers while the screen is off.
 */
export function installIdleReturn(ms: number, back: () => void): () => void {
  let last = Date.now();
  let done = false;
  const touch = () => {
    last = Date.now();
    done = false;
  };
  const check = () => {
    if (done || Date.now() - last < ms) return;
    done = true;
    back();
  };
  for (const e of TOUCH) window.addEventListener(e, touch, { capture: true, passive: true });
  document.addEventListener("visibilitychange", check);
  const timer = setInterval(check, Math.min(30_000, ms));
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", check);
    for (const e of TOUCH) window.removeEventListener(e, touch, { capture: true });
  };
}
