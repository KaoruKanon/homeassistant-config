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
  RingGeometry,
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
import { openComputer } from "../popups/open.ts";
import { entityName, type Room } from "../rooms.ts";
import { EntitiesController, RegistryController, store } from "../store.ts";
import { base } from "../styles.ts";
import { FURNITURE, FURNITURE_3D, ROOMS, WALLS, freeSpot, planLights, type Spot } from "./plan-data.ts";
import { currentSky } from "./sky.ts";
import { andon, computer, flatTv, gamingSetup, lino, model, speaker, standingFan } from "./plan3d-models.ts";

// Plan units are ~cm; the scene is centred on the flat, y up.
const CX = 400, CZ = 722;
const WALL_H = 240; // real height (cm), like the furniture
/** The facade with the windows, and the window's sill and glass heights. */
const FACADE_X = 720;
const SILL = 95;
const GLASS_H = 120;
/** Height of each kind of placed light, for its button on the overlay. */
const FIXTURE_Z: Record<string, number> = { spot: 228, ceiling: 200, lamp: 94, strip: 92 };

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
  pcs: Map<string, { mats: MeshStandardMaterial[]; lights: PointLight[] }>;
  /** Lights placed one by one: their glowing part and their light(s). */
  fixtures: Map<string, { glow: MeshStandardMaterial; lights: (PointLight | SpotLight)[]; base: number }>;
  /** Window sashes, by room: they swing in when the window is open. */
  sashes: Map<string, Group[]>;
  /** A soft ring on the floor of a room while its motion sensor sees someone. */
  motion: Map<string, Mesh>;
  speakers: Map<string, MeshStandardMaterial>;
  fans: Map<string, Group>;
  /** What the cutaway lowers (walls) or hides (windows, lintels) on the camera's side. */
  cut: { o: Object3D; cx: number; cz: number; h: number; lift: number; hide: boolean }[];
}

/** Floor tint of the temperature layer: blue (cool) to red (warm). */
const TEMP_SCALE: [number, string][] = [[16, "#4fc3f7"], [19, "#81c784"], [22, "#ffd54f"], [25, "#ff8a65"], [28, "#e53935"]];
function tempColor(t: number): Color {
  const i = TEMP_SCALE.findIndex(([v]) => t < v);
  if (i <= 0) return new Color(TEMP_SCALE[i === 0 ? 0 : TEMP_SCALE.length - 1][1]);
  const [a, ca] = TEMP_SCALE[i - 1], [b, cb] = TEMP_SCALE[i];
  return new Color(ca).lerp(new Color(cb), (t - a) / (b - a));
}

type View = "overview" | "top";

/**
 * The flat in real 3D (three.js): orbit with a finger or the mouse, the
 * lights of the house drive the lamps of the scene. Labels, bulbs and the
 * TV / PC badges are HTML laid over the canvas. Renders on demand only.
 */
export class KhPlan3d extends LitElement {
  static properties = { rooms: { attribute: false }, prefix: {}, landscape: { type: Boolean } };
  /** Wide framing even in a narrow column (Maison V1 bis home); labels stay compact. */
  declare landscape: boolean;
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
  /** The room the camera came close to (a second tap opens it). */
  private focused?: string;
  /** A camera move in progress (room focus, preset views). */
  private tween?: { p0: Vector3; p1: Vector3; t0: Vector3; t1: Vector3; start: number };
  private view: View = "overview";
  /** "temp": floors tinted by each room's temperature. */
  private layer: "none" | "temp" = "none";
  private spin = 0;
  private narrow = false;
  /** Upright framing: phones, unless forced landscape. */
  private get tall(): boolean {
    return this.narrow && !this.landscape;
  }

  constructor() {
    super();
    new RegistryController(this);
    new EntitiesController(this, () => {
      const p = config.plan;
      return [
        ...(this.rooms ?? []).flatMap((r) => [...planLights(r), ...r.openings, ...r.motion, ...[r.temperature].filter((x): x is string => !!x)]),
        ...(p?.speakers ?? []).map((x) => x.entity),
        ...(p?.fans ?? []).map((x) => x.entity),
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
      .tools {
        position: absolute;
        z-index: 1;
        top: 8px;
        left: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-width: calc(100% - 120px);
      }
      .tools button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 11px;
        border-radius: 11px;
        background: rgb(0 0 0 / 0.45);
        color: rgb(255 255 255 / 0.8);
        font-weight: 800;
        font-size: 0.8125rem;
      }
      .tools button[aria-pressed="true"] {
        background: rgb(255 255 255 / 0.9);
        color: #1c2027;
      }
      .tools button.open {
        background: rgb(255 179 71 / 0.92);
        color: #2b2003;
      }
      .tools ha-icon {
        --mdc-icon-size: 17px;
      }
      :host([narrow]) .tools button:not(.open) span {
        display: none;
      }
      .legend {
        position: absolute;
        z-index: 1;
        right: 12px;
        bottom: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: rgb(255 255 255 / 0.75);
      }
      .legend i {
        width: 90px;
        height: 8px;
        border-radius: 4px;
        background: linear-gradient(90deg, #4fc3f7, #81c784, #ffd54f, #ff8a65, #e53935);
      }
      .fix {
        pointer-events: auto;
        position: absolute;
        transform: translate(-50%, -50%);
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgb(20 22 30 / 0.75);
        border: 1px solid rgb(255 255 255 / 0.3);
        color: #e9eaeb;
      }
      .fix.on {
        background: rgb(255 179 71 / 0.92);
        border-color: #ffd27a;
        color: #2b2003;
        box-shadow: 0 0 14px rgb(255 190 90 / 0.7);
      }
      .fix ha-icon {
        --mdc-icon-size: 17px;
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
    cancelAnimationFrame(this.spin);
    this.spin = 0;
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
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // sharp enough, lighter on tablets
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
    c.addEventListener("start", () => ((this.moved = true), (this.tween = undefined)));
    try {
      this.view = localStorage.getItem("kh-plan3d-view") === "top" ? "top" : "overview";
      this.layer = localStorage.getItem("kh-plan3d-layer") === "temp" ? "temp" : "none";
    } catch {
      /* not kept */
    }
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

    const live: Live = { floors: new Map(), floorBase: new Map(), lamps: new Map(), windows: new Map(), beams: [], tvs: new Map(), pcs: new Map(), fixtures: new Map(), sashes: new Map(), motion: new Map(), speakers: new Map(), fans: new Map(), cut: [] };

    // Ground slab under the flat.
    const ground = slab(55, 105, 690, 1235, 6, mat("#1c2027"), -6);
    ground.castShadow = false;
    s.add(ground);

    for (const [id, p] of Object.entries(ROOMS)) {
      const pts = p.points.split(" ").map((xy) => xy.split(",").map(Number));
      const shape = new Shape();
      pts.forEach(([x, y], i) => (i ? shape.lineTo(x - CX, -(y - CZ)) : shape.moveTo(x - CX, -(y - CZ))));
      // The same orange lino in every room; the temperature layer tints it.
      const m = new MeshStandardMaterial({ color: "#ffffff", map: lino(), roughness: 0.8 });
      const floor = new Mesh(new ShapeGeometry(shape), m);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.5;
      floor.receiveShadow = true;
      floor.userData = { room: id };
      s.add(floor);
      this.picks.push(floor);
      live.floors.set(id, m);
      live.floorBase.set(id, new Color("#ffffff"));
      // Motion: a soft ring around the room's label.
      const ring = new Mesh(new RingGeometry(45, 75, 48), new MeshBasicMaterial({ color: "#64b5f6", transparent: true, opacity: 0.45, depthWrite: false, blending: AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.label[0] - CX, 1.5, p.label[1] - CZ);
      ring.visible = false;
      s.add(ring);
      live.motion.set(id, ring);
      if (!config.plan?.lights?.[id]?.length) {
        const lamp = new PointLight("#ffbb66", 0, 420, 1.8);
        lamp.position.set(p.label[0] - CX, 215, p.label[1] - CZ);
        s.add(lamp);
        live.lamps.set(id, lamp);
      }
    }
    // The cupboard behind the folding door.
    s.add(slab(80, 639, 110, 341, 1, mat("#3a3f4b")));

    const walls = new Group();
    const wallMat = mat("#d9d4cc", { roughness: 0.9 });
    const cutaway = (o: Mesh, x: number, y: number, w: number, h: number, height: number, lift = 0, hide = false) => {
      walls.add(o);
      live.cut.push({ o, cx: x + w / 2 - CX, cz: y + h / 2 - CZ, h: height, lift, hide: hide || lift > 0 });
    };
    for (const [x, y, w, h] of WALLS) cutaway(slab(x, y, w, h, WALL_H, wallMat), x, y, w, h, WALL_H);
    // The facade (x = 720, where the windows are): a wall under each window (the
    // sill) and above it, and full wall wherever the plan has neither wall nor
    // window, so a window never floats apart from the rest of the wall.
    const facade = WALLS.filter(([x, , w]) => x === FACADE_X && w === 10).map(([, y, , h]): [number, number] => [y, y + h]);
    const glass = Object.values(ROOMS).flatMap((p) => p.windows ?? []);
    for (const [a, b] of glass) {
      cutaway(slab(FACADE_X, a, 10, b - a, SILL, wallMat), FACADE_X, a, 10, b - a, SILL);
      cutaway(slab(FACADE_X, a, 10, b - a, WALL_H - SILL - GLASS_H, wallMat, SILL + GLASS_H), FACADE_X, a, 10, b - a, WALL_H - SILL - GLASS_H, SILL + GLASS_H);
    }
    const covered = [...facade, ...glass].sort((p, q) => p[0] - q[0]);
    const ys = Object.values(ROOMS).flatMap((p) => p.points.split(" ").filter((xy) => Number(xy.split(",")[0]) >= FACADE_X).map((xy) => Number(xy.split(",")[1])));
    let at = Math.min(...ys);
    for (const [a, b] of covered) {
      if (a > at) cutaway(slab(FACADE_X, at, 10, a - at, WALL_H, wallMat), FACADE_X, at, 10, a - at, WALL_H);
      at = Math.max(at, b);
    }
    s.add(walls);

    const pvc = mat("#f4f4f1", { roughness: 0.4 }), stone = mat("#e3e0da", { roughness: 0.5 }), handle = mat("#e9e9e6", { roughness: 0.3 });
    for (const [id, p] of Object.entries(ROOMS)) {
      const list: MeshStandardMaterial[] = [];
      const sashes: Group[] = [];
      const minX = Math.min(...p.points.split(" ").map((xy) => Number(xy.split(",")[0])));
      for (const [a, b] of p.windows ?? []) {
        const m = mat("#8ecae6", { roughness: 0.05, transparent: true, opacity: 0.45 });
        const L = b - a, cx = FACADE_X + 5 - CX, cz = (a + b) / 2 - CZ;
        // White PVC frame in the thickness of the wall, and the stone sill inside.
        const frame = new Group();
        const bar = (w: number, h: number, d: number, x: number, y: number, z: number, material = pvc) => {
          const o = new Mesh(new BoxGeometry(w, h, d), material);
          o.position.set(x, y, z);
          o.castShadow = true;
          frame.add(o);
        };
        bar(8, 4, L, 0, SILL + GLASS_H - 2, 0); // head
        bar(8, 4, L, 0, SILL + 2, 0); // bottom rail
        bar(8, GLASS_H, 4, 0, SILL + GLASS_H / 2, -L / 2 + 2); // jambs
        bar(8, GLASS_H, 4, 0, SILL + GLASS_H / 2, L / 2 - 2);
        bar(14, 2, L + 8, -9, SILL - 1, 0, stone); // interior sill
        frame.position.set(cx, 0, cz);
        s.add(frame);
        live.cut.push({ o: frame, cx, cz, h: GLASS_H, lift: SILL, hide: true });
        // The sash (white frame, glass, handle), hinged at its end a: it swings into the room when open.
        const sash = new Group();
        sash.position.set(cx - 2, SILL + 4, a + 4 - CZ);
        const sl = L - 8, sh = GLASS_H - 8;
        const part = (w: number, h: number, d: number, x: number, y: number, z: number, material: MeshStandardMaterial) => {
          const o = new Mesh(new BoxGeometry(w, h, d), material);
          o.position.set(x, y, z);
          sash.add(o);
        };
        part(4, 3, sl, 0, sh - 1.5, sl / 2, pvc);
        part(4, 3, sl, 0, 1.5, sl / 2, pvc);
        part(4, sh, 3, 0, sh / 2, 1.5, pvc);
        part(4, sh, 3, 0, sh / 2, sl - 1.5, pvc);
        part(0.6, sh - 6, sl - 6, 0, sh / 2, sl / 2, m); // glass
        part(2.5, 1.2, 5, -3, sh / 2, sl - 4, handle); // handle, room side
        s.add(sash);
        live.cut.push({ o: sash, cx, cz, h: GLASS_H, lift: SILL, hide: true });
        sashes.push(sash);
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
      live.sashes.set(id, sashes);
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
      const { group, screens, lights } = id === "chambre_william" ? gamingSetup([110, 0, -6]) : computer(Math.max(p[2], p[3]), [30, -76, -12]);
      place(group, p[0] + p[2] / 2, p[1] + p[3] / 2, 76, FACING[id] ?? 0);
      pickable(group, { pc: entity });
      live.pcs.set(entity, { mats: screens, lights });
    }

    for (const sp of config.plan?.speakers ?? []) {
      const { group, leds } = speaker(!!sp.wall);
      group.position.set(sp.at[0] - CX, sp.z, sp.at[1] - CZ);
      s.add(group);
      pickable(group, { speaker: sp.entity });
      live.speakers.set(sp.entity, leds);
    }
    for (const f of config.plan?.fans ?? []) {
      const { group, blades } = standingFan();
      group.position.set(f.at[0] - CX, 0, f.at[1] - CZ);
      if (f.face) group.rotation.y = Math.atan2(f.face[0] - f.at[0], f.face[1] - f.at[1]); // its head (+z) towards that point
      s.add(group);
      pickable(group, { fan: f.entity });
      live.fans.set(f.entity, blades);
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
          base.position.set(0, WALL_H - 1, 0); // on the ceiling
          g.add(base);
          const can = new Mesh(new CylinderGeometry(5, 4.5, 11, 20), baseMat);
          can.position.set(0, WALL_H - 8, 0);
          can.rotation.z = 0.25;
          g.add(can);
          const lens = new Mesh(new CylinderGeometry(4, 4, 0.8, 20), glow);
          lens.position.set(1.4, WALL_H - 13.7, 0);
          lens.rotation.z = 0.25;
          g.add(lens);
          g.position.set(x - CX, 0, y - CZ);
          s.add(g);
          const spot = new SpotLight("#ffd9a0", 0, 420, Math.PI / 4.5, 0.55, 1.4);
          spot.position.set(x - CX + 1.5, WALL_H - 14, y - CZ);
          spot.target.position.set(x - CX + 25, 0, y - CZ);
          spot.castShadow = false;
          s.add(spot, spot.target);
          lights.push(spot);
        } else if (l.kind === "ceiling") {
          const g = new Group();
          const cord = new Mesh(new CylinderGeometry(0.4, 0.4, 40, 6), mat("#3a3f4b"));
          cord.position.set(0, WALL_H - 20, 0); // hanging from the ceiling
          g.add(cord);
          const shade = new Mesh(new CylinderGeometry(5, 15, 11, 24, 1, true), mat("#e8e2d6", { roughness: 0.7 }));
          shade.position.set(0, WALL_H - 47, 0);
          g.add(shade);
          const bulb = new Mesh(new SphereGeometry(7, 16, 12), glow);
          bulb.position.set(0, WALL_H - 52, 0);
          g.add(bulb);
          g.position.set(x - CX, 0, y - CZ);
          s.add(g);
          const pl = new PointLight("#ffd9a0", 0, 520, 1.6);
          pl.position.set(x - CX, WALL_H - 60, y - CZ);
          pl.castShadow = false;
          s.add(pl);
          lights.push(pl);
        } else if (l.kind === "lamp") {
          // Japanese lamp (andon) on the desk.
          const g = andon(glow);
          g.position.set(x - CX, 76, y - CZ);
          s.add(g);
          const pl = new PointLight("#ffc98a", 0, 300, 1.8);
          pl.position.set(x - CX, 94, y - CZ);
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
      const corners: [number, number][] = [[a, SILL], [b, SILL], [b, SILL + GLASS_H], [a, SILL + GLASS_H]];
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
      if (floor && baseColor) {
        floor.emissive.set(on ? "#3a2400" : "#000000");
        const t = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
        floor.color.copy(this.layer === "temp" && !isNaN(t) ? tempColor(t) : baseColor);
      }
      const ring = live.motion.get(r.id);
      if (ring) ring.visible = r.motion.some((m) => isActive(hass.states[m]));
      const open = r.openings.some((o) => isActive(hass.states[o]));
      for (const sash of live.sashes.get(r.id) ?? []) sash.rotation.y = open ? -0.9 : 0;
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
    for (const [entity, pc] of live.pcs) {
      const on = isActive(hass.states[entity]);
      for (const m of pc.mats) m.emissiveIntensity = on ? 1.3 : 0;
      for (const l of pc.lights) l.intensity = on ? 9000 : 0; // RGB through the case's glass
    }
    for (const [entity, leds] of live.speakers) leds.emissiveIntensity = hass.states[entity]?.state === "playing" ? 1.6 : 0;
    this.spinFans();
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
    const h = Math.round(this.tall ? Math.min(w * 1.25, window.innerHeight * 0.62) : Math.min(w * 0.6, window.innerHeight * 0.62));
    r.setSize(w, h, false);
    if (!this.moved) this.camera.position.copy(this.home()[0]);
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
      let moving = this.controls?.update() ?? false;
      if (this.tween) moving = this.step() || moving;
      this.cutaway();
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
    else if (hit.speaker) openMoreInfo(this, hit.speaker);
    else if (hit.fan) openMoreInfo(this, hit.fan);
    else if (hit.pc) {
      const c = config.home.computers.find((x) => x.entity === hit.pc);
      if (c) openComputer(c);
    } else if (hit.room && this.rooms?.some((r) => r.id === hit.room)) {
      if (this.focused === hit.room) this.openRoom(hit.room);
      else this.focusRoom(hit.room);
    }
  }

  private openRoom(id: string): void {
    history.pushState(null, "", `${this.prefix}/pieces/${id}${location.search}`);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  /** The camera glides to a room, keeping its angle; a second tap opens the room. */
  private focusRoom(id: string): void {
    const p = ROOMS[id];
    if (!p || !this.controls) return;
    const target = new Vector3(p.label[0] - CX, 0, p.label[1] - CZ);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (dir.y < 0.45) dir.setY(0.45).normalize();
    this.focused = id;
    this.moveTo(target.clone().add(dir.multiplyScalar(820)), target);
  }

  /** Preset views: the whole flat from the salon's corner, or from above. */
  private setView(v: View): void {
    this.view = v;
    this.focused = undefined;
    try {
      localStorage.setItem("kh-plan3d-view", v);
    } catch {
      /* not kept */
    }
    const [pos] = this.home();
    this.moveTo(pos, new Vector3(0, 0, 0));
  }

  private home(): [Vector3] {
    if (this.view === "top") return [new Vector3(0, this.tall ? 3100 : 2700, 1)];
    return [new Vector3(...((this.tall ? [0, 1550, 1150] : [-1050, 1500, 1050]) as [number, number, number]))];
  }

  private setLayer(l: "none" | "temp"): void {
    this.layer = l;
    try {
      localStorage.setItem("kh-plan3d-layer", l);
    } catch {
      /* not kept */
    }
    this.sync();
  }

  private moveTo(pos: Vector3, target: Vector3): void {
    if (!this.controls) return;
    this.moved = true;
    this.tween = { p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target, start: performance.now() };
    this.request();
  }

  /** One step of the camera move; true while it goes on. */
  private step(): boolean {
    const t = this.tween!, c = this.controls!;
    const k = Math.min(1, (performance.now() - t.start) / 650);
    const e = 1 - Math.pow(1 - k, 3);
    this.camera.position.lerpVectors(t.p0, t.p1, e);
    c.target.lerpVectors(t.t0, t.t1, e);
    if (k >= 1) this.tween = undefined;
    return k < 1;
  }

  /**
   * Dollhouse cut: walls between the camera and the middle of the view are
   * lowered (windows and lintels on that side hidden), so rooms are seen
   * inside. From above, nothing is cut.
   */
  private cutaway(): void {
    const live = this.live, c = this.controls;
    if (!live || !c) return;
    const dx = this.camera.position.x - c.target.x, dz = this.camera.position.z - c.target.z;
    const len = Math.hypot(dx, dz);
    const flat = len / Math.max(1, this.camera.position.y - c.target.y);
    for (const w of live.cut) {
      const ahead = flat > 0.35 && ((w.cx - c.target.x) * dx + (w.cz - c.target.z) * dz) / len > 60;
      if (w.hide) w.o.visible = !ahead;
      else {
        const k = ahead ? Math.min(1, 30 / w.h) : 1;
        w.o.scale.y = k;
        w.o.position.y = w.lift + (w.h * k) / 2;
      }
    }
  }

  /** Fan blades turn while the fan runs (frames only while one does). */
  private spinFans(): void {
    const live = this.live, hass = store.hass;
    if (!live || !hass) return;
    const running = [...live.fans].filter(([e]) => isActive(hass.states[e]));
    if (!running.length || this.spin) return;
    let last = performance.now();
    const turn = (now: number) => {
      this.spin = 0;
      if (!this.live || !this.renderer) return;
      const on = [...this.live.fans].filter(([e]) => isActive(store.hass?.states[e]));
      if (!on.length) return;
      const dt = (now - last) / 1000;
      last = now;
      for (const [e, blades] of on) blades.rotation.z -= dt * (4 + (Number(store.hass?.states[e]?.attributes.percentage ?? 50) / 100) * 14);
      this.renderer.render(this.scene, this.camera);
      this.spin = requestAnimationFrame(turn);
    };
    this.spin = requestAnimationFrame(turn);
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

  /** Screen boxes of the lights' and devices' buttons, which never move. */
  private fixedButtons(): Spot[] {
    const hass = store.hass;
    if (!hass || !this.renderer) return [];
    const out: Spot[] = [];
    for (const l of Object.values(config.plan?.lights ?? {}).flat()) {
      const [x, y] = l.to ? [(l.at[0] + l.to[0]) / 2, (l.at[1] + l.to[1]) / 2] : l.at;
      const pos = hass.states[l.entity] && this.at(x, y, FIXTURE_Z[l.kind] ?? 100);
      if (pos) out.push({ x: pos[0], y: pos[1], w: 34, h: 34 });
    }
    if (this.narrow) return out; // badges are hidden on phones
    for (const [id, entity] of Object.entries(config.plan?.computers ?? {})) {
      const p = ROOMS[id]?.pc, c = config.home.computers.find((x) => x.entity === entity);
      const [bx, by] = ROOMS[id]?.pcBadge ?? (p ? [p[0] + p[2] / 2, p[1] + p[3] / 2] : [0, 0]);
      const pos = p && c && this.at(bx, by, 165);
      if (pos) out.push({ x: pos[0], y: pos[1], w: 50 + c!.name.length * 7.5, h: 32 });
    }
    for (const [id] of Object.entries(config.plan?.tvs ?? {})) {
      const p = ROOMS[id];
      const pos = p?.tv && this.at(...(p.tvBadge ?? [0, 0]), 175);
      if (pos) out.push({ x: pos[0], y: pos[1], w: 50 + (id.length + 3) * 7.5, h: 32 });
    }
    return out;
  }

  render() {
    const hass = store.hass;
    const rooms = this.rooms ?? [];
    const taken = this.fixedButtons();
    return html`<canvas aria-label="Vue 3D de l'appartement : glisser pour tourner, pincer pour zoomer"></canvas>
      <div class="tools" role="toolbar" aria-label="Vue du plan 3D">
        <button aria-pressed=${String(this.view === "overview" && !this.focused)} @click=${() => this.setView("overview")}><ha-icon icon="mdi:axis-arrow"></ha-icon><span>Ensemble</span></button>
        <button aria-pressed=${String(this.view === "top" && !this.focused)} @click=${() => this.setView("top")}><ha-icon icon="mdi:arrow-collapse-down"></ha-icon><span>Dessus</span></button>
        <button aria-pressed=${String(this.layer === "temp")} @click=${() => this.setLayer(this.layer === "temp" ? "none" : "temp")}><ha-icon icon="mdi:thermometer"></ha-icon><span>Températures</span></button>
        ${this.focused
          ? html`<button class="open" @click=${() => this.openRoom(this.focused!)}><ha-icon icon="mdi:door-open"></ha-icon><span>Ouvrir ${rooms.find((r) => r.id === this.focused)?.name ?? ""}</span></button>`
          : nothing}
      </div>
      ${this.layer === "temp" ? html`<div class="legend" aria-hidden="true"><span>16°</span><i></i><span>28°</span></div>` : nothing}
      <div class="overlay">
        ${hass && this.renderer
          ? html`${rooms.map((r) => {
              const p = ROOMS[r.id];
              const at0 = p && this.at(p.label[0], p.label[1], 150);
              if (!at0) return nothing;
              // Moved aside from the lights' and devices' buttons (and the other labels).
              const t0 = r.temperature ? Number(hass.states[r.temperature]?.state) : NaN;
              const box: Spot = { x: at0[0], y: at0[1], w: 50 + r.name.length * 7.5 + (isNaN(t0) ? 0 : 40), h: 38 };
              const [dx, dy] = freeSpot(box, taken, 26);
              taken.push({ ...box, x: box.x + dx, y: box.y + dy });
              const pos = [at0[0] + dx, at0[1] + dy];
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
            ${Object.values(config.plan?.lights ?? {}).flat().map((l) => {
              // Each placed light, on its own (as in 2D): a tap switches it.
              const st = hass.states[l.entity];
              const [x, y] = l.to ? [(l.at[0] + l.to[0]) / 2, (l.at[1] + l.to[1]) / 2] : l.at;
              const pos = st && this.at(x, y, FIXTURE_Z[l.kind] ?? 100);
              if (!pos) return nothing;
              const on = isActive(st);
              const name = entityName(hass, l.entity, config);
              return html`<button class="fix ${on ? "on" : ""}" style="left:${pos[0]}px; top:${pos[1]}px"
                aria-label="${name} : ${on ? "éteindre" : "allumer"}" title=${name} @click=${() => toggle(l.entity, name)}>
                <ha-icon icon=${l.kind === "strip" ? "mdi:led-strip-variant" : l.kind === "lamp" ? "mdi:lamp" : l.kind === "spot" ? "mdi:spotlight-beam" : "mdi:ceiling-light"}></ha-icon>
              </button>`;
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
      <div class="hint">Glisser pour tourner, pincer ou molette pour zoomer ; toucher une pièce pour s'en approcher</div>`;
  }
}
customElements.define("kh-plan3d", KhPlan3d);
