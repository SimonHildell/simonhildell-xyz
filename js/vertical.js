import * as THREE from 'three';
import { GeoBuilder } from './geo.js';

// Elevated walkways: two skyways over the x=±17 avenues (level 1, 6 m), a cross bridge,
// a deck for the Finch screen, and a stair + bridge up to the printer podium (level 2, 12 m).
const L1 = 6, L2 = 12, T = 0.4;

const DECKS = [
  { x0: -19, x1: -15, z0: -51, z1: 51, y: L1, c: [0.3, 1.6, 2.2] },   // west skyway
  { x0: 15, x1: 19, z0: -51, z1: 51, y: L1, c: [2.2, 0.35, 1.5] },    // east skyway
  { x0: -15, x1: 15, z0: -19, z1: -15, y: L1, c: [2.2, 1.2, 0.3] },   // cross bridge
  { x0: 19, x1: 31, z0: -42, z1: -26, y: L1, c: [0.3, 2.2, 1.2] },    // Finch deck
  { x0: -27, x1: -19, z0: -38, z1: -34, y: L2, c: [2.4, 1.2, 0.3] },  // bridge to the podium
  // stair to level 2: bottom landing off the west skyway + a mid landing
  { x0: -22, x1: -19, z0: -16, z1: -12, y: L1, c: [2.4, 1.2, 0.3] },
  { x0: -22, x1: -19, z0: -27, z1: -24, y: 9, c: [2.4, 1.2, 0.3], pillar: [-21.6, -25.5] },
];

const RAMPS = [
  { x0: -19, x1: -15, z0: 51, z1: 61, a: 51, b: 61, ya: L1, yb: 0 },
  { x0: -19, x1: -15, z0: -61, z1: -51, a: -51, b: -61, ya: L1, yb: 0 },
  { x0: 15, x1: 19, z0: 51, z1: 61, a: 51, b: 61, ya: L1, yb: 0 },
  { x0: 15, x1: 19, z0: -61, z1: -51, a: -51, b: -61, ya: L1, yb: 0 },
  { x0: -22, x1: -19, z0: -24, z1: -16, a: -16, b: -24, ya: L1, yb: 9 },   // flight 1: 6 → 9 m
  { x0: -22, x1: -19, z0: -34, z1: -27, a: -27, b: -34, ya: 9, yb: L2 },   // flight 2: 9 → 12 m, lands on the bridge
];

// railings: [x0,x1,z0,z1,y]
const RAILS = [
  [-19.1, -18.9, -51, -16, L1], [-19.1, -18.9, -12, 51, L1],
  // stair to level 2: outer edge + end of the bottom landing
  [-22.1, -21.9, -34, -12, L1, 7.2], [-22, -19, -12.1, -11.9, L1],
  [-15.1, -14.9, -51, -19, L1], [-15.1, -14.9, -15, 51, L1],
  [14.9, 15.1, -51, -19, L1], [14.9, 15.1, -15, 51, L1],
  [18.9, 19.1, -51, -42, L1], [18.9, 19.1, -26, 51, L1],
  [-15, 15, -19.1, -18.9, L1], [-15, 15, -15.1, -14.9, L1],
  [19, 31, -42.1, -41.9, L1], [19, 31, -26.1, -25.9, L1], [30.9, 31.1, -42, -26, L1],
  [-27, -19, -38.1, -37.9, L2], [-27, -22, -34.1, -33.9, L2], [-19.1, -18.9, -38, -34, L2],
  // podium roof edge (gap where the bridge lands)
  [-41, -27, -41.1, -40.9, L2], [-41, -27, -27.1, -26.9, L2], [-41.1, -40.9, -41, -27, L2],
  [-27.1, -26.9, -41, -38, L2], [-27.1, -26.9, -34, -27, L2],
];

export function buildVertical(scene, world) {
  const deck = new GeoBuilder();
  const glow = new GeoBuilder();
  const glass = new GeoBuilder();
  const pillars = [];
  for (const d of DECKS) {
    const w = d.x1 - d.x0, l = d.z1 - d.z0, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
    deck.box(cx, d.y - T, cz, w, T, l, { su: 4, sv: 4, bottom: true, color: [0.22, 0.23, 0.27] });
    // neon edge strips + underside light line
    glow.box(cx, d.y - T - 0.02, cz, w + 0.06, 0.06, l + 0.06, { top: false, color: d.c.map((v) => v * 0.7) });
    if (w < l) glow.box(cx, d.y - T - 0.05, cz, 0.3, 0.03, l - 1, { color: d.c.map((v) => v * 0.6) });
    else glow.box(cx, d.y - T - 0.05, cz, w - 1, 0.03, 0.3, { color: d.c.map((v) => v * 0.6) });
    world.surfaces.push({ x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, y: d.y, deck: true });
    if (d.pillar) pillars.push([d.pillar[0], d.pillar[1], d.y - T]);
    // pillars along the long edges
    if (d.y === L1) {
      const along = w < l ? 'z' : 'x';
      const [s0, s1] = along === 'z' ? [d.z0, d.z1] : [d.x0, d.x1];
      for (let s = s0 + 2; s <= s1 - 1; s += 11) {
        for (const e of along === 'z' ? [d.x0 + 0.3, d.x1 - 0.3] : [d.z0 + 0.3, d.z1 - 0.3]) {
          const [x, z] = along === 'z' ? [e, s] : [s, e];
          // keep the crossing roads under the skyways clear
          if (along === 'z' && [-51, -17, 17, 51].some((q) => Math.abs(z - q) < 4)) continue;
          pillars.push([x, z, d.y - T]);
        }
      }
    }
  }
  // stairs: treads with glowing nosings
  for (const r of RAMPS) {
    const run = Math.abs(r.b - r.a), n = Math.round(run / 0.5);
    const w = r.x1 - r.x0, cx = (r.x0 + r.x1) / 2;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const z = r.a + (r.b - r.a) * (t0 + t1) / 2;
      const y = r.ya + (r.yb - r.ya) * t1;
      const top = Math.max(r.ya + (r.yb - r.ya) * t0, y);
      deck.box(cx, top - 0.1, z, w, 0.1, 0.52, { su: 4, sv: 4, color: [0.2, 0.2, 0.24] });
      if (i % 2 === 0) glow.box(cx, top - 0.02, r.b > r.a ? z - 0.25 : z + 0.25, w, 0.03, 0.04, { color: [1.6, 1.0, 0.4] });
    }
    // side stringers as glowing lines
    for (const x of [r.x0, r.x1]) {
      const steps = 12;
      for (let k = 0; k < steps; k++) {
        const za = r.a + (r.b - r.a) * k / steps, zb = r.a + (r.b - r.a) * (k + 1) / steps;
        const ya = r.ya + (r.yb - r.ya) * k / steps + 1.0;
        glow.box(x, ya, (za + zb) / 2, 0.04, 0.04, Math.abs(zb - za) + 0.05, { color: [0.22, 0.7, 1.0] });
      }
    }
    world.surfaces.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, axis: 'z', a: r.a, b: r.b, ya: r.ya, yb: r.yb, ramp: true });
  }
  // railings: glass panel + glowing handrail
  for (const [x0, x1, z0, z1, y, hh] of RAILS) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, l = z1 - z0;
    glass.box(cx, y, cz, Math.max(w, 0.04), 1.0, Math.max(l, 0.04), { top: false, color: [0.25, 0.6, 0.9] });
    glow.box(cx, y + 1.0, cz, Math.max(w, 0.05), 0.04, Math.max(l, 0.05), { color: [0.22, 0.7, 1.0] });
    world.colliders.push({ x0, x1, z0, z1, y0: y, h: hh ?? 1.1, noCam: true });
  }

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.35, metalness: 0.75, envMapIntensity: 1.1 });
  scene.add(new THREE.Mesh(deck.build(), deckMat));
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  scene.add(new THREE.Mesh(glass.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));

  const pg = new THREE.CylinderGeometry(0.22, 0.28, 1, 10); pg.translate(0, 0.5, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.8, roughness: 0.35 }), pillars.length);
  const m4 = new THREE.Matrix4();
  pillars.forEach(([x, z, h], i) => { m4.makeScale(1, h, 1).setPosition(x, 0, z); pm.setMatrixAt(i, m4); world.colliderCircles.push({ x, z, r: 0.3, h }); });
  scene.add(pm);
}
