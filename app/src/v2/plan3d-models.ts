import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three";

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

/** A flat TV on a foot, its screen facing +z; returns the screen's material to light it. */
export function flatTv(length: number): { group: Group; screen: MeshStandardMaterial } {
  const g = new Group();
  const screen = new MeshStandardMaterial({ color: "#0b0b12", roughness: 0.15, metalness: 0.2, emissive: "#000000" });
  box(g, 22, 2, 14, 0, 0, 0, m(BLACK, 0.4)); // foot
  box(g, 4, 10, 4, 0, 2, 0, m(BLACK, 0.4));
  box(g, length, length * 0.58, 3, 0, 12, 0, m(BLACK, 0.3)); // bezel
  const s = new Mesh(new BoxGeometry(length - 4, length * 0.58 - 4, 0.5), screen);
  s.position.set(0, 12 + (length * 0.58) / 2, 1.8);
  g.add(s);
  return { group: g, screen };
}

/** A PC: a monitor on its stand facing +z, keyboard, the tower beside the desk. */
export function computer(w: number): { group: Group; screen: MeshStandardMaterial } {
  const g = new Group();
  const screen = new MeshStandardMaterial({ color: "#0b0b12", roughness: 0.15, metalness: 0.2, emissive: "#000000" });
  const mw = Math.min(60, w * 1.1);
  box(g, 18, 1.5, 12, 0, 0, -4, m(BLACK, 0.4));
  box(g, 4, 12, 3, 0, 1.5, -6, m(BLACK, 0.4));
  box(g, mw, mw * 0.58, 2.5, 0, 12, -6, m(BLACK, 0.3));
  const s = new Mesh(new BoxGeometry(mw - 3, mw * 0.58 - 3, 0.5), screen);
  s.position.set(0, 12 + (mw * 0.58) / 2, -4.5);
  g.add(s);
  box(g, mw * 0.8, 1.5, 14, 0, 0, 14, m("#2b2f3a", 0.5)); // keyboard
  return { group: g, screen };
}
