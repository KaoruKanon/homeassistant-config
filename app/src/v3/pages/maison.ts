import { css, html, nothing, svg } from "lit";
import { media, openMoreInfo, setBrightness, setLights, toggle } from "../../actions.ts";
import { config } from "../../config.ts";
import { brightnessPercent, isUnavailable, stateLabel } from "../../format.ts";
import { openComputer } from "../../popups/open.ts";
import { entityName, matches, type Room } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import "../../v2/floorplan.ts";
import { f0, f1, history, linePath, num, resample, since, type Point } from "../data.ts";
import { icon, roomIcon } from "../icons.ts";
import { goTo } from "../nav.ts";
import { Page } from "../page.ts";

const openLight = (id: string) => void import("../../popups/details.ts").then((m) => m.openLight(id));
const OFF = new Set(["off", "unavailable", "standby", "unknown", "idle"]);

const visibleLights = (r: Room) => r.lights.filter((id) => !matches(id, config.hide));
const lit = (r: Room) => visibleLights(r).filter((id) => store.get(id)?.state === "on");

/**
 * Maison: the live plan of the flat (2D or 3D) and every room with its
 * temperature, what is on and what is open. A room opens its own page.
 */
export class Kh3Maison extends Page {
  constructor() {
    super();
    new EntitiesController(this, () =>
      (this.p?.rooms ?? []).flatMap((r) => [...r.lights, ...r.openings, ...r.motion, ...r.media, r.temperature, r.humidity]).filter((x): x is string => !!x),
    );
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 14px;
        align-items: start;
      }
      .plan {
        padding: 12px;
        --kh-font: "Instrument Sans", system-ui, sans-serif;
        --plan-max-height: calc(100dvh - 140px);
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .room {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 16px;
        background: var(--surf);
        text-align: left;
      }
      .room .ico.lit {
        background: var(--amber);
        color: #3a2400;
      }
      .tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 3px;
      }
      .tag {
        height: 22px;
        padding: 0 8px;
        border-radius: 99px;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
      }
      .chip {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 14px 0 4px;
        border-radius: 999px;
        background: var(--surf);
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .chip .ico {
        width: 32px;
        height: 32px;
        border-radius: 999px;
      }
      @container (max-width: 980px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        .plan {
          --plan-max-height: 70vh;
        }
      }
    `,
  ];

  render() {
    if (!store.hass || !this.p) return nothing;
    const rooms = this.p.rooms;
    const litRooms = rooms.filter((r) => lit(r).length);
    const lights = litRooms.reduce((n, r) => n + lit(r).length, 0);
    const open = rooms.flatMap((r) => r.openings).filter((id) => store.get(id)?.state === "on").length;
    const presence = rooms.filter((r) => r.motion.some((id) => store.get(id)?.state === "on")).map((r) => r.name);
    const off = "background:var(--surf2);color:var(--muted)";
    return html`
      <div class="top">
        <h1 class="page-title">Maison</h1>
        <div class="hs" style="flex:1;min-width:0">
          <span class="chip"><span class="ico" style=${lights ? "background:var(--amber);color:#3a2400" : off}>${icon("bulb", 18)}</span>
            ${lights ? `${lights} lumière${lights > 1 ? "s" : ""} dans ${litRooms.length} pièce${litRooms.length > 1 ? "s" : ""}` : "Tout est éteint"}</span>
          <span class="chip"><span class="ico" style=${open ? "background:var(--red);color:#fff" : off}>${icon("window", 18)}</span>${open ? `${open} ouverture${open > 1 ? "s" : ""}` : "Tout est fermé"}</span>
          ${presence.length ? html`<span class="chip"><span class="ico" style="background:var(--tealTint);color:var(--teal)">${icon("motion", 18)}</span>Présence : ${presence.join(", ")}</span>` : nothing}
        </div>
        ${lights ? html`<button class="btn" @click=${() => setLights(rooms.flatMap(visibleLights), false)}>${icon("power", 16)}Tout éteindre</button>` : nothing}
      </div>
      <div class="layout">
        <section class="card plan" aria-label="Plan de l'appartement">
          <kh-floorplan .rooms=${rooms} prefix=${this.p.prefix}></kh-floorplan>
        </section>
        <nav class="list" aria-label="Pièces">
          ${rooms.map((r) => {
            const on = lit(r).length;
            const t = num(r.temperature), h = num(r.humidity);
            const pc = config.home.computers.find((c) => config.plan?.computers[r.id] === c.entity && store.get(c.entity)?.state === "on");
            const tv = r.media.find((id) => config.home.tvs.includes(id) && !OFF.has(store.get(id)?.state ?? "off"));
            const opened = r.openings.filter((id) => store.get(id)?.state === "on").length;
            return html`<a class="room" href="${this.p.prefix}/maison/${r.id}">
              <span class="ico ${on ? "lit" : ""}">${icon(roomIcon(r.icon))}</span>
              <span style="flex:1;min-width:0"><span class="nm ell" style="font-size:15px">${r.name}</span>
                <span class="tags">
                  ${on ? html`<span class="tag" style="background:var(--amberTint);color:var(--amberInk)">${on} lumière${on > 1 ? "s" : ""}</span>` : nothing}
                  ${opened ? html`<span class="tag" style="background:var(--redTint);color:var(--red)">${opened > 1 ? `${opened} ouvertes` : "Fenêtre ouverte"}</span>` : nothing}
                  ${pc ? html`<span class="tag" style="background:var(--blueTint);color:var(--blue)">${pc.name}</span>` : nothing}
                  ${tv ? html`<span class="tag" style="background:var(--violetTint);color:var(--violet)">TV allumée</span>` : nothing}
                  ${!on && !opened && !pc && !tv ? html`<span class="st">Tout est éteint</span>` : nothing}
                </span></span>
              <span style="text-align:right;flex:none"><span class="num" style="display:block;font-size:20px;font-weight:700">${t !== undefined ? `${f1(t)}°` : "—"}</span>
                <span class="num st">${h !== undefined ? `${f0(h)} %` : r.temperature ? "" : "pas de capteur"}</span></span>
            </a>`;
          })}
        </nav>
      </div>
    `;
  }
}
customElements.define("kh3-maison", Kh3Maison);

/**
 * One room: its lights (dimmer, details), climate over 24 h, openings and
 * presence, media, plugs and computers.
 */
export class Kh3Piece extends Page {
  static properties = { ...Page.properties, series: { state: true } };
  declare series: Record<string, Point[]>;
  private loadedFor = "";

  constructor() {
    super();
    this.series = {};
    new EntitiesController(this, () => {
      const r = this.room();
      return r ? [...r.lights, ...r.switches, ...r.fans, ...r.media, ...r.openings, ...r.motion, r.temperature, r.humidity].filter((x): x is string => !!x) : [];
    });
  }

  private room(): Room | undefined {
    return this.p?.rooms.find((r) => r.id === this.p.sub);
  }

  protected willUpdate(): void {
    const r = this.room();
    const ids = r ? [r.temperature, r.humidity].filter((x): x is string => !!x) : [];
    const key = ids.join();
    if (key && key !== this.loadedFor) {
      this.loadedFor = key;
      void history(ids, 24).then((s) => s && (this.series = s));
    }
  }

  static styles = [
    ...Page.styles,
    css`
      :host {
        container-type: inline-size;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        align-items: start;
      }
      .grid > .lights {
        grid-row: span 2;
      }
      .light {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        border-radius: 18px;
        background: var(--surf2);
      }
      .light .head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .light.on .ico {
        background: var(--amber);
        color: #3a2400;
      }
      .light.on .switch[aria-checked="true"] {
        background: var(--amber);
      }
      input[type="range"] {
        width: 100%;
        accent-color: var(--amber);
        height: 32px;
      }
      .back {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: var(--surf);
        display: grid;
        place-items: center;
      }
      svg.chart {
        width: 100%;
        height: 130px;
      }
      .switch[aria-checked="true"] {
        background: var(--teal);
      }
      @container (max-width: 1000px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container (max-width: 640px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .grid > .lights {
          grid-row: auto;
        }
      }
    `,
  ];

  private lightRow(id: string, room: Room) {
    const hass = store.hass!;
    const s = store.get(id);
    const name = entityName(hass, id, config, room.name);
    const on = s?.state === "on";
    const gone = isUnavailable(s);
    const dimmable = !gone && (s?.attributes.supported_color_modes ?? []).some((m: string) => m !== "onoff");
    const pct = brightnessPercent(s) ?? (on ? 100 : 0);
    return html`<div class="light ${on ? "on" : ""}">
      <div class="head">
        <span class="ico">${icon("bulb")}</span>
        <button style="flex:1;min-width:0;text-align:left" aria-label="Réglages de ${name}" @click=${() => openLight(id)}>
          <span class="nm ell">${name}</span><span class="st">${gone ? "Hors ligne" : on ? `${pct} %` : "Éteinte"}</span></button>
        <button class="switch" role="switch" aria-checked=${on ? "true" : "false"} aria-label=${name} ?disabled=${gone} @click=${() => toggle(id, name)}></button>
      </div>
      ${dimmable && on
        ? html`<input type="range" min="1" max="100" .value=${String(pct)} aria-label="Luminosité de ${name}"
            @change=${(e: Event) => setBrightness(id, Number((e.target as HTMLInputElement).value))} />`
        : nothing}
    </div>`;
  }

  private climate(r: Room) {
    if (!r.temperature) return nothing;
    const now = Date.now(), from = now - 24 * 3600_000;
    const t = resample(this.series[r.temperature] ?? [], from, now, 48);
    const h = r.humidity ? resample(this.series[r.humidity] ?? [], from, now, 48) : [];
    const tv = t.filter((v): v is number => v !== undefined), hv = h.filter((v): v is number => v !== undefined);
    const W = 300, H = 120;
    const pts = (vals: (number | undefined)[], lo: number, hi: number) =>
      vals.map((v, i) => (v === undefined ? undefined : { x: (i / 47) * W, y: H - 6 - ((v - lo) / Math.max(hi - lo, 1)) * (H - 14) })).filter((p): p is { x: number; y: number } => !!p);
    const tl = tv.length ? linePath(pts(t, Math.min(...tv) - 0.5, Math.max(...tv) + 0.5)) : "";
    const hl = hv.length ? linePath(pts(h, Math.min(...hv) - 2, Math.max(...hv) + 2)) : "";
    return html`<section class="card" aria-label="Climat sur 24 heures">
      <div style="display:flex;align-items:baseline;justify-content:space-between"><h2 class="h">Climat sur 24 h</h2>
        <span class="st">${tv.length ? `${f1(Math.min(...tv))}° à ${f1(Math.max(...tv))}°` : "Pas d'historique"}</span></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Température et humidité sur 24 heures">
        ${tl ? svg`<path d="${tl} L${W} ${H} L0 ${H} Z" fill="var(--tealTint)"></path>` : nothing}
        ${hl ? svg`<path d=${hl} fill="none" stroke="var(--blue)" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>` : nothing}
        ${tl ? svg`<path d=${tl} fill="none" stroke="var(--teal)" stroke-width="3" vector-effect="non-scaling-stroke"></path>` : nothing}
      </svg>
      <div class="st" style="display:flex;gap:14px"><span style="display:flex;align-items:center;gap:6px"><i style="width:12px;height:3px;background:var(--teal)"></i>Température</span>
        ${r.humidity ? html`<span style="display:flex;align-items:center;gap:6px"><i style="width:12px;border-top:2px dashed var(--blue)"></i>Humidité</span>` : nothing}</div>
    </section>`;
  }

  private openings(r: Room) {
    const hass = store.hass!;
    const ids = [...r.openings, ...r.motion];
    if (!ids.length) return nothing;
    return html`<section class="card" aria-label="Ouvertures et présence"><h2 class="h">Ouvertures et présence</h2>
      <div class="rows">${ids.map((id) => {
        const s = store.get(id);
        const on = s?.state === "on";
        const motion = r.motion.includes(id);
        return html`<div class="row">
          <span class="ico" style=${on ? (motion ? "background:var(--tealTint);color:var(--teal)" : "background:var(--red);color:#fff") : ""}>${icon(motion ? "motion" : "window")}</span>
          <span style="min-width:0"><span class="nm ell">${entityName(hass, id, config, r.name)}</span>
            <span class="st">${stateLabel(hass, s)}${s?.last_changed ? `, depuis ${since(s.last_changed)}` : ""}</span></span>
        </div>`;
      })}</div></section>`;
  }

  private mediaCard(r: Room) {
    const hass = store.hass!;
    if (!r.media.length) return nothing;
    return html`<section class="card" aria-label="Médias"><h2 class="h">Médias</h2>
      <div class="rows">${r.media.map((id) => {
        const s = store.get(id);
        const on = !!s && !OFF.has(s.state);
        const name = entityName(hass, id, config, r.name);
        const playing = s?.state === "playing";
        return html`<div class="row" style=${on ? "background:var(--violetTint)" : ""}>
          <span class="ico" style=${on ? "background:var(--violet);color:#fff" : ""}>${icon(config.home.tvs.includes(id) ? "tv" : "speaker")}</span>
          <span style="flex:1;min-width:0"><span class="nm ell">${name}</span><span class="st ell" style="display:block">${s?.attributes.media_title ?? stateLabel(hass, s)}</span></span>
          ${s?.attributes.media_title
            ? html`<button class="rb" style="background:var(--violet);color:#fff;border-radius:999px" aria-label=${playing ? "Pause" : "Lecture"} @click=${() => media(id, "media_play_pause")}>${icon(playing ? "pause" : "play", 18)}</button>`
            : html`<button class="rb" style="background:var(--surf)" aria-label="${on ? "Éteindre" : "Allumer"} ${name}" @click=${() => media(id, on ? "turn_off" : "turn_on")}>${icon("power", 18)}</button>`}
        </div>`;
      })}</div></section>`;
  }

  private others(r: Room) {
    const hass = store.hass!;
    const pcs = config.home.computers.filter((c) => config.plan?.computers[r.id] === c.entity);
    const sw = [...r.switches, ...r.fans].filter((id) => !matches(id, config.hide) && !pcs.some((c) => c.entity === id));
    if (!sw.length && !pcs.length) return nothing;
    return html`<section class="card" aria-label="Prises et appareils"><h2 class="h">Prises et appareils</h2>
      <div class="rows">
        ${pcs.map((c) => {
          const on = store.get(c.entity)?.state === "on";
          return html`<div class="row" style=${on ? "background:var(--blueTint)" : ""}>
            <span class="ico" style=${on ? "background:var(--blue);color:#fff" : ""}>${icon("monitor")}</span>
            <button style="flex:1;min-width:0;text-align:left" @click=${() => openComputer(c)} aria-label="Détails de ${c.name}"><span class="nm ell">${c.name}</span><span class="st">${on ? "Allumé" : "Éteint"}</span></button>
            <button class="switch" role="switch" aria-checked=${on ? "true" : "false"} aria-label=${c.name} @click=${() => toggle(c.entity, c.name)}></button>
          </div>`;
        })}
        ${sw.map((id) => {
          const s = store.get(id);
          const on = s?.state === "on";
          const name = entityName(hass, id, config, r.name);
          const watts = this.p.model.power[id] ? num(this.p.model.power[id]) : undefined;
          return html`<div class="row">
            <span class="ico" style=${on ? "background:var(--yellowTint);color:var(--yellowInk)" : ""}>${icon(id.startsWith("fan.") ? "fan" : "plug")}</span>
            <button style="flex:1;min-width:0;text-align:left" @click=${() => openMoreInfo(this, id)} aria-label="Détails de ${name}"><span class="nm ell">${name}</span>
              <span class="st">${isUnavailable(s) ? "Hors ligne" : on ? `Allumé${watts !== undefined ? `, ${f0(watts)} W` : ""}` : "Éteint"}</span></button>
            <button class="switch" role="switch" aria-checked=${on ? "true" : "false"} aria-label=${name} ?disabled=${isUnavailable(s)} @click=${() => toggle(id, name)}></button>
          </div>`;
        })}
      </div></section>`;
  }

  render() {
    if (!store.hass || !this.p) return nothing;
    const r = this.room();
    if (!r) return html`<div class="top"><a class="back" href="${this.p.prefix}/maison" aria-label="Retour à Maison">${icon("chevronL")}</a><h1 class="page-title">Pièce introuvable</h1></div>`;
    const t = num(r.temperature), h = num(r.humidity);
    const lights = visibleLights(r);
    const anyOn = lights.some((id) => store.get(id)?.state === "on");
    const motion = r.motion.map((id) => store.get(id)).filter((s) => s);
    const last = motion.sort((a, b) => Date.parse(b!.last_changed) - Date.parse(a!.last_changed))[0];
    return html`
      <div class="top">
        <a class="back" href="${this.p.prefix}/maison" aria-label="Retour à Maison">${icon("chevronL")}</a>
        <h1 class="page-title">${r.name}</h1>
        ${t !== undefined ? html`<span class="num" style="font-size:22px;font-weight:700;color:var(--teal)">${f1(t)}°</span>` : nothing}
        ${h !== undefined ? html`<span class="num st" style="font-size:15px">${f0(h)} % d'humidité</span>` : nothing}
        <span class="grow"></span>
        ${last ? html`<span class="st" style="font-size:13px;display:flex;align-items:center;gap:8px"><i style="width:8px;height:8px;border-radius:99px;background:${last.state === "on" ? "var(--teal)" : "var(--muted)"}"></i>
          ${last.state === "on" ? "Présence en ce moment" : `Présence il y a ${since(last.last_changed)}`}</span>` : nothing}
      </div>
      <nav class="hs" aria-label="Autres pièces" style="margin-bottom:14px">
        ${this.p.rooms.map((x) => html`<button class="pill" style="background:${x.id === r.id ? "" : "var(--surf)"}" aria-current=${x.id === r.id ? "page" : "false"}
          @click=${() => goTo(`${this.p.prefix}/maison/${x.id}`)}>${x.name}</button>`)}
      </nav>
      <div class="grid">
        <section class="card lights" aria-label="Lumières">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h2 class="h" style="margin:0">Lumières</h2>
            ${anyOn ? html`<button class="btn" style="background:var(--amberTint);color:var(--amberInk)" @click=${() => setLights(lights, false)}>Tout éteindre</button>` : nothing}</div>
          <div class="rows">${lights.length ? lights.map((id) => this.lightRow(id, r)) : html`<p class="empty">Pas de lumière dans cette pièce.</p>`}</div>
        </section>
        ${this.climate(r)}${this.openings(r)}${this.mediaCard(r)}${this.others(r)}
      </div>
    `;
  }
}
customElements.define("kh3-piece", Kh3Piece);
