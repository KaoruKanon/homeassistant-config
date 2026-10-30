import { LitElement, css } from "lit";
import type { HouseModel, Room } from "../rooms.ts";
import { RegistryController } from "../store.ts";
import type { ThemeChoice } from "./theme.ts";
import { ui } from "./theme.ts";

/** What the shell hands every page. */
export interface PageProps {
  prefix: string;
  model: HouseModel;
  rooms: Room[];
  phone: boolean;
  /** Second path segment (a room id on Maison). */
  sub?: string;
  theme: ThemeChoice;
  person?: string;
}

/** Base of the V3 pages: props from the shell, registry-driven updates, shared styles. */
export class Page extends LitElement {
  static properties = { p: { attribute: false } };
  declare p: PageProps;

  constructor() {
    super();
    new RegistryController(this);
  }

  static styles = [
    ui,
    css`
      :host {
        display: block;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 56px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .top .grow {
        flex: 1;
      }
      .card h2 {
        margin-bottom: 10px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 16px;
        background: var(--surf2);
        text-align: left;
        width: 100%;
        min-width: 0;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `,
  ];
}

const HOLD_MS = 500;
const SLOP = 10;

/**
 * Tap / long press / horizontal drag on one element. A drag (light tiles)
 * reports a 0..1 position while the finger moves and when it lifts; the tap
 * that would follow is swallowed. Keep one instance per element.
 */
export class Gesture {
  private timer = 0;
  private held = false;
  private dragging = false;
  private start?: { x: number; y: number; rect: DOMRect };

  constructor(
    private onTap: () => void,
    private onHold: () => void,
    private onDrag?: (ratio: number, done: boolean) => void,
  ) {}

  down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.held = false;
    this.dragging = false;
    const el = e.currentTarget as HTMLElement;
    this.start = { x: e.clientX, y: e.clientY, rect: el.getBoundingClientRect() };
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.held = true;
      navigator.vibrate?.(15);
      this.onHold();
    }, HOLD_MS);
  };

  move = (e: PointerEvent): void => {
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (!this.dragging && Math.hypot(dx, dy) > SLOP) {
      window.clearTimeout(this.timer);
      if (this.onDrag && Math.abs(dx) > Math.abs(dy)) {
        this.dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } else {
        this.start = undefined;
        return;
      }
    }
    if (this.dragging) this.onDrag!(this.ratio(e), false);
  };

  up = (e: PointerEvent): void => {
    window.clearTimeout(this.timer);
    if (this.dragging && this.start) this.onDrag!(this.ratio(e), true);
  };

  cancel = (): void => {
    window.clearTimeout(this.timer);
    if (this.dragging) this.onDrag?.(-1, true);
    this.start = undefined;
    this.dragging = false;
  };

  click = (e: MouseEvent): void => {
    window.clearTimeout(this.timer);
    if (this.held || this.dragging) {
      e.preventDefault();
      this.held = false;
      this.dragging = false;
      return;
    }
    this.onTap();
  };

  key = (e: KeyboardEvent): void => {
    // Keyboard: Enter / Space act as a tap (native on buttons); "d" opens the details.
    if (e.key === "d" || e.key === "ContextMenu") {
      e.preventDefault();
      this.onHold();
    }
  };

  contextmenu = (e: Event): void => e.preventDefault();

  private ratio(e: PointerEvent): number {
    const r = this.start!.rect;
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  }
}
