import { css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { confirmAction } from "../../components/confirm-dialog.ts";
import { inFrench, showToast } from "../../components/toast.ts";
import { config } from "../../config.ts";
import { entityName } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import { todoItems, type TodoItem } from "../data.ts";
import { icon } from "../icons.ts";
import { Page } from "../page.ts";

// HA's TodoListEntityFeature bits.
const CREATE = 1, DELETE = 2, UPDATE = 4;

/** Service call with the app's French error toast (actions.ts has no to-do helpers). */
async function call(service: string, entityId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  const hass = store.hass;
  if (!hass) return false;
  try {
    await hass.callService("todo", service, data, { entity_id: entityId }, false);
    return true;
  } catch (err) {
    showToast({ kind: "error", message: inFrench((err as { message?: string })?.message ?? String(err)) });
    return false;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/**
 * Listes: Home Assistant's to-do lists (shopping list…). One card per list
 * with a field to add, a tap to check or uncheck, and the checked items
 * kept apart (a tap puts one back on the list). Items arrive live through
 * a subscription. On phones with several lists, pills switch between them.
 */
export class Kh3Listes extends Page {
  static properties = { ...Page.properties, items: { state: true }, active: { state: true }, showDone: { state: true }, drafts: { state: true } };
  /** Items per list, undefined while loading. */
  declare items: Record<string, TodoItem[] | undefined>;
  /** List shown on phones. */
  declare active?: string;
  /** Checked items unfolded, per list. */
  declare showDone: Record<string, boolean>;
  declare drafts: Record<string, string>;
  private subs = new Map<string, (() => void) | undefined>();
  private seen = new Map<string, string>();

  constructor() {
    super();
    this.items = {};
    this.showDone = {};
    this.drafts = {};
    new EntitiesController(this, () => this.ids());
  }

  private ids(): string[] {
    return Object.keys(store.hass?.states ?? {})
      .filter((id) => id.startsWith("todo."))
      .sort((a, b) => this.name(a).localeCompare(this.name(b), "fr"));
  }

  private name(id: string): string {
    const hass = store.hass;
    if (!hass) return id;
    const n = entityName(hass, id, config);
    return /^shopping list$/i.test(n) ? "Liste de courses" : n;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.sync();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const un of this.subs.values()) un?.();
    this.subs.clear();
    this.seen.clear();
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.sync();
  }

  /** One live subscription per list; a list that cannot subscribe is re-read when its state changes. */
  private sync(): void {
    const conn = store.hass?.connection;
    if (!conn) return;
    const ids = this.ids();
    for (const [id, un] of this.subs) {
      if (!ids.includes(id)) {
        un?.();
        this.subs.delete(id);
      }
    }
    for (const id of ids) {
      if (!this.subs.has(id)) {
        this.subs.set(id, undefined);
        conn
          .subscribeMessage<{ items: TodoItem[] }>((m) => (this.items = { ...this.items, [id]: m.items ?? [] }), { type: "todo/item/subscribe", entity_id: id })
          .then((un) => {
            // Left the page meanwhile.
            if (!this.subs.has(id)) void un();
            else this.subs.set(id, () => void un().catch(() => {}));
          })
          .catch(() => void this.fetch(id));
      } else if (!this.subs.get(id)) {
        const updated = store.hass!.states[id]?.last_updated ?? "";
        if (this.seen.get(id) !== updated) {
          this.seen.set(id, updated);
          if (this.items[id]) void this.fetch(id);
        }
      }
    }
    if (!this.active || !ids.includes(this.active)) this.active = ids[0];
  }

  private async fetch(id: string): Promise<void> {
    this.items = { ...this.items, [id]: await todoItems(id) };
  }

  /** Items changed here show at once; the subscription confirms (or the error toast explains). */
  private local(id: string, items: TodoItem[]): void {
    this.items = { ...this.items, [id]: items };
  }

  private refreshIfNotLive(id: string): void {
    if (!this.subs.get(id)) void this.fetch(id);
  }

  private async add(id: string, e: Event): Promise<void> {
    e.preventDefault();
    const text = (this.drafts[id] ?? "").trim();
    if (!text) return;
    const items = this.items[id] ?? [];
    // Already bought once: put it back on the list instead of a duplicate.
    const again = items.find((i) => i.status === "completed" && i.summary.trim().toLowerCase() === text.toLowerCase());
    this.drafts = { ...this.drafts, [id]: "" };
    if (again) {
      await this.setStatus(id, again, "needs_action");
      return;
    }
    const ok = await call("add_item", id, { item: text });
    if (!ok) this.drafts = { ...this.drafts, [id]: text };
    this.refreshIfNotLive(id);
  }

  private async setStatus(id: string, item: TodoItem, status: TodoItem["status"]): Promise<void> {
    const before = this.items[id] ?? [];
    this.local(id, before.map((i) => (i.uid === item.uid ? { ...i, status } : i)));
    const ok = await call("update_item", id, { item: item.uid, status });
    if (!ok) this.local(id, before);
    this.refreshIfNotLive(id);
  }

  private async removeItem(id: string, item: TodoItem): Promise<void> {
    const before = this.items[id] ?? [];
    this.local(id, before.filter((i) => i.uid !== item.uid));
    const ok = await call("remove_item", id, { item: [item.uid] });
    if (!ok) this.local(id, before);
    this.refreshIfNotLive(id);
  }

  private async clearDone(id: string, count: number): Promise<void> {
    const ok = await confirmAction({
      title: "Effacer les articles cochés ?",
      body: `${plural(count, "article coché sera retiré", "articles cochés seront retirés")} de « ${this.name(id)} ».`,
      confirmLabel: "Effacer",
      danger: true,
    });
    if (!ok) return;
    const before = this.items[id] ?? [];
    this.local(id, before.filter((i) => i.status !== "completed"));
    if (!(await call("remove_completed_items", id))) this.local(id, before);
    this.refreshIfNotLive(id);
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container: page / inline-size;
      }
      .top .st {
        font-size: 14px;
      }
      .pills {
        margin: 0 -16px 14px;
        padding: 0 16px;
        scroll-padding-inline: 16px;
      }
      .pills .n {
        font-weight: 500;
        opacity: 0.75;
      }
      .lists {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
        gap: 14px;
        align-items: start;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
        container: list / inline-size;
      }
      .ch {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .ch .grow {
        flex: 1;
        min-width: 0;
      }
      .ch .h {
        display: block;
        font-size: 17px;
      }
      .ch .ico {
        background: var(--amberTint);
        color: var(--amberInk);
      }
      .add {
        display: flex;
        gap: 8px;
      }
      .add input {
        flex: 1;
        min-width: 0;
        height: 48px;
        padding: 0 16px;
        border: 2px solid transparent;
        border-radius: 14px;
        background: var(--surf2);
        color: var(--ink);
        font: inherit;
        font-size: 15px;
      }
      .add input::placeholder {
        color: var(--muted);
        opacity: 1;
      }
      .add input:focus-visible {
        outline: none;
        border-color: var(--blue);
      }
      .add button {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: var(--blue);
        color: #fff;
        display: grid;
        place-items: center;
        flex: none;
      }
      .add button:disabled {
        opacity: 0.45;
      }
      .cols {
        display: grid;
        gap: 12px;
        min-height: 0;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        min-height: 0;
      }
      .col .items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sub {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }
      .sub .grow {
        flex: 1;
      }
      .sub .lbl {
        display: none;
      }
      .fold {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
        text-align: left;
      }
      .link {
        font-size: 13px;
        font-weight: 600;
        color: var(--red);
        padding: 6px 4px;
        min-height: 32px;
      }
      .it {
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 14px;
        background: var(--surf2);
        min-width: 0;
        transition: opacity 0.2s;
      }
      .it .chk {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 0 4px 0 12px;
        text-align: left;
        min-width: 0;
        font-size: 15px;
        border-radius: 14px;
      }
      .box {
        width: 24px;
        height: 24px;
        border-radius: 99px;
        border: 2px solid var(--muted);
        display: grid;
        place-items: center;
        flex: none;
        color: transparent;
        transition: background-color 0.15s, border-color 0.15s;
      }
      .box svg {
        width: 15px;
        height: 15px;
        stroke-width: 2.6;
      }
      .it.done .box {
        background: var(--teal);
        border-color: var(--teal);
        color: var(--surf);
      }
      .it.done .txt {
        color: var(--muted);
        text-decoration: line-through;
      }
      .txt {
        overflow-wrap: anywhere;
      }
      .del {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: var(--muted);
        flex: none;
      }
      .del svg {
        width: 18px;
        height: 18px;
      }
      .nothing {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        border-radius: 14px;
        background: var(--surf2);
        font-size: 14px;
        color: var(--muted);
      }
      .nothing .ico {
        background: var(--tealTint);
        color: var(--teal);
      }
      .skeleton {
        height: 52px;
        border-radius: 14px;
        background: var(--surf2);
        opacity: 0.6;
      }

      /* A wide card: to do and checked side by side. */
      @container list (min-width: 720px) {
        .cols {
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          align-items: start;
        }
        .fold {
          display: none;
        }
        .sub .lbl {
          display: block;
        }
      }

      /* Wall tablet: one row of lists fills the screen, the items scroll inside. */
      @container page (min-width: 1000px) {
        .lists.fit {
          height: calc(100vh - 32px - 70px);
          height: calc(100dvh - 32px - 70px);
          min-height: 420px;
          grid-auto-rows: minmax(0, 1fr);
          align-items: stretch;
        }
        .lists.fit .card {
          overflow: hidden;
        }
        .lists.fit .cols {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          align-content: start;
        }
      }
    `,
  ];

  private item(id: string, it: TodoItem, canUpdate: boolean, canDelete: boolean): TemplateResult {
    const done = it.status === "completed";
    return html`<li class="it ${done ? "done" : ""}">
      <button
        class="chk"
        type="button"
        role="checkbox"
        aria-checked=${String(done)}
        ?disabled=${!canUpdate}
        @click=${() => this.setStatus(id, it, done ? "needs_action" : "completed")}
      >
        <span class="box" aria-hidden="true">${icon("check")}</span>
        <span class="txt">${it.summary}</span>
      </button>
      ${canDelete
        ? html`<button class="del" type="button" aria-label="Supprimer ${it.summary}" @click=${() => this.removeItem(id, it)}>${icon("close")}</button>`
        : nothing}
    </li>`;
  }

  private list(id: string): TemplateResult {
    const hass = store.hass!;
    const features = Number(hass.states[id]?.attributes.supported_features) || 0;
    const canAdd = !!(features & CREATE), canDelete = !!(features & DELETE), canUpdate = !!(features & UPDATE);
    const name = this.name(id);
    const items = this.items[id];
    const todo = items?.filter((i) => i.status !== "completed") ?? [];
    const done = items?.filter((i) => i.status === "completed") ?? [];
    // Checked items: unfolded by default on wide screens.
    const open = this.showDone[id] ?? !this.p.phone;
    const draft = this.drafts[id] ?? "";
    const count = items ? (todo.length ? plural(todo.length, "article à faire", "articles à faire") : "Tout est fait") : "Chargement…";
    const inputId = `add-${id.replace(".", "-")}`;
    return html`<section class="card" aria-labelledby="${inputId}-t">
      <div class="ch">
        <span class="ico">${icon("list")}</span>
        <span class="grow"><span class="h ell" id="${inputId}-t">${name}</span><span class="st">${count}</span></span>
      </div>
      ${canAdd
        ? html`<form class="add" @submit=${(e: Event) => this.add(id, e)}>
            <label class="sr" for=${inputId}>Ajouter à ${name}</label>
            <input
              id=${inputId}
              type="text"
              enterkeyhint="done"
              autocomplete="off"
              placeholder="Ajouter un article…"
              .value=${draft}
              @input=${(e: Event) => (this.drafts = { ...this.drafts, [id]: (e.target as HTMLInputElement).value })}
            />
            <button type="submit" aria-label="Ajouter" ?disabled=${!draft.trim()}>${icon("plus", 22)}</button>
          </form>`
        : nothing}
      <div class="cols">
        <div class="col">
          ${!items
            ? html`<div class="skeleton"></div><div class="skeleton"></div>`
            : todo.length
              ? html`<ul class="items" role="list" style="margin:0;padding:0;list-style:none" aria-label="À faire">
                  ${todo.map((it) => this.item(id, it, canUpdate, canDelete))}
                </ul>`
              : html`<div class="nothing">
                  <span class="ico">${icon("check")}</span>
                  <span>${done.length ? "Tout est coché." : "La liste est vide. Ajoute un premier article."}</span>
                </div>`}
        </div>
        ${done.length
          ? html`<div class="col">
              <div class="sub">
                <button class="fold" type="button" aria-expanded=${String(open)} @click=${() => (this.showDone = { ...this.showDone, [id]: !open })}>
                  ${icon(open ? "chevronU" : "chevronD", 18)}Cochés (${done.length})
                </button>
                <span class="lbl grow">Cochés (${done.length})</span>
                ${canDelete ? html`<button class="link" type="button" @click=${() => this.clearDone(id, done.length)}>Tout effacer</button>` : nothing}
              </div>
              ${open
                ? html`<ul class="items" role="list" style="margin:0;padding:0;list-style:none" aria-label="Cochés">
                    ${done.map((it) => this.item(id, it, canUpdate, canDelete))}
                  </ul>`
                : nothing}
            </div>`
          : nothing}
      </div>
    </section>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const ids = this.ids();
    const open = (id: string) => {
      const items = this.items[id];
      return items ? items.filter((i) => i.status !== "completed").length : Number(hass.states[id]?.state) || 0;
    };
    const total = ids.reduce((n, id) => n + open(id), 0);
    const tabs = this.p.phone && ids.length > 1;
    const shown = tabs ? ids.filter((id) => id === this.active) : ids;
    return html`
      <div class="top">
        <h1 class="page-title">Listes</h1>
        <span class="st">${ids.length ? (total ? plural(total, "article à faire", "articles à faire") : "Tout est fait") : ""}</span>
      </div>
      ${tabs
        ? html`<div class="hs pills" role="group" aria-label="Listes">
            ${ids.map(
              (id) => html`<button class="pill" type="button" aria-pressed=${String(id === this.active)} @click=${() => (this.active = id)}>
                ${this.name(id)} <span class="n">${open(id)}</span>
              </button>`,
            )}
          </div>`
        : nothing}
      ${ids.length
        ? html`<div class="lists ${!this.p.phone && ids.length <= 3 ? "fit" : ""}">${shown.map((id) => this.list(id))}</div>`
        : html`<div class="card"><p class="empty">Aucune liste de tâches dans Home Assistant. Ajoute l'intégration « Liste de courses » ou « Liste de tâches locale ».</p></div>`}
    `;
  }
}
customElements.define("kh3-listes", Kh3Listes);
