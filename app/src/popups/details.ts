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
import { bigSlider, glyph, label, openPopup, row } from "../components/popup.ts";
import { config } from "../config.ts";
import { brightnessPercent, formatNumber, isActive, isUnavailable, stateLabel } from "../format.ts";
import { entityName } from "../rooms.ts";
import { store } from "../store.ts";
import { lightIcon } from "../v3/icons.ts";
import { ago, openPerson, openTracker } from "./index.ts";

// Every "details" in the app opens here, in one popup style (V3). HA's own
// dialog stays reachable through "Plus d'infos" at the bottom.

const st = (id: string) => store.hass?.states[id];
const nameOf = (id: string) => (store.hass ? entityName(store.hass, id, config) : id);
const sinceText = (id: string) => {
  const s = st(id);
  return s ? `Depuis ${ago(s.last_changed).replace("il y a ", "")}` : undefined;
};

const DOMAIN_LOOK: Record<string, [string, string]> = {
  light: ["bulb", "amber"],
  switch: ["plug", "light-blue"],
  fan: ["fan", "teal"],
  media_player: ["playCircle", "blue"],
  binary_sensor: ["motion", "indigo"],
  sensor: ["trend", "green"],
  automation: ["sparkle", "purple"],
  weather: ["cloud", "light-blue"],
  calendar: ["calendar", "blue"],
  device_tracker: ["pin", "orange"],
};

function nativeLink(id: string) {
  return needsConfirmation(id)
    ? nothing
    : html`<button class="btn more" type="button" @click=${() => openNativeMoreInfo(id)}>${glyph("info", 16)}Plus d'infos dans Home Assistant</button>`;
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
    icon: lightIcon(String(st(id)?.attributes.icon ?? "")),
    color: "amber",
    subtitle: () => sinceText(id),
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const on = isActive(s);
      const off = isUnavailable(s);
      const modes = (s.attributes.supported_color_modes as string[] | undefined) ?? [];
      const pct = brightnessPercent(s) ?? 0;
      const kMin = Number(s.attributes.min_color_temp_kelvin ?? 2000);
      const kMax = Number(s.attributes.max_color_temp_kelvin ?? 6500);
      const kelvin = Number(s.attributes.color_temp_kelvin ?? (kMin + kMax) / 2);
      const colour = modes.some((m) => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m));
      const effects = (s.attributes.effect_list as string[] | undefined) ?? [];
      const hs = s.attributes.hs_color as [number, number] | undefined;
      const mode = s.attributes.color_mode as string | undefined;
      // The swatch matching the current colour gets a ring.
      const current = (w: (typeof SWATCHES)[number]) =>
        on &&
        (w.kelvin
          ? mode === "color_temp" && Math.abs(kelvin - w.kelvin) < 400
          : mode !== "color_temp" && !!hs && Math.min(Math.abs(hs[0] - w.hs![0]), 360 - Math.abs(hs[0] - w.hs![0])) < 14 && hs[1] > 40);
      const shown = SWATCHES.filter((w) => (w.hs ? colour : modes.includes("color_temp")));
      return html`
        ${row({
          icon: lightIcon(String(s.attributes.icon ?? "")),
          color: on ? "amber" : "grey",
          label: off ? "Indisponible" : on ? "Allumée" : "Éteinte",
          sub: on ? [modes.some((m) => m !== "onoff") ? `${pct} %` : "", mode === "color_temp" ? `${formatNumber(kelvin, 0)} K` : ""].filter(Boolean).join(", ") || undefined : undefined,
          checked: on,
          lit: on,
          big: true,
          onClick: () => toggle(id, nameOf(id)),
        })}
        ${modes.some((m) => m !== "onoff")
          ? bigSlider({ label: "Luminosité", icon: "sun", min: 1, max: 100, raw: Math.max(1, pct), pct: (v) => v, on, onChange: (v) => setBrightness(id, v) })
          : nothing}
        ${modes.includes("color_temp")
          ? html`<div class="ctemp">
              ${label("Blanc")}
              <div class="top" aria-hidden="true"><span>Chaud</span><span class="num">${formatNumber(kelvin, 0)} K</span><span>Froid</span></div>
              <input class="range" type="range" min=${kMin} max=${kMax} step="50" .value=${String(kelvin)} aria-label="Température de blanc"
                aria-valuetext="${formatNumber(kelvin, 0)} kelvins"
                style="background: linear-gradient(90deg, #ff9a3c, #ffd9a8 45%, #f4f7ff 75%, #b9d3ff)"
                @change=${(e: Event) => setColorTemp(id, Number((e.target as HTMLInputElement).value))} />
            </div>`
          : nothing}
        ${shown.length
          ? html`${label(colour ? "Couleurs" : "Teintes de blanc")}
              <div class="swatches" role="group" aria-label="Couleurs">
                ${shown.map(
                  (w) => html`<button class="sw" type="button" style="background:${w.css}" aria-label=${w.label} title=${w.label}
                    aria-pressed=${String(current(w))} @click=${() => (w.hs ? setHue(id, w.hs) : setColorTemp(id, w.kelvin!))}></button>`,
                )}
              </div>`
          : nothing}
        ${effects.length
          ? html`${label("Effets")}
              <div class="pills" role="group" aria-label="Effets">
                ${effects.map(
                  (e) => html`<button class="pill" type="button" aria-pressed=${String(s.attributes.effect === e)} @click=${() => setEffect(id, e)}>${e}</button>`,
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
    icon: tv ? "tv" : "speaker",
    color: "blue",
    subtitle: () => sinceText(id),
    watch: [id],
    body: () => html`<kh-media-card entity-id=${id} kind=${tv ? "tv" : "music"} icon=${tv ? nothing : id.includes("spotify") ? nothing : "mdi:speaker"}></kh-media-card>
      ${nativeLink(id)}`,
  });
}

/** Numeric sensor: big value, then 24 h of history. */
function openSensor(id: string): void {
  openPopup({
    title: nameOf(id),
    icon: "trend",
    color: "green",
    subtitle: () => sinceText(id),
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const unit = (s.attributes.unit_of_measurement as string | undefined) ?? "";
      const v = Number(s.state);
      return html`
        <div class="hero ${isNaN(v) ? "word" : ""}">
          <span class="num">${isNaN(v) ? stateLabel(store.hass!, s) : formatNumber(v, Math.abs(v) < 10 ? 1 : 0)}</span><span class="u">${unit}</span>
        </div>
        ${!isNaN(v) ? html`${label("24 heures")}<kh-sparkline .entities=${[{ entity: id, label: "24 h", color: "var(--rgb-green)", unit }]}></kh-sparkline>` : nothing}
        ${nativeLink(id)}
      `;
    },
  });
}

/** Anything else: state, since when, a toggle when it can be toggled. */
function openGeneric(id: string): void {
  const [iconName, color] = DOMAIN_LOOK[id.split(".")[0]] ?? ["info", "grey"];
  openPopup({
    title: nameOf(id),
    icon: iconName,
    color,
    subtitle: () => sinceText(id),
    watch: [id],
    body: () => {
      const s = st(id);
      if (!s) return nothing;
      const on = isActive(s);
      return html`
        ${canToggle(id)
          ? row({ icon: iconName, color: on ? color : "grey", label: stateLabel(store.hass!, s), checked: on, lit: on, big: true, onClick: () => toggle(id, nameOf(id)) })
          : html`<div class="hero word"><span class="num">${stateLabel(store.hass!, s)}</span></div>`}
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
