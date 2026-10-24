import { LitElement, css, html, nothing } from "lit";
import { openMoreInfo, restartHomeAssistant, setAutomation, triggerAutomation } from "../actions.ts";
import { gauge, gaugeStyles } from "../components/gauge.ts";
import "../components/mini-map.ts";
import { config } from "../config.ts";
import { formatNumber, isActive, stateLabel } from "../format.ts";
import { ago, openPerson, openTablet, openTracker } from "../popups/open.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import type { HassEntity } from "../types.ts";
import { roomSceneStyles } from "./room-art.ts";
import { sceneStyles, systemScene } from "./scenes.ts";
import { head, hero, v2 } from "./styles.ts";

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());


/** Système: the family on one map, internet, HA, updates, automations, batteries, search. */
export class KhV2System extends LitElement {
  static properties = { prefix: {}, query: { state: true }, allBatteries: { state: true }, allAutomations: { state: true } };
  declare prefix: string;
  declare query: string;
  declare allBatteries: boolean;
  declare allAutomations: boolean;

  constructor() {
    super();
    this.query = "";
    this.allBatteries = false;
    this.allAutomations = false;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const s = config.system;
      return [
        ...s.trackers.map((t) => t.entity),
        ...Object.values(s.speedtest ?? {}),
        ...Object.values(s.ha),
        ...Object.values(s.tablet ?? {}),
        ...Object.values(s.backups ?? {}),
        ...s.automations.map((a) => a.entity),
        ...Object.keys(config.people).map((p) => `person.${p}`),
      ].filter((x): x is string => typeof x === "string" && x.includes("."));
    });
  }

  static styles = [
    base,
    v2,
    gaugeStyles,
    roomSceneStyles,
    sceneStyles,
    css`
      .gauges {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .item img {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 0 0 3px rgba(var(--rgb), 0.85);
      }
      .people {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
        gap: 6px;
      }
      .bar {
        display: grid;
        gap: 6px;
        text-align: left;
        width: 100%;
      }
      .bar .label {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .bar .track {
        height: 10px;
        border-radius: 5px;
        background: var(--kh-card-2);
        overflow: hidden;
      }
      .bar .fill {
        height: 100%;
        border-radius: 5px;
        background: rgb(var(--rgb));
        transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .toggle {
        width: 46px;
        height: 28px;
        border-radius: 14px;
        background: var(--kh-card);
        position: relative;
        transition: background-color 250ms ease;
      }
      .toggle::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
        transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .toggle.on {
        background: rgb(var(--rgb-purple));
      }
      .toggle.on::after {
        transform: translateX(18px);
      }
      .more {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 20px;
        background: var(--kh-card-2);
        font-weight: 700;
      }
      .scroll {
        max-height: 520px;
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .search {
        width: 100%;
        box-sizing: border-box;
        height: 52px;
        padding: 0 18px;
        border: 0;
        border-radius: 18px;
        background: var(--kh-card-2);
        color: inherit;
        font: inherit;
      }
      .search:focus-visible {
        outline: 3px solid rgb(var(--rgb-blue));
      }
      .results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
        gap: 6px;
      }
    `,
  ];

  private item(icon: string, color: string, title: unknown, sub: unknown, value: unknown = "", onClick?: () => void) {
    const inner = html`<span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${icon}></ha-icon></span>
      <span style="min-width:0"><span class="primary ellipsis" style="display:block">${title}</span>${sub ? html`<span class="secondary ellipsis" style="display:block">${sub}</span>` : nothing}</span>
      <span class="v">${value}</span>`;
    return onClick ? html`<button class="item" @click=${onClick}>${inner}</button>` : html`<div class="item">${inner}</div>`;
  }

  private bar(label: string, id?: string) {
    if (!id) return nothing;
    const v = Number(store.hass?.states[id]?.state);
    const tone = isNaN(v) ? "grey" : v > 85 ? "red" : v > 65 ? "orange" : "green";
    return html`<button class="bar" style="--rgb: var(--rgb-${tone})" @click=${() => openMoreInfo(this, id)}>
      <span class="label"><span>${label}</span><span>${isNaN(v) ? "—" : `${formatNumber(v, 0)} %`}</span></span>
      <span class="track"><span class="fill" style="display:block; width:${isNaN(v) ? 0 : Math.min(100, v)}%"></span></span>
    </button>`;
  }

  /** One automation: what it does, when it last ran, and its switch. */
  private automation(id: string, name: string, keep = false) {
    const a = store.hass?.states[id];
    if (!a && !keep) return nothing;
    const on = isActive(a);
    const missing = !a || a.state === "unavailable";
    const last = a?.attributes.last_triggered as string | undefined;
    return html`<button class="item" aria-pressed=${String(on)} ?disabled=${missing} style=${missing ? "opacity:.5" : ""} @click=${() => setAutomation(id, !on)}>
      <span class="shape ${on ? "" : "off"}" style="--rgb: var(--rgb-purple)"><ha-icon icon="mdi:creation"></ha-icon></span>
      <span style="min-width:0"><span class="primary ellipsis" style="display:block">${name}</span>
        <span class="secondary ellipsis" style="display:block">${missing ? "Absente de cette instance" : `${on ? "Activée" : "Désactivée"}${last ? `, dernière exécution ${ago(last)}` : ""}`}</span></span>
      <span class="toggle ${on ? "on" : ""}" aria-hidden="true"></span>
    </button>`;
  }

  /** Everyone and every tracked object with a position, on one map. */
  private family() {
    const hass = store.hass!;
    const people = Object.keys(config.people).filter((p) => !config.people[p].device);
    const located = (id: string) => {
      const a = hass.states[id]?.attributes;
      return a?.latitude !== undefined && isFinite(Number(a.latitude)) && isFinite(Number(a.longitude));
    };
    const onMap = [...people.map((p) => `person.${p}`), ...config.system.trackers.map((t) => t.entity)].filter(located);
    return html`
      ${onMap.length
        ? html`<kh-mini-map .entities=${onMap} height="280"></kh-mini-map>`
        : nothing}
      <div class="people">
        ${people.map((p) => {
          const s = hass.states[`person.${p}`];
          if (!s) return nothing;
          const home = s.state === "home";
          return html`<button class="item" style="--rgb: var(--rgb-${home ? "green" : "red"})" @click=${() => openPerson(p)}>
            ${s.attributes.entity_picture ? html`<img src=${s.attributes.entity_picture} alt="" />` : html`<span class="shape"><ha-icon icon="mdi:account"></ha-icon></span>`}
            <span style="min-width:0"><span class="primary ellipsis" style="display:block">${cap(String(s.attributes.friendly_name ?? p))}</span>
              <span class="secondary ellipsis" style="display:block">${home ? "À la maison" : stateLabel(hass, s)}, ${ago(s.last_changed)}</span></span>
            <span></span>
          </button>`;
        })}
        ${config.system.trackers.map((t) => {
          const s = hass.states[t.entity];
          if (!s) return nothing;
          const home = s.state === "home";
          return this.item(t.icon, home ? "green" : "orange", t.name, home ? "À la maison" : "Ailleurs", "", () => openTracker(t.entity, t.icon));
        })}
      </div>
    `;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const s = config.system;
    const st = (id?: string) => (id ? hass.states[id] : undefined);
    const num = (id?: string) => Number(st(id)?.state);
    const all = Object.values(hass.states);
    const batteries = all
      .filter((x) => x.attributes.device_class === "battery" && x.entity_id.startsWith("sensor.") && !isNaN(Number(x.state)))
      .sort((a, b) => Number(a.state) - Number(b.state));
    const low = batteries.filter((b) => Number(b.state) <= 20).length;
    const updates = all.filter((x) => x.entity_id.startsWith("update.") && x.state === "on");
    const autos = all.filter((x) => x.entity_id.startsWith("automation."));
    const scripts = all.filter((x) => x.entity_id.startsWith("script.")).length;
    const q = this.query.trim().toLowerCase();
    const results: HassEntity[] =
      q.length > 1 ? all.filter((x) => x.entity_id.includes(q) || String(x.attributes.friendly_name ?? "").toLowerCase().includes(q)).slice(0, 12) : [];
    const backup = st(s.backups?.state)?.state;
    const issues = updates.length + low;

    return html`
      ${hero(
        issues ? "indigo" : "green",
        "mdi:cog",
        "Système",
        issues ? `${issues} point${issues > 1 ? "s" : ""} à voir` : "Tout va bien",
        `${autos.length} automatisations, ${scripts} scripts`,
        html`${updates.length ? html`<span class="chip"><ha-icon icon="mdi:package-up"></ha-icon>${updates.length} mise${updates.length > 1 ? "s" : ""} à jour</span>` : nothing}
          ${low ? html`<span class="chip alert"><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon>${low} pile${low > 1 ? "s" : ""} faible${low > 1 ? "s" : ""}</span>` : nothing}
          ${s.speedtest && st(s.speedtest.download)
            ? html`<span class="chip"><ha-icon icon="mdi:download-network"></ha-icon>${formatNumber(num(s.speedtest.download), 0)} Mb/s</span>`
            : nothing}`,
        html`<div class="art">${systemScene(issues === 0, hass.states["sun.sun"]?.state === "below_horizon")}</div>`,
      )}
      <div class="bento">
        <section class="tile" style="--tint: var(--rgb-green); --w: 7; --w6: 6; --w2: 2">
          ${head("mdi:account-group", "Famille et objets")}
          ${this.family()}
        </section>

        <div class="col" style="--w: 5; --w6: 6; --w2: 2">
          ${s.speedtest
            ? html`<section class="tile" style="--tint: var(--rgb-teal); --w: 5; --w6: 6; --w2: 2">
                ${head("mdi:speedometer", "Internet")}
                <div class="gauges">
                  ${gauge("Descendant", num(s.speedtest.download), 1000, "Mb/s", "green")}
                  ${gauge("Montant", num(s.speedtest.upload), 1000, "Mb/s", "green")}
                  ${gauge("Latence", num(s.speedtest.ping), 100, "ms", "green", true)}
                </div>
                <div class="secondary">${st(s.speedtest.download) ? `Mesuré ${ago(st(s.speedtest.download)!.last_changed)}` : ""}</div>
                ${s.speedtest.run && st(s.speedtest.run)
                  ? html`<button class="more" @click=${() => triggerAutomation(s.speedtest!.run!)}><ha-icon icon="mdi:play"></ha-icon>Lancer un test</button>`
                  : nothing}
              </section>`
            : nothing}
            ${s.tablet && st(s.tablet.screen)
              ? html`<section class="tile" style="--tint: var(--rgb-indigo)">
                  ${head("mdi:tablet", "Tablette")}
                  <div class="list">
                    ${this.item("mdi:tablet", isActive(st(s.tablet.screen)) ? "indigo" : "grey", s.tablet.name,
                      `Écran ${isActive(st(s.tablet.screen)) ? "allumé" : "éteint"}${s.tablet.battery ? `, batterie ${stateLabel(hass, st(s.tablet.battery))}` : ""}`, "", () => openTablet())}
                  </div>
                </section>`
              : nothing}
          <section class="tile" style="--tint: var(--rgb-indigo); --w: 4; --w6: 3; --w2: 2">
            ${head("mdi:package-up", "Mises à jour")}
            <div class="list">
              ${updates.length
                ? updates.map((u) =>
                    this.item("mdi:package-up", "blue", String(u.attributes.title ?? u.attributes.friendly_name).replace(/\s*update$/i, ""),
                      `${u.attributes.installed_version ?? ""} → ${u.attributes.latest_version ?? ""}`, "", () => openMoreInfo(this, u.entity_id)),
                  )
                : this.item("mdi:check-circle-outline", "green", "Tout est à jour", "")}
            </div>
          </section>
        </div>

        <section class="tile" style="--tint: var(--rgb-blue); --w: 6; --w6: 3; --w2: 2">
          ${head("mdi:home-assistant", "Home Assistant")}
          ${this.bar("Disque", s.ha.disk)} ${this.bar("Mémoire", s.ha.memory)} ${this.bar("Processeur", s.ha.cpu)}
          <div class="list">
            ${s.ha.lastBoot && st(s.ha.lastBoot) ? this.item("mdi:restart", "indigo", "Démarré", ago(st(s.ha.lastBoot)!.state)) : nothing}
            ${s.backups
              ? this.item(
                  backup === "create_backup" ? "mdi:backup-restore" : "mdi:cloud-check-outline",
                  backup === "create_backup" ? "orange" : "green",
                  backup === "create_backup" ? "Sauvegarde en cours" : "Sauvegardes",
                  `Dernière ${ago(st(s.backups.last)?.state)}, prochaine ${ago(st(s.backups.next)?.state)}`,
                  "",
                  () => (location.href = "/config/backup"),
                )
              : nothing}
            ${hass.user?.is_admin
              ? this.item("mdi:restart-alert", "red", "Redémarrer Home Assistant", "Demande une confirmation", "", () => restartHomeAssistant())
              : nothing}
          </div>
        </section>

        <section class="tile" style="--tint: var(--rgb-yellow); --w: 6; --w6: 3; --w2: 2">
          ${head("mdi:battery-heart-variant", "Batteries")}
          <div class="list ${this.allBatteries ? "scroll" : ""}">
            ${(this.allBatteries ? batteries : batteries.slice(0, 6)).map((b) => {
              const v = Number(b.state);
              return this.item(
                v > 60 ? "mdi:battery-high" : v > 20 ? "mdi:battery-medium" : "mdi:battery-alert-variant-outline",
                v > 60 ? "green" : v > 20 ? "orange" : "red",
                cap(String(b.attributes.friendly_name ?? b.entity_id).replace(/_/g, " ").replace(/\s*(battery level|batterie|battery|niveau de batterie)$/i, "")),
                "",
                `${formatNumber(v, 0)} %`,
                () => openMoreInfo(this, b.entity_id),
              );
            })}
          </div>
          ${batteries.length > 6
            ? html`<button class="more" @click=${() => (this.allBatteries = !this.allBatteries)}>${this.allBatteries ? "Moins" : `Voir les ${batteries.length}`}</button>`
            : nothing}
        </section>

        <section class="tile" style="--tint: var(--rgb-purple); --w: 12; --w6: 6; --w2: 2">
          ${head("mdi:creation", "Automatisations")}
          <div class="results">${s.automations.map((a) => this.automation(a.entity, a.name, true))}</div>
          <button class="more" aria-expanded=${String(this.allAutomations)} @click=${() => (this.allAutomations = !this.allAutomations)}>
            <ha-icon icon=${this.allAutomations ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>${this.allAutomations ? "Masquer" : `Toutes les automatisations (${autos.length})`}
          </button>
          ${this.allAutomations
            ? html`<div class="results">
                ${autos
                  .filter((x) => !s.automations.some((a) => a.entity === x.entity_id))
                  .sort((x, y) => Number(isActive(y)) - Number(isActive(x)) || String(x.attributes.friendly_name).localeCompare(String(y.attributes.friendly_name), "fr"))
                  .map((x) => this.automation(x.entity_id, String(x.attributes.friendly_name ?? x.entity_id).replace(/_/g, " ")))}
              </div>`
            : nothing}
        </section>

        <section class="tile" style="--tint: var(--rgb-blue); --w: 12; --w6: 6; --w2: 2">
          ${head("mdi:magnify", "Rechercher un appareil")}
          <input class="search" type="search" placeholder="Nom ou identifiant, ex. fenêtre, salon…" .value=${this.query}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} aria-label="Rechercher une entité" />
          ${results.length
            ? html`<div class="results">
                ${results.map((r) => this.item("mdi:magnify", "blue", String(r.attributes.friendly_name ?? r.entity_id), r.entity_id, stateLabel(hass, r), () => openMoreInfo(this, r.entity_id)))}
              </div>`
            : q.length > 1
              ? html`<div class="secondary">Aucun résultat pour « ${this.query.trim()} ».</div>`
              : nothing}
        </section>
      </div>
    `;
  }
}
customElements.define("kh-v2-system", KhV2System);
