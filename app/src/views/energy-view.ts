import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo } from "../actions.ts";
import "../components/energy-card.ts";
import "../components/energy-devices.ts";
import "../components/sankey.ts";
import "../components/tile.ts";
import "../components/widgets.ts";
import { config } from "../config.ts";
import { formatNumber } from "../format.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { pageHead, pageStyles } from "./page.ts";

/** Énergie: Linky, plugs (protected), the timer plug, PCs, fans. */
export class KhEnergyView extends LitElement {
  static properties = { power: { attribute: false } };
  declare power: Record<string, string>;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [config.home.energy?.power, ...(config.energyPage.meters ?? []).map((m) => m.power)].filter((x): x is string => !!x));
  }

  static styles = [
    base,
    pageStyles,
    css`
      .sankey {
        padding: 16px;
        display: grid;
        gap: 10px;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const e = config.home.energy;
    const watts = e ? Number(hass.states[e.power]?.state) : NaN;
    const p = config.energyPage;
    return html`
      ${pageHead("mdi:lightning-bolt-outline", "orange", "Énergie", isNaN(watts) ? "" : `${formatNumber(watts, 0)} W consommés en ce moment`)}
      <div class="cols">
        <div>
          <h2>Consommation</h2>
          <kh-energy-card></kh-energy-card>
          <h2>Ordinateurs</h2>
          <div class="grid" style="--min: 200px">
            ${config.home.computers.map((c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`)}
          </div>
        </div>
        <div>
          <h2>Prises</h2>
          <div class="stack">
            ${p.plugs.map(
              (id) => html`<kh-tile entity-id=${id} name=${entityName(hass, id, config)} power-id=${this.power?.[id] ?? nothing}></kh-tile>`,
            )}
            ${p.spare ? html`<kh-timer-plug></kh-timer-plug>` : nothing}
          </div>
          ${p.fans.length
            ? html`<h2>Ventilateur</h2>
                <div class="stack">${p.fans.map((id) => html`<kh-fan entity-id=${id}></kh-fan>`)}</div>`
            : nothing}
        </div>
      </div>
      <h2>Où part l'électricité</h2>
      <div class="card sankey">
        <kh-sankey .total=${watts} .flows=${(p.meters ?? []).map((m) => ({
          name: m.name,
          watts: Number(hass.states[m.power]?.state) || 0,
          open: () => openMoreInfo(this, m.power),
        }))}></kh-sankey>
        <div class="secondary">Ce que les prises ne mesurent pas (dont le PC de Papa) est compté dans « Reste de la maison ».</div>
      </div>
    `;
  }
}
customElements.define("kh-energy-view", KhEnergyView);
