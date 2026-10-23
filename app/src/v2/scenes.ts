import { css, svg, type SVGTemplateResult } from "lit";
import { formatNumber } from "../format.ts";
import { cat, glow, plant, window_ } from "./room-art.ts";

/**
 * Hero scenes of the theme pages, in the weather-frog style of the rooms
 * (same 800 × 240 frame, floor at y = 196, anchored bottom-right, wall and
 * ground running on past the left edge). They show live state: the TV
 * plays, the wind turbine turns with the power drawn, the meter shows it,
 * the system cat worries when something needs attention.
 */

const DEFS = svg`<defs>
  <radialGradient id="kh-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75" /><stop offset="0.45" stop-color="#ffc35a" stop-opacity="0.28" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" /></radialGradient>
  <radialGradient id="kh-tv-glow"><stop offset="0" stop-color="#b48cff" stop-opacity="0.6" /><stop offset="1" stop-color="#b48cff" stop-opacity="0" /></radialGradient>
  <linearGradient id="kh-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b5cff" /><stop offset="0.55" stop-color="#ff6fa8" /><stop offset="1" stop-color="#ffb35c" /></linearGradient>
  <pattern id="kh-planks" width="90" height="22" patternUnits="userSpaceOnUse"><path d="M0 0H90M30 0V11M75 11V22M0 11H90" fill="none" stroke="rgb(0 0 0 / 0.12)" stroke-width="2" /></pattern>
</defs>`;

function room(wall: string, wall2: string, floor: string, floor2: string) {
  return svg`
    <rect x="-3200" y="-400" width="4000" height="596" fill=${wall} />
    <rect x="-3200" y="150" width="4000" height="46" fill=${wall2} />
    <rect x="-3200" y="188" width="4000" height="8" fill=${floor2} />
    <rect x="-3200" y="196" width="4000" height="60" fill=${floor} />
    <rect x="-3200" y="196" width="4000" height="60" fill="url(#kh-planks)" />`;
}

function frame(cls: string, body: SVGTemplateResult) {
  return svg`<svg class="room-scene ${cls}" viewBox="0 0 800 240" aria-hidden="true">${DEFS}${body}
    <rect class="shade-night" x="-3200" y="-400" width="4000" height="700" /></svg>`;
}

/** Médias: the cat on the sofa with popcorn; the TV plays when something does. */
export function mediaScene(playing: boolean, night: boolean, sky: string) {
  return frame(
    `${night && !playing ? "night" : night ? "lit night" : "day"}`,
    svg`
    ${room("#6a5aa8", "#5a4b96", "#8f6446", "#7d573c")}
    ${window_(372, 34, 80, 84, sky, night)}
    ${playing ? svg`<circle cx="690" cy="110" r="190" fill="url(#kh-tv-glow)" class="glow" />` : svg``}
    <rect x="610" y="150" width="150" height="40" rx="6" fill="#3d2f5c" /><rect x="618" y="160" width="60" height="6" rx="3" fill="#2c2144" /><rect x="690" y="160" width="60" height="6" rx="3" fill="#2c2144" />
    <rect x="620" y="186" width="8" height="10" fill="#2c2144" /><rect x="742" y="186" width="8" height="10" fill="#2c2144" />
    <rect x="606" y="62" width="158" height="88" rx="8" fill="#1d1830" />
    <rect x="614" y="70" width="142" height="72" rx="4" fill=${playing ? "url(#kh-screen)" : "#2a2440"} />
    ${playing
      ? svg`<circle cx="660" cy="98" r="14" fill="#fff" opacity="0.85" /><path d="M640 142c20-30 40-30 60-10s30 10 56-12v22z" fill="#2a2440" opacity="0.35" />`
      : svg`<path d="M622 76l30 0-26 26z" fill="#fff" opacity="0.06" />`}
    <rect x="680" y="146" width="10" height="6" fill="#1d1830" />
    <rect x="776" y="96" width="18" height="100" rx="5" fill="#2c2144" /><circle cx="785" cy="120" r="6" fill="#4a3d6e" /><circle cx="785" cy="150" r="9" fill="#4a3d6e" />
    ${playing ? svg`<path class="note" d="M792 70v-18l10-3v18" stroke="#fff" stroke-width="3" fill="none" /><circle class="note" cx="789" cy="70" r="4" fill="#fff" />` : svg``}
    <ellipse cx="530" cy="214" rx="110" ry="10" fill="#4a3d6e" opacity="0.5" />
    <rect x="452" y="118" width="40" height="70" rx="16" fill="#e85d75" />
    ${cat(520, 156, 1.0, night && !playing ? "nap" : "sit", svg`
      <path d="M14 -34h22l-4 22h-14z" fill="#fff" /><path d="M18 -34l2 22M26 -34v22M33 -34l-2 22" stroke="#e85d75" stroke-width="3" />
      <circle cx="19" cy="-37" r="4" fill="#fff6d6" /><circle cx="26" cy="-39" r="4.5" fill="#fff6d6" /><circle cx="32" cy="-36" r="4" fill="#fff6d6" />`, true)}
    <rect x="462" y="150" width="128" height="38" rx="14" fill="#f07087" />
    <rect x="470" y="186" width="8" height="10" fill="#5b3b28" /><rect x="574" y="186" width="8" height="10" fill="#5b3b28" />
    ${plant(424, 196, 1)}`,
  );
}

/**
 * Énergie: outdoors, a wind turbine that turns faster with the power drawn,
 * the line to the house and the Linky meter showing the watts, the cat
 * reading it.
 */
export function energyScene(watts: number, night: boolean, sky: string) {
  // One turn in 8 s at rest, down to 0.9 s at 3 kW and more.
  const w = isNaN(watts) ? 0 : Math.max(0, watts);
  const spin = Math.max(0.9, 8 - (w / 3000) * 7.1);
  return frame(
    night ? "night" : "day",
    svg`
    <rect x="-3200" y="-400" width="4000" height="610" fill=${night ? "#18204a" : `rgb(${sky})`} />
    ${night
      ? svg`<circle cx="360" cy="40" r="14" fill="#fff4c9" /><circle cx="367" cy="35" r="12" fill="#18204a" />
          ${[[80, 40], [200, 80], [300, 30], [-60, 60], [460, 24]].map(([x, y]) => svg`<circle cx=${x} cy=${y} r="1.6" fill="#fff" />`)}`
      : svg`<circle cx="380" cy="40" r="16" fill="#ffe27a" /><ellipse cx="220" cy="56" rx="32" ry="11" fill="#fff" opacity="0.9" />`}
    <ellipse cx="300" cy="232" rx="430" ry="70" fill=${night ? "#2c4a3a" : "#7fc98a"} />
    <rect x="-3200" y="206" width="4000" height="60" fill=${night ? "#2f5a3a" : "#5aa469"} />
    <!-- wind turbine -->
    <path d="M472 206l4-120h6l4 120z" fill="#f2f2f2" />
    <g class="rotor" style="animation-duration:${spin.toFixed(2)}s; transform-origin: 479px 86px">
      <path d="M479 86l-4-62c0-4 8-4 8 0z" fill="#ffffff" />
      <path d="M479 86l-4-62c0-4 8-4 8 0z" fill="#ffffff" transform="rotate(120 479 86)" />
      <path d="M479 86l-4-62c0-4 8-4 8 0z" fill="#ffffff" transform="rotate(240 479 86)" />
      <circle cx="479" cy="86" r="6" fill="#d9dde3" />
    </g>
    <!-- power line -->
    <path d="M560 206V70M548 82h24M550 96h20" stroke="#6a4a35" stroke-width="5" stroke-linecap="round" />
    <path d="M572 82c40 20 70 24 104 36" stroke="#2b2f3a" stroke-width="2" fill="none" />
    <!-- house wall with the meter -->
    <rect x="660" y="60" width="160" height="146" fill=${night ? "#c9b9a0" : "#f2e6d0"} />
    <path d="M650 64l90-46 90 46z" fill=${night ? "#7a3f3d" : "#d35f5b"} />
    ${night ? svg`<rect x="770" y="96" width="34" height="34" rx="3" fill="#ffd27a" />` : svg`<rect x="770" y="96" width="34" height="34" rx="3" fill="#8ecae6" />`}
    <rect x="676" y="100" width="62" height="80" rx="8" fill="#d6e38a" /><rect x="682" y="106" width="50" height="22" rx="3" fill="#24361f" />
    <text x="707" y="122" text-anchor="middle" class="lcd">${isNaN(watts) ? "—" : `${formatNumber(watts, 0)} W`}</text>
    <circle cx="694" cy="142" r="5" fill="#9fb35a" /><circle cx="720" cy="142" r="5" fill="#9fb35a" /><rect x="688" y="156" width="38" height="14" rx="3" fill="#bccb6d" />
    <path d="M738 120h-14" stroke="#2b2f3a" stroke-width="2" />
    ${cat(620, 206, 0.95, "stand", svg`<rect x="12" y="-40" width="22" height="28" rx="3" fill="#f6efe2" /><path d="M16 -32h14M16 -26h14M16 -20h10" stroke="#b8b1a3" stroke-width="2" />`)}
    <path class="bolt" d="M598 108l-10 20h10l-6 18 18-24h-10l8-14z" fill="#ffd34d" />`,
  );
}

/**
 * Système: the homelab corner, racks blinking, the router sending waves, the
 * HA screen; the cat relaxes with a coffee when all is well, holds a wrench
 * under a warning sign when something needs attention.
 */
export function systemScene(ok: boolean, night: boolean) {
  return frame(
    night ? "lit night" : "lit",
    svg`
    ${room("#3d4d74", "#334166", "#5b5f6b", "#4f525d")}
    ${[0, 1].map((k) =>
      svg`<rect x=${700 - k * 92} y="40" width="80" height="156" rx="6" fill="#262b38" />
        ${[0, 1, 2, 3, 4, 5].map((i) => svg`<rect x=${708 - k * 92} y=${52 + i * 23} width="64" height="17" rx="3" fill="#323849" />
          <circle class="led" style="animation-delay:${(i * 0.37 + k * 0.5).toFixed(2)}s" cx=${718 - k * 92} cy=${60 + i * 23} r="2.6" fill=${!ok && k === 0 && i === 2 ? "#ff6b5e" : "#5ef08a"} />
          <circle class="led" style="animation-delay:${(i * 0.61 + 0.2).toFixed(2)}s" cx=${726 - k * 92} cy=${60 + i * 23} r="2.6" fill="#4fc3f7" />
          <rect x=${736 - k * 92} y=${58 + i * 23} width="28" height="4" rx="2" fill="#4a5168" />`)}`,
    )}
    <rect x="440" y="132" width="150" height="10" rx="3" fill="#8a5d3f" /><rect x="450" y="142" width="10" height="54" fill="#6a4a35" /><rect x="570" y="142" width="10" height="54" fill="#6a4a35" />
    <rect x="470" y="78" width="96" height="52" rx="5" fill="#1d2230" /><rect x="476" y="84" width="84" height="40" rx="2" fill="#18bcf2" />
    <path d="M518 92l-14 12h4v12h20v-12h4z" fill="#fff" /><circle cx="518" cy="108" r="3" fill="#18bcf2" />
    <rect x="770" y="20" width="30" height="12" rx="3" fill="#262b38" /><path d="M778 20v-12M792 20v-12" stroke="#262b38" stroke-width="3" />
    <path class="wave" d="M770 4a20 20 0 0 1 30 0" stroke="#4fc3f7" stroke-width="2.5" fill="none" />
    <path class="wave late" d="M764 -4a30 30 0 0 1 42 0" stroke="#4fc3f7" stroke-width="2.5" fill="none" />
    ${ok
      ? cat(410, 196, 0.95, "sit", svg`<rect x="14" y="-34" width="16" height="16" rx="3" fill="#f6efe2" /><path d="M30 -30a5 5 0 0 1 0 8" stroke="#f6efe2" stroke-width="3" fill="none" /><path d="M18 -40c-2-6 4-8 2-12M24 -40c-2-6 4-8 2-12" stroke="#fff" stroke-width="2" fill="none" opacity="0.6" />`)
      : svg`${cat(410, 196, 0.95, "stand", svg`<path d="M20 -24l18 -22" stroke="#9aa5ad" stroke-width="5" stroke-linecap="round" /><circle cx="40" cy="-48" r="6" fill="none" stroke="#9aa5ad" stroke-width="4" />`)}
          <path class="bolt" d="M640 16l18 30h-36z" fill="#ffd34d" /><rect x="638" y="26" width="4" height="10" rx="2" fill="#3d2f1f" /><circle cx="640" cy="40" r="2" fill="#3d2f1f" />`}
    ${glow(520, 0, 180)}
    <rect x="519" y="0" width="2" height="10" fill="#c8cfdb" /><path d="M504 10h32l-6 12h-20z" fill="#ffe08a" />`,
  );
}

export const sceneStyles = css`
  /* Turns around the hub (479, 86 in scene units), not its own box. */
  .room-scene .rotor {
    transform-box: view-box;
    animation: kh-spin linear infinite;
  }
  .room-scene .lcd {
    font: 700 11px ui-monospace, "SF Mono", Menlo, monospace;
    fill: #a8ff8a;
  }
  .room-scene .bolt {
    animation: kh-blink-soft 2.4s ease-in-out infinite;
  }
  .room-scene .wave {
    animation: kh-wave 2s ease-out infinite;
  }
  .room-scene .wave.late {
    animation-delay: 0.6s;
  }
  .room-scene .note {
    animation: kh-wave 2.6s ease-in-out infinite;
  }
  @keyframes kh-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes kh-blink-soft {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  @keyframes kh-wave {
    0% { opacity: 0; }
    40% { opacity: 1; }
    100% { opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .room-scene .rotor,
    .room-scene .bolt,
    .room-scene .wave,
    .room-scene .note {
      animation: none;
    }
  }
`;
