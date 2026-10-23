import { css, svg, type SVGTemplateResult } from "lit";
import type { Room } from "../rooms.ts";

/**
 * Room scenes in the style of the Google weather frog: flat shapes without
 * outlines, soft colours, and the frog living in each room (asleep at night
 * once the lights are off). The window shows the sky in the colour of the
 * weather frog of the moment; the room's lamp glows while it is lit.
 *
 * Scene: 800 × 240, floor at y = 196, drawn at the card's height and
 * anchored bottom-right; wall and floor run on past the left edge so a wide
 * card never shows a gap, a narrow one crops the left part.
 */

type Kind = "living" | "bedroom" | "kitchen" | "bathroom" | "toilet" | "hallway" | "office" | "lab" | "generic";

const RULES: [RegExp, Kind][] = [
  [/salon|s[eé]jour|living|sofa|couch/, "living"],
  [/chambre|bed|dodo/, "bedroom"],
  [/cuisine|kitchen|silverware|chef|fork/, "kitchen"],
  [/bain|bath|douche|shower/, "bathroom"],
  [/toilet|wc/, "toilet"],
  [/couloir|entr[ée]e|hall|door|garage/, "hallway"],
  [/bureau|office|desk|monitor/, "office"],
  [/labo|flask|atelier|server/, "lab"],
];

export function roomKind(r: Pick<Room, "id" | "name" | "icon">): Kind {
  const key = `${r.id} ${r.name} ${r.icon}`.toLowerCase();
  return RULES.find(([re]) => re.test(key))?.[1] ?? "generic";
}

// The frog's colours.
const G = "#4cbb6c", GS = "#379c55", BELLY = "#c4e8a4", INK = "#22302b", CHEEK = "#f49ab0";

type Pose = "sit" | "sleep" | "bath" | "stand";

/** The frog; (x, y) = bottom centre, `hand` = what it holds, drawn in front. */
export function frog(x: number, y: number, s: number, pose: Pose, hand?: SVGTemplateResult, flip = false) {
  const eyes =
    pose === "sleep"
      ? svg`<path d="M-17 -57q5 4 10 0M7 -57q5 4 10 0" stroke=${INK} stroke-width="2.2" fill="none" stroke-linecap="round" />`
      : svg`<circle cx="-12" cy="-59" r="6.5" fill="#fff" /><circle cx="12" cy="-59" r="6.5" fill="#fff" />
          <circle cx="-10.5" cy="-58.5" r="3.4" fill=${INK} /><circle cx="13.5" cy="-58.5" r="3.4" fill=${INK} />
          <circle cx="-9.5" cy="-60" r="1.1" fill="#fff" /><circle cx="14.5" cy="-60" r="1.1" fill="#fff" />`;
  const head = svg`
    <ellipse cx="0" cy="-45" rx="26" ry="18" fill=${G} />
    <circle cx="-12" cy="-58" r="10" fill=${G} /><circle cx="12" cy="-58" r="10" fill=${G} />
    ${eyes}
    <path d=${pose === "sleep" ? "M-5 -40q5 2 10 0" : "M-9 -41q9 7 18 0"} stroke=${INK} stroke-width="2.2" fill="none" stroke-linecap="round" />
    <ellipse cx="-17" cy="-42" rx="4.5" ry="2.6" fill=${CHEEK} opacity="0.75" /><ellipse cx="17" cy="-42" rx="4.5" ry="2.6" fill=${CHEEK} opacity="0.75" />`;
  const body =
    pose === "bath" || pose === "sleep"
      ? svg``
      : svg`
        <ellipse cx="-14" cy="-3" rx="13" ry="5" fill=${GS} /><ellipse cx="14" cy="-3" rx="13" ry="5" fill=${GS} />
        <path d=${pose === "stand" ? "M-17 -6c-4-14-2-30 6-36h22c8 6 10 22 6 36z" : "M-22 -8c-4-16 2-32 14-36h16c12 4 18 20 14 36z"} fill=${G} />
        <ellipse cx="0" cy="-20" rx="12" ry="12" fill=${BELLY} />
        <ellipse cx="-20" cy="-24" rx="5" ry="10" fill=${GS} transform="rotate(20 -20 -24)" />
        <ellipse cx="20" cy="-24" rx="5" ry="10" fill=${GS} transform="rotate(-20 20 -24)" />`;
  return svg`<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${body}${head}${hand ?? svg``}</g>`;
}

/** Window on the outside: the weather frog's sky colour, sun or moon. */
export function window_(x: number, y: number, w: number, h: number, sky: string, night: boolean, frame = "#f6efe2") {
  return svg`<g class="window">
    <rect x=${x - 7} y=${y - 7} width=${w + 14} height=${h + 14} rx="8" fill=${frame} />
    <rect x=${x} y=${y} width=${w} height=${h} rx="4" fill="rgb(${sky})" />
    <rect x=${x} y=${y + h * 0.6} width=${w} height=${h * 0.4} fill="rgb(255 255 255 / 0.18)" />
    ${night
      ? svg`<circle cx=${x + w * 0.7} cy=${y + h * 0.28} r="9" fill="#fff4c9" /><circle cx=${x + w * 0.7 + 5} cy=${y + h * 0.28 - 3} r="8" fill="rgb(${sky})" />
          <circle cx=${x + w * 0.22} cy=${y + h * 0.2} r="1.5" fill="#fff" /><circle cx=${x + w * 0.4} cy=${y + h * 0.45} r="1.2" fill="#fff" />`
      : svg`<circle cx=${x + w * 0.72} cy=${y + h * 0.3} r="10" fill="#ffe27a" />
          <ellipse cx=${x + w * 0.3} cy=${y + h * 0.5} rx="16" ry="7" fill="#fff" opacity="0.9" />`}
    <rect x=${x + w / 2 - 2.5} y=${y} width="5" height=${h} fill=${frame} />
    <rect x=${x} y=${y + h / 2 - 2.5} width=${w} height="5" fill=${frame} />
    <rect x=${x - 12} y=${y + h + 5} width=${w + 24} height="7" rx="3" fill=${frame} />
  </g>`;
}

/** A lamp's light: a soft warm halo. */
export const glow = (x: number, y: number, r: number) => svg`<circle class="glow" cx=${x} cy=${y} r=${r} fill="url(#kh-glow)" />`;

export const plant = (x: number, y: number, s = 1) => svg`<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-12 0h24l-3-20h-18z" fill="#e07a5f" />
  <path d="M0 -20c-4-18-16-24-24-22c6 6 12 14 24 22z" fill="#5aa469" />
  <path d="M0 -20c2-22 14-30 22-30c-4 10-10 22-22 30z" fill="#6cbf7a" />
  <path d="M0 -20c-2-16 0-30 4-38c4 10 2 26-4 38z" fill="#4e9a5e" />
</g>`;

const lampShade = (d: string, lit: boolean, off = "#efe3cf") => svg`<path d=${d} fill=${lit ? "#ffe08a" : off} />`;

interface Scene {
  wall: string;
  wall2: string;
  floor: string;
  floor2: string;
  draw: (lit: boolean, night: boolean, sky: string) => SVGTemplateResult;
}

const asleep = (lit: boolean, night: boolean) => night && !lit;

const SCENES: Record<Kind, Scene> = {
  living: {
    wall: "#e6a873", wall2: "#d39260", floor: "#9c6b4a", floor2: "#8a5d3f",
    draw: (lit, night, sky) => svg`
      ${window_(372, 34, 92, 96, sky, night)}
      <rect x="512" y="40" width="58" height="44" rx="4" fill="#f6efe2" /><rect x="518" y="46" width="46" height="32" rx="2" fill="#7fb4c9" />
      <path d="M518 78l14-14 10 8 8-10 14 16z" fill="#5aa469" />
      <ellipse cx="610" cy="214" rx="150" ry="12" fill="#c9785a" opacity="0.55" />
      <rect x="492" y="120" width="210" height="46" rx="18" fill="#3f7fb5" />
      <rect x="520" y="126" width="34" height="26" rx="8" fill="#f2c14e" transform="rotate(-8 537 139)" />
      ${frog(612, 154, 1.19, asleep(lit, night) ? "sleep" : "sit", svg`<rect x="-8" y="-34" width="16" height="12" rx="3" fill="#e9eef2" /><rect x="-3" y="-38" width="6" height="5" fill="#9fb3bf" />`)}
      <rect x="480" y="150" width="234" height="40" rx="16" fill="#4a90c8" />
      <rect x="470" y="132" width="34" height="58" rx="14" fill="#3f7fb5" /><rect x="690" y="132" width="34" height="58" rx="14" fill="#3f7fb5" />
      <rect x="500" y="188" width="10" height="10" fill="#5b3b28" /><rect x="684" y="188" width="10" height="10" fill="#5b3b28" />
      <rect x="748" y="58" width="5" height="138" fill="#4a3428" /><ellipse cx="750" cy="198" rx="16" ry="4" fill="#4a3428" />
      ${lit ? glow(750, 60, 190) : svg``}
      ${lampShade("M728 40h44l10 26h-64z", lit)}
      ${plant(450, 196, 1.1)}`,
  },
  bedroom: {
    wall: "#8d9bd6", wall2: "#7a88c4", floor: "#a77a55", floor2: "#946a48",
    draw: (lit, night, sky) => svg`
      ${window_(372, 30, 88, 92, sky, night)}
      <ellipse cx="600" cy="214" rx="140" ry="11" fill="#6b5aa0" opacity="0.45" />
      <rect x="476" y="96" width="22" height="100" rx="8" fill="#6a4a35" />
      <rect x="490" y="150" width="226" height="34" rx="8" fill="#f4efe6" />
      <rect x="490" y="176" width="226" height="14" rx="4" fill="#6a4a35" />
      <rect x="500" y="132" width="56" height="24" rx="12" fill="#ffffff" />
      ${asleep(lit, night)
        ? svg`${frog(530, 160, 0.94, "sleep")}<text x="560" y="104" class="zz">z</text><text x="576" y="88" class="zz small">z</text>`
        : frog(560, 156, 1.0, "sit", svg`<rect x="-14" y="-30" width="28" height="18" rx="2" fill="#e85d75" /><rect x="-1" y="-30" width="2" height="18" fill="#c2405a" />`)}
      <path d="M${asleep(lit, night) ? 548 : 590} 150h126a8 8 0 0 1 8 8v24h-${asleep(lit, night) ? 142 : 100}c-6-10-6-24 8-32z" fill="#f2b84b" />
      <path d="M600 162h110M610 174h100" stroke="#e3a43a" stroke-width="3" stroke-linecap="round" />
      <rect x="738" y="148" width="50" height="48" rx="6" fill="#6a4a35" /><rect x="744" y="166" width="38" height="4" rx="2" fill="#57392a" />
      <rect x="760" y="122" width="5" height="26" fill="#57392a" />
      ${lit ? glow(762, 108, 170) : svg``}
      ${lampShade("M746 100h32l6 22h-44z", lit)}`,
  },
  kitchen: {
    wall: "#7cbfa4", wall2: "#6aad92", floor: "#d9d2c3", floor2: "#c9c1b0",
    draw: (lit, night, sky) => svg`
      ${window_(372, 30, 86, 84, sky, night)}
      <rect x="480" y="30" width="200" height="52" rx="6" fill="#f6efe2" />
      <path d="M546 30v52M612 30v52" stroke="#e4d8c4" stroke-width="3" />
      <rect x="500" y="56" width="20" height="4" rx="2" fill="#c9b79a" /><rect x="568" y="56" width="20" height="4" rx="2" fill="#c9b79a" /><rect x="634" y="56" width="20" height="4" rx="2" fill="#c9b79a" />
      <rect x="480" y="96" width="300" height="40" fill="url(#kh-tiles)" opacity="0.4" />
      <rect x="560" y="112" width="52" height="22" rx="6" fill="#58606b" /><rect x="556" y="108" width="60" height="6" rx="3" fill="#6b7480" />
      <path d="M576 104c-4-8 4-10 0-18M590 102c-4-8 4-10 0-18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7" />
      ${asleep(lit, night)
        ? svg``
        : frog(668, 136, 1.06, "stand", svg`<path d="M24 -24l26 -4" stroke="#c9a06b" stroke-width="4" stroke-linecap="round" /><path d="M-14 -70h28v-12a14 12 0 0 0-28 0z" fill="#fff" /><rect x="-16" y="-72" width="32" height="6" rx="3" fill="#f0f0f0" />`, true)}
      <rect x="470" y="134" width="320" height="10" rx="3" fill="#f6efe2" />
      <rect x="476" y="144" width="308" height="52" fill="#e8754f" />
      <path d="M548 144v52M628 144v52M708 144v52" stroke="#cf6340" stroke-width="3" />
      <rect x="506" y="160" width="20" height="4" rx="2" fill="#f6efe2" /><rect x="580" y="160" width="20" height="4" rx="2" fill="#f6efe2" /><rect x="660" y="160" width="20" height="4" rx="2" fill="#f6efe2" />
      <rect x="742" y="0" width="3" height="40" fill="#4a3428" />
      ${lit ? glow(744, 56, 170) : svg``}
      ${lampShade("M726 40h36l-8 18h-20z", lit, "#f6efe2")}`,
  },
  bathroom: {
    wall: "#69b6cf", wall2: "#57a3bd", floor: "#e6e1d6", floor2: "#d3cdbf",
    draw: (lit, night, sky) => svg`
      <rect x="-3200" y="0" width="4000" height="196" fill="url(#kh-tiles)" opacity="0.3" />
      ${window_(372, 26, 70, 70, sky, night)}
      <rect x="700" y="40" width="64" height="80" rx="32" fill="#f6efe2" /><rect x="706" y="46" width="52" height="68" rx="26" fill="#bfe6f2" />
      <path d="M716 64l18-12M716 80l28-20" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7" />
      <rect x="696" y="130" width="72" height="14" rx="6" fill="#ffffff" /><rect x="726" y="144" width="12" height="52" fill="#ffffff" />
      <rect x="500" y="40" width="5" height="100" fill="#9aa5ad" /><path d="M500 42h28a6 6 0 0 1 6 6v6" stroke="#9aa5ad" stroke-width="5" fill="none" />
      <ellipse cx="534" cy="56" rx="12" ry="4" fill="#9aa5ad" />
      ${asleep(lit, night) ? svg`` : frog(585, 166, 1.12, "bath")}
      <circle cx="540" cy="140" r="13" fill="#fff" /><circle cx="560" cy="132" r="10" fill="#fff" /><circle cx="628" cy="136" r="12" fill="#fff" /><circle cx="648" cy="142" r="9" fill="#fff" />
      <circle class="bubble" cx="604" cy="98" r="6" fill="#fff" /><circle class="bubble late" cx="620" cy="84" r="4" fill="#fff" />
      <path d="M470 142h220v16a38 38 0 0 1-38 38H508a38 38 0 0 1-38-38z" fill="#ffffff" />
      <path d="M470 142h220v8H470z" fill="#e8eef0" />
      <path d="M664 134c4-8 16-8 18 0c6-2 10 4 6 8h-24c-4-2-2-8 0-8z" fill="#ffd34d" /><circle cx="680" cy="130" r="1.6" fill=${INK} />
      ${lit ? glow(620, 10, 200) : svg``}
      <rect x="599" y="0" width="2" height="10" fill="#9aa5ad" />${lampShade("M588 10h24l-4 10h-16z", lit, "#f6efe2")}
      ${plant(450, 196, 0.9)}`,
  },
  toilet: {
    wall: "#d4a473", wall2: "#c19163", floor: "#e6e1d6", floor2: "#d3cdbf",
    draw: (lit, night, sky) => svg`
      ${window_(392, 30, 64, 64, sky, night)}
      <rect x="520" y="40" width="52" height="40" rx="4" fill="#f6efe2" /><circle cx="546" cy="60" r="12" fill="#e07a5f" /><path d="M536 68l10-14 10 14z" fill="#5aa469" />
      <rect x="640" y="96" width="60" height="50" rx="8" fill="#ffffff" />
      <path d="M626 146h88v10a40 34 0 0 1-40 34h-8a40 34 0 0 1-40-34z" fill="#ffffff" /><path d="M650 188h40l-4 8h-32z" fill="#e8eef0" />
      <rect x="618" y="140" width="104" height="8" rx="4" fill="#e8eef0" />
      <rect x="742" y="112" width="26" height="6" rx="3" fill="#9aa5ad" /><circle cx="755" cy="130" r="13" fill="#fff" /><circle cx="755" cy="130" r="4" fill="#e6e1d6" />
      <rect x="560" y="150" width="34" height="46" rx="4" fill="#5aa469" /><rect x="566" y="142" width="22" height="10" rx="3" fill="#f6efe2" />
      ${lit ? glow(600, 12, 170) : svg``}
      <rect x="599" y="0" width="2" height="14" fill="#9aa5ad" />${lampShade("M588 14h24l-4 10h-16z", lit, "#f6efe2")}
      ${plant(476, 196, 1)}`,
  },
  hallway: {
    wall: "#c094aa", wall2: "#ad8198", floor: "#9c6b4a", floor2: "#8a5d3f",
    draw: (lit, night) => svg`
      <ellipse cx="600" cy="214" rx="110" ry="10" fill="#7a4f8c" opacity="0.45" />
      <rect x="560" y="44" width="92" height="152" rx="6" fill="#f6efe2" /><rect x="568" y="52" width="76" height="144" rx="4" fill="#3f7fb5" />
      <rect x="578" y="64" width="56" height="50" rx="4" fill="#4a90c8" /><rect x="578" y="124" width="56" height="58" rx="4" fill="#4a90c8" />
      <circle cx="632" cy="124" r="5" fill="#f2c14e" />
      <rect x="464" y="62" width="70" height="8" rx="4" fill="#6a4a35" />
      <path d="M478 70c-10 20-12 60-2 84h28c8-24 6-64-4-84z" fill="#f2c14e" /><path d="M486 74h12v8h-12z" fill="#e0ad35" />
      <path d="M520 70v70" stroke="#e85d75" stroke-width="4" /><path d="M508 140h24l-12 14z" fill="#e85d75" />
      ${asleep(lit, night)
        ? svg``
        : frog(700, 196, 1.06, "stand", svg`<path d="M22 -22l6 -38" stroke="#4a3428" stroke-width="3" stroke-linecap="round" /><path d="M-6 -58a34 20 0 0 1 68 0z" fill="#e85d75" />`, true)}
      <rect x="744" y="54" width="22" height="12" rx="4" fill="#6a4a35" />
      ${lit ? glow(755, 76, 170) : svg``}
      ${lampShade("M742 66h26l-4 16h-18z", lit, "#f6efe2")}`,
  },
  office: {
    wall: "#5d7bb0", wall2: "#4f6c9f", floor: "#a77a55", floor2: "#946a48",
    draw: (lit, night, sky) => svg`
      ${window_(372, 30, 86, 86, sky, night)}
      <rect x="560" y="70" width="96" height="58" rx="5" fill="#2b2f3a" /><rect x="566" y="76" width="84" height="46" rx="3" fill="#4fc3f7" opacity="0.85" />
      <path d="M574 88h40M574 98h56M574 108h30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7" /><rect x="604" y="128" width="8" height="6" fill="#2b2f3a" />
      ${asleep(lit, night) ? svg`` : frog(608, 178, 1.0, "sit")}
      <rect x="490" y="132" width="250" height="10" rx="3" fill="#8a5d3f" /><rect x="500" y="142" width="10" height="54" fill="#6a4a35" /><rect x="720" y="142" width="10" height="54" fill="#6a4a35" />
      <path d="M702 132l-8-30 16-14" stroke="#2b2f3a" stroke-width="4" fill="none" stroke-linecap="round" />
      ${lit ? glow(712, 92, 170) : svg``}
      ${lampShade("M704 78l18-8 8 16-16 8z", lit)}`,
  },
  lab: {
    wall: "#3d4d74", wall2: "#334166", floor: "#5b5f6b", floor2: "#4f525d",
    draw: (lit, night, sky) => svg`
      ${window_(372, 30, 76, 76, sky, night, "#c8cfdb")}
      <rect x="690" y="40" width="80" height="156" rx="6" fill="#262b38" />
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<rect x="698" y=${52 + i * 23} width="64" height="17" rx="3" fill="#323849" />
        <circle class="led" style="animation-delay:${i * 0.37}s" cx="708" cy=${60 + i * 23} r="2.6" fill="#5ef08a" />
        <circle class="led" style="animation-delay:${i * 0.61 + 0.2}s" cx="716" cy=${60 + i * 23} r="2.6" fill="#4fc3f7" />
        <rect x="726" y=${58 + i * 23} width="28" height="4" rx="2" fill="#4a5168" />`)}
      <rect x="500" y="80" width="70" height="46" rx="4" fill="#1d2230" /><rect x="505" y="85" width="60" height="36" rx="2" fill="#2e7d4f" />
      <path d="M511 94h20M511 102h34M511 110h14" stroke="#7dffa8" stroke-width="2.5" stroke-linecap="round" />
      <rect x="580" y="88" width="62" height="38" rx="4" fill="#1d2230" /><rect x="585" y="93" width="52" height="28" rx="2" fill="#4fc3f7" opacity="0.8" />
      ${asleep(lit, night)
        ? svg``
        : frog(560, 180, 1.0, "sit", svg`<path d="M-24 -60a24 22 0 0 1 48 0" stroke="#e85d75" stroke-width="5" fill="none" /><rect x="-30" y="-64" width="9" height="16" rx="4" fill="#e85d75" /><rect x="21" y="-64" width="9" height="16" rx="4" fill="#e85d75" />`)}
      <rect x="470" y="132" width="200" height="10" rx="3" fill="#8a5d3f" /><rect x="480" y="142" width="10" height="54" fill="#6a4a35" /><rect x="650" y="142" width="10" height="54" fill="#6a4a35" />
      ${lit ? glow(600, 10, 220) : svg``}
      <rect x="599" y="0" width="2" height="10" fill="#c8cfdb" />${lampShade("M584 10h32l-6 12h-20z", lit, "#c8cfdb")}`,
  },
  generic: {
    wall: "#9f92c0", wall2: "#8c7fae", floor: "#a77a55", floor2: "#946a48",
    draw: (lit, night, sky) => svg`
      ${window_(392, 30, 86, 86, sky, night)}
      <rect x="560" y="120" width="120" height="44" rx="16" fill="#e85d75" />
      ${frog(620, 156, 1.06, asleep(lit, night) ? "sleep" : "sit", svg`<rect x="-14" y="-30" width="28" height="18" rx="2" fill="#4a90c8" />`)}
      <rect x="548" y="150" width="144" height="34" rx="14" fill="#f07087" />
      <rect x="560" y="184" width="8" height="12" fill="#5b3b28" /><rect x="672" y="184" width="8" height="12" fill="#5b3b28" />
      <rect x="740" y="60" width="5" height="136" fill="#4a3428" />
      ${lit ? glow(742, 62, 180) : svg``}
      ${lampShade("M722 42h40l8 24h-56z", lit)}
      ${plant(500, 196, 1.1)}`,
  },
};

/**
 * The scene of a room. `lit`: its lights are on; `night`: the sun is down;
 * `sky`: "r, g, b" of the weather frog's sky; `compact`: small tiles, without
 * the window (it would sit under the text).
 */
export function roomScene(r: Pick<Room, "id" | "name" | "icon">, lit: boolean, night: boolean, sky = "40, 130, 221", compact = false) {
  const scene = SCENES[roomKind(r)];
  const mood = lit ? (night ? "lit night" : "lit") : night ? "night" : "day";
  return svg`<svg class="room-scene ${mood} ${compact ? "compact" : ""}" viewBox="0 0 800 240" aria-hidden="true">
    <defs>
      <radialGradient id="kh-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75" /><stop offset="0.45" stop-color="#ffc35a" stop-opacity="0.28" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" /></radialGradient>
      <pattern id="kh-tiles" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-width="1.5" /></pattern>
      <pattern id="kh-planks" width="90" height="22" patternUnits="userSpaceOnUse"><path d="M0 0H90M30 0V11M75 11V22M0 11H90" fill="none" stroke="rgb(0 0 0 / 0.12)" stroke-width="2" /></pattern>
    </defs>
    <rect x="-3200" y="-400" width="4000" height="596" fill=${scene.wall} />
    <rect x="-3200" y="150" width="4000" height="46" fill=${scene.wall2} />
    <rect x="-3200" y="188" width="4000" height="8" fill=${scene.floor2} />
    <rect x="-3200" y="196" width="4000" height="60" fill=${scene.floor} />
    <rect x="-3200" y="196" width="4000" height="60" fill="url(#kh-planks)" />
    ${scene.draw(lit, night, sky)}
    <rect class="shade-night" x="-3200" y="-400" width="4000" height="700" />
  </svg>`;
}

/**
 * The whole house, cut open like a doll's house: one cell per room in the
 * colours of its scene, lit when its lights are on; the frog in a lit room,
 * asleep in a bedroom at night, or sitting in the garden.
 */
export function houseScene(rooms: { room: Pick<Room, "id" | "name" | "icon">; lit: boolean }[], night: boolean, sky = "40, 130, 221") {
  const n = Math.max(1, rooms.length);
  const cols = n <= 3 ? n : Math.ceil(n / 2), rows = n <= 3 ? 1 : 2;
  const X0 = 470, X1 = 770, Y0 = 84, Y1 = 206, gap = 6;
  const cw = (X1 - X0 - gap * (cols + 1)) / cols, ch = (Y1 - Y0 - gap * (rows + 1)) / rows;
  const cell = (i: number) => ({ x: X0 + gap + (i % cols) * (cw + gap), y: Y0 + gap + Math.floor(i / cols) * (ch + gap) });
  // Where the frog is: in a lit room, else asleep in a bedroom at night, else in the garden.
  let frogAt = rooms.findIndex((r) => r.lit);
  const sleeping = frogAt < 0 && night;
  if (sleeping) frogAt = rooms.findIndex((r) => roomKind(r.room) === "bedroom");
  return svg`<svg class="room-scene ${night ? "night-sky" : "day-sky"}" viewBox="0 0 800 240" aria-hidden="true">
    <defs>
      <radialGradient id="kh-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.85" /><stop offset="0.5" stop-color="#ffc35a" stop-opacity="0.3" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" /></radialGradient>
      ${rooms.map((_, i) => {
        const c = cell(i);
        return svg`<clipPath id="kh-cell-${i}"><rect x=${c.x} y=${c.y} width=${cw} height=${ch} rx="3" /></clipPath>`;
      })}
    </defs>
    <rect x="-3200" y="-400" width="4000" height="610" fill=${night ? "#18204a" : `rgb(${sky})`} />
    ${night
      ? svg`<circle cx="360" cy="46" r="16" fill="#fff4c9" /><circle cx="368" cy="40" r="14" fill="#18204a" />
          ${[[60, 30], [140, 70], [220, 24], [300, 90], [420, 60], [-80, 50], [-200, 30], [-320, 80], [260, 140], [100, 120]].map(
            ([x, y], k) => svg`<circle class="twinkle" style="animation-delay:${k * 0.4}s" cx=${x} cy=${y} r=${k % 3 ? 1.4 : 2} fill="#fff" />`,
          )}`
      : svg`<circle cx="380" cy="44" r="18" fill="#ffe27a" />
          <g fill="#fff" opacity="0.9"><ellipse cx="200" cy="60" rx="34" ry="12" /><ellipse cx="222" cy="52" rx="20" ry="12" />
          <ellipse cx="-60" cy="40" rx="30" ry="10" /><ellipse cx="300" cy="110" rx="24" ry="8" /></g>`}
    <ellipse cx="200" cy="230" rx="420" ry="70" fill=${night ? "#2c4a3a" : "#7fc98a"} />
    <ellipse cx="640" cy="236" rx="320" ry="60" fill=${night ? "#24402f" : "#6cbf7a"} />
    <rect x="-3200" y="206" width="4000" height="60" fill=${night ? "#2f5a3a" : "#5aa469"} />
    <!-- house -->
    <rect x="740" y="22" width="18" height="40" fill=${night ? "#5a3a3a" : "#a9524f"} />
    <path d="M450 90L620 20L790 90z" fill=${night ? "#7a3f3d" : "#d35f5b"} />
    <path d="M462 90h316v8H462z" fill=${night ? "#5a2f2e" : "#b44f4b"} />
    <rect x=${X0} y=${Y0} width=${X1 - X0} height=${Y1 - Y0} fill=${night ? "#cfc3ad" : "#f2e6d0"} />
    ${rooms.map(({ room, lit }, i) => {
      const c = cell(i);
      const sc = SCENES[roomKind(room)];
      return svg`<g clip-path="url(#kh-cell-${i})">
        <rect x=${c.x} y=${c.y} width=${cw} height=${ch} fill=${sc.wall} />
        <rect x=${c.x} y=${c.y + ch - 7} width=${cw} height="7" fill=${sc.floor} />
        ${lit
          ? svg`<circle cx=${c.x + cw / 2} cy=${c.y + 10} r=${Math.max(cw, ch) * 0.9} fill="url(#kh-glow)" />
              <rect x=${c.x + cw / 2 - 0.75} y=${c.y} width="1.5" height="7" fill="#4a3428" />
              <path d="M${c.x + cw / 2 - 7} ${c.y + 14}h14l-3 -7h-8z" fill="#ffe08a" />`
          : svg`<rect x=${c.x} y=${c.y} width=${cw} height=${ch} fill="#141a40" opacity=${night ? 0.62 : 0.12} />`}
        ${i === frogAt ? frog(c.x + cw / 2, c.y + ch - 6, Math.min(0.6, ch / 110), sleeping ? "sleep" : "sit") : svg``}
        ${i === frogAt && sleeping ? svg`<text x=${c.x + cw / 2 + 14} y=${c.y + 18} class="zz small">z</text>` : svg``}
      </g>`;
    })}
    <rect x=${X0 - 4} y=${Y1 - 2} width=${X1 - X0 + 8} height="6" fill=${night ? "#8a7d6a" : "#cdbf9f"} />
    ${frogAt < 0 ? frog(424, 210, 0.75, "sit") : svg``}
    <path d="M392 206v-26M384 180h16v-10h-16z" fill="none" stroke=${night ? "#8a7d6a" : "#f6efe2"} stroke-width="4" stroke-linejoin="round" />
    <g transform="translate(796 206)"><path d="M-12 0c-4-14 2-24 10-28c8 4 12 14 6 28z" fill=${night ? "#2c4a3a" : "#4e9a5e"} /></g>
    <g transform="translate(452 206)"><path d="M-14 0c-4-16 2-28 12-32c10 4 14 16 8 32z" fill=${night ? "#2c4a3a" : "#4e9a5e"} /></g>
  </svg>`;
}

export const roomSceneStyles = css`
  /* The parent is a size container: the furniture never gets wider than the card. */
  .room-scene {
    position: absolute;
    right: 0;
    bottom: 0;
    height: min(100%, var(--scene-max, 72cqw));
    width: auto;
    aspect-ratio: 800 / 240;
    overflow: visible;
    pointer-events: none;
  }
  .room-scene.compact .window {
    display: none;
  }
  /* Night: the room sinks into blue, less so when a lamp is on. */
  .room-scene .shade-night {
    fill: #141a40;
    opacity: 0;
    mix-blend-mode: multiply;
  }
  .room-scene.night .shade-night {
    opacity: 0.55;
  }
  .room-scene.lit.night .shade-night {
    opacity: 0.22;
  }
  .room-scene .glow {
    animation: kh-glow 5s ease-in-out infinite alternate;
  }
  .room-scene .zz {
    font: 800 22px var(--kh-font, system-ui);
    fill: #fff;
    animation: kh-zz 3s ease-in-out infinite;
  }
  .room-scene .zz.small {
    font-size: 15px;
    animation-delay: 0.8s;
  }
  .room-scene .twinkle {
    animation: kh-led 2.4s ease-in-out infinite alternate;
  }
  .room-scene .led {
    animation: kh-led 1.6s steps(2, jump-none) infinite;
  }
  .room-scene .bubble {
    animation: kh-bubble 4s ease-in-out infinite;
  }
  .room-scene .bubble.late {
    animation-delay: 1.5s;
  }
  @keyframes kh-glow {
    from { opacity: 0.75; }
    to { opacity: 1; }
  }
  @keyframes kh-zz {
    0%, 100% { opacity: 0.2; transform: translateY(4px); }
    50% { opacity: 0.9; transform: translateY(-4px); }
  }
  @keyframes kh-led {
    from { opacity: 1; }
    to { opacity: 0.25; }
  }
  @keyframes kh-bubble {
    0% { opacity: 0; transform: translateY(10px); }
    30% { opacity: 0.85; }
    100% { opacity: 0; transform: translateY(-16px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .room-scene .glow,
    .room-scene .zz,
    .room-scene .led,
    .room-scene .twinkle,
    .room-scene .bubble {
      animation: none;
    }
  }
`;
