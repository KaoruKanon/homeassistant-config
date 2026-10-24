import { LitElement, css, html, nothing } from "lit";
import "../components/energy-card.ts";
import "../components/energy-devices.ts";
import "../components/sankey.ts";
import "../components/tile.ts";
import "../components/widgets.ts";
import { openMoreInfo } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { entityName } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { frogSky } from "../weather-utils.ts";
import { roomSceneStyles } from "./room-art.ts";
import { energyScene, sceneStyles } from "./scenes.ts";
import { head, hero, v2 } from "./styles.ts";

/** Énergie: the power now in the hero, Linky graph, PCs, plugs (protected), fan. */
export class KhV2Energy extends LitElement {
  static properties = { prefix: {}, power: { attribute: false } };
  declare prefix: string;
  declare power: Record<string, string>;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const e = config.home.energy;
      return [e?.power, e?.today, ...config.energyPage.plugs, ...(config.energyPage.meters ?? []).map((m) => m.power), "sun.sun"].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    v2,
    roomSceneStyles,
    sceneStyles,
    css`
      .stack {
        display: grid;
        gap: 10px;
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const e = config.home.energy;
    const p = config.energyPage;
    const watts = e ? Number(hass.states[e.power]?.state) : NaN;
    const today = e ? hass.states[e.today] : undefined;
    const kwh = Number(today?.state);
    const last = Number(today?.attributes.last_period);
    const plugsOn = p.plugs.filter((id) => isActive(hass.states[id])).length;

    return html`
      ${hero(
        "orange",
        "mdi:lightning-bolt",
        "En ce moment",
        isNaN(watts) ? "—" : html`${formatNumber(watts, 0)}<small style="font-size:1.25rem"> W</small>`,
        !isNaN(kwh) && e ? `${formatNumber(kwh, 1)} kWh aujourd'hui, ${formatNumber(kwh * e.pricePerKwh, 2)} €` : "",
        html`${last > 0 ? html`<span class="chip"><ha-icon icon="mdi:history"></ha-icon>Hier ${formatNumber(last, 1)} kWh</span>` : nothing}
          ${last > 0 && !isNaN(kwh) ? html`<span class="chip"><ha-icon icon="mdi:percent-circle-outline"></ha-icon>${formatNumber((kwh / last) * 100, 0)} % d'hier</span>` : nothing}
          <span class="chip"><ha-icon icon="mdi:power-plug"></ha-icon>${plugsOn} prise${plugsOn > 1 ? "s" : ""} sur ${p.plugs.length}</span>`,
        html`<div class="art">${energyScene(watts, hass.states["sun.sun"]?.state === "below_horizon", frogSky())}</div>`,
      )}
      <div class="bento">
        ${e
          ? html`<section class="tile" style="--tint: var(--rgb-orange); --w: 8; --w6: 6; --w2: 2">
              ${head("mdi:chart-bar", "Consommation")}
              <kh-energy-card></kh-energy-card>
            </section>`
          : nothing}
        <section class="tile" style="--tint: var(--rgb-amber); --w: 12; --w6: 6; --w2: 2">
          ${head("mdi:transit-connection-variant", "Où part l'électricité")}
          <kh-sankey .total=${watts} .flows=${(p.meters ?? []).map((m) => ({
            name: m.name,
            watts: Number(hass.states[m.power]?.state) || 0,
            open: () => openMoreInfo(this, m.power),
          }))}></kh-sankey>
          <div class="secondary">Ce que les prises ne mesurent pas (dont le PC de Papa) est compté dans « Reste de la maison ».</div>
        </section>
        <section class="tile" style="--tint: var(--rgb-blue); --w: 4; --w6: 6; --w2: 2">
          ${head("mdi:desktop-tower-monitor", "Ordinateurs")}
          <div class="stack">
            ${config.home.computers.map((c) => html`<kh-computer entity-id=${c.entity} name=${c.name} busy=${c.busy ?? nothing}></kh-computer>`)}
          </div>
        </section>
        ${p.plugs.length
          ? html`<section class="tile" style="--tint: var(--rgb-light-blue); --w: 6; --w6: 6; --w2: 2">
              ${head("mdi:power-socket-fr", "Prises")}
              <div class="secondary">Elles alimentent le homelab : chaque coupure demande une confirmation.</div>
              <div class="stack">
                ${p.plugs.map((id) => html`<kh-tile entity-id=${id} name=${entityName(hass, id, config)} power-id=${this.power?.[id] ?? nothing}></kh-tile>`)}
              </div>
            </section>`
          : nothing}
        ${p.spare || p.fans.length
          ? html`<section class="tile" style="--tint: var(--rgb-teal); --w: 6; --w6: 6; --w2: 2">
              ${head("mdi:timer-cog-outline", "Minuterie et ventilation")}
              <div class="stack">
                ${p.spare ? html`<kh-timer-plug></kh-timer-plug>` : nothing}
                ${p.fans.map((id) => html`<kh-fan entity-id=${id}></kh-fan>`)}
              </div>
            </section>`
          : nothing}
      </div>
    `;
  }
}
customElements.define("kh-v2-energy", KhV2Energy);
