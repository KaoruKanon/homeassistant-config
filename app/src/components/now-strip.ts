import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, setLights, toggle } from "../actions.ts";
import { config } from "../config.ts";
import { isActive } from "../format.ts";
import type { HouseModel } from "../rooms.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/** What is on or open right now, across the house, one tap from off. */
export class KhNowStrip extends LitElement {
  static properties = { model: { attribute: false } };
  declare model: HouseModel;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const m = this.model;
      if (!m) return [];
      return [...m.unassignedLights, ...m.rooms.flatMap((r) => [...r.lights, ...r.openings, ...r.media])];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
        margin-bottom: 28px;
      }
      h2 {
        font-size: 1rem;
        color: var(--kh-text-2);
        margin: 0 0 12px;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 16px 0 12px;
        border-radius: 999px;
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
        font-size: 0.9375rem;
      }
      .chip .where {
        color: var(--kh-text-2);
      }
      .chip.light {
        background: var(--kh-warm-soft);
        border-color: transparent;
      }
      .chip.light ha-icon {
        color: var(--kh-warm);
      }
      .chip.open {
        background: var(--kh-alert-soft);
        border-color: transparent;
        color: var(--kh-alert);
        font-weight: 700;
      }
      .chip.media ha-icon {
        color: var(--kh-accent);
      }
      .chip.all {
        background: var(--kh-text);
        color: var(--kh-bg);
        font-weight: 700;
        border-color: transparent;
      }
      .calm {
        color: var(--kh-text-2);
        margin: 0;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    const m = this.model;
    if (!hass || !m) return nothing;
    const where = new Map<string, string>();
    for (const r of m.rooms) for (const id of [...r.lights, ...r.openings, ...r.media]) where.set(id, r.name);

    const lights = [...m.unassignedLights, ...m.rooms.flatMap((r) => r.lights)].filter((id) => isActive(hass.states[id]));
    const open = m.rooms.flatMap((r) => r.openings).filter((id) => isActive(hass.states[id]));
    const playing = m.rooms.flatMap((r) => r.media).filter((id) => hass.states[id]?.state === "playing");
    const name = (id: string) => entityName(hass, id, config, where.get(id));

    if (!lights.length && !open.length && !playing.length) {
      return html`<h2>En ce moment</h2><p class="calm">Tout est éteint et fermé.</p>`;
    }
    return html`
      <h2>En ce moment</h2>
      <div class="row">
        ${open.map(
          (id) => html`<button class="chip open" @click=${() => openMoreInfo(this, id)}>
            <ha-icon icon="mdi:window-open-variant"></ha-icon>${name(id)}
            ${where.get(id) ? html`<span>· ${where.get(id)}</span>` : nothing}
          </button>`,
        )}
        ${lights.map(
          (id) => html`<button class="chip light" aria-label="Éteindre ${name(id)}" @click=${() => toggle(id, name(id))}>
            <ha-icon icon="mdi:lightbulb-on"></ha-icon>${name(id)}
            ${where.get(id) ? html`<span class="where">${where.get(id)}</span>` : nothing}
          </button>`,
        )}
        ${playing.map(
          (id) => html`<button class="chip media" @click=${() => openMoreInfo(this, id)}>
            <ha-icon icon="mdi:play-circle-outline"></ha-icon>${name(id)}
            ${where.get(id) ? html`<span class="where">${where.get(id)}</span>` : nothing}
          </button>`,
        )}
        ${lights.length > 1
          ? html`<button class="chip all" @click=${() => setLights(lights, false)}>
              <ha-icon icon="mdi:lightbulb-group-off-outline"></ha-icon>Éteindre les ${lights.length} lumières
            </button>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-now-strip", KhNowStrip);
