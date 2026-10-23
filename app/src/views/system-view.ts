import { LitElement, css, html, nothing, svg } from "lit";
import { openMoreInfo, restartHomeAssistant, setAutomation, triggerAutomation } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive, stateLabel } from "../format.ts";
import { ago, openPerson, openTablet } from "../popups/index.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import type { HassEntity } from "../types.ts";
import { pageHead, pageStyles } from "./page.ts";

/** Semi-circle gauge, filled to value/max. */
function gauge(label: string, value: number, max: number, unit: string, color: string, invert = false) {
  const pct = isNaN(value) ? 0 : Math.min(1, value / max);
  const r = 44, c = Math.PI * r;
  const good = invert ? 1 - pct : pct;
  const tone = isNaN(value) ? "grey" : good > 0.5 ? color : good > 0.2 ? "orange" : "red";
  return html`<div class="gauge" style="--rgb: var(--rgb-${tone})">
    ${svg`<svg viewBox="0 0 110 64" aria-hidden="true">
      <path d="M11 58 A44 44 0 0 1 99 58" fill="none" stroke="var(--kh-card-2)" stroke-width="10" stroke-linecap="round" />
      <path d="M11 58 A44 44 0 0 1 99 58" fill="none" stroke="rgb(var(--rgb))" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" style="transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" />
    </svg>`}
    <div class="g-value">${isNaN(value) ? "—" : formatNumber(value, 0)}<small> ${unit}</small></div>
    <div class="secondary">${label}</div>
  </div>`;
}

function levelColor(v: number): string {
  return isNaN(v) ? "grey" : v > 60 ? "green" : v > 20 ? "orange" : "red";
}

/** Système: family, internet, HA, tablet, batteries, updates, backups, automations, search. */
export class KhSystemView extends LitElement {
  static properties = { query: { state: true }, allBatteries: { state: true } };
  declare query: string;
  declare allBatteries: boolean;

  constructor() {
    super();
    this.query = "";
    this.allBatteries = false;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const s = config.system;
      return [
        ...s.trackers.map((t) => t.entity),
        ...Object.values(s.speedtest ?? {}),
        ...Object.values(s.ethernet ?? {}),
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
    pageStyles,
    css`
      .gauges {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 14px 10px;
      }
      .gauge {
        display: grid;
        justify-items: center;
        text-align: center;
      }
      .gauge svg {
        width: 100%;
        max-width: 130px;
      }
      .g-value {
        margin-top: -22px;
        font-weight: 800;
        font-size: 1.125rem;
        font-variant-numeric: tabular-nums;
      }
      .g-value small {
        font-size: 0.75rem;
        color: var(--kh-text-2);
      }
      .bars {
        display: grid;
        gap: 12px;
        padding: 14px;
      }
      .bar .label {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 0.875rem;
        margin-bottom: 6px;
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
      .people {
        --min: 220px;
      }
      .person img {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 0 0 3px rgba(var(--rgb), 0.8);
      }
      .search {
        width: 100%;
        box-sizing: border-box;
        height: 48px;
        padding: 0 16px;
        border: 0;
        border-radius: var(--kh-radius-icon);
        background: var(--kh-card);
        color: inherit;
        font: inherit;
      }
      .search:focus-visible {
        outline: 3px solid rgb(var(--rgb-blue));
      }
    `,
  ];

  private bar(label: string, id?: string) {
    const v = id ? Number(store.hass?.states[id]?.state) : NaN;
    if (!id) return nothing;
    const tone = isNaN(v) ? "grey" : v > 85 ? "red" : v > 65 ? "orange" : "green";
    return html`<button class="bar" style="--rgb: var(--rgb-${tone}); text-align:left" @click=${() => openMoreInfo(this, id)}>
      <div class="label"><span>${label}</span><span>${isNaN(v) ? "—" : `${formatNumber(v, 0)} %`}</span></div>
      <div class="track"><div class="fill" style="width:${isNaN(v) ? 0 : Math.min(100, v)}%"></div></div>
    </button>`;
  }

  private row(icon: string, color: string, title: string, sub: string, value = "", onClick?: () => void) {
    const inner = html`<span class="shape" style="--rgb: var(--rgb-${color})"><ha-icon icon=${icon}></ha-icon></span>
      <div><div class="primary ellipsis">${title}</div>${sub ? html`<div class="secondary ellipsis">${sub}</div>` : nothing}</div>
      ${value ? html`<span class="value">${value}</span>` : nothing}`;
    return onClick ? html`<button class="card row" @click=${onClick}>${inner}</button>` : html`<div class="card row">${inner}</div>`;
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
    const autos = all.filter((x) => x.entity_id.startsWith("automation.")).length;
    const scripts = all.filter((x) => x.entity_id.startsWith("script.")).length;
    const q = this.query.trim().toLowerCase();
    const results: HassEntity[] = q.length > 1
      ? all.filter((x) => x.entity_id.includes(q) || String(x.attributes.friendly_name ?? "").toLowerCase().includes(q)).slice(0, 12)
      : [];
    const backupState = st(s.backups?.state)?.state;
    const sub = [updates.length ? `${updates.length} mise${updates.length > 1 ? "s" : ""} à jour` : "", low ? `${low} pile${low > 1 ? "s" : ""} faible${low > 1 ? "s" : ""}` : ""]
      .filter(Boolean)
      .join(", ");

    return html`
      ${pageHead("mdi:cog-outline", "grey", "Système", sub || "Tout va bien")}

      <h2>Famille</h2>
      <div class="grid people">
        ${Object.keys(config.people)
          .filter((p) => !config.people[p].device)
          .map((p) => {
            const ps = st(`person.${p}`);
            if (!ps) return nothing;
            const home = ps.state === "home";
            return html`<button class="card row person" style="--rgb: var(--rgb-${home ? "green" : "red"})" @click=${() => openPerson(p)}>
              ${ps.attributes.entity_picture ? html`<img src=${ps.attributes.entity_picture} alt="" />` : html`<span class="shape"><ha-icon icon="mdi:account"></ha-icon></span>`}
              <div>
                <div class="primary">${String(ps.attributes.friendly_name ?? p).replace(/^./, (c) => c.toUpperCase())}</div>
                <div class="secondary">${home ? "À la maison" : stateLabel(hass, ps)}, ${ago(ps.last_changed)}</div>
              </div>
            </button>`;
          })}
        ${s.trackers.map((t) => {
          const ts = st(t.entity);
          if (!ts) return nothing;
          const home = ts.state === "home";
          return this.row(t.icon, home ? "green" : "orange", t.name, home ? "À la maison" : "Ailleurs", "", () => openMoreInfo(this, t.entity));
        })}
      </div>

      <div class="cols">
        <div>
          ${s.speedtest
            ? html`<h2>Internet</h2>
                <div class="card gauges">
                  ${gauge("Descendant", num(s.speedtest.download), 1000, "Mb/s", "green")}
                  ${gauge("Montant", num(s.speedtest.upload), 1000, "Mb/s", "green")}
                  ${gauge("Latence", num(s.speedtest.ping), 100, "ms", "green", true)}
                </div>
                <div class="row" style="padding:10px 0 0; gap:10px">
                  ${s.speedtest.run && st(s.speedtest.run)
                    ? html`<button class="action" @click=${() => triggerAutomation(s.speedtest!.run!)}><ha-icon icon="mdi:speedometer"></ha-icon>Lancer un test</button>`
                    : nothing}
                  <span class="secondary">${st(s.speedtest.download) ? `Mesuré ${ago(st(s.speedtest.download)!.last_changed)}` : ""}</span>
                </div>`
            : nothing}

          <h2>Home Assistant</h2>
          <div class="card bars">
            ${this.bar("Disque", s.ha.disk)} ${this.bar("Mémoire", s.ha.memory)} ${this.bar("Processeur", s.ha.cpu)}
          </div>
          <div class="stack" style="margin-top:12px">
            ${s.ha.lastBoot && st(s.ha.lastBoot)
              ? this.row("mdi:restart", "indigo", "Dernier démarrage du serveur", ago(st(s.ha.lastBoot)!.state))
              : nothing}
            ${s.backups
              ? this.row(
                  backupState === "create_backup" ? "mdi:backup-restore" : "mdi:cloud-check-outline",
                  backupState === "create_backup" ? "orange" : "green",
                  backupState === "create_backup" ? "Sauvegarde en cours" : "Sauvegardes",
                  `Dernière ${ago(st(s.backups.last)?.state)}, prochaine ${ago(st(s.backups.next)?.state)}`,
                  "",
                  () => (location.href = "/config/backup"),
                )
              : nothing}
            ${hass.user?.is_admin
              ? html`<button class="action" style="--rgb: var(--rgb-red)" @click=${() => restartHomeAssistant()}>
                  <ha-icon icon="mdi:restart-alert"></ha-icon>Redémarrer Home Assistant
                </button>`
              : nothing}
          </div>
        </div>

        <div>
          ${s.tablet && st(s.tablet.screen)
            ? html`<h2>Tablette</h2>
                ${this.row(
                  "mdi:tablet",
                  isActive(st(s.tablet.screen)) ? "indigo" : "grey",
                  s.tablet.name,
                  `Écran ${isActive(st(s.tablet.screen)) ? "allumé" : "éteint"}${s.tablet.battery ? `, batterie ${stateLabel(hass, st(s.tablet.battery))}` : ""}`,
                  "",
                  () => openTablet(),
                )}`
            : nothing}

          <h2>Mises à jour</h2>
          ${updates.length
            ? html`<div class="stack">
                ${updates.map((u) =>
                  this.row("mdi:package-up", "blue", String(u.attributes.title ?? u.attributes.friendly_name).replace(/\s*update$/i, ""), `${u.attributes.installed_version ?? ""} → ${u.attributes.latest_version ?? ""}`, "", () => openMoreInfo(this, u.entity_id)),
                )}
              </div>`
            : this.row("mdi:check-circle-outline", "green", "Tout est à jour", "")}

          <h2>Automatisations</h2>
          <div class="stack">
            <div class="secondary">${autos} automatisations et ${scripts} scripts</div>
            ${s.automations.map((a) => {
              const as = st(a.entity);
              if (!as) return nothing;
              const on = isActive(as);
              return html`<button class="card row" aria-pressed=${String(on)} @click=${() => setAutomation(a.entity, !on)}>
                <span class="shape ${on ? "on" : "off"}" style="--rgb: var(--rgb-purple)"><ha-icon icon="mdi:creation"></ha-icon></span>
                <div><div class="primary">${a.name}</div><div class="secondary">${on ? "Activée" : "Désactivée"}</div></div>
              </button>`;
            })}
          </div>
        </div>
      </div>

      <h2>Batteries</h2>
      <div class="grid" style="--min: 220px">
        ${(this.allBatteries ? batteries : batteries.slice(0, 8)).map((b) => {
          const v = Number(b.state);
          return this.row(
            v > 60 ? "mdi:battery-high" : v > 20 ? "mdi:battery-medium" : "mdi:battery-alert-variant-outline",
            levelColor(v),
            String(b.attributes.friendly_name ?? b.entity_id).replace(/_/g, " ").replace(/\s*(battery level|batterie|battery|niveau de batterie)$/i, "").replace(/^./, (c) => c.toUpperCase()),
            "",
            `${formatNumber(v, 0)} %`,
            () => openMoreInfo(this, b.entity_id),
          );
        })}
      </div>
      ${batteries.length > 8
        ? html`<button class="action" style="margin-top:10px" @click=${() => (this.allBatteries = !this.allBatteries)}>
            ${this.allBatteries ? "Moins" : `Voir les ${batteries.length}`}
          </button>`
        : nothing}

      <h2>Rechercher un appareil</h2>
      <input class="search" type="search" placeholder="Nom ou identifiant, ex. fenêtre, salon…" .value=${this.query}
        @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} aria-label="Rechercher une entité" />
      <div class="stack" style="margin-top:10px">
        ${results.map((r) => this.row("mdi:magnify", "blue", String(r.attributes.friendly_name ?? r.entity_id), r.entity_id, stateLabel(hass, r), () => openMoreInfo(this, r.entity_id)))}
        ${q.length > 1 && !results.length ? html`<div class="empty">Aucun résultat</div>` : nothing}
      </div>
    `;
  }
}
customElements.define("kh-system-view", KhSystemView);
