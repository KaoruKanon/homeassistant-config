import { html, nothing } from "lit";
import {
  canToggle,
  needsConfirmation,
  openNativeMoreInfo,
  setBrightness,
  setColorTemp,
  setEffect,
  setHue,
  toggle,
} from "../actions.ts";
import "../components/media-card.ts";
import "../components/sparkline.ts";
import { openPopup } from "../components/popup.ts";
import { config } from "../config.ts";
import { brightnessPercent, formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { entityName } from "../rooms.ts";
import { store } from "../store.ts";
import { ago, openPerson, openTracker } from "./index.ts";

// Every "details" in the app opens here, in one popup style. HA's own dialog
// stays reachable through "Plus d'infos" at the bottom.

const st = (id: string) => store.hass?.states[id];
const nameOf = (id: string) => (store.hass ? entityName(store.hass, id, config) : id);

const DOMAIN_LOOK: Record<string, [string, string]> = {
  light: ["mdi:lightbulb", "amber"],
  switch: ["mdi:power-plug", "light-blue"],
  fan: ["mdi:fan", "teal"],
  media_player: ["mdi:play-circle-outline", "blue"],
  binary_sensor: ["mdi:checkbox-blank-circle-outline", "indigo"],
  sensor: ["mdi:chart-line", "green"],
  automation: ["mdi:creation", "purple"],
  weather: ["mdi:weather-partly-cloudy", "light-blue"],
  calendar: ["mdi:calendar", "blue"],
  device_tracker: ["mdi:map-marker", "orange"],
};

function nativeLink(id: string) {
  return needsConfirmation(id)
    ? nothing
    : html`<button class="link" @click=${() => openNativeMoreInfo(id)}><ha-icon icon="mdi:information-outline"></ha-icon>Plus d'infos dans Home Assistant</button>`;
}

function since(id: string) {
  const s = st(id);
  return s ? html`<div class="muted">Depuis ${ago(s.last_changed).replace("il y a ", "")}</div>` : nothing;
}

/** Colour presets: warm white, cool white and a few hues. */
const SWATCHES: { label: string; css: string; hs?: [number, number]; kelvin?: number }[] = [
  { label: "Blanc chaud", css: "#ffc58f", kelvin: 2700 },
  { label: "Blanc neutre", css: "#fff1e0", kelvin: 4000 },
  { label: "Blanc froid", css: "#e6efff", kelvin: 6000 },
  { label: "Rouge", css: "hsl(0 90% 55%)", hs: [0, 90] },
  { label: "Orange", css: "hsl(28 95% 55%)", hs: [28, 95] },
  { label: "Jaune", css: "hsl(50 95% 55%)", hs: [50, 95] },
  { label: "Vert", css: "hsl(130 70% 45%)", hs: [130, 70] },
  { label: "Cyan", css: "hsl(185 80% 50%)", hs: [185, 80] },
  { label: "Bleu", css: "hsl(225 85% 58%)", hs: [225, 85] },
  { label: "Violet", css: "hsl(275 75% 60%)", hs: [275, 75] },
  { label: "Rose", css: "hsl(330 85% 62%)", hs: [330, 85] },
];

export function openLight(id: string): void {
  openPopup({
    title: nameOf(id),
    icon: "mdi:lightbulb",
    color: "amber",
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const on = isActive(s);
      const modes = (s.attributes.supported_color_modes as string[] | undefined) ?? [];
      const pct = brightnessPercent(s) ?? 0;
      const kMin = Number(s.attributes.min_color_temp_kelvin ?? 2000);
      const kMax = Number(s.attributes.max_color_temp_kelvin ?? 6500);
      const kelvin = Number(s.attributes.color_temp_kelvin ?? (kMin + kMax) / 2);
      const colour = modes.some((m) => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m));
      const effects = (s.attributes.effect_list as string[] | undefined) ?? [];
      return html`
        <button class="big-toggle ${on ? "on" : ""}" aria-pressed=${String(on)} @click=${() => toggle(id, nameOf(id))}>
          <span>${isUnavailable(s) ? "Indisponible" : on ? "Allumée" : "Éteinte"}</span><span class="switch"></span>
        </button>
        ${modes.some((m) => m !== "onoff")
          ? html`<label class="slider-block">
              <span class="label"><span>Luminosité</span><span>${on ? `${pct} %` : "—"}</span></span>
              <input class="fat" type="range" min="1" max="100" .value=${String(Math.max(1, pct))}
                style="background: linear-gradient(90deg, rgb(var(--rgb-amber)) ${on ? pct : 0}%, var(--kh-card-2) ${on ? pct : 0}%)"
                @change=${(e: Event) => setBrightness(id, Number((e.target as HTMLInputElement).value))} />
            </label>`
          : nothing}
        ${modes.includes("color_temp")
          ? html`<label class="slider-block">
              <span class="label"><span>Température</span><span>${formatNumber(kelvin, 0)} K</span></span>
              <input class="fat" type="range" min=${kMin} max=${kMax} step="50" .value=${String(kelvin)}
                style="background: linear-gradient(90deg, #ff9a3c, #ffd9a8 45%, #f4f7ff 75%, #b9d3ff)"
                @change=${(e: Event) => setColorTemp(id, Number((e.target as HTMLInputElement).value))} />
            </label>`
          : nothing}
        ${colour || modes.includes("color_temp")
          ? html`<div class="swatches" role="group" aria-label="Couleurs">
              ${SWATCHES.filter((w) => (w.hs ? colour : modes.includes("color_temp"))).map(
                (w) => html`<button class="swatch" style="background:${w.css}" aria-label=${w.label} title=${w.label}
                  @click=${() => (w.hs ? setHue(id, w.hs) : setColorTemp(id, w.kelvin!))}></button>`,
              )}
            </div>`
          : nothing}
        ${effects.length
          ? html`<div class="chips" role="group" aria-label="Effets">
              ${effects.map(
                (e) => html`<button class="chip ${s.attributes.effect === e ? "active" : ""}" @click=${() => setEffect(id, e)}>${e}</button>`,
              )}
            </div>`
          : nothing}
        ${nativeLink(id)}
      `;
    },
  });
}

function openMedia(id: string): void {
  const tv = st(id)?.attributes.device_class === "tv" || id.includes("tv");
  openPopup({
    title: nameOf(id),
    icon: tv ? "mdi:television" : "mdi:speaker",
    color: "blue",
    watch: [id],
    body: () => html`<kh-media-card entity-id=${id} kind=${tv ? "tv" : "music"} icon=${tv ? nothing : id.includes("spotify") ? nothing : "mdi:speaker"}></kh-media-card>
      ${since(id)} ${nativeLink(id)}`,
  });
}

/** Numeric sensor: big value, then 24 h of history. */
function openSensor(id: string): void {
  openPopup({
    title: nameOf(id),
    icon: "mdi:chart-line",
    color: "green",
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const unit = (s.attributes.unit_of_measurement as string | undefined) ?? "";
      const v = Number(s.state);
      return html`
        <div class="hero-value">${isNaN(v) ? stateLabel(store.hass!, s) : formatNumber(v, Math.abs(v) < 10 ? 1 : 0)}<small>${unit}</small></div>
        ${since(id)}
        ${!isNaN(v) ? html`<kh-sparkline .entities=${[{ entity: id, label: "24 h", color: "var(--rgb-green)", unit }]}></kh-sparkline>` : nothing}
        ${nativeLink(id)}
      `;
    },
  });
}

/** Anything else: state, since when, a toggle when it can be toggled. */
function openGeneric(id: string): void {
  const [icon, color] = DOMAIN_LOOK[id.split(".")[0]] ?? ["mdi:information-outline", "grey"];
  openPopup({
    title: nameOf(id),
    icon,
    color,
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const on = isActive(s);
      return html`
        ${canToggle(id)
          ? html`<button class="big-toggle ${on ? "on" : ""}" aria-pressed=${String(on)} @click=${() => toggle(id, nameOf(id))}>
              <span>${stateLabel(store.hass!, s)}</span><span class="switch"></span>
            </button>`
          : html`<div class="hero-value" style="font-size:1.75rem">${stateLabel(store.hass!, s)}</div>`}
        ${since(id)}
        ${nativeLink(id)}
      `;
    },
  });
}

export function openDetails(id: string): void {
  const domain = id.split(".")[0];
  const s = st(id);
  if (domain === "light") return openLight(id);
  if (domain === "media_player") return openMedia(id);
  if (domain === "person") return openPerson(id.replace("person.", ""));
  if (domain === "device_tracker") return openTracker(id);
  if (domain === "sensor" && s && !isNaN(Number(s.state))) return openSensor(id);
  return openGeneric(id);
}
