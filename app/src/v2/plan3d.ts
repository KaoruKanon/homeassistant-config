import { LitElement, css, html, nothing } from "lit";
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { isPending, openMoreInfo, setLights, toggle } from "../actions.ts";
import { pcPress } from "../components/gestures.ts";
import { config } from "../config.ts";
import { formatNumber, isActive } from "../format.ts";
import { openComputer } from "../popups/index.ts";
import type { Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { FURNITURE, FURNITURE_3D, ROOMS, WALLS, planLights } from "./plan-data.ts";
import { roomColors } from "./room-art.ts";
import { currentSky } from "./sky.ts";
import { computer, flatTv, gamingSetup, model } from "./plan3d-models.ts";

// Plan units are ~cm; the scene is centred on the flat, y up.
const CX = 400, CZ = 722;
const WALL_H = 80;

/** A box from a plan rectangle (x, y, w, h) standing on the floor, height z. */
function slab(x: number, y: number, w: number, h: number, z: number, mat: MeshStandardMaterial, lift = 0): Mesh {
  const m = new Mesh(new BoxGeometry(w, z, h), mat);
  m.position.set(x + w / 2 - CX, lift + z / 2, y + h / 2 - CZ);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const mat = (color: string, extra: Partial<{ roughness: number; emissive: string; transparent: boolean; opacity: number }> = {}) =>
  new MeshStandardMaterial({ color, roughness: extra.roughness ?? 0.85, emissive: extra.emissive ?? "#000000", transparent: extra.transparent, opacity: extra.opacity ?? 1 });

interface Live {
  floors: Map<string, MeshStandardMaterial>;
  floorBase: Map<string, Color>;
  lamps: Map<string, PointLight>;
  windows: Map<string, MeshStandardMaterial[]>;
  /** Sun patches on the floor, one per window. */
  beams: { mesh: Mesh; a: number; b: number; minX: number }[];
  tvs: Map<string, { m: MeshStandardMaterial; light: PointLight }>;
  pcs: Map<string, MeshStandardMaterial[]>;
  /** Lights placed one by one: their glowing part and their light(s). */
  fixtures: Map<string, { glow: MeshStandardMaterial; lights: (PointLight | SpotLight)[]; base: number }>;
}

/**
 * The flat in real 3D (three.js): orbit with a finger or the mouse, the
 * lights of the house drive the lamps of the scene. Labels, bulbs and the
 * TV / PC badges are HTML laid over the canvas. Renders on demand only.
 */
export class KhPlan3d extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {} };
  declare rooms: Room[];
  declare prefix: string;

  private renderer?: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(32, 16 / 9, 10, 6000);
  private controls?: OrbitControls;
  private sun = new DirectionalLight("#fff4e0", 2.2);
  private hemi = new HemisphereLight("#cfe3ff", "#3a3020", 1.1);
  private ambient = new AmbientLight("#ffffff", 0.35);
  private live?: Live;
  private picks: Object3D[] = [];
  private frame = 0;
  private resize = new ResizeObserver(() => this.fit());
  private down?: { x: number; y: number };
  /** The next update only moves the labels (a new frame), the house did not change. */
  private labelsOnly = false;
  /** Until the user turns the view, it follows the screen's shape. */
  private moved = false;
  private narrow = false;

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const p = config.plan;
      return [
        ...(this.rooms ?? []).flatMap((r) => [...planLights(r), ...r.openings, ...[r.temperature].filter((x): x is string => !!x)]),
        ...Object.values(p?.tvs ?? {}),
        ...Object.values(p?.computers ?? {}),
        "sun.sun",
        ...config.weather,
      ];
    });
  }

  static styles = [
    base,
    css`
      :host {
        display: block;
        position: relative;
      }
      canvas {
        display: block;
        width: 100%;
        border-radius: 14px;
        touch-action: none;
        cursor: grab;
      }
      canvas:active {
        cursor: grabbing;
      }
      .overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .tag {
        position: absolute;
        transform: translate(-50%, -50%);
        display: grid;
        justify-items: center;
        gap: 2px;
        color: #fff;
        font-weight: 800;
        font-size: 0.875rem;
        text-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
        white-space: nowrap;
      }
      .tag .name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .tag .t {
        padding: 1px 7px;
        border-radius: 9px;
        background: rgb(0 0 0 / 0.45);
        font-size: 0.8125rem;
        font-variant-numeric: tabular-nums;
      }
      .bulb {
        pointer-events: auto;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgb(0 0 0 / 0.5);
        color: #fff;
      }
      .bulb.on {
        background: rgb(255 160 0);
        color: #2b2003;
      }
      .bulb ha-icon {
        --mdc-icon-size: 20px;
      }
      .badge {
        pointer-events: auto;
        position: absolute;
        transform: translate(-50%, -50%);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        padding: 0 11px;
        border-radius: 15px;
        background: rgb(20 22 30 / 0.8);
        border: 1px solid rgb(255 255 255 / 0.25);
        color: #e9eaeb;
        font-weight: 700;
        font-size: 0.8125rem;
        white-space: nowrap;
      }
      .badge ha-icon {
        --mdc-icon-size: 16px;
      }
      .badge.pc.on {
        background: rgb(33 150 243 / 0.85);
        border-color: #4fc3f7;
        color: #fff;
      }
      .badge.busy {
        background-image: linear-gradient(90deg, transparent, rgb(79 195 247 / 0.9), transparent);
        background-size: 40% 3px;
        background-position: -40% 100%;
        background-repeat: no-repeat;
        animation: kh-progress 1.3s ease-in-out infinite;
      }
      @keyframes kh-progress {
        to {
          background-position: 140% 100%;
        }
      }
      .badge.tv.on {
        background: rgb(123 92 255 / 0.85);
        border-color: #b48cff;
        color: #fff;
      }
      :host([narrow]) .tag {
        font-size: 0.75rem;
      }
      :host([narrow]) .tag small,
      :host([narrow]) .badge {
        display: none;
      }
      :host([narrow]) .bulb {
        width: 28px;
        height: 28px;
      }
      .hint {
        position: absolute;
        left: 12px;
        bottom: 10px;
        font-size: 0.75rem;
        font-weight: 600;
        color: rgb(255 255 255 / 0.6);
        pointer-events: none;
      }
    `,
  ];

  private onPending = () => this.requestUpdate();

  connectedCallback(): void {
    super.connectedCallback();
    this.resize.observe(this);
    window.addEventListener("kh-pending", this.onPending);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resize.disconnect();
    window.removeEventListener("kh-pending", this.onPending);
    cancelAnimationFrame(this.frame);
    this.controls?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as MeshStandardMaterial).dispose();
      }
    });
    this.renderer?.dispose();
    this.renderer = undefined;
    this.live = undefined;
  }

  protected firstUpdated(): void {
    const canvas = this.renderRoot.querySelector("canvas")!;
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      this.dispatchEvent(new CustomEvent("plan3d-unavailable", { bubbles: true, composed: true }));
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFSoftShadowMap;
    this.build();
    // Seen from the salon's corner, high enough to take in the whole flat.
    this.camera.position.set(-1050, 1500, 1050);
    const c = new OrbitControls(this.camera, canvas);
    c.target.set(0, 0, 0);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.maxPolarAngle = Math.PI * 0.45;
    c.minDistance = 450;
    c.maxDistance = 3200;
    c.enablePan = false;
    c.addEventListener("change", () => this.request());
    c.addEventListener("start", () => (this.moved = true));
    this.controls = c;
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerup", (e) => this.pick(e));
    this.fit();
  }

  private build(): void {
    const s = this.scene;
    s.add(this.ambient, this.hemi);
    this.sun.position.set(-500, 900, 300);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -800;
    sc.right = 800;
    sc.top = 800;
    sc.bottom = -800;
    sc.far = 3000;
    s.add(this.sun);

    const live: Live = { floors: new Map(), floorBase: new Map(), lamps: new Map(), windows: new Map(), beams: [], tvs: new Map(), pcs: new Map(), fixtures: new Map() };
    const byId = new Map((this.rooms ?? []).map((r) => [r.id, r]));

    // Ground slab under the flat.
    const ground = slab(55, 105, 690, 1235, 6, mat("#1c2027"), -6);
    ground.castShadow = false;
    s.add(ground);

    for (const [id, p] of Object.entries(ROOMS)) {
      const pts = p.points.split(" ").map((xy) => xy.split(",").map(Number));
      const shape = new Shape();
      pts.forEach(([x, y], i) => (i ? shape.lineTo(x - CX, -(y - CZ)) : shape.moveTo(x - CX, -(y - CZ))));
      const [wall] = roomColors(byId.get(id) ?? { id, name: id, icon: "" });
      const m = mat(wall, { roughness: 0.95 });
      const floor = new Mesh(new ShapeGeometry(shape), m);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.5;
      floor.receiveShadow = true;
      floor.userData = { room: id };
      s.add(floor);
      this.picks.push(floor);
      live.floors.set(id, m);
      live.floorBase.set(id, new Color(wall));
      if (!config.plan?.lights?.[id]?.length) {
        const lamp = new PointLight("#ffbb66", 0, 420, 1.8);
        lamp.position.set(p.label[0] - CX, 190, p.label[1] - CZ);
        s.add(lamp);
        live.lamps.set(id, lamp);
      }
    }
    // The cupboard behind the folding door.
    s.add(slab(80, 639, 110, 341, 1, mat("#3a3f4b")));

    const walls = new Group();
    const wallMat = mat("#d9d4cc", { roughness: 0.9 });
    for (const [x, y, w, h] of WALLS) walls.add(slab(x, y, w, h, WALL_H, wallMat));
    s.add(walls);

    for (const [id, p] of Object.entries(ROOMS)) {
      const list: MeshStandardMaterial[] = [];
      const minX = Math.min(...p.points.split(" ").map((xy) => Number(xy.split(",")[0])));
      for (const [a, b] of p.windows ?? []) {
        const m = mat("#8ecae6", { roughness: 0.2, transparent: true, opacity: 0.85 });
        s.add(slab(717, a, 16, b - a, 46, m, 30));
        list.push(m);
        // The patch of sunlight this window casts on the floor (moved in sync()).
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(new Array(12).fill(0), 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const beamMat = new MeshBasicMaterial({ color: "#fff1c9", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
        const beam = new Mesh(geo, beamMat);
        beam.renderOrder = 2;
        s.add(beam);
        live.beams.push({ mesh: beam, a, b, minX });
      }
      live.windows.set(id, list);
    }

    for (const [name, x, y, w, h, rot] of FURNITURE) {
      const g = model(name, w, h);
      if (g) {
        g.position.set(x + w / 2 - CX, 0, y + h / 2 - CZ);
        g.rotation.y = (-rot * Math.PI) / 180;
        s.add(g);
        continue;
      }
      const turned = Math.abs(rot) % 180 === 90;
      const bw = turned ? h : w, bh = turned ? w : h;
      const [z, color] = FURNITURE_3D[name] ?? [20, "#8a5d3f"];
      s.add(slab(x + w / 2 - bw / 2, y + h / 2 - bh / 2, bw, bh, z, mat(color)));
    }

    // Screens: TVs on their chest of drawers, PCs on their desks, facing the room.
    const place = (g: Group, cx: number, cy: number, top: number, facing: number) => {
      g.position.set(cx - CX, top, cy - CZ);
      g.rotation.y = facing;
      s.add(g);
    };
    const pickable = (g: Group, data: Record<string, string>) =>
      g.traverse((o) => {
        if (o instanceof Mesh) {
          o.userData = data;
          this.picks.push(o);
        }
      });
    const FACING: Record<string, number> = { salon: Math.PI / 2, chambre_papa: -Math.PI / 2, chambre_william: 0 };
    for (const [id, entity] of Object.entries(config.plan?.tvs ?? {})) {
      const p = ROOMS[id]?.tv;
      if (!p) continue;
      const { group, screen } = flatTv(Math.max(p[2], p[3]) * 0.9);
      place(group, p[0] + p[2] / 2, p[1] + p[3] / 2, id === "salon" ? 46 : 82, FACING[id] ?? 0); // salon: on the low TV stand
      pickable(group, { tv: entity });
      const light = new PointLight("#9b7bff", 0, 260, 1.8);
      light.position.set(p[0] - CX + (id === "salon" ? 50 : -50), 110, p[1] + p[3] / 2 - CZ);
      s.add(light);
      live.tvs.set(entity, { m: screen, light });
    }
    for (const [id, entity] of Object.entries(config.plan?.computers ?? {})) {
      const p = ROOMS[id]?.pc;
      if (!p) continue;
      // Chambre William: the gaming setup, its tower on the desk extension;
      // elsewhere a monitor with the tower on the floor beside the desk.
      const { group, screens } = id === "chambre_william" ? gamingSetup([110, 0, -6]) : computer(Math.max(p[2], p[3]), [30, -76, -12]);
      place(group, p[0] + p[2] / 2, p[1] + p[3] / 2, 76, FACING[id] ?? 0);
      pickable(group, { pc: entity });
      live.pcs.set(entity, screens);
    }

    // Lights placed one by one (ceiling lights, lamps, LED strips).
    for (const list of Object.values(config.plan?.lights ?? {}))
      for (const l of list) {
        const glow = new MeshStandardMaterial({ color: "#f4efe6", roughness: 0.6, emissive: "#ffcf8a", emissiveIntensity: 0 });
        const lights: (PointLight | SpotLight)[] = [];
        const [x, y] = l.at;
        if (l.kind === "spot") {
          // Ceiling spot: a round base and a short can tilted down, a real cone of light.
          const g = new Group();
          const baseMat = mat("#2b2f3a", { roughness: 0.4 });
          const base = new Mesh(new CylinderGeometry(6, 6, 2, 20), baseMat);
          base.position.set(0, 170, 0);
          g.add(base);
          const can = new Mesh(new CylinderGeometry(5, 4.5, 11, 20), baseMat);
          can.position.set(0, 163, 0);
          can.rotation.z = 0.25;
          g.add(can);
          const lens = new Mesh(new CylinderGeometry(4, 4, 0.8, 20), glow);
          lens.position.set(1.4, 157.3, 0);
          lens.rotation.z = 0.25;
          g.add(lens);
          g.position.set(x - CX, 0, y - CZ);
          s.add(g);
          const spot = new SpotLight("#ffd9a0", 0, 420, Math.PI / 4.5, 0.55, 1.4);
          spot.position.set(x - CX + 1.5, 157, y - CZ);
          spot.target.position.set(x - CX + 25, 0, y - CZ);
          spot.castShadow = false;
          s.add(spot, spot.target);
          lights.push(spot);
        } else if (l.kind === "ceiling") {
          const g = new Group();
          const cord = new Mesh(new CylinderGeometry(0.4, 0.4, 40, 6), mat("#3a3f4b"));
          cord.position.set(0, 140, 0);
          g.add(cord);
          const shade = new Mesh(new CylinderGeometry(5, 15, 11, 24, 1, true), mat("#e8e2d6", { roughness: 0.7 }));
          shade.position.set(0, 133, 0);
          g.add(shade);
          const bulb = new Mesh(new SphereGeometry(7, 16, 12), glow);
          bulb.position.set(0, 128, 0);
          g.add(bulb);
          g.position.set(x - CX, 0, y - CZ);
          s.add(g);
          const pl = new PointLight("#ffd9a0", 0, 520, 1.6);
          pl.position.set(x - CX, 120, y - CZ);
          pl.castShadow = false;
          s.add(pl);
          lights.push(pl);
        } else if (l.kind === "lamp") {
          // Japanese paper lantern on the desk.
          const g = new Group();
          const foot = new Mesh(new CylinderGeometry(6, 7, 2, 16), mat("#2b2f3a"));
          foot.position.set(0, 77, 0);
          g.add(foot);
          const lantern = new Mesh(new SphereGeometry(13, 20, 16), glow);
          lantern.scale.y = 1.25;
          lantern.position.set(0, 94, 0);
          g.add(lantern);
          g.position.set(x - CX, 0, y - CZ);
          s.add(g);
          const pl = new PointLight("#ffc98a", 0, 300, 1.8);
          pl.position.set(x - CX, 96, y - CZ);
          s.add(pl);
          lights.push(pl);
        } else if (l.to) {
          // LED strip along the wall behind the desk.
          const [x2, y2] = l.to;
          const len = Math.hypot(x2 - x, y2 - y);
          const strip = new Mesh(new BoxGeometry(len, 1.5, 1.5), glow);
          strip.position.set((x + x2) / 2 - CX, 92, (y + y2) / 2 - CZ);
          strip.rotation.y = -Math.atan2(y2 - y, x2 - x);
          s.add(strip);
          for (const f of [0.2, 0.5, 0.8]) {
            const pl = new PointLight("#b07bff", 0, 160, 2);
            pl.position.set(x + (x2 - x) * f - CX, 88, y + (y2 - y) * f + 8 - CZ);
            s.add(pl);
            lights.push(pl);
          }
        }
        live.fixtures.set(l.entity, { glow, lights, base: l.kind === "spot" ? 9 : l.kind === "ceiling" ? 4 : l.kind === "lamp" ? 1.6 : 0.9 });
      }
    this.live = live;
  }

  /** Lights, windows and screens follow the house. */
  private sync(): void {
    const hass = store.hass, live = this.live;
    if (!hass || !live) return;
    const night = hass.states["sun.sun"]?.state === "below_horizon";
    const sky = currentSky();
    // The sun where it really is: its bearing relative to the windows (which look out along +x).
    const rad = (d: number) => (d * Math.PI) / 180;
    const phi = rad(sky.azimuth - (config.plan?.windowsFacing ?? 225));
    const el = rad(Math.max(sky.elevation, 4));
    const toSun = new Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
    this.sun.position.copy(toSun).multiplyScalar(1400);
    this.sun.intensity = sky.sun;
    this.sun.color.set(sky.sunColor);
    this.hemi.intensity = sky.ambient * 3;
    this.hemi.color.set(sky.window);
    this.ambient.intensity = sky.ambient;
    // Sun patches: each window corner projected on the floor along the sunlight.
    const into = toSun.clone().negate();
    for (const { mesh, a, b, minX } of live.beams) {
      const mat = mesh.material as MeshBasicMaterial;
      const lit = sky.beam > 0.02 && into.y < -0.05 && into.x < -0.05;
      mat.opacity = lit ? 0.6 * sky.beam : 0;
      mat.color.set(sky.sunColor);
      if (!lit) continue;
      const pos = mesh.geometry.getAttribute("position") as Float32BufferAttribute;
      const corners: [number, number][] = [[a, 30], [b, 30], [b, 76], [a, 76]];
      corners.forEach(([z, y], i) => {
        const t = (y - 1) / -into.y;
        const fx = Math.max(minX + 10 - CX, 717 - CX + into.x * t);
        pos.setXYZ(i, fx, 1, z - CZ + into.z * t);
      });
      pos.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    }
    for (const r of this.rooms ?? []) {
      const on = planLights(r).some((id) => isActive(hass.states[id]));
      const lamp = live.lamps.get(r.id);
      if (lamp) lamp.intensity = on ? (night ? 4.5 : 3) * 10000 : 0;
      const floor = live.floors.get(r.id), baseColor = live.floorBase.get(r.id);
      if (floor && baseColor) floor.emissive.set(on ? "#3a2400" : "#000000");
      const open = r.openings.some((o) => isActive(hass.states[o]));
      for (const w of live.windows.get(r.id) ?? []) {
        w.color.set(open ? "#ff6b5e" : sky.window);
        w.emissive.set(open ? "#7a1408" : sky.window);
        w.emissiveIntensity = open ? 1 : sky.glow;
      }
    }
    for (const [entity, { m, light }] of live.tvs) {
      const on = isActive(hass.states[entity]);
      m.emissiveIntensity = on ? 1.15 : 0; // the picture shows only while it plays
      light.intensity = on ? 4 * 10000 : 0;
    }
    for (const [entity, list] of live.pcs) {
      const on = isActive(hass.states[entity]);
      for (const m of list) m.emissiveIntensity = on ? 1.3 : 0;
    }
    // Each placed light in its own colour and brightness.
    for (const [entity, f] of live.fixtures) {
      const st = hass.states[entity];
      const on = isActive(st);
      const level = on ? (Number(st?.attributes.brightness ?? 255) / 255) : 0;
      const rgb = st?.attributes.rgb_color as [number, number, number] | undefined;
      const color = rgb ? new Color(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`) : new Color("#ffc98a");
      f.glow.emissive.copy(color);
      f.glow.emissiveIntensity = on ? 0.6 + level * 1.2 : 0;
      for (const l of f.lights) {
        l.color.copy(color);
        l.intensity = on ? f.base * (0.35 + level * 0.65) * 10000 : 0;
      }
    }
    this.request();
  }

  private fit(): void {
    const r = this.renderer;
    if (!r) return;
    const w = this.clientWidth || 600;
    this.narrow = w < 600;
    // Phones: a tall view along the length of the flat; wide screens: from the salon's corner.
    const h = Math.round(this.narrow ? Math.min(w * 1.25, window.innerHeight * 0.62) : Math.min(w * 0.6, window.innerHeight * 0.62));
    r.setSize(w, h, false);
    if (!this.moved) this.camera.position.set(...((this.narrow ? [0, 1550, 1150] : [-1050, 1500, 1050]) as [number, number, number]));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  /** One frame, then more only while the view is still moving (damping). */
  private request(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.renderer) return;
      const moving = this.controls?.update() ?? false;
      this.renderer.render(this.scene, this.camera);
      this.labelsOnly = true;
      this.requestUpdate(); // labels follow the camera
      if (moving) this.request();
    });
  }

  private pick(e: PointerEvent): void {
    if (!this.down || !this.renderer || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.picks, false)[0]?.object.userData;
    if (!hit) return;
    if (hit.tv) openMoreInfo(this, hit.tv);
    else if (hit.pc) {
      const c = config.home.computers.find((x) => x.entity === hit.pc);
      if (c) openComputer(c);
    } else if (hit.room && this.rooms?.some((r) => r.id === hit.room)) {
      history.pushState(null, "", `${this.prefix}/pieces/${hit.room}${location.search}`);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
  }

  /** Screen position (px, in the canvas) of a plan point at height z; undefined when behind the camera. */
  private at(x: number, y: number, z: number): [number, number] | undefined {
    const r = this.renderer;
    if (!r) return undefined;
    const v = new Vector3(x - CX, z, y - CZ).project(this.camera);
    if (v.z > 1) return undefined;
    const c = r.domElement;
    return [((v.x + 1) / 2) * c.clientWidth, ((1 - v.y) / 2) * c.clientHeight];
  }

  protected updated(): void {
    this.toggleAttribute("narrow", this.narrow);
    if (this.labelsOnly) this.labelsOnly = false;
    else this.sync();
  }

  render() {
    const hass = store.hass;
    const rooms = this.rooms ?? [];
    return html`<canvas aria-label="Vue 3D de l'appartement : glisser pour tourner, pincer pour zoomer"></canvas>
      <div class="overlay">
        ${hass && this.renderer
          ? html`${rooms.map((r) => {
              const p = ROOMS[r.id];
              const pos = p && this.at(p.label[0], p.label[1], 150);
              if (!pos) return nothing;
              const lights = planLights(r);
              const on = lights.some((id) => isActive(hass.states[id]));
              const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
              return html`<div class="tag" style="left:${pos[0]}px; top:${pos[1]}px">
                ${lights.length
                  ? html`<button class="bulb ${on ? "on" : ""}" aria-label=${on ? `Éteindre ${r.name}` : `Allumer ${r.name}`}
                      @click=${() => setLights(lights, !on)}><ha-icon icon=${on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon></button>`
                  : nothing}
                <span class="name">${r.name}${!isNaN(t) ? html`<span class="t">${formatNumber(t)}°</span>` : nothing}</span>
              </div>`;
            })}
            ${Object.entries(config.plan?.computers ?? {}).map(([id, entity]) => {
              const p = ROOMS[id]?.pc, c = config.home.computers.find((x) => x.entity === entity);
              const [bx, by] = ROOMS[id]?.pcBadge ?? (p ? [p[0] + p[2] / 2, p[1] + p[3] / 2] : [0, 0]);
              const pos = p && this.at(bx, by, 165);
              if (!pos || !c) return nothing;
              const on = isActive(hass.states[entity]);
              const busy = isPending(entity) || (c.busy ? isActive(hass.states[c.busy]) : false);
              const press = pcPress(entity, () => toggle(entity, c.name), () => openComputer(c));
              return html`<button class="badge pc ${on ? "on" : ""} ${busy ? "busy" : ""}" style="left:${pos[0]}px; top:${pos[1]}px"
                aria-description="Appui : allumer ou éteindre ; appui long ou double appui : détails"
                @pointerdown=${press.down} @pointermove=${press.move} @pointerup=${press.cancel} @pointercancel=${press.cancel}
                @contextmenu=${press.contextmenu} @click=${press.click}>
                <ha-icon icon="mdi:monitor"></ha-icon>${c.name}</button>`;
            })}
            ${Object.entries(config.plan?.tvs ?? {}).map(([id, entity]) => {
              const p = ROOMS[id];
              const [bx, by] = p?.tvBadge ?? [0, 0];
              const pos = p?.tv && this.at(bx, by, 175);
              if (!pos || !hass.states[entity]) return nothing;
              const on = isActive(hass.states[entity]);
              const name = (rooms.find((r) => r.id === id)?.name ?? id).replace(/^Chambre /, "");
              return html`<button class="badge tv ${on ? "on" : ""}" style="left:${pos[0]}px; top:${pos[1]}px" @click=${() => openMoreInfo(this, entity)}>
                <ha-icon icon="mdi:television"></ha-icon>TV ${name}</button>`;
            })}`
          : nothing}
      </div>
      <div class="hint">Glisser pour tourner, pincer ou molette pour zoomer</div>`;
  }
}
customElements.define("kh-plan3d", KhPlan3d);
