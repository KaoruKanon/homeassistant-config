/**
 * Tap / hold on one element, the Mushroom way: a tap runs the main action, a
 * long press (500 ms) opens the details. Keep one instance per element (a
 * field), so a re-render during a press does not lose the timer.
 */
const SLOP_PX = 8;

export class Press {
  private timer = 0;
  private held = false;
  private start?: { x: number; y: number };

  private tapTimer = 0;

  /**
   * `double`: a double tap opens the details too; a single tap then waits
   * 260 ms to be sure it is not the first of two (for actions like starting
   * a PC, which a double tap must not run twice).
   */
  constructor(
    private onTap: () => void,
    private onHold: () => void,
    private double = false,
  ) {}

  down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.held = false;
    this.start = { x: e.clientX, y: e.clientY };
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.held = true;
      navigator.vibrate?.(15);
      this.onHold();
    }, 500);
  };

  cancel = (): void => {
    window.clearTimeout(this.timer);
    this.start = undefined;
  };

  /** The finger moves (scrolling): this is not a press any more. */
  move = (e: PointerEvent): void => {
    if (this.start && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > SLOP_PX) this.cancel();
  };

  click = (e: MouseEvent): void => {
    window.clearTimeout(this.timer);
    if (this.held) {
      e.preventDefault();
      this.held = false;
      return;
    }
    if (!this.double) return this.onTap();
    if (this.tapTimer) {
      window.clearTimeout(this.tapTimer);
      this.tapTimer = 0;
      this.onHold();
      return;
    }
    this.tapTimer = window.setTimeout(() => {
      this.tapTimer = 0;
      this.onTap();
    }, 260);
  };

  /** The long-press menu of mobile browsers would cover our popup. */
  contextmenu = (e: Event): void => e.preventDefault();
}

/**
 * Touch feedback for every button and link under `root`, without reacting to
 * scrolls: the press shows only once the finger has stayed still ~70 ms (or
 * on release of a quick tap); moving more than 8 px cancels it. A real tap
 * ends with a short vibration on phones that support it.
 */
export function installPressFeedback(root: HTMLElement | ShadowRoot): void {
  let target: HTMLElement | undefined;
  let x = 0, y = 0, timer = 0, shown = false;

  const show = () => {
    if (!target || shown) return;
    shown = true;
    target.classList.add("pressed");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = target.getBoundingClientRect();
    target.style.setProperty("--rx", `${x - r.left}px`);
    target.style.setProperty("--ry", `${y - r.top}px`);
    target.classList.remove("rippling");
    void target.offsetWidth;
    target.classList.add("rippling");
    const t = target;
    window.setTimeout(() => t.classList.remove("rippling"), 600);
  };
  const clear = () => {
    window.clearTimeout(timer);
    const t = target;
    target = undefined;
    shown = false;
    if (t) window.setTimeout(() => t.classList.remove("pressed"), 90);
  };

  root.addEventListener("pointerdown", (ev) => {
    const e = ev as PointerEvent;
    if (e.button !== 0) return;
    target = (e.composedPath() as Element[]).find(
      (el) => el instanceof HTMLElement && (el.tagName === "BUTTON" || el.tagName === "A"),
    ) as HTMLElement | undefined;
    x = e.clientX;
    y = e.clientY;
    shown = false;
    window.clearTimeout(timer);
    if (target) timer = window.setTimeout(show, e.pointerType === "mouse" ? 0 : 70);
  }, { passive: true });
  root.addEventListener("pointermove", (ev) => {
    const e = ev as PointerEvent;
    if (target && Math.hypot(e.clientX - x, e.clientY - y) > SLOP_PX) {
      target.classList.remove("rippling");
      clear();
    }
  }, { passive: true });
  root.addEventListener("pointerup", () => {
    if (target && !shown) show(); // a quick tap still gets its feedback
    if (target) navigator.vibrate?.(8);
    clear();
  }, { passive: true });
  root.addEventListener("pointercancel", () => {
    target?.classList.remove("rippling");
    clear();
  }, { passive: true });
}

const pcPresses = new Map<string, Press>();
/**
 * The shared gesture of a PC wherever it is shown (tile, plan badges): tap
 * to start or (after a confirmation) shut it down, long press or double
 * tap for its details. One instance per PC.
 */
export function pcPress(entity: string, onTap: () => void, onHold: () => void): Press {
  let p = pcPresses.get(entity);
  if (!p) pcPresses.set(entity, (p = new Press(onTap, onHold, true)));
  return p;
}

/**
 * A new page starts at its top. HA scrolls the window, or an element of its
 * own (the panel host) depending on the version: reset every scroller found
 * between the panel and the page.
 */
export function scrollToTop(from: HTMLElement): void {
  window.scrollTo({ top: 0 });
  document.scrollingElement?.scrollTo({ top: 0 });
  for (let n: Node | null = from; n; n = (n as Element).assignedSlot ?? n.parentNode ?? (n as ShadowRoot).host ?? null) {
    if (n instanceof HTMLElement && n.scrollTop > 0) n.scrollTop = 0;
  }
}
