import { LitElement, css, html, nothing, svg, type SVGTemplateResult } from "lit";
import { isPending, openMoreInfo, setLights, toggle } from "../actions.ts";
import { Press, pcPress } from "../components/gestures.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { openComputer } from "../popups/open.ts";
import { entityName, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { DOORS, FURNITURE, ROOMS, WALLS, freeSpot, planLights, type Spot } from "./plan-data.ts";
import { roomColors, roomSceneStyles } from "./room-art.ts";
import { currentSky } from "./sky.ts";









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
    case "wardrobe":
      return svg`<rect width=${w} height=${h} rx="4" fill="#6a4a35" /><path d="M${w / 2} 4V${h - 4}" stroke="#4a3428" stroke-width="2.5" />
        <rect x=${w / 2 - 8} y=${h - 12} width="5" height="6" rx="2" fill="#c9b79a" /><rect x=${w / 2 + 3} y=${h - 12} width="5" height="6" rx="2" fill="#c9b79a" />`;
    case "glass_cabinet":
      return svg`<rect width=${w} height=${h} rx="4" fill="#8a5d3f" /><rect x="6" y=${h - 14} width=${w - 12} height="9" rx="2" fill="#bfe6f2" opacity="0.9" />`;
    case "bar_table":
      return svg`<rect width=${w} height=${h * 0.7} rx="5" fill="#b8875a" /><circle cx=${w * 0.3} cy=${h * 0.95} r="11" fill="#3c4250" /><circle cx=${w * 0.7} cy=${h * 0.95} r="11" fill="#3c4250" />`;
    case "kitchen_cabinet":
      return svg`<rect width=${w} height=${h} rx="4" fill="#e8754f" /><rect x="10" y="8" width="46" height="34" rx="4" fill="#2b2f3a" />
        <circle cx=${w - 28} cy=${h / 2} r="11" fill="#f6efe2" /><path d="M${w - 17} ${h / 2}h6" stroke="#f6efe2" stroke-width="3" />`;
    case "tv_stand":
      return svg`<rect width=${w} height=${h} rx="4" fill="#2b2f3a" /><rect x=${w * 0.55} y="6" width=${w * 0.35} height=${h - 12} rx="2" fill="#1a1c22" />`;
    case "low_bookcase":
      return svg`<rect width=${w} height=${h} rx="3" fill="#6a4a35" /><path d="M6 ${h / 2}H${w - 6}" stroke="#4a3428" stroke-width="2" />`;
    case "desk_extension":
      return svg`<rect width=${w} height=${h} rx="4" fill="#8a5d3f" opacity="0.92" />`;
    case "desk_black":
    case "desk_extension_black":
      return svg`<rect width=${w} height=${h} rx="4" fill="#2a2b30" />`;
    case "bookcase":
      return svg`<rect width=${w} height=${h} rx="3" fill="#6a4a35" />`;
    case "bookcase_tall":
      return svg`<rect width=${w} height=${h} rx="3" fill="#b4602e" />`;
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
        ...(this.rooms ?? []).flatMap((r) => [...planLights(r), ...r.openings, ...r.motion, ...[r.temperature, r.humidity].filter((x): x is string => !!x)]),
        ...Object.values(p?.tvs ?? {}),
        ...Object.values(p?.computers ?? {}),
        "sun.sun",
        ...config.weather,
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
      .label .temp {
        fill: #ffe08a;
        font-weight: 800;
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
      .badge,
      .fixture {
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
      .badge .progress {
        fill: #4fc3f7;
        animation: kh-blink 1s ease-in-out infinite;
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

  private onPending = () => this.requestUpdate();

  connectedCallback(): void {
    super.connectedCallback();
    // Orientation from the first render: drawing it landscape then portrait moved the whole page.
    this.wide = (this.getBoundingClientRect().width || window.innerWidth) >= 600;
    this.resize.observe(this);
    window.addEventListener("kh-pending", this.onPending);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
    window.removeEventListener("kh-pending", this.onPending);
  }

  private open(id: string): void {
    history.pushState(null, "", `${this.prefix}/pieces/${id}${location.search}`);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  /** PCs and TVs on the plan: icon and name, lit while on; tap for their popup. */
  private deviceBadges(project: (x: number, y: number) => [number, number]) {
    const hass = store.hass!;
    const badge = (x: number, y: number, name: string, icon: string, on: boolean, kind: string, open: () => void, press?: Press, busy = false) => {
      const [px, py] = project(x, y);
      const w = 34 + name.length * 10.5;
      return svg`<g class="badge ${kind} ${on ? "on" : ""} ${busy ? "busy" : ""}" transform="translate(${px - w / 2} ${py - 18})" role="button"
        aria-label="${name} : ${busy ? "en cours" : on ? "allumé" : "éteint"}"
        @pointerdown=${press?.down ?? nothing} @pointermove=${press?.move ?? nothing} @pointerup=${press?.cancel ?? nothing}
        @pointercancel=${press?.cancel ?? nothing} @contextmenu=${press?.contextmenu ?? nothing} @click=${press ? press.click : open}>
        <rect width=${w} height="36" rx="18" />
        ${busy ? svg`<rect class="progress" x="10" y="31" width=${w - 20} height="3" rx="1.5" />` : nothing}
        <path d=${icon} transform="translate(8 6)" />
        <text x="36" y="24">${name}</text>
      </g>`;
    };
    const pcs = Object.entries(config.plan?.computers ?? {}).map(([id, entity]) => {
      const p = ROOMS[id]?.pc;
      const c = config.home.computers.find((x) => x.entity === entity);
      if (!p || !c) return nothing;
      const [bx, by] = ROOMS[id].pcBadge ?? [p[0] + p[2] / 2, p[1] + p[3] / 2];
      const busy = isPending(entity) || (c.busy ? isActive(hass.states[c.busy]) : false);
      return badge(bx, by, c.name, MONITOR, isActive(hass.states[entity]), "pc", () => openComputer(c),
        pcPress(entity, () => toggle(entity, c.name), () => openComputer(c)), busy);
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

  /** Lights placed one by one: a dot (or a line for a strip) in their colour; tap to switch that one. */
  private fixtures2d(project: (x: number, y: number) => [number, number]) {
    const hass = store.hass!;
    return Object.values(config.plan?.lights ?? {}).flat().map((l) => {
      const st = hass.states[l.entity];
      if (!st) return nothing;
      const on = isActive(st);
      const rgb = st.attributes.rgb_color as number[] | undefined;
      const color = on ? (rgb ? `rgb(${rgb.join(",")})` : "#ffc98a") : "#5d6368";
      const name = entityName(hass, l.entity, config);
      const [x, y] = project(...l.at);
      const tap = () => toggle(l.entity, name);
      if (l.kind === "strip" && l.to) {
        const [x2, y2] = project(...l.to);
        return svg`<g class="fixture" role="button" aria-label="${name} : ${on ? "allumé" : "éteint"}" @click=${tap}>
          <line x1=${x} y1=${y} x2=${x2} y2=${y2} stroke="transparent" stroke-width="22" />
          ${on ? svg`<line x1=${x} y1=${y} x2=${x2} y2=${y2} stroke=${color} stroke-width="14" opacity="0.35" stroke-linecap="round" />` : nothing}
          <line x1=${x} y1=${y} x2=${x2} y2=${y2} stroke=${color} stroke-width="5" stroke-linecap="round" /><title>${name}</title></g>`;
      }
      if (l.kind === "spot")
        return svg`<g class="fixture" role="button" aria-label="${name} : ${on ? "allumé" : "éteint"}" @click=${tap}>
          ${on ? svg`<circle cx=${x} cy=${y} r="34" fill=${color} opacity="0.22" />` : nothing}
          <circle cx=${x} cy=${y} r="11" fill="#2b2f3a" stroke="#1c2027" stroke-width="2" />
          <circle cx=${x} cy=${y} r="6" fill=${color} />
          <title>${name}</title></g>`;
      const r = l.kind === "ceiling" ? 13 : 10;
      return svg`<g class="fixture" role="button" aria-label="${name} : ${on ? "allumé" : "éteint"}" @click=${tap}>
        ${on ? svg`<circle cx=${x} cy=${y} r=${r * 2.6} fill=${color} opacity="0.28" />` : nothing}
        <circle cx=${x} cy=${y} r=${r} fill=${color} stroke="#1c2027" stroke-width="3" />
        ${l.kind === "ceiling" ? svg`<circle cx=${x} cy=${y} r=${r / 2.4} fill="#fff" opacity=${on ? 0.9 : 0.25} />` : nothing}
        <title>${name}</title></g>`;
    });
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

  private three = !!customElements.get("kh-plan3d");

  /** Real 3D (three.js), downloaded the first time 3D is chosen. */
  private plan3d() {
    if (!this.three) {
      import("./plan3d.ts").then(() => ((this.three = true), this.requestUpdate()));
      return html`<div style="height:40vh" aria-busy="true"></div>`;
    }
    return html`<kh-plan3d .rooms=${this.rooms} prefix=${this.prefix} @plan3d-unavailable=${() => this.setMode("2d")}></kh-plan3d>`;
  }

  private plan2d() {
    const hass = store.hass!;
    const sky = currentSky();
    const night = hass.states["sun.sun"]?.state === "below_horizon";
    const wide = this.wide;
    // Landscape: the plan turned a quarter (the salon on the left); text stays upright.
    const at = (x: number, y: number): [number, number] => (wide ? [y, 800 - x] : [x, y]);
    const view = wide ? "100 40 1250 720" : "40 100 720 1250";
    const turn = wide ? "translate(0 800) rotate(-90)" : "";
    const byId = new Map((this.rooms ?? []).map((r) => [r.id, r]));
    const tvs = config.plan?.tvs ?? {};
    const pcs = config.plan?.computers ?? {};
    const lit = (r?: Room) => !!r && planLights(r).some((id) => isActive(hass.states[id]));

    // What a room's label must not cover: the placed lights and the PC / TV badges.
    const taken: Spot[] = [
      ...Object.values(config.plan?.lights ?? {}).flat().map((l): Spot => {
        const [x1, y1] = at(...l.at);
        const [x2, y2] = l.to ? at(...l.to) : [x1, y1];
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, w: Math.abs(x2 - x1) + 44, h: Math.abs(y2 - y1) + 44 };
      }),
      ...Object.entries(config.plan?.computers ?? {}).flatMap(([id, entity]): Spot[] => {
        const p = ROOMS[id]?.pc, c = config.home.computers.find((x) => x.entity === entity);
        if (!p || !c) return [];
        const [x, y] = at(...(ROOMS[id].pcBadge ?? [p[0] + p[2] / 2, p[1] + p[3] / 2]));
        return [{ x, y, w: 34 + c.name.length * 10.5, h: 36 }];
      }),
      ...Object.entries(config.plan?.tvs ?? {}).flatMap(([id]): Spot[] => {
        const p = ROOMS[id];
        if (!p?.tv) return [];
        const [x, y] = at(...(p.tvBadge ?? [p.tv[0] + p.tv[2] / 2, p.tv[1] + p.tv[3] / 2]));
        return [{ x, y, w: 34 + (id.length + 3) * 10.5, h: 36 }];
      }),
    ];

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
          return (p.windows ?? []).map(([a, b]) => svg`<rect class="window ${open ? "open" : ""}" x="718" y=${a} width="14" height=${b - a} rx="3" style=${open ? "" : `fill: ${sky.window}`} />`);
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
        // The label (bulb, name, humidity) moves aside from the lights and badges it would cover.
        const [lx, ly] = at(...p.label);
        const tt = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
        const box: Spot = { x: lx, y: ly - 17, w: Math.max(80, r.name.length * 14 + (isNaN(tt) ? 0 : 56)), h: 96 };
        const [dx, dy] = freeSpot(box, taken, 34);
        taken.push({ ...box, x: box.x + dx, y: box.y + dy });
        const [x, y] = [lx + dx, ly + dy];
        const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
        const hum = r.humidity ? Number(hass.states[r.humidity]?.state) : NaN;
        const on = lit(r);
        const presence = r.motion.some((m) => isActive(hass.states[m]));
        const climate = !isNaN(hum) ? `${formatNumber(hum, 0)} %` : "";
        const small = id === "toilette";
        return svg`
          ${presence ? svg`<circle class="presence" cx=${x} cy=${y - 30} r="40" />` : nothing}
          <text class="label ${small ? "small" : ""}" x=${x} y=${y} text-anchor="middle">${r.name}${!isNaN(t) ? svg`<tspan class="temp" dx="8">${formatNumber(t)}°</tspan>` : nothing}</text>
          ${climate ? svg`<text class="label small" x=${x} y=${y + 22} text-anchor="middle">${climate}</text>` : nothing}
          ${planLights(r).length
            ? svg`<g class="bulb ${on ? "on" : ""}" transform="translate(${x - (small ? 13 : 18)} ${y - (small ? 46 : 62)}) scale(${small ? 0.72 : 1})" role="button" aria-label=${on ? `Éteindre ${r.name}` : `Allumer ${r.name}`}
                @click=${() => setLights(planLights(r), !on)}><circle cx="18" cy="18" r="20" /><path d=${LAMP} transform="translate(6 6)" /></g>`
            : nothing}`;
      })}
      ${this.fixtures2d(at)}
      ${this.deviceBadges(at)}
    </svg>`;
  }
}
customElements.define("kh-floorplan", KhFloorplan);
