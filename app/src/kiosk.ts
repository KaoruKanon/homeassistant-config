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
