import { LitElement, css, html } from "lit";
import "../components/room-card.ts";
import "../v2/floorplan.ts";
import type { Room } from "../rooms.ts";
import { base } from "../styles.ts";
import { pageHead, pageStyles } from "./page.ts";

/** "Maison": the apartment plan (2D / 3D, shared with V2), then every room at a glance. */
export class KhRoomsView extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {} };
  declare rooms: Room[];
  declare prefix: string;

  static styles = [
    base,
    pageStyles,
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
      .plan {
        padding: 8px;
        overflow: hidden;
      }
      h2 {
        margin: 20px 0 10px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--kh-gap);
      }
      @container kh (max-width: 599px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  render() {
    return html`
      ${pageHead("mdi:floor-plan", "amber", "Maison", `${(this.rooms ?? []).length} pièces`)}
      <div class="card plan"><kh-floorplan .rooms=${this.rooms ?? []} prefix=${this.prefix}></kh-floorplan></div>
      <h2>Pièces</h2>
      <div class="grid">
        ${(this.rooms ?? []).map((r) => html`<kh-room-card .room=${r} href=${`${this.prefix}/pieces/${r.id}`}></kh-room-card>`)}
      </div>
    `;
  }
}
customElements.define("kh-rooms-view", KhRoomsView);
