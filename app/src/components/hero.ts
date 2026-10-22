import { LitElement, css, html, nothing } from "lit";
import { config } from "../config.ts";
import { stateIcon, stateLabel } from "../format.ts";
import { currentPerson } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Ticks once a minute, on the minute; nothing else re-renders with it. */
class KhClock extends LitElement {
  static properties = { now: { state: true } };
  declare now: Date;
  private timer?: number;

  constructor() {
    super();
    this.now = new Date();
  }

  static styles = css`
    :host {
      display: block;
    }
    time {
      display: block;
      font-family: var(--kh-display);
      font-size: var(--kh-clock-size, 3rem);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .date {
      margin-top: 8px;
      color: var(--kh-text-2);
      font-size: 1.0625rem;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.schedule();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  private schedule(): void {
    const ms = 60_000 - (Date.now() % 60_000) + 50;
    this.timer = window.setTimeout(() => {
      this.now = new Date();
      this.schedule();
    }, ms);
  }

  render() {
    const date = dateFormat.format(this.now);
    return html`
      <time datetime=${this.now.toISOString()}>${timeFormat.format(this.now)}</time>
      <div class="date">${date.charAt(0).toUpperCase() + date.slice(1)}</div>
    `;
  }
}
customElements.define("kh-clock", KhClock);

/** Greeting, clock, weather and who is home: the one bold element. */
export class KhHero extends LitElement {
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => [
      ...config.weather,
      ...Object.keys(config.people).map((p) => `person.${p}`),
    ]);
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .hero {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: 16px 24px;
        padding: 8px 0 24px;
      }
      .greeting {
        color: var(--kh-text-2);
        font-size: 1.0625rem;
        margin-bottom: 8px;
      }
      .side {
        display: grid;
        justify-items: end;
        gap: 12px;
      }
      .weather {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .weather ha-state-icon {
        --mdc-icon-size: 36px;
        color: var(--kh-accent);
      }
      .weather .temp {
        font-size: 1.75rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .weather .cond {
        color: var(--kh-text-2);
      }
      .people {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .person {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px 4px 4px;
        border-radius: 999px;
        background: var(--kh-surface);
        border: 1px solid var(--kh-line);
        font-size: 0.875rem;
      }
      .person img,
      .person .initial {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
      }
      .person .initial {
        display: grid;
        place-items: center;
        background: var(--kh-surface-2);
        font-weight: 700;
      }
      .person .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--kh-text-2);
      }
      .person.home .dot {
        background: var(--kh-ok);
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      @container kh (max-width: 599px) {
        /* Phone: time and weather share one line, who is home goes under. */
        .hero {
          align-items: start;
          gap: 12px 16px;
          padding: 0 0 20px;
          --kh-clock-size: 2.25rem;
        }
        .greeting {
          margin-bottom: 4px;
        }
        .side {
          display: contents;
        }
        .weather {
          grid-column: 2;
          grid-row: 1;
          align-self: end;
          flex-direction: column;
          align-items: flex-end;
          gap: 0;
        }
        .weather ha-state-icon {
          --mdc-icon-size: 28px;
        }
        .weather .temp {
          font-size: 1.375rem;
        }
        .people {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }
      }
    `,
  ];

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const weather = config.weather.map((id) => hass.states[id]).find((s) => s && s.state !== "unavailable");
    const me = currentPerson(hass);
    const name = capitalize((me && hass.states[me]?.attributes.friendly_name) || hass.user?.name || "");
    const hour = new Date().getHours();
    const hello = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";

    return html`
      <section class="hero">
        <div>
          <div class="greeting">${hello}${name ? ` ${name}` : ""}</div>
          <kh-clock></kh-clock>
        </div>
        <div class="side">
          ${weather
            ? html`<div class="weather">
                ${stateIcon(hass, weather)}
                <span class="temp">${formatTemp(weather.attributes.temperature)}</span>
                <span class="cond">${stateLabel(hass, weather)}</span>
              </div>`
            : nothing}
          <div class="people">
            ${Object.keys(config.people).map((p) => {
              const s = hass.states[`person.${p}`];
              if (!s) return nothing;
              const home = s.state === "home";
              const pic = s.attributes.entity_picture as string | undefined;
              const label = capitalize(s.attributes.friendly_name ?? p);
              return html`<span class="person ${home ? "home" : ""}">
                ${pic ? html`<img src=${pic} alt="" />` : html`<span class="initial">${label.charAt(0)}</span>`}
                ${label}
                <span class="dot" aria-hidden="true"></span>
                <span class="sr">${home ? "à la maison" : "absent"}</span>
              </span>`;
            })}
          </div>
        </div>
      </section>
    `;
  }
}
customElements.define("kh-hero", KhHero);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTemp(v: unknown): string {
  return typeof v === "number" ? `${Math.round(v)}°` : "";
}
