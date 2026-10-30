import { css, html, nothing, svg } from "lit";
import { isPending, openMoreInfo, runScript, setAutomation, toggle } from "../../actions.ts";
import { config, type Computer } from "../../config.ts";
import { openComputer } from "../../popups/open.ts";
import { entityName } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import { energyHours, f0, f1, f2, minutes, num, since, statistics } from "../data.ts";
import { icon } from "../icons.ts";
import { Page } from "../page.ts";

type View = "day" | "week" | "month";
type Mode = "now" | "today";

interface Day {
  date: Date;
  kwh: number;
}

interface Flow {
  name: string;
  value: number;
  color: string;
  /** Sensor opened on a tap of its label. */
  entity?: string;
  rest?: boolean;
}

const REFRESH_MS = 5 * 60_000;
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const COLORS = ["var(--blue)", "var(--teal)", "var(--violet)", "var(--amber)", "var(--red)"];

/** Signed number with a real minus sign. */
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${digits ? f1(Math.abs(n)) : f0(Math.abs(n))}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const euro = (kwh: number) => `${f2(kwh * (config.home.energy?.pricePerKwh ?? 0))} €`;
/** Power plug switch → the key its sensors share ("switch.smart_plug_kaoru_switch_2" → "smart_plug_kaoru"). */
const plugKey = (id: string) => id.replace(/^switch\./, "").replace(/_switch.*$/, "");

/**
 * Énergie: Linky consumption (day / 7 days / month, the previous period as
 * ghost bars), where the power goes (proportional flows, now or since
 * midnight), the PCs, the scooter's timed plug and the protected plugs.
 */
export class Kh3Energie extends Page {
  static properties = {
    ...Page.properties,
    view: { state: true },
    mode: { state: true },
    picked: { state: true },
    hours: { state: true },
    daily: { state: true },
    split: { state: true },
  };
  declare view: View;
  declare mode: Mode;
  declare picked?: number;
  declare hours?: Awaited<ReturnType<typeof energyHours>>;
  declare daily: Day[];
  /** Energy since midnight per meter (Wh), from hourly means. */
  declare split: Record<string, number>;
  private timer = 0;

  constructor() {
    super();
    this.view = "day";
    this.mode = "now";
    this.daily = [];
    this.split = {};
    new EntitiesController(this, () => {
      const e = config.home.energy;
      const p = config.energyPage;
      const s = p.spare;
      return [
        e?.power, e?.today,
        ...p.plugs,
        ...(p.meters ?? []).map((m) => m.power),
        ...config.home.computers.flatMap((c) => [c.entity, c.busy]),
        s?.plug, s?.duration, s?.remaining, s?.power, s?.autoOff,
      ].filter((x): x is string => !!x);
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => void this.load(), REFRESH_MS);
    window.addEventListener("kh-pending", this.onPending);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    window.removeEventListener("kh-pending", this.onPending);
  }

  private onPending = () => this.requestUpdate();

  /** Linky per hour and per day (back to the start of last month), and today's energy per meter. */
  private async load(): Promise<void> {
    const e = config.home.energy;
    if (!e) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const prevMonth = new Date(midnight.getFullYear(), midnight.getMonth() - 1, 1);
    const twoWeeks = new Date(midnight.getTime() - 13 * 86400000);
    const from = prevMonth < twoWeeks ? prevMonth : twoWeeks;
    const meters = config.energyPage.meters ?? [];
    const [hours, days, ...perMeter] = await Promise.all([
      energyHours(),
      statistics(e.meter, from, "day", ["change"]),
      ...meters.map((m) => statistics(m.power, midnight, "hour", ["mean"])),
    ]);
    if (hours) this.hours = hours;
    if (days) this.daily = days.map((r) => ({ date: new Date(r.start), kwh: Math.max(0, r.change ?? 0) }));
    const split: Record<string, number> = {};
    meters.forEach((m, i) => (split[m.power] = (perMeter[i] ?? []).reduce((s, r) => s + Math.max(0, r.mean ?? 0), 0)));
    this.split = split;
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .wrap {
        display: grid;
        gap: 14px;
        grid-template-columns: minmax(0, 1fr);
      }
      header {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 56px;
        flex-wrap: wrap;
      }
      .now-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 14px;
        border-radius: 999px;
        background: var(--yellowTint);
        color: var(--yellowInk);
        font-weight: 700;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .card-head {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .card-head .grow {
        flex: 1;
      }
      .h {
        font-size: 17px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .kpi {
        border-radius: 16px;
        background: var(--surf2);
        padding: 12px 14px;
        min-width: 0;
        text-align: left;
      }
      .kpi .v {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.15;
        white-space: nowrap;
      }
      .kpi .v small {
        font-size: 13px;
        color: var(--muted);
        font-weight: 600;
      }
      .good {
        color: var(--teal);
      }
      .bad {
        color: var(--red);
      }
      .legend {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 12px;
        color: var(--muted);
        flex-wrap: wrap;
      }
      .legend i {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
        vertical-align: -1px;
      }
      .legend .tip {
        color: var(--ink);
        font-weight: 600;
      }
      .bars {
        flex: 1;
        min-height: 140px;
        display: flex;
        align-items: flex-end;
        gap: 4px;
        touch-action: pan-y;
      }
      .bars > span {
        flex: 1;
        height: 100%;
        position: relative;
        cursor: pointer;
      }
      .bars u,
      .bars b {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 4px 4px 1px 1px;
      }
      .bars u {
        background: var(--surf2);
      }
      .bars b {
        background: var(--yellow);
        transform-origin: bottom;
        animation: grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .bars .dim b {
        opacity: 0.4;
      }
      .bars .cur b {
        background: var(--amber);
      }
      @keyframes grow {
        from {
          transform: scaleY(0);
        }
      }
      .axis {
        display: flex;
        justify-content: space-between;
      }

      /* Where the power goes. */
      .flow {
        flex: 1;
        min-height: 230px;
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr) minmax(170px, 230px);
        gap: 14px;
      }
      .src {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
      }
      .flow svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .labels {
        position: relative;
        min-height: 0;
      }
      .lab {
        position: absolute;
        left: 0;
        right: 0;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        min-height: 36px;
        border-radius: 10px;
      }
      .lab .n {
        display: block;
        font-size: 15px;
        font-weight: 700;
      }
      .lab .w {
        font-size: 20px;
        font-weight: 700;
        white-space: nowrap;
      }
      .lab i {
        width: 4px;
        align-self: stretch;
        border-radius: 2px;
        flex: none;
      }

      aside {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        align-content: start;
      }
      .row {
        min-height: 54px;
        padding: 6px 10px;
      }
      aside .card {
        padding: 14px;
        gap: 8px;
      }
      .row.on {
        background: var(--blueTint);
      }
      .row .main {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        min-height: 44px;
      }
      .row .main .nm {
        font-weight: 700;
      }
      .row .btn {
        background: var(--surf);
        height: 44px;
      }
      .busy {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid var(--blue);
        border-right-color: transparent;
        animation: kh-spin 1s linear infinite;
      }
      .timer {
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 16px;
        background: var(--yellowTint);
        padding: 8px;
      }
      .timer .rb {
        background: var(--surf);
      }
      .timer .big {
        flex: 1;
        text-align: center;
      }
      .timer .big .num {
        display: block;
        font-size: 26px;
        font-weight: 700;
      }
      .switch.on {
        background: var(--yellow);
      }
      .switch.on::after {
        transform: translateX(18px);
        background: #fff;
      }
      .sw-row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        width: 100%;
        text-align: left;
      }
      .sw-row > span:first-child {
        flex: 1;
        min-width: 0;
      }

      /* Wall tablet and desktop: everything on one screen. */
      @container (min-width: 1000px) {
        .wrap {
          grid-template-columns: minmax(0, 1fr) 360px;
          grid-template-rows: 56px 340px minmax(300px, auto);
        }
        header {
          grid-column: 1 / 3;
          flex-wrap: nowrap;
        }
        .conso {
          grid-column: 1;
          grid-row: 2;
        }
        .flows {
          grid-column: 1;
          grid-row: 3;
        }
        aside {
          grid-column: 2;
          grid-row: 2 / 4;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: auto;
        }
        aside .plugs {
          flex: 1;
        }
        @media (min-height: 720px) {
          .wrap {
            height: calc(100vh - 32px);
            height: calc(100dvh - 32px);
            grid-template-rows: 56px 340px minmax(0, 1fr);
          }
          .flow {
            min-height: 0;
          }
        }
      }
      /* Phone: one column, the flows' source above the diagram. */
      @container (max-width: 599px) {
        .kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .bars {
          min-height: 150px;
          gap: 2px;
        }
        .flow {
          grid-template-columns: minmax(0, 1fr) 150px;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 10px;
          height: 340px;
        }
        .src {
          grid-column: 1 / 3;
          flex-direction: row;
          align-items: baseline;
          gap: 8px;
        }
        .lab .n {
          font-size: 13px;
        }
        .lab .w {
          font-size: 16px;
        }
        .page-title {
          font-size: 26px;
        }
        .seg button {
          height: 44px;
        }
      }
    `,
  ];

  // ——— Consumption ———

  private kpis() {
    const e = config.home.energy!;
    const kwh = num(e.today);
    const hour = new Date().getHours();
    const today = this.hours?.today ?? [];
    const yday = this.hours?.yesterday ?? [];
    const soFar = today.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const ySoFar = yday.slice(0, hour + 1).reduce((a, b) => a + b, 0);
    const delta = ySoFar > 0 && soFar > 0 ? ((soFar - ySoFar) / ySoFar) * 100 : undefined;
    const last = Number(store.get(e.today)?.attributes.last_period);
    const yTotal = last > 0 ? last : yday.reduce((a, b) => a + b, 0);
    const has = today.some((v) => v > 0);
    const peak = today.reduce((best, v, i) => (v > today[best] ? i : best), 0);
    const now = new Date();
    const month = this.daily.filter((d) => d.date.getMonth() === now.getMonth() && d.date.getFullYear() === now.getFullYear()).reduce((s, d) => s + d.kwh, 0);
    return html`<div class="kpis">
      <button class="kpi" @click=${() => openMoreInfo(this, e.today)}>
        <span class="st" style="display:block">Aujourd'hui</span>
        <span class="v num" style="display:block">${kwh !== undefined ? f2(kwh) : "—"} <small>kWh</small></span>
        <span class="st" style="display:block">${kwh !== undefined ? euro(kwh) : ""}</span>
      </button>
      <div class="kpi">
        <div class="st">Vs hier même heure</div>
        <div class="v num ${delta === undefined ? "" : delta <= 0 ? "good" : "bad"}">${delta !== undefined ? `${signed(Math.round(delta))} %` : "—"}</div>
        <div class="st">${yTotal > 0 ? `${f2(yTotal)} kWh hier` : ""}</div>
      </div>
      <div class="kpi">
        <div class="st">Pic du jour</div>
        <div class="v num">${has ? `${peak} h` : "—"}</div>
        <div class="st">${has ? `${f2(today[peak])} kWh` : ""}</div>
      </div>
      <div class="kpi">
        <div class="st">Ce mois</div>
        <div class="v num">${month > 0 ? f0(month) : "—"} <small>kWh</small></div>
        <div class="st">${month > 0 ? euro(month) : ""}</div>
      </div>
    </div>`;
  }

  /** Bars of the chosen period: value, ghost (the period before), label. */
  private bars(): { v: number; ghost: number; label: string; tip: string; cur?: boolean; future?: boolean }[] {
    const now = new Date();
    const byDay = new Map(this.daily.map((d) => [d.date.toDateString(), d.kwh]));
    const kwhOn = (d: Date) => byDay.get(d.toDateString()) ?? 0;
    if (this.view === "day") {
      const today = this.hours?.today ?? [];
      const yday = this.hours?.yesterday ?? [];
      const hour = now.getHours();
      return Array.from({ length: 24 }, (_, i) => ({
        v: today[i] ?? 0, ghost: yday[i] ?? 0, label: `${i} h`, cur: i === hour, future: i > hour,
        tip: `${i} h : ${f2(today[i] ?? 0)} kWh (hier ${f2(yday[i] ?? 0)})`,
      }));
    }
    if (this.view === "week") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
        const before = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
        const label = i === 6 ? "Auj." : weekday.format(d).replace(".", "");
        return { v: kwhOn(d), ghost: kwhOn(before), label, cur: i === 6, tip: `${label} ${d.getDate()} : ${f2(kwhOn(d))} kWh (semaine d'avant ${f2(kwhOn(before))})` };
      });
    }
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
      const before = new Date(now.getFullYear(), now.getMonth() - 1, i + 1);
      const ghost = before.getMonth() === (now.getMonth() + 11) % 12 ? kwhOn(before) : 0;
      return { v: kwhOn(d), ghost, label: String(i + 1), cur: sameDay(d, now), future: d > now, tip: `${dayMonth.format(d)} : ${f2(kwhOn(d))} kWh (mois d'avant ${f2(ghost)})` };
    });
  }

  private conso() {
    const bars = this.bars();
    const max = Math.max(0.05, ...bars.map((b) => Math.max(b.v, b.ghost)));
    const picked = this.picked !== undefined ? bars[this.picked] : undefined;
    const ghostName = this.view === "day" ? "Hier" : this.view === "week" ? "Semaine d'avant" : "Mois d'avant";
    const axis =
      this.view === "day"
        ? ["0 h", "6 h", "12 h", "18 h", "23 h"]
        : this.view === "week"
          ? bars.map((b) => b.label)
          : ["1", "8", "15", "22", String(bars.length)];
    const total = bars.reduce((s, b) => s + b.v, 0);
    const set = (v: View) => () => ((this.view = v), (this.picked = undefined));
    return html`<section class="card conso" aria-label="Consommation">
      ${this.kpis()}
      <div class="legend">
        <span><i style="background:var(--yellow)"></i>${this.view === "day" ? "Aujourd'hui" : this.view === "week" ? "7 derniers jours" : "Ce mois"}</span>
        <span><i style="background:var(--surf2)"></i>${ghostName}</span>
        ${picked ? html`<span class="tip num" aria-live="polite">${picked.tip}, ${euro(picked.v)}</span>` : nothing}
        <span style="flex:1"></span>
        <div class="seg" role="group" aria-label="Période du graphique">
          <button aria-pressed=${this.view === "day" ? "true" : "false"} @click=${set("day")}>Jour</button>
          <button aria-pressed=${this.view === "week" ? "true" : "false"} @click=${set("week")}>7 jours</button>
          <button aria-pressed=${this.view === "month" ? "true" : "false"} @click=${set("month")}>Mois</button>
        </div>
      </div>
      ${!this.hours && !this.daily.length
        ? html`<p class="empty" style="flex:1">Pas encore de statistiques du compteur.</p>`
        : html`<div class="bars" role="img" aria-label="Consommation, ${f1(total)} kWh sur la période. Touche une barre pour sa valeur.">
            ${bars.map((b, i) => html`<span class="${b.cur ? "cur" : ""} ${picked && picked !== b ? "dim" : ""}" title=${b.tip}
              @click=${() => (this.picked = this.picked === i ? undefined : i)}>
              <u style="height:${(b.ghost / max) * 100}%"></u>
              ${b.future ? nothing : html`<b style="height:${(b.v / max) * 100}%;animation-delay:${i * 12}ms"></b>`}
            </span>`)}
          </div>
          <div class="axis st num" aria-hidden="true">${axis.map((a) => html`<span>${a}</span>`)}</div>`}
    </section>`;
  }

  // ——— Where the power goes ———

  private flowsData(): { total: number; flows: Flow[]; unit: (v: number) => string } {
    const e = config.home.energy;
    const meters = config.energyPage.meters ?? [];
    const now = this.mode === "now";
    const measured: Flow[] = meters
      .map((m, i) => ({ name: m.name, value: now ? (num(m.power) ?? 0) : (this.split[m.power] ?? 0), color: COLORS[i % COLORS.length], entity: m.power }))
      .filter((f) => f.value > 0);
    const sum = measured.reduce((s, f) => s + f.value, 0);
    // Since midnight: the Linky's completed hours, the same hours as the meters' means.
    const linky = now ? num(e?.power) : (this.hours?.today.reduce((a, b) => a + b, 0) ?? 0) * 1000 || (num(e?.today) ?? 0) * 1000;
    const total = Math.max(linky ?? 0, sum);
    const flows = [...measured];
    if (total - sum > total * 0.01) flows.push({ name: "Reste de la maison", value: total - sum, color: "var(--muted)", rest: true, entity: now ? e?.power : e?.today });
    flows.sort((a, b) => b.value - a.value);
    // At most six lines: the smallest ones together.
    if (flows.length > 6) {
      const tail = flows.splice(5);
      flows.push({ name: `${tail.length} autres`, value: tail.reduce((s, f) => s + f.value, 0), color: "var(--muted)" });
    }
    const unit = now ? (v: number) => `${f0(v)} W` : (v: number) => `${v >= 10000 ? f1(v / 1000) : f2(v / 1000)} kWh`;
    return { total, flows, unit };
  }

  private sankey() {
    const { total, flows, unit } = this.flowsData();
    const now = this.mode === "now";
    if (total <= 0 || !flows.length) return html`<p class="empty" style="flex:1">${now ? "Pas de mesure de puissance pour le moment." : "Pas encore de mesure depuis minuit."}</p>`;
    // Ribbons as thick as their share; every destination at least MIN high for its label.
    const W = 464, H = 236, pad = 6, gap = 14, MIN = this.p?.phone ? 46 : 30, x0 = 12, x1 = W - 12, mid = (x0 + x1) / 2;
    const room = H - 2 * pad - gap * (flows.length - 1);
    let scale = room / total;
    for (let k = 0; k < 4; k++) {
      const small = flows.filter((f) => f.value * scale < MIN);
      const big = flows.filter((f) => f.value * scale >= MIN).reduce((s, f) => s + f.value, 0);
      if (!big) break;
      scale = Math.min(room / total, (room - small.length * MIN) / big);
    }
    let y = pad;
    const nodes = flows.map((f) => {
      const h = Math.max(3, f.value * scale);
      const slot = Math.max(MIN, h);
      const node = { f, top: y + (slot - h) / 2, h, center: y + slot / 2 };
      y += slot + gap;
      return node;
    });
    const used = y - gap + pad;
    const srcH = nodes.reduce((s, n) => s + n.h, 0);
    let sy = (used - srcH) / 2;
    const ribbons = nodes.map((n, i) => {
      const a = sy, b = sy + n.h, c = n.top, d = n.top + n.h;
      sy = b;
      return svg`<defs><linearGradient id="kh3f${i}" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style="stop-color:var(--yellow);stop-opacity:.55"></stop>
          <stop offset="1" style="stop-color:${n.f.color};stop-opacity:${n.f.rest ? 0.35 : 0.7}"></stop></linearGradient></defs>
        <path d="M${x0} ${a} C${mid} ${a} ${mid} ${c} ${x1} ${c} L${x1} ${d} C${mid} ${d} ${mid} ${b} ${x0} ${b} Z" fill="url(#kh3f${i})"></path>
        <rect x=${x1} y=${c} width="12" height=${n.h} rx="3" style="fill:${n.f.color}"></rect>`;
    });
    const summary = flows.map((f) => `${f.name} ${unit(f.value)}`).join(", ");
    return html`<div class="flow">
      <div class="src">
        <span class="st" style="font-weight:600">Linky</span>
        <span class="num" style="font-size:24px;font-weight:700;white-space:nowrap">${unit(total)}</span>
        <span class="st">${now ? "maintenant" : "depuis minuit"}</span>
      </div>
      <svg viewBox="0 0 ${W} ${used}" preserveAspectRatio="none" role="img" aria-label="Répartition : ${summary}">
        <rect x="0" y=${(used - srcH) / 2} width="12" height=${srcH} rx="4" style="fill:var(--yellow)"></rect>
        ${ribbons}
      </svg>
      <div class="labels" role="list" aria-label="Répartition">
        ${nodes.map((n) => {
          const share = Math.round((n.f.value / total) * 100);
          const body = html`<i style="background:${n.f.color}"></i>
            <span style="flex:1;min-width:0"><span class="n ell">${n.f.name}</span><span class="st num" style="display:block">${share} % du total</span></span>
            <span class="w num">${unit(n.f.value)}</span>`;
          return n.f.entity
            ? html`<button role="listitem" class="lab" style="top:${(n.center / used) * 100}%" @click=${() => openMoreInfo(this, n.f.entity!)}>${body}</button>`
            : html`<div role="listitem" class="lab" style="top:${(n.center / used) * 100}%">${body}</div>`;
        })}
      </div>
    </div>`;
  }

  private flows() {
    const set = (m: Mode) => () => (this.mode = m);
    return html`<section class="card flows" aria-label="Où part l'électricité" style="gap:6px">
      <div class="card-head">
        <h2 class="h">Où part l'électricité</h2>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="Période de la répartition">
          <button aria-pressed=${this.mode === "now" ? "true" : "false"} @click=${set("now")}>Maintenant</button>
          <button aria-pressed=${this.mode === "today" ? "true" : "false"} @click=${set("today")}>Aujourd'hui</button>
        </div>
      </div>
      ${this.sankey()}
      <p class="st">Ce que les prises ne mesurent pas (dont le PC de Papa) est compté dans « Reste de la maison ».</p>
    </section>`;
  }

  // ——— Right column ———

  private computer(c: Computer) {
    const s = store.get(c.entity);
    const on = s?.state === "on";
    const gone = !s || s.state === "unavailable";
    const waiting = isPending(c.entity) || store.get(c.busy ?? "")?.state === "on";
    const changed = s ? new Date(s.last_changed) : undefined;
    const sinceText = changed ? (sameDay(changed, new Date()) ? timeFmt.format(changed) : since(s!.last_changed)) : "";
    const status = gone ? "Hors ligne" : waiting ? (on ? "S'arrête…" : "Démarre…") : on ? `Allumé depuis ${sinceText}` : "Éteint";
    return html`<div class="row ${on ? "on" : ""}">
      <button class="main" aria-label="${c.name}, ${status}. Détails" @click=${() => openComputer(c)}>
        <span class="ico" style="${on ? "background:var(--surf);color:var(--blue)" : ""}">${icon("monitor")}</span>
        <span style="min-width:0"><span class="nm ell">${c.name}</span><span class="st ell" style="display:block">${status}</span></span>
      </button>
      ${waiting
        ? html`<span class="busy" role="status" aria-label="En cours"></span>`
        : gone
          ? nothing
          : html`<button class="btn" @click=${() => toggle(c.entity, c.name)}>${on ? "Éteindre" : "Démarrer"}</button>`}
    </div>`;
  }

  private spare() {
    const p = config.energyPage.spare;
    if (!p) return nothing;
    const plug = store.get(p.plug);
    const on = plug?.state === "on";
    const gone = !plug || plug.state === "unavailable";
    const watts = num(p.power);
    const duration = num(p.duration);
    const auto = store.get(p.autoOff)?.state === "on";
    // The remaining time sensor is text ("Éteint", "1 h 10"…) or minutes.
    const raw = store.get(p.remaining)?.state?.replace(/"/g, "");
    const left = raw && !isNaN(Number(raw)) ? minutes(Number(raw)) : raw && !["unknown", "unavailable", "Éteint"].includes(raw) ? raw : undefined;
    const status = gone ? "Hors ligne" : on ? (watts !== undefined ? `En charge, ${f0(watts)} W` : "En charge") : "Éteinte";
    return html`<section class="card" aria-label=${p.name}>
      <button class="sw-row" role="switch" aria-checked=${on ? "true" : "false"} aria-disabled=${gone ? "true" : "false"} @click=${() => toggle(p.plug, p.name)}>
        <span style="display:flex;align-items:center;gap:10px">
          <span class="ico ${on ? "kh-pulse" : ""}" style="${on ? "background:var(--yellowTint);color:var(--yellowInk)" : ""}">${icon("scooter")}</span>
          <span style="min-width:0"><span class="h ell" style="display:block">${p.name}</span><span class="st">${status}</span></span>
        </span>
        <span class="switch ${on ? "on" : ""}" aria-hidden="true"></span>
      </button>
      <div class="timer">
        <button class="rb" aria-label="Moins de temps" @click=${() => runScript(p.decrement)}>${icon("minus")}</button>
        <div class="big" aria-live="polite">
          <span class="num">${minutes(duration)}</span>
          <span class="st">${on && left ? `coupure dans ${left}` : "de charge avant la coupure"}</span>
        </div>
        <button class="rb" aria-label="Plus de temps" @click=${() => runScript(p.increment)}>${icon("plus")}</button>
      </div>
      <button class="sw-row" role="switch" aria-checked=${auto ? "true" : "false"} @click=${() => setAutomation(p.autoOff, !auto)}>
        <span><span class="nm">Arrêt automatique</span><span class="st" style="display:block">Coupe la prise au bout de la durée</span></span>
        <span class="switch ${auto ? "on" : ""}" aria-hidden="true"></span>
      </button>
    </section>`;
  }

  private plugs() {
    const hass = store.hass!;
    const plugs = config.energyPage.plugs;
    if (!plugs.length) return nothing;
    const meters = config.energyPage.meters ?? [];
    return html`<section class="card plugs" aria-label="Prises">
      <h2 class="h">Prises</h2>
      <div class="rows">
        ${plugs.map((id) => {
          const s = hass.states[id];
          const on = s?.state === "on";
          const gone = !s || s.state === "unavailable";
          const name = entityName(hass, id, config);
          const meter = meters.find((m) => m.power.replace(/^sensor\./, "").startsWith(plugKey(id)));
          const w = num(meter?.power);
          const status = gone ? "Hors ligne" : on ? (w !== undefined ? `Allumée, ${f0(w)} W` : "Allumée") : "Éteinte";
          return html`<button class="row" role="switch" aria-checked=${on ? "true" : "false"} aria-disabled=${gone ? "true" : "false"}
            aria-label="${name}, ${status}" @click=${() => toggle(id, name)}>
            <span style="flex:1;min-width:0"><span class="nm ell">${name}</span><span class="st" style="display:block">${status}</span></span>
            <span class="switch ${on ? "on" : ""}" aria-hidden="true"></span>
          </button>`;
        })}
      </div>
      <p class="st">Elles alimentent le homelab : allumer ou éteindre une prise demande une confirmation.</p>
    </section>`;
  }

  render() {
    if (!store.hass) return nothing;
    const e = config.home.energy;
    const watts = num(e?.power);
    return html`<div class="wrap">
      <header>
        <h1 class="page-title">Énergie</h1>
        ${e
          ? html`<span class="now-pill">${icon("boltFill", 18)}<span class="num">${f0(watts)} W</span> maintenant</span>`
          : nothing}
      </header>
      ${e ? this.conso() : nothing}
      ${this.flows()}
      <aside>
        ${config.home.computers.length
          ? html`<section class="card" aria-label="Ordinateurs"><h2 class="h">Ordinateurs</h2>
              <div class="rows">${config.home.computers.map((c) => this.computer(c))}</div></section>`
          : nothing}
        ${this.spare()}
        ${this.plugs()}
      </aside>
    </div>`;
  }
}
customElements.define("kh3-energie", Kh3Energie);
