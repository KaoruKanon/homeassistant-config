import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { currentPerson } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const residents = () => Object.keys(config.people).filter((p) => !config.people[p].device);

function greeting(hour: number): string {
  if (hour < 5 || hour >= 22) return "Bonne nuit 😴";
  if (hour < 12) return "Bonjour ☀️";
  if (hour < 18) return "Bonne journée 🙂";
  return "Bonne soirée 🌙";
}

/**
 * Header of the old home view: the time, a greeting (or when the rain comes)
 * and coloured chips for the house at a glance. Ticks once a minute.
 */
export class KhHero extends LitElement {
  static properties = { now: { state: true }, mapHref: {} };
  declare now: Date;
  /** Where the lights / windows chips lead (the Maison page). */
  declare mapHref?: string;
  private timer?: number;

  constructor() {
    super();
    this.now = new Date();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const c = config.home.chips;
      return [
        ...Object.values(c),
        config.home.nextRain,
        ...residents().map((p) => `person.${p}`),
      ].filter((x): x is string => !!x);
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px 24px;
        padding: 4px 0 8px;
      }
      time {
        display: block;
        font-size: 2.25rem;
        font-weight: 700;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .sub {
        color: var(--kh-text-2);
        font-size: 1.0625rem;
        font-weight: 600;
        margin-top: 2px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .chip {
        height: 44px;
        min-width: 44px;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 14px;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card);
        font-weight: 700;
        font-size: 0.875rem;
        text-decoration: none;
        color: inherit;
      }
      .chip ha-icon {
        --mdc-icon-size: 20px;
        color: rgb(var(--rgb, var(--rgb-grey)));
      }
      .chip.tint {
        background: rgba(var(--rgb), 0.22);
      }
      .chip.blink ha-icon {
        animation: kh-blink 1s ease-in-out infinite;
      }
      .person {
        padding: 0;
        width: 44px;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 0 0 3px rgba(var(--rgb), 0.8);
      }
      .person.home {
        animation: kh-breathe 3s ease-in-out infinite;
      }
      .person img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      @container kh (max-width: 599px) {
        time {
          font-size: 2rem;
        }
        .chip {
          height: 40px;
          min-width: 40px;
          padding: 0 10px;
        }
        .person {
          width: 40px;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.schedule();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  private schedule(): void {
    this.timer = window.setTimeout(() => {
      this.now = new Date();
      this.schedule();
    }, 60_000 - (Date.now() % 60_000) + 50);
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const c = config.home.chips;
    const st = (id?: string) => (id ? hass.states[id] : undefined);

    const me = currentPerson(hass);
    const person = me?.replace("person.", "");
    const name = person === "tablet" ? "" : (me && hass.states[me]?.attributes.friendly_name) || "";
    const rain = st(config.home.nextRain)?.state;
    const rainAt = rain && !isNaN(Date.parse(rain)) && Date.parse(rain) > this.now.getTime() ? timeFormat.format(new Date(rain)) : "";
    const sub = rainAt ? `Pluie prévue à ${rainAt} ☔` : `${greeting(this.now.getHours())}${name ? ` ${name}` : ""}`;

    const temp = Number(st(c.temperature)?.state);
    const lights = Number(st(c.lightsOn)?.state);
    const windows = Number(st(c.windowsOpen)?.state);
    const timer = st(c.timer)?.state;
    const timerOn = st(c.timerActive)?.state === "active" || isActive(st(c.timerActive));
    const alarm = st(c.alarm);

    return html`
      <header>
        <div>
          <time datetime=${this.now.toISOString()}>${timeFormat.format(this.now)}</time>
          <div class="sub">${sub}</div>
        </div>
        <div class="chips">
          ${!isNaN(temp)
            ? html`<button class="chip tint" style="--rgb:${temp < 18 ? "var(--rgb-orange)" : temp < 28 ? "var(--rgb-green)" : "var(--rgb-red)"}"
                @click=${() => openMoreInfo(this, c.temperature!)} aria-label="Température moyenne de la maison">
                <ha-icon icon="mdi:home-thermometer"></ha-icon>${formatNumber(temp)}°
              </button>`
            : nothing}
          ${timer
            ? html`<span class="chip ${timerOn ? "blink" : ""}" style="--rgb: var(--rgb-blue)">
                <ha-icon icon="mdi:timer-outline"></ha-icon>${timer}
              </span>`
            : nothing}
          ${!isNaN(lights)
            ? html`<a class="chip ${lights > 0 ? "tint" : ""}" style="--rgb: var(--rgb-amber)" href=${this.mapHref ?? "#"}
                aria-label="${lights} lumières allumées">
                <ha-icon icon=${lights > 0 ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon>${lights}
              </a>`
            : nothing}
          ${windows > 0
            ? html`<a class="chip tint" style="--rgb: var(--rgb-red)" href=${this.mapHref ?? "#"} aria-label="${windows} fenêtres ouvertes">
                <ha-icon icon="mdi:window-open-variant"></ha-icon>${windows}
              </a>`
            : nothing}
          ${alarm && alarm.state !== "disarmed" && alarm.state !== "unavailable"
            ? html`<button class="chip tint ${alarm.state === "triggered" || alarm.state === "pending" ? "blink" : ""}"
                style="--rgb: var(--rgb-red)" @click=${() => openMoreInfo(this, alarm.entity_id)} aria-label="Alarme">
                <ha-icon icon="mdi:shield-home"></ha-icon>
              </button>`
            : nothing}
          ${residents()
            .map((p) => hass.states[`person.${p}`])
            .filter((s) => !!s)
            .sort((a, b) => Number(b!.state === "home") - Number(a!.state === "home"))
            .map((s) => {
              const home = s!.state === "home";
              const pic = s!.attributes.entity_picture as string | undefined;
              const label = `${s!.attributes.friendly_name} : ${home ? "à la maison" : "absent"}`;
              return html`<button class="chip person ${home ? "home" : ""}" style="--rgb:${home ? "var(--rgb-green)" : "var(--rgb-red)"}"
                aria-label=${label} title=${label} @click=${() => openMoreInfo(this, s!.entity_id)}>
                ${pic ? html`<img src=${pic} alt="" />` : html`<ha-icon icon="mdi:account"></ha-icon>`}
              </button>`;
            })}
        </div>
      </header>
    `;
  }
}
customElements.define("kh-hero", KhHero);
