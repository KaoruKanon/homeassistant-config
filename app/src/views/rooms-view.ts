import { LitElement, css, html } from "lit";
import "../components/room-card.ts";
import type { Room } from "../rooms.ts";
import { base } from "../styles.ts";

/** "Maison": every room at a glance. The apartment plan will take this place. */
export class KhRoomsView extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {} };
  declare rooms: Room[];
  declare prefix: string;

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      h1 {
        font-size: 2rem;
        margin: 8px 0 4px;
      }
      p {
        margin: 0 0 16px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--kh-gap);
      }
      @container kh (max-width: 599px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  render() {
    return html`
      <h1>Maison</h1>
      <p class="secondary">Le plan animé de l'appartement prendra cette place.</p>
      <div class="grid">
        ${(this.rooms ?? []).map((r) => html`<kh-room-card .room=${r} href=${`${this.prefix}/pieces/${r.id}`}></kh-room-card>`)}
      </div>
    `;
  }
}
customElements.define("kh-rooms-view", KhRoomsView);
