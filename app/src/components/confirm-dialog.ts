import { LitElement, css, html } from "lit";
import { store } from "../store.ts";
import { tokens } from "../styles.ts";
import { ui } from "../v3/theme.ts";
import { glyph, overlayTokens, toneCss } from "./toast.ts";

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}

/** A question before a sensitive action, in the V3 style (V1/V2 fall back to their colours). */
class KhConfirmDialog extends LitElement {
  static properties = { options: { attribute: false } };
  declare options: ConfirmOptions;
  resolve?: (ok: boolean) => void;

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
        border-radius: 26px;
        background: var(--surf);
        color: var(--ink);
        padding: 22px;
        width: min(420px, calc(100vw - 32px));
        box-shadow: 0 24px 60px rgb(0 0 0 / 0.35);
      }
      dialog::backdrop {
        background: rgb(8 10 20 / 0.5);
        animation: fade 180ms ease-out;
      }
      dialog[open] {
        animation: pop 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: scale(0.97);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        dialog[open],
        dialog::backdrop {
          animation: none;
        }
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .head .ico {
        width: 44px;
        height: 44px;
        border-radius: 14px;
      }
      .head .ico svg {
        width: 22px;
        height: 22px;
      }
      h2 {
        font-family: "Bricolage Grotesque", system-ui, sans-serif;
        font-weight: 700;
        font-size: 20px;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }
      p {
        margin: 0 0 20px;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.45;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .actions button {
        min-height: 48px;
        padding: 0 16px;
        border-radius: 14px;
        font-weight: 700;
        font-size: 14px;
        transition: transform 0.12s;
      }
      .actions button:active {
        transform: scale(0.97);
      }
      .cancel {
        background: var(--surf2);
      }
      .confirm {
        background: var(--blue);
        color: var(--surf);
      }
      .confirm.danger {
        background: var(--red);
        color: var(--surf);
      }
    `,
  ];

  /** Tap-through guard: a confirm needs a press that starts after this time. */
  private openedAt = 0;
  private armed = false;
  private opener: Element | null = null;

  firstUpdated(): void {
    this.opener = deepActiveElement();
    const dialog = this.renderRoot.querySelector("dialog")!;
    dialog.showModal();
    this.openedAt = performance.now();
    // Cancel is focused first: confirming must be a deliberate second action.
    (this.renderRoot.querySelector(".cancel") as HTMLButtonElement).focus();
  }

  close(ok: boolean): void {
    if (!this.isConnected) return;
    this.renderRoot.querySelector("dialog")?.close();
    this.remove();
    (this.opener as HTMLElement | null)?.focus?.();
    this.resolve?.(ok);
  }

  private arm(): void {
    // The second tap of a double tap lands ~200 ms after the dialog opened.
    this.armed = performance.now() - this.openedAt > ARM_DELAY_MS;
  }

  private onConfirm(e: Event): void {
    const keyboard = (e as PointerEvent).detail === 0; // Enter / Space on the focused button
    if (!keyboard && !this.armed) return;
    this.close(true);
  }

  render() {
    const o = this.options;
    return html`
      <dialog
        aria-labelledby="kh-confirm-title"
        aria-describedby="kh-confirm-body"
        @cancel=${(e: Event) => (e.preventDefault(), this.close(false))}
      >
        <div class="head">
          <span class="ico ${o.danger ? "t-red" : "t-blue"}">${glyph(o.danger ? "alert" : "question", 22)}</span>
          <h2 id="kh-confirm-title">${o.title}</h2>
        </div>
        <p id="kh-confirm-body">${o.body}</p>
        <div class="actions">
          <button class="cancel" @click=${() => this.close(false)}>Annuler</button>
          <button
            class="confirm ${o.danger ? "danger" : ""}"
            @pointerdown=${this.arm}
            @click=${this.onConfirm}
          >
            ${o.confirmLabel}
          </button>
        </div>
      </dialog>
    `;
  }
}
customElements.define("kh-confirm-dialog", KhConfirmDialog);

const ARM_DELAY_MS = 500;
const TIMEOUT_MS = 30_000;

function deepActiveElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

let current: KhConfirmDialog | undefined;

/** Closes an open confirmation as cancelled (panel left, state changed...). */
export function cancelConfirmation(): void {
  current?.close(false);
}

/**
 * Asks before a sensitive action. Resolves false on cancel, on timeout, and
 * when `entityId` changes state while the question is on screen: the answer
 * must be about the state the person saw.
 */
export function confirmAction(options: ConfirmOptions, entityId?: string): Promise<boolean> {
  cancelConfirmation();
  return new Promise((resolve) => {
    const el = document.createElement("kh-confirm-dialog") as KhConfirmDialog;
    const timer = window.setTimeout(() => el.close(false), TIMEOUT_MS);
    const unsubscribe = entityId ? store.subscribe([entityId], () => el.close(false)) : () => {};
    el.options = options;
    el.resolve = (ok) => {
      window.clearTimeout(timer);
      unsubscribe();
      if (current === el) current = undefined;
      resolve(ok);
    };
    if (store.hass?.themes.darkMode) el.setAttribute("dark", "");
    current = el;
    document.body.append(el);
  });
}
