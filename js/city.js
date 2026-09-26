import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { windowTexture, groundTextures, signTexture, radialTexture, billboardTexture } from './textures.js';
import { mulberry32, GRID, QUALITY, smoothstep } from './util.js';
import { buildStreetLife } from './streetlife.js';

// Cells that are kept open for anomalies / special places.
export const SPECIAL_CELLS = {
  '0,0': 'nakagin', '4,0': 'zephyr', '1,1': 'printer', '3,1': 'finch',
  '0,2': 'naturum', '2,2': 'plaza', '4,2': 'studios', '1,3': 'rainhub',
  '3,3': 'tratten', '2,4': 'entry', '2,0': 'studio',
};

const SIGN_WORDS = [
  ['ラーメン', '#ff4fa3'], ['OPEN 24H', '#6af2ff'], ['HOTELL', '#ffb347'], ['電脳', '#ff4fa3'],
  ['FIKA', '#ffd86a'], ['NOODLE', '#6af2ff'], ['薬局', '#7dff9a'], ['BAR', '#ff4fa3'],
  ['KAFFE', '#ffb347'], ['夢', '#b18cff'], ['GRID', '#6af2ff'], ['ÖPPET', '#ff6a3d'],
  ['NEON', '#ff4fa3'], ['酒', '#ff6a3d'], ['REPAIR', '#7dff9a'], ['カプセル', '#b18cff'],
];

const BILLBOARDS = [
  [['NEURAL', 'RAIN', 'forecast: always'], '#ff2e88', '#2a0a3a'],
  [['PARAM', 'dream in parameters'], '#00d5ff', '#051a33'],
  [['雨', 'synthetic weather co.'], '#ff7a1a', '#2b0c00'],
  [['ORIGAMI', 'folding space since 2026'], '#b36bff', '#0b0026'],
  [['OFF-WORLD', 'a new life awaits'], '#ffb000', '#2a1200'],
  [['SPLINE', 'curves for everyone'], '#00ffa2', '#00261a'],
  [['NOCTURNE', 'the city never sleeps'], '#ff3355', '#1a0010'],
];

export function districtT(x) { return smoothstep(-38, 38, x); } // 0 = dust/orange west, 1 = neon/rain east

export function buildCity(scene, world, renderer) {
  const rnd = mulberry32(2049);
  const colliders = world.colliders;
  const kinds = [new GeoBuilder(), new GeoBuilder(), new GeoBuilder()];
  const shop = new GeoBuilder();
  const neon = new GeoBuilder();
  const roofLights = [];
  const signs = [];
  const boards = [];

  const addBuilding = (cx, cz, w, d, h, opts = {}) => {
    const kind = opts.kind ?? (rnd() < 0.4 ? 0 : rnd() < 0.7 ? 1 : 2);
    const shade = 0.55 + rnd() * 0.45;
    const tint = districtT(cx);
    const color = [shade * (1.0 - 0.15 * tint), shade * 0.95, shade * (0.9 + 0.15 * tint)];
    const ou = rnd() * 4, ov = ((rnd() * 32) | 0) / 32;
    kinds[kind].box(cx, 0, cz, w, h, d, { ou, ov, color });
    let top = h;
    // setbacks
    if (h > 38 && !opts.flat) {
      const tiers = 1 + (rnd() < 0.5 ? 1 : 0);
      let tw = w, td = d;
      for (let t = 0; t < tiers; t++) {
        tw = Math.max(4, tw - 2 - rnd() * 5); td = Math.max(4, td - 2 - rnd() * 5);
        const th = h * (0.15 + rnd() * 0.35);
        kinds[(kind + 1) % 3].box(cx + (rnd() - 0.5) * (w - tw) * 0.5, top, cz + (rnd() - 0.5) * (d - td) * 0.5, tw, th, td, { ou: rnd() * 4, ov, color });
        top += th;
      }
    }
    // antenna + red light
    if (rnd() < 0.55 && !opts.flat) {
      const ah = 4 + rnd() * 10;
      neon.box(cx, top, cz, 0.25, ah, 0.25, { color: [0.05, 0.05, 0.06] });
      roofLights.push(new THREE.Vector3(cx, top + ah, cz));
    }
    // ground floor shopfronts
    if (!opts.noShop) shop.box(cx, 0.15, cz, w + 0.12, 3.6, d + 0.12, { su: 16, top: false, vRange: [0, 1], color: neonColor(rnd, cx).map((c) => c * (0.5 + rnd() * 0.6)) });
    // horizontal neon bands
    if (rnd() < 0.45 && h > 14) {
      const y = 4.5 + rnd() * Math.min(30, h - 6);
      neon.box(cx, y, cz, w + 0.14, 0.18, d + 0.14, { top: false, color: neonColor(rnd, cx).map((c) => c * 2.2) });
    }
    if (!opts.noCollide) colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h: opts.collideH ?? 999 });
    // blade signs
    if (!opts.noSign && rnd() < 0.7) {
      const n = 1 + (rnd() * 2 | 0);
      for (let k = 0; k < n; k++) signs.push(makeBladeSign(cx, cz, w, d, h));
    }
    if (!opts.noBoard && h > 48 && rnd() < 0.35) boards.push({ cx, cz, w, d, h });
    return top;
  };

  const makeBladeSign = (cx, cz, w, d, h) => {
    const [word, col] = SIGN_WORDS[(rnd() * SIGN_WORDS.length) | 0];
    const face = (rnd() * 4) | 0;
    const along = (rnd() - 0.5) * 0.8;
    const y = 5 + rnd() * Math.min(18, h - 8);
    let x = cx, z = cz, ry = 0;
    if (face === 0) { z = cz + d / 2 + 0.9; x = cx + along * w; ry = Math.PI / 2; }
    if (face === 1) { z = cz - d / 2 - 0.9; x = cx + along * w; ry = Math.PI / 2; }
    if (face === 2) { x = cx + w / 2 + 0.9; z = cz + along * d; ry = 0; }
    if (face === 3) { x = cx - w / 2 - 0.9; z = cz + along * d; ry = 0; }
    return { word, col, x, y, z, ry };
  };

  // ---- blocks (23 m buildable, 27 m raised slab, 7 m roads)
  const cellKeys = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) cellKeys.push([i, j]);
  const BW = GRID.block * 2, BH = BW / 2;
  for (const [i, j] of cellKeys) {
    const key = `${i},${j}`;
    const cx = GRID.cellCenter(i), cz = GRID.cellCenter(j);
    const special = SPECIAL_CELLS[key];
    if (special === 'studio') {
      // tower behind the studio + slim side towers; the studio itself is built in studio.js
      addBuilding(cx, cz + 7.25, BW, 8.5, 70 + rnd() * 20, { kind: 1 });
      addBuilding(cx - 10.25, cz - 5, 2.5, 13, 24, { kind: 0, noBoard: true, noSign: true });
      addBuilding(cx + 10.25, cz - 5, 2.5, 13, 32, { kind: 2, noBoard: true, noSign: true });
      continue;
    }
    if (special === 'printer') {
      // a 12 m podium: the printer sits on its roof (level 2)
      addBuilding(cx, cz, 14, 14, 12, { kind: 0, flat: true, noBoard: true, collideH: 12 });
      neon.box(cx, 12, cz, 14.2, 0.25, 14.2, { top: false, color: [2.4, 1.2, 0.3] });
      world.surfaces.push({ x0: cx - 7, x1: cx + 7, z0: cz - 7, z1: cz + 7, y: 12 });
      continue;
    }
    if (special) {
      if (['naturum', 'rainhub'].includes(special)) {
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(() => rnd() < 0.5).slice(0, 2);
        for (const [sx, sz] of corners) addBuilding(cx + sx * 9, cz + sz * 9, 5, 5, 7 + rnd() * 10, { flat: true, noBoard: true });
      }
      continue;
    }
    const pattern = rnd();
    const lots = [];
    const g = 1.6; // alley
    const q = BH / 2;
    if (pattern < 0.25) lots.push([cx, cz, BW, BW]);
    else if (pattern < 0.6) {
      if (rnd() < 0.5) { lots.push([cx - q - g / 4, cz, BH - g / 2, BW], [cx + q + g / 4, cz, BH - g / 2, BW]); }
      else { lots.push([cx, cz - q - g / 4, BW, BH - g / 2], [cx, cz + q + g / 4, BW, BH - g / 2]); }
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lots.push([cx + sx * (q + g / 4), cz + sz * (q + g / 4), BH - g / 2, BH - g / 2]);
    }
    for (const [x, z, w, d] of lots) {
      const centreBoost = 1 - Math.hypot(cx, cz) / 140;
      const h = 16 + Math.pow(rnd(), 1.4) * 70 * (0.6 + centreBoost) + (rnd() < 0.08 ? 60 : 0);
      addBuilding(x, z, w, d, h);
    }
  }

  // ---- perimeter megastructures (outside the playable area)
  const P = 93;
  for (let s = -125; s < 125; s += 18 + rnd() * 10) {
    const w = 14 + rnd() * 10;
    addBuilding(s, P + 12 + rnd() * 6, w, 22, 50 + rnd() * 110, { noCollide: true, noShop: rnd() < 0.5 });
    addBuilding(P + 12 + rnd() * 6, s, 22, w, 50 + rnd() * 110, { noCollide: true, noShop: rnd() < 0.5 });
    addBuilding(-P - 12 - rnd() * 6, s, 22, w, 50 + rnd() * 110, { noCollide: true, noShop: rnd() < 0.5 });
  }
  // the Sea Wall to the north
  kinds[2].box(0, 0, -P - 30, 400, 190, 40, { color: [0.35, 0.33, 0.32], ou: 0.2 });
  for (let k = 0; k < 7; k++) neon.box(0, 20 + k * 24, -P - 9.9, 400, 0.4, 0.2, { top: false, color: [2.2, 0.7, 0.25] });
  // far skyline
  for (let k = 0; k < 70; k++) {
    const a = rnd() * Math.PI * 2, r = 175 + rnd() * 170;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -115 && Math.abs(x) < 200) continue; // behind the wall
    const w = 16 + rnd() * 30;
    kinds[(rnd() * 3) | 0].box(x, 0, z, w, 80 + rnd() * 260, w * (0.6 + rnd() * 0.8), { ou: rnd() * 4, color: [0.6, 0.6, 0.7] });
  }

  // ---- materials + meshes
  const winTex = [windowTexture(0, 11), windowTexture(1, 22), windowTexture(2, 33)];
  kinds.forEach((kb, k) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2d36, vertexColors: true, roughness: 0.55, metalness: 0.35,
      emissive: 0xffffff, emissiveMap: winTex[k], emissiveIntensity: 1.35, envMapIntensity: 0.6,
    });
    const m = new THREE.Mesh(kb.build(), mat);
    m.matrixAutoUpdate = false;
    scene.add(m);
    world.buildingMeshes.push(m);
  });
  const shopMat = new THREE.MeshBasicMaterial({ map: shopTexture(), vertexColors: true, toneMapped: false });
  scene.add(new THREE.Mesh(shop.build(), shopMat));
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  scene.add(new THREE.Mesh(neon.build(), neonMat));

  // roof lights (blinking)
  {
    const g = new THREE.SphereGeometry(0.45, 6, 4);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.15, 0.1), toneMapped: false, transparent: true });
    const im = new THREE.InstancedMesh(g, m, roofLights.length);
    const mtx = new THREE.Matrix4();
    roofLights.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, mtx); });
    scene.add(im);
    world.updaters.push((t) => { m.opacity = 0.25 + 0.75 * (Math.sin(t * 2.2) > 0.2 ? 1 : 0); });
  }

  // blade signs: one atlas, one draw call, flicker in the shader
  {
    const size = 110, colW = 160, AH = 1024;
    const atlas = document.createElement('canvas'); atlas.width = colW * SIGN_WORDS.length; atlas.height = AH;
    const g = atlas.getContext('2d');
    const regions = SIGN_WORDS.map(([word, col], i) => {
      const chars = [...word]; const H = Math.min(AH, chars.length * size + 60); const x0 = i * colW;
      g.fillStyle = 'rgba(5,5,10,0.9)'; g.fillRect(x0, 0, colW, H);
      g.strokeStyle = col; g.lineWidth = 6; g.shadowColor = col; g.shadowBlur = 16; g.strokeRect(x0 + 10, 10, colW - 20, H - 20);
      g.font = `bold ${size}px "Share Tech Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowBlur = 24;
      g.fillStyle = col; chars.forEach((ch, k) => g.fillText(ch, x0 + colW / 2, 30 + size * (k + 0.5)));
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.55)'; chars.forEach((ch, k) => g.fillText(ch, x0 + colW / 2, 30 + size * (k + 0.5)));
      return { u0: x0 / atlas.width, u1: (x0 + colW) / atlas.width, v0: 1 - H / AH, v1: 1, aspect: colW / H };
    });
    const at = new THREE.CanvasTexture(atlas); at.colorSpace = THREE.SRGBColorSpace; at.anisotropy = 4;
    const pos = [], uv = [], fl = [], idx = [];
    for (const sg of signs) {
      const r = regions[SIGN_WORDS.findIndex(([w, c]) => w === sg.word && c === sg.col)];
      const w = 1.3, h = w / r.aspect;
      const dx = Math.cos(sg.ry) * w / 2, dz = -Math.sin(sg.ry) * w / 2;
      const b = pos.length / 3;
      pos.push(sg.x - dx, sg.y, sg.z - dz, sg.x + dx, sg.y, sg.z + dz, sg.x + dx, sg.y + h, sg.z + dz, sg.x - dx, sg.y + h, sg.z - dz);
      uv.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1);
      const f = Math.random() < 0.25 ? Math.random() * 10 : -1;
      fl.push(f, f, f, f);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('flick', new THREE.Float32BufferAttribute(fl, 1));
    geo.setIndex(idx);
    const su = { uMap: { value: at }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: su, side: THREE.DoubleSide, transparent: true,
      vertexShader: `attribute float flick; varying vec2 vUv; varying float vF; void main(){ vUv=uv; vF=flick; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying float vF;
        void main(){ vec4 c=texture2D(uMap,vUv); float k=1.0; if(vF>=0.0){ k = (sin(uTime*9.0+vF)+sin(uTime*23.0+vF*2.0)) > -1.4 ? 1.0 : 0.15; }
          gl_FragColor=vec4(c.rgb*1.7*k, c.a); }`,
    });
    scene.add(new THREE.Mesh(geo, mat));
    world.updaters.push((t) => (su.uTime.value = t));
  }

  // animated billboards
  const boardUniforms = [];
  boards.slice(0, 9).forEach((b, i) => {
    const [lines, ca, cb] = BILLBOARDS[i % BILLBOARDS.length];
    const map = billboardTexture(lines, ca, cb, i + 3);
    const u = { uMap: { value: map }, uTime: { value: 0 }, uSeed: { value: i * 1.7 } };
    boardUniforms.push(u);
    const mat = new THREE.ShaderMaterial({
      uniforms: u, toneMapped: false, transparent: true, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform sampler2D uMap; uniform float uTime; uniform float uSeed; varying vec2 vUv;
        void main(){
          vec2 uv=vUv;
          float band=step(0.97,fract(sin(floor(uTime*3.0+uSeed)*91.7)*4375.5));
          uv.x += band*0.03*sin(uv.y*80.0);
          vec3 c=texture2D(uMap,uv).rgb;
          float wave=0.6+0.4*sin(uv.y*6.0-uTime*1.5+uSeed);
          c*= 0.8+0.6*wave;
          c*= 0.85+0.15*sin(uv.y*400.0);
          gl_FragColor=vec4(c*1.25,0.92);
        }`,
    });
    const w = Math.min(14, (b.w > b.d ? b.w : b.d) * 0.7), h = w * 1.75;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const face = b.w > b.d ? (b.cz > 0 ? -1 : 1) : (b.cx > 0 ? -2 : 2);
    const y = Math.min(b.h - h / 2 - 2, 24 + h / 2);
    if (face === 1) { mesh.position.set(b.cx, y, b.cz + b.d / 2 + 0.3); }
    if (face === -1) { mesh.position.set(b.cx, y, b.cz - b.d / 2 - 0.3); mesh.rotation.y = Math.PI; }
    if (face === 2) { mesh.position.set(b.cx + b.w / 2 + 0.3, y, b.cz); mesh.rotation.y = Math.PI / 2; }
    if (face === -2) { mesh.position.set(b.cx - b.w / 2 - 0.3, y, b.cz); mesh.rotation.y = -Math.PI / 2; }
    scene.add(mesh);
  });
  world.updaters.push((t) => boardUniforms.forEach((u) => (u.uTime.value = t)));

  // ---- ground
  const { map, rough } = groundTextures();
  map.repeat.set(12, 12); rough.repeat.set(12, 12);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(408, 408),
    new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0.5, envMapIntensity: 0.9, color: 0x9aa0ad })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  world.ground = ground;

  buildStreetLife(scene, world, rnd);
  buildLamps(scene, world, rnd);
  buildSpinners(scene, world, rnd);
  buildRain(scene, world);
  buildDust(scene, world);
  buildSteam(scene, world, rnd);
  buildJelly(scene, world);
  buildSky(scene, world);
}

function neonColor(rnd, x) {
  const t = districtT(x);
  const west = [[1, 0.45, 0.12], [1, 0.7, 0.3], [0.9, 0.3, 0.2], [0.4, 0.9, 1]];
  const east = [[1, 0.2, 0.7], [0.2, 0.9, 1], [0.6, 0.35, 1], [1, 0.5, 0.2]];
  const pal = rnd() < t ? east : west;
  return pal[(rnd() * pal.length) | 0];
}

function shopTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 64) {
    const lit = Math.random();
    const grd = g.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, `rgba(255,255,255,${0.25 + lit * 0.5})`);
    grd.addColorStop(1, `rgba(255,255,255,${0.05 + lit * 0.15})`);
    g.fillStyle = grd; g.fillRect(x + 4, 30, 56, 98);
    g.fillStyle = `rgba(255,255,255,${0.6 + lit * 0.4})`; g.fillRect(x + 2, 6, 60, 16);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildLamps(scene, world, rnd) {
  const pts = [];
  const lines = [-85, -51, -17, 17, 51, 85];
  for (const L of lines) {
    for (let s = -85; s <= 85; s += 12) {
      if (lines.some((q) => Math.abs(q - s) < 6.5)) continue;
      pts.push([L + 3.9, s], [L - 3.9, s + 6], [s, L + 3.9], [s + 6, L - 3.9]);
    }
  }
  // no lamps where the skyways land their stairs
  const list = pts.filter(([x, z]) => Math.abs(x) <= 89 && Math.abs(z) <= 89 && !(Math.abs(Math.abs(x) - 17) < 5 && Math.abs(z) > 49 && Math.abs(z) < 64));
  const poleG = new THREE.BoxGeometry(0.16, 6, 0.16); poleG.translate(0, 3.15, 0);
  const headG = new THREE.BoxGeometry(0.5, 0.18, 1.6); headG.translate(0, 6.15, 0);
  const pole = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.8 }), list.length);
  const head = new THREE.InstancedMesh(headG, new THREE.MeshBasicMaterial({ toneMapped: false }), list.length);
  const poolTex = radialTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
  const poolG = new THREE.PlaneGeometry(8, 8); poolG.rotateX(-Math.PI / 2); poolG.translate(0, 0.17, 0);
  const pool = new THREE.InstancedMesh(poolG, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), list.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  list.forEach(([x, z], i) => {
    m.makeTranslation(x, 0, z);
    pole.setMatrixAt(i, m); head.setMatrixAt(i, m); pool.setMatrixAt(i, m);
    const t = districtT(x);
    c.setRGB(1, 0.55, 0.2).lerp(new THREE.Color(0.35, 0.85, 1), t);
    head.setColorAt(i, c.clone().multiplyScalar(2.5));
    pool.setColorAt(i, c.clone().multiplyScalar(0.55));
  });
  scene.add(pole, head, pool);
  world.colliderCircles.push(...list.map(([x, z]) => ({ x, z, r: 0.25 })));
}

function buildSpinners(scene, world, rnd) {
  const gb = new GeoBuilder();
  gb.box(0, -0.5, 0, 2.2, 1.1, 5.2, { color: [0.05, 0.05, 0.07] });
  gb.box(0, 0.6, -0.4, 1.8, 0.7, 2.6, { color: [0.12, 0.13, 0.16] });
  gb.box(-0.7, -0.2, 2.62, 0.5, 0.25, 0.05, { color: [3, 3, 2.6] });
  gb.box(0.7, -0.2, 2.62, 0.5, 0.25, 0.05, { color: [3, 3, 2.6] });
  gb.box(0, -0.2, -2.62, 2.0, 0.15, 0.05, { color: [3, 0.1, 0.1] });
  gb.box(0, -1.05, 0, 1.6, 0.05, 3.6, { color: [0.3, 0.8, 2] });
  const geo = gb.build();
  const n = QUALITY.spinners;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), n);
  const cars = [];
  const lanes = [-51, -17, 17, 51];
  for (let i = 0; i < n; i++) {
    cars.push({
      axis: rnd() < 0.5 ? 'x' : 'z', lane: lanes[(rnd() * 4) | 0] + (rnd() - 0.5) * 4,
      y: 22 + rnd() * 50, s: rnd() * 300 - 150, v: (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 18),
      bob: rnd() * 6,
    });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  scene.add(im);
  // ground-level hover traffic on the roads
  const gn = QUALITY.low ? 6 : 12;
  const gim = new THREE.InstancedMesh(geo, im.material, gn);
  const gcars = [];
  for (let i = 0; i < gn; i++) {
    const dir = rnd() < 0.5 ? -1 : 1;
    gcars.push({ axis: rnd() < 0.5 ? 'x' : 'z', lane: [-51, -17, 17, 51, -85, 85][(rnd() * 6) | 0] + dir * 1.75, s: rnd() * 180 - 90, v: dir * (7 + rnd() * 6), bob: rnd() * 6 });
  }
  scene.add(gim);
  world.groundCars = gcars;
  world.updaters.push((t, dt) => {
    gcars.forEach((c, i) => {
      c.s += c.v * dt;
      if (c.s > 95) c.s = -95; if (c.s < -95) c.s = 95;
      const y = 1.25 + Math.sin(t * 2 + c.bob) * 0.08;
      if (c.axis === 'x') { p.set(c.s, y, c.lane); e.set(0, c.v > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      else { p.set(c.lane, y, c.s); e.set(0, c.v > 0 ? 0 : Math.PI, 0); }
      q.setFromEuler(e); m.compose(p, q, sc); gim.setMatrixAt(i, m);
    });
    gim.instanceMatrix.needsUpdate = true;
    cars.forEach((c, i) => {
      c.s += c.v * dt;
      if (c.s > 170) c.s = -170; if (c.s < -170) c.s = 170;
      const y = c.y + Math.sin(t * 0.7 + c.bob) * 1.2;
      if (c.axis === 'x') { p.set(c.s, y, c.lane); e.set(0, c.v > 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(t + c.bob) * 0.05); }
      else { p.set(c.lane, y, c.s); e.set(0, c.v > 0 ? 0 : Math.PI, Math.sin(t + c.bob) * 0.05); }
      q.setFromEuler(e); m.compose(p, q, sc); im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
}

function buildRain(scene, world) {
  const N = QUALITY.rain;
  const pos = new Float32Array(N * 2 * 3);
  const seed = new Float32Array(N * 2 * 4);
  for (let i = 0; i < N; i++) {
    const a = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 2; k++) {
      pos.set([0, k, 0], (i * 2 + k) * 3);
      seed.set(a, (i * 2 + k) * 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 1 }, uColor: { value: new THREE.Color(0.6, 0.75, 1) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 seed; uniform float uTime; uniform vec3 uCam; uniform float uAmount; varying float vA;
      void main(){
        float B=46.0; float H=34.0;
        vec3 p;
        p.x = uCam.x + mod(seed.x*B - uCam.x + B*0.5, B) - B*0.5;
        p.z = uCam.z + mod(seed.z*B - uCam.z + B*0.5, B) - B*0.5;
        float sp = 22.0 + seed.w*10.0;
        p.y = mod(seed.y*H - uTime*sp, H) + max(uCam.y - 14.0, -2.0);
        p += position.y * vec3(0.12, 0.9 + seed.w*0.5, 0.05);
        vA = step(seed.w, uAmount) * (0.35 + 0.5*position.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ if(vA<0.01) discard; gl_FragColor=vec4(uColor*vA*0.55, vA*0.55);} `,
  });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  world.rain = u;
}

function buildDust(scene, world) {
  const N = QUALITY.low ? 600 : 1500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([Math.random(), Math.random(), Math.random()], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uTex: { value: radialTexture() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){
        float B=40.0;
        vec3 s = position;
        vec3 p;
        p.x = uCam.x + mod(s.x*B + uTime*1.6 - uCam.x + B*0.5, B) - B*0.5;
        p.z = uCam.z + mod(s.z*B + sin(uTime*0.3+s.y*6.0)*2.0 - uCam.z + B*0.5, B) - B*0.5;
        p.y = mod(s.y*16.0 + sin(uTime*0.5+s.x*9.0), 16.0);
        vec4 mv = viewMatrix*vec4(p,1.0);
        gl_PointSize = (40.0 + s.y*60.0) / -mv.z;
        vA = 0.5;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uAmount; varying float vA;
      void main(){ vec4 t=texture2D(uTex,gl_PointCoord); float a=t.a*vA*uAmount; gl_FragColor=vec4(vec3(1.0,0.6,0.3)*a,a);} `,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  world.dust = u;
}

function buildSteam(scene, world, rnd) {
  const vents = [];
  for (let k = 0; k < 14; k++) {
    const L = [-51, -17, 17, 51][(rnd() * 4) | 0];
    const s = (rnd() - 0.5) * 160;
    vents.push(rnd() < 0.5 ? [L + (rnd() - 0.5) * 5, s] : [s, L + (rnd() - 0.5) * 5]);
  }
  const per = 22;
  const N = vents.length * per;
  const pos = new Float32Array(N * 3), off = new Float32Array(N);
  vents.forEach(([x, z], v) => { for (let i = 0; i < per; i++) { pos.set([x, 0, z], (v * per + i) * 3); off[v * per + i] = Math.random(); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('off', new THREE.BufferAttribute(off, 1));
  const u = { uTime: { value: 0 }, uTex: { value: radialTexture('rgba(255,255,255,0.8)', 'rgba(255,255,255,0)') } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `attribute float off; uniform float uTime; varying float vA;
      void main(){
        float t = fract(off + uTime*0.12);
        vec3 p = position + vec3(sin(off*40.0+uTime)*t*1.5, t*9.0, cos(off*30.0)*t*1.5);
        vec4 mv = viewMatrix*vec4(p,1.0);
        gl_PointSize = (180.0 + t*500.0) / -mv.z;
        vA = (1.0-t)*smoothstep(0.0,0.1,t)*0.22;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vec3(0.75,0.8,0.9), t.a*vA);} `,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false;
  scene.add(p);
  world.updaters.push((t) => (u.uTime.value = t));
}

// A giant holographic jellyfish drifting over the city
function buildJelly(scene, world) {
  const grp = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(9, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ vec3 p=position; float pul=1.0+0.12*sin(uTime*1.3 - p.y*0.2); p.xz*=pul; p.y*=1.0-0.1*sin(uTime*1.3);
          vec4 w=modelMatrix*vec4(p,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); vY=position.y;
          gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.0); float s=0.5+0.5*sin(vY*3.0-uTime*3.0);
          vec3 c=mix(vec3(0.2,0.9,1.0),vec3(1.0,0.3,0.8),s); float a=0.05+f*0.7; gl_FragColor=vec4(c*a,a);} `,
    }));
  grp.add(bell);
  const tent = [];
  const tg = new THREE.BufferGeometry();
  const T = 26, S = 30;
  const tp = new Float32Array(T * S * 2 * 3);
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const tl = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.2, 1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  tl.frustumCulled = false;
  grp.add(tl);
  grp.position.set(-10, 62, 20);
  scene.add(grp);
  world.updaters.push((t) => {
    bell.material.uniforms.uTime.value = t;
    grp.position.x = Math.sin(t * 0.03) * 48;
    grp.position.z = Math.cos(t * 0.021) * 40;
    grp.position.y = 62 + Math.sin(t * 0.4) * 3;
    let o = 0;
    for (let i = 0; i < T; i++) {
      const a = (i / T) * Math.PI * 2, r = 6 + (i % 3);
      let px = Math.cos(a) * r, pz = Math.sin(a) * r, py = 0;
      for (let s = 0; s < S; s++) {
        const nx = Math.cos(a) * r * (1 - s / S * 0.5) + Math.sin(t * 1.2 + s * 0.3 + i) * s * 0.08;
        const nz = Math.sin(a) * r * (1 - s / S * 0.5) + Math.cos(t * 1.1 + s * 0.3 + i) * s * 0.08;
        const ny = -s * 1.1;
        tp[o++] = px; tp[o++] = py; tp[o++] = pz; tp[o++] = nx; tp[o++] = ny; tp[o++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    tg.attributes.position.needsUpdate = true;
  });
}

function buildSky(scene, world) {
  const u = { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: u, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vP; void main(){ float h=clamp(normalize(vP).y*2.2,0.0,1.0); gl_FragColor=vec4(mix(uBottom,uTop,h),1.0);} `,
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  world.sky = { mesh: sky, u };
}
