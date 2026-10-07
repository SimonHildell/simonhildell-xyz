import * as THREE from 'three';
import { spinnerGeometries, spinnerBodyMat, spinnerLightMat, beamMat } from './spinner.js';
import { signTexture } from './textures.js';
import { clamp, damp, QUALITY, IS_TOUCH } from './util.js';

// Spinners you can hop into. Parked ones hover at their spot; press E (or the button) to fly.
const SPOTS = [
  { x: 6, y: 0, z: 85, h: -Math.PI / 2 },    // by the entry, on the perimeter street
  { x: 34, y: 12, z: 0, h: Math.PI },         // landing pad on the Night Market roof
  { x: -6.5, y: 18, z: 39, h: 0.6 },          // next to the Sky Bar, on top of the Vertical Market
];
const HOVER = 1.3;          // height of the car origin above the surface it sits on
const R = 2.3;              // collision radius

export class FlyCars {
  constructor(scene, world, camera, player, hooks) {
    this.scene = scene; this.world = world; this.camera = camera; this.player = player; this.hooks = hooks;
    this.active = null;
    this.camYawOff = 0; this.camPitch = 0.28; this.lookIdle = 0;
    const G = spinnerGeometries();
    const signT = signTexture('FLY · E', '#6af2ff', { size: 90 });
    this.cars = SPOTS.map((s, i) => {
      const g = new THREE.Group();
      const bodyMat = spinnerBodyMat();
      const body = new THREE.Mesh(G.body, bodyMat);
      body.geometry = G.body;
      const tint = [[0.85, 0.85, 0.9], [0.9, 0.55, 0.2], [0.35, 0.4, 0.6]][i % 3];
      bodyMat.color.setRGB(...tint);
      const lights = new THREE.Mesh(G.lights, spinnerLightMat());
      g.add(body, lights);
      if (!QUALITY.low) { const b = new THREE.Mesh(G.beam, beamMat()); g.add(b); }
      // floating "FLY" marker while parked
      const sw = 2.4, sh = sw / signT.userData.aspect;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: signT, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide, depthWrite: false }));
      sign.position.y = 2.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.4), toneMapped: false, transparent: true, opacity: 0.7 }));
      ring.rotation.x = Math.PI / 2;
      const car = { g, sign, ring, pos: new THREE.Vector3(s.x, s.y + HOVER, s.z), heading: s.h, vel: new THREE.Vector3(), vy: 0, roll: 0, pitch: 0, base: s.y };
      g.position.copy(car.pos); g.rotation.y = s.h;
      scene.add(g, sign, ring);
      car.it = { id: `car${i}`, x: s.x, z: s.z, y: s.y, r: 3.4, label: 'Hop into the spinner', action: () => this.enter(car), enabled: () => !this.active };
      world.interactables.push(car.it);
      return car;
    });
    this.tmp = new THREE.Vector3();
  }

  enter(car) {
    this.active = car;
    car.landing = false;
    this.camYawOff = 0; this.camPitch = 0.28;
    car.sign.visible = car.ring.visible = false;
    this.hooks.onEnter(car);
  }

  exit() {
    const car = this.active; if (!car) return;
    const p = this.player;
    // step out to the right of the car, or the left, or on top as a last resort
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    const ground = (x, z) => p.groundAt(x, z, car.pos.y);
    let placed = false;
    for (const s of [2.8, -2.8]) {
      const x = car.pos.x + rx * s, z = car.pos.z + rz * s;
      const gy = ground(x, z);
      if (Math.abs(gy - car.base) < 0.6) { p.pos.set(x, gy, z); placed = true; break; }
    }
    if (!placed) p.pos.set(car.pos.x, car.base, car.pos.z + 3);
    p.vy = 0; p.grounded = true;
    car.it.x = car.pos.x; car.it.z = car.pos.z; car.it.y = car.base;
    car.sign.visible = car.ring.visible = true;
    car.vel.set(0, 0, 0); car.vy = 0;
    this.active = null;
    this.hooks.onExit(car);
  }

  // car vs. world: buildings (up to their roof), rails/columns (up to their height), decks (as slabs)
  collide(car, prevY) {
    const w = this.world, p = car.pos;
    let hit = false;
    for (const c of w.colliders) {
      if (c.disabled) continue;
      const y0 = c.y0 || 0;
      const top = c.roof ?? (y0 + (c.h ?? 999));
      if (p.y - 1.2 > top || p.y + 0.9 < y0) continue;
      const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1e-3;
        if (d2 < 1e-6) { p.x += R; } else { p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R; }
        hit = true;
      }
    }
    for (const c of w.colliderCircles) {
      const y0 = c.y0 || 0, top = y0 + (c.h ?? 999);
      if (p.y - 1.2 > top || p.y + 0.9 < y0) continue;
      const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + R, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr; hit = true; }
    }
    for (const s of w.surfaces) {
      if (s.kerb) continue;
      if (p.x < s.x0 - 1.2 || p.x > s.x1 + 1.2 || p.z < s.z0 - 1.2 || p.z > s.z1 + 1.2) continue;
      const h = s.axis ? null : s.y;
      if (h == null) continue;
      if (Math.abs(p.y - h) < HOVER) { p.y = prevY >= h ? h + HOVER : h - HOVER; car.vy = 0; }
    }
    p.x = clamp(p.x, -100, 100); p.z = clamp(p.z, -100, 100);
    return hit;
  }

  update(dt, input, t, ui) {
    // parked cars bob and show their marker
    for (const c of this.cars) {
      if (c === this.active) continue;
      c.g.position.set(c.pos.x, c.pos.y + Math.sin(t * 1.6 + c.base) * 0.08, c.pos.z);
      c.g.rotation.set(0, c.heading, 0);
      c.sign.position.set(c.pos.x, c.pos.y + 2.2 + Math.sin(t * 2) * 0.1, c.pos.z);
      c.sign.lookAt(this.camera.position.x, c.sign.position.y, this.camera.position.z);
      c.ring.position.set(c.pos.x, c.base + 0.08, c.pos.z);
      c.ring.scale.setScalar(1 + 0.06 * Math.sin(t * 3));
    }
    const car = this.active;
    if (!car) return;

    const look = input.consumeLook();
    if (Math.abs(look.dx) + Math.abs(look.dy) > 0) { this.camYawOff -= look.dx * 0.004; this.camPitch = clamp(this.camPitch + look.dy * 0.003, -0.2, 1.1); this.lookIdle = 0; }
    else { this.lookIdle += dt; if (this.lookIdle > 1.5) this.camYawOff = damp(this.camYawOff, 0, 2, dt); }

    const thrust = input.move.y, turn = input.move.x;
    const boost = input.run ? 1.75 : 1;
    const up = (input.keys.has('Space') || input.flyUp ? 1 : 0) - (input.keys.has('KeyQ') || input.keys.has('KeyC') || input.flyDown ? 1 : 0);
    const groundY = this.player.groundAt(car.pos.x, car.pos.z, car.pos.y - HOVER + 0.2);

    if (car.landing) {
      car.vy = -9;
      if (car.pos.y - groundY <= HOVER + 0.15) { car.pos.y = groundY + HOVER; car.base = groundY; this.exit(); return; }
    } else {
      car.vy = damp(car.vy, up * 11, 4, dt);
    }
    const turnRate = -turn * (1.5 - Math.min(0.6, car.vel.length() / 60));
    car.heading += turnRate * dt;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const target = (car.landing ? 0 : thrust) * 30 * boost;
    const cur = car.vel.x * fx + car.vel.z * fz;
    const spd = damp(cur, target, thrust ? 1.6 : 1.1, dt);
    // keep a little sideways drift for a floaty feel
    const side = (car.vel.x * fz - car.vel.z * fx) * Math.exp(-3 * dt);
    car.vel.set(fx * spd + fz * side, 0, fz * spd - fx * side);
    const prevY = car.pos.y;
    car.pos.x += car.vel.x * dt; car.pos.z += car.vel.z * dt; car.pos.y += car.vy * dt;
    car.pos.y = clamp(car.pos.y, groundY + HOVER, 115);
    if (this.collide(car, prevY)) { car.vel.multiplyScalar(0.35); this.hooks.onBump(); }

    // pose: bank into turns, nose dips when accelerating
    car.roll = damp(car.roll, turnRate * 0.35 + side * 0.01, 4, dt);
    car.pitch = damp(car.pitch, (target - cur) * -0.004 - car.vy * 0.015, 3, dt);
    car.g.position.copy(car.pos).y += Math.sin(t * 2.2) * 0.05;
    car.g.rotation.set(car.pitch, car.heading, car.roll, 'YXZ');

    // keep the walker with the car so radar, weather and districts follow
    this.player.pos.set(car.pos.x, car.pos.y - HOVER, car.pos.z);

    // chase camera
    const yaw = car.heading + Math.PI + this.camYawOff, cp = Math.cos(this.camPitch);
    const dir = this.tmp.set(Math.sin(yaw) * cp, Math.sin(this.camPitch), Math.cos(yaw) * cp);
    const tgt = (this._tgt ||= new THREE.Vector3()).set(car.pos.x, car.pos.y + 1.2, car.pos.z);
    let dist = 11 + Math.min(6, Math.abs(spd) * 0.1);
    for (let s = 1; s <= dist; s += 0.6) {
      if (this.player.pointBlocked(tgt.x + dir.x * s, tgt.y + dir.y * s, tgt.z + dir.z * s)) { dist = Math.max(3, s - 0.6); break; }
    }
    this.camDist = damp(this.camDist ?? dist, dist, dist < (this.camDist ?? dist) ? 12 : 3, dt);
    const cam = this.camera;
    const want = (this._want ||= new THREE.Vector3()).set(tgt.x + dir.x * this.camDist, tgt.y + dir.y * this.camDist, tgt.z + dir.z * this.camDist);
    want.y = Math.max(want.y, this.player.groundAt(want.x, want.z, want.y) + 0.5);
    cam.position.lerp(want, 1 - Math.exp(-10 * dt));
    cam.lookAt(tgt.x, tgt.y + 0.5, tgt.z);

    ui.prompt(car.landing ? 'Landing…' : IS_TOUCH ? 'Land and step out' : 'Land and step out');
    if (input.consumeInteract() && !car.landing) {
      if (car.pos.y - groundY < HOVER + 1.5) { car.pos.y = groundY + HOVER; car.base = groundY; this.exit(); }
      else car.landing = true;
    }
    this.speed = Math.abs(spd);
  }
}
