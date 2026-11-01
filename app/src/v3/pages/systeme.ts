import { css, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";
import { pressButton, restartHomeAssistant, setNumber, toggle, triggerAutomation } from "../../actions.ts";
import { confirmAction } from "../../components/confirm-dialog.ts";
import { inFrench, showToast } from "../../components/toast.ts";
import { config } from "../../config.ts";
import { ago } from "../../format.ts";
import { EntitiesController, store } from "../../store.ts";
import type { HassEntity, HomeAssistant } from "../../types.ts";
import { f0, num } from "../data.ts";
import { icon } from "../icons.ts";
import { goTo } from "../nav.ts";
import { Page } from "../page.ts";
import { PALETTES, saveTheme, swatch, type Mode, type Palette, type ThemeChoice } from "../theme.ts";

/** Service call with the app's French error toast (actions.ts has no update/backup helpers). */
async function call(domain: string, service: string, data: Record<string, unknown> = {}, target?: Record<string, unknown>): Promise<boolean> {
  const hass = store.hass;
  if (!hass) return false;
  try {
    await hass.callService(domain, service, data, target, false);
    return true;
  } catch (err) {
    showToast({ kind: "error", message: inFrench((err as { message?: string })?.message ?? String(err)) });
    return false;
  }
}

const ARC = "M12 62 A48 48 0 0 1 108 62";
const LOW_BATTERY = 30;
const TEST_MS = 120_000;
const dayTime = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Semicircle gauge; the numbers are drawn as text, the whole reads as one image. */
function gauge(label: string, value: number | undefined, max: number, unit: string, color: string, hint: string): TemplateResult {
  const ratio = value === undefined ? 0 : Math.min(1, Math.max(0, value / max));
  const shown = f0(value);
  return html`<div class="g" role="img" aria-label="${label} : ${shown} ${unit}${hint ? `, ${hint}` : ""}">
    <span class="arc">
      <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true">
        <path class="trk" d=${ARC} pathLength="100"></path>
        <path class="val" d=${ARC} pathLength="100" style="stroke:${color};stroke-dasharray:${(ratio * 100).toFixed(1)} 100;stroke-opacity:${ratio ? 1 : 0}"></path>
      </svg>
      <span class="gv" aria-hidden="true"><span class="num">${shown}</span><span class="st">${unit}</span></span>
    </span>
    <span class="gl" aria-hidden="true">${label}</span>
    <span class="st" aria-hidden="true">${hint}</span>
  </div>`;
}

/** Battery outline filled to its level. */
function batteryIcon(level: number | undefined, color: string, charging = false): TemplateResult {
  const w = level === undefined ? 0 : Math.max(1.5, (Math.min(100, level) / 100) * 14);
  return html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke=${color} stroke-width="1.8" aria-hidden="true">
    <rect x="2" y="7" width="18" height="10" rx="2"></rect><path d="M22 10v4"></path>
    <rect x="4" y="9" width=${w} height="6" rx="1" fill=${color} stroke="none"></rect>
    ${charging ? svg`<path d="M12 8.5l-2.5 4h3l-2 3" stroke="var(--surf)" stroke-width="1.6"></path>` : nothing}
  </svg>`;
}

/** Readable name of a battery sensor: its own name, else its device's. */
function batteryName(hass: HomeAssistant, s: HassEntity): string {
  const strip = (n: string) => n.replace(/_/g, " ").replace(/\s*(battery level|niveau de batterie|batterie|battery)$/i, "").trim();
  let name = strip(String(s.attributes.friendly_name ?? ""));
  if (!name) {
    const dev = hass.devices[hass.entities[s.entity_id]?.device_id ?? ""];
    name = strip(dev?.name_by_user ?? dev?.name ?? s.entity_id.split(".")[1]);
  }
  return cap(name);
}

function updateName(u: HassEntity): string {
  const n = String(u.attributes.title ?? u.attributes.friendly_name ?? u.entity_id.split(".")[1]);
  return n.replace(/\s*(update|mise à jour)$/i, "").replace(/^mise à jour (de )?/i, "").trim() || n;
}

/**
 * Système: the health of the house at a glance. On the wall tablet a fixed
 * grid (Internet and Home Assistant gauges, updates, tablet, backups and
 * batteries, appearance) fills the screen without scrolling; narrower
 * screens get two columns, phones one.
 */
export class Kh3Systeme extends Page {
  static properties = { ...Page.properties, bright: { state: true }, testing: { state: true }, rang: { state: true } };
  /** Brightness preview (0..max) while the slider moves. */
  declare bright?: number;
  /** A speed test was asked at this time. */
  declare testing?: number;
  /** A tablet button just pressed (feedback for a few seconds). */
  declare rang?: string;
  private testTimer = 0;
  private rangTimer = 0;

  constructor() {
    super();
    new EntitiesController(this, () => this.watched());
  }

  private watched(): string[] {
    const s = config.system;
    const all = Object.keys(store.hass?.states ?? {});
    return [
      ...Object.values(s.speedtest ?? {}),
      ...Object.values(s.ha),
      ...Object.values(s.tablet ?? {}),
      ...Object.values(s.backups ?? {}),
      ...all.filter((id) => id.startsWith("update.") || (id.startsWith("sensor.") && store.hass!.states[id].attributes.device_class === "battery")),
    ].filter((x): x is string => typeof x === "string" && x.includes("."));
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A fresh measure ends the "test running" state.
    const d = config.system.speedtest ? store.hass?.states[config.system.speedtest.download] : undefined;
    if (this.testing && d && Date.parse(d.last_changed) > this.testing) {
      this.testing = undefined;
      window.clearTimeout(this.testTimer);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.testTimer);
    window.clearTimeout(this.rangTimer);
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
      }
      .ch {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .ch .grow {
        flex: 1;
        min-width: 0;
      }
      .ch .h {
        display: block;
        font-size: 17px;
      }
      .ch .st {
        display: block;
      }
      /* "Tout voir": 44 px hit area, same layout box. */
      .ch > a.st {
        padding: 12px 4px;
        margin: -12px -4px;
      }
      .acts {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn.primary {
        background: var(--blue);
        color: #fff;
      }
      .btn.danger {
        color: var(--red);
      }
      .btn.spin svg {
        animation: kh-spin 1.1s linear infinite;
      }
      .ico.blue {
        background: var(--blueTint);
        color: var(--blue);
      }
      .ico.amber {
        background: var(--amberTint);
        color: var(--amberInk);
      }
      .ico.violet {
        background: var(--violetTint);
        color: var(--violet);
      }
      .ico.teal {
        background: var(--tealTint);
        color: var(--teal);
      }
      .ico.ha {
        background: #03a9f4;
        color: #fff;
      }
      .status {
        height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .status.ok {
        background: var(--tealTint);
        color: var(--teal);
      }
      .status.ok i {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        background: currentColor;
      }
      .status.warn {
        background: var(--amberTint);
        color: var(--amberInk);
      }
      header .count {
        font-size: 13px;
        color: var(--muted);
      }

      /* Gauges. */
      .gauges {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .g {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 0;
        text-align: center;
      }
      .arc {
        position: relative;
        width: 100%;
        max-width: 120px;
        container-type: inline-size;
      }
      .arc svg {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 120 / 70;
      }
      .g path {
        fill: none;
        stroke-width: 12;
        stroke-linecap: round;
      }
      .g .trk {
        stroke: var(--surf2);
      }
      .g .val {
        transition: stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .gv {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        justify-content: center;
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      /* The value scales with the gauge, so it always fits inside the arc. */
      .gv .num {
        font-size: clamp(15px, 19cqw, 24px);
        font-weight: 700;
        line-height: 1.1;
      }
      .gv .st {
        font-size: clamp(9px, 9cqw, 12px);
      }
      .gl {
        font-size: 13px;
        font-weight: 600;
      }

      /* Updates. */
      .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .upd {
        padding: 10px 10px 10px 12px;
        border-radius: 16px;
      }
      .upd img {
        width: 36px;
        height: 36px;
        border-radius: 11px;
        object-fit: contain;
        background: var(--surf);
        flex: none;
      }
      .upd .grow {
        flex: 1;
        min-width: 0;
      }
      .upd .nm {
        font-weight: 700;
      }
      .upd .btn {
        background: var(--surf);
      }
      .ok-line {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
      }
      .ok-line svg {
        color: var(--teal);
      }

      /* Tablet. */
      .tab {
        gap: 14px;
      }
      .tab .bat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        flex: none;
      }
      .slider {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        color: var(--muted);
      }
      .slider .num {
        width: 46px;
        text-align: right;
        font-weight: 700;
        color: var(--ink);
      }
      input[type="range"] {
        flex: 1;
        min-width: 0;
        height: 44px;
        margin: 0;
        background: transparent;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
        --pct: 50%;
      }
      input[type="range"]::-webkit-slider-runnable-track {
        height: 36px;
        border-radius: 12px;
        background: linear-gradient(to right, var(--violet) var(--pct), var(--surf2) var(--pct));
      }
      input[type="range"]::-moz-range-track {
        height: 36px;
        border-radius: 12px;
        background: linear-gradient(to right, var(--violet) var(--pct), var(--surf2) var(--pct));
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 6px;
        height: 36px;
        border-radius: 3px;
        background: var(--ink);
        opacity: 0.6;
      }
      input[type="range"]::-moz-range-thumb {
        width: 6px;
        height: 36px;
        border: 0;
        border-radius: 3px;
        background: var(--ink);
        opacity: 0.6;
      }
      input[type="range"]:focus-visible {
        outline: 2px solid var(--blue);
        outline-offset: 2px;
        border-radius: 12px;
      }
      input[type="range"]:disabled {
        opacity: 0.5;
      }
      .tbtns {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .tbtns .btn {
        flex-direction: column;
        height: 60px;
        gap: 4px;
        padding: 0 8px;
        font-size: 12px;
      }

      /* Backups and batteries. */
      .sep {
        height: 1px;
        background: var(--surf2);
        flex: none;
      }
      .sub {
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }
      .bat-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        min-height: 30px;
      }
      .bat-row .num {
        font-weight: 700;
      }

      /* Appearance. */
      .look {
        gap: 14px;
      }
      .seg {
        flex: none;
      }
      .seg button {
        height: 40px;
        min-width: 44px;
      }
      .pals {
        flex: 1;
        min-width: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .pal {
        border: 2px solid transparent;
        border-radius: 16px;
        background: var(--surf2);
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        font-size: 13px;
        font-weight: 600;
        text-align: left;
      }
      .pal[aria-pressed="true"] {
        border-color: var(--blue);
      }
      .pal.off {
        opacity: 0.6;
      }
      .pal .sw {
        height: 30px;
        border-radius: 10px;
        display: flex;
        align-items: flex-end;
        gap: 4px;
        padding: 6px;
      }
      .pal .sw i {
        flex: 1;
        height: 100%;
        border-radius: 6px;
      }
      .pal .sw b {
        width: 12px;
        height: 12px;
        border-radius: 99px;
      }

      /* Phone and narrow: the tablet and appearance cards stack too. */
      .look .seg button {
        flex: 1;
      }

      /* Tablet portrait: two columns. */
      @container (min-width: 700px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .tab,
        .look {
          grid-column: 1 / -1;
        }
      }

      /* Wall tablet and desktop: the fixed frame of the mockup, no page scroll. */
      @container (min-width: 1000px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-template-rows: 56px 196px 196px minmax(0, 1fr) minmax(0, 1fr);
          height: calc(100vh - 32px);
          height: calc(100dvh - 32px);
          min-height: 740px;
        }
        header {
          grid-column: 1 / 4;
          flex-wrap: nowrap;
          min-width: 0;
        }
        header .count {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .inet {
          grid-column: 1 / 3;
          grid-row: 2;
        }
        .upds {
          grid-column: 3;
          grid-row: 2;
        }
        .ha {
          grid-column: 1 / 3;
          grid-row: 3;
        }
        .tab {
          grid-column: 1 / 3;
          grid-row: 4;
          flex-direction: row;
          align-items: center;
          gap: 18px;
        }
        .tab .ch {
          flex: 0 0 280px;
        }
        .tbtns {
          flex: none;
          grid-template-columns: repeat(3, 76px);
        }
        .bak {
          grid-column: 3;
          grid-row: 3 / 6;
        }
        .look {
          grid-column: 1 / 3;
          grid-row: 5;
          flex-direction: row;
          align-items: center;
          gap: 18px;
        }
        .look .ch {
          flex: 0 0 150px;
        }
        .look .seg {
          flex: none;
        }
        .look .seg button {
          flex: none;
          padding: 0 12px;
        }
        .pals {
          flex: 1;
        }
      }
      @container (max-width: 699px) {
        .btn,
        .seg button {
          min-height: 44px;
        }
        header .count {
          flex-basis: 100%;
        }
        .ha .ch {
          flex-wrap: wrap;
        }
        .ha .acts {
          flex-basis: 100%;
          display: flex;
          gap: 8px;
        }
      }
    `,
  ];

  /** Internal links to Home Assistant's own pages, without reloading. */
  private go(e: MouseEvent, path: string): void {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    goTo(path);
  }

  private link(path: string, label: string, ic: string): TemplateResult {
    return html`<a class="btn" href=${path} @click=${(e: MouseEvent) => this.go(e, path)}>${icon(ic, 16)}${label}</a>`;
  }

  private flash(key: string): void {
    this.rang = key;
    window.clearTimeout(this.rangTimer);
    this.rangTimer = window.setTimeout(() => (this.rang = undefined), 4000);
  }

  // ---- Internet ----

  private runTest(): void {
    const run = config.system.speedtest?.run;
    if (!run) return;
    this.testing = Date.now();
    window.clearTimeout(this.testTimer);
    this.testTimer = window.setTimeout(() => (this.testing = undefined), TEST_MS);
    void triggerAutomation(run);
  }

  private internet(hass: HomeAssistant): TemplateResult | typeof nothing {
    const sp = config.system.speedtest;
    if (!sp) return nothing;
    const d = hass.states[sp.download];
    const down = num(sp.download), up = num(sp.upload), ping = num(sp.ping);
    const server = d?.attributes.server_name as string | undefined;
    const sub = d && d.state !== "unavailable" ? `Mesuré ${ago(d.last_changed)}${server ? `, serveur ${server}` : ""}` : "Pas encore de mesure";
    const pingHint = ping === undefined ? "" : ping < 30 ? "Excellente" : ping < 80 ? "Correcte" : "Élevée";
    const canRun = !!sp.run && !!hass.states[sp.run];
    return html`<section class="card inet" aria-label="Internet">
      <div class="ch">
        <span class="ico blue">${icon("wifi")}</span>
        <span class="grow"><span class="h">Internet</span><span class="st ell">${sub}</span></span>
        ${canRun
          ? html`<button class="btn primary ${this.testing ? "spin" : ""}" type="button" ?disabled=${!!this.testing} @click=${() => this.runTest()}>
              ${this.testing ? icon("refresh", 16) : icon("play", 16)}${this.testing ? "Test en cours…" : "Lancer un test"}
            </button>`
          : nothing}
        <span class="sr" role="status">${this.testing ? "Test de débit en cours…" : ""}</span>
      </div>
      <div class="gauges">
        ${gauge("Descendant", down, 1000, "Mb/s", "var(--blue)", "sur 1 000 Mb/s")}
        ${gauge("Montant", up, 1000, "Mb/s", "var(--teal)", "sur 1 000 Mb/s")}
        ${gauge("Latence", ping, 150, "ms", ping !== undefined && ping >= 80 ? "var(--red)" : "var(--amber)", pingHint)}
      </div>
    </section>`;
  }

  // ---- Home Assistant ----

  private ha(hass: HomeAssistant): TemplateResult {
    const h = config.system.ha;
    const version = (hass as unknown as { config?: { version?: string } }).config?.version;
    const boot = h.lastBoot ? hass.states[h.lastBoot]?.state : undefined;
    const booted = boot && !isNaN(Date.parse(boot)) ? `démarré ${ago(boot)}` : "";
    const sub = [version, booted].filter(Boolean).join(", ");
    const cpu = num(h.cpu), mem = num(h.memory), disk = num(h.disk);
    const tone = (v: number | undefined, base: string) => (v !== undefined && v >= 90 ? "var(--red)" : base);
    const free = (v?: number) => (v === undefined ? "" : `${f0(100 - v)} % libres`);
    const cpuHint = cpu === undefined ? "" : cpu < 40 ? "Au calme" : cpu < 80 ? "Occupé" : "Très chargé";
    return html`<section class="card ha" aria-label="Home Assistant">
      <div class="ch">
        <span class="ico ha">${icon("haLogo")}</span>
        <span class="grow"><span class="h">Home Assistant</span><span class="st ell">${cap(sub)}</span></span>
        <span class="acts">
          ${this.link("/config/logs", "Journaux", "logs")}
          ${hass.user?.is_admin
            ? html`<button class="btn" type="button" @click=${() => restartHomeAssistant()}>${icon("refresh", 16)}Redémarrer</button>`
            : nothing}
        </span>
      </div>
      <div class="gauges">
        ${gauge("Processeur", cpu, 100, "%", tone(cpu, "var(--teal)"), cpuHint)}
        ${gauge("Mémoire", mem, 100, "%", tone(mem, "var(--blue)"), free(mem))}
        ${gauge("Disque", disk, 100, "%", tone(disk, "var(--violet)"), free(disk))}
      </div>
    </section>`;
  }

  // ---- Updates ----

  private async install(u: HassEntity): Promise<void> {
    const name = updateName(u);
    const ok = await confirmAction(
      {
        title: `Installer ${name} ?`,
        body: `Passer de la version ${u.attributes.installed_version ?? "?"} à ${u.attributes.latest_version ?? "?"}. Home Assistant peut demander un redémarrage ensuite.`,
        confirmLabel: "Installer",
      },
      u.entity_id,
    );
    if (ok) await call("update", "install", {}, { entity_id: u.entity_id });
  }

  private updates(hass: HomeAssistant, list: HassEntity[]): TemplateResult {
    const admin = !!hass.user?.is_admin;
    const core = hass.states["update.home_assistant_core_update"];
    const version = (hass as unknown as { config?: { version?: string } }).config?.version;
    const coreLine = core?.state === "on" ? "" : version ? `Home Assistant ${version} est à jour.` : "";
    return html`<section class="card upds" aria-label="Mises à jour">
      <div class="ch">
        <span class="ico amber">${icon("download")}</span>
        <span class="h grow">Mises à jour</span>
        ${list.length ? html`<a class="st" href="/config/updates" @click=${(e: MouseEvent) => this.go(e, "/config/updates")}>Tout voir</a>` : nothing}
      </div>
      ${list.length
        ? html`<div class="scroll">
            ${list.map((u) => {
              const pic = u.attributes.entity_picture as string | undefined;
              const busy = !!u.attributes.in_progress;
              const installable = ((u.attributes.supported_features as number) ?? 0) & 1;
              return html`<div class="row upd">
                ${pic ? html`<img src=${pic} alt="" width="36" height="36" loading="lazy" decoding="async" />` : html`<span class="ico ha">${icon("haLogo")}</span>`}
                <span class="grow"><span class="nm ell">${updateName(u)}</span>
                  <span class="st num">${u.attributes.installed_version ?? "?"} vers ${u.attributes.latest_version ?? "?"}</span></span>
                ${admin && installable
                  ? html`<button class="btn" type="button" ?disabled=${busy} aria-label="Installer ${updateName(u)}" @click=${() => this.install(u)}>
                      ${busy ? "En cours…" : "Installer"}</button>`
                  : nothing}
              </div>`;
            })}
          </div>`
        : html`<div class="ok-line">${icon("check", 20)}Tout est à jour</div>`}
      ${coreLine ? html`<div class="st">${coreLine}</div>` : nothing}
    </section>`;
  }

  // ---- Wall tablet ----

  private async restartFully(id: string): Promise<void> {
    const ok = await confirmAction({
      title: "Redémarrer Fully Kiosk ?",
      body: "Le navigateur de la tablette se relance ; l'écran reste noir quelques secondes.",
      confirmLabel: "Redémarrer",
    });
    if (ok) {
      await pressButton(id);
      this.flash("fully");
    }
  }

  private tablet(hass: HomeAssistant): TemplateResult | typeof nothing {
    const t = config.system.tablet;
    if (!t || !hass.states[t.screen]) return nothing;
    const screen = hass.states[t.screen];
    const on = screen.state === "on";
    const plugged = t.plugged ? hass.states[t.plugged]?.state === "on" : false;
    const level = num(t.battery);
    const b = t.brightness ? hass.states[t.brightness] : undefined;
    const max = Number(b?.attributes.max) || 255;
    const raw = this.bright ?? Number(b?.state);
    const pct = isNaN(raw) ? undefined : Math.round((raw / max) * 100);
    const batColor = level !== undefined && level < 20 && !plugged ? "var(--red)" : "var(--teal)";
    const sub = `Écran ${on ? "allumé" : "éteint"}, ${plugged ? "branchée" : "sur batterie"}`;
    return html`<section class="card tab" aria-label=${t.name}>
      <div class="ch">
        <span class="ico violet">${icon("monitor")}</span>
        <span class="grow"><span class="h">${t.name}</span><span class="st ell">${sub}</span></span>
        ${level !== undefined
          ? html`<span class="bat" role="img" aria-label="Batterie ${f0(level)} %${plugged ? ", en charge" : ""}">
              <span class="num" aria-hidden="true">${f0(level)} %</span>${batteryIcon(level, batColor, plugged)}</span>`
          : nothing}
      </div>
      ${b
        ? html`<div class="slider">
            ${icon("sun", 20)}
            <input
              type="range"
              min="0"
              max=${max}
              step="1"
              .value=${String(isNaN(raw) ? 0 : raw)}
              style="--pct:${pct ?? 0}%"
              ?disabled=${b.state === "unavailable"}
              aria-label="Luminosité de l'écran"
              aria-valuetext="${pct ?? 0} %"
              @input=${(e: Event) => (this.bright = Number((e.target as HTMLInputElement).value))}
              @change=${async (e: Event) => {
                await setNumber(b.entity_id, Number((e.target as HTMLInputElement).value));
                this.bright = undefined;
              }}
            />
            <span class="num" aria-hidden="true">${pct === undefined ? "—" : `${pct} %`}</span>
          </div>`
        : html`<div class="slider"></div>`}
      <span class="sr" role="status">${this.rang === "reload" ? "Tablette rechargée" : this.rang === "fully" ? "Fully Kiosk redémarre" : ""}</span>
      <div class="tbtns">
        ${t.reload
          ? html`<button class="btn" type="button" @click=${async () => (await pressButton(t.reload!), this.flash("reload"))}>
              ${icon(this.rang === "reload" ? "check" : "refresh", 16)}${this.rang === "reload" ? "Rechargée" : "Recharger"}</button>`
          : nothing}
        <button class="btn" type="button" @click=${() => toggle(t.screen, "l'écran de la tablette")}>
          ${icon(on ? "moon" : "sun", 16)}${on ? "Veille" : "Allumer"}
        </button>
        ${t.restartBrowser
          ? html`<button class="btn" type="button" aria-label="Redémarrer Fully Kiosk" @click=${() => this.restartFully(t.restartBrowser!)}>
              ${icon(this.rang === "fully" ? "check" : "power", 16)}Fully</button>`
          : nothing}
      </div>
    </section>`;
  }

  // ---- Backups and batteries ----

  private backups(hass: HomeAssistant, low: HassEntity[], silent: number, total: number): TemplateResult {
    const b = config.system.backups;
    const state = b ? hass.states[b.state]?.state : undefined;
    const last = b ? hass.states[b.last]?.state : undefined;
    const next = b ? hass.states[b.next]?.state : undefined;
    const valid = (iso?: string) => !!iso && !isNaN(Date.parse(iso));
    const running = state === "create_backup";
    const sub = running ? "Sauvegarde en cours…" : valid(last) ? `Dernière ${ago(last)}, réussie` : "Aucune sauvegarde réussie";
    const admin = !!hass.user?.is_admin;
    return html`<section class="card bak" aria-label="Sauvegarde et batteries">
      ${b
        ? html`<div class="ch">
              <span class="ico teal ${running ? "kh-pulse" : ""}">${icon("backup")}</span>
              <span class="grow"><span class="h">Sauvegarde</span><span class="st" aria-live="polite">${sub}</span></span>
            </div>
            ${valid(next) ? html`<div class="st">Prochaine : ${dayTime.format(new Date(next!))}</div>` : nothing}
            <div class="acts">
              ${admin
                ? html`<button class="btn" type="button" ?disabled=${running} @click=${() => call("backup", "create_automatic")}>
                    ${icon("backup", 16)}Sauvegarder</button>`
                : nothing}
              ${this.link("/config/backup", "Gérer", "external")}
            </div>
            <div class="sep"></div>`
        : nothing}
      <span class="sub">Batteries faibles</span>
      <div class="scroll">
        ${low.length
          ? low.map((s) => {
              const v = Number(s.state);
              const c = v < 15 ? "var(--red)" : "var(--amberInk)";
              const name = batteryName(hass, s);
              return html`<div class="bat-row" role="img" aria-label="${name} : ${f0(v)} %">
                ${batteryIcon(v, c)}<span class="ell" style="flex:1" aria-hidden="true">${name}</span>
                <span class="num" style="color:${c}" aria-hidden="true">${f0(v)} %</span>
              </div>`;
            })
          : html`<div class="ok-line">${icon("check", 20)}Aucune pile faible</div>`}
      </div>
      <div class="st">${total} piles suivies${silent ? `, ${silent} sans nouvelles` : ""}</div>
    </section>`;
  }

  // ---- Appearance ----

  private look(): TemplateResult {
    const choice: ThemeChoice = this.p.theme;
    const modes: [Mode, string][] = [
      ["auto", "Auto"],
      ["light", "Clair"],
      ["dark", "Sombre"],
    ];
    // Picking a dark palette while in light mode switches this screen to dark.
    const pick = (palette: Palette) => saveTheme({ mode: choice.mode === "light" ? "dark" : choice.mode, palette });
    return html`<section class="card look" aria-label="Apparence">
      <div class="ch">
        <span class="ico blue">${icon("palette")}</span>
        <span class="grow"><span class="h">Apparence</span><span class="st">Cet écran</span></span>
      </div>
      <div class="seg" role="group" aria-label="Mode">
        ${modes.map(
          ([m, label]) => html`<button type="button" aria-pressed=${String(choice.mode === m)} @click=${() => saveTheme({ ...choice, mode: m })}>${label}</button>`,
        )}
      </div>
      <div class="pals" role="group" aria-label="Palette sombre">
        ${PALETTES.map((p) => {
          const [bg, surf, accent] = swatch(p.id);
          return html`<button type="button" class="pal ${choice.mode === "light" ? "off" : ""}" aria-pressed=${String(choice.palette === p.id)} @click=${() => pick(p.id)}>
            <span class="sw" style="background:${bg}" aria-hidden="true"><i style="background:${surf}"></i><b style="background:${accent}"></b></span>
            <span class="ell">${p.name}</span>
          </button>`;
        })}
      </div>
    </section>`;
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const all = Object.values(hass.states);
    const updates = all
      .filter((s) => s.entity_id.startsWith("update.") && s.state === "on")
      .sort((a, b) => updateName(a).localeCompare(updateName(b), "fr"));
    const batteries = all.filter((s) => s.entity_id.startsWith("sensor.") && s.attributes.device_class === "battery");
    const known = batteries.filter((s) => s.state !== "" && !isNaN(Number(s.state)));
    const low = known.filter((s) => Number(s.state) < LOW_BATTERY).sort((a, b) => Number(a.state) - Number(b.state));
    const autos = all.filter((s) => s.entity_id.startsWith("automation."));
    const autosOn = autos.filter((s) => s.state === "on").length;
    const issues = updates.length + low.length;

    return html`<div class="grid">
      <header class="top" style="margin:0">
        <h1 class="page-title">Système</h1>
        ${issues ? nothing : html`<span class="status ok"><i></i>Tout fonctionne</span>`}
        ${updates.length ? html`<span class="status warn">${updates.length} mise${updates.length > 1 ? "s" : ""} à jour</span>` : nothing}
        ${low.length ? html`<span class="status warn">${low.length} pile${low.length > 1 ? "s" : ""} faible${low.length > 1 ? "s" : ""}</span>` : nothing}
        <span class="grow"></span>
        <span class="count">${autos.length} automatisations, ${autosOn} actives</span>
        ${this.p.phone ? nothing : this.link("/config/dashboard", "Ouvrir Home Assistant", "external")}
      </header>
      ${this.internet(hass)} ${this.updates(hass, updates)} ${this.ha(hass)} ${this.tablet(hass)}
      ${this.backups(hass, low, batteries.length - known.length, batteries.length)} ${this.look()}
    </div>`;
  }
}
customElements.define("kh3-systeme", Kh3Systeme);
