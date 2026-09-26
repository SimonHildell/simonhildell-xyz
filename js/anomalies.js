import * as THREE from 'three';
import { holoMaterial, glowLineMaterial } from './geo.js';
import { GRID, storage, mulberry32 } from './util.js';

const C = GRID.cellCenter;

// Links into the curated site. If a route changes on simonhildell.com, update it here.
const COM = 'https://www.simonhildell.com';
const P = (id) => `${COM}/#/project/${id}`;

export const ANOMALY_DATA = [
  {
    id: 'zephyr', cell: [4, 0], color: '#ff3df2', radius: 13,
    title: 'ZEPHYR', tag: 'Academic project · 2026 · Hässleholm',
    text: 'A breathing transport hub. An origami-rooted panel system that can expand in three dimensions, sculpted by a full week of projected passenger flow. Not to optimize the space. Just as a gesture.',
    credit: 'With Finn Heinecke & Maja Popovic', img: 'img/zephyr.webp', imgRemote: 'https://simonhildell.com/assets/zephyrfront2-9Ll4spYj.webp',
    link: P('zephyr'),
  },
  {
    id: 'nakagin', cell: [0, 0], color: '#ff2a55', radius: 12,
    title: 'NAKAGIN CAPSULE', tag: 'Academic project · 2025 · Rhino → Grasshopper → Unreal',
    text: 'The goal was to learn the Rhino, Grasshopper and Unreal Engine workflow. We went for the cyberpunky aesthetic and the narrative that some experiment went wrong.',
    credit: 'With Finn Heinecke & Mikolaj Szczerski', img: 'img/nakagin.webp', imgRemote: 'https://simonhildell.com/assets/growingfront-Bfpc402t.webp',
    link: P('nakagin-capsule'),
  },
  {
    id: 'rainhub', cell: [1, 3], color: '#4fd8ff', radius: 12,
    title: 'RAIN HUB', tag: 'Bachelor project · 2025 · Mölndal',
    text: 'A youth center that uses rain as a resource rather than an obstacle. The roof responds to how the rain falls on it, and hosts the activities that normally disappear for teens when it rains.',
    img: 'img/rainhub.webp', imgRemote: 'https://simonhildell.com/assets/project-3-DcDQa-aa.webp',
    link: P('rain-hub'),
  },
  {
    id: 'tratten', cell: [3, 3], color: '#8dff6a', radius: 12,
    title: 'CAMPUSTRATTEN', tag: 'Competition · winning entry',
    text: '“Vi ses vid Campustratten.” Three hexagonal timber pavilions, a sibling to the LTH fountain. Each funnel roof stands on a single leg: rain is collected through the green roof, filtered in the leg and used at a bike-washing station.',
    credit: 'Tapered GLT · welded steel connectors',
    link: COM, linkNote: 'No project page for this one yet, so the link takes you to simonhildell.com.',
  },
  {
    id: 'naturum', cell: [0, 2], color: '#ff5a8a', radius: 12,
    title: 'NATURUM', tag: 'Academic project · 2025 · Breanäs · 550 m²',
    text: 'A hyperlocal public building using pieces the forest industry normally discards: crooked trunks, straightened by design. It sits on the edge of experimental and feasible.',
    credit: 'With Theo Edfast', img: 'img/naturum.webp', imgRemote: 'https://simonhildell.com/assets/straighteningfront-BXVrdMM-.webp',
    link: P('naturum'),
  },
  {
    id: 'studios', cell: [4, 2], color: '#f4f4ff', radius: 12,
    title: 'ARTIST STUDIOS', tag: 'Academic project · 2024 · Neukölln, Berlin',
    text: 'Public and private spaces for digital artists. An organic structure runs through the building from bottom to top, reminding passers-by of the public garden on the roof.',
    img: 'img/studios.webp', imgRemote: 'https://simonhildell.com/assets/project-4-COizQxHR.webp',
    link: P('artist-studios'),
  },
  {
    id: 'audio', cell: [2, 2], color: '#d24dff', radius: 13, dy: 99,
    title: 'AUDIO INTERACTIVE', tag: 'Academic + hobby project · 2026 · Python, TouchDesigner',
    text: 'Geometry that uses sound as its input to generate visuals. Put a song on the jukebox and watch the cloud react.',
    credit: 'Built for “Programming for architects”', img: 'img/audio.webp', imgRemote: 'https://simonhildell.com/assets/sound2front-DCHmrcet.webp',
    link: P('audio-interactive'),
  },
  {
    id: 'printer', cell: [1, 1], color: '#ffb13d', radius: 9, y: 12,
    title: 'THE PRINTER', tag: 'Hobby: fabrication · Bambu Lab A1 · level 2',
    text: 'A 1:20 press-fit model of Campustratten, printed in PLA: 40 parts on 3 build plates, snapping together into a 248 × 215 × 141 mm pavilion.',
    link: COM, linkNote: 'No project page for this one yet, so the link takes you to simonhildell.com.',
  },
  {
    id: 'finch', cell: [3, 1], offset: [-8, -2], color: '#39ffb0', radius: 10, y: 6,
    title: 'FINCH 3D', tag: 'Day job · level 1',
    text: 'Partnerships and external communications at Finch 3D: webinars with partners, tutorials, and helping architectural tools talk to each other.',
    link: COM, linkNote: 'No project page for this one yet, so the link takes you to simonhildell.com.',
  },
];

export class Anomalies {
  constructor(scene, world, hooks) {
    this.scene = scene; this.world = world; this.hooks = hooks;
    this.found = new Set(storage.get('shx-found', []));
    this.items = [];
    this.musicLevel = 0;
    this.active = true;
    for (const d of ANOMALY_DATA) {
      const g = new THREE.Group();
      const [ox, oz] = d.offset || [0, 0];
      g.position.set(C(d.cell[0]) + ox, d.y ?? GRID.kerb, C(d.cell[1]) + oz);
      scene.add(g);
      const upd = BUILDERS[d.id](g, world, this);
      const ag = new THREE.Group(); ag.position.copy(g.position); scene.add(ag);
      const aura = makeAura(d, ag);
      this.items.push({ d, g, upd, aura, found: this.found.has(d.id) });
      if (this.found.has(d.id)) aura.setFound(true, true);
    }
  }

  get count() { return this.found.size; }

  // play again: everything becomes undiscovered
  reset() {
    this.found.clear();
    storage.set('shx-found', []);
    for (const it of this.items) { it.found = false; it.aura.setFound(false); it.cooldown = true; }
  }

  // short burst: every pillar flares at once (celebration)
  flareAll() { for (const it of this.items) it.aura.flare(); }

  update(t, dt, player) {
    for (const it of this.items) {
      const dx = player.pos.x - it.g.position.x, dz = player.pos.z - it.g.position.z;
      const dist = Math.hypot(dx, dz);
      const dy = Math.abs(player.pos.y - it.g.position.y);
      it.dist = dist;
      // update only when reasonably near (plus always update cheap aura)
      it.g.visible = dist < 118;
      if (it.g.visible) it.upd && it.upd(t, dt, dist);
      it.aura.update(t, dt);
      if (it.cooldown && dist > it.d.radius + 2) it.cooldown = false;
      if (!it.found && !it.cooldown && this.active && dist < it.d.radius && dy < (it.d.dy ?? 3.5)) {
        it.found = true;
        this.found.add(it.d.id);
        storage.set('shx-found', [...this.found]);
        it.aura.setFound(true);
        this.hooks.onFound(it.d, this.found.size);
      }
      if (this.hooks.cardOpen === it.d.id && dist > it.d.radius + 18) this.hooks.onLeave(it.d);
    }
  }
}

// ---------- aura: ground ring + light pillar
function makeAura(d, g) {
  const col = new THREE.Color(d.color);
  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: col }, uAmt: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){ float a = atan(vUv.y-0.5, vUv.x-0.5); float r = length(vUv-0.5)*2.0;
        float ring = smoothstep(0.93,0.96,r)*smoothstep(1.0,0.97,r);
        float dash = step(0.5, fract(a*8.0/6.2831 + uTime*0.15));
        float inner = smoothstep(0.55,0.6,r)*smoothstep(0.65,0.6,r)*step(0.7,fract(a*24.0/6.2831 - uTime*0.3));
        float pulse = smoothstep(0.02,0.0,abs(r - fract(uTime*0.35)))*0.6;
        float v = (ring*dash + inner*0.7 + pulse*(1.0-r)) * uAmt;
        gl_FragColor = vec4(uColor*v*1.6, v);
      }`,
  });
  const R = d.radius;
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(ring);
  const pillarMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: col }, uAmt: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){ float fade = (1.0 - vUv.y) * (1.0 - vUv.y);
        float bands = 0.6 + 0.4*sin(vUv.y*60.0 - uTime*4.0);
        float glitch = step(0.93, fract(sin(floor(uTime*8.0)*12.9898 + floor(vUv.y*20.0))*43758.5));
        float a = fade * bands * 0.22 * uAmt * (1.0 + glitch*1.5);
        gl_FragColor = vec4(uColor*a, a);
      }`,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 90, 16, 1, true), pillarMat);
  pillar.position.y = 45;
  g.add(pillar);
  // floating glyph marker
  const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), wireframe: true, toneMapped: false }));
  glyph.position.y = 24;
  g.add(glyph);
  let amt = 1, target = 1, flare = 0;
  return {
    setFound(f, instant) { target = f ? 0.12 : 1; if (instant) amt = target; },
    flare() { flare = 3.5; },
    update(t, dt) {
      flare = Math.max(0, flare - dt);
      amt += (target - amt) * Math.min(1, dt * 1.5);
      const f = flare > 0 ? (0.6 + 0.4 * Math.sin(t * 40)) * Math.min(1, flare) * 3 : 0;
      ringMat.uniforms.uTime.value = t; pillarMat.uniforms.uTime.value = t;
      ringMat.uniforms.uAmt.value = 0.25 + amt * 0.75 + f; pillarMat.uniforms.uAmt.value = amt + f;
      glyph.rotation.y = t * 1.3; glyph.position.y = 24 + Math.sin(t * 1.7) * 0.6;
      glyph.visible = amt > 0.2 || f > 0;
    },
  };
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });

// ---------- builders
const BUILDERS = {
  zephyr(g) {
    const NU = 52, NV = 22, L = 32;
    const N = (NU + 1) * NV;
    const pos = new Float32Array(N * 3);
    const base = [];
    const tris = [], edges = [];
    const id = (i, j) => i * NV + ((j % NV) + NV) % NV;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), dd = id(i + 1, j + 1);
      if (i % 2 === 0) { tris.push(a, c, dd, a, dd, b); edges.push(a, c, c, dd, dd, a, a, b); }
      else { tris.push(a, c, b, b, c, dd); edges.push(a, c, c, b, b, a, c, dd); }
    }
    for (let j = 0; j < NV; j++) edges.push(id(NU, j), id(NU, j + 1));
    const attr = new THREE.BufferAttribute(pos, 3);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', attr); mg.setIndex(tris); mg.computeVertexNormals();
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', attr); lg.setIndex(edges);
    const prof = (u) => {
      const e = Math.min(1, Math.min(u, 1 - u) * 9);
      return (2.0 + 3.4 * Math.exp(-(((u - 0.7) / 0.19) ** 2)) + 2.4 * Math.exp(-(((u - 0.27) / 0.15) ** 2))) * (0.55 + 0.45 * e);
    };
    for (let i = 0; i <= NU; i++) base.push(prof(i / NU));
    const mat = holoMaterial('#ff3df2', { opacity: 0.02, rim: 0.45 });
    const mesh = new THREE.Mesh(mg, mat);
    const lines = new THREE.LineSegments(lg, glowLineMaterial('#ff5cf5', 0.45));
    mesh.frustumCulled = lines.frustumCulled = false;
    const tube = new THREE.Group(); tube.add(mesh, lines); tube.position.y = 3.4;
    g.add(tube);
    // rails running through
    const railM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 2.2), toneMapped: false });
    for (const z of [-1.8, -0.6, 0.6, 1.8]) { const r = new THREE.Mesh(new THREE.BoxGeometry(70, 0.06, 0.12), railM); r.position.set(0, 0.04, z); g.add(r); }
    const pulses = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 3), toneMapped: false }), 8);
    g.add(pulses);
    // district context blocks under it (like the site model)
    const blk = std(0x2a1830, { emissive: 0x3a0a40, emissiveIntensity: 0.6 });
    [[-9, 8, 4, 2, 3], [-3, 8.5, 3, 3, 2.5], [6, 8.5, 4, 2.5, 3], [9, -8.5, 4, 4, 3], [-8, -8.5, 4, 3, 3]].forEach(([x, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blk); m.position.set(x, h / 2, z); g.add(m);
    });
    const light = new THREE.PointLight(0xff3df2, 18, 30, 1.5); light.position.set(0, 5, 0); g.add(light);
    const m4 = new THREE.Matrix4();
    return (t) => {
      mat.uniforms.uTime.value = t;
      const breath = Math.sin(t * 0.9);
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const x = (u - 0.5) * L;
        const r0 = base[i] * (1 + 0.1 * breath + 0.05 * Math.sin(u * 12 - t * 1.6));
        for (let j = 0; j < NV; j++) {
          const a = ((j + (i % 2) * 0.5) / NV) * Math.PI * 2;
          const fold = ((i + j) % 2 ? 1 : -1) * 0.22 * (0.5 + 0.5 * breath);
          const r = r0 + fold;
          const k = (i * NV + j) * 3;
          pos[k] = x; pos[k + 1] = Math.cos(a) * r; pos[k + 2] = Math.sin(a) * r;
        }
      }
      attr.needsUpdate = true;
      mg.computeVertexNormals();
      for (let p = 0; p < 8; p++) { m4.makeTranslation(((t * 14 + p * 9) % 72) - 36, 0.08, [-1.8, -0.6, 0.6, 1.8][p % 4]); pulses.setMatrixAt(p, m4); }
      pulses.instanceMatrix.needsUpdate = true;
    };
  },

  nakagin(g, world) {
    const concrete = std(0x6d6a66, { roughness: 0.9 });
    const cores = [[-2.4, 0, 3.2, 3.2, 40], [2.4, 0.6, 3.2, 3.2, 33]];
    for (const [x, z, w, d, h] of cores) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete); m.position.set(x, h / 2, z); g.add(m);
    }
    const br = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 1.6), concrete); br.position.set(0, 15, 0.3); g.add(br);
    world.colliders.push({ x0: g.position.x - 4.2, x1: g.position.x + 4.2, z0: g.position.z - 1.8, z1: g.position.z + 2.4 });
    // capsules
    const rnd = mulberry32(1972);
    const caps = [];
    for (const [cx, cz, , , h] of cores) {
      for (let y = 4; y < h - 3; y += 2.55) {
        const faces = [0, 1, 2, 3].filter(() => rnd() < 0.62);
        for (const f of faces) {
          const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f] + (rnd() - 0.5) * 0.1;
          const dx = Math.sin(ang), dz = Math.cos(ang);
          caps.push({ p: new THREE.Vector3(cx + dx * 3.6 + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.3, cz + dz * 3.6 + (rnd() - 0.5) * 0.6), ry: ang, glitch: rnd() < 0.22, ph: rnd() * 10, orbit: false });
        }
      }
    }
    for (let k = 0; k < 7; k++) caps.push({ p: new THREE.Vector3(), ry: 0, glitch: true, ph: k, orbit: true, r: 9 + rnd() * 6, y: 12 + rnd() * 20, sp: 0.08 + rnd() * 0.08 });
    const capG = new THREE.BoxGeometry(2.4, 2.3, 4.0);
    const winG = new THREE.CircleGeometry(0.62, 24); winG.translate(0, 0.05, 2.01);
    const rimG = new THREE.RingGeometry(0.62, 0.8, 24); rimG.translate(0, 0.05, 2.012);
    const capMesh = new THREE.InstancedMesh(capG, std(0xd8d6d0, { roughness: 0.5, metalness: 0.2 }), caps.length);
    const winMesh = new THREE.InstancedMesh(winG, new THREE.MeshBasicMaterial({ toneMapped: false }), caps.length);
    const rimMesh = new THREE.InstancedMesh(rimG, std(0x222226), caps.length);
    g.add(capMesh, winMesh, rimMesh);
    const holo = new THREE.InstancedMesh(capG, holoMaterial('#ff2a55', { opacity: 0.08, rim: 1.2 }), caps.length);
    g.add(holo);
    const cWarm = new THREE.Color(2.4, 1.6, 0.9), cRed = new THREE.Color(3, 0.2, 0.5), cOff = new THREE.Color(0.05, 0.05, 0.08);
    caps.forEach((c, i) => winMesh.setColorAt(i, rnd() < 0.6 ? cWarm : cOff));
    // growing red cracks on the cores (the experiment going wrong)
    const crackPts = [];
    for (let k = 0; k < 6; k++) {
      const core = cores[k % 2];
      const face = k % 4;
      let x = (rnd() - 0.5) * 2.4, y = 0.3;
      for (let s = 0; s < 60; s++) {
        const nx = x + (rnd() - 0.5) * 0.35, ny = y + 0.45 + rnd() * 0.3;
        const P = (xx, yy) => {
          const off = 1.62;
          if (face === 0) return [core[0] + xx, yy, core[1] + off];
          if (face === 1) return [core[0] + off, yy, core[1] + xx];
          if (face === 2) return [core[0] + xx, yy, core[1] - off];
          return [core[0] - off, yy, core[1] + xx];
        };
        crackPts.push(...P(x, y), ...P(nx, ny));
        x = Math.max(-1.5, Math.min(1.5, nx)); y = ny;
      }
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(crackPts, 3));
    const cracks = new THREE.LineSegments(cg, glowLineMaterial('#ff1133', 1));
    g.add(cracks);
    const light = new THREE.PointLight(0xff2a55, 15, 28, 1.5); light.position.set(0, 6, 6); g.add(light);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const total = crackPts.length / 6;
    return (t) => {
      holo.material.uniforms.uTime.value = t;
      caps.forEach((c, i) => {
        let ry = c.ry;
        if (c.orbit) {
          const a = t * c.sp + c.ph;
          p.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.6 + c.ph) * 1.5, Math.sin(a) * c.r);
          e.set(Math.sin(t * 0.3 + c.ph) * 0.6, a * 2, Math.cos(t * 0.4 + c.ph) * 0.4);
        } else {
          p.copy(c.p);
          e.set(0, ry, 0);
          if (c.glitch && Math.sin(t * 3 + c.ph * 7) > 0.8) {
            const j = Math.floor(t * 20) % 3;
            p.x += (j - 1) * 0.5; p.y += Math.sin(t * 50 + c.ph) * 0.2;
          }
        }
        q.setFromEuler(e);
        m4.compose(p, q, s1);
        capMesh.setMatrixAt(i, m4); winMesh.setMatrixAt(i, m4); rimMesh.setMatrixAt(i, m4);
        const hs = c.glitch ? 1.04 + 0.04 * Math.sin(t * 9 + c.ph) : 0.0001;
        m4.compose(p, q, new THREE.Vector3(hs, hs, hs)); holo.setMatrixAt(i, m4);
        if (c.glitch) winMesh.setColorAt(i, Math.sin(t * 13 + c.ph * 3) > 0 ? cRed : cOff);
      });
      capMesh.instanceMatrix.needsUpdate = winMesh.instanceMatrix.needsUpdate = rimMesh.instanceMatrix.needsUpdate = holo.instanceMatrix.needsUpdate = true;
      winMesh.instanceColor.needsUpdate = true;
      cg.setDrawRange(0, Math.floor(((t * 0.08) % 1) * total) * 2 + 2);
    };
  },

  rainhub(g, world) {
    const W = 21, D = 16, NX = 42, NZ = 32;
    const f = (x, z) => 5.6 + 1.7 * Math.sin(x * 0.23 + 0.6) * Math.cos(z * 0.26) + 0.07 * x;
    const pos = [], bary = [], nrm = [];
    const P = (i, j) => { const x = (i / NX - 0.5) * W, z = (j / NZ - 0.5) * D; return [x, f(x, z), z]; };
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      const tri = (p0, p1, p2) => {
        pos.push(...p0, ...p1, ...p2); bary.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
        const v1 = new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)), v2 = new THREE.Vector3(...p2).sub(new THREE.Vector3(...p0));
        const n = v1.cross(v2).normalize(); if (n.y < 0) n.negate();
        for (let k = 0; k < 3; k++) nrm.push(n.x, n.y, n.z);
      };
      if ((i + j) % 2) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('bary', new THREE.Float32BufferAttribute(bary, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const u = { uTime: { value: 0 }, uCenter: { value: g.position.clone() } };
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: u,
      vertexShader: `attribute vec3 bary; varying vec3 vB; varying vec3 vN; varying vec3 vW;
        void main(){ vB=bary; vN=normal; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    });
    mat.fragmentShader = `uniform float uTime; varying vec3 vB; varying vec3 vN; varying vec3 vW; uniform vec3 uCenter;
      void main(){
        float lx = vW.x - uCenter.x;
        float e = min(min(vB.x,vB.y),vB.z);
        float open = smoothstep(-3.0, 2.0, lx);
        if (open > 0.5 && e > 0.09) discard;
        float l = 0.35 + 0.65*max(dot(normalize(vN), normalize(vec3(0.3,1.0,0.2))),0.0);
        vec3 base = vec3(0.55,0.57,0.6)*l;
        float edgeGlow = smoothstep(0.09,0.0,e) * open;
        float wave = 0.5+0.5*sin(vW.x*0.6 + vW.z*0.4 - uTime*2.0);
        vec3 c = base + vec3(0.25,0.8,1.2)*edgeGlow*(0.6+wave);
        gl_FragColor = vec4(c,1.0);
      }`;
    const roof = new THREE.Mesh(geo, mat);
    g.add(roof);
    // columns
    const colM = std(0x9aa0a8, { metalness: 0.6, roughness: 0.3 });
    for (const [x, z] of [[-7, -4.5], [-7, 4.5], [0, -5.5], [0, 5.5], [7, -4.5], [7, 4.5]]) {
      const h = f(x, z);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, h, 10), colM);
      c.position.set(x, h / 2, z); g.add(c);
      world.colliderCircles.push({ x: g.position.x + x, z: g.position.z + z, r: 0.3 });
    }
    // glowing pool at low point + local heavy rain that stops on the roof
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x0a6a8a, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.8 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(-9.5, 0.04, 0); g.add(pool);
    const N = 2200;
    const sp = new Float32Array(N * 2 * 3), sd = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) { const s = [Math.random(), Math.random(), Math.random(), Math.random()]; for (let k = 0; k < 2; k++) { sp.set([0, k, 0], (i * 2 + k) * 3); sd.set(s, (i * 2 + k) * 4); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); rg.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
    const ru = { uTime: { value: 0 } };
    const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: ru, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 seed; uniform float uTime; varying float vA;
        float f(float x,float z){ return 5.6 + 1.7*sin(x*0.23+0.6)*cos(z*0.26) + 0.07*x; }
        void main(){
          float x = (seed.x-0.5)*23.0, z=(seed.z-0.5)*18.0;
          float floorY = (abs(x)<10.5 && abs(z)<8.0) ? f(x,z) : 0.0;
          float H = 30.0;
          float y = floorY + mod(seed.y*H - uTime*(24.0+seed.w*8.0), H);
          vec3 p = vec3(x, y + position.y*1.1, z);
          vA = 0.25 + 0.6*position.y;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.6,0.85,1.0)*vA*0.6, vA*0.6); }`,
    }));
    rain.frustumCulled = false; g.add(rain);
    // splash sparkles on the roof
    const SN = 500; const spos = new Float32Array(SN * 3), sph = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { const x = (Math.random() - 0.5) * W, z = (Math.random() - 0.5) * D; spos.set([x, f(x, z) + 0.05, z], i * 3); sph[i] = Math.random(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('ph', new THREE.BufferAttribute(sph, 1));
    const splash = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: ru, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float ph; uniform float uTime; varying float vA; void main(){ float t=fract(ph*7.0+uTime*1.7); vA=(1.0-t)*step(t,0.35); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=(6.0+t*30.0)/-mv.z*6.0; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.3,d)*smoothstep(0.1,0.3,d)*vA; gl_FragColor=vec4(vec3(0.7,0.95,1.0)*a,a);} `,
    }));
    splash.frustumCulled = false; g.add(splash);
    const light = new THREE.PointLight(0x4fd8ff, 13, 26, 1.5); light.position.set(0, 3, 0); g.add(light);
    return (t) => { u.uTime.value = t; ru.uTime.value = t; };
  },

  tratten(g, world) {
    const upd = [];
    const spots = [0, 1, 2].map((k) => { const a = k * Math.PI * 2 / 3 + 0.3; return [Math.cos(a) * 6.2, Math.sin(a) * 6.2]; });
    for (const [x, z] of spots) {
      const p = buildPavilion(1);
      p.group.position.set(x, 0, z);
      p.group.rotation.y = Math.random();
      g.add(p.group);
      upd.push(p.update);
      world.colliderCircles.push({ x: g.position.x + x, z: g.position.z + z, r: 0.6 });
    }
    const light = new THREE.PointLight(0xffc27a, 12, 22, 1.4); light.position.set(0, 2.2, 0); g.add(light);
    return (t) => upd.forEach((f) => f(t));
  },

  naturum(g, world) {
    const u = { uTime: { value: 0 }, uStraight: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide,
      vertexShader: `uniform float uTime; uniform float uStraight; attribute float seed; varying vec2 vUv; varying vec3 vN; varying float vY;
        void main(){ vUv=uv; vec3 p=position; float y=p.y + 7.0; vY=y;
          float amp = mix(1.0, 0.08, uStraight) * smoothstep(1.2, 4.0, y);
          vec2 off = vec2(sin(y*0.45+seed*3.0)+0.5*sin(y*1.1+seed), cos(y*0.37+seed*5.0)+0.4*sin(y*0.9+seed*2.0))*0.55*amp;
          p.xz += off;
          vN = normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vN; varying float vY;
        void main(){
          float gx = smoothstep(0.42,0.48,abs(fract(vUv.x*16.0)-0.5));
          float gy = smoothstep(0.42,0.48,abs(fract(vY*2.2)-0.5));
          float grid = max(gx,gy);
          vec3 wood = vec3(0.30,0.18,0.12)*(0.5+0.5*abs(vN.x));
          vec3 c = mix(wood, vec3(1.2,0.15,0.3), grid*0.8);
          float base = step(vY,1.6);
          c = mix(c, vec3(0.9,0.12,0.7)*(0.8+0.2*sin(uTime*3.0)), base*0.85);
          gl_FragColor=vec4(c,1.0);
        }`,
    });
    const spots = [[-5, -3, 12], [-1, 2, 14], [3, -4, 10], [6, 3, 13], [-6, 5, 9], [1, -8, 11], [8, -3, 8]];
    const ringM = glowLineMaterial('#ff5a8a', 0.8);
    spots.forEach(([x, z, h], i) => {
      const geo = new THREE.CylinderGeometry(0.42, 0.55, h, 14, Math.ceil(h * 3), true);
      geo.translate(0, h / 2 - 7, 0);
      geo.setAttribute('seed', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(i * 1.37), 1));
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 7, z); m.frustumCulled = false; g.add(m);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => new THREE.Vector3(Math.cos(k / 48 * 6.283) * 2.2, 0.05, Math.sin(k / 48 * 6.283) * 2.2))), ringM);
      ring.position.set(x, 0, z); g.add(ring);
      // gizmo axes
      const ax = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(1.6, 0.05, 0), new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 2.2, 0), new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.05, 1.6)]), glowLineMaterial('#ffffff', 0.5));
      ax.position.set(x - 1.6, 0, z + 1.2); g.add(ax);
      world.colliderCircles.push({ x: g.position.x + x, z: g.position.z + z, r: 0.7 });
    });
    const light = new THREE.PointLight(0xff5a8a, 13, 25, 1.5); light.position.set(0, 4, 0); g.add(light);
    return (t) => { u.uTime.value = t; u.uStraight.value = 0.5 + 0.5 * Math.sin(t * 0.35); };
  },

  studios(g, world) {
    const white = std(0xe8e8ec, { roughness: 0.4, emissive: 0x202028 });
    const slabs = [[0, 3.6, 0, 12, 9], [0.6, 7.2, -0.4, 12.5, 9], [-0.4, 10.8, 0.3, 12, 9.4], [0.2, 14.4, 0, 12.8, 9]];
    slabs.forEach(([x, y, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), white); m.position.set(x, y, z); g.add(m); });
    for (const x of [-2.6, 2.6]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 7), white); m.position.set(x, 1.8, 0); g.add(m);
      world.colliders.push({ x0: g.position.x + x - 0.6, x1: g.position.x + x + 0.6, z0: g.position.z - 3.5, z1: g.position.z + 3.5, h: 3.6, noCam: true });
    }
    // gabled roofs with grid (wireframe) on top slab
    const gable = (w, h, d) => {
      const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h * 0.45); s.lineTo(0, h); s.lineTo(-w / 2, h * 0.45); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2); return geo;
    };
    const g1 = gable(5, 3.6, 7), g2 = gable(4.6, 4.2, 6);
    const r1 = new THREE.Mesh(g1, white); r1.position.set(-3, 14.6, 0); g.add(r1);
    const r2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: 0x9999aa, wireframe: true })); r2.position.set(2.8, 14.6, 0.5); r2.rotation.y = 0.2; g.add(r2);
    // roof garden
    const plants = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.5), toneMapped: false }), 40);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) { m4.makeTranslation((Math.random() - 0.5) * 11, 14.8, (Math.random() - 0.5) * 8); plants.setMatrixAt(i, m4); }
    g.add(plants);
    // organic lattice through all levels
    const NV = 22, NY = 26, H = 18;
    const lp = [];
    const pt = (j, i, t) => {
      const y = (i / NY) * H;
      const r = 1.7 + 0.8 * Math.sin(y * 0.33 + 0.4) + 0.25 * Math.sin(y * 0.9 + t);
      const a = (j / NV) * Math.PI * 2 + y * 0.12 + Math.sin(y * 0.3 + t * 0.5) * 0.3;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    const lg = new THREE.BufferGeometry();
    const cnt = (NV * NY * 2) * 2 * 3;
    const lpos = new Float32Array(cnt);
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const lat = new THREE.LineSegments(lg, glowLineMaterial('#dfe8ff', 0.8));
    lat.frustumCulled = false; g.add(lat);
    world.colliderCircles.push({ x: g.position.x, z: g.position.z, r: 2.2 });
    const light = new THREE.PointLight(0xdde6ff, 12, 24, 1.4); light.position.set(0, 2.5, 5); g.add(light);
    return (t) => {
      let o = 0;
      for (let i = 0; i < NY; i++) for (let j = 0; j < NV; j++) {
        const a = pt(j, i, t), b = pt(j, i + 1, t), c = pt(j + 1, i, t);
        lpos.set(a, o); lpos.set(b, o + 3); lpos.set(a, o + 6); lpos.set(c, o + 9); o += 12;
      }
      lg.attributes.position.needsUpdate = true;
    };
  },

  audio(g, world, mgr) {
    const CURVES = 9, PER = 320, N = CURVES * PER;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const params = Array.from({ length: CURVES }, (_, k) => ({ a: 1 + (k % 4), b: 2 + ((k * 3) % 5), c: 1 + ((k * 7) % 3), p: k * 1.3, s: 0.15 + (k % 3) * 0.05 }));
    const cA = new THREE.Color('#ff4df0'), cB = new THREE.Color('#7a2cff');
    for (let i = 0; i < N; i++) { const c = cA.clone().lerp(cB, Math.random()).multiplyScalar(1.8); col.set([c.r, c.g, c.b], i * 3); }
    const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.y = 11; pts.frustumCulled = false;
    g.add(pts);
    // plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.5, 6), std(0x15151a, { metalness: 0.8, roughness: 0.3 }));
    plinth.position.y = 0.25; g.add(plinth);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.8, 10.5, 16, 1, true), holoMaterial('#d24dff', { opacity: 0.03, rim: 0.4 }));
    beam.position.y = 5.5; g.add(beam);
    world.colliderCircles.push({ x: g.position.x, z: g.position.z, r: 2.7 });
    let lvl = 0;
    return (t, dt) => {
      beam.material.uniforms.uTime.value = t;
      const target = mgr.musicLevel;
      lvl += (target - lvl) * Math.min(1, dt * 10);
      const amp = 3.2 + lvl * 2.6;
      let o = 0;
      for (let k = 0; k < CURVES; k++) {
        const P = params[k];
        for (let i = 0; i < PER; i++) {
          const s = (i / PER) * Math.PI * 2;
          const w = t * P.s;
          const jit = lvl * 0.35 * Math.sin(s * 23 + t * 9 + k);
          pos[o++] = Math.sin(P.a * s + P.p + w) * amp * (0.8 + 0.2 * Math.cos(P.c * s)) + jit;
          pos[o++] = Math.sin(P.b * s + P.p * 2 + w * 1.3) * amp * 0.75 + jit;
          pos[o++] = Math.cos(P.c * s + P.p + w * 0.7) * amp * (0.8 + 0.2 * Math.sin(P.a * s)) + jit;
        }
      }
      geo.attributes.position.needsUpdate = true;
      pts.rotation.y = t * 0.1;
      mat.size = 0.14 + lvl * 0.08;
    };
  },

  printer(g, world) {
    const S = 3.2; // scale factor (giant printer)
    const dark = std(0x1d1e22, { metalness: 0.6, roughness: 0.35 });
    const grey = std(0x8c8f96, { metalness: 0.7, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6 * S, 0.35 * S, 1.4 * S), dark); base.position.y = 0.175 * S; g.add(base);
    // Z uprights + top bar (gantry)
    for (const x of [-0.72, 0.72]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 1.45 * S, 0.14 * S), grey); up.position.set(x * S, (0.35 + 0.72) * S, -0.35 * S); g.add(up);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.54 * S, 0.1 * S, 0.14 * S), grey); top.position.set(0, 1.83 * S, -0.35 * S); g.add(top);
    const xRail = new THREE.Mesh(new THREE.BoxGeometry(1.44 * S, 0.07 * S, 0.1 * S), dark); g.add(xRail);
    const head = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.22 * S, 0.26 * S, 0.2 * S), std(0xe8e8e8)); head.add(hb);
    const noz = new THREE.Mesh(new THREE.ConeGeometry(0.03 * S, 0.08 * S, 8), std(0xd4a24a, { metalness: 0.9 })); noz.rotation.x = Math.PI; noz.position.y = -0.17 * S; head.add(noz);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12 * S, 0.02 * S, 0.01 * S), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 1.2), toneMapped: false })); hl.position.set(0, 0.05 * S, 0.101 * S); head.add(hl);
    g.add(head);
    // bed (slinger)
    const bed = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1 * S, 0.03 * S, 1.1 * S), std(0x2b2b30, { metalness: 0.5, roughness: 0.25, emissive: 0x111118 }));
    bed.add(plate);
    const grid = new THREE.GridHelper(1.08 * S, 12, 0xffb13d, 0x553311); grid.position.y = 0.016 * S; grid.material.transparent = true; grid.material.opacity = 0.5; bed.add(grid);
    bed.position.y = 0.37 * S;
    g.add(bed);
    // printed model: a mini Campustratten with a rising clip plane
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const pav = buildPavilion(0.24, { clip: [clip], pla: true });
    pav.group.position.y = 0.016 * S;
    bed.add(pav.group);
    // spool on the side
    const spool = new THREE.Group();
    const sp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * S, 0.28 * S, 0.02 * S, 32), dark); sp1.rotation.z = Math.PI / 2;
    const sp2 = sp1.clone(); sp1.position.x = -0.07 * S; sp2.position.x = 0.07 * S;
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * S, 0.24 * S, 0.13 * S, 32), std(0xf2efe6, { roughness: 0.5 })); fil.rotation.z = Math.PI / 2;
    spool.add(sp1, sp2, fil); spool.position.set(0.95 * S, 1.6 * S, -0.35 * S); g.add(spool);
    const holo = new THREE.Mesh(new THREE.BoxGeometry(1.9 * S, 2.1 * S, 1.8 * S), holoMaterial('#ffb13d', { opacity: 0.015, rim: 0.35 }));
    holo.position.y = 1.02 * S; g.add(holo);
    world.colliders.push({ x0: g.position.x - 1.0 * S, x1: g.position.x + 1.1 * S, z0: g.position.z - 1.0 * S, z1: g.position.z + 1.0 * S, y0: g.position.y, h: 6, noCam: true });
    const light = new THREE.PointLight(0xffb13d, 10, 18, 1.4); light.position.set(0, 3.2 * S, 2.5 * S); g.add(light);
    const PH = (3.8 + 0.3) * 0.24; // printed height (m)
    const tmp = new THREE.Vector3();
    return (t) => {
      holo.material.uniforms.uTime.value = t;
      const cyc = (t % 48) / 48;
      const prog = Math.min(1, cyc / 0.9);
      const lh = prog * PH;
      const by = Math.sin(t * 2.3) * 0.28 * S;
      bed.position.z = by;
      const bedTop = bed.position.y + 0.016 * S;
      const zh = bedTop + lh;
      head.position.set(Math.sin(t * 3.1) * 0.35 * S, zh + 0.19 * S, 0);
      xRail.position.set(0, zh + 0.19 * S, -0.3 * S);
      // plane in world coords
      g.localToWorld(tmp.set(0, zh, 0));
      clip.constant = tmp.y;
      spool.rotation.x = -t * 0.4;
    };
  },

  finch(g, world) {
    const W = 1024, H = 640;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    screen.position.set(0, 7.2, -2); g.add(screen);
    const frame = std(0x16171b, { metalness: 0.7, roughness: 0.4 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(11.6, 7.5, 0.4), frame); back.position.set(0, 7.2, -2.25); g.add(back);
    for (const x of [-4.5, 4.5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.5, 0.5), frame); leg.position.set(x, 1.75, -2.25); g.add(leg); world.colliderCircles.push({ x: g.position.x + x, z: g.position.z - 2.25, r: 0.4, y0: g.position.y, h: 4 }); }
    // kiosk
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.8), frame); kiosk.position.set(0, 0.55, 2.5); kiosk.rotation.x = 0; g.add(kiosk);
    const kscr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); kscr.position.set(0, 1.13, 2.45); kscr.rotation.x = -Math.PI / 2 + 0.5; g.add(kscr);
    world.colliders.push({ x0: g.position.x - 0.8, x1: g.position.x + 0.8, z0: g.position.z + 2.1, z1: g.position.z + 2.9, y0: g.position.y, h: 1.2, noCam: true });
    const light = new THREE.PointLight(0x39ffb0, 12, 22, 1.4); light.position.set(0, 4, 3); g.add(light);
    // generative plan animation
    let rooms = [], gen = 0, last = -1, typed = 0;
    const rnd = mulberry32(3);
    const newPlan = () => {
      rooms = [];
      const split = (x, y, w, h, d) => {
        if (d > 4 || (w * h < 22000 && rnd() < 0.6) || w < 90 || h < 90) { rooms.push({ x, y, w, h, t: rooms.length }); return; }
        if (w > h) { const s = w * (0.35 + rnd() * 0.3); split(x, y, s, h, d + 1); split(x + s, y, w - s, h, d + 1); }
        else { const s = h * (0.35 + rnd() * 0.3); split(x, y, w, s, d + 1); split(x, y + s, w, h - s, d + 1); }
      };
      split(80, 110, 620, 470, 0);
      gen++;
    };
    newPlan();
    const labels = ['LIVING', 'BED', 'BATH', 'KITCHEN', 'HALL', 'STORE', 'BED 2', 'WC', 'BALC'];
    let start = 0;
    return (t) => {
      const frame = Math.floor(t * 8);
      if (frame === last) return;
      last = frame;
      if (t - start > 7) { newPlan(); start = t; }
      const k = Math.floor((t - start) * 5);
      cx.fillStyle = '#03110c'; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(57,255,176,0.08)'; cx.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
      for (let y = 0; y < H; y += 32) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
      cx.fillStyle = '#39ffb0'; cx.font = 'bold 44px "Share Tech Mono", monospace'; cx.fillText('FINCH 3D', 80, 70);
      cx.font = '24px "Share Tech Mono", monospace'; cx.fillStyle = 'rgba(57,255,176,0.8)';
      cx.fillText(`generating floor plan option ${String(gen).padStart(3, '0')} …`, 330, 66);
      rooms.slice(0, k).forEach((r, i) => {
        cx.fillStyle = `hsla(${150 + (i * 37) % 80}, 90%, 50%, 0.18)`;
        cx.fillRect(r.x, r.y, r.w, r.h);
        cx.strokeStyle = '#39ffb0'; cx.lineWidth = 6; cx.strokeRect(r.x, r.y, r.w, r.h);
        cx.fillStyle = '#b8ffe4'; cx.font = '20px "Share Tech Mono", monospace';
        cx.fillText(labels[i % labels.length], r.x + 12, r.y + 30);
        cx.fillText(`${((r.w * r.h) / 2600).toFixed(1)} m²`, r.x + 12, r.y + 54);
      });
      // side panel metrics
      cx.fillStyle = 'rgba(57,255,176,0.9)'; cx.font = '22px "Share Tech Mono", monospace';
      const m = ['DAYLIGHT', 'AREA', 'CIRCULATION', 'UNITS'];
      m.forEach((s, i) => {
        cx.fillText(s, 750, 150 + i * 100);
        const v = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + i + gen));
        cx.fillStyle = 'rgba(57,255,176,0.25)'; cx.fillRect(750, 165 + i * 100, 200, 16);
        cx.fillStyle = '#39ffb0'; cx.fillRect(750, 165 + i * 100, 200 * v, 16);
      });
      tex.needsUpdate = true;
    };
  },
};

// Campustratten pavilion: a hexagonal funnel roof on ONE central tapered GLT leg that doubles as the rain filter.
export function buildPavilion(s = 1, opts = {}) {
  const group = new THREE.Group();
  const clip = opts.clip || null;
  const mk = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, clippingPlanes: clip, side: THREE.DoubleSide, ...o });
  const wood = opts.pla ? mk(0xf2efe6, { roughness: 0.45 }) : mk(0xc89a62);
  const green = opts.pla ? wood : mk(0x3f6a2c, { roughness: 0.9, emissive: 0x0b2a08 });
  const steel = opts.pla ? wood : mk(0x2a2b30, { metalness: 0.8, roughness: 0.35 });
  const concrete = opts.pla ? wood : mk(0x777777, { roughness: 0.9 });
  const R = 4.4 * s, H = 3.8 * s, Hc = 2.9 * s;
  // pad
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.6, 0.15 * s, 6), concrete); pad.position.y = 0.075 * s; group.add(pad);
  // the leg: six tapered GLT staves around a glass filter tube
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, Hc, 0.2 * s), wood);
    const rm = 0.36 * s;
    st.position.set(Math.cos(a) * rm, Hc / 2, -Math.sin(a) * rm);
    st.rotation.y = a;
    st.rotation.z = -0.07; // leans out towards the roof: wider at the top
    group.add(st);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * s, 0.5 * s, 0.3 * s, 6), steel); collar.position.y = Hc - 0.05 * s; group.add(collar);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 0.25 * s, 6), steel); foot.position.y = 0.27 * s; group.add(foot);
  // funnel roof: outer hex ring high, inner ring low, resting on the leg
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(R, 0.55 * s, H - Hc, 6, 1, true), green); roof.position.y = (H + Hc) / 2 + 0.1 * s; group.add(roof);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(R, 0.55 * s, H - Hc, 6, 1, true), wood); under.position.y = (H + Hc) / 2 + 0.02 * s; group.add(under);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05 * s, R + 0.05 * s, 0.28 * s, 6, 1, true), wood); fascia.position.y = H + 0.1 * s; group.add(fascia);
  // cantilevered radial beams from the leg top out to the roof corners
  const L = Math.hypot(R, H - Hc), ang = Math.atan2(H - Hc, R);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.24 * s, 0.16 * s), wood);
    b.position.set(Math.cos(a) * R / 2, (H + Hc) / 2 - 0.05 * s, -Math.sin(a) * R / 2);
    b.rotation.y = a; b.rotation.z = ang;
    group.add(b);
  }
  let waterU = null;
  if (opts.pla) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.26 * s, Hc, 12), wood); col.position.y = Hc / 2; group.add(col);
  } else {
    waterU = { uTime: { value: 0 } };
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.2 * s, Hc, 20, 1, true), new THREE.ShaderMaterial({
      uniforms: waterU, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float s = 0.5+0.5*sin(vUv.y*40.0 + uTime*6.0 + sin(vUv.x*30.0)*1.5);
        vec3 c = mix(vec3(0.1,0.5,0.8), vec3(0.6,1.4,1.8), s); float layers = step(0.8, fract(vUv.y*4.0))*0.5; gl_FragColor = vec4(c + layers, 0.6); }`,
    }));
    col.position.y = Hc / 2; group.add(col);
    // bike-washing spout
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.6 * s, 8), steel); sp.rotation.z = Math.PI / 2; sp.position.set(0.7 * s, 1.0 * s, 0); group.add(sp);
  }
  return { group, update: (t) => { if (waterU) waterU.uTime.value = t; } };
}
