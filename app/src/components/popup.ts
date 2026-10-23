import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base, tokens } from "../styles.ts";
import { installPressFeedback } from "./gestures.ts";

export interface PopupSpec {
  title: string;
  icon?: string;
  /** Mushroom colour token name, e.g. "blue" → --rgb-blue */
  color?: string;
  /** Entities whose changes re-render the popup. */
  watch: string[];
  body: () => TemplateResult | typeof nothing;
}

/**
 * Details popup replacing the browser_mod ones: a sheet rising from the
 * bottom on phones, a centred card on tablets and PCs. Esc, the backdrop and
 * the close button dismiss it; focus returns to what opened it.
 */
class KhPopup extends LitElement {
  static properties = { spec: { attribute: false } };
  declare spec: PopupSpec;
  private opener: Element | null = null;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => this.spec?.watch ?? []);
  }

  static styles = [
    tokens,
    base,
    css`
      dialog {
        border: 0;
        padding: 0;
        width: min(560px, calc(100vw - 32px));
        max-height: calc(100dvh - 48px);
        border-radius: 24px;
        background: var(--kh-dialog);
        color: var(--kh-text);
        box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
        overflow: hidden;
      }
      dialog::backdrop {
        background: rgb(0 0 0 / 0.45);
        backdrop-filter: blur(6px);
        animation: fade 220ms ease-out;
      }
      dialog[open] {
        animation: spring 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes spring {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(12px);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @media (max-width: 599px) {
        dialog {
          margin: auto 0 0;
          width: 100vw;
          max-width: 100vw;
          max-height: 88dvh;
          border-radius: 24px 24px 0 0;
          padding-bottom: env(safe-area-inset-bottom);
        }
        dialog[open] {
          animation: rise 220ms ease-out;
        }
      }
      @keyframes rise {
        from {
          transform: translateY(40px);
          opacity: 0.4;
        }
      }
      header {
        touch-action: none;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 16px 8px;
      }
      header h2 {
        flex: 1;
        margin: 0;
        font-size: 1.25rem;
      }
      .close {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--kh-card-2);
      }
      .body {
        padding: 8px 16px 20px;
        overflow-y: auto;
        max-height: calc(88dvh - 80px);
        display: grid;
        gap: 12px;
      }
      /* Building blocks used by popups/*.ts */
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--kh-radius);
        background: var(--kh-card-2);
        text-align: left;
        width: 100%;
        box-sizing: border-box;
      }
      .row > div {
        flex: 1;
        min-width: 0;
      }
      .row .value {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .bar {
        display: grid;
        gap: 6px;
      }
      .bar .track {
        height: 10px;
        border-radius: 5px;
        background: var(--kh-card-2);
        overflow: hidden;
      }
      .bar .fill {
        height: 100%;
        border-radius: 5px;
        background: rgb(var(--rgb, var(--rgb-blue)));
      }
      .bar .label {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .grid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        padding: 0 14px;
        border-radius: var(--kh-radius-icon);
        background: rgba(var(--rgb, var(--rgb-blue)), 0.2);
        font-weight: 700;
      }
      .shot {
        width: 100%;
        border-radius: var(--kh-radius);
        display: block;
        background: var(--kh-card-2);
        min-height: 120px;
        object-fit: cover;
      }
      .muted {
        color: var(--kh-text-2);
        font-size: 0.875rem;
      }
      /* Light popup */
      .big-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-radius: var(--kh-radius);
        background: var(--kh-card-2);
        font-weight: 700;
        font-size: 1.0625rem;
      }
      .big-toggle.on {
        background: rgba(var(--rgb-amber), 0.25);
      }
      .switch {
        width: 52px;
        height: 30px;
        border-radius: 15px;
        background: var(--kh-card-2);
        position: relative;
        transition: background-color 250ms ease;
      }
      .switch::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .on .switch {
        background: rgb(var(--rgb-amber));
      }
      .on .switch::after {
        transform: translateX(22px);
      }
      .slider-block {
        display: grid;
        gap: 8px;
      }
      .slider-block .label {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }
      .fat {
        appearance: none;
        -webkit-appearance: none;
        width: 100%;
        height: 56px;
        margin: 0;
        border-radius: 16px;
        cursor: pointer;
      }
      .fat::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 8px;
        height: 34px;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
      }
      .fat::-moz-range-thumb {
        width: 8px;
        height: 34px;
        border: 0;
        border-radius: 4px;
        background: #fff;
      }
      .swatches {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
        gap: 10px;
      }
      .swatch {
        aspect-ratio: 1;
        border-radius: 50%;
        box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.15);
      }
      .chips {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
        scrollbar-width: thin;
      }
      .chip {
        flex: none;
        min-height: 38px;
        padding: 0 14px;
        border-radius: 999px;
        background: var(--kh-card-2);
        font-weight: 600;
        font-size: 0.875rem;
      }
      .chip.active {
        background: rgba(var(--rgb-amber), 0.3);
      }
      .link {
        justify-self: start;
        color: var(--kh-text-2);
        font-weight: 600;
        font-size: 0.875rem;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
      }
      .hero-value {
        font-size: 2.75rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .hero-value small {
        font-size: 1rem;
        color: var(--kh-text-2);
        margin-left: 4px;
      }
    `,
  ];

  /** True when opening the popup added a history entry (Back closes it). */
  pushed = false;
  private dragStart?: number;

  firstUpdated(): void {
    this.opener = deepActive();
    installPressFeedback(this.renderRoot as ShadowRoot);
    this.renderRoot.querySelector("dialog")!.showModal();
  }

  /** fromHistory: the Back gesture already removed our history entry. */
  close(fromHistory = false): void {
    if (!this.isConnected) return;
    this.renderRoot.querySelector("dialog")?.close();
    this.remove();
    if (current === this) current = undefined;
    if (this.pushed && !fromHistory) history.back();
    (this.opener as HTMLElement | null)?.focus?.();
  }

  // Swipe the sheet down to close it (phones).
  private dragDown = (e: PointerEvent) => (this.dragStart = e.clientY);
  private dragMove = (e: PointerEvent) => {
    if (this.dragStart === undefined) return;
    const dy = Math.max(0, e.clientY - this.dragStart);
    const d = this.renderRoot.querySelector("dialog");
    if (d) d.style.transform = `translateY(${dy}px)`;
  };
  private dragEnd = (e: PointerEvent) => {
    if (this.dragStart === undefined) return;
    const dy = e.clientY - this.dragStart;
    this.dragStart = undefined;
    const d = this.renderRoot.querySelector("dialog");
    if (dy > 90) this.close();
    else if (d) d.style.transform = "";
  };

  render() {
    const s = this.spec;
    if (!s || !store.hass) return nothing;
    return html`<dialog
      aria-labelledby="kh-popup-title"
      @cancel=${(e: Event) => (e.preventDefault(), this.close())}
      @click=${(e: Event) => e.target === e.currentTarget && this.close()}
    >
      <header @pointerdown=${this.dragDown} @pointermove=${this.dragMove} @pointerup=${this.dragEnd} @pointercancel=${this.dragEnd}>
        ${s.icon ? html`<span class="shape" style="--rgb: var(--rgb-${s.color ?? "blue"})"><ha-icon icon=${s.icon}></ha-icon></span>` : nothing}
        <h2 id="kh-popup-title">${s.title}</h2>
        <button class="close" aria-label="Fermer" @click=${() => this.close()}><ha-icon icon="mdi:close"></ha-icon></button>
      </header>
      <div class="body">${s.body()}</div>
    </dialog>`;
  }
}
customElements.define("kh-popup", KhPopup);

function deepActive(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

let current: KhPopup | undefined;

// Back (Android gesture, browser button) closes the popup instead of leaving the page.
window.addEventListener("popstate", () => current?.close(true));

export function openPopup(spec: PopupSpec): void {
  const replacing = !!current;
  if (current) {
    current.pushed = false; // keep the history entry for the new popup
    current.close();
  }
  const el = document.createElement("kh-popup") as KhPopup;
  el.spec = spec;
  if (store.hass?.themes.darkMode) el.setAttribute("dark", "");
  if (!replacing) history.pushState({ khPopup: true }, "", location.href);
  el.pushed = true;
  current = el;
  document.body.append(el);
}

export function closePopup(): void {
  current?.close();
}
