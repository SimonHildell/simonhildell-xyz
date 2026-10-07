import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { OPEN_BUILDINGS, addRamp, addRail, subtractRuns } from './vertical.js';
import { signTexture, radialTexture } from './textures.js';
import { GRID, mulberry32, QUALITY } from './util.js';

// Walk-through buildings: open-frame megastructure floors you can wander through,
// with switchback stairs between floors and bridges out to the skyways.
const H = GRID.block; // 11.5

function minusRect(r, h) {
  // r and h are {x0,x1,z0,z1}; returns r minus h as up to 4 rects
  if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) return [r];
  const out = [];
  if (h.z0 > r.z0) out.push({ ...r, z1: h.z0 });
  if (h.z1 < r.z1) out.push({ ...r, z0: h.z1 });
  const z0 = Math.max(r.z0, h.z0), z1 = Math.min(r.z1, h.z1);
  if (h.x0 > r.x0) out.push({ x0: r.x0, x1: h.x0, z0, z1 });
  if (h.x1 < r.x1) out.push({ x0: h.x1, x1: r.x1, z0, z1 });
  return out;
}

export function buildOpenBuildings(scene, world) {
  const concrete = new GeoBuilder();
  const deck = new GeoBuilder();
  const glow = new GeoBuilder();
  const glass = new GeoBuilder();
  const pools = [];
  const rnd = mulberry32(404);
  const signs = [];

  for (const B of OPEN_BUILDINGS) {
    const { cx, cz } = B;
    const x0 = cx - H, x1 = cx + H, z0 = cz - H, z1 = cz + H;
    const levels = [GRID.kerb, ...B.levels];
    const top = levels[levels.length - 1];
    const col = B.color;
    const base = [0.55, 0.55, 0.6];

    // stair lanes: even stairs on the south side heading west, odd on the north side heading east
    const stairs = [];
    for (let i = 0; i < levels.length - 1; i++) {
      const ya = levels[i], yb = levels[i + 1], mid = (ya + yb) / 2;
      const south = i % 2 === 0;
      const lz0 = south ? cz + 8 : cz - 11, lz1 = south ? cz + 11 : cz - 8;
      const sgn = south ? -1 : 1; // direction of travel along x
      const xs = south ? cx + 8.5 : cx - 8.5; // leaves a 3 m landing between the facade and the first step
      const f1 = { axis: 'x', z0: lz0, z1: lz1, a: xs, b: xs + sgn * 6, ya, yb: mid };
      const land = { a: xs + sgn * 6, b: xs + sgn * 9 };
      const f2 = { axis: 'x', z0: lz0, z1: lz1, a: xs + sgn * 9, b: xs + sgn * 15, ya: mid, yb };
      for (const f of [f1, f2]) { f.x0 = Math.min(f.a, f.b); f.x1 = Math.max(f.a, f.b); addRamp(f, deck, glow, world); }
      const lx0 = Math.min(land.a, land.b), lx1 = Math.max(land.a, land.b);
      deck.box((lx0 + lx1) / 2, mid - 0.3, (lz0 + lz1) / 2, lx1 - lx0, 0.3, lz1 - lz0, { su: 4, sv: 4, bottom: true, color: [0.24, 0.24, 0.28] });
      world.surfaces.push({ x0: lx0, x1: lx1, z0: lz0, z1: lz1, y: mid, deck: true });
      // the hole this stair needs in the floor above (over flight 2)
      const hole = { x0: Math.min(f2.a, f2.b), x1: Math.max(f2.a, f2.b), z0: lz0, z1: lz1 };
      stairs.push({ i, south, lz0, lz1, hole, ya, yb, xr: [Math.min(xs, f2.b), Math.max(xs, f2.b)] });
      // tall rail on the facade along the stair so nobody falls out mid-flight
      const tall = { axis: 'x', c: south ? z1 : z0, s0: Math.min(xs, f2.b), s1: Math.max(xs, f2.b), y: ya, h: yb - ya + 1.1 };
      const og = (B.openings[ya] || []).filter((o) => o.side === (south ? 'S' : 'N')).map((o) => ({ axis: 'x', c: tall.c, s0: o.a, s1: o.b, y: ya }));
      for (const r of subtractRuns(tall, og)) rails(B, r);
    }

    // columns
    const cols = [[-10.9, -10.9], [10.9, -10.9], [-10.9, 10.9], [10.9, 10.9], [-10.9, -3.6], [-10.9, 3.6], [10.9, -3.6], [10.9, 3.6], [-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]];
    for (const [dx, dz] of cols) {
      concrete.box(cx + dx, 0, cz + dz, 0.7, top, 0.7, { su: 4, sv: 4, top: false, color: base });
      world.colliderCircles.push({ x: cx + dx, z: cz + dz, r: 0.5, h: top + 0.5 });
    }

    // floors
    for (let k = 1; k < levels.length; k++) {
      const y = levels[k];
      const hole = stairs[k - 1].hole;
      const parts = minusRect({ x0, x1, z0, z1 }, hole);
      for (const p of parts) {
        concrete.box((p.x0 + p.x1) / 2, y - 0.4, (p.z0 + p.z1) / 2, p.x1 - p.x0, 0.4, p.z1 - p.z0, { su: 4, sv: 4, bottom: true, color: [0.42, 0.42, 0.46] });
        world.surfaces.push({ ...p, y, deck: true });
      }
      // glowing slab fascia + ceiling light strips underneath
      glow.box(cx, y - 0.42, cz, 23.06, 0.08, 23.06, { top: false, color: col.map((v) => v * 0.8) });
      for (const dz of [-4.5, 0, 4.5]) glow.box(cx, y - 0.45, cz + dz, 14, 0.04, 0.35, { color: [1.9, 1.8, 1.6] });
      for (const dz of [-4.5, 0, 4.5]) pools.push([cx, levels[k - 1], cz + dz]);
      // perimeter rails minus bridge openings
      const opens = (B.openings[y] || []);
      const sides = [
        { axis: 'x', c: z0, s0: x0, s1: x1, side: 'N' }, { axis: 'x', c: z1, s0: x0, s1: x1, side: 'S' },
        { axis: 'z', c: x0, s0: z0, s1: z1, side: 'W' }, { axis: 'z', c: x1, s0: z0, s1: z1, side: 'E' },
      ];
      for (const sd of sides) {
        const gaps = opens.filter((o) => o.side === sd.side).map((o) => ({ axis: sd.axis, c: sd.c, s0: o.a, s1: o.b, y }));
        for (const r of subtractRuns({ ...sd, y }, gaps)) rails(B, r);
      }
      // rails around the stair hole (inner long edge + the far end), arrival end stays open
      const st = stairs[k - 1];
      rails(B, { axis: 'x', c: st.south ? st.lz0 : st.lz1, s0: hole.x0, s1: hole.x1, y });
      rails(B, { axis: 'z', c: st.south ? hole.x1 : hole.x0, s0: st.lz0, s1: st.lz1, y });
    }

    // ---- furnishing per floor
    const shops = [[-7.5, -5.5], [7.5, -5.5], [-7.5, 5.5], [7.5, 5.5]];
    for (let k = 0; k < levels.length - 1; k++) {
      const y = levels[k];
      shops.forEach(([dx, dz], i) => {
        if (k > 0 && rnd() < 0.35) return;
        const c = [[2.4, 0.4, 1.4], [0.3, 1.8, 2.4], [2.6, 1.3, 0.3], [0.5, 2.4, 0.8]][(i + k + B.cx) & 3];
        const sx = cx + dx, sz = cz + dz;
        if (B.id === 'arcade' && k === 1) {
          // arcade cabinets
          for (let a = -1; a <= 1; a++) {
            concrete.box(sx + a * 1.1, y, sz, 0.8, 1.8, 0.7, { su: 4, sv: 4, color: [0.08, 0.08, 0.1] });
            glow.box(sx + a * 1.1, y + 1.1, sz + (dz > 0 ? -0.36 : 0.36), 0.62, 0.5, 0.02, { color: c });
            glow.box(sx + a * 1.1, y + 1.75, sz + (dz > 0 ? -0.36 : 0.36), 0.7, 0.12, 0.02, { color: c.map((v) => v * 0.6) });
          }
          world.colliders.push({ x0: sx - 1.7, x1: sx + 1.7, z0: sz - 0.4, z1: sz + 0.4, y0: y, h: 1.9, noCam: true });
          return;
        }
        // kiosk / food stall with a glowing front and counter
        concrete.box(sx, y, sz, 3.2, 2.5, 2.0, { su: 4, sv: 4, color: [0.16, 0.16, 0.19] });
        const fz = sz + (dz > 0 ? -1.01 : 1.01);
        glow.box(sx, y + 0.9, fz, 2.8, 1.2, 0.02, { color: c.map((v) => v * 0.55) });
        glow.box(sx, y + 2.25, fz, 3.0, 0.3, 0.03, { color: c });
        concrete.box(sx, y, sz + (dz > 0 ? -1.3 : 1.3), 3.2, 1.0, 0.5, { su: 4, sv: 4, color: [0.3, 0.22, 0.18] });
        world.colliders.push({ x0: sx - 1.6, x1: sx + 1.6, z0: sz - 1.6, z1: sz + 1.6, y0: y, h: 2.6, noCam: true });
        if (B.id === 'night') for (let l = -1; l <= 1; l += 2) glow.box(sx + l * 1.2, y + 2.8, fz, 0.25, 0.32, 0.25, { color: [2.6, 0.6, 0.2] });
      });
      // benches + planters in the middle
      concrete.box(cx, y, cz - 1.5, 3, 0.45, 0.6, { su: 4, sv: 4, color: [0.3, 0.3, 0.33] });
      concrete.box(cx, y, cz + 1.5, 3, 0.45, 0.6, { su: 4, sv: 4, color: [0.3, 0.3, 0.33] });
      glow.box(cx, y + 0.46, cz, 2.4, 0.5, 1.2, { color: [0.1, 0.5, 0.15] });
      world.colliders.push({ x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.8, z1: cz + 1.8, y0: y, h: 0.9, noCam: true });
    }

    // ---- roof
    if (B.id === 'market') {
      // sky bar: counter, stools, umbrellas
      concrete.box(cx - 5, top, cz - 4, 6, 1.1, 1.2, { su: 4, sv: 4, color: [0.12, 0.12, 0.14] });
      glow.box(cx - 5, top + 1.1, cz - 4, 6.1, 0.05, 1.3, { color: [2.4, 0.4, 1.4] });
      world.colliders.push({ x0: cx - 8, x1: cx - 2, z0: cz - 4.6, z1: cz - 3.4, y0: top, h: 1.2, noCam: true });
      for (const [ux, uz] of [[4, -3], [4, 3], [-4, 4]]) {
        concrete.box(cx + ux, top, cz + uz, 0.1, 2.4, 0.1, { su: 4, sv: 4, color: [0.6, 0.6, 0.6] });
        glow.box(cx + ux, top + 2.4, cz + uz, 2.6, 0.06, 2.6, { color: [0.4, 1.4, 2.0] });
        concrete.box(cx + ux, top + 2.25, cz + uz, 2.5, 0.15, 2.5, { su: 4, sv: 4, color: [0.1, 0.1, 0.12] });
      }
      signs.push({ text: 'SKY BAR', color: '#ff4fa3', x: cx, y: top + 2.2, z: cz - 10.4, ry: 0, w: 6 });
    } else if (B.id === 'arcade') {
      // roof garden
      for (let i = 0; i < 8; i++) {
        const gx = cx + (rnd() - 0.5) * 16, gz = cz + (rnd() - 0.5) * 12;
        concrete.box(gx, top, gz, 1.6, 0.5, 1.6, { su: 4, sv: 4, color: [0.25, 0.25, 0.27] });
        glow.box(gx, top + 0.5, gz, 1.4, 0.6 + rnd() * 0.6, 1.4, { color: [0.08, 0.45, 0.15] });
        world.colliders.push({ x0: gx - 0.8, x1: gx + 0.8, z0: gz - 0.8, z1: gz + 0.8, y0: top, h: 1.2, noCam: true });
      }
    } else if (B.pad) {
      // landing pad for a spinner
      const segs = 40;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        if (i % 2) glow.box(cx + Math.cos(a) * 5, top + 0.02, cz + Math.sin(a) * 5, 0.7, 0.03, 0.18, { color: [2.6, 1.3, 0.3] });
      }
      glow.box(cx - 1.2, top + 0.02, cz, 0.35, 0.03, 3, { color: [2.6, 1.3, 0.3] });
      glow.box(cx + 1.2, top + 0.02, cz, 0.35, 0.03, 3, { color: [2.6, 1.3, 0.3] });
      glow.box(cx, top + 0.02, cz, 2.4, 0.03, 0.35, { color: [2.6, 1.3, 0.3] });
    }
    // name sign on the roof edge facing the nearest skyway
    const face = B.id === 'market' ? 'S' : B.id === 'arcade' ? 'E' : 'W';
    const sw = 9;
    if (face === 'S') signs.push({ text: B.name, color: B.id === 'market' ? '#ff4fa3' : '#6af2ff', x: cx, y: top + 1.6, z: z1 + 0.2, ry: 0, w: sw });
    if (face === 'E') signs.push({ text: B.name, color: '#6af2ff', x: x1 + 0.2, y: top + 1.6, z: cz, ry: Math.PI / 2, w: sw * 0.7 });
    if (face === 'W') signs.push({ text: B.name, color: '#ffb347', x: x0 - 0.2, y: top + 1.6, z: cz, ry: -Math.PI / 2, w: sw });
  }

  function rails(B, r) { addRail(r, glass, glow, world); }

  const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8a8a92, roughness: 0.8, metalness: 0.1 });
  scene.add(new THREE.Mesh(concrete.build(), concreteMat));
  scene.add(new THREE.Mesh(deck.build(), new THREE.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.35, metalness: 0.75, vertexColors: true })));
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  scene.add(new THREE.Mesh(glass.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));

  // fake light pools on the floor under each ceiling strip
  const pg = new THREE.PlaneGeometry(14, 6); pg.rotateX(-Math.PI / 2); pg.translate(0, 0.03, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,240,220,0.45)', 'rgba(255,240,220,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), pools.length);
  const m4 = new THREE.Matrix4();
  pools.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); pm.setMatrixAt(i, m4); });
  scene.add(pm);

  for (const s of signs) {
    const t = signTexture(s.text, s.color, { size: 96 });
    const h = s.w / t.userData.aspect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, side: THREE.DoubleSide }));
    m.position.set(s.x, s.y + h / 2, s.z); m.rotation.y = s.ry;
    scene.add(m);
  }
  void QUALITY;
}
