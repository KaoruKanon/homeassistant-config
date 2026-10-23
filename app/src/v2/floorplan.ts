import { LitElement, css, html, nothing, svg, type SVGTemplateResult } from "lit";
import { openMoreInfo, setLights } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { openComputer } from "../popups/index.ts";
import type { Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { cat, roomColors, roomSceneStyles } from "./room-art.ts";

// The flat, from the user's drawio plan (assets/plan/appartement.drawio):
// walls, windows, doors and furniture in plan units (about 1 unit = 1 cm),
// the rooms as the HA areas they belong to.

type R = [number, number, number, number];
type F = [string, number, number, number, number, number];

const WALLS: R[] = [
  [70, 120, 160, 10], [70, 120, 10, 240], [230, 120, 500, 10], [720, 120, 10, 70], [640, 440, 90, 10], [720, 360, 10, 90],
  [260, 440, 300, 10], [280, 450, 10, 90], [280, 620, 10, 100], [280, 710, 350, 10], [70, 450, 10, 80], [70, 1315, 560, 10],
  [70, 610, 10, 715], [620, 710, 110, 10], [720, 680, 10, 40], [720, 450, 10, 130], [720, 720, 10, 30], [630, 950, 100, 10],
  [720, 840, 10, 120], [530, 950, 100, 10], [280, 950, 260, 10], [280, 870, 10, 90], [280, 720, 10, 70], [280, 960, 10, 40],
  [630, 1315, 100, 10], [720, 1290, 10, 35], [720, 960, 10, 150], [280, 1078, 10, 242], [70, 440, 110, 10], [70, 360, 10, 90],
  [80, 1120, 120, 10], [190, 1080, 10, 50], [80, 980, 120, 10], [190, 980, 10, 20], [80, 629, 120, 10], [190, 629, 10, 62],
  [190, 930, 10, 100],
];

const FURNITURE: F[] = [
  ["bed_single", 620, 770, 100, 180, -180], ["chair", 545, 190, 40, 52, 0], ["chair", 545, 278, 40, 52, 0], ["chair", 495, 240, 52, 40, 0],
  ["chair", 583, 240, 52, 40, 0], ["round_table", 515, 210, 100, 100, 0], ["couch", 237.5, 176, 170, 80, 90], ["refrigerator", 500, 450, 60, 62, 0],
  ["bathtub", 20, 1190, 180, 60, 90], ["bed_double", 280, 1120, 200, 180, -90], ["range", 468, 647, 75, 62, -180], ["dresser", 60, 260, 100, 40, -90],
  ["toilet", 110, 1043, 50, 67, -180], ["sink", 140, 1134, 40, 35, 0], ["sink_double", 290, 640, 160, 70, -180], ["dresser", 290, 885, 130, 65, -180],
  ["dresser", 380, 960, 260, 65, 0], ["washing_machine", 560, 645, 60, 60, -180], ["bookcase", 295, 721, 100, 30, 0], ["dresser", 80, 372.5, 100, 65, -180],
  ["office_chair", 465, 766, 40, 43, -180], ["desk", 395, 721, 180, 50, -180], ["bookcase", 565, 730, 50, 30, -90], ["table", 630, 490, 130, 50, 90],
  ["dresser", 305, 450, 180, 52, 0], ["office_chair", 140, 147, 40, 43, 30], ["desk", 75, 155, 80, 50, 90], ["dresser", 295, 385.5, 240, 52, -180],
  ["dresser", 670, 388, 50, 52, -180], ["dresser", 630, 1220, 120, 40, 90],
];

/** Rooms: floor outline, where the label sits, and the plan's TVs and desks in it. */
interface PlanRoom {
  points: string;
  label: [number, number];
  /** Where Tomo sits when the room is lit. */
  spot: [number, number];
  windows?: [number, number][];
  tv?: R;
  pc?: R;
}

const ROOMS: Record<string, PlanRoom> = {
  salon: { points: "80,130 720,130 720,440 80,440", label: [430, 180], spot: [322, 250], windows: [[190, 360]], tv: [100, 230, 10, 100], pc: [90, 160, 50, 40] },
  cuisine: { points: "290,450 720,450 720,710 290,710", label: [505, 560], spot: [430, 600], windows: [[580, 690]] },
  chambre_william: { points: "290,720 720,720 720,950 290,950", label: [430, 860], spot: [580, 940], windows: [[750, 840]], pc: [460, 726, 50, 40] },
  chambre_papa: { points: "290,960 720,960 720,1315 290,1315", label: [560, 1060], spot: [560, 1150], windows: [[1102, 1292]], tv: [685, 1225, 10, 100] },
  couloir: { points: "80,450 280,450 280,1120 200,1120 200,630 80,630", label: [180, 540], spot: [240, 800] },
  toilette: { points: "80,990 190,990 190,1120 80,1120", label: [135, 1010], spot: [135, 1100] },
  salle_de_bain: { points: "80,1130 280,1130 280,1315 80,1315", label: [205, 1160], spot: [230, 1290] },
};

/** Doors: hinge, then the leaf's closed and open angles (degrees, 0 = +x, 90 = down). */
const DOORS: [number, number, number, number][] = [
  [180, 445, 0, -90], [640, 445, 180, 270], [75, 530, 90, 0], [285, 540, 90, 0], [285, 870, -90, 0],
  [285, 1080, -90, 0], [195, 1000, 90, 0], [280, 1125, 180, 90],
];

const LAMP = "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z";

function piece(name: string, w: number, h: number): SVGTemplateResult {
  switch (name) {
    case "couch":
      return svg`<rect width=${w} height=${h} rx="12" fill="#4a90c8" /><rect width=${w} height=${h * 0.32} rx="10" fill="#3f7fb5" />
        <rect width="16" height=${h} rx="8" fill="#3f7fb5" /><rect x=${w - 16} width="16" height=${h} rx="8" fill="#3f7fb5" />`;
    case "bed_single":
    case "bed_double": {
      const two = name === "bed_double";
      return svg`<rect width=${w} height=${h} rx="8" fill="#f4efe6" />
        ${two
          ? svg`<rect x="10" y="8" width=${w / 2 - 15} height="26" rx="10" fill="#fff" /><rect x=${w / 2 + 5} y="8" width=${w / 2 - 15} height="26" rx="10" fill="#fff" />`
          : svg`<rect x="12" y="8" width=${w - 24} height="26" rx="10" fill="#fff" />`}
        <rect y=${h * 0.3} width=${w} height=${h * 0.7} rx="8" fill="#f2b84b" /><path d="M8 ${h * 0.3 + 14}H${w - 8}" stroke="#e3a43a" stroke-width="3" />`;
    }
    case "chair":
      return svg`<rect x="4" y="4" width=${w - 8} height=${h - 8} rx="8" fill="#8a5d3f" />`;
    case "round_table":
      return svg`<circle cx=${w / 2} cy=${h / 2} r=${w / 2} fill="#c58a45" /><circle cx=${w / 2} cy=${h / 2} r=${w / 2 - 8} fill="#d39a55" />`;
    case "table":
    case "desk":
      return svg`<rect width=${w} height=${h} rx="5" fill="#8a5d3f" />`;
    case "dresser":
      return svg`<rect width=${w} height=${h} rx="5" fill="#a77a55" /><path d="M6 ${h / 2}H${w - 6}" stroke="#946a48" stroke-width="2" />`;
    case "bookcase":
      return svg`<rect width=${w} height=${h} rx="3" fill="#6a4a35" />`;
    case "office_chair":
      return svg`<circle cx=${w / 2} cy=${h / 2} r=${Math.min(w, h) / 2 - 2} fill="#e85d75" />`;
    case "refrigerator":
      return svg`<rect width=${w} height=${h} rx="6" fill="#e8eef0" /><path d="M8 ${h - 10}H${w - 8}" stroke="#c9d3d8" stroke-width="3" />`;
    case "range":
      return svg`<rect width=${w} height=${h} rx="5" fill="#58606b" />${[[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].map(
        ([a, b]) => svg`<circle cx=${w * a} cy=${h * b} r="9" fill="#3c4250" />`,
      )}`;
    case "sink":
    case "sink_double":
      return svg`<rect width=${w} height=${h} rx="6" fill="#e8eef0" />${
        name === "sink"
          ? svg`<rect x="6" y="6" width=${w - 12} height=${h - 12} rx="8" fill="#bfe6f2" />`
          : svg`<rect x="10" y="10" width=${w / 2 - 15} height=${h - 20} rx="8" fill="#bfe6f2" /><rect x=${w / 2 + 5} y="10" width=${w / 2 - 15} height=${h - 20} rx="8" fill="#bfe6f2" />`
      }`;
    case "washing_machine":
      return svg`<rect width=${w} height=${h} rx="6" fill="#f6efe2" /><circle cx=${w / 2} cy=${h / 2} r=${w / 2 - 10} fill="#9fb3bf" />`;
    case "bathtub":
      return svg`<rect width=${w} height=${h} rx="20" fill="#ffffff" /><rect x="8" y="8" width=${w - 16} height=${h - 16} rx="16" fill="#bfe6f2" />`;
    case "toilet":
      return svg`<rect x="5" width=${w - 10} height="18" rx="4" fill="#ffffff" /><ellipse cx=${w / 2} cy=${h / 2 + 8} rx=${w / 2 - 4} ry=${h / 2 - 12} fill="#ffffff" />`;
  }
  return svg``;
}

/**
 * The plan of the flat, live: a lit room glows amber, an open window turns
 * red, presence pulses, a playing TV shines; Tomo sits in a lit room.
 * Tap a room to open it, its bulb to switch its lights, a TV or a desk for
 * its popup. Landscape (rotated) when wide, upright on phones.
 */
export class KhFloorplan extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {}, wide: { state: true } };
  declare rooms: Room[];
  declare prefix: string;
  declare wide: boolean;
  private resize = new ResizeObserver(([e]) => (this.wide = e.contentRect.width >= 600));

  constructor() {
    super();
    this.wide = true;
    new RegistryController(this);
    new EntitiesController(this, () => {
      const p = config.plan;
      return [
        ...(this.rooms ?? []).flatMap((r) => [...r.lights, ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x)]),
        ...Object.values(p?.tvs ?? {}),
        ...Object.values(p?.computers ?? {}),
        "sun.sun",
      ];
    });
  }

  static styles = [
    base,
    roomSceneStyles,
    css`
      :host {
        display: block;
      }
      svg.plan {
        display: block;
        width: 100%;
        height: auto;
        max-height: var(--plan-max-height, 62vh);
      }
      .room-area {
        cursor: pointer;
        transition: filter 200ms ease;
      }
      .room-area:hover {
        filter: brightness(1.12);
      }
      .glow {
        mix-blend-mode: screen;
        animation: kh-glow 5s ease-in-out infinite alternate;
        pointer-events: none;
      }
      .dark {
        pointer-events: none;
        transition: opacity 400ms ease;
      }
      .wall {
        fill: #2b2f3a;
      }
      .window {
        fill: #8ecae6;
      }
      .window.open {
        fill: #ff6b5e;
        animation: kh-blink 1.2s ease-in-out infinite;
      }
      .door {
        fill: none;
        stroke: rgb(255 255 255 / 0.35);
        stroke-width: 2;
        stroke-dasharray: 4 4;
      }
      .door.open {
        stroke: #ff6b5e;
      }
      .label {
        font: 800 22px var(--kh-font, system-ui);
        fill: #fff;
        paint-order: stroke;
        stroke: rgb(0 0 0 / 0.45);
        stroke-width: 4px;
        pointer-events: none;
      }
      .label.small {
        font-size: 16px;
        font-weight: 700;
      }
      .bulb circle {
        fill: rgb(0 0 0 / 0.45);
        transition: fill 250ms ease;
      }
      .bulb.on circle {
        fill: rgb(255 160 0);
      }
      .bulb path {
        fill: #fff;
      }
      .bulb.on path {
        fill: #2b2003;
      }
      .bulb,
      .device {
        cursor: pointer;
      }
      .device.tv.on {
        fill: url(#kh-tv-screen);
      }
      .presence {
        fill: none;
        stroke: rgb(var(--rgb-indigo, 63, 81, 181));
        stroke-width: 3;
        transform-box: fill-box;
        transform-origin: center;
        animation: kh-presence 2.4s ease-out infinite;
        pointer-events: none;
      }
      @keyframes kh-presence {
        from {
          transform: scale(0.4);
          opacity: 0.9;
        }
        to {
          transform: scale(1.6);
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .presence,
        .window.open,
        .glow {
          animation: none;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
  }

  private open(id: string): void {
    history.pushState(null, "", `${this.prefix}/pieces/${id}${location.search}`);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  render() {
    const hass = store.hass;
    if (!hass) return nothing;
    const night = hass.states["sun.sun"]?.state === "below_horizon";
    const wide = this.wide;
    // Landscape: the plan turned a quarter (the salon on the left); text stays upright.
    const at = (x: number, y: number): [number, number] => (wide ? [y, 800 - x] : [x, y]);
    const view = wide ? "100 40 1250 720" : "40 100 720 1250";
    const turn = wide ? "translate(0 800) rotate(-90)" : "";
    const byId = new Map((this.rooms ?? []).map((r) => [r.id, r]));
    const tvs = config.plan?.tvs ?? {};
    const pcs = config.plan?.computers ?? {};
    const lit = (r?: Room) => !!r && r.lights.some((id) => isActive(hass.states[id]));
    const catRoom = Object.keys(ROOMS).find((id) => lit(byId.get(id)));

    return html`<svg class="plan" viewBox=${view} role="img" aria-label="Plan de l'appartement">
      <defs>
        <radialGradient id="kh-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75" /><stop offset="0.5" stop-color="#ffc35a" stop-opacity="0.3" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" /></radialGradient>
        <radialGradient id="kh-tv-glow"><stop offset="0" stop-color="#b48cff" stop-opacity="0.65" /><stop offset="1" stop-color="#b48cff" stop-opacity="0" /></radialGradient>
        <linearGradient id="kh-tv-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b5cff" /><stop offset="1" stop-color="#ff6fa8" /></linearGradient>
      </defs>
      <g transform=${turn}>
        <rect x="60" y="110" width="680" height="1225" rx="18" fill="#1c2027" />
        ${Object.entries(ROOMS).map(([id, p]) => {
          const r = byId.get(id);
          const [wall] = roomColors(r ?? { id, name: id, icon: "" });
          return svg`<polygon class="room-area" points=${p.points} fill=${wall} @click=${() => r && this.open(id)}><title>${r?.name ?? id}</title></polygon>`;
        })}
        <polygon points="80,639 190,639 190,980 80,980" fill="#3a3f4b" />
        ${FURNITURE.map(([name, x, y, w, h, rot]) => svg`<g transform="translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})" style="pointer-events:none">${piece(name, w, h)}</g>`)}
        ${Object.entries(ROOMS).map(([id, p]) => {
          const r = byId.get(id);
          const [lx, ly] = p.label;
          const glow = lit(r);
          return svg`
            ${glow ? svg`<circle class="glow" cx=${lx} cy=${ly} r="260" fill="url(#kh-glow)" clip-path="url(#kh-clip-${id})" />` : nothing}
            <clipPath id="kh-clip-${id}"><polygon points=${p.points} /></clipPath>
            <polygon class="dark" points=${p.points} fill="#0d1230" opacity=${glow ? 0 : night ? 0.5 : 0.12} />`;
        })}
        ${Object.entries(ROOMS).map(([id, p]) => {
          const tv = tvs[id], pc = pcs[id];
          return svg`
            ${p.tv && tv
              ? svg`${isActive(hass.states[tv]) ? svg`<circle class="glow" cx=${p.tv[0] + 30} cy=${p.tv[1] + p.tv[3] / 2} r="120" fill="url(#kh-tv-glow)" />` : nothing}
                <rect class="device tv ${isActive(hass.states[tv]) ? "on" : ""}" x=${p.tv[0]} y=${p.tv[1]} width=${p.tv[2]} height=${p.tv[3]} rx="3" fill="#1d1830"
                  @click=${() => openMoreInfo(this, tv)}><title>Télévision</title></rect>`
              : nothing}
            ${p.pc && pc
              ? svg`<rect class="device" x=${p.pc[0]} y=${p.pc[1]} width=${p.pc[2]} height=${p.pc[3]} rx="4"
                  fill=${isActive(hass.states[pc]) ? "#4fc3f7" : "#2b2f3a"} stroke="#1d2230" stroke-width="4"
                  @click=${() => {
                    const c = config.home.computers.find((x) => x.entity === pc);
                    if (c) openComputer(c);
                  }}><title>${config.home.computers.find((x) => x.entity === pc)?.name ?? "Ordinateur"}</title></rect>`
              : nothing}`;
        })}
        ${WALLS.map(([x, y, w, h]) => svg`<rect class="wall" x=${x} y=${y} width=${w} height=${h} />`)}
        ${Object.entries(ROOMS).flatMap(([id, p]) => {
          const open = (byId.get(id)?.openings ?? []).some((o) => isActive(hass.states[o]));
          return (p.windows ?? []).map(([a, b]) => svg`<rect class="window ${open ? "open" : ""}" x="718" y=${a} width="14" height=${b - a} rx="3" />`);
        })}
        ${DOORS.map(([x, y, a0, a1], i) => {
          const rad = (d: number) => (d * Math.PI) / 180, r = 78;
          const open = i === 2 && (byId.get("couloir")?.openings ?? []).some((o) => isActive(hass.states[o]));
          const p0 = [x + r * Math.cos(rad(a0)), y + r * Math.sin(rad(a0))], p1 = [x + r * Math.cos(rad(a1)), y + r * Math.sin(rad(a1))];
          const sweep = a1 > a0 ? 1 : 0;
          return svg`<path class="door ${open ? "open" : ""}" d="M${x} ${y}L${p1[0]} ${p1[1]}A${r} ${r} 0 0 ${sweep ? 0 : 1} ${p0[0]} ${p0[1]}" />`;
        })}
      </g>
      ${Object.entries(ROOMS).map(([id, p]) => {
        const r = byId.get(id);
        if (!r) return nothing;
        const [x, y] = at(...p.label);
        const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
        const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
        const on = lit(r);
        const presence = r.motion.some((m) => isActive(hass.states[m]));
        const climate = [!isNaN(t) ? `${formatNumber(t)}°` : "", !isNaN(hum) ? `${formatNumber(hum, 0)} %` : ""].filter(Boolean).join("  ");
        const small = id === "toilette";
        return svg`
          ${presence ? svg`<circle class="presence" cx=${x} cy=${y - 30} r="40" />` : nothing}
          <text class="label ${small ? "small" : ""}" x=${x} y=${y} text-anchor="middle">${r.name}</text>
          ${climate ? svg`<text class="label small" x=${x} y=${y + 22} text-anchor="middle">${climate}</text>` : nothing}
          ${r.lights.length && !small
            ? svg`<g class="bulb ${on ? "on" : ""}" transform="translate(${x - 18} ${y - 62})" role="button" aria-label=${on ? `Éteindre ${r.name}` : `Allumer ${r.name}`}
                @click=${() => setLights(r.lights, !on)}><circle cx="18" cy="18" r="20" /><path d=${LAMP} transform="translate(6 6)" /></g>`
            : nothing}`;
      })}
      ${catRoom
        ? (() => {
            const [x, y] = at(...ROOMS[catRoom].spot);
            return cat(x, y, 0.8, night ? "nap" : "sit");
          })()
        : nothing}
    </svg>`;
  }
}
customElements.define("kh-floorplan", KhFloorplan);
