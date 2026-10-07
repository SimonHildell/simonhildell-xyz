import * as THREE from 'three';
import { GeoBuilder } from './geo.js';

// The elevated city.
//  Level 1 (6 m): a full grid of skyways over the avenues, like a second street floor.
//  Level 2 (12 m): two double-deck skyways stacked above the z = ±51 lines, the printer bridge,
//                  and the upper floors / roofs of the walk-through buildings.
//  Level 3 (18 m): the roof of the Vertical Market (see openbuildings.js).
const L1 = 6, L2 = 12, T = 0.4, HW = 2; // deck half width

const C_W = [0.3, 1.6, 2.2], C_E = [2.2, 0.35, 1.5], C_A = [2.4, 1.2, 0.3], C_G = [0.3, 2.2, 1.2];

const NS = [ // runs along z at x = L
  { x: -51, z0: -53, z1: 53, y: L1, c: C_W },
  { x: -17, z0: -53, z1: 53, y: L1, c: C_W },
  { x: 17, z0: -53, z1: 53, y: L1, c: C_E },
  { x: 51, z0: -53, z1: 53, y: L1, c: C_E },
];
const EW = [ // runs along x at z = M
  { z: -51, x0: -53, x1: 53, y: L1, c: C_A },
  { z: -17, x0: -19, x1: 53, y: L1, c: C_A },
  { z: 17, x0: -53, x1: 53, y: L1, c: C_A },
  { z: 51, x0: -53, x1: 53, y: L1, c: C_A },
  { z: -51, x0: -40, x1: 40, y: L2, c: C_E, upper: true },
  { z: 51, x0: -40, x1: 40, y: L2, c: C_W, upper: true },
];

// Walk-through buildings: footprint centre, floor levels above ground, bridge openings per level.
// side: N(z-) S(z+) W(x-) E(x+), a..b along that side in world coordinates.
export const OPEN_BUILDINGS = [
  { id: 'market', name: 'VERTICAL MARKET', cx: 0, cz: 34, levels: [L1, L2, 18], color: [2.4, 0.4, 1.4],
    openings: { 6: [{ side: 'W', a: 32, b: 36 }, { side: 'N', a: -2, b: 2 }], 12: [{ side: 'S', a: -2, b: 2 }] } },
  { id: 'arcade', name: 'ARCADE', cx: -34, cz: 0, levels: [L1, L2], color: [0.3, 1.8, 2.4],
    openings: { 6: [{ side: 'E', a: -2, b: 2 }, { side: 'W', a: -2, b: 2 }] } },
  { id: 'night', name: 'NIGHT MARKET', cx: 34, cz: 0, levels: [L1, L2], color: [2.6, 1.3, 0.3], pad: true,
    openings: { 6: [{ side: 'W', a: -2, b: 2 }, { side: 'E', a: -2, b: 2 }] } },
];

// extra decks: bridges, landings, the Finch deck
const DECKS = [
  { x0: 19, x1: 31, z0: -42, z1: -26, y: L1, c: C_G, rails: 'NSE', pillars: [[30.5, -41.5], [30.5, -26.5], [24, -41.5], [24, -26.5]] }, // Finch deck
  { x0: -27, x1: -19, z0: -38, z1: -34, y: L2, c: C_A },                                                    // bridge to the printer podium
  { x0: -22, x1: -19, z0: -16, z1: -12, y: L1, c: C_A },                                                    // printer stair, bottom landing
  { x0: -22, x1: -19, z0: -27, z1: -24, y: 9, c: C_A, pillars: [[-21.6, -25.5]] },                          // printer stair, mid landing
  // walk-through building bridges
  { x0: -15, x1: -11.5, z0: 32, z1: 36, y: L1, c: C_A, rails: 'NS' },
  { x0: -2, x1: 2, z0: 19, z1: 22.5, y: L1, c: C_A, rails: 'WE' },
  { x0: -2, x1: 2, z0: 45.5, z1: 49, y: L2, c: C_A, rails: 'WE' },
  { x0: -22.5, x1: -19, z0: -2, z1: 2, y: L1, c: C_A, rails: 'NS' },
  { x0: -49, x1: -45.5, z0: -2, z1: 2, y: L1, c: C_A, rails: 'NS' },
  { x0: 19, x1: 22.5, z0: -2, z1: 2, y: L1, c: C_A, rails: 'NS' },
  { x0: 45.5, x1: 49, z0: -2, z1: 2, y: L1, c: C_A, rails: 'NS' },
  // side stairs between level 1 and level 2: landings
  { x0: 8, x1: 11, z0: 53, z1: 56, y: L1, c: C_A },
  { x0: -2, x1: 1, z0: 53, z1: 56, y: 9, c: C_A, pillars: [[-0.5, 55.5]] },
  { x0: -12, x1: -9, z0: 53, z1: 56, y: L2, c: C_A, pillars: [[-11.5, 55.5]] },
  { x0: -11, x1: -8, z0: -56, z1: -53, y: L1, c: C_A },
  { x0: -1, x1: 2, z0: -56, z1: -53, y: 9, c: C_A, pillars: [[0.5, -55.5]] },
  { x0: 9, x1: 12, z0: -56, z1: -53, y: L2, c: C_A, pillars: [[11.5, -55.5]] },
];

// stairs { axis, x0,x1,z0,z1, a -> b, ya -> yb }
const RAMPS = [
  // down to the street at both ends of every N-S skyway
  ...[-51, -17, 17, 51].flatMap((x) => [
    { axis: 'z', x0: x - 2, x1: x + 2, z0: 53, z1: 63, a: 53, b: 63, ya: L1, yb: 0 },
    { axis: 'z', x0: x - 2, x1: x + 2, z0: -63, z1: -53, a: -53, b: -63, ya: L1, yb: 0 },
  ]),
  // printer stair (two flights)
  { axis: 'z', x0: -22, x1: -19, z0: -24, z1: -16, a: -16, b: -24, ya: L1, yb: 9 },
  { axis: 'z', x0: -22, x1: -19, z0: -34, z1: -27, a: -27, b: -34, ya: 9, yb: L2 },
  // level 1 -> level 2 side stairs
  { axis: 'x', x0: 1, x1: 8, z0: 53, z1: 56, a: 8, b: 1, ya: L1, yb: 9 },
  { axis: 'x', x0: -9, x1: -2, z0: 53, z1: 56, a: -2, b: -9, ya: 9, yb: L2 },
  { axis: 'x', x0: -8, x1: -1, z0: -56, z1: -53, a: -8, b: -1, ya: L1, yb: 9 },
  { axis: 'x', x0: 2, x1: 9, z0: -56, z1: -53, a: 2, b: 9, ya: 9, yb: L2 },
];

// rail runs: { axis: 'z' (runs along z at x=c) | 'x', c, s0, s1, y, h }
const EXTRA_RAILS = [
  // printer bridge + podium roof
  { axis: 'x', c: -38, s0: -27, s1: -19, y: L2 }, { axis: 'x', c: -34, s0: -27, s1: -22, y: L2 }, { axis: 'z', c: -19, s0: -38, s1: -34, y: L2 },
  { axis: 'x', c: -41, s0: -41, s1: -27, y: L2 }, { axis: 'x', c: -27, s0: -41, s1: -27, y: L2 }, { axis: 'z', c: -41, s0: -41, s1: -27, y: L2 },
  { axis: 'z', c: -27, s0: -41, s1: -38, y: L2 }, { axis: 'z', c: -27, s0: -34, s1: -27, y: L2 },
  // printer stair outer side + bottom landing end
  { axis: 'z', c: -22, s0: -34, s1: -12, y: L1, h: 7.2 }, { axis: 'x', c: -12, s0: -22, s1: -19, y: L1 },
  // side stairs: tall outer rail + ends
  { axis: 'x', c: 56, s0: -12, s1: 11, y: L1, h: 7.2 }, { axis: 'z', c: 11, s0: 53, s1: 56, y: L1 }, { axis: 'z', c: -12, s0: 53, s1: 56, y: L2 },
  { axis: 'x', c: -56, s0: -11, s1: 12, y: L1, h: 7.2 }, { axis: 'z', c: -11, s0: -56, s1: -53, y: L1 }, { axis: 'z', c: 12, s0: -56, s1: -53, y: L2 },
];

// holes punched into generated rails (bridges, landings, stair tops)
const GAPS = [
  { axis: 'z', c: -19, s0: -16, s1: -12, y: L1 },  // printer stair landing
  { axis: 'z', c: 19, s0: -42, s1: -26, y: L1 },   // Finch deck
  { axis: 'x', c: 53, s0: 8, s1: 11, y: L1 }, { axis: 'x', c: 53, s0: -12, s1: -9, y: L2 },
  { axis: 'x', c: -53, s0: -11, s1: -8, y: L1 }, { axis: 'x', c: -53, s0: 9, s1: 12, y: L2 },
  // walk-through building bridges
  { axis: 'z', c: -15, s0: 32, s1: 36, y: L1 }, { axis: 'x', c: 19, s0: -2, s1: 2, y: L1 }, { axis: 'x', c: 49, s0: -2, s1: 2, y: L2 },
  { axis: 'z', c: -19, s0: -2, s1: 2, y: L1 }, { axis: 'z', c: -49, s0: -2, s1: 2, y: L1 },
  { axis: 'z', c: 19, s0: -2, s1: 2, y: L1 }, { axis: 'z', c: 49, s0: -2, s1: 2, y: L1 },
  // ground stairs leave from the E-W edges at the ends of the N-S skyways
  ...[-51, -17, 17, 51].flatMap((x) => [{ axis: 'x', c: 53, s0: x - 2, s1: x + 2, y: L1 }, { axis: 'x', c: -53, s0: x - 2, s1: x + 2, y: L1 }]),
];

function subtract(run, gaps) {
  let parts = [[run.s0, run.s1]];
  for (const g of gaps) {
    if (g.axis !== run.axis || Math.abs(g.c - run.c) > 0.05 || Math.abs(g.y - run.y) > 0.05) continue;
    const next = [];
    for (const [a, b] of parts) {
      if (g.s1 <= a || g.s0 >= b) { next.push([a, b]); continue; }
      if (g.s0 > a) next.push([a, g.s0]);
      if (g.s1 < b) next.push([g.s1, b]);
    }
    parts = next;
  }
  return parts.filter(([a, b]) => b - a > 0.3).map(([a, b]) => ({ ...run, s0: a, s1: b }));
}

export function buildVertical(scene, world) {
  const deck = new GeoBuilder();
  const glow = new GeoBuilder();
  const glass = new GeoBuilder();
  const pillars = [];
  const rails = [];
  const gaps = [...GAPS];

  const addDeck = (x0, x1, z0, z1, y, c) => {
    const w = x1 - x0, l = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    deck.box(cx, y - T, cz, w, T, l, { su: 4, sv: 4, bottom: true, color: [0.22, 0.23, 0.27] });
    glow.box(cx, y - T - 0.02, cz, w + 0.06, 0.06, l + 0.06, { top: false, color: c.map((v) => v * 0.7) });
    if (w < l) glow.box(cx, y - T - 0.05, cz, 0.3, 0.03, l - 1, { color: c.map((v) => v * 0.55) });
    else glow.box(cx, y - T - 0.05, cz, w - 1, 0.03, 0.3, { color: c.map((v) => v * 0.55) });
    world.surfaces.push({ x0, x1, z0, z1, y, deck: true });
  };

  // ---- skyway lines
  for (const n of NS) {
    addDeck(n.x - HW, n.x + HW, n.z0, n.z1, n.y, n.c);
    for (const side of [-1, 1]) {
      const run = { axis: 'z', c: n.x + side * HW, s0: n.z0, s1: n.z1, y: n.y };
      for (const e of EW) {
        if (Math.abs(e.y - n.y) > 0.05) continue;
        const extends_ = side < 0 ? e.x0 < n.x - HW - 0.1 : e.x1 > n.x + HW + 0.1;
        if (extends_ && e.x0 <= n.x + HW && e.x1 >= n.x - HW) gaps.push({ axis: 'z', c: run.c, s0: e.z - HW, s1: e.z + HW, y: n.y });
      }
      rails.push(run);
    }
    // centre-line pillars, keeping the cross streets clear
    for (let z = n.z0 + 3; z <= n.z1 - 2; z += 11) {
      if ([-51, -17, 17, 51].some((q) => Math.abs(z - q) < 4.5)) continue;
      pillars.push([n.x, z, n.y - T, 0.35]);
    }
  }
  for (const e of EW) {
    addDeck(e.x0, e.x1, e.z - HW, e.z + HW, e.y, e.c);
    for (const side of [-1, 1]) {
      const run = { axis: 'x', c: e.z + side * HW, s0: e.x0, s1: e.x1, y: e.y };
      for (const n of NS) {
        if (Math.abs(e.y - n.y) > 0.05) continue;
        const extends_ = side < 0 ? n.z0 < e.z - HW - 0.1 : n.z1 > e.z + HW + 0.1;
        if (extends_ && n.x >= e.x0 && n.x <= e.x1) gaps.push({ axis: 'x', c: run.c, s0: n.x - HW, s1: n.x + HW, y: e.y });
      }
      rails.push(run);
    }
    // end caps unless the line ends inside a N-S skyway
    for (const xe of [e.x0, e.x1]) {
      const inside = NS.some((n) => Math.abs(n.y - e.y) < 0.05 && xe >= n.x - HW - 0.05 && xe <= n.x + HW + 0.05);
      if (!inside) rails.push({ axis: 'z', c: xe, s0: e.z - HW, s1: e.z + HW, y: e.y });
    }
    if (e.upper) {
      // tall supports at the road edges, outside the level-1 deck
      for (let x = e.x0 + 3; x <= e.x1 - 2; x += 12) {
        if ([-51, -17, 17, 51].some((q) => Math.abs(x - q) < 4.5)) continue;
        pillars.push([x, e.z - 3.1, e.y - T, 0.25], [x, e.z + 3.1, e.y - T, 0.25]);
      }
    } else {
      for (let x = e.x0 + 3; x <= e.x1 - 2; x += 11) {
        if ([-51, -17, 17, 51].some((q) => Math.abs(x - q) < 4.5)) continue;
        pillars.push([x, e.z, e.y - T, 0.35]);
      }
    }
  }

  // ---- extra decks
  for (const d of DECKS) {
    addDeck(d.x0, d.x1, d.z0, d.z1, d.y, d.c);
    if (d.rails) {
      if (d.rails.includes('N')) rails.push({ axis: 'x', c: d.z0, s0: d.x0, s1: d.x1, y: d.y });
      if (d.rails.includes('S')) rails.push({ axis: 'x', c: d.z1, s0: d.x0, s1: d.x1, y: d.y });
      if (d.rails.includes('W')) rails.push({ axis: 'z', c: d.x0, s0: d.z0, s1: d.z1, y: d.y });
      if (d.rails.includes('E')) rails.push({ axis: 'z', c: d.x1, s0: d.z0, s1: d.z1, y: d.y });
    }
    for (const [x, z] of d.pillars || []) pillars.push([x, z, d.y - T, 0.25]);
  }

  for (const r of RAMPS) addRamp(r, deck, glow, world);

  // ---- railings (generated + extra, minus gaps): glass panel + glowing handrail + collider
  const all = [...rails.flatMap((r) => subtract(r, gaps)), ...EXTRA_RAILS];
  for (const r of all) addRail(r, glass, glow, world);

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.35, metalness: 0.75, envMapIntensity: 1.1 });
  scene.add(new THREE.Mesh(deck.build(), deckMat));
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  scene.add(new THREE.Mesh(glass.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));

  const pg = new THREE.CylinderGeometry(1, 1.2, 1, 10); pg.translate(0, 0.5, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.8, roughness: 0.35 }), pillars.length);
  const m4 = new THREE.Matrix4();
  pillars.forEach(([x, z, h, r], i) => { m4.makeScale(r, h, r).setPosition(x, 0, z); pm.setMatrixAt(i, m4); world.colliderCircles.push({ x, z, r: r + 0.05, h }); });
  scene.add(pm);
}

export function addRail(r, glass, glow, world) {
  const len = r.s1 - r.s0, mid = (r.s0 + r.s1) / 2, h = r.h ?? 1.1;
  const [cx, cz, w, l] = r.axis === 'z' ? [r.c, mid, 0.04, len] : [mid, r.c, len, 0.04];
  glass.box(cx, r.y, cz, w, 1.0, l, { top: false, color: [0.25, 0.6, 0.9] });
  glow.box(cx, r.y + 1.0, cz, Math.max(w, 0.05), 0.04, Math.max(l, 0.05), { color: [0.22, 0.7, 1.0] });
  const [x0, x1, z0, z1] = r.axis === 'z' ? [r.c - 0.1, r.c + 0.1, r.s0, r.s1] : [r.s0, r.s1, r.c - 0.1, r.c + 0.1];
  world.colliders.push({ x0, x1, z0, z1, y0: r.y, h, noCam: true, rail: true });
}

export { subtract as subtractRuns };

export function addRamp(r, deck, glow, world) {
    const run = Math.abs(r.b - r.a), n = Math.round(run / 0.5);
    const isZ = r.axis === 'z';
    const w = isZ ? r.x1 - r.x0 : r.z1 - r.z0;
    const cc = isZ ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
    const dir = Math.sign(r.b - r.a);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const s = r.a + (r.b - r.a) * (t0 + t1) / 2;
      const top = Math.max(r.ya + (r.yb - r.ya) * t0, r.ya + (r.yb - r.ya) * t1);
      if (isZ) deck.box(cc, top - 0.1, s, w, 0.1, 0.52, { su: 4, sv: 4, color: [0.2, 0.2, 0.24] });
      else deck.box(s, top - 0.1, cc, 0.52, 0.1, w, { su: 4, sv: 4, color: [0.2, 0.2, 0.24] });
      if (i % 2 === 0) {
        if (isZ) glow.box(cc, top - 0.02, s - dir * 0.25, w, 0.03, 0.04, { color: [1.6, 1.0, 0.4] });
        else glow.box(s - dir * 0.25, top - 0.02, cc, 0.04, 0.03, w, { color: [1.6, 1.0, 0.4] });
      }
    }
    const edges = isZ ? [r.x0, r.x1] : [r.z0, r.z1];
    for (const e of edges) {
      const steps = 10;
      for (let k = 0; k < steps; k++) {
        const sa = r.a + (r.b - r.a) * k / steps, sb = r.a + (r.b - r.a) * (k + 1) / steps;
        const ya = r.ya + (r.yb - r.ya) * (k + 0.5) / steps + 1.0;
        const len = Math.abs(sb - sa) + 0.05;
        if (isZ) glow.box(e, ya, (sa + sb) / 2, 0.04, 0.04, len, { color: [0.22, 0.7, 1.0] });
        else glow.box((sa + sb) / 2, ya, e, len, 0.04, 0.04, { color: [0.22, 0.7, 1.0] });
      }
    }
    world.surfaces.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, axis: r.axis, a: r.a, b: r.b, ya: r.ya, yb: r.yb, ramp: true });
  }
