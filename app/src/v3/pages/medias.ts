import { css, html, nothing, type TemplateResult } from "lit";
import { media, muteToggle, remoteApp, remoteKey, setVolume } from "../../actions.ts";
import { config } from "../../config.ts";
import { stateLabel } from "../../format.ts";
import { openMediaItem } from "../../popups/open.ts";
import { entityName } from "../../rooms.ts";
import { EntitiesController, store } from "../../store.ts";
import type { HassEntity } from "../../types.ts";
import { jellyfinItems } from "../data.ts";
import { icon } from "../icons.ts";
import { Page } from "../page.ts";

const OFF = new Set(["off", "unavailable", "standby", "unknown"]);
const REPEAT_AFTER_MS = 400;
const REPEAT_EVERY_MS = 150;

/** Brand marks of the box apps (drawn, not fetched). */
const LOGOS: Record<string, () => TemplateResult> = {
  YouTube: () => html`<svg viewBox="0 0 28 20" width="30" height="21" aria-hidden="true"><rect width="28" height="20" rx="6" fill="#FF0000"></rect><path d="M11 5.5v9l8-4.5z" fill="#fff"></path></svg>`,
  Netflix: () => html`<svg viewBox="0 0 16 28" width="14" height="25" aria-hidden="true"><path d="M0 0h4.5l7 18V0H16v28c-1.5-.2-3-.3-4.5-.4L4.5 10v17.4L0 28z" fill="#E50914"></path></svg>`,
  "Apple TV": () => html`<span style="display:flex;align-items:center;gap:2px;font-weight:600;font-size:14px;color:#fff"><svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-4zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"></path></svg>tv</span>`,
  Spotify: () => html`<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1ED760"></circle><path d="M6 9.2c4-1.2 8.6-.8 12 1.2M6.6 12.6c3.3-.9 7-.6 9.8 1M7.2 15.8c2.6-.7 5.4-.4 7.6.8" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"></path></svg>`,
};
const LOGO_BG: Record<string, string> = { Netflix: "#000", "Apple TV": "#1C1C1E" };

/**
 * Médias: what plays (Spotify, speakers, TVs), the TV box remote, every
 * speaker's volume, and the series and films just added on Jellyfin.
 */
export class Kh3Medias extends Page {
  private delay = 0;
  private repeat = 0;

  constructor() {
    super();
    new EntitiesController(this, () =>
      [config.home.spotify, ...config.home.tvs, ...config.media.speakers, config.media.box?.player, config.media.box?.remote, ...config.media.jellyfin.map((j) => j.entity)].filter(
        (x): x is string => !!x,
      ),
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stop();
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
        grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
        height: calc(100dvh - 32px - 70px);
        min-height: 620px;
      }
      .playing {
        grid-column: 1;
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
        gap: 12px;
        min-height: 196px;
      }
      .side {
        grid-column: 2;
        grid-row: 1 / 4;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }
      .shelf {
        grid-column: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        padding: 14px 16px;
      }
      .shelf .hs {
        flex: 1;
        min-height: 0;
        gap: 10px;
        scroll-snap-type: x mandatory;
      }
      .poster {
        flex: none;
        height: 100%;
        aspect-ratio: 2 / 3;
        border-radius: 12px;
        position: relative;
        overflow: hidden;
        text-align: left;
        color: #fff;
        background: var(--surf2);
        scroll-snap-align: start;
      }
      .poster img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .poster > span {
        position: absolute;
        inset: auto 0 0 0;
        padding: 28px 9px 8px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
      }
      .player {
        display: flex;
        gap: 16px;
        padding: 12px;
      }
      .cover {
        height: 100%;
        max-height: 172px;
        aspect-ratio: 1;
        border-radius: 14px;
        flex: none;
        object-fit: cover;
        background: var(--surf2);
        display: grid;
        place-items: center;
        color: var(--muted);
      }
      .bar {
        height: 5px;
        border-radius: 99px;
        background: var(--surf2);
        overflow: hidden;
      }
      .bar i {
        display: block;
        height: 100%;
        background: var(--violet);
      }
      .play {
        width: 50px;
        height: 50px;
        border-radius: 999px;
        background: var(--violet);
        color: #fff;
        display: grid;
        place-items: center;
      }
      .tv {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tv.on {
        background: var(--violetTint);
      }
      .tv .rb {
        background: var(--surf);
      }
      .remote {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .pad {
        display: grid;
        grid-template-columns: repeat(3, 50px);
        grid-template-rows: repeat(3, 50px);
        gap: 6px;
        flex: none;
      }
      .pad .rb {
        width: 50px;
        height: 50px;
      }
      .ok {
        width: 50px;
        height: 50px;
        border-radius: 999px;
        background: var(--violet);
        color: #fff;
        font-weight: 700;
      }
      .keys {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .keys .rb {
        width: 100%;
      }
      .apps {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .apps button {
        height: 48px;
        border-radius: 13px;
        background: var(--surf2);
        display: grid;
        place-items: center;
      }
      .apps button[aria-current="true"] {
        outline: 2px solid var(--violet);
        outline-offset: 1px;
      }
      .speaker {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 14px;
        background: var(--surf2);
      }
      .speaker .ico.on {
        background: var(--violet);
        color: #fff;
      }
      input[type="range"] {
        flex: 1;
        min-width: 60px;
        accent-color: var(--violet);
        height: 28px;
      }
      @container (max-width: 980px) {
        .layout {
          display: flex;
          flex-direction: column;
          height: auto;
          min-height: 0;
        }
        .playing {
          grid-template-columns: minmax(0, 1fr);
        }
        .shelf .hs {
          height: 210px;
          flex: none;
        }
        .player {
          min-height: 160px;
        }
        .cover {
          max-height: 136px;
        }
      }
    `,
  ];

  private stop = () => {
    window.clearTimeout(this.delay);
    window.clearInterval(this.repeat);
  };

  /** Press = one key; hold = it repeats until release. */
  private key(command: string, content: TemplateResult | string, label: string, cls = "rb") {
    const remote = config.media.box!.remote;
    const start = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.stop();
      remoteKey(remote, command);
      this.delay = window.setTimeout(() => (this.repeat = window.setInterval(() => remoteKey(remote, command), REPEAT_EVERY_MS)), REPEAT_AFTER_MS);
    };
    return html`<button class=${cls} aria-label=${label} @pointerdown=${start} @pointerup=${this.stop} @pointerleave=${this.stop} @pointercancel=${this.stop}
      @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && remoteKey(remote, command)}>${content}</button>`;
  }

  private nowPlaying(): HassEntity | undefined {
    const ids = [config.home.spotify, ...config.media.speakers].filter((x): x is string => !!x);
    const states = ids.map((id) => store.get(id)).filter((s): s is HassEntity => !!s);
    return states.find((s) => s.state === "playing") ?? states.find((s) => s.state === "paused" && s.attributes.media_title) ?? states.find((s) => s.attributes.media_title);
  }

  private player(s?: HassEntity) {
    if (!s || !s.attributes.media_title) {
      return html`<article class="card player" aria-label="Lecture">
        <span class="cover">${icon("speaker", 40)}</span>
        <span style="display:flex;flex-direction:column;justify-content:center;gap:4px"><span class="h">Rien en lecture</span>
          <span class="st">Lance de la musique depuis Spotify ou une enceinte.</span></span></article>`;
    }
    const a = s.attributes, id = s.entity_id;
    const art = a.entity_picture as string | undefined;
    const dur = Number(a.media_duration), pos = Number(a.media_position), upd = Date.parse(a.media_position_updated_at ?? "");
    const at = s.state === "playing" && !isNaN(upd) ? pos + (Date.now() - upd) / 1000 : pos;
    const progress = dur > 0 && !isNaN(at) ? Math.min(100, (at / dur) * 100) : 0;
    const mmss = (sec: number) => (isNaN(sec) ? "" : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`);
    const where = [a.app_name ?? entityName(store.hass!, id, config), a.source].filter(Boolean).join(", ");
    return html`<article class="card player" aria-label="Lecture en cours">
      ${art ? html`<img class="cover" src=${art} alt="" width="172" height="172" decoding="async" />` : html`<span class="cover">${icon("speaker", 40)}</span>`}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span class="st ell" style="display:flex;align-items:center;gap:6px">${s.state === "playing" ? html`<span class="kh-eq" aria-hidden="true" style="color:#1db954"><i></i><i></i><i></i></span>` : nothing}${where}</span>
        <span class="num ell" style="font-size:24px;font-weight:700;line-height:1.15">${a.media_title}</span>
        <span class="ell" style="font-size:14px;color:var(--muted)">${[a.media_artist, a.media_album_name].filter(Boolean).join(", ")}</span>
        <span style="flex:1"></span>
        <span class="bar"><i style="width:${progress}%"></i></span>
        <span class="num st" style="display:flex;justify-content:space-between"><span>${mmss(at)}</span><span>${mmss(dur)}</span></span>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="rb" style="background:none" aria-label="Précédent" @click=${() => media(id, "media_previous_track")}>${icon("prev")}</button>
          <button class="play" aria-label=${s.state === "playing" ? "Pause" : "Lecture"} @click=${() => media(id, "media_play_pause")}>${icon(s.state === "playing" ? "pause" : "play")}</button>
          <button class="rb" style="background:none" aria-label="Suivant" @click=${() => media(id, "media_next_track")}>${icon("next")}</button>
          <span style="flex:1"></span>
          <button class="rb" aria-label="Moins fort" @click=${() => media(id, "volume_down")}>${icon("minus", 18)}</button>
          <button class="rb" aria-label="Plus fort" @click=${() => media(id, "volume_up")}>${icon("plus", 18)}</button>
        </div>
      </div>
    </article>`;
  }

  private tvs() {
    const hass = store.hass!;
    const tvs = config.home.tvs.map((id) => store.get(id)).filter((s): s is HassEntity => !!s);
    const on = tvs.filter((s) => !OFF.has(s.state));
    const main = on[0] ?? tvs[0];
    if (!main) return nothing;
    const name = entityName(hass, main.entity_id, config);
    const isOn = !OFF.has(main.state);
    const others = tvs.filter((s) => s !== main);
    return html`<article class="card tv ${isOn ? "on" : ""}" aria-label="Télévisions">
      <div style="display:flex;align-items:center;gap:10px"><span class="ico" style=${isOn ? "background:var(--violet);color:#fff" : ""}>${icon("tv")}</span>
        <span style="min-width:0"><span class="nm ell">${name}</span><span class="st ell" style="display:block">${isOn ? (main.attributes.app_name ?? main.attributes.source ?? "Allumée") : stateLabel(hass, main)}</span></span></div>
      <span style="flex:1"></span>
      <div style="display:flex;gap:6px">
        <button class="rb" aria-label="${isOn ? "Éteindre" : "Allumer"} ${name}" @click=${() => media(main.entity_id, isOn ? "turn_off" : "turn_on")}>${icon("power", 18)}</button>
        ${isOn
          ? html`<button class="rb" aria-label="Moins fort" @click=${() => media(main.entity_id, "volume_down")}>${icon("minus", 18)}</button>
              <button class="rb" aria-label="Plus fort" @click=${() => media(main.entity_id, "volume_up")}>${icon("plus", 18)}</button>`
          : nothing}
      </div>
      ${others.map((o) => {
        const oOn = !OFF.has(o.state);
        const n = entityName(hass, o.entity_id, config);
        return html`<button class="st" style="text-align:left;display:flex;align-items:center;gap:6px;min-height:28px" @click=${() => media(o.entity_id, oOn ? "turn_off" : "turn_on")}>
          ${icon("power", 14)}${n} ${oOn ? "allumée" : "éteinte"}</button>`;
      })}
    </article>`;
  }

  private remote() {
    const b = config.media.box;
    if (!b) return nothing;
    const hass = store.hass!;
    const player = hass.states[b.player];
    const remote = hass.states[b.remote];
    const activity = (remote?.attributes.current_activity as string | undefined) ?? "";
    const on = remote?.state === "on" || (!!player && !OFF.has(player.state));
    const current = b.apps.find((a) => activity && (activity === a.activity || activity.toLowerCase().includes(a.name.toLowerCase().replace(" ", ""))));
    return html`<section class="card remote" aria-label="Télécommande de la box">
      <div style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0"><span class="h" style="display:block">Box TV</span>
        <span class="st">${current ? `Sur ${current.name}` : on ? (/bouygues|bbui|launcher/i.test(activity) || !activity ? "Sur l'accueil" : activity.replace(/^.*\./, "")) : "Éteinte"}</span></span>
        <button class="rb" style=${on ? "background:var(--redTint);color:var(--red)" : ""} aria-label=${on ? "Éteindre la box" : "Allumer la box"}
          @click=${() => media(b.player, on ? "turn_off" : "turn_on")}>${icon("power", 18)}</button></div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="pad" role="group" aria-label="Croix directionnelle">
          <span></span>${this.key("DPAD_UP", icon("chevronU"), "Haut")}<span></span>
          ${this.key("DPAD_LEFT", icon("chevronL"), "Gauche")}${this.key("DPAD_CENTER", "OK", "Valider", "ok")}${this.key("DPAD_RIGHT", icon("chevronR"), "Droite")}
          <span></span>${this.key("DPAD_DOWN", icon("chevronD"), "Bas")}<span></span>
        </div>
        <div class="keys">
          ${this.key("BACK", icon("back", 18), "Retour")}
          ${this.key("HOME", icon("home", 18), "Accueil de la box")}
          <button class="rb" aria-label="Lecture ou pause" @click=${() => media(b.player, "media_play_pause")}>${icon("playPause", 18)}</button>
          <button class="rb" aria-label="Couper le son" @click=${() => muteToggle(b.player)}>${icon("mute", 18)}</button>
          <button class="rb" aria-label="Baisser le volume" @click=${() => media(b.player, "volume_down")}>${icon("minus", 18)}</button>
          <button class="rb" aria-label="Monter le volume" @click=${() => media(b.player, "volume_up")}>${icon("plus", 18)}</button>
        </div>
      </div>
      <div class="apps">
        ${b.apps.map(
          (a) => html`<button aria-label="Ouvrir ${a.name}" aria-current=${a === current ? "true" : "false"} style=${LOGO_BG[a.name] ? `background:${LOGO_BG[a.name]}` : ""}
            @click=${() => remoteApp(b.remote, a.activity)}>${LOGOS[a.name]?.() ?? html`<span style="font-size:12px;font-weight:700">${a.name}</span>`}</button>`,
        )}
      </div>
    </section>`;
  }

  private speakers() {
    const ids = config.media.speakers;
    if (!ids.length) return nothing;
    const hass = store.hass!;
    return html`<section class="card" aria-label="Enceintes" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto">
      <h2 class="h" style="margin:0">Enceintes</h2>
      ${ids.map((id) => {
        const s = store.get(id);
        const name = (s?.attributes.friendly_name as string) ?? entityName(hass, id, config);
        const active = !!s && (s.state === "playing" || s.state === "paused");
        const vol = Math.round(Number(s?.attributes.volume_level ?? 0) * 100);
        const gone = !s || s.state === "unavailable";
        return html`<div class="speaker">
          <span class="ico ${active ? "on" : ""}">${icon("speaker", 18)}</span>
          <span style="width:110px;flex:none;min-width:0"><span class="nm ell" style="font-size:13px">${name}</span>
            <span class="st ell" style="display:block">${gone ? "Hors ligne" : active ? (s!.attributes.media_title ?? stateLabel(hass, s)) : "Libre"}</span></span>
          <input type="range" min="0" max="100" step="5" .value=${String(vol)} ?disabled=${gone} aria-label="Volume de ${name}"
            @change=${(e: Event) => setVolume(id, Number((e.target as HTMLInputElement).value) / 100)} />
          <span class="num" style="width:38px;text-align:right;font-size:12px;font-weight:700">${gone ? "" : `${vol} %`}</span>
        </div>`;
      })}
    </section>`;
  }

  private shelf(title: string, entity: string, sub: string) {
    const items = jellyfinItems(entity);
    return html`<section class="card shelf" aria-label=${title}>
      <div style="display:flex;align-items:baseline;gap:10px"><h2 class="h">${title}</h2><span class="st">${sub}</span></div>
      ${items.length
        ? html`<div class="hs">${items.map(
            (i) => html`<button class="poster" @click=${() => openMediaItem(i)} aria-label=${i.title}>
              ${i.poster ? html`<img src=${i.poster} alt="" loading="lazy" decoding="async" />` : nothing}
              <span><b class="ell" style="display:block;font-size:13px">${i.title}</b><span class="ell" style="display:block;font-size:11px;opacity:.85">${i.number || (i.aired ?? "").slice(0, 4)}</span></span>
            </button>`,
          )}</div>`
        : html`<p class="empty">Rien de nouveau.</p>`}
    </section>`;
  }

  render() {
    if (!store.hass || !this.p) return nothing;
    const series = config.media.jellyfin.find((j) => /s[ée]rie/i.test(j.title));
    const films = config.media.jellyfin.find((j) => /film/i.test(j.title));
    const playing = [config.home.spotify, ...config.media.speakers, ...config.home.tvs].filter((id) => {
      const s = id ? store.get(id) : undefined;
      return s && (s.state === "playing" || (config.home.tvs.includes(s.entity_id) && !OFF.has(s.state)));
    }).length;
    return html`
      <div class="top"><h1 class="page-title">Médias</h1><span class="st" style="font-size:14px">${playing ? `${playing} en lecture` : "Rien en lecture"}</span></div>
      <div class="layout">
        <section class="playing" aria-label="En lecture">${this.player(this.nowPlaying())}${this.tvs()}</section>
        ${series ? this.shelf("Séries", series.entity, "ajoutées sur Jellyfin") : nothing}
        ${films ? this.shelf("Films", films.entity, "ajoutés sur Jellyfin") : nothing}
        <aside class="side">${this.remote()}${this.speakers()}</aside>
      </div>
    `;
  }
}
customElements.define("kh3-medias", Kh3Medias);
