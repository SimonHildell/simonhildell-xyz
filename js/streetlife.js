import * as THREE from 'three';
import { slabTextures, radialTexture } from './textures.js';
import { GRID, QUALITY, smoothstep, mulberry32 } from './util.js';

const districtT = (x) => smoothstep(-38, 38, x);
const LINES = [-51, -17, 17, 51];

// Everything at street level: raised sidewalks, props, pedestrians, cables, rain ripples.
export function buildStreetLife(scene, world) {
  const rnd = mulberry32(77);
  buildSlabs(scene, world);
  buildProps(scene, world, rnd);
  buildPedestrians(scene, world, rnd);
  buildCables(scene, world, rnd);
  buildRipples(scene, world);
}

function buildSlabs(scene, world) {
  const S = GRID.slab, H = GRID.kerb;
  const pos = [], nor = [], uv = [], idx = [];
  const quad = (p, n, u) => { const b = pos.length / 3; p.forEach((v) => pos.push(...v)); for (let i = 0; i < 4; i++) nor.push(...n); uv.push(...u); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const side = [[0, 0], [0, 0], [0, 0], [0, 0]].flat();
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const cx = GRID.cellCenter(i), cz = GRID.cellCenter(j);
    const x0 = cx - S, x1 = cx + S, z0 = cz - S, z1 = cz + S;
    quad([[x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0]], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1]);
    // kerb faces (sample the kerb-stone edge of the texture)
    const k = [0.002, 0.002, 0.004, 0.002, 0.004, 0.004, 0.002, 0.004];
    quad([[x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]], [0, 0, 1], k);
    quad([[x1, 0, z0], [x0, 0, z0], [x0, H, z0], [x1, H, z0]], [0, 0, -1], k);
    quad([[x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1]], [1, 0, 0], k);
    quad([[x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]], [-1, 0, 0], k);
    world.surfaces.push({ x0, x1, z0, z1, y: H, kerb: true });
  }
  void side;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const { map, rough } = slabTextures();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0.35, envMapIntensity: 0.8, color: 0xb0b4c0 }));
  scene.add(m);
}

// vending machines, bollards and crates along the sidewalks
function buildProps(scene, world, rnd) {
  const B = GRID.block;
  const vend = [];
  const skip = new Set(['2,0', '2,2', '1,1']);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    if (skip.has(`${i},${j}`)) continue;
    const cx = GRID.cellCenter(i), cz = GRID.cellCenter(j);
    const n = rnd() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const face = (rnd() * 4) | 0, along = (rnd() - 0.5) * 16;
      const o = B + 0.75;
      const [x, z, ry] = face === 0 ? [cx + along, cz + o, 0] : face === 1 ? [cx + along, cz - o, Math.PI] : face === 2 ? [cx + o, cz + along, Math.PI / 2] : [cx - o, cz + along, -Math.PI / 2];
      vend.push({ x, z, ry, c: [[1, 0.3, 0.6], [0.3, 0.9, 1], [1, 0.7, 0.2], [0.5, 1, 0.5]][(rnd() * 4) | 0] });
    }
  }
  // geometry: dark body + bright front panel (vertex colours), tinted per instance
  const body = new THREE.BoxGeometry(0.95, 1.9, 0.75);
  const cols = [];
  const p = body.attributes.position, nrm = body.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const front = nrm.getZ(i) > 0.5;
    const v = front ? 2.2 : 0.04;
    cols.push(v, v, v);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  body.translate(0, 0.95 + GRID.kerb, 0);
  const vm = new THREE.InstancedMesh(body, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), vend.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3(), col = new THREE.Color();
  // the machine faces the street: its front (+z) should point away from the block centre
  vend.forEach((d, i) => {
    q.setFromEuler(e.set(0, d.ry, 0)); m4.compose(v3.set(d.x, 0, d.z), q, one); vm.setMatrixAt(i, m4);
    vm.setColorAt(i, col.setRGB(...d.c));
    world.colliderCircles.push({ x: d.x, z: d.z, r: 0.6, h: 2.1 });
  });
  scene.add(vm);
  // a soft glow in front of each machine
  const glowG = new THREE.PlaneGeometry(2.4, 2.4); glowG.rotateX(-Math.PI / 2); glowG.translate(0, GRID.kerb + 0.02, 1.1);
  const glow = new THREE.InstancedMesh(glowG, new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), vend.length);
  vend.forEach((d, i) => { q.setFromEuler(e.set(0, d.ry, 0)); m4.compose(v3.set(d.x, 0, d.z), q, one); glow.setMatrixAt(i, m4); glow.setColorAt(i, col.setRGB(...d.c).multiplyScalar(0.6)); });
  scene.add(glow);

  // bollards with glowing caps at every crossing corner
  const bol = [];
  for (const L of [-85, ...LINES, 85]) for (const M of [-85, ...LINES, 85]) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = L + sx * 3.8, z = M + sz * 3.8;
      if (Math.abs(x) > 88 || Math.abs(z) > 88) continue;
      bol.push([x, z]);
    }
  }
  const bg = new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8); bg.translate(0, 0.45 + GRID.kerb, 0);
  const cap = new THREE.CylinderGeometry(0.105, 0.105, 0.08, 8); cap.translate(0, 0.86 + GRID.kerb, 0);
  const bm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0x1a1b20, metalness: 0.7, roughness: 0.4 }), bol.length);
  const cm = new THREE.InstancedMesh(cap, new THREE.MeshBasicMaterial({ toneMapped: false }), bol.length);
  bol.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); bm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4); const t = districtT(x); cm.setColorAt(i, col.setRGB(2.4, 0.9, 0.3).lerp(new THREE.Color(0.4, 2, 2.6), t)); });
  scene.add(bm, cm);
}

// Pedestrians with glowing umbrella shafts walking the sidewalks
function buildPedestrians(scene, world, rnd) {
  const N = QUALITY.low ? 22 : 44;
  const peds = [];
  for (let i = 0; i < N; i++) {
    const axis = rnd() < 0.5 ? 'x' : 'z';
    const L = LINES[(rnd() * 4) | 0] + (rnd() < 0.5 ? -5 : 5);
    peds.push({ axis, L, s: rnd() * 170 - 85, v: (rnd() < 0.5 ? -1 : 1) * (1.0 + rnd() * 0.7), ph: rnd() * 10, c: [[1, 0.25, 0.7], [0.3, 0.9, 1], [1, 0.75, 0.3], [0.7, 0.4, 1], [1, 1, 1]][(rnd() * 5) | 0], tall: 0.9 + rnd() * 0.2, umb: rnd() < 0.8 });
  }
  const bodyG = new THREE.CylinderGeometry(0.17, 0.26, 1.45, 8); bodyG.translate(0, 0.72, 0);
  const headG = new THREE.SphereGeometry(0.13, 8, 6); headG.translate(0, 1.6, 0);
  const canG = new THREE.ConeGeometry(0.62, 0.28, 12, 1, true); canG.translate(0, 2.05, 0);
  const shaftG = new THREE.CylinderGeometry(0.018, 0.018, 1.1, 4); shaftG.translate(0, 1.45, 0.08);
  const dark = new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.7 });
  const body = new THREE.InstancedMesh(bodyG, dark, N);
  const head = new THREE.InstancedMesh(headG, dark, N);
  const can = new THREE.InstancedMesh(canG, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }), N);
  const shaft = new THREE.InstancedMesh(shaftG, new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  const col = new THREE.Color();
  peds.forEach((p, i) => { can.setColorAt(i, col.setRGB(...p.c).multiplyScalar(0.8)); shaft.setColorAt(i, col.setRGB(...p.c).multiplyScalar(3)); });
  scene.add(body, head, can, shaft);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), hide = new THREE.Vector3(0.0001, 0.0001, 0.0001);
  world.updaters.push((t, dt) => {
    peds.forEach((p, i) => {
      p.s += p.v * dt;
      if (p.s > 86) p.s = -86; if (p.s < -86) p.s = 86;
      const bob = Math.abs(Math.sin(t * 5 + p.ph)) * 0.04;
      if (p.axis === 'x') { v3.set(p.s, GRID.kerb + bob, p.L); e.set(0, p.v > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      else { v3.set(p.L, GRID.kerb + bob, p.s); e.set(0, p.v > 0 ? 0 : Math.PI, 0); }
      q.setFromEuler(e);
      sc.set(1, p.tall, 1);
      m4.compose(v3, q, sc); body.setMatrixAt(i, m4); head.setMatrixAt(i, m4);
      m4.compose(v3, q, p.umb ? sc : hide); can.setMatrixAt(i, m4); shaft.setMatrixAt(i, m4);
    });
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = can.instanceMatrix.needsUpdate = shaft.instanceMatrix.needsUpdate = true;
  });
}

// sagging cables and lantern strings across the streets
function buildCables(scene, world, rnd) {
  const seg = [], lamps = [], lcol = [];
  const SEG = 10;
  for (let k = 0; k < (QUALITY.low ? 26 : 44); k++) {
    const L = LINES[(rnd() * 4) | 0];
    const s = (rnd() - 0.5) * 160;
    const y0 = 8 + rnd() * 9, y1 = y0 + (rnd() - 0.5) * 3, sag = 0.6 + rnd() * 1.6;
    const across = rnd() < 0.5;
    const pt = (u) => {
      const a = L - 11 + u * 22;
      const y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag;
      return across ? [a, y, s] : [s, y, a];
    };
    for (let i = 0; i < SEG; i++) seg.push(...pt(i / SEG), ...pt((i + 1) / SEG));
    if (rnd() < 0.4) {
      const c = [[1, 0.3, 0.3], [1, 0.7, 0.3], [0.4, 0.9, 1], [1, 0.4, 0.8]][(rnd() * 4) | 0];
      for (let i = 1; i < 12; i++) { lamps.push(...pt(i / 12)); lcol.push(c[0] * 2, c[1] * 2, c[2] * 2); }
    }
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x050507 })));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
  scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, toneMapped: false, map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
}

// rain ripples on the ground around the camera (shader-positioned, one draw call)
function buildRipples(scene, world) {
  const N = QUALITY.low ? 180 : 420;
  const pos = [], seed = [], uv = [], idx = [];
  for (let i = 0; i < N; i++) {
    const s = [Math.random(), Math.random(), Math.random()];
    const b = i * 4;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { pos.push(u, 0, v); uv.push(u, v); seed.push(...s); });
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3));
  g.setIndex(idx);
  const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 seed; uniform float uTime; uniform vec3 uCam; uniform float uAmount; varying vec2 vUv; varying float vT; varying float vA;
      float streetDist(float v){ float m = mod(v + 17.0, 34.0); return min(m, 34.0 - m); }
      void main(){
        float B = 28.0;
        float cyc = uTime * (0.9 + seed.z * 0.6) + seed.z * 10.0;
        float k = floor(cyc);
        float t = fract(cyc);
        vec2 rs = fract(vec2(sin(k * 12.9 + seed.x * 78.2), sin(k * 39.3 + seed.y * 11.1)) * 43758.5);
        vec2 base = uCam.xz + (fract(seed.xy + rs * 0.37) - 0.5) * B;
        bool road = streetDist(base.x) < 3.5 || streetDist(base.y) < 3.5;
        float y = road ? 0.02 : 0.17;
        float sz = 0.08 + t * 0.55;
        vec3 p = vec3(base.x + position.x * sz, y, base.y + position.z * sz);
        vUv = uv; vT = t; vA = step(seed.z, uAmount);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying vec2 vUv; varying float vT; varying float vA;
      void main(){ float r = length(vUv); float ring = smoothstep(0.8, 0.92, r) * smoothstep(1.0, 0.92, r); float a = ring * (1.0 - vT) * 0.5 * vA; if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * a, a); }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  world.ripples = u;
}
