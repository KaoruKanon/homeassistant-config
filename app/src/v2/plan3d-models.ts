import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, SRGBColorSpace, TorusGeometry } from "three";

// Furniture of the 3D plan, built from simple shapes at real-ish sizes
// (1 unit ≈ 1 cm, y up). Each model fills a w × d footprint centred on its
// origin, standing on y = 0; its front (where you sit or look) faces +z,
// its back (headboard, couch back, toilet tank) is at -z, as in the drawio.

const mats = new Map<string, MeshStandardMaterial>();
/** Shared materials, one per colour (and emissive screens kept apart). */
export function m(color: string, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  const key = `${color}/${roughness}/${metalness}`;
  let mt = mats.get(key);
  if (!mt) mats.set(key, (mt = new MeshStandardMaterial({ color, roughness, metalness })));
  return mt;
}

function box(g: Group, w: number, h: number, d: number, x: number, y: number, z: number, mat: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function cyl(g: Group, r: number, h: number, x: number, y: number, z: number, mat: MeshStandardMaterial, segments = 24, rTop = r): Mesh {
  const mesh = new Mesh(new CylinderGeometry(rTop, r, h, segments), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function legs(g: Group, w: number, d: number, h: number, t: number, mat: MeshStandardMaterial, inset = 3): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, t, h, t, sx * (w / 2 - inset - t / 2), 0, sz * (d / 2 - inset - t / 2), mat);
}

const WOOD = "#8a5d3f", DARK_WOOD = "#5b3b28", LIGHT_WOOD = "#b8875a", WHITE = "#f4f1ea", STEEL = "#b9c2c9", BLACK = "#1d1f24";

/** A model for a drawio furniture name, or undefined to use a plain block. */
export function model(name: string, w: number, d: number): Group | undefined {
  const g = new Group();
  switch (name) {
    case "bed_single":
    case "bed_double": {
      const two = name === "bed_double";
      box(g, w, 24, d, 0, 4, 0, m(DARK_WOOD));
      legs(g, w, d, 4, 6, m(DARK_WOOD), 2);
      box(g, w - 6, 16, d - 10, 0, 28, 2, m("#f4efe6", 0.95));
      box(g, w, 62, 6, 0, 4, -d / 2 + 3, m(DARK_WOOD)); // headboard
      box(g, w - 2, 7, d * 0.62, 0, 42, d / 2 - (d * 0.62) / 2 - 2, m("#f2b84b", 0.95)); // duvet
      box(g, w - 2, 9, 12, 0, 40, d / 2 - d * 0.62 - 4, m("#e3a43a", 0.95)); // folded edge
      const pw = two ? w / 2 - 14 : w - 30;
      for (const px of two ? [-w / 4 + 2, w / 4 - 2] : [0]) box(g, pw, 9, 24, px, 44, -d / 2 + 22, m("#ffffff", 0.95));
      return g;
    }
    case "couch": {
      const blue = m("#4a90c8", 0.95), dark = m("#3f7fb5", 0.95);
      box(g, w, 20, d - 6, 0, 6, 3, dark); // base
      box(g, w - 28, 12, d * 0.62, 0, 26, d / 2 - (d * 0.62) / 2 - 2, blue); // seat cushions
      box(g, w - 28, 34, d * 0.3, 0, 26, -d / 2 + (d * 0.3) / 2 + 2, blue); // back cushions
      box(g, w, 52, 10, 0, 6, -d / 2 + 5, dark); // back
      for (const sx of [-1, 1]) box(g, 14, 36, d - 6, sx * (w / 2 - 7), 6, 3, dark); // arms
      legs(g, w, d, 6, 5, m(DARK_WOOD), 4);
      box(g, 30, 22, 8, -w / 2 + 34, 38, -d / 2 + 18, m("#f2c14e", 0.95)); // a cushion
      return g;
    }
    case "chair": {
      const wood = m(WOOD);
      legs(g, w * 0.8, d * 0.8, 44, 3.5, wood, 0);
      box(g, w * 0.8, 4, d * 0.8, 0, 44, 0, wood);
      box(g, w * 0.8, 40, 3, 0, 48, -d * 0.4 + 1.5, wood);
      return g;
    }
    case "round_table": {
      const wood = m(LIGHT_WOOD, 0.6);
      cyl(g, w / 2, 4, 0, 72, 0, wood, 40);
      cyl(g, 6, 72, 0, 0, 0, m(DARK_WOOD), 16);
      cyl(g, 24, 3, 0, 0, 0, m(DARK_WOOD), 24);
      return g;
    }
    case "table":
    case "desk": {
      box(g, w, 4, d, 0, 72, 0, m(name === "desk" ? WOOD : LIGHT_WOOD, 0.6));
      legs(g, w, d, 72, 5, m(DARK_WOOD), 3);
      return g;
    }
    case "dresser": {
      const h = 78, wood = m(LIGHT_WOOD, 0.7);
      box(g, w, h, d, 0, 4, 0, wood);
      legs(g, w, d, 4, 5, m(DARK_WOOD), 3);
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        box(g, w - 8, 1, 1, 0, 4 + (h / rows) * i + 1, d / 2 + 0.2, m("#946a48")); // drawer seams
        box(g, Math.min(16, w / 4), 2, 2, 0, 4 + (h / rows) * (i + 0.5), d / 2 + 1, m(STEEL, 0.3, 0.8)); // handles
      }
      return g;
    }
    case "wardrobe": {
      // Two-door (or more) wardrobe, doors to the front.
      const h = 150, body = m("#6a4a35", 0.7), door = m("#7a573f", 0.6);
      box(g, w, h, d, 0, 0, 0, body);
      box(g, w + 2, 3, d + 2, 0, h, 0, m("#5b3b28", 0.7)); // cornice
      const doors = Math.max(2, Math.round(w / 55));
      const dw = (w - 4) / doors;
      for (let i = 0; i < doors; i++) {
        const x = -w / 2 + 2 + dw * (i + 0.5);
        box(g, dw - 2, h - 10, 1.2, x, 5, d / 2 + 0.6, door);
        box(g, 1.5, 22, 2.5, x + (i % 2 ? -1 : 1) * (dw / 2 - 6), h / 2 - 11, d / 2 + 1.8, m(STEEL, 0.25, 0.85)); // handles
      }
      return g;
    }
    case "glass_cabinet": {
      // Display cabinet: wood frame, glass doors, lit shelves with a few things on them.
      const h = 110, wood = m("#8a5d3f", 0.6);
      box(g, w, 6, d, 0, 0, 0, wood);
      box(g, w, 4, d, 0, h - 4, 0, wood);
      for (const sx of [-1, 1]) box(g, 3, h, d, sx * (w / 2 - 1.5), 0, 0, wood);
      box(g, w - 6, h - 10, 2, 0, 6, -d / 2 + 1, wood); // back
      for (const y of [38, 72]) box(g, w - 6, 2, d - 6, 0, y, 0, m("#a77a55", 0.6));
      const things = ["#e85d75", "#f2c14e", "#4a90c8", "#f6efe2", "#5aa469"];
      for (let i = 0; i < 5; i++) cyl(g, 4, 10 + (i % 3) * 4, -w / 2 + 12 + i * ((w - 24) / 4), i % 2 ? 40 : 74, -4, m(things[i], 0.4), 12);
      const glass = new MeshStandardMaterial({ color: "#cfe9f2", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 });
      for (const sx of [-1, 1]) {
        box(g, w / 2 - 4, h - 12, 1, sx * (w / 4 - 0.5), 6, d / 2 - 1, glass);
        box(g, w / 2 - 4, 2.5, 1.5, sx * (w / 4 - 0.5), 6, d / 2 - 0.5, wood);
        box(g, w / 2 - 4, 2.5, 1.5, sx * (w / 4 - 0.5), h - 8.5, d / 2 - 0.5, wood);
      }
      return g;
    }
    case "bar_table": {
      // Bar shelf fixed to the wall (at -z), brackets underneath, two stools in front.
      const top = m("#b8875a", 0.5);
      box(g, w, 4, d * 0.7, 0, 100, -d / 2 + (d * 0.7) / 2, top);
      for (const sx of [-1, 1]) {
        box(g, 3, 28, 3, sx * (w / 2 - 15), 72, -d / 2 + 2, m(BLACK, 0.4, 0.5)); // wall rail
        const brace = box(g, 3, 3, d * 0.6, sx * (w / 2 - 15), 86, -d / 2 + (d * 0.3), m(BLACK, 0.4, 0.5));
        brace.rotation.x = 0.55;
      }
      for (const sx of [-0.28, 0.28]) {
        const x = sx * w, z = d / 2 + 6;
        cyl(g, 16, 2, x, 0, z, m(BLACK, 0.3, 0.6), 20);
        cyl(g, 2.5, 66, x, 2, z, m(STEEL, 0.25, 0.85), 12);
        const ring = new Mesh(new TorusGeometry(11, 1, 8, 24), m(STEEL, 0.25, 0.85));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, 30, z);
        g.add(ring);
        cyl(g, 17, 5, x, 68, z, m("#3c4250", 0.8), 24);
      }
      return g;
    }
    case "kitchen_cabinet": {
      // Base unit with drawers and a worktop; the microwave and the kettle on top.
      const front = m("#e8754f", 0.55);
      box(g, w, 6, d - 4, 0, 0, -2, m(BLACK, 0.8)); // plinth
      box(g, w, 80, d - 2, 0, 6, -1, m("#cf6340", 0.6));
      const cols = Math.max(2, Math.round(w / 60));
      const cw = w / cols;
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < 3; r++) {
          box(g, cw - 3, 24, 1.2, -w / 2 + cw * (c + 0.5), 8 + r * 26, d / 2, front);
          box(g, 14, 1.8, 2, -w / 2 + cw * (c + 0.5), 8 + r * 26 + 19, d / 2 + 1, m(STEEL, 0.25, 0.85));
        }
      box(g, w + 2, 4, d + 2, 0, 86, 0, m("#3a3f4b", 0.35)); // worktop
      // Microwave, door window and keypad.
      const mx = -w / 2 + 34;
      box(g, 48, 28, 34, mx, 90, -2, m("#2b2f3a", 0.35, 0.3));
      box(g, 30, 18, 0.6, mx - 6, 95, 15.3, m("#0b0b12", 0.1, 0.3));
      box(g, 8, 18, 0.6, mx + 17, 95, 15.3, m("#4a5168", 0.4));
      // Kettle and teapot.
      const kx = w / 2 - 26;
      cyl(g, 8, 2, kx, 90, 0, m(BLACK, 0.4), 20);
      cyl(g, 6.5, 20, kx, 92, 0, m(STEEL, 0.2, 0.9), 20, 5);
      box(g, 2, 12, 8, kx + 7, 96, 0, m(BLACK, 0.4));
      const pot = cyl(g, 8, 11, kx - 24, 90, 4, m("#f6efe2", 0.3), 20, 6);
      pot.scale.set(1, 1, 1);
      cyl(g, 1.5, 7, kx - 33, 95, 4, m("#f6efe2", 0.3), 10).rotation.z = 0.9;
      return g;
    }
    case "tv_stand": {
      // Low TV unit: black top and sides, two open shelves, a drawer.
      const h = 46, black = m("#23262e", 0.5), wood = m("#8a5d3f", 0.6);
      box(g, w, 3, d, 0, h - 3, 0, black);
      box(g, w, 3, d, 0, 5, 0, black);
      for (const sx of [-1, 0, 1]) box(g, 3, h - 8, d, sx * (w / 2 - 1.5) * (sx === 0 ? 0 : 1), 5, 0, black);
      box(g, w - 6, h - 8, 2, 0, 5, -d / 2 + 1, black);
      box(g, w / 2 - 6, 16, 1.5, -w / 4, 9, d / 2 - 1, wood); // drawer
      box(g, 12, 1.5, 1.5, -w / 4, 22, d / 2, m(STEEL, 0.25, 0.85));
      box(g, 26, 6, 18, w / 4, 8, 0, m(BLACK, 0.4)); // the TV box on the shelf
      box(g, 3, 1, 0.5, w / 4 + 8, 12, 9.2, m("#5ef08a", 0.3));
      legs(g, w, d, 5, 4, black, 2);
      return g;
    }
    case "low_bookcase": {
      // Under the desk extension: two shelves of books.
      const h = 70, wood = m(DARK_WOOD);
      for (const sx of [-1, 1]) box(g, 2.5, h, d, sx * (w / 2 - 1.25), 0, 0, wood);
      for (let i = 0; i <= 2; i++) box(g, w, 2.5, d, 0, (h - 2.5) * (i / 2), 0, wood);
      const colors = ["#e85d75", "#4a90c8", "#f2c14e", "#5aa469"];
      for (let i = 0; i < 2; i++) for (let k = 0; k < Math.floor((w - 8) / 7); k++) box(g, 5, 20 + ((k * 5 + i) % 7), d - 6, -w / 2 + 6 + k * 7, (h - 2.5) * (i / 2) + 2.5, 0, m(colors[(k + i) % 4], 0.9));
      return g;
    }
    case "desk_extension": {
      // The desk carries on over the low bookcase.
      box(g, w, 4, d, 0, 72, 0, m(WOOD, 0.6));
      box(g, 4, 72, 4, w / 2 - 4, 0, d / 2 - 4, m(DARK_WOOD));
      return g;
    }
    case "bookcase": {
      const h = 110, wood = m(DARK_WOOD);
      for (const sx of [-1, 1]) box(g, 2.5, h, d, sx * (w / 2 - 1.25), 0, 0, wood);
      for (let i = 0; i <= 4; i++) box(g, w, 2.5, d, 0, (h - 2.5) * (i / 4), 0, wood);
      const colors = ["#e85d75", "#4a90c8", "#f2c14e", "#5aa469", "#9f92c0"];
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < Math.floor((w - 8) / 7); k++)
          if ((k + i) % 4 !== 3) box(g, 5, 18 + ((k * 7 + i * 3) % 6), d - 6, -w / 2 + 6 + k * 7, (h - 2.5) * (i / 4) + 2.5, 0, m(colors[(k + i) % colors.length], 0.9));
      return g;
    }
    case "office_chair": {
      cyl(g, 22, 3, 0, 4, 0, m(BLACK, 0.5), 5); // star base
      cyl(g, 2.5, 40, 0, 6, 0, m(STEEL, 0.3, 0.8), 12);
      cyl(g, Math.min(w, d) / 2 - 1, 7, 0, 44, 0, m("#e85d75", 0.9), 24);
      box(g, w * 0.75, 38, 6, 0, 52, -d / 2 + 4, m("#e85d75", 0.9));
      return g;
    }
    case "refrigerator": {
      box(g, w, 112, d, 0, 0, 0, m(WHITE, 0.4));
      box(g, w - 2, 1, 1, 0, 70, d / 2 + 0.3, m("#c9d3d8"));
      for (const y of [40, 86]) box(g, 3, 22, 3, w / 2 - 8, y, d / 2 + 1.5, m(STEEL, 0.3, 0.8));
      return g;
    }
    case "range": {
      box(g, w, 88, d, 0, 0, 0, m("#58606b", 0.5));
      box(g, w - 6, 40, 1, 0, 20, d / 2 + 0.3, m(BLACK, 0.2)); // oven door
      for (const [a, b] of [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]]) cyl(g, 9, 1.5, w * a, 88, d * b, m(BLACK, 0.4), 20);
      return g;
    }
    case "sink":
    case "sink_double": {
      const counter = name === "sink_double";
      box(g, w, counter ? 86 : 78, d, 0, 0, 0, m(counter ? "#e8eef0" : WHITE, 0.4));
      const top = counter ? 86 : 78;
      const basins = counter ? [-w / 4, w / 4] : [0];
      for (const x of basins) box(g, counter ? w / 2 - 18 : w - 10, 1, d - 16, x, top - 0.5, 2, m("#9fb3bf", 0.2, 0.3));
      cyl(g, 1.5, 22, 0, top, -d / 2 + 6, m(STEEL, 0.2, 0.9), 12); // faucet
      box(g, 3, 3, 14, 0, top + 19, -d / 2 + 12, m(STEEL, 0.2, 0.9));
      return g;
    }
    case "washing_machine": {
      box(g, w, 85, d, 0, 0, 0, m(WHITE, 0.4));
      const door = cyl(g, w * 0.32, 3, 0, 0, 0, m("#9fb3bf", 0.15, 0.4), 32);
      door.rotation.x = Math.PI / 2;
      door.position.set(0, 42, d / 2 + 1.5);
      box(g, w - 8, 8, 1, 0, 74, d / 2 + 0.3, m("#c9d3d8"));
      return g;
    }
    case "bathtub": {
      box(g, w, 52, d, 0, 0, 0, m(WHITE, 0.3));
      box(g, w - 12, 1, d - 12, 0, 46, 0, m("#8fd3ea", 0.1, 0.1)); // water
      cyl(g, 2, 18, -w / 2 + 8, 52, 0, m(STEEL, 0.2, 0.9), 12);
      return g;
    }
    case "toilet": {
      const white = m(WHITE, 0.3);
      box(g, w * 0.86, 38, 16, 0, 38, -d / 2 + 8, white); // tank
      const bowl = cyl(g, w * 0.4, 38, 0, 0, 6, white, 28, w * 0.46);
      bowl.scale.z = 1.25;
      cyl(g, w * 0.46, 3, 0, 38, 6, m("#e8eef0", 0.4), 28).scale.z = 1.25; // seat
      return g;
    }
  }
  return undefined;
}

/** A picture for a TV that is on: a soft sunset of colours, drawn once. */
let tvPicture: CanvasTexture | undefined;
function picture(): CanvasTexture {
  if (tvPicture) return tvPicture;
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 180;
  const x = c.getContext("2d")!;
  const sky = x.createLinearGradient(0, 0, 0, 180);
  sky.addColorStop(0, "#3b2a8f");
  sky.addColorStop(0.55, "#d6539a");
  sky.addColorStop(1, "#ffb35c");
  x.fillStyle = sky;
  x.fillRect(0, 0, 320, 180);
  x.fillStyle = "#fff4c9";
  x.beginPath();
  x.arc(210, 105, 26, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#2a1f55";
  x.beginPath();
  x.moveTo(0, 180);
  x.lineTo(0, 130);
  x.lineTo(70, 95);
  x.lineTo(140, 135);
  x.lineTo(220, 110);
  x.lineTo(320, 140);
  x.lineTo(320, 180);
  x.fill();
  tvPicture = new CanvasTexture(c);
  tvPicture.colorSpace = SRGBColorSpace;
  return tvPicture;
}

/**
 * A slim flat TV on a brushed-metal stand, screen facing +z: glossy black
 * when off (it reflects the room), a bright picture when on. Returns the
 * screen's material, lit by the plan when the TV plays.
 */
export function flatTv(length: number): { group: Group; screen: MeshStandardMaterial } {
  const g = new Group();
  const h = length * 0.5625; // 16:9
  const lift = 9;
  const screen = new MeshStandardMaterial({ color: "#050507", roughness: 0.06, metalness: 0.65, emissive: "#ffffff", emissiveIntensity: 0, emissiveMap: picture() });
  const metal = m("#9aa3ab", 0.25, 0.9);
  // V-shaped stand: two feet and a spine.
  box(g, length * 0.42, 1.2, 12, 0, 0, 0, metal);
  box(g, 3, lift, 2, 0, 1.2, -1, metal);
  // Panel: thin body, hair-line bezel, a slightly thicker bottom strip with a small logo light.
  box(g, length, h, 1.8, 0, lift, 0, m("#121317", 0.35, 0.4));
  box(g, length * 0.6, h * 0.62, 2.6, 0, lift + h * 0.19, -1.8, m("#121317", 0.5, 0.3)); // back bulge
  box(g, length, 1.6, 2.2, 0, lift, 0.2, m("#2a2d33", 0.3, 0.7));
  box(g, 2, 0.6, 0.4, 0, lift + 0.4, 1.4, m("#e8eef0", 0.3, 0.2));
  const s = new Mesh(new BoxGeometry(length - 1.4, h - 2.4, 0.3), screen);
  s.position.set(0, lift + 1.6 + (h - 2.4) / 2, 1);
  g.add(s);
  return { group: g, screen };
}

/** A PC tower, front to +z: dark case, power light, side window lit while it runs. */
function tower(g: Group, x: number, y: number, z: number, glow: MeshStandardMaterial[], rgb = false): void {
  box(g, 20, 44, 42, x, y, z, m("#1a1c22", 0.4, 0.3));
  box(g, 0.6, 30, 30, x + 10.2, y + 8, z, rgb ? glowMat(glow, "#5a2bff") : m("#2b2f3a", 0.2, 0.3)); // side window
  box(g, 2, 2, 0.6, x, y + 38, z + 21.2, glowMat(glow, "#4fc3f7")); // power light
  if (rgb) box(g, 16, 1, 0.6, x, y + 3, z + 21.2, glowMat(glow, "#ff3fa4"));
}

/**
 * The RIG: a black NZXT H5 Flow-like case, front to +z. Perforated front,
 * tempered glass on its left side (-x), and behind it the AIO with its
 * round screen, the radiator fans on top and the graphics card. While
 * the PC runs, RGB light comes out through the glass (`lights`).
 */
function nzxt(g: Group, x: number, y: number, z: number, glow: MeshStandardMaterial[], lights: PointLight[]): void {
  const W = 23, H = 47, D = 43, white = m("#17181c", 0.45, 0.2), mesh = m("#2a2c31", 0.95), inside = m("#1e2024", 0.6);
  box(g, W, 2, D, x, y + H - 2, z, white); // top
  box(g, W, 2, D, x, y, z, white); // bottom
  box(g, 2, H, D, x + W / 2 - 1, y, z, white); // right side panel (solid)
  box(g, W, H, 2, x, y, z - D / 2 + 1, inside); // back, seen through the glass
  box(g, W, H - 4, 1.5, x, y + 2, z + D / 2 - 0.75, mesh); // perforated front
  box(g, W - 3, 11, D - 4, x + 1, y + 2, z, mesh); // PSU shroud (mesh bottom)
  // Behind the glass: radiator and fans on top, the card, the pump with its screen.
  box(g, W - 4, 3, D - 8, x + 1, y + H - 6, z, inside);
  for (const fz of [-9, 9]) cyl(g, 7, 1, x + 1, y + H - 7.5, z + fz, m("#2b2d33", 0.5), 20);
  box(g, 6, 12, 30, x - 2, y + 15, z + 2, m("#16171b", 0.35, 0.4)); // graphics card
  const pump = cyl(g, 4.2, 2, x - 6, y + 31, z + 2, white, 24);
  pump.rotation.z = Math.PI / 2;
  const lcd = cyl(g, 3.4, 0.4, x - 7.2, y + 31, z + 2, glowMat(glow, "#b388ff"), 24);
  lcd.rotation.z = Math.PI / 2;
  box(g, 1, H - 8, 1, x - W / 2 + 2.5, y + 4, z + D / 2 - 3, glowMat(glow, "#ff3fa4")); // RGB strip behind the front
  box(g, 1, H - 8, 1, x - W / 2 + 2.5, y + 4, z - D / 2 + 3, glowMat(glow, "#7c4dff"));
  const glass = new MeshStandardMaterial({ color: "#cfd8e3", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22 });
  box(g, 0.6, H, D, x - W / 2 + 0.3, y, z, glass); // tempered glass, left side
  box(g, 3, 0.6, 1.2, x - 6, y + H, z + D / 2 - 4, glowMat(glow, "#ffffff")); // power button light
  // RGB through the glass, on the desk and the wall.
  const rgb = new PointLight("#9b5cff", 0, 140, 2);
  rgb.position.set(x - W / 2 - 6, y + H / 2, z);
  g.add(rgb);
  lights.push(rgb);
}

/** A material that lights up with the PC (collected so the plan can switch it). */
function glowMat(list: MeshStandardMaterial[], color: string): MeshStandardMaterial {
  const mt = new MeshStandardMaterial({ color: "#15161b", roughness: 0.3, emissive: color, emissiveIntensity: 0 });
  list.push(mt);
  return mt;
}

function monitor(g: Group, x: number, z: number, wide: number, turn: number, screens: MeshStandardMaterial[]): void {
  const mg = new Group();
  box(mg, 18, 1.5, 14, 0, 0, -4, m(BLACK, 0.4));
  box(mg, 4, 14, 3, 0, 1.5, -6, m(BLACK, 0.4));
  box(mg, wide, wide * 0.5, 2.5, 0, 14, -6, m(BLACK, 0.3));
  const screen = new MeshStandardMaterial({ color: "#0b0b12", roughness: 0.15, metalness: 0.2, emissive: "#2196f3", emissiveIntensity: 0 });
  const s = new Mesh(new BoxGeometry(wide - 2.5, wide * 0.5 - 2.5, 0.5), screen);
  s.position.set(0, 14 + (wide * 0.5) / 2, -4.6);
  mg.add(s);
  mg.position.set(x, 0, z);
  mg.rotation.y = turn;
  g.add(mg);
  screens.push(screen);
}

/**
 * A PC, front to +z, standing on its desk top (y = 0): monitor, keyboard and
 * mouse, the tower on the floor beside the desk (`towerAt`). Returns every
 * material that lights up while it runs.
 */
export function computer(w: number, towerAt?: [number, number, number]): { group: Group; screens: MeshStandardMaterial[]; lights: PointLight[] } {
  const g = new Group();
  const screens: MeshStandardMaterial[] = [];
  monitor(g, 0, 0, Math.min(56, w * 1.1), 0, screens);
  box(g, 40, 1.5, 13, 0, 0, 14, m("#2b2f3a", 0.5)); // keyboard
  box(g, 5, 1.5, 8, 26, 0, 15, m("#2b2f3a", 0.5)); // mouse
  if (towerAt) tower(g, towerAt[0], towerAt[1], towerAt[2], screens);
  return { group: g, screens, lights: [] };
}

/**
 * The gaming setup: two screens side by side, slightly turned in, a wide
 * desk mat, a lit keyboard and a mouse, headphones, and the black NZXT tower
 * on the desk extension (`towerAt`).
 */
export function gamingSetup(towerAt: [number, number, number]): { group: Group; screens: MeshStandardMaterial[]; lights: PointLight[] } {
  const g = new Group();
  const screens: MeshStandardMaterial[] = [];
  const lights: PointLight[] = [];
  monitor(g, -31, -2, 60, 0.12, screens);
  monitor(g, 31, -2, 60, -0.12, screens);
  box(g, 90, 0.4, 36, 0, 0, 14, m("#1a1c22", 0.95)); // desk mat
  box(g, 44, 2, 14, -6, 0.4, 13, m("#23262e", 0.5));
  box(g, 42, 0.4, 12, -6, 2.4, 13, glowMat(screens, "#ff3fa4")); // keyboard backlight
  box(g, 6, 2.5, 10, 26, 0.4, 15, m("#23262e", 0.5));
  const cup = cyl(g, 4.5, 9, -44, 0, 16, m("#f6efe2", 0.4), 16); // a mug
  cup.castShadow = true;
  const head = new Mesh(new TorusGeometry(8, 1.6, 8, 20, Math.PI), m(BLACK, 0.4));
  head.position.set(44, 14, 10);
  g.add(head);
  nzxt(g, towerAt[0], towerAt[1], towerAt[2], screens, lights);
  return { group: g, screens, lights };
}

/** Painted paper of the Japanese lamp: a red sun and a cherry branch in bloom. */
let andonPaper: CanvasTexture | undefined;
function paper(): CanvasTexture {
  if (andonPaper) return andonPaper;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 224;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f3e7c9";
  x.fillRect(0, 0, 128, 224);
  x.fillStyle = "#d4202a";
  x.beginPath();
  x.arc(84, 62, 30, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = "#2a1a14";
  x.lineCap = "round";
  const branch = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(x0, y0);
    x.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1);
    x.stroke();
  };
  branch(20, 224, 40, 120, 7);
  branch(40, 120, 30, 40, 4);
  branch(40, 130, 100, 100, 3);
  branch(36, 170, 90, 160, 3);
  branch(32, 80, 70, 30, 2);
  x.fillStyle = "#e0405a";
  for (const [bx, by] of [[30, 45], [70, 30], [58, 108], [100, 100], [88, 158], [45, 140], [24, 95], [76, 120], [52, 70], [96, 140]]) {
    x.beginPath();
    x.arc(bx, by, 4.5, 0, Math.PI * 2);
    x.fill();
  }
  andonPaper = new CanvasTexture(c);
  andonPaper.colorSpace = SRGBColorSpace;
  return andonPaper;
}

/**
 * The Japanese lamp (andon): a square black wooden frame on four short legs,
 * painted paper panels lit from inside. `glow` is the light's own material
 * (the plan switches it); the paper picture is laid on it. Stands on y = 0.
 */
export function andon(glow: MeshStandardMaterial): Group {
  const g = new Group();
  const S = 15, H = 30, foot = 3, wood = m("#141214", 0.7);
  glow.map = paper();
  glow.emissiveMap = glow.map;
  glow.color.set("#ffffff");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 1.6, H + foot, 1.6, (sx * S) / 2, 0, (sz * S) / 2, wood); // posts and legs
  for (const yy of [foot, foot + H - 1.4]) {
    box(g, S + 1.6, 1.4, 1.6, 0, yy, -S / 2, wood);
    box(g, S + 1.6, 1.4, 1.6, 0, yy, S / 2, wood);
    box(g, 1.6, 1.4, S + 1.6, -S / 2, yy, 0, wood);
    box(g, 1.6, 1.4, S + 1.6, S / 2, yy, 0, wood);
  }
  for (let i = 0; i < 4; i++) {
    const panel = new Mesh(new BoxGeometry(S - 1.6, H - 2.8, 0.3), glow);
    const a = (i * Math.PI) / 2;
    panel.position.set(Math.sin(a) * (S / 2), foot + 1.4 + (H - 2.8) / 2, Math.cos(a) * (S / 2));
    panel.rotation.y = a;
    g.add(panel);
  }
  return g;
}
