/** Navigates inside the panel (HA's router listens to location-changed), with a cross-fade where supported. */
export function goTo(path: string): void {
  const go = () => {
    history.pushState(null, "", path + location.search);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(go);
  else go();
}

/**
 * Mouse drag on horizontal scrollers (rows that swipe by touch): the same
 * gesture with a mouse on a PC. Snap is paused while dragging, and the click
 * that ends a drag is swallowed.
 */
export function installDragScroll(): () => void {
  const scrollerOf = (e: PointerEvent): HTMLElement | undefined =>
    (e.composedPath() as HTMLElement[]).find((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.scrollWidth <= el.clientWidth + 1) return false;
      const o = getComputedStyle(el).overflowX;
      return o === "auto" || o === "scroll";
    });
  let drag: { el: HTMLElement; x: number; left: number; moved: boolean; snap: string } | undefined;
  const down = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollerOf(e);
    if (el) drag = { el, x: e.clientX, left: el.scrollLeft, moved: false, snap: el.style.scrollSnapType };
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.el.style.scrollSnapType = "none";
      drag.el.style.cursor = "grabbing";
    }
    drag.el.scrollLeft = drag.left - dx;
  };
  const up = () => {
    if (!drag) return;
    const d = drag;
    drag = undefined;
    d.el.style.cursor = "";
    if (!d.moved) return;
    // Let the snap settle on the nearest stop, then swallow the click.
    const left = d.el.scrollLeft;
    d.el.style.scrollSnapType = d.snap;
    d.el.scrollLeft = left;
    window.addEventListener("click", (c) => (c.preventDefault(), c.stopPropagation()), { capture: true, once: true });
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  return () => {
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
  };
}
