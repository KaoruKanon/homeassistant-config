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
        color: #fff;
      }
      .confirm.danger {
        background: var(--kh-alert);
      }
    `,
  ];

  firstUpdated(): void {
    const dialog = this.renderRoot.querySelector("dialog")!;
    dialog.showModal();
    // Cancel is focused first: confirming must be a deliberate second tap.
    (this.renderRoot.querySelector(".cancel") as HTMLButtonElement).focus();
  }

  private close(ok: boolean): void {
    this.resolve?.(ok);
    this.remove();
  }

  render() {
    const o = this.options;
    return html`
      <dialog @cancel=${(e: Event) => (e.preventDefault(), this.close(false))}>
        <h2>${o.title}</h2>
        <p>${o.body}</p>
        <div class="actions">
          <button class="cancel" @click=${() => this.close(false)}>Annuler</button>
          <button class="confirm ${o.danger ? "danger" : ""}" @click=${() => this.close(true)}>
            ${o.confirmLabel}
          </button>
        </div>
      </dialog>
    `;
  }
}
customElements.define("kh-confirm-dialog", KhConfirmDialog);

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement("kh-confirm-dialog") as KhConfirmDialog;
    el.options = options;
    el.resolve = resolve;
    if (store.hass?.themes.darkMode) el.setAttribute("dark", "");
    document.body.append(el);
  });
}
