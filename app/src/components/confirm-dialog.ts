import { LitElement, css, html } from "lit";
import { store } from "../store.ts";
import { base, tokens } from "../styles.ts";

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}

class KhConfirmDialog extends LitElement {
  static properties = { options: { attribute: false } };
  declare options: ConfirmOptions;
  resolve?: (ok: boolean) => void;

  static styles = [
    tokens,
    base,
    css`
      dialog {
        border: 1px solid var(--kh-line);
        border-radius: var(--kh-radius);
        background: var(--kh-surface);
        color: var(--kh-text);
        padding: 24px;
        width: min(420px, calc(100vw - 32px));
        box-sizing: border-box;
      }
      dialog::backdrop {
        background: rgb(14 10 21 / 0.55);
      }
      h2 {
        margin: 0 0 8px;
        font-size: 1.25rem;
      }
      p {
        margin: 0 0 24px;
        color: var(--kh-text-2);
        line-height: 1.45;
      }
      .actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .actions button {
        min-height: var(--kh-tap);
        padding: 0 20px;
        border-radius: var(--kh-radius-sm);
        font-weight: 700;
      }
      .cancel {
        background: var(--kh-surface-2);
      }
      .confirm {
        background: var(--kh-accent);
        color: var(--kh-on-accent);
      }
      .confirm.danger {
        background: var(--kh-alert);
        color: var(--kh-on-alert);
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
        <h2 id="kh-confirm-title">${o.title}</h2>
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
