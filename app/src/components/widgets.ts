import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, runScript, setAutomation, toggle } from "../actions.ts";
import { config, type Favorite } from "../config.ts";
import { formatNumber, isActive, isUnavailable, sensorValue } from "../format.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";

/** Base for the small home widgets: re-render on their entities and on translations. */
abstract class Widget extends LitElement {
  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => this.watched());
  }
  protected abstract watched(): string[];

  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      .tile {
        width: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        text-align: left;
        min-height: 66px;
      }
      .tile > div {
        min-width: 0;
        flex: 1;
      }
      .value {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
    `,
  ];
}

const dateParts = (d: Date) => ({
  day: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d).replace(".", ""),
  num: d.getDate(),
  month: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d).replace(".", ""),
});

/** Phone battery, green / orange / red, with the old charging animation. */
export class KhBattery extends Widget {
  static properties = { spec: { attribute: false } };
  declare spec: Extract<Favorite, { type: "battery" }>;
  protected watched() {
    return this.spec ? [this.spec.entity, this.spec.charging].filter((x): x is string => !!x) : [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .shape.charging ha-icon {
        animation: kh-blink 1.6s ease-in-out infinite;
      }
    `,
  ];
  render() {
    const hass = store.hass;
    if (!hass || !this.spec) return nothing;
    const level = Number(hass.states[this.spec.entity]?.state);
    const charging = this.spec.charging ? isActive(hass.states[this.spec.charging]) : false;
    const rgb = isNaN(level) ? "var(--rgb-grey)" : level > 60 ? "var(--rgb-green)" : level > 20 ? "var(--rgb-orange)" : "var(--rgb-red)";
    const icon = isNaN(level) ? "mdi:battery-unknown" : `mdi:battery${level >= 95 ? "" : `-${Math.max(10, Math.round(level / 10) * 10)}`}`;
    return html`<button class="card tile" @click=${() => openMoreInfo(this, this.spec.entity)}>
      <span class="shape ${charging ? "charging" : ""}" style="--rgb:${rgb}">
        <ha-icon icon=${charging ? "mdi:battery-charging-high" : icon}></ha-icon>
      </span>
      <div>
        <div class="primary">${this.spec.name}</div>
        <div class="secondary">${isNaN(level) ? "Indisponible" : `${level} %${charging ? ", en charge" : ""}`}</div>
      </div>
    </button>`;
  }
}
customElements.define("kh-battery", KhBattery);

/** "Ajouté récemment sur Jellyfin", artwork as background. */
export class KhJellyfin extends Widget {
  protected watched() {
    return config.home.jellyfin ? [config.home.jellyfin] : [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .art {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 210px;
        overflow: hidden;
        background-size: cover;
        background-position: center 25%;
        color: #fff;
        text-align: left;
        width: 100%;
      }
      .art .shape {
        margin: 14px;
        background: rgba(var(--rgb-jellyfin), 0.35);
        color: #fff;
        backdrop-filter: blur(6px);
      }
      .caption {
        padding: 12px 14px;
        background: linear-gradient(to top, rgb(16 18 20 / 0.92), rgb(16 18 20 / 0.55));
        backdrop-filter: blur(4px);
      }
      .caption .secondary {
        color: rgb(255 255 255 / 0.78);
      }
    `,
  ];
  render() {
    const hass = store.hass;
    const id = config.home.jellyfin;
    const s = id ? hass?.states[id] : undefined;
    const item = (s?.attributes.data as any[] | undefined)?.[1];
    if (!hass || !s || !item) return nothing;
    const art = item.fanart || item.poster;
    const what = [item.title, item.number || item.episode].filter(Boolean).join(", ");
    return html`<button class="card art" style=${art ? `background-image:url('${art}')` : ""} @click=${() => openMoreInfo(this, id!)}>
      <span class="shape"><ha-icon icon="mdi:filmstrip-box-multiple"></ha-icon></span>
      <div class="caption">
        <div class="primary">Ajouté récemment sur Jellyfin</div>
        <div class="secondary ellipsis">${what}</div>
      </div>
    </button>`;
  }
}
customElements.define("kh-jellyfin", KhJellyfin);

/** Next events of a few calendars, today's date on the left. */
export class KhCalendar extends Widget {
  static properties = { spec: { attribute: false } };
  declare spec: Extract<Favorite, { type: "calendar" }>;
  protected watched() {
    return this.spec?.entities ?? [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .cal {
        display: flex;
        gap: 14px;
        padding: 12px 14px;
        align-items: center;
      }
      .date {
        display: grid;
        justify-items: center;
        min-width: 52px;
        padding-right: 14px;
        border-right: 2px solid rgb(var(--rgb-blue));
        line-height: 1.1;
      }
      .date .num {
        font-size: 1.75rem;
        font-weight: 700;
      }
      .date small {
        color: var(--kh-text-2);
        font-weight: 600;
        text-transform: capitalize;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      li {
        min-width: 0;
      }
    `,
  ];
  render() {
    const hass = store.hass;
    if (!hass || !this.spec) return nothing;
    const events = this.spec.entities
      .map((id) => hass.states[id])
      .filter((s) => s && s.attributes.message && s.attributes.start_time)
      .map((s) => ({ title: s!.attributes.message as string, start: new Date((s!.attributes.start_time as string).replace(" ", "T")), allDay: !!s!.attributes.all_day }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 3);
    const today = dateParts(new Date());
    return html`<div class="card cal">
      <div class="date"><small>${today.day}</small><span class="num">${today.num}</span><small>${today.month}</small></div>
      ${events.length
        ? html`<ul>
            ${events.map((e) => {
              const p = dateParts(e.start);
              const when = `${p.day} ${p.num} ${p.month}${e.allDay ? "" : `, ${e.start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}`;
              return html`<li><div class="primary ellipsis">${e.title}</div><div class="secondary">${when}</div></li>`;
            })}
          </ul>`
        : html`<div class="secondary">Aucun événement à venir</div>`}
    </div>`;
  }
}
customElements.define("kh-calendar", KhCalendar);

/** Room thermometer: temperature, humidity, low-battery warning. */
export class KhThermometer extends Widget {
  static properties = { spec: { attribute: false } };
  declare spec: Extract<Favorite, { type: "thermometer" }>;
  protected watched() {
    return this.spec ? [this.spec.temperature, this.spec.humidity, this.spec.battery].filter((x): x is string => !!x) : [];
  }
  render() {
    const hass = store.hass;
    if (!hass || !this.spec) return nothing;
    const t = Number(hass.states[this.spec.temperature]?.state);
    const hum = sensorValue(hass, this.spec.humidity, 0);
    const battery = Number(this.spec.battery ? hass.states[this.spec.battery]?.state : NaN);
    const rgb = isNaN(t) ? "var(--rgb-grey)" : t < 18 ? "var(--rgb-light-blue)" : t < 24 ? "var(--rgb-green)" : "var(--rgb-orange)";
    return html`<button class="card tile" @click=${() => openMoreInfo(this, this.spec.temperature)}>
      <span class="shape" style="--rgb:${rgb}"><ha-icon icon="mdi:thermometer"></ha-icon></span>
      <div>
        <div class="primary">${this.spec.name}</div>
        <div class="secondary">
          ${isNaN(t) ? "Indisponible" : `${formatNumber(t)} °C${hum ? ` / ${hum} %` : ""}`}${!isNaN(battery) && battery < 20 ? ", pile faible" : ""}
        </div>
      </div>
    </button>`;
  }
}
customElements.define("kh-thermometer", KhThermometer);

/** PC tile: light card when on, spinning border while starting or stopping. */
export class KhComputer extends Widget {
  static properties = { entityId: { attribute: "entity-id" }, name: {}, busy: {} };
  declare entityId: string;
  declare name: string;
  declare busy?: string;
  protected watched() {
    return [this.entityId, this.busy].filter((x): x is string => !!x);
  }
  static styles = [
    ...Widget.styles,
    css`
      .tile.on {
        background: #e4e6e8;
        color: #1f2326;
        --kh-text-2: #5d6368;
      }
      .tile.on .shape {
        background: rgb(0 0 0 / 0.08);
        color: #1f2326;
      }
      .tile.busy {
        outline: 2px dashed rgb(var(--rgb-blue));
        outline-offset: -2px;
        animation: kh-blink 1.2s ease-in-out infinite;
      }
    `,
  ];
  render() {
    const hass = store.hass;
    const s = hass?.states[this.entityId];
    if (!hass || !s) return nothing;
    const on = isActive(s);
    const busy = this.busy ? isActive(hass.states[this.busy]) : false;
    return html`<button
      class="card tile ${on ? "on" : ""} ${busy ? "busy" : ""}"
      aria-pressed=${String(on)}
      @click=${() => toggle(this.entityId, this.name)}
    >
      <span class="shape ${on ? "" : "off"}"><ha-icon icon="mdi:desktop-tower-monitor"></ha-icon></span>
      <div>
        <div class="primary">${this.name}</div>
        <div class="secondary">${isUnavailable(s) ? "Indisponible" : busy ? "En cours…" : on ? "Allumé" : "Éteint"}</div>
      </div>
    </button>`;
  }
}
customElements.define("kh-computer", KhComputer);

/** Automation switch; the icon blinks while the automation is enabled. */
export class KhAutomation extends Widget {
  static properties = { spec: { attribute: false } };
  declare spec: Extract<Favorite, { type: "automation" }>;
  protected watched() {
    return this.spec ? [this.spec.entity] : [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .shape.on ha-icon {
        animation: kh-blink 2.4s ease-in-out infinite;
      }
    `,
  ];
  render() {
    const hass = store.hass;
    const s = this.spec ? hass?.states[this.spec.entity] : undefined;
    if (!hass || !s) return nothing;
    const on = isActive(s);
    return html`<button class="card tile" aria-pressed=${String(on)} @click=${() => setAutomation(this.spec.entity, !on)}>
      <span class="shape ${on ? "on" : "off"}" style="--rgb: var(--rgb-purple)"><ha-icon icon="mdi:creation"></ha-icon></span>
      <div>
        <div class="primary">${this.spec.name}</div>
        <div class="secondary">${on ? "Activée" : "Désactivée"}</div>
      </div>
    </button>`;
  }
}
customElements.define("kh-automation", KhAutomation);

/** Stock line: name, price, change in % (green up, red down). */
export class KhStock extends Widget {
  static properties = { entityId: { attribute: "entity-id" }, name: {} };
  declare entityId: string;
  declare name: string;
  protected watched() {
    return [this.entityId];
  }
  render() {
    const hass = store.hass;
    const s = hass?.states[this.entityId];
    if (!hass || !s) return nothing;
    const change = Number(s.attributes.regularMarketChangePercent);
    const up = change >= 0;
    const currency = s.attributes.currencySymbol ?? "";
    return html`<button class="card tile" @click=${() => openMoreInfo(this, this.entityId)}>
      <span class="shape" style="--rgb:${up ? "var(--rgb-green)" : "var(--rgb-red)"}">
        <ha-icon icon=${up ? "mdi:trending-up" : "mdi:trending-down"}></ha-icon>
      </span>
      <div>
        <div class="primary ellipsis">${this.name}</div>
        <div class="secondary ellipsis">${s.attributes.symbol ?? ""}</div>
      </div>
      <div class="value">
        <div>${isNaN(Number(s.state)) ? s.state : `${formatNumber(Number(s.state), 2)} ${currency}`}</div>
        <div class="secondary" style="color: rgb(${up ? "var(--rgb-green)" : "var(--rgb-red)"})">
          ${isNaN(change) ? "" : `${up ? "+" : ""}${formatNumber(change, 2)} %`}
        </div>
      </div>
    </button>`;
  }
}
customElements.define("kh-stock", KhStock);

/** "Partir" and "QR Wifi" buttons. */
export class KhOthers extends Widget {
  static properties = { showQr: { state: true } };
  declare showQr: boolean;
  protected watched() {
    return config.home.leave ? [config.home.leave] : [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--kh-gap);
      }
      .qr {
        margin-top: var(--kh-gap);
        padding: 16px;
        display: grid;
        justify-items: center;
        gap: 8px;
      }
      .qr img {
        width: min(240px, 100%);
        border-radius: 8px;
        background: #fff;
      }
    `,
  ];
  render() {
    const h = config.home;
    const running = h.leave ? isActive(store.get(h.leave)) : false;
    return html`<div class="grid">
        ${h.leave
          ? html`<button class="card tile" @click=${() => runScript(h.leave!)}>
              <span class="shape" style="--rgb: var(--rgb-indigo)"><ha-icon icon="mdi:hand-wave-outline"></ha-icon></span>
              <div><div class="primary">Partir</div><div class="secondary">${running ? "En cours…" : "Tout éteindre"}</div></div>
            </button>`
          : nothing}
        ${h.wifiQr
          ? html`<button class="card tile" aria-expanded=${String(!!this.showQr)} @click=${() => (this.showQr = !this.showQr)}>
              <span class="shape" style="--rgb: var(--rgb-teal)"><ha-icon icon="mdi:qrcode"></ha-icon></span>
              <div><div class="primary">QR Wi-Fi</div><div class="secondary">${this.showQr ? "Masquer" : "Afficher"}</div></div>
            </button>`
          : nothing}
      </div>
      ${this.showQr && h.wifiQr
        ? html`<div class="card qr"><img src=${h.wifiQr} alt="QR code du Wi-Fi de la maison" /><div class="secondary">Scanne pour rejoindre le Wi-Fi</div></div>`
        : nothing}`;
  }
}
customElements.define("kh-others", KhOthers);
