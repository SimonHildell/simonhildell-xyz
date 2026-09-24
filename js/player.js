import * as THREE from 'three';
import { clamp, damp, GRID, IS_TOUCH } from './util.js';

const R = 0.42; // body radius

export class Player {
  constructor(scene, camera, world) {
    this.scene = scene; this.camera = camera; this.world = world;
    this.pos = new THREE.Vector3(0, 0, 97);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = Math.PI; // facing -z (north)
    this.yaw = 0; this.pitch = 0.18;
    this.camDist = IS_TOUCH ? 6.2 : 5.4;
    this.walkPhase = 0;
    this.mode = 'walk';
    this.camTarget = new THREE.Vector3();
    this.buildFigure();
    // soft personal light so the figure reads against the dark
    this.light = new THREE.PointLight(0xa8c8ff, 6, 9, 1.6);
    scene.add(this.light);
  }

  buildFigure() {
    const g = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x6b5a4c, roughness: 0.5, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8a6d5d, roughness: 0.8 });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.2), toneMapped: false });
    // long coat: tapered cylinder, open at bottom
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 1.05, 12, 1, true), coat);
    body.position.y = 0.95;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.45, 12), coat);
    chest.position.y = 1.6;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.22, 12, 1, true), coat);
    collar.position.y = 1.86;
    const glowLine = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 24), glow);
    glowLine.rotation.x = Math.PI / 2; glowLine.position.y = 1.96;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
    head.position.y = 2.06;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
    hair.position.y = 2.08; hair.rotation.x = -0.25;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), glow);
    visor.position.set(0, 2.08, 0.13);
    g.add(body, chest, collar, glowLine, head, hair, visor);
    // legs
    const legG = new THREE.BoxGeometry(0.13, 0.85, 0.14); legG.translate(0, -0.42, 0);
    this.legL = new THREE.Mesh(legG, dark); this.legL.position.set(-0.11, 0.86, 0);
    this.legR = new THREE.Mesh(legG, dark); this.legR.position.set(0.11, 0.86, 0);
    // arms
    const armG = new THREE.CylinderGeometry(0.07, 0.06, 0.72, 8); armG.translate(0, -0.36, 0);
    this.armL = new THREE.Mesh(armG, coat); this.armL.position.set(-0.33, 1.78, 0);
    this.armR = new THREE.Mesh(armG, coat); this.armR.position.set(0.33, 1.78, 0);
    g.add(this.legL, this.legR, this.armL, this.armR);
    // coat tails
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.55), new THREE.MeshStandardMaterial({ color: 0x5e4f43, side: THREE.DoubleSide, roughness: 0.6 }));
    tail.geometry.translate(0, -0.27, 0);
    tail.position.set(0, 0.44, -0.3);
    this.tail = tail;
    g.add(tail);
    // shadow blob
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02;
    this.shadow = sh;
    this.scene.add(sh);
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.fig = g;
    this.scene.add(g);
  }

  collide(p) {
    const w = this.world;
    for (let it = 0; it < 2; it++) {
      for (const c of w.colliders) {
        if (c.disabled) continue;
        const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
        const dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R;
          } else {
            // inside: push out along smallest axis
            const l = p.x - c.x0, r = c.x1 - p.x, f = p.z - c.z0, b = c.z1 - p.z;
            const m = Math.min(l, r, f, b);
            if (m === l) p.x = c.x0 - R; else if (m === r) p.x = c.x1 + R; else if (m === f) p.z = c.z0 - R; else p.z = c.z1 + R;
          }
        }
      }
      for (const c of w.colliderCircles) {
        const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + R;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr; }
      }
    }
    p.x = clamp(p.x, -GRID.bound, GRID.bound);
    p.z = clamp(p.z, -GRID.bound, GRID.bound);
  }

  pointBlocked(x, y, z) {
    for (const c of this.world.colliders) {
      if (c.disabled || c.noCam) continue;
      if (x > c.x0 - 0.2 && x < c.x1 + 0.2 && z > c.z0 - 0.2 && z < c.z1 + 0.2 && y < (c.h ?? 999)) return true;
    }
    return false;
  }

  update(dt, input, t) {
    const look = input.consumeLook();
    if (this.mode === 'walk') {
      this.yaw -= look.dx * 0.0042;
      this.pitch = clamp(this.pitch + look.dy * 0.003, -0.35, 0.95);
    }
    // movement relative to camera yaw
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rightX = -fwdZ, rightZ = fwdX;
    let mx = 0, mz = 0;
    if (this.mode === 'walk') {
      mx = fwdX * input.move.y + rightX * input.move.x;
      mz = fwdZ * input.move.y + rightZ * input.move.x;
    }
    const speed = input.run ? 10.5 : 5.2;
    const targetVX = mx * speed, targetVZ = mz * speed;
    this.vel.x = damp(this.vel.x, targetVX, 10, dt);
    this.vel.z = damp(this.vel.z, targetVZ, 10, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (input.consumeJump() && this.pos.y <= 0.001) this.vy = 5.2;
    this.vy -= 14 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y < 0) { this.pos.y = 0; this.vy = 0; }
    this.collide(this.pos);

    // figure orientation + gait
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.3) {
      const h = Math.atan2(this.vel.x, this.vel.z);
      let d = h - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 12);
    }
    this.walkPhase += dt * sp * 1.55;
    const sw = Math.sin(this.walkPhase) * Math.min(1, sp / 4) * 0.7;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8; this.armR.rotation.x = sw * 0.8;
    this.tail.rotation.x = -0.15 - Math.min(0.7, sp * 0.06) + Math.sin(t * 7) * 0.03 * sp / 5;
    this.fig.position.set(this.pos.x, this.pos.y + Math.abs(Math.cos(this.walkPhase)) * 0.05 * Math.min(1, sp / 3), this.pos.z);
    this.fig.rotation.y = this.heading;
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
    this.light.position.set(this.pos.x, this.pos.y + 3, this.pos.z + 0.5);

    if (this.mode === 'walk') this.updateCamera(dt);
    this.speed = sp;
  }

  updateCamera(dt) {
    const tgt = this.camTarget.set(this.pos.x, this.pos.y + 1.7, this.pos.z);
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    let dist = this.camDist;
    // pull the camera in if a building is in the way
    for (let s = 0.6; s <= this.camDist; s += 0.35) {
      const x = tgt.x + dir.x * s, y = tgt.y + dir.y * s, z = tgt.z + dir.z * s;
      if (this.pointBlocked(x, y, z)) { dist = Math.max(0.8, s - 0.4); break; }
    }
    this.curDist = damp(this.curDist ?? dist, dist, dist < (this.curDist ?? dist) ? 25 : 4, dt);
    const cam = this.camera;
    cam.position.set(tgt.x + dir.x * this.curDist, Math.max(0.35, tgt.y + dir.y * this.curDist), tgt.z + dir.z * this.curDist);
    cam.lookAt(tgt.x, tgt.y + 0.2, tgt.z);
  }
}
