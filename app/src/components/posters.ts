import { LitElement, css, html, nothing } from "lit";
import { openMediaItem } from "../popups/open.ts";
import { EntitiesController, store } from "../store.ts";
import { base } from "../styles.ts";

/** A row of Jellyfin posters (recently added), scrollable sideways. */
export class KhPosters extends LitElement {
  static properties = { entityId: { attribute: "entity-id" } };
  declare entityId: string;

  constructor() {
    super();
    new EntitiesController(this, () => [this.entityId]);
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .row {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: clamp(118px, 28vw, 150px);
        gap: 12px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        padding-bottom: 6px;
        scrollbar-width: thin;
      }
      .poster {
        scroll-snap-align: start;
        display: grid;
        gap: 6px;
        text-align: left;
      }
      .poster img {
        width: 100%;
        aspect-ratio: 2 / 3;
        object-fit: cover;
        border-radius: 14px;
        background: var(--kh-card);
      }
      .poster .primary {
        font-size: 0.875rem;
      }
    `,
  ];

  render() {
    const s = store.get(this.entityId);
    const items = ((s?.attributes.data as any[] | undefined) ?? []).slice(1).filter((i) => i.title);
    if (!items.length) return html`<div class="secondary">Rien de nouveau</div>`;
    return html`<div class="row">
      ${items.map(
        (i) => html`<button class="poster" @click=${() => openMediaItem(i)}>
          ${i.poster ? html`<img src=${i.poster} alt="" loading="lazy" />` : nothing}
          <div class="primary ellipsis">${i.title}</div>
          <div class="secondary ellipsis">${i.number || (i.aired ?? "").slice(0, 4)}</div>
        </button>`,
      )}
    </div>`;
  }
}
customElements.define("kh-posters", KhPosters);
