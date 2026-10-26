import { LitElement, css, html, nothing } from "lit";
import { runScript, setAutomation, setFanOscillation, setFanSpeed, setInputNumber, toggle } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const shared = css`
  :host {
    display: block;
  }
  .card {
    padding: 12px;
    display: grid;
    gap: 12px;
  }
  .card.on {
    background: rgba(var(--rgb), 0.16);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    width: 100%;
  }
  .head > div {
    flex: 1;
    min-width: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn {
    min-width: 48px;
    height: 44px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--kh-radius-icon);
    background: var(--kh-card-2);
    font-weight: 700;
  }
  .btn.active {
    background: rgba(var(--rgb), 0.3);
  }
  .big {
    flex: 1;
    text-align: center;
    font-weight: 800;
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
  }
  input[type="range"] {
    flex: 1;
    accent-color: rgb(var(--rgb));
  }
`;

/** The plug with an auto-off timer (old "Trotinette" card). */
export class KhTimerPlug extends LitElement {
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const p = config.energyPage.spare;
      return p ? [p.plug, p.duration, p.remaining, p.power, p.autoOff].filter((x): x is string => !!x) : [];
    });
  }
  static styles = [base, shared];

  render() {
    const hass = store.hass;
    const p = config.energyPage.spare;
    if (!hass || !p) return nothing;
    const plug = hass.states[p.plug];
    const on = isActive(plug);
    const minutes = Number(hass.states[p.duration]?.state);
    const watts = p.power ? Number(hass.states[p.power]?.state) : NaN;
    const auto = isActive(hass.states[p.autoOff]);
    const duration = isNaN(minutes) ? "" : minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;
    return html`<div class="card ${on ? "on" : ""}" style="--rgb: var(--rgb-green)">
      <button class="head" aria-pressed=${String(on)} @click=${() => toggle(p.plug, p.name)}>
        <span class="shape ${on ? "on" : "off"}"><ha-icon icon="mdi:scooter-electric"></ha-icon></span>
        <div>
          <div class="primary">${p.name}</div>
          <div class="secondary">
            ${isUnavailable(plug) ? "Indisponible" : on ? `En charge${isNaN(watts) ? "" : `, ${formatNumber(watts, 0)} W`}` : "Éteinte"}
          </div>
        </div>
      </button>
      ${on
        ? html`<div class="row">
              <button class="btn" aria-label="Moins de temps" @click=${() => runScript(p.decrement)}><ha-icon icon="mdi:minus"></ha-icon></button>
              <span class="big" aria-live="polite">${duration}</span>
              <button class="btn" aria-label="Plus de temps" @click=${() => runScript(p.increment)}><ha-icon icon="mdi:plus"></ha-icon></button>
            </div>
            <div class="row">
              <button class="btn ${auto ? "active" : ""}" aria-pressed=${String(auto)} @click=${() => setAutomation(p.autoOff, !auto)}>
                <ha-icon icon=${auto ? "mdi:timer-check-outline" : "mdi:timer-off-outline"}></ha-icon>Arrêt auto
              </button>
              <span class="secondary" style="flex:1; text-align:right">${stateLabel(hass, hass.states[p.remaining])}</span>
            </div>`
        : nothing}
    </div>`;
  }
}
customElements.define("kh-timer-plug", KhTimerPlug);

/** Fan: power, speed, oscillation. */
export class KhFan extends LitElement {
  static properties = { entityId: { attribute: "entity-id" } };
  declare entityId: string;
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [this.entityId, config.home.fanTimers?.[this.entityId]].filter((x): x is string => !!x));
  }
  static styles = [
    base,
    shared,
    css`
      .card.on .shape ha-icon {
        animation: spin 1.2s linear infinite;
      }
      .timers {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        color: var(--kh-text-2);
      }
      .timers ha-icon {
        --mdc-icon-size: 18px;
      }
      .timers .chip {
        height: 30px;
        padding: 0 11px;
        border-radius: 15px;
        background: var(--kh-card-2);
        color: var(--kh-text);
        font-weight: 700;
        font-size: 0.8125rem;
      }
      .timers .chip.active {
        background: rgba(var(--rgb-teal), 0.85);
        color: #fff;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ];
  render() {
    const hass = store.hass;
    const s = hass?.states[this.entityId];
    if (!hass || !s) return nothing;
    const on = isActive(s);
    const pct = Number(s.attributes.percentage ?? 0);
    const osc = !!s.attributes.oscillating;
    // Off-timer: through the input_number the fan's automation applies.
    const timerId = config.home.fanTimers?.[this.entityId];
    const timer = timerId ? Number(hass.states[timerId]?.state) : NaN;
    const TIMERS: [number, string][] = [[0, "Arrêt"], [30, "30 min"], [60, "1 h"], [120, "2 h"], [240, "4 h"]];
    return html`<div class="card ${on ? "on" : ""}" style="--rgb: var(--rgb-teal)">
      <button class="head" aria-pressed=${String(on)} @click=${() => toggle(this.entityId, "le ventilateur")}>
        <span class="shape ${on ? "" : "off"}"><ha-icon icon="mdi:fan"></ha-icon></span>
        <div>
          <div class="primary">${(s.attributes.friendly_name as string) ?? "Ventilateur"}</div>
          <div class="secondary">${isUnavailable(s) ? "Indisponible" : on ? `${pct} %${osc ? ", oscillation" : ""}` : "Éteint"}</div>
        </div>
      </button>
      ${!isUnavailable(s)
        ? html`<div class="row">
            <input type="range" min="0" max="100" step="25" .value=${String(pct)} aria-label="Vitesse"
              @change=${(e: Event) => setFanSpeed(this.entityId, Number((e.target as HTMLInputElement).value))} />
            <button class="btn ${osc ? "active" : ""}" aria-pressed=${String(osc)} aria-label="Oscillation" @click=${() => setFanOscillation(this.entityId, !osc)}>
              <ha-icon icon="mdi:arrow-oscillating"></ha-icon>
            </button>
          </div>
          ${timerId && hass.states[timerId]
            ? html`<div class="timers" role="group" aria-label="Minuterie">
                <ha-icon icon="mdi:timer-outline"></ha-icon>
                ${TIMERS.map(([min, label]) => html`<button class="chip ${timer === min ? "active" : ""}" aria-pressed=${String(timer === min)}
                  @click=${() => setInputNumber(timerId, min)}>${label}</button>`)}
              </div>`
            : nothing}`
        : nothing}
    </div>`;
  }
}
customElements.define("kh-fan", KhFan);
