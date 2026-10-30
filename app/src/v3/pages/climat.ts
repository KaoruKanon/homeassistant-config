import { css, html, nothing, svg } from "lit";
import { setFanOscillation, setFanSpeed, setInputNumber, toggle } from "../../actions.ts";
import { config } from "../../config.ts";
import type { Room } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import { f0, f1, history, linePath, minutes, num, resample, type Point } from "../data.ts";
import { icon } from "../icons.ts";
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
    const ids = this.climateRooms().flatMap((r) => [r.temperature!, r.humidity].filter((x): x is string => !!x));
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
        min-height: 230px;
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
      svg.curve {
        width: 100%;
        height: 72px;
        flex: 1;
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
    const temps = resample(this.series[r.temperature!] ?? [], from, now, buckets);
    const hums = r.humidity ? resample(this.series[r.humidity] ?? [], from, now, buckets) : [];
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
    return html`<a class="card room" href="${this.p.prefix}/maison/${r.id}" aria-label="${r.name} : ${f1(t)} degrés${h !== undefined ? `, ${f0(h)} % d'humidité` : ""}">
      <span class="head"><span class="dot" style="background:${color}"></span><span class="nm ell">${r.name}</span>
        ${c ? html`<span class="tag" style=${TONE[c.tone]}>${c.label}</span>` : nothing}</span>
      <span class="vals"><span class="t num">${t !== undefined ? `${f1(t)}°` : "—"}</span>
        ${h !== undefined ? html`<span class="hum num">${icon("drop", 16)}${f0(h)} %</span>` : nothing}</span>
      <svg class="curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution sur ${this.hours === 24 ? "24 heures" : "7 jours"}">
        ${tPts.length
          ? svgPaths(line, `${line} L${W} ${H} L0 ${H} Z`, linePath(hPts), color)
          : nothing}
      </svg>
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
              <span class="ico" style=${on ? "background:var(--teal);color:#06221e" : ""}>${on ? fanSpin() : icon("fan")}</span>
              <span style="flex:1;min-width:0"><span class="nm ell">${name || "Ventilateur"}</span><span class="st">${on ? `En marche, ${pct} %` : s?.state === "unavailable" ? "Hors ligne" : "Arrêté"}</span></span>
              <button class="switch" role="switch" aria-checked=${on ? "true" : "false"} aria-label="Ventilateur" @click=${() => toggle(id, "le ventilateur")}></button>
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
                      <span style="flex:1;text-align:center"><span class="num" style="display:block;font-size:24px;font-weight:700">${t ? minutes(t) : "Sans arrêt"}</span><span class="st">${t ? "avant l'arrêt" : "minuterie"}</span></span>
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
        <section class="rooms" aria-label="Pièces">
          ${rooms.length ? rooms.map((r, i) => this.roomCard(r, ROOM_COLORS[i % ROOM_COLORS.length])) : html`<p class="empty">Aucun thermomètre rattaché à une pièce.</p>`}
        </section>
        <div class="side">${this.fans()}${this.tips()}</div>
      </div>
    `;
  }
}
customElements.define("kh3-climat", Kh3Climat);

function svgPaths(line: string, area: string, hum: string, color: string) {
  return svg`${svgArea(area, color)}${hum ? svgLine(hum, "var(--muted)", true) : nothing}${svgLine(line, color, false)}`;
}

const svgArea = (d: string, color: string) => svg`<path d=${d} fill=${color} opacity="0.16"></path>`;
const svgLine = (d: string, color: string, dashed: boolean) =>
  svg`<path d=${d} fill="none" stroke=${color} stroke-width=${dashed ? 1.6 : 2.5} stroke-dasharray=${dashed ? "4 3" : "none"} vector-effect="non-scaling-stroke" opacity=${dashed ? 0.8 : 1}></path>`;
const fanSpin = () =>
  html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${svg`<g class="kh-spin kh-fast"><path d="M12 10c0-4 1-7 4-7s2 4-2 7M14 12c4 0 7 1 7 4s-4 2-7-2M12 14c0 4-1 7-4 7s-2-4 2-7M10 12c-4 0-7-1-7-4s4-2 7 2"></path></g>`}</svg>`;
