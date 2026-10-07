import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { QUALITY, mulberry32 } from './util.js';

// Things above street level: rooftop machinery, sweeping searchlights, heavy transports, an ad blimp.
export function buildSkyLife(scene, world, roofs) {
  const rnd = mulberry32(911);
  buildRoofProps(scene, roofs, rnd);
  buildSearchlights(scene, world, rnd);
  buildTransports(scene, world, rnd);
  buildBlimp(scene, world);
}

function buildRoofProps(scene, roofs, rnd) {
  const ac = [], tanks = [], blinks = [];
  for (const r of roofs) {
    if (r.w < 5 || r.d < 5 || r.y < 10) continue;
    const n = 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const x = r.x + (rnd() - 0.5) * (r.w - 3), z = r.z + (rnd() - 0.5) * (r.d - 3);
      ac.push([x, r.y, z, rnd() * Math.PI, 0.8 + rnd() * 0.8]);
    }
    if (rnd() < 0.35) tanks.push([r.x + (rnd() - 0.5) * (r.w - 4), r.y, r.z + (rnd() - 0.5) * (r.d - 4), 0.8 + rnd() * 0.6]);
    if (rnd() < 0.25) blinks.push([r.x + r.w / 2 - 0.3, r.y + 0.3, r.z + r.d / 2 - 0.3]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  // AC unit: box with a fan grille on top
  const g = new GeoBuilder();
  g.box(0, 0, 0, 2.2, 1.1, 1.4, { color: [0.38, 0.39, 0.42] });
  g.box(-0.5, 1.1, 0, 0.9, 0.06, 0.9, { color: [0.08, 0.08, 0.09] });
  g.box(0.55, 1.1, 0, 0.9, 0.06, 0.9, { color: [0.08, 0.08, 0.09] });
  const acm = new THREE.InstancedMesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.6 }), Math.max(1, ac.length));
  ac.forEach(([x, y, z, r, sc], i) => { q.setFromEuler(e.set(0, r, 0)); m4.compose(v.set(x, y, z), q, s.set(sc, sc, sc)); acm.setMatrixAt(i, m4); });
  // water tanks on legs
  const tg = new THREE.CylinderGeometry(1.2, 1.2, 2.4, 14); tg.translate(0, 2.4, 0);
  const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 0.85, metalness: 0.2 }), Math.max(1, tanks.length));
  tanks.forEach(([x, y, z, sc], i) => { m4.compose(v.set(x, y, z), q.identity(), s.set(sc, sc, sc)); tm.setMatrixAt(i, m4); });
  scene.add(acm, tm);
  void blinks;
}

function beamShader(len, color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLen: { value: len } },
    vertexShader: `uniform float uLen; varying float vD; varying vec3 vN; varying vec3 vV;
      void main(){ vD = clamp(position.y / uLen, 0.0, 1.0); vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; varying float vD; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), vV)), 2.0); float a = (1.0 - vD) * 0.155 * edge; gl_FragColor = vec4(uColor * a, a); }`,
  });
}

function buildSearchlights(scene, world, rnd) {
  const spots = [[-110, 110], [112, 108], [118, -60], [-115, -40]].slice(0, QUALITY.low ? 2 : 4);
  const L = 220;
  const geo = new THREE.CylinderGeometry(9, 0.8, L, 16, 1, true); geo.translate(0, L / 2, 0);
  const beams = spots.map(([x, z], i) => {
    const m = new THREE.Mesh(geo, beamShader(L, i % 2 ? '#bcd8ff' : '#ffe2b8'));
    m.position.set(x, 60 + rnd() * 30, z);
    m.userData.ph = rnd() * 10; m.userData.heavy = true;
    scene.add(m);
    return m;
  });
  world.updaters.push((t) => beams.forEach((b) => {
    const p = b.userData.ph;
    b.rotation.set(0.35 + 0.2 * Math.sin(t * 0.13 + p), t * 0.07 + p, 0.25 * Math.sin(t * 0.11 + p * 2), 'YXZ');
  }));
}

function buildTransports(scene, world, rnd) {
  const g = new GeoBuilder(), l = new GeoBuilder();
  g.box(0, 0, 0, 12, 5, 34, { color: [0.13, 0.13, 0.15] });
  g.box(0, 5, -4, 8, 3, 16, { color: [0.16, 0.16, 0.18] });
  g.box(-8, 1, 6, 4, 2.5, 8, { color: [0.1, 0.1, 0.12] });
  g.box(8, 1, 6, 4, 2.5, 8, { color: [0.1, 0.1, 0.12] });
  for (let k = -3; k <= 3; k++) l.box(0, -0.05, k * 4.5, 10, 0.1, 0.4, { color: [2.6, 1.2, 0.4] });
  l.box(-6.05, 2.5, 0, 0.1, 0.4, 30, { color: [0.4, 1.6, 2.6] });
  l.box(6.05, 2.5, 0, 0.1, 0.4, 30, { color: [0.4, 1.6, 2.6] });
  l.box(-8, 0.6, 10.1, 3, 1.4, 0.1, { color: [3, 2.6, 2] });
  l.box(8, 0.6, 10.1, 3, 1.4, 0.1, { color: [3, 2.6, 2] });
  const n = 3;
  const bm = new THREE.InstancedMesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.7 }), n);
  const lm = new THREE.InstancedMesh(l.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), n);
  scene.add(bm, lm);
  const ships = Array.from({ length: n }, (_, i) => ({ y: 95 + i * 14, z: -60 + i * 70, x: rnd() * 400 - 200, v: (i % 2 ? -1 : 1) * (5 + rnd() * 3) }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  world.updaters.push((t, dt) => {
    ships.forEach((s, i) => {
      s.x += s.v * dt; if (s.x > 260) s.x = -260; if (s.x < -260) s.x = 260;
      q.setFromEuler(e.set(0, s.v > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
      m4.compose(p.set(s.x, s.y + Math.sin(t * 0.3 + i) * 1.5, s.z), q, one);
      bm.setMatrixAt(i, m4); lm.setMatrixAt(i, m4);
    });
    bm.instanceMatrix.needsUpdate = lm.instanceMatrix.needsUpdate = true;
  });
}

function buildBlimp(scene, world) {
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.4, metalness: 0.6 }));
  hull.scale.set(9, 9, 30); grp.add(hull);
  const W = 512, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const msg = '  SIMONTOWN TRANSIT · NOW BOARDING ·  雨 · DREAM IN PARAMETERS · FIKA 24H · ';
  const draw = () => {
    g.fillStyle = '#050608'; g.fillRect(0, 0, W, H);
    g.font = 'bold 64px "Share Tech Mono", monospace'; g.fillStyle = '#ffb347'; g.shadowColor = '#ff7a1a'; g.shadowBlur = 18;
    g.fillText(msg, 0, 86);
    tex.needsUpdate = true;
  };
  draw();
  const screenM = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
  for (const sx of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(36, 5), screenM);
    sc.position.set(sx * 8.4, -1, 0); sc.rotation.y = sx * Math.PI / 2;
    grp.add(sc);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 6), hull.material); fin.position.set(0, 7, -24); grp.add(fin);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), toneMapped: false }));
  lamp.position.set(0, 11.2, -24); grp.add(lamp);
  scene.add(grp);
  world.updaters.push((t) => {
    const a = t * 0.025;
    grp.position.set(Math.cos(a) * 130, 78 + Math.sin(t * 0.2) * 2, Math.sin(a) * 110);
    grp.rotation.y = -a;
    tex.offset.x = (t * 0.04) % 1;
    lamp.visible = Math.sin(t * 3) > 0.3;
  });
}
