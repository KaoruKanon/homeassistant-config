import { LitElement, css, html, nothing, svg, type SVGTemplateResult } from "lit";
import { openMoreInfo, setLights } from "../actions.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { openComputer } from "../popups/index.ts";
import type { Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { roomColors, roomSceneStyles } from "./room-art.ts";

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
  windows?: [number, number][];
  tv?: R;
  /** Where the TV's badge sits (beside the TV, clear of the PC's). */
  tvBadge?: [number, number];
  pc?: R;
}

const ROOMS: Record<string, PlanRoom> = {
  salon: { points: "80,130 720,130 720,440 80,440", label: [430, 180], windows: [[190, 360]], tv: [100, 230, 10, 100], tvBadge: [175, 320], pc: [90, 160, 50, 40] },
  cuisine: { points: "290,450 720,450 720,710 290,710", label: [505, 560], windows: [[580, 690]] },
  chambre_william: { points: "290,720 720,720 720,950 290,950", label: [430, 860], windows: [[750, 840]], pc: [460, 726, 50, 40] },
  chambre_papa: { points: "290,960 720,960 720,1315 290,1315", label: [560, 1060], windows: [[1142, 1252]], tv: [672, 1190, 8, 100], tvBadge: [600, 1240] },
  couloir: { points: "80,450 280,450 280,1120 200,1120 200,630 80,630", label: [180, 540] },
  toilette: { points: "80,990 190,990 190,1120 80,1120", label: [135, 1010] },
  salle_de_bain: { points: "80,1130 280,1130 280,1315 80,1315", label: [205, 1160] },
};

/** Doors: hinge, then the leaf's closed and open angles (degrees, 0 = +x, 90 = down). */
const DOORS: [number, number, number, number][] = [
  [180, 445, 0, -90], [640, 445, 180, 270], [75, 530, 90, 0], [285, 540, 90, 0], [285, 870, -90, 0],
  [285, 1080, -90, 0], [195, 1000, 90, 0], [280, 1125, 180, 90],
];

/** Height and colour of each piece of furniture in the 3D view. */
const FURNITURE_3D: Record<string, [number, string]> = {
  couch: [26, "#4a90c8"], bed_single: [18, "#f2b84b"], bed_double: [18, "#f2b84b"], chair: [14, "#8a5d3f"], round_table: [22, "#c58a45"],
  table: [22, "#c58a45"], desk: [22, "#8a5d3f"], dresser: [28, "#a77a55"], bookcase: [44, "#6a4a35"], office_chair: [14, "#e85d75"],
  refrigerator: [52, "#e8eef0"], range: [28, "#58606b"], sink: [26, "#e8eef0"], sink_double: [28, "#e8eef0"], washing_machine: [28, "#f6efe2"],
  bathtub: [18, "#ffffff"], toilet: [14, "#ffffff"],
};

/** A darker shade of a hex colour (f < 1). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const MONITOR = "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z";

const TELEVISION = "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z";

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
 * red, presence pulses, a playing TV shines.
 * Tap a room to open it, its bulb to switch its lights, a TV or a desk for
 * its popup. Landscape (rotated) when wide, upright on phones.
 */
export class KhFloorplan extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {}, wide: { state: true }, mode: { state: true } };
  declare rooms: Room[];
  declare prefix: string;
  declare wide: boolean;
  /** Flat plan or isometric view; remembered per screen. */
  declare mode: "2d" | "3d";
  private resize = new ResizeObserver(([e]) => (this.wide = e.contentRect.width >= 600));

  constructor() {
    super();
    this.wide = true;
    this.mode = "2d";
    try {
      if (localStorage.getItem("kh-plan-mode") === "3d") this.mode = "3d";
    } catch {
      /* private browsing: 2D */
    }
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
      .wrap {
        position: relative;
      }
      .switch {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 1;
        display: inline-flex;
        padding: 3px;
        border-radius: 12px;
        background: rgb(0 0 0 / 0.45);
      }
      .switch button {
        height: 32px;
        padding: 0 12px;
        border-radius: 9px;
        font-weight: 800;
        font-size: 0.8125rem;
        color: rgb(255 255 255 / 0.7);
      }
      .switch button[aria-pressed="true"] {
        background: rgb(255 255 255 / 0.9);
        color: #1c2027;
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
      .iso .label {
        font-size: 30px;
      }
      .iso .label.small {
        font-size: 22px;
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
      .badge {
        cursor: pointer;
      }
      .badge rect {
        fill: rgb(20 22 30 / 0.8);
        stroke: rgb(255 255 255 / 0.25);
        stroke-width: 1.5;
      }
      .badge path {
        fill: #9ea4a9;
      }
      .badge text {
        font: 700 16px var(--kh-font, system-ui);
        fill: #e9eaeb;
      }
      .badge.pc.on rect {
        fill: rgb(33 150 243 / 0.85);
        stroke: #4fc3f7;
      }
      .badge.tv.on rect {
        fill: rgb(123 92 255 / 0.85);
        stroke: #b48cff;
      }
      .badge.on path,
      .badge.on text {
        fill: #fff;
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

  /** PCs and TVs on the plan: icon and name, lit while on; tap for their popup. */
  private deviceBadges(project: (x: number, y: number) => [number, number]) {
    const hass = store.hass!;
    const badge = (x: number, y: number, name: string, icon: string, on: boolean, kind: string, open: () => void) => {
      const [px, py] = project(x, y);
      const w = 34 + name.length * 10.5;
      return svg`<g class="badge ${kind} ${on ? "on" : ""}" transform="translate(${px - w / 2} ${py - 18})" role="button" aria-label="${name} : ${on ? "allumé" : "éteint"}"
        @click=${open}>
        <rect width=${w} height="36" rx="18" />
        <path d=${icon} transform="translate(8 6)" />
        <text x="36" y="24">${name}</text>
      </g>`;
    };
    const pcs = Object.entries(config.plan?.computers ?? {}).map(([id, entity]) => {
      const p = ROOMS[id]?.pc;
      const c = config.home.computers.find((x) => x.entity === entity);
      if (!p || !c) return nothing;
      return badge(p[0] + p[2] / 2, p[1] + p[3] / 2, c.name, MONITOR, isActive(hass.states[entity]), "pc", () => openComputer(c));
    });
    const tvs = Object.entries(config.plan?.tvs ?? {}).map(([id, entity]) => {
      const p = ROOMS[id];
      if (!p?.tv || !hass.states[entity]) return nothing;
      const [x, y] = p.tvBadge ?? [p.tv[0] + p.tv[2] / 2, p.tv[1] + p.tv[3] / 2];
      const room = (this.rooms ?? []).find((r) => r.id === id)?.name ?? id;
      return badge(x, y, `TV ${room.replace(/^Chambre /, "")}`, TELEVISION, isActive(hass.states[entity]), "tv", () => openMoreInfo(this, entity));
    });
    return [...pcs, ...tvs];
  }

  private setMode(m: "2d" | "3d"): void {
    this.mode = m;
    try {
      localStorage.setItem("kh-plan-mode", m);
    } catch {
      /* not kept */
    }
  }

  render() {
    if (!store.hass) return nothing;
    return html`<div class="wrap">
      <div class="switch" role="group" aria-label="Vue du plan">
        <button aria-pressed=${String(this.mode === "2d")} @click=${() => this.setMode("2d")}>2D</button>
        <button aria-pressed=${String(this.mode === "3d")} @click=${() => this.setMode("3d")}>3D</button>
      </div>
      ${this.mode === "3d" ? this.plan3d() : this.plan2d()}
    </div>`;
  }

  /** Isometric view: floors flat, walls and furniture raised, painted back to front. */
  private plan3d() {
    const hass = store.hass!;
    const night = hass.states["sun.sun"]?.state === "below_horizon";
    const byId = new Map((this.rooms ?? []).map((r) => [r.id, r]));
    const lit = (r?: Room) => !!r && r.lights.some((id) => isActive(hass.states[id]));
    const tvs = config.plan?.tvs ?? {};
    const pcs = config.plan?.computers ?? {};
    // The long side of the flat runs left to right: u along the plan's y, v across.
    const uv = (x: number, y: number): [number, number] => [y, 800 - x];
    const C = 0.866, S = 0.5;
    const iso = (u: number, v: number, z = 0): [number, number] => [(u - v) * C, (u + v) * S - z];
    const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
    const floor = (points: string) =>
      pts(points.split(" ").map((p) => { const [x, y] = p.split(",").map(Number); return iso(...uv(x, y)); }));

    type Box = { u0: number; v0: number; u1: number; v1: number; z: number; top: string; side: string; front: string; cls?: string; click?: () => void; title?: string };
    const box = (x: number, y: number, w: number, h: number, z: number, top: string, side?: string, front?: string): Box => {
      const [a, b] = uv(x, y), [c, d] = uv(x + w, y + h);
      return { u0: Math.min(a, c), v0: Math.min(b, d), u1: Math.max(a, c), v1: Math.max(b, d), z, top, side: side ?? shade(top, 0.78), front: front ?? shade(top, 0.62) };
    };
    const boxes: Box[] = [];
    // Walls, cut in short pieces so the painter's order stays right along long runs.
    for (const [x, y, w, h] of WALLS) {
      const n = Math.max(1, Math.ceil(Math.max(w, h) / 40));
      for (let i = 0; i < n; i++)
        boxes.push(w >= h ? box(x + (w / n) * i, y, w / n, h, 46, "#3a3f4b", "#2b2f3a", "#23262e") : box(x, y + (h / n) * i, w, h / n, 46, "#3a3f4b", "#2b2f3a", "#23262e"));
    }
    for (const [id, p] of Object.entries(ROOMS)) {
      const open = (byId.get(id)?.openings ?? []).some((o) => isActive(hass.states[o]));
      for (const [a, b] of p.windows ?? []) {
        const n = Math.max(1, Math.ceil((b - a) / 40));
        for (let i = 0; i < n; i++) boxes.push({ ...box(719, a + ((b - a) / n) * i, 12, (b - a) / n, 47, open ? "#ff6b5e" : "#8ecae6"), cls: open ? "window open" : "" });
      }
    }
    for (const [name, x, y, w, h, rot] of FURNITURE) {
      const turned = Math.abs(rot) % 180 === 90;
      const bw = turned ? h : w, bh = turned ? w : h;
      const bx = x + w / 2 - bw / 2, by = y + h / 2 - bh / 2;
      const [z, color] = FURNITURE_3D[name] ?? [20, "#8a5d3f"];
      boxes.push(box(bx, by, bw, bh, z, color));
    }
    for (const [id, p] of Object.entries(ROOMS)) {
      const tv = tvs[id], pc = pcs[id];
      if (p.tv && tv) {
        const on = isActive(hass.states[tv]);
        boxes.push({ ...box(p.tv[0], p.tv[1], p.tv[2], p.tv[3], 60, on ? "#b48cff" : "#1d1830", on ? "#7b5cff" : "#15121f", on ? "#ff6fa8" : "#100d18"), cls: "device", click: () => openMoreInfo(this, tv), title: "Télévision" });
      }
      if (p.pc && pc) {
        const on = isActive(hass.states[pc]);
        const c = config.home.computers.find((x) => x.entity === pc);
        boxes.push({ ...box(p.pc[0], p.pc[1], p.pc[2], p.pc[3], 46, on ? "#4fc3f7" : "#2b2f3a"), cls: "device", click: () => c && openComputer(c), title: c?.name ?? "Ordinateur" });
      }
    }
    boxes.sort((a, b) => a.u1 + a.v1 - (b.u1 + b.v1));

    const all: [number, number][] = [];
    for (const [x, y] of [[60, 110], [740, 110], [740, 1335], [60, 1335]] as [number, number][]) {
      const [u, v] = uv(x, y);
      all.push(iso(u, v), iso(u, v, 60));
    }
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const view = `${Math.min(...xs) - 20} ${Math.min(...ys) - 20} ${Math.max(...xs) - Math.min(...xs) + 40} ${Math.max(...ys) - Math.min(...ys) + 40}`;

    return html`<svg class="plan iso" viewBox=${view} role="img" aria-label="Vue 3D de l'appartement">
      <defs>
        <radialGradient id="kh-glow3"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.8" /><stop offset="0.5" stop-color="#ffc35a" stop-opacity="0.3" /><stop offset="1" stop-color="#ffb347" stop-opacity="0" /></radialGradient>
      </defs>
      <polygon points=${floor("60,110 740,110 740,1335 60,1335")} fill="#1c2027" />
      ${Object.entries(ROOMS).map(([id, p]) => {
        const r = byId.get(id);
        const [wall] = roomColors(r ?? { id, name: id, icon: "" });
        return svg`<polygon class="room-area" points=${floor(p.points)} fill=${wall} @click=${() => r && this.open(id)}><title>${r?.name ?? id}</title></polygon>
          <polygon class="dark" points=${floor(p.points)} fill="#0d1230" opacity=${lit(r) ? 0 : night ? 0.5 : 0.12} />`;
      })}
      <polygon points=${floor("80,639 190,639 190,980 80,980")} fill="#3a3f4b" />
      ${Object.entries(ROOMS).map(([id, p]) => {
        if (!lit(byId.get(id))) return nothing;
        const [cx, cy] = iso(...uv(...p.label));
        return svg`<ellipse class="glow" cx=${cx} cy=${cy} rx="260" ry="150" fill="url(#kh-glow3)" />`;
      })}
      ${boxes.map((b) => {
        const A = iso(b.u0, b.v1), B = iso(b.u1, b.v1), Cc = iso(b.u1, b.v0);
        const At = iso(b.u0, b.v1, b.z), Bt = iso(b.u1, b.v1, b.z), Ct = iso(b.u1, b.v0, b.z), Dt = iso(b.u0, b.v0, b.z);
        return svg`<g class=${b.cls ?? ""} @click=${b.click ?? nothing} style=${b.click ? "" : "pointer-events:none"}>
          ${b.title ? svg`<title>${b.title}</title>` : nothing}
          <polygon points=${pts([A, B, Bt, At])} fill=${b.front} />
          <polygon points=${pts([B, Cc, Ct, Bt])} fill=${b.side} />
          <polygon points=${pts([Dt, Ct, Bt, At])} fill=${b.top} />
        </g>`;
      })}
      ${Object.entries(ROOMS).map(([id, p]) => {
        const r = byId.get(id);
        if (!r) return nothing;
        const [x, y] = iso(...uv(...p.label), 70);
        const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
        const on = lit(r);
        const small = id === "toilette";
        return svg`
          <text class="label ${small ? "small" : ""}" x=${x} y=${y} text-anchor="middle">${r.name}</text>
          ${!isNaN(t) ? svg`<text class="label small" x=${x} y=${y + 28} text-anchor="middle">${formatNumber(t)}°</text>` : nothing}
          ${r.lights.length
            ? svg`<g class="bulb ${on ? "on" : ""}" transform="translate(${x - (small ? 13 : 18)} ${y - (small ? 46 : 62)}) scale(${small ? 0.72 : 1})" role="button" aria-label=${on ? `Éteindre ${r.name}` : `Allumer ${r.name}`}
                @click=${() => setLights(r.lights, !on)}><circle cx="18" cy="18" r="20" /><path d=${LAMP} transform="translate(6 6)" /></g>`
            : nothing}`;
      })}
      ${this.deviceBadges((x, y) => iso(...uv(x, y), 50))}
    </svg>`;
  }

  private plan2d() {
    const hass = store.hass!;
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
          ${r.lights.length
            ? svg`<g class="bulb ${on ? "on" : ""}" transform="translate(${x - (small ? 13 : 18)} ${y - (small ? 46 : 62)}) scale(${small ? 0.72 : 1})" role="button" aria-label=${on ? `Éteindre ${r.name}` : `Allumer ${r.name}`}
                @click=${() => setLights(r.lights, !on)}><circle cx="18" cy="18" r="20" /><path d=${LAMP} transform="translate(6 6)" /></g>`
            : nothing}`;
      })}
      ${this.deviceBadges(at)}
    </svg>`;
  }
}
customElements.define("kh-floorplan", KhFloorplan);
