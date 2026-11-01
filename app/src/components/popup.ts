import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { tokens } from "../styles.ts";
import { icon } from "../v3/icons.ts";
import { ui } from "../v3/theme.ts";
import { glyph, overlayTokens, toneCss, toneOf } from "./toast.ts";

export { glyph, toneOf };

export interface PopupSpec {
  title: string;
  /** "mdi:…" (from config / entities) or a V3 icon name. */
  icon?: string;
  /** Mushroom colour name, e.g. "blue", "amber"; mapped to a V3 tone. */
  color?: string;
  /** A round photo instead of the icon (people); ring in teal when home. */
  picture?: () => { src?: string; initial: string; home: boolean } | undefined;
  /** A short line under the title, re-evaluated on every render. */
  subtitle?: () => string | undefined;
  /** Entities whose changes re-render the popup. */
  watch: string[];
  body: () => TemplateResult | typeof nothing;
}

// ---- Building blocks for popups/*.ts ----

export interface RowSpec {
  icon: string;
  color?: string;
  label: string;
  sub?: string;
  value?: string;
  onClick?: () => void;
  /** A switch on the right; the row becomes role="switch". */
  checked?: boolean;
  /** A chevron on the right (opens something). */
  chevron?: boolean;
  /** Tinted background (the "on" look). */
  lit?: boolean;
  big?: boolean;
}

/** A V3 row: tinted icon square, name and detail, value or switch on the right. */
export function row(r: RowSpec): TemplateResult {
  const cls = `row t-${toneOf(r.color)} ${r.lit ? "on" : ""} ${r.big ? "big" : ""} ${r.checked ? "checked" : ""}`;
  const content = html`<span class="ico">${glyph(r.icon, r.big ? 22 : 20)}</span>
    <span class="grow"><span class="nm ell">${r.label}</span>${r.sub ? html`<span class="st">${r.sub}</span>` : nothing}</span>
    ${r.value ? html`<span class="val num">${r.value}</span>` : nothing}
    ${r.checked !== undefined ? html`<span class="switch" aria-hidden="true"></span>` : nothing}
    ${r.chevron ? html`<span class="chev">${icon("chevronR", 18)}</span>` : nothing}`;
  if (!r.onClick) return html`<div class=${cls}>${content}</div>`;
  return r.checked !== undefined
    ? html`<button class=${cls} type="button" role="switch" aria-checked=${String(r.checked)} @click=${r.onClick}>${content}</button>`
    : html`<button class=${cls} type="button" @click=${r.onClick}>${content}</button>`;
}

/** A V3 action button; `solid` for the main one. */
export function action(label: string, iconName: string, color: string, run: () => void, solid = false): TemplateResult {
  return html`<button class="act t-${toneOf(color)} ${solid ? "solid" : ""}" type="button" @click=${run}>${glyph(iconName, 18)}${label}</button>`;
}

export interface SliderSpec {
  label: string;
  icon: string;
  /** Range of the input (raw values, e.g. 0..255). */
  min: number;
  max: number;
  raw: number;
  /** Raw value to the percentage shown. */
  pct: (raw: number) => number;
  /** False: drawn empty, the value reads "—" (light off). */
  on: boolean;
  onChange: (raw: number) => void;
}

/**
 * Big amber slider (brightness): a fill, the icon, the label and the
 * percentage; the native range input on top keeps keyboard and screen
 * readers. The fill and figure follow the finger before the value is sent.
 */
export function bigSlider(o: SliderSpec): TemplateResult {
  const p = Math.round(o.pct(o.raw));
  const preview = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const v = Math.round(o.pct(Number(input.value)));
    const box = input.parentElement!;
    box.style.setProperty("--p", `${v}%`);
    box.style.setProperty("--n", String(v));
    box.classList.remove("off");
  };
  return html`<label class="bright ${o.on ? "" : "off"}" style="--p:${o.on ? p : 0}%;--n:${p}">
    <span class="fill"></span>
    <span class="in">${glyph(o.icon, 22)}<span class="bl">${o.label}</span><span class="bv num"></span></span>
    <input type="range" min=${o.min} max=${o.max} .value=${String(o.raw)} aria-label=${o.label}
      @input=${preview} @change=${(e: Event) => o.onChange(Number((e.target as HTMLInputElement).value))} />
  </label>`;
}

/** Small section title inside a popup. */
export function label(text: string): TemplateResult {
  return html`<h3 class="lbl">${text}</h3>`;
}

/**
 * Details popup replacing the browser_mod ones, in the V3 design: a sheet
 * rising from the bottom on phones, a centred card on tablets and PCs. Esc,
 * the backdrop, the close button and a swipe down dismiss it; focus returns
 * to what opened it.
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
    overlayTokens,
    ui,
    toneCss,
    css`
      :host {
        font-family: var(--kh-font);
      }
      dialog {
        border: 0;
        padding: 0;
        width: min(560px, calc(100vw - 32px));
        max-width: none;
        max-height: calc(100dvh - 48px);
        border-radius: 28px;
        background: var(--surf);
        color: var(--ink);
        box-shadow: 0 24px 60px rgb(0 0 0 / 0.35);
        overflow: hidden;
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
        animation: pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      dialog::backdrop {
        background: rgb(8 10 20 / 0.5);
        animation: fade 200ms ease-out;
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes rise {
        from {
          transform: translateY(48px);
          opacity: 0.5;
        }
      }
      header {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 18px 16px 10px 18px;
        flex: none;
      }
      .grab {
        display: none;
      }
      header .ico {
        width: 44px;
        height: 44px;
        border-radius: 14px;
      }
      header .ico svg {
        width: 22px;
        height: 22px;
      }
      .avatar {
        width: 48px;
        height: 48px;
        flex: none;
        border-radius: 999px;
        overflow: hidden;
        display: grid;
        place-items: center;
        background: var(--violetTint);
        color: var(--violet);
        font-weight: 700;
        font-size: 18px;
        border: 2px solid var(--surf);
        box-shadow: 0 0 0 2.5px var(--muted);
      }
      .avatar.home {
        box-shadow: 0 0 0 2.5px var(--teal);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .titles {
        flex: 1;
        min-width: 0;
      }
      h2 {
        font-family: "Bricolage Grotesque", system-ui, sans-serif;
        font-weight: 700;
        font-size: 21px;
        line-height: 1.2;
        letter-spacing: -0.01em;
        overflow-wrap: anywhere;
      }
      .titles .st {
        font-size: 13px;
        margin-top: 2px;
      }
      .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 6px 18px 20px;
      }

      /* Phones: a sheet from the bottom, with a grab handle. */
      @media (max-width: 699px) {
        dialog {
          margin: auto 0 0;
          width: 100vw;
          max-height: 92dvh;
          border-radius: 28px 28px 0 0;
          padding-bottom: env(safe-area-inset-bottom);
        }
        dialog[open] {
          animation: rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        header {
          padding-top: 22px;
          touch-action: none;
        }
        .grab {
          display: block;
          position: absolute;
          top: 8px;
          left: 50%;
          width: 40px;
          height: 5px;
          margin-left: -20px;
          border-radius: 99px;
          background: var(--muted);
          opacity: 0.35;
        }
        .body {
          padding: 6px 14px 18px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        dialog[open],
        dialog::backdrop {
          animation: none;
        }
      }

      /* Rows. */
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-width: 0;
        min-height: 60px;
        padding: 10px 14px 10px 10px;
        border-radius: 16px;
        background: var(--surf2);
        text-align: left;
        transition: transform 0.12s, background-color 0.2s;
      }
      button.row:active,
      .act:active,
      .key:active,
      .sw:active,
      .meter:active {
        transform: scale(0.98);
      }
      .row.on {
        background: var(--ct);
      }
      .row .grow {
        flex: 1;
        min-width: 0;
      }
      .row .st {
        display: block;
        margin-top: 1px;
      }
      .row .val {
        font-weight: 700;
        font-size: 17px;
        white-space: nowrap;
      }
      .chev {
        color: var(--muted);
        display: grid;
      }
      .row.big {
        min-height: 72px;
      }
      .row.big .ico {
        width: 44px;
        height: 44px;
        border-radius: 14px;
      }
      .row.big .nm {
        font-size: 17px;
        font-weight: 700;
      }
      .row.on .switch,
      .row.checked .switch {
        background: var(--c, var(--blue));
      }
      .row.on .switch::after,
      .row.checked .switch::after {
        transform: translateX(18px);
        background: #fff;
      }
      .lbl {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
        padding: 6px 4px 0;
      }
      .since {
        font-size: 13px;
        color: var(--muted);
        padding: 0 4px;
      }

      /* Figures. */
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
        gap: 8px;
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        border-radius: 16px;
        background: var(--surf2);
        min-width: 0;
      }
      .stat.off {
        opacity: 0.6;
      }
      .stat .top {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .stat .ico {
        width: 32px;
        height: 32px;
        border-radius: 10px;
      }
      .stat .ico svg {
        width: 18px;
        height: 18px;
      }
      .stat .num {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.1;
      }
      .meter {
        display: grid;
        gap: 8px;
        width: 100%;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--surf2);
        text-align: left;
        transition: transform 0.12s;
      }
      .meter .top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
      }
      .meter .num {
        font-size: 16px;
        font-weight: 700;
      }
      .meter .track {
        height: 8px;
        border-radius: 99px;
        background: var(--bg);
        overflow: hidden;
      }
      .meter .fill {
        display: block;
        height: 100%;
        border-radius: 99px;
        background: var(--c, var(--blue));
        transition: width 0.3s;
      }
      .hero {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 4px 4px 0;
      }
      .hero .num {
        font-size: 52px;
        font-weight: 700;
        line-height: 1;
      }
      .hero .u {
        font-size: 18px;
        font-weight: 600;
        color: var(--muted);
      }
      .hero.word .num {
        font-size: 30px;
      }

      /* Actions. */
      .grid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .acts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .acts > * {
        flex: 1 1 160px;
      }
      .act {
        min-height: 52px;
        padding: 0 16px;
        border-radius: 16px;
        background: var(--ct, var(--surf2));
        color: var(--ci, var(--ink));
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        transition: transform 0.12s;
      }
      .act.solid {
        background: var(--c, var(--blue));
        color: var(--surf);
      }
      .act svg {
        width: 18px;
        height: 18px;
      }
      .more {
        justify-self: start;
        background: none;
        color: var(--muted);
        padding: 0 6px;
        min-height: 44px;
      }

      /* Pictures and the map. */
      .shot {
        position: relative;
        display: block;
        width: 100%;
        border-radius: 18px;
        overflow: hidden;
        background: var(--surf2);
      }
      .shot img {
        display: block;
        width: 100%;
        min-height: 120px;
        object-fit: cover;
      }
      .shot .cap {
        position: absolute;
        left: 10px;
        bottom: 10px;
        height: 30px;
        padding: 0 10px;
        border-radius: 99px;
        background: color-mix(in srgb, var(--surf) 88%, transparent);
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .shot .cap svg {
        width: 14px;
        height: 14px;
      }
      .pmap {
        height: 220px;
        border-radius: 18px;
      }
      .qr {
        justify-self: center;
        width: min(100%, 300px);
        padding: 16px;
        border-radius: 22px;
        background: #fff;
      }
      .qr img {
        display: block;
        width: 100%;
      }
      .cover {
        display: block;
        width: 100%;
        max-height: 260px;
        object-fit: cover;
        border-radius: 18px;
        background: var(--surf2);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        height: 28px;
        padding: 0 10px;
        border-radius: 99px;
        background: var(--surf2);
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
      }
      .text {
        font-size: 14px;
        line-height: 1.55;
      }

      /* Alarm code and keypad. */
      .code {
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: var(--surf2);
        font-family: "Bricolage Grotesque", system-ui, sans-serif;
        font-size: 28px;
        letter-spacing: 0.35em;
      }
      .code .ph {
        font-family: inherit;
        letter-spacing: normal;
        font-size: 15px;
        font-weight: 600;
        color: var(--muted);
      }
      .code-input {
        height: 56px;
        padding: 0 16px;
        border: 0;
        border-radius: 16px;
        background: var(--surf2);
        color: inherit;
        font: inherit;
        font-size: 18px;
      }
      .code-input:focus-visible {
        outline: 2px solid var(--blue);
        outline-offset: 2px;
      }
      .keypad {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .key {
        height: 60px;
        border-radius: 18px;
        background: var(--surf2);
        font-family: "Bricolage Grotesque", system-ui, sans-serif;
        font-size: 24px;
        font-weight: 600;
        display: grid;
        place-items: center;
        transition: transform 0.12s;
      }

      /* Light: big brightness slider, white temperature, colours, effects. */
      .bright {
        position: relative;
        display: block;
        height: 72px;
        border-radius: 20px;
        background: var(--surf2);
        overflow: hidden;
        cursor: pointer;
        --p: 0%;
        --n: 0;
      }
      .bright:has(input:focus-visible) {
        outline: 2px solid var(--blue);
        outline-offset: 2px;
      }
      .bright .fill {
        position: absolute;
        inset: 0 auto 0 0;
        width: var(--p);
        background: color-mix(in srgb, var(--amber) 55%, var(--surf2));
        box-shadow: inset -4px 0 0 var(--amber);
        transition: width 0.15s;
      }
      .bright .in {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 18px;
        font-weight: 700;
        pointer-events: none;
        color: var(--ink);
      }
      .bright .in svg {
        color: var(--amberInk);
      }
      .bright .bl {
        flex: 1;
        font-size: 15px;
      }
      .bright .bv {
        font-size: 22px;
      }
      .bright .bv::after {
        counter-reset: p var(--n);
        content: counter(p) " %";
      }
      .bright.off .bv::after {
        content: "—";
      }
      .bright input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }
      .range {
        appearance: none;
        -webkit-appearance: none;
        display: block;
        width: 100%;
        height: 44px;
        margin: 0;
        border-radius: 99px;
        cursor: pointer;
      }
      .range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
      }
      .range::-moz-range-thumb {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
      }
      .range:focus-visible {
        outline: 2px solid var(--blue);
        outline-offset: 3px;
      }
      .ctemp {
        display: grid;
        gap: 8px;
      }
      .ctemp .top {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 600;
        padding: 0 4px;
      }
      .swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .sw {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
        transition: transform 0.12s, box-shadow 0.2s;
      }
      .sw[aria-pressed="true"] {
        box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12), 0 0 0 3px var(--surf), 0 0 0 5px var(--ink);
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pills .pill {
        min-height: 44px;
      }

      /* Landscape tablets (wall tablet, ~1000×600): wider and denser. */
      @media (min-width: 700px) and (max-height: 820px) {
        dialog {
          width: min(760px, calc(100vw - 32px));
          max-height: calc(100dvh - 24px);
        }
        header {
          padding: 14px 16px 6px 18px;
        }
        .body {
          gap: 8px;
          padding: 4px 18px 16px;
        }
        .row {
          min-height: 52px;
          padding-block: 7px;
        }
        .row.big {
          min-height: 60px;
        }
        .bright {
          height: 60px;
        }
        .hero .num {
          font-size: 40px;
        }
        .pmap {
          height: 200px;
        }
        .key {
          height: 52px;
        }
      }
    `,
  ];

  /** True when opening the popup added a history entry (Back closes it). */
  pushed = false;
  private dragStart?: number;

  firstUpdated(): void {
    this.opener = deepActive();
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
  private dragDown = (e: PointerEvent) => {
    if (!matchMedia("(max-width: 699px)").matches || (e.target as Element).closest("button")) return;
    this.dragStart = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
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
    const pic = s.picture?.();
    const sub = s.subtitle?.();
    return html`<dialog
      aria-labelledby="kh-popup-title"
      @cancel=${(e: Event) => (e.preventDefault(), this.close())}
      @click=${(e: Event) => e.target === e.currentTarget && this.close()}
    >
      <header
        class="t-${toneOf(s.color)}"
        @pointerdown=${this.dragDown}
        @pointermove=${this.dragMove}
        @pointerup=${this.dragEnd}
        @pointercancel=${this.dragEnd}
      >
        <span class="grab" aria-hidden="true"></span>
        ${pic
          ? html`<span class="avatar ${pic.home ? "home" : ""}" aria-hidden="true">
              ${pic.src ? html`<img src=${pic.src} alt="" width="48" height="48" decoding="async" />` : pic.initial}
            </span>`
          : s.icon
            ? html`<span class="ico">${glyph(s.icon, 22)}</span>`
            : nothing}
        <div class="titles">
          <h2 id="kh-popup-title">${s.title}</h2>
          ${sub ? html`<p class="st">${sub}</p>` : nothing}
        </div>
        <button class="rb" type="button" aria-label="Fermer" @click=${() => this.close()}>${icon("close")}</button>
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
  // On the document, not in HA's shadow root: the V3 theme rule (themeShared)
  // reaches it there. The dialog is in the top layer anyway.
  document.body.append(el);
}

/** Re-renders the open popup (state kept by its body, e.g. a code being typed). */
export function refreshPopup(): void {
  current?.requestUpdate();
}

export function closePopup(): void {
  current?.close();
}
