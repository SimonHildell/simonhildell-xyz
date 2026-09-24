import * as THREE from 'three';
import { signTexture } from './textures.js';
import { buildPavilion } from './anomalies.js';

// The finale: Simon's workstation inside a small studio at the foot of the Sea Wall.
export const STUDIO = { x0: -8, x1: 8, z0: -94, z1: -81.5, h: 4.6 };
const DESK_Z = -82.4;
const LINK = 'https://www.simonhildell.com';

export class Studio {
  constructor(scene, world, hooks) {
    this.scene = scene; this.world = world; this.hooks = hooks;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.state = 'idle';
    this.typeT = 0; this.line1 = 'this is just a playground'; this.line2 = '→ simonhildell.com';
    this.buildShell();
    this.buildDesk();
    this.buildBeacon();
    world.interactables.push({
      id: 'desk', x: 0, z: DESK_Z - 1.9, r: 2.4, label: 'Sit down at the workstation',
      action: () => this.hooks.enterDesk(),
      enabled: () => this.state !== 'desk',
    });
  }

  buildShell() {
    const S = STUDIO, g = this.group;
    const wallM = new THREE.MeshStandardMaterial({ color: 0x1b1c22, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
    const inner = new THREE.MeshStandardMaterial({ color: 0x2c2a2a, roughness: 0.9, side: THREE.DoubleSide });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    // floor
    add(new THREE.BoxGeometry(16, 0.08, 12.5), new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 0.4, metalness: 0.2 }), 0, 0.04, (S.z0 + S.z1) / 2);
    // back + side walls (interior faces)
    add(new THREE.BoxGeometry(16, S.h, 0.3), inner, 0, S.h / 2, S.z1);
    add(new THREE.BoxGeometry(0.3, S.h, 12.5), inner, S.x0, S.h / 2, (S.z0 + S.z1) / 2);
    add(new THREE.BoxGeometry(0.3, S.h, 12.5), inner, S.x1, S.h / 2, (S.z0 + S.z1) / 2);
    // ceiling + upper floors (exterior mass)
    add(new THREE.BoxGeometry(16.4, 0.3, 12.9), wallM, 0, S.h + 0.15, (S.z0 + S.z1) / 2);
    const upper = add(new THREE.BoxGeometry(16.4, 5, 12.9), new THREE.MeshStandardMaterial({ color: 0x121318, roughness: 0.7, metalness: 0.4 }), 0, S.h + 2.8, (S.z0 + S.z1) / 2);
    upper.userData.noCam = true;
    // front: mullions + glass with a door gap
    const mull = new THREE.MeshStandardMaterial({ color: 0x0d0d10, metalness: 0.8, roughness: 0.3 });
    for (const x of [-8, -5, -1.6, 1.6, 5, 8]) add(new THREE.BoxGeometry(0.16, S.h, 0.16), mull, x, S.h / 2, S.z0);
    add(new THREE.BoxGeometry(16, 0.2, 0.2), mull, 0, S.h - 0.1, S.z0);
    const glass = new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    for (const [x0, x1] of [[-8, -1.6], [1.6, 8]]) add(new THREE.PlaneGeometry(x1 - x0, S.h), glass, (x0 + x1) / 2, S.h / 2, S.z0);
    // neon sign above the door
    const t = signTexture('SIMON HILDELL · STUDIO', '#6af2ff', { size: 90 });
    const sw = 7.5, sh = sw / t.userData.aspect;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true }));
    sign.position.set(0, S.h + 1.2, S.z0 - 0.25); sign.rotation.y = Math.PI; g.add(sign);
    this.sign = sign;
    // "blinds" light stripes on the floor
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const cg = c.getContext('2d');
    for (let y = 0; y < 256; y += 32) { const grd = cg.createLinearGradient(0, y, 0, y + 20); grd.addColorStop(0, 'rgba(120,200,255,0)'); grd.addColorStop(0.5, 'rgba(120,200,255,0.5)'); grd.addColorStop(1, 'rgba(120,200,255,0)'); cg.fillStyle = grd; cg.fillRect(0, y, 64, 20); }
    const stripes = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    stripes.rotation.x = -Math.PI / 2; stripes.rotation.z = 0.35; stripes.position.set(-1.5, 0.09, S.z0 + 3.6); g.add(stripes);
    // lights
    const warm = new THREE.PointLight(0xffb070, 10, 10, 1.6); warm.position.set(1.4, 2.2, DESK_Z - 0.8); g.add(warm);
    const cool = new THREE.PointLight(0x6ab8ff, 14, 12, 1.4); cool.position.set(-3, 3.6, S.z0 + 2); g.add(cool);
    this.keepLights = [warm, cool];
    // colliders: walls with a door gap
    const w = this.world.colliders;
    w.push({ x0: -8.2, x1: 8.2, z0: S.z1 - 0.2, z1: S.z1 + 0.4 });
    w.push({ x0: S.x0 - 0.2, x1: S.x0 + 0.2, z0: S.z0, z1: S.z1 });
    w.push({ x0: S.x1 - 0.2, x1: S.x1 + 0.2, z0: S.z0, z1: S.z1 });
    w.push({ x0: -8.2, x1: -1.6, z0: S.z0 - 0.15, z1: S.z0 + 0.15, noCam: true });
    w.push({ x0: 1.6, x1: 8.2, z0: S.z0 - 0.15, z1: S.z0 + 0.15, noCam: true });
    // desk collider
    w.push({ x0: -0.95, x1: 0.95, z0: DESK_Z - 0.75, z1: S.z1, h: 1.3, noCam: true });
  }

  buildDesk() {
    const g = this.group;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.5 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4, metalness: 0.5 });
    const alu = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9 });
    // desk 160 x 75
    add(new THREE.BoxGeometry(1.6, 0.04, 0.75), wood, 0, 0.72, DESK_Z);
    for (const x of [-0.75, 0.75]) add(new THREE.BoxGeometry(0.05, 0.7, 0.65), black, x, 0.35, DESK_Z);
    // 27" monitor: 0.598 x 0.336 panel
    const PW = 0.598, PH = 0.336, py = 0.74 + 0.13 + PH / 2, pz = DESK_Z + 0.2;
    add(new THREE.BoxGeometry(0.22, 0.012, 0.18), black, 0, 0.746, pz + 0.02);
    add(new THREE.BoxGeometry(0.04, 0.26, 0.03), black, 0, 0.87, pz + 0.05);
    add(new THREE.BoxGeometry(PW + 0.02, PH + 0.02, 0.025), black, 0, py, pz + 0.018);
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
    this.cv = cv; this.cx = cv.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(cv); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = add(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }), 0, py, pz);
    screen.rotation.y = Math.PI;
    this.screen = screen;
    this.screenInfo = { PW, PH, py, pz };
    // laptop on a stand, to the right of the screen (from the seated view)
    const lx = -0.6, lz = DESK_Z + 0.16;
    const stand = new THREE.Group(); stand.position.set(lx, 0.74, lz); g.add(stand);
    for (const sx of [-0.1, 0.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.2), alu);
      leg.position.set(sx, 0.08, 0); leg.rotation.x = 0.0; stand.add(leg);
    }
    const lap = new THREE.Group(); lap.position.set(0, 0.17, 0); lap.rotation.x = -0.28; stand.add(lap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.012, 0.215), alu); lap.add(base);
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), black); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.0065, -0.02); lap.add(kb);
    const lid = new THREE.Group(); lid.position.set(0, 0.006, 0.105); lid.rotation.x = 0.48; lap.add(lid);
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.205, 0.006), alu); lidM.position.y = 0.1025; lid.add(lidM);
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 340;
    const lg = lc.getContext('2d');
    lg.fillStyle = '#101216'; lg.fillRect(0, 0, 512, 340);
    // node-graph vibe
    const nodes = [];
    for (let i = 0; i < 9; i++) nodes.push([40 + (i % 3) * 170 + Math.random() * 30, 40 + ((i / 3) | 0) * 100 + Math.random() * 20]);
    lg.strokeStyle = 'rgba(120,220,255,0.7)'; lg.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const [ax, ay] = nodes[i], [bx, by] = nodes[(i + 1 + (i % 2) * 2) % 9]; lg.beginPath(); lg.moveTo(ax + 80, ay + 20); lg.bezierCurveTo(ax + 130, ay + 20, bx - 50, by + 20, bx, by + 20); lg.stroke(); }
    nodes.forEach(([x, y], i) => { lg.fillStyle = i % 4 === 0 ? '#ff4fa3' : '#3b4252'; lg.fillRect(x, y, 80, 40); lg.fillStyle = '#e8eef8'; lg.font = '14px monospace'; lg.fillText(['Pt', 'Crv', 'Srf', 'Loft', 'Div', 'Tri', 'Mesh', 'Bake', 'Flow'][i], x + 8, y + 25); });
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    const lscr = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.185), new THREE.MeshBasicMaterial({ map: lt, toneMapped: false }));
    lscr.position.set(0, 0.1025, -0.0035); lscr.rotation.y = Math.PI; lid.add(lscr);
    // keyboard + mouse
    add(new THREE.BoxGeometry(0.36, 0.015, 0.12), black, 0.02, 0.748, DESK_Z - 0.18);
    add(new THREE.BoxGeometry(0.06, 0.02, 0.1), black, -0.3, 0.75, DESK_Z - 0.2);
    // lamp
    const lamp = new THREE.Group(); lamp.position.set(0.66, 0.74, DESK_Z + 0.2); g.add(lamp);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.45), black); arm.position.y = 0.22; arm.rotation.z = 0.25; lamp.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 16, 1, true), black); shade.position.set(-0.07, 0.44, -0.02); shade.rotation.z = 0.9; lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), toneMapped: false })); bulb.position.set(-0.1, 0.41, -0.02); lamp.add(bulb);
    // the printed Campustratten model on the desk
    const pav = buildPavilion(0.024, { pla: true }); pav.group.position.set(0.45, 0.74, DESK_Z - 0.12); g.add(pav.group);
    // chair
    const chair = new THREE.Group(); chair.position.set(0, 0, DESK_Z - 0.8); g.add(chair);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), black); seat.position.y = 0.48; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.06), black); back.position.set(0, 0.85, -0.24); back.rotation.x = -0.12; chair.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42), alu); post.position.y = 0.23; chair.add(post);
    this.chair = chair;
    // plant
    const pot = add(new THREE.CylinderGeometry(0.16, 0.12, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0xd8d2c8 }), 1.2, 0.175, DESK_Z + 0.05);
    for (let i = 0; i < 9; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.8 })); leaf.scale.set(0.6, 1.4, 0.3); leaf.position.set(1.2 + Math.cos(i) * 0.12, 0.5 + (i % 3) * 0.12, DESK_Z + 0.05 + Math.sin(i) * 0.12); leaf.rotation.set(Math.random(), i, Math.random() * 0.6); g.add(leaf); }
    // neon strip behind desk
    add(new THREE.BoxGeometry(3.6, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.4, 1.6), toneMapped: false }), 0, 2.2, STUDIO.z1 - 0.17);
    this.drawScreen(0);
  }

  buildBeacon() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime; uniform float uAmt; varying vec2 vUv; void main(){ float a = (1.0-vUv.y)*0.35*uAmt*(0.7+0.3*sin(vUv.y*40.0-uTime*5.0)); gl_FragColor = vec4(vec3(0.4,0.95,1.2)*a, a);} `,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 260, 16, 1, true), mat);
    beam.position.set(0, 140, (STUDIO.z0 + STUDIO.z1) / 2);
    this.scene.add(beam);
    this.beam = mat;
  }

  setBeacon(on) { this.beaconTarget = on ? 1 : 0; }

  drawScreen(t) {
    const g = this.cx, W = 1280, H = 720;
    g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
    // subtle scanlines
    g.fillStyle = 'rgba(255,255,255,0.018)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
    g.font = '64px "Share Tech Mono", ui-monospace, monospace';
    g.textBaseline = 'alphabetic';
    const cursorOn = Math.floor(t * 2.2) % 2 === 0;
    const x = 110, y1 = 330, y2 = 440;
    if (this.state === 'idle') {
      g.fillStyle = 'rgba(160,220,255,0.35)';
      g.font = '28px "Share Tech Mono", monospace';
      g.fillText('simon@studio ~ %', x, 120);
      if (cursorOn) { g.fillStyle = '#e8f6ff'; g.fillRect(x, y1 - 50, 34, 60); }
    } else {
      g.fillStyle = 'rgba(160,220,255,0.35)';
      g.font = '28px "Share Tech Mono", monospace';
      g.fillText('simon@studio ~ % ./playground', x, 120);
      g.font = '64px "Share Tech Mono", ui-monospace, monospace';
      const n = Math.floor(this.typeT * 13);
      const l1 = this.line1.slice(0, Math.min(n, this.line1.length));
      g.fillStyle = '#eef8ff';
      g.shadowColor = '#9fe0ff'; g.shadowBlur = 18;
      g.fillText(l1, x, y1);
      const n2 = Math.max(0, Math.floor((this.typeT - this.line1.length / 13 - 0.9) * 11));
      const l2 = this.line2.slice(0, Math.min(n2, [...this.line2].length));
      if (n2 > 0) {
        g.fillStyle = '#6af2ff'; g.shadowColor = '#6af2ff';
        g.fillText(l2, x, y2);
        const w2 = g.measureText(l2).width;
        g.fillRect(x + 64, y2 + 14, Math.max(0, w2 - 64), 4);
        this.linkBox = { x0: x / W, x1: (x + w2) / W, y0: (y2 - 60) / H, y1: (y2 + 24) / H };
      }
      g.shadowBlur = 0;
      let cx, cy;
      if (n < this.line1.length) { cx = x + g.measureText(l1).width + 8; cy = y1; }
      else if (n2 === 0) { cx = x; cy = y2; }
      else { cx = x + g.measureText(l2).width + 8; cy = y2; }
      if (cursorOn || this.lastLen !== n + n2) { g.fillStyle = '#e8f6ff'; g.fillRect(cx, cy - 50, 30, 60); }
      if (this.lastLen !== n + n2) { this.hooks.onType && this.hooks.onType(); this.lastLen = n + n2; }
      this.complete = n2 >= [...this.line2].length;
    }
    this.screenTex.needsUpdate = true;
  }

  startTyping() { this.state = 'desk'; this.typeT = -0.4; this.complete = false; this.linkBox = null; }
  reset() { this.state = 'idle'; }

  // camera pose for the seated view, adapted to aspect ratio
  seatPose(camera) {
    const { PW, PH, py, pz } = this.screenInfo;
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    if (camera.aspect >= 1) {
      // landscape: frame the monitor and the laptop on its stand (viewer's right = -x)
      const span = 1.55, cx = -0.2;
      const d = Math.max((span / 0.92 / 2) / Math.tan(hf / 2), (PH / 0.5 / 2) / Math.tan(vf / 2));
      return { pos: new THREE.Vector3(cx * 0.8, py + 0.06, pz - d), look: new THREE.Vector3(cx, py - 0.04, pz) };
    }
    const d = Math.max((PW / 0.86 / 2) / Math.tan(hf / 2), (PH / 0.62 / 2) / Math.tan(vf / 2));
    return { pos: new THREE.Vector3(0.0, py + 0.02, pz - d), look: new THREE.Vector3(0, py, pz) };
  }

  linkHit(uv) {
    if (!this.complete || !this.linkBox) return false;
    const u = uv.x, v = 1 - uv.y;
    const b = this.linkBox;
    return u > b.x0 - 0.02 && u < b.x1 + 0.02 && v > b.y0 && v < b.y1;
  }

  get link() { return LINK; }

  update(t, dt, player) {
    if (player) this.group.visible = Math.hypot(player.pos.x, player.pos.z - DESK_Z) < 110;
    if (this.state === 'desk') this.typeT += dt;
    if (!this._last || t - this._last > 1 / 30) { this.drawScreen(t); this._last = t; }
    const bt = this.beaconTarget ?? 0;
    this.beam.uniforms.uAmt.value += (bt - this.beam.uniforms.uAmt.value) * Math.min(1, dt);
    this.beam.uniforms.uTime.value = t;
  }
}
