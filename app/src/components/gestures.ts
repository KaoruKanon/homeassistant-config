/**
 * Tap / hold on one element, the Mushroom way: a tap runs the main action, a
 * long press (500 ms) opens the details. Keep one instance per element (a
 * field), so a re-render during a press does not lose the timer.
 */
export class Press {
  private timer = 0;
  private held = false;

  constructor(
    private onTap: () => void,
    private onHold: () => void,
  ) {}

  down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.held = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.held = true;
      navigator.vibrate?.(15);
      this.onHold();
    }, 500);
  };

  cancel = (): void => {
    window.clearTimeout(this.timer);
  };

  click = (e: MouseEvent): void => {
    window.clearTimeout(this.timer);
    if (this.held) {
      e.preventDefault();
      this.held = false;
      return;
    }
    this.onTap();
  };

  /** The long-press menu of mobile browsers would cover our popup. */
  contextmenu = (e: Event): void => e.preventDefault();
}

/**
 * Starts a ripple at the pointer on the nearest button / link of the event
 * path (the panel and popups listen once, so every button gets it).
 */
export function ripple(e: PointerEvent): void {
  const target = (e.composedPath() as Element[]).find(
    (el) => el instanceof HTMLElement && (el.tagName === "BUTTON" || el.tagName === "A"),
  ) as HTMLElement | undefined;
  if (!target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = target.getBoundingClientRect();
  target.style.setProperty("--rx", `${e.clientX - r.left}px`);
  target.style.setProperty("--ry", `${e.clientY - r.top}px`);
  target.classList.remove("rippling");
  void target.offsetWidth; // restart the animation
  target.classList.add("rippling");
  window.setTimeout(() => target.classList.remove("rippling"), 600);
}
