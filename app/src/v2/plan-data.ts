// The flat, from the user's drawio plan (app/assets/plan/appartement.drawio):
// walls, windows, doors and furniture in plan units (about 1 unit = 1 cm),
// the rooms keyed by the HA area they belong to. Shared by the 2D and 3D views.

export type R = [number, number, number, number];
export type F = [string, number, number, number, number, number];

export const WALLS: R[] = [
  [70, 120, 160, 10], [70, 120, 10, 240], [230, 120, 500, 10], [720, 120, 10, 70], [640, 440, 90, 10], [720, 360, 10, 90],
  [260, 440, 300, 10], [280, 450, 10, 90], [280, 620, 10, 100], [280, 710, 350, 10], [70, 450, 10, 80], [70, 1315, 560, 10],
  [70, 610, 10, 715], [620, 710, 110, 10], [720, 680, 10, 40], [720, 450, 10, 130], [720, 720, 10, 30], [630, 950, 100, 10],
  [720, 840, 10, 120], [530, 950, 100, 10], [280, 950, 260, 10], [280, 870, 10, 90], [280, 720, 10, 70], [280, 960, 10, 40],
  [630, 1315, 100, 10], [720, 1290, 10, 35], [720, 960, 10, 150], [280, 1078, 10, 242], [70, 440, 110, 10], [70, 360, 10, 90],
  [80, 1120, 120, 10], [190, 1080, 10, 50], [80, 980, 120, 10], [190, 980, 10, 20], [80, 629, 120, 10], [190, 629, 10, 62],
  [190, 930, 10, 100],
];

export const FURNITURE: F[] = [
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
export interface PlanRoom {
  points: string;
  label: [number, number];
  windows?: [number, number][];
  tv?: R;
  /** Where the TV's badge sits (beside the TV, clear of the PC's). */
  tvBadge?: [number, number];
  pc?: R;
  /** Where the PC's badge sits, when not on the desk itself. */
  pcBadge?: [number, number];
}

export const ROOMS: Record<string, PlanRoom> = {
  salon: { points: "80,130 720,130 720,440 80,440", label: [430, 180], windows: [[190, 360]], tv: [100, 230, 10, 100], tvBadge: [105, 280], pcBadge: [115, 155], pc: [90, 160, 50, 40] },
  cuisine: { points: "290,450 720,450 720,710 290,710", label: [505, 560], windows: [[580, 690]] },
  chambre_william: { points: "290,720 720,720 720,950 290,950", label: [430, 860], windows: [[750, 840]], pc: [460, 726, 50, 40] },
  chambre_papa: { points: "290,960 720,960 720,1315 290,1315", label: [560, 1060], windows: [[1142, 1252]], tv: [672, 1190, 8, 100], tvBadge: [652, 1240] },
  couloir: { points: "80,450 280,450 280,1120 200,1120 200,630 80,630", label: [180, 540] },
  toilette: { points: "80,990 190,990 190,1120 80,1120", label: [135, 1010] },
  salle_de_bain: { points: "80,1130 280,1130 280,1315 80,1315", label: [205, 1160] },
};

/** Doors: hinge, then the leaf's closed and open angles (degrees, 0 = +x, 90 = down). */
export const DOORS: [number, number, number, number][] = [
  [180, 445, 0, -90], [640, 445, 180, 270], [75, 530, 90, 0], [285, 540, 90, 0], [285, 870, -90, 0],
  [285, 1080, -90, 0], [195, 1000, 90, 0], [280, 1125, 180, 90],
];

/** Height and colour of each piece of furniture in the 3D view. */
export const FURNITURE_3D: Record<string, [number, string]> = {
  couch: [26, "#4a90c8"], bed_single: [18, "#f2b84b"], bed_double: [18, "#f2b84b"], chair: [14, "#8a5d3f"], round_table: [22, "#c58a45"],
  table: [22, "#c58a45"], desk: [22, "#8a5d3f"], dresser: [28, "#a77a55"], bookcase: [44, "#6a4a35"], office_chair: [14, "#e85d75"],
  refrigerator: [52, "#e8eef0"], range: [28, "#58606b"], sink: [26, "#e8eef0"], sink_double: [28, "#e8eef0"], washing_machine: [28, "#f6efe2"],
  bathtub: [18, "#ffffff"], toilet: [14, "#ffffff"],
};
