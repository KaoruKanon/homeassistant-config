import { LitElement, css, html } from "lit";

/**
 * Swipeable pages (the old swipe-card): each child is a page. Finger swipe
 * on touch screens, drag or dots with a mouse; snaps page by page.
 */
export class KhSwipe extends LitElement {
  static properties = { pages: { state: true }, current: { state: true }, label: {} };
  declare pages: number;
  declare current: number;
  declare label?: string;
  private drag?: { x: number; left: number };

  constructor() {
    super();
    this.pages = 0;
    this.current = 0;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }
    .track {
      display: flex;
      gap: var(--swipe-gap, 16px);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      overscroll-behavior-x: contain;
      cursor: grab;
      border-radius: var(--kh-radius);
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .track.dragging {
      cursor: grabbing;
      scroll-snap-type: none;
    }
    ::slotted(*) {
      flex: 0 0 100%;
      min-width: 0;
      scroll-snap-align: start;
      scroll-snap-stop: always;
      box-sizing: border-box;
    }
    .dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      padding-top: 8px;
    }
    .dots button {
      width: 8px;
      height: 8px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: var(--kh-text-2);
      opacity: 0.35;
      cursor: pointer;
      transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease;
    }
    .dots button[aria-current="true"] {
      width: 22px;
      opacity: 0.9;
    }
  `;

  private get track(): HTMLElement {
    return this.renderRoot.querySelector(".track")!;
  }

  private onSlot(e: Event): void {
    this.pages = (e.target as HTMLSlotElement).assignedElements().length;
  }

  /** One page plus the gap between pages. */
  private get step(): number {
    const t = this.track;
    return Math.max(1, t.clientWidth + (parseFloat(getComputedStyle(t).columnGap) || 0));
  }

  private onScroll(): void {
    this.current = Math.round(this.track.scrollLeft / this.step);
  }

  /** Never rest between two pages, whatever the browser's snapping did. */
  private onScrollEnd(): void {
    if (this.drag) return;
    const t = this.track;
    const target = Math.round(t.scrollLeft / this.step) * this.step;
    if (Math.abs(t.scrollLeft - target) > 2) t.scrollTo({ left: target, behavior: "smooth" });
  }

  private go(i: number): void {
    this.track.scrollTo({ left: i * this.step, behavior: "smooth" });
  }

  // Mouse drag (touch scrolls natively).
  private down = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    this.drag = { x: e.clientX, left: this.track.scrollLeft };
  };
  private move = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 4) this.track.classList.add("dragging");
    this.track.scrollLeft = this.drag.left - dx;
  };
  private up = () => {
    if (!this.drag) return;
    const moved = this.track.classList.contains("dragging");
    this.track.classList.remove("dragging");
    this.drag = undefined;
    this.go(Math.round(this.track.scrollLeft / this.step));
    if (moved) {
      // A drag is not a tap on the card underneath.
      const block = (ev: Event) => ev.stopPropagation();
      this.addEventListener("click", block, { capture: true, once: true });
      setTimeout(() => this.removeEventListener("click", block, { capture: true }), 0);
    }
  };

  render() {
    return html`
      <div
        class="track"
        role="group"
        aria-roledescription="carrousel"
        aria-label=${this.label ?? "Pages"}
        @scroll=${this.onScroll}
        @scrollend=${this.onScrollEnd}
        @pointerdown=${this.down}
        @pointermove=${this.move}
        @pointerup=${this.up}
        @pointerleave=${this.up}
      >
        <slot @slotchange=${this.onSlot}></slot>
      </div>
      ${this.pages > 1
        ? html`<div class="dots">
            ${Array.from({ length: this.pages }, (_, i) =>
              html`<button aria-label="Page ${i + 1}" aria-current=${String(i === this.current)} @click=${() => this.go(i)}></button>`,
            )}
          </div>`
        : ""}
    `;
  }
}
customElements.define("kh-swipe", KhSwipe);
