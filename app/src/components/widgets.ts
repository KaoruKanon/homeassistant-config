import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, runScript, setAutomation, toggle } from "../actions.ts";
import { ago, openComputer, openMediaItem, openThermometer, openWifiQr } from "../popups/index.ts";
import { Press } from "./gestures.ts";
import "./sparkline.ts";
import "./swipe.ts";
import { jellyfinLogo } from "./brand-icons.ts";
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
      /* Same build as the Spotify card: the artwork on the right fading in,
         icon and titles on the left, a row of grey chips, and a 42 px bar
         along the bottom (here: watch it on Jellyfin). */
      .jf {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        padding: 12px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        cursor: pointer;
      }
      .art {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(260px, 60%);
        z-index: -1;
        background-size: cover;
        background-position: center 25%;
        -webkit-mask-image: linear-gradient(to right, transparent, black 70%);
        mask-image: linear-gradient(to right, transparent, black 70%);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .head > div {
        min-width: 0;
      }
      .head .primary,
      .head .secondary {
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
      }
      .jf .shape {
        background: var(--kh-card-2);
      }
      .chips {
        display: flex;
        gap: 8px;
        flex-wrap: nowrap;
        overflow: hidden;
      }
      .chips span {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        padding: 0 12px;
        border-radius: var(--kh-radius-icon);
        background: rgb(74 74 74 / 0.7);
        color: #fff;
        font-size: 0.8125rem;
        font-weight: 700;
      }
      .chips ha-icon {
        --mdc-icon-size: 16px;
      }
      .watch {
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 14px;
        border-radius: var(--kh-radius-icon);
        background: linear-gradient(90deg, #aa5cc3, #00a4dc);
        color: #fff;
        font-size: 0.8125rem;
        font-weight: 800;
        text-decoration: none;
      }
      .watch span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .watch .when {
        font-weight: 600;
        opacity: 0.9;
      }
    `,
  ];
  render() {
    const hass = store.hass;
    const id = config.home.jellyfin;
    const s = id ? hass?.states[id] : undefined;
    const items = ((s?.attributes.data as any[] | undefined) ?? []).slice(1).filter((i) => i.title).slice(0, 6);
    if (!hass || !items.length) return nothing;
    return html`<kh-swipe label="Ajoutés récemment sur Jellyfin">
      ${items.map((item) => {
        const art = item.fanart || item.poster;
        return html`<div class="card jf" role="button" tabindex="0" @click=${() => openMediaItem(item)}
          @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && openMediaItem(item)}>
          ${art ? html`<div class="art" style="background-image:url('${art}')"></div>` : nothing}
          <div class="head">
            <span class="shape">${jellyfinLogo(22)}</span>
            <div>
              <div class="primary ellipsis">${item.title}</div>
              <div class="secondary ellipsis">${[item.number, item.episode].filter(Boolean).join(", ") || (item.aired ?? "").slice(0, 4)}</div>
            </div>
          </div>
          <div class="chips">
            ${item.rating ? html`<span><ha-icon icon="mdi:star" style="color:#ffd34d"></ha-icon>${String(item.rating).replace(/[★☆]/g, "").trim()}</span>` : nothing}
            ${item.runtime ? html`<span>${item.runtime} min</span>` : nothing}
            ${item.genres ? html`<span>${String(item.genres).split(",")[0]}</span>` : nothing}
          </div>
          ${item.deep_link
            ? html`<a class="watch" href=${item.deep_link} target="_blank" rel="noopener" @click=${(e: Event) => e.stopPropagation()}>
                <span><ha-icon icon="mdi:play"></ha-icon>Regarder</span><span class="when">Ajouté ${item.airdate ? ago(item.airdate) : "récemment"}</span>
              </a>`
            : html`<div class="watch"><span>Ajouté ${item.airdate ? ago(item.airdate) : "récemment"}</span></div>`}
        </div>`;
      })}
    </kh-swipe>`;
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

/** Room thermometer: temperature, humidity, low-battery warning, 24 h graph. */
export class KhThermometer extends Widget {
  static styles = [
    ...Widget.styles,
    css`
      .thermo {
        display: block;
        width: 100%;
        padding: 0;
        text-align: left;
        overflow: hidden;
      }
      /* The graph runs to the edges of the card, as in Mushroom. */
      .thermo kh-sparkline {
        margin-top: -4px;
      }
    `,
  ];
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
    return html`<button class="card thermo" @click=${() => openThermometer(this.spec)}>
      <div class="tile">
        <span class="shape" style="--rgb:${rgb}"><ha-icon icon="mdi:thermometer"></ha-icon></span>
        <div>
          <div class="primary">${this.spec.name}</div>
          <div class="secondary">
            ${isNaN(t) ? "Indisponible" : `${formatNumber(t)} °C${hum ? ` / ${hum} %` : ""}`}${!isNaN(battery) && battery < 20 ? ", pile faible" : ""}
          </div>
        </div>
      </div>
      <kh-sparkline compact .entities=${[
        { entity: this.spec.temperature, label: "Température", color: "var(--rgb-orange)", unit: "°C" },
        ...(this.spec.humidity ? [{ entity: this.spec.humidity, label: "Humidité", color: "var(--rgb-light-blue)", unit: "%" }] : []),
      ]}></kh-sparkline>
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
  private press = new Press(
    () => toggle(this.entityId, this.name),
    () => {
      const c = config.home.computers.find((x) => x.entity === this.entityId);
      if (c) openComputer(c);
    },
  );
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
      aria-description="Appui long : détails"
      @pointerdown=${this.press.down}
      @pointerup=${this.press.cancel}
          @pointermove=${this.press.move}
          @pointercancel=${this.press.cancel}
      @pointerleave=${this.press.cancel}
      @contextmenu=${this.press.contextmenu}
      @click=${this.press.click}
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
  protected watched() {
    return config.home.leave ? [config.home.leave] : [];
  }
  static styles = [
    ...Widget.styles,
    css`
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
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
          ? html`<button class="card tile" @click=${() => openWifiQr()}>
              <span class="shape" style="--rgb: var(--rgb-teal)"><ha-icon icon="mdi:qrcode"></ha-icon></span>
              <div><div class="primary">QR Wi-Fi</div><div class="secondary">Pour les invités</div></div>
            </button>`
          : nothing}
      </div>`;
  }
}
customElements.define("kh-others", KhOthers);
