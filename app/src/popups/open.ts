// The details popups are downloaded on the first tap (or once the page is
// idle, see preloadPopups), so the first screen does not pay for them.
export { ago, alarmLook } from "../format.ts";

type Popups = typeof import("./index.ts");
const popups = () => import("./index.ts");

function lazy<K extends keyof Popups>(name: K): Popups[K] {
  return ((...args: unknown[]) => void popups().then((m) => (m[name] as (...a: unknown[]) => void)(...args))) as Popups[K];
}

export const openComputer = lazy("openComputer");
export const openPerson = lazy("openPerson");
export const openTracker = lazy("openTracker");
export const openThermometer = lazy("openThermometer");
export const openOpenings = lazy("openOpenings");
export const openWifiQr = lazy("openWifiQr");
export const openMediaItem = lazy("openMediaItem");
export const openTablet = lazy("openTablet");
export const openAlarm = lazy("openAlarm");

export function preloadPopups(): void {
  void popups();
}
