import { css, html, nothing, svg } from "lit";
import { setFanOscillation, setFanSpeed, setInputNumber, toggle } from "../../actions.ts";
import { config } from "../../config.ts";
import type { Room } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import { f0, f1, history, linePath, minutes, num, resample, smoothSeries, type Point } from "../data.ts";
import { icon, liveIcon } from "../icons.ts";
import { Page } from "../page.ts";

/** One colour per room sensor, the same everywhere it is drawn. */
const ROOM_COLORS = ["#FF8A5B", "#F5B83D", "#6FA8FF", "#B48CFF", "#3FD0C9", "#FF7FB0", "#9BE15D", "#7FD1FF"];

type Comfort = { label: string; tone: "ok" | "cold" | "warm" | "wet" | "dry" };

function comfort(t?: number, h?: number): Comfort | undefined {
  if (t === undefined) return undefined;
  if (h !== undefined && h >= 65) return { label: "Humide", tone: "wet" };
  if (t < 18) return { label: "Frais", tone: "cold" };
  if (t < 19.5) return { label: "Un peu frais", tone: "cold" };
  if (t > 25) return { label: "Chaud", tone: "warm" };
  if (h !== undefined && h < 35) return { label: "Sec", tone: "dry" };
  return { label: "Confortable", tone: "ok" };
}

const TONE: Record<Comfort["tone"], string> = {
  ok: "background:var(--tealTint);color:var(--teal)",
  cold: "background:var(--blueTint);color:var(--blue)",
  warm: "background:var(--amberTint);color:var(--amberInk)",
  wet: "background:var(--blueTint);color:var(--blue)",
  dry: "background:var(--amberTint);color:var(--amberInk)",
};

/**
 * Climat: every room with a thermometer, its own colour, temperature and
 * humidity over 24 h or 7 days; the fans with their off-timer; what to watch.
 */
export class Kh3Climat extends Page {
  static properties = { ...Page.properties, hours: { state: true }, series: { state: true } };
  declare hours: 24 | 168;
  declare series: Record<string, Point[]>;
  private timer = 0;

  constructor() {
    super();
    this.hours = 24;
    this.series = {};
    new EntitiesController(this, () => [
      ...this.climateRooms().flatMap((r) => [r.temperature!, r.humidity].filter((x): x is string => !!x)),
      ...config.energyPage.fans,
      ...Object.values(config.home.fanTimers ?? {}),
      ...(this.p?.model.rooms.flatMap((r) => r.openings) ?? []),
      config.home.outdoorTemperature ?? "",
    ]);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
    this.timer = window.setInterval(() => this.load(), 5 * 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private climateRooms(): Room[] {
    return (this.p?.rooms ?? []).filter((r) => r.temperature);
  }

  private async load(): Promise<void> {
    const ids = [...this.climateRooms().flatMap((r) => [r.temperature!, r.humidity].filter((x): x is string => !!x)), config.home.outdoorTemperature].filter((x): x is string => !!x);
    const res = await history(ids, this.hours);
    if (res) this.series = res;
  }

  private setHours(h: 24 | 168): void {
    if (h === this.hours) return;
    this.hours = h;
    this.series = {};
    this.load();
  }

  static styles = [
    ...Page.styles,
    css`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 14px;
        align-items: start;
      }
      .main {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
      }
      .house-head {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .house-head .legend {
        margin-left: auto;
      }
      .legend i {
        display: block;
        width: 14px;
        height: 3px;
        border-radius: 2px;
      }
      .house-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 170px;
        gap: 16px;
        align-items: stretch;
      }
      .house-chart {
        position: relative;
        padding-left: 30px;
        display: flex;
        flex-direction: column;
      }
      .house-chart svg {
        width: 100%;
        height: 150px;
      }
      .yaxis {
        position: absolute;
        left: 0;
        top: 0;
        height: 150px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-size: 11px;
      }
      .house-axis {
        margin-top: 4px;
      }
      .house-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .house-stats div {
        border-radius: 14px;
        background: var(--surf2);
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .house-stats b {
        font-size: 20px;
        font-weight: 700;
      }
      @container (max-width: 640px) {
        .house-body {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .rooms {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .room {
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-align: left;
        min-height: 196px;
      }
      .room .head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 99px;
        flex: none;
      }
      .tag {
        margin-left: auto;
        height: 24px;
        padding: 0 9px;
        border-radius: 99px;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
      }
      .vals {
        display: flex;
        align-items: baseline;
        gap: 14px;
      }
      .vals .t {
        font-size: 40px;
        font-weight: 700;
        line-height: 1;
      }
      .vals .hum {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 20px;
        font-weight: 700;
      }
      .chart {
        position: relative;
        flex: 1;
        min-height: 72px;
        display: block;
        margin-right: 6px;
      }
      svg.curve {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      /* The latest reading: a dot with a soft ring at the end of the curve. */
      .now-dot {
        position: absolute;
        right: -5px;
        width: 10px;
        height: 10px;
        margin-top: -5px;
        border-radius: 99px;
        background: var(--c);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 25%, transparent);
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        opacity: 0.8;
        margin-top: -4px;
      }
      .legend {
        display: flex;
        gap: 14px;
        font-size: 12px;
        color: var(--muted);
      }
      .legend span {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .side {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fan {
        border-radius: 18px;
        background: var(--surf2);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fan.on {
        background: var(--tealTint);
      }
      .fan .switch[aria-checked="true"] {
        background: var(--teal);
      }
      .speeds {
        display: flex;
        gap: 6px;
      }
      .speeds button {
        flex: 1;
        height: 40px;
        border-radius: 12px;
        background: var(--surf);
        font-weight: 700;
        font-size: 13px;
      }
      .speeds button[aria-pressed="true"] {
        background: var(--teal);
        color: #06221e;
      }
      .tip {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        font-size: 14px;
      }
      .tip i {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        margin-top: 6px;
        flex: none;
      }
      @container (max-width: 1000px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        .rooms {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container (max-width: 560px) {
        .rooms {
          grid-template-columns: minmax(0, 1fr);
        }
        .room {
          min-height: 0;
        }
      }
      :host {
        container-type: inline-size;
      }
    `,
  ];

  /** Live value, else the last one recorded (a sensor asleep shows its last reading). */
  private value(id?: string): number | undefined {
    return num(id) ?? (id ? this.series[id]?.at(-1)?.v : undefined);
  }

  private roomCard(r: Room, color: string) {
    const t = this.value(r.temperature), h = this.value(r.humidity);
    const c = comfort(t, h);
    const now = Date.now(), from = now - this.hours * 3600_000;
    const buckets = this.hours === 24 ? 48 : 84;
    const temps = smoothSeries(resample(this.series[r.temperature!] ?? [], from, now, buckets), this.hours === 24 ? 1 : 2);
    const hums = r.humidity ? smoothSeries(resample(this.series[r.humidity] ?? [], from, now, buckets), this.hours === 24 ? 1 : 2) : [];
    const tv = temps.filter((v): v is number => v !== undefined);
    const hv = hums.filter((v): v is number => v !== undefined);
    const W = 200, H = 60;
    const scale = (vals: (number | undefined)[], lo: number, hi: number) =>
      vals
        .map((v, i) => (v === undefined ? undefined : { x: (i / (buckets - 1)) * W, y: H - 4 - ((v - lo) / Math.max(hi - lo, 1)) * (H - 10) }))
        .filter((p): p is { x: number; y: number } => !!p);
    const tlo = Math.min(...tv), thi = Math.max(...tv);
    const tPts = tv.length ? scale(temps, tlo - 0.5, thi + 0.5) : [];
    const hPts = hv.length ? scale(hums, Math.min(...hv) - 2, Math.max(...hv) + 2) : [];
    const line = linePath(tPts);
    return html`<a class="card room" href="${this.p.prefix}/maison/${r.id}" aria-label="${r.name} : ${t !== undefined ? `${f1(t)} degrés` : "pas de mesure"}${h !== undefined ? `, ${f0(h)} % d'humidité` : ""}">
      <span class="head"><span class="dot" style="background:${color}"></span><span class="nm ell">${r.name}</span>
        ${c ? html`<span class="tag" style=${TONE[c.tone]}>${c.label}</span>` : nothing}</span>
      <span class="vals"><span class="t num">${t !== undefined ? `${f1(t)}°` : "—"}</span>
        ${h !== undefined ? html`<span class="hum num">${icon("drop", 16)}${f0(h)} %</span>` : nothing}</span>
      <span class="chart">
        <svg class="curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution sur ${this.hours === 24 ? "24 heures" : "7 jours"}">
          <path d="M0 ${H / 2} H${W}" stroke="var(--muted)" stroke-opacity="0.18" stroke-dasharray="2 4" vector-effect="non-scaling-stroke" fill="none"></path>
          ${tPts.length ? svgPaths(line, `${line} L${tPts.at(-1)!.x} ${H} L${tPts[0].x} ${H} Z`, linePath(hPts), color, r.id) : nothing}
        </svg>
        ${tPts.length ? html`<span class="now-dot" style="top:${(tPts.at(-1)!.y / H) * 100}%;--c:${color}" aria-hidden="true"></span>` : nothing}
      </span>
      <span class="st num axis"><span>${this.hours === 24 ? "−24 h" : "−7 j"}</span><span>maint.</span></span>
      <span class="st num" style="display:flex;justify-content:space-between">
        <span>${tv.length ? `${f1(tlo)}° à ${f1(thi)}°` : "Pas d'historique"}</span>
        <span>${hv.length ? `humidité ${f0(Math.min(...hv))} à ${f0(Math.max(...hv))} %` : ""}</span>
      </span>
    </a>`;
  }

  private fans() {
    const fans = config.energyPage.fans;
    if (!fans.length) return nothing;
    return html`<section class="card" aria-label="Ventilateurs">
      <h2 class="h">Ventilateurs</h2>
      <div class="rows">
        ${fans.map((id) => {
          const s = store.get(id);
          const name = (s?.attributes.friendly_name as string)?.replace(/ventilateur/i, "").trim() || "Ventilateur";
          const on = s?.state === "on";
          const pct = Number(s?.attributes.percentage ?? 0);
          const step = Number(s?.attributes.percentage_step ?? 25);
          const levels = Array.from({ length: Math.max(1, Math.round(100 / step)) }, (_, i) => Math.round((i + 1) * step));
          const timer = config.home.fanTimers?.[id];
          const t = num(timer);
          return html`<div class="fan ${on ? "on" : ""}">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="ico" style=${on ? "background:var(--teal);color:#06221e" : ""}>${liveIcon("fan", on)}</span>
              <span style="flex:1;min-width:0"><span class="nm ell">${name || "Ventilateur"}</span><span class="st">${on ? `En marche, ${pct} %` : s?.state === "unavailable" ? "Hors ligne" : "Arrêté"}</span></span>
              <button class="switch" role="switch" aria-checked=${on ? "true" : "false"} aria-label=${name === "Ventilateur" ? name : `Ventilateur ${name}`} @click=${() => toggle(id, "le ventilateur")}></button>
            </div>
            ${on
              ? html`<div class="speeds" role="group" aria-label="Vitesse">
                  ${levels.map((l) => html`<button aria-pressed=${Math.abs(l - pct) < step / 2 ? "true" : "false"} @click=${() => setFanSpeed(id, l)}>${l} %</button>`)}
                </div>
                ${s?.attributes.oscillating !== undefined
                  ? html`<div style="display:flex;align-items:center;justify-content:space-between"><span class="st" style="font-size:13px">Oscillation</span>
                      <button class="switch" role="switch" aria-checked=${s.attributes.oscillating ? "true" : "false"} aria-label="Oscillation"
                        @click=${() => setFanOscillation(id, !s.attributes.oscillating)}></button></div>`
                  : nothing}
                ${timer
                  ? html`<div style="display:flex;align-items:center;gap:10px">
                      <button class="rb" style="background:var(--surf)" aria-label="Moins de temps" @click=${() => setInputNumber(timer, Math.max(0, (t ?? 0) - 15))}>${icon("minus", 18)}</button>
                      <span style="flex:1;text-align:center" aria-live="polite"><span class="num" style="display:block;font-size:24px;font-weight:700">${t ? minutes(t) : "Sans arrêt"}</span><span class="st">${t ? "avant l'arrêt" : "minuterie"}</span></span>
                      <button class="rb" style="background:var(--surf)" aria-label="Plus de temps" @click=${() => setInputNumber(timer, (t ?? 0) + 15)}>${icon("plus", 18)}</button>
                    </div>`
                  : nothing}`
              : nothing}
          </div>`;
        })}
      </div>
    </section>`;
  }

  private tips() {
    const tips: { text: string; tone: string }[] = [];
    const rooms = this.p.rooms;
    for (const r of rooms) {
      const h = num(r.humidity), t = num(r.temperature);
      if (h !== undefined && h >= 65) tips.push({ text: `${r.name} à ${f0(h)} % d'humidité : aérer 10 min.`, tone: "var(--blue)" });
      if (t !== undefined && t < 18) tips.push({ text: `${r.name} à ${f1(t)}° : un peu froid.`, tone: "var(--blue)" });
      if (t !== undefined && t > 26) tips.push({ text: `${r.name} à ${f1(t)}° : il fait chaud.`, tone: "var(--amber)" });
    }
    const open = rooms.flatMap((r) => r.openings.filter((id) => store.get(id)?.state === "on").map(() => r.name));
    const out = num(config.home.outdoorTemperature);
    if (open.length) tips.push({ text: `Fenêtre ouverte : ${[...new Set(open)].join(", ")}${out !== undefined ? ` (${f1(out)}° dehors)` : ""}.`, tone: "var(--red)" });
    else tips.push({ text: "Toutes les fenêtres sont fermées.", tone: "var(--teal)" });
    const missing = rooms.filter((r) => !r.temperature).map((r) => r.name);
    if (missing.length) tips.push({ text: `Sans thermomètre : ${missing.join(", ")}.`, tone: "var(--muted)" });
    return html`<section class="card" aria-label="À surveiller">
      <h2 class="h">À surveiller</h2>
      <div class="rows">${tips.map((t) => html`<p class="tip"><i style="background:${t.tone}"></i><span>${t.text}</span></p>`)}</div>
    </section>`;
  }

  /**
   * The whole flat against the outside: average indoor temperature, outdoor
   * temperature (same scale) and average indoor humidity (its own scale).
   */
  private house() {
    const rooms = this.climateRooms();
    const now = Date.now(), from = now - this.hours * 3600_000;
    const n = this.hours === 24 ? 72 : 112;
    const avg = (ids: string[]) => {
      const cols = ids.map((id) => smoothSeries(resample(this.series[id] ?? [], from, now, n), 1));
      return Array.from({ length: n }, (_, i) => {
        const v = cols.map((c) => c[i]).filter((x): x is number => x !== undefined);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
      });
    };
    const inside = avg(rooms.map((r) => r.temperature!));
    const hum = avg(rooms.map((r) => r.humidity).filter((x): x is string => !!x));
    const out = config.home.outdoorTemperature ? smoothSeries(resample(this.series[config.home.outdoorTemperature] ?? [], from, now, n), 1) : [];
    const temps = [...inside, ...out].filter((v): v is number => v !== undefined);
    const hv = hum.filter((v): v is number => v !== undefined);
    const W = 600, H = 150;
    const lo = Math.floor(Math.min(...temps) - 1), hi = Math.ceil(Math.max(...temps) + 1);
    const y = (v: number) => H - 6 - ((v - lo) / Math.max(hi - lo, 1)) * (H - 14);
    const hlo = Math.min(...hv) - 3, hhi = Math.max(...hv) + 3;
    const yh = (v: number) => H - 6 - ((v - hlo) / Math.max(hhi - hlo, 1)) * (H - 14);
    const path = (vals: (number | undefined)[], f: (v: number) => number) =>
      linePath(vals.map((v, i) => (v === undefined ? undefined : { x: (i / (n - 1)) * W, y: f(v) })).filter((p): p is { x: number; y: number } => !!p));
    const pin = path(inside, y), pout = path(out, y), phum = hv.length ? path(hum, yh) : "";
    const lastIn = inside.filter((v) => v !== undefined).at(-1), lastOut = out.filter((v) => v !== undefined).at(-1);
    const outs = out.filter((v): v is number => v !== undefined);
    const ticks = [hi, (hi + lo) / 2, lo];
    return html`<section class="card house" aria-label="Maison et dehors">
      <div class="house-head">
        <h2 class="h">Maison et dehors</h2>
        <span class="legend"><span><i style="background:var(--teal)"></i>Intérieur</span><span><i style="background:var(--blue)"></i>Dehors</span>
          <span><i style="border-top:2px dashed var(--muted);height:0"></i>Humidité</span></span>
      </div>
      <div class="house-body">
        <div class="house-chart">
          <span class="yaxis num st">${ticks.map((t) => html`<span>${f0(t)}°</span>`)}</span>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Températures intérieure et extérieure et humidité sur ${this.hours === 24 ? "24 heures" : "7 jours"}">
            <defs><linearGradient id="g-house" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--teal);stop-opacity:.28"></stop><stop offset="1" style="stop-color:var(--teal);stop-opacity:0"></stop></linearGradient></defs>
            ${[0.25, 0.5, 0.75].map((f) => svg`<path d="M0 ${H * f} H${W}" stroke="var(--muted)" stroke-opacity="0.15" stroke-dasharray="2 5" vector-effect="non-scaling-stroke"></path>`)}
            ${pin ? svg`<path d="${pin} L${W} ${H} L0 ${H} Z" fill="url(#g-house)"></path>` : nothing}
            ${phum ? svg`<path d=${phum} fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" vector-effect="non-scaling-stroke"></path>` : nothing}
            ${pout ? svg`<path d=${pout} fill="none" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>` : nothing}
            ${pin ? svg`<path d=${pin} fill="none" stroke="var(--teal)" stroke-width="2.8" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>` : nothing}
          </svg>
          <span class="st num axis house-axis"><span>${this.hours === 24 ? "−24 h" : "−7 j"}</span><span>${this.hours === 24 ? "−12 h" : "−3 j"}</span><span>maint.</span></span>
        </div>
        <div class="house-stats">
          <div><span class="st">Intérieur</span><b class="num" style="color:var(--teal)">${f1(lastIn)}°</b></div>
          <div><span class="st">Dehors</span><b class="num" style="color:var(--blue)">${f1(lastOut)}°</b></div>
          <div><span class="st">Écart</span><b class="num">${lastIn !== undefined && lastOut !== undefined ? `${f1(lastIn - lastOut)}°` : "—"}</b></div>
          <div><span class="st">Dehors, min–max</span><b class="num" style="font-size:15px">${outs.length ? `${f1(Math.min(...outs))}° à ${f1(Math.max(...outs))}°` : "—"}</b></div>
        </div>
      </div>
    </section>`;
  }

  render() {
    if (!store.hass || !this.p) return nothing;
    const rooms = this.climateRooms();
    const temps = rooms.map((r) => this.value(r.temperature)).filter((v): v is number => v !== undefined);
    const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : undefined;
    const out = num(config.home.outdoorTemperature);
    return html`
      <div class="top">
        <h1 class="page-title">Climat</h1>
        <span class="st" style="font-size:14px">Intérieur <b class="num" style="color:var(--ink)">${f1(avg)}°</b>${out !== undefined ? html`, dehors <b class="num" style="color:var(--ink)">${f1(out)}°</b>` : nothing}</span>
        <span class="grow"></span>
        <span class="legend" aria-hidden="true"><span><i style="width:14px;height:3px;border-radius:2px;background:var(--ink)"></i>Température</span>
          <span><i style="width:14px;border-top:2px dashed var(--muted)"></i>Humidité</span></span>
        <div class="seg" role="group" aria-label="Période">
          <button aria-pressed=${this.hours === 24 ? "true" : "false"} @click=${() => this.setHours(24)}>24 h</button>
          <button aria-pressed=${this.hours === 168 ? "true" : "false"} @click=${() => this.setHours(168)}>7 jours</button>
        </div>
      </div>
      <div class="layout">
        <div class="main">${this.house()}
        <section class="rooms" aria-label="Pièces">
          ${rooms.length ? rooms.map((r, i) => this.roomCard(r, ROOM_COLORS[i % ROOM_COLORS.length])) : html`<p class="empty">Aucun thermomètre rattaché à une pièce.</p>`}
        </section>
        </div>
        <div class="side">${this.fans()}${this.tips()}</div>
      </div>
    `;
  }
}
customElements.define("kh3-climat", Kh3Climat);

function svgPaths(line: string, area: string, hum: string, color: string, id: string) {
  // The area fades out towards the bottom: no hard edge against the card.
  return svg`<defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color=${color} stop-opacity="0.32"></stop><stop offset="1" stop-color=${color} stop-opacity="0"></stop></linearGradient></defs>
    <path d=${area} fill="url(#g-${id})"></path>${hum ? svgLine(hum, "var(--muted)", true) : nothing}${svgLine(line, color, false)}`;
}

const svgLine = (d: string, color: string, dashed: boolean) =>
  svg`<path d=${d} fill="none" stroke=${color} stroke-width=${dashed ? 1.6 : 2.6} stroke-dasharray=${dashed ? "4 4" : "none"} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity=${dashed ? 0.7 : 1}></path>`;
