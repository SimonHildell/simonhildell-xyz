import * as THREE from 'three';
import { TRACKS, PLAYLIST_URL } from './tracks.js';
import { signTexture } from './textures.js';
import { storage } from './util.js';

// Ramen stall + jukebox in the central plaza, and the Spotify-powered player.
export class Jukebox {
  constructor(scene, world, hooks) {
    this.scene = scene; this.world = world; this.hooks = hooks;
    this.playing = false; this.current = -1; this.shuffle = storage.get('shx-shuffle', true);
    this.controller = null; this.apiState = 'none';
    const base = new THREE.Vector3(-8.5, 0, -9.5); // plaza (0,0) local corner
    this.buildStall(base);
    this.buildMachine(new THREE.Vector3(-3.2, 0, -12.3));
    world.interactables.push({
      id: 'jukebox', x: -3.2, z: -11, r: 2.6, label: 'Open the jukebox',
      action: () => this.hooks.openUI(),
      enabled: () => true,
    });
  }

  buildStall(p) {
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = Math.PI / 4; this.scene.add(g); this.stall = g;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.7 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.05, 1.2), wood); counter.position.set(0, 0.52, 0.6); g.add(counter);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 2.2), dark); back.position.set(0, 1.6, -1.2); g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 3.8), dark); roof.position.set(0, 3.1, 0); roof.rotation.x = 0.08; g.add(roof);
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.35, 0.9), toneMapped: false })); glowStrip.position.set(0, 3.0, 1.85); g.add(glowStrip);
    // noren curtains
    const noren = new THREE.MeshStandardMaterial({ color: 0x8a1020, emissive: 0x300008, side: THREE.DoubleSide, roughness: 0.9 });
    for (let i = 0; i < 5; i++) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), noren); n.position.set(-2 + i, 2.62, 1.8); g.add(n); }
    // lanterns
    const lantM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.25), toneMapped: false });
    this.lanterns = [];
    for (const x of [-2.6, 2.6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), lantM); l.scale.y = 1.35; l.position.set(x, 2.45, 1.9); g.add(l); this.lanterns.push(l); }
    // sign
    const t = signTexture('ラーメン', '#ff4fa3', { size: 120 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8 / t.userData.aspect), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
    s.position.set(0, 3.7, 1.2); g.add(s);
    // stools
    const stoolM = new THREE.MeshStandardMaterial({ color: 0x777b84, metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 12), stoolM); st.position.set(-1.8 + i * 1.2, 0.35, 1.7); g.add(st); }
    // steam bowl glow
    const light = new THREE.PointLight(0xff6a3d, 22, 12, 1.6); light.position.set(0, 2.2, 1.5); g.add(light);
    // collider (approximate, rotated stall → use a circle cluster)
    const w = this.world.colliderCircles;
    const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4);
    for (let i = -2; i <= 2; i++) {
      for (const lz of [-1.2, 0.4]) {
        const lx = i * 1.1;
        w.push({ x: p.x + lx * cos + lz * sin, z: p.z - lx * sin + lz * cos, r: 0.9 });
      }
    }
  }

  buildMachine(p) {
    const g = new THREE.Group(); g.position.copy(p); this.scene.add(g); this.machine = g;
    const body = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.35, metalness: 0.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, roughness: 0.15, metalness: 1 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, 0.7), body); box.position.y = 0.625; g.add(box);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.7, 32, 1, false, -Math.PI / 2, Math.PI), body);
    arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.y = 1.25; g.add(arch);
    // neon arcs
    this.arcs = [];
    const cols = ['#ff4fa3', '#ffb347', '#6af2ff'];
    cols.forEach((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4), toneMapped: false });
      const tor = new THREE.Mesh(new THREE.TorusGeometry(0.6 - i * 0.09, 0.025, 8, 40, Math.PI), m);
      tor.position.set(0, 1.25, 0.36 + i * 0.005); g.add(tor); this.arcs.push(m);
      for (const sx of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), m); bar.position.set(sx * (0.6 - i * 0.09), 0.7, 0.36); g.add(bar); }
    });
    // animated equaliser front
    const eqC = document.createElement('canvas'); eqC.width = 128; eqC.height = 64;
    this.eqCtx = eqC.getContext('2d'); this.eqTex = new THREE.CanvasTexture(eqC); this.eqTex.colorSpace = THREE.SRGBColorSpace;
    const eq = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: this.eqTex, toneMapped: false })); eq.position.set(0, 0.55, 0.352); g.add(eq);
    const title = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ color: 0x331a10 })); title.position.set(0, 1.2, 0.352); g.add(title);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.06, 0.74), chrome); trim.position.y = 0.03; g.add(trim);
    const light = new THREE.PointLight(0xff4fa3, 10, 7, 1.6); light.position.set(0, 1.4, 1.2); g.add(light);
    this.world.colliders.push({ x0: p.x - 0.7, x1: p.x + 0.7, z0: p.z - 0.4, z1: p.z + 0.4, h: 2, noCam: true });
  }

  // ---- Spotify IFrame API
  ensureApi() {
    if (this.apiState !== 'none') return;
    this.apiState = 'loading';
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      const el = document.getElementById('spotify-embed');
      const first = this.pendingIndex ?? 0;
      IFrameAPI.createController(el, { uri: `spotify:track:${TRACKS[first][0]}`, width: '100%', height: 80 }, (ctrl) => {
        this.controller = ctrl; this.apiState = 'ready';
        ctrl.addListener('ready', () => { if (this.wantPlay) { ctrl.play(); } });
        ctrl.addListener('playback_update', (e) => {
          const d = e.data || {};
          const was = this.playing;
          this.playing = !d.isPaused && !d.isBuffering ? true : (d.isBuffering ? this.playing : false);
          if (was !== this.playing) this.hooks.onState(this.playing);
          if (d.duration > 0 && d.position >= d.duration - 400 && !d.isPaused && !this._advancing) {
            this._advancing = true;
            setTimeout(() => { this._advancing = false; this.next(); }, 600);
          }
        });
        if (this.pendingIndex != null) this.hooks.onTrack(TRACKS[this.current]);
      });
    };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => { this.apiState = 'error'; this.hooks.onError(); };
    document.head.appendChild(s);
  }

  play(i) {
    this.current = (i + TRACKS.length) % TRACKS.length;
    this.wantPlay = true;
    this.hooks.onTrack(TRACKS[this.current]);
    if (this.apiState === 'ready' && this.controller) {
      this.controller.loadUri(`spotify:track:${TRACKS[this.current][0]}`);
      // play() after load; ready fires for the new uri too, this is a fallback
      setTimeout(() => this.controller && this.controller.play(), 700);
    } else {
      this.pendingIndex = this.current;
      this.ensureApi();
    }
  }

  toggle() {
    if (this.current < 0) { this.play(this.shuffle ? (Math.random() * TRACKS.length) | 0 : 0); return; }
    if (this.controller) this.controller.togglePlay();
  }

  next() {
    if (this.current < 0) return this.toggle();
    this.play(this.shuffle ? (Math.random() * TRACKS.length) | 0 : this.current + 1);
  }

  prev() { if (this.current >= 0) this.play(this.current - 1); }

  setShuffle(v) { this.shuffle = v; storage.set('shx-shuffle', v); }

  get tracks() { return TRACKS; }
  get playlistUrl() { return PLAYLIST_URL; }

  // Pseudo audio level (the embed is cross-origin, so we fake a beat while playing)
  level(t) {
    if (!this.playing) return 0.08 + 0.05 * Math.sin(t * 0.8);
    const bpm = 118 + (this.current % 7) * 4;
    const ph = (t * bpm / 60) % 1;
    const kick = Math.exp(-ph * 7);
    const hat = Math.exp(-((ph * 2) % 1) * 12) * 0.3;
    return Math.min(1, 0.25 + kick * 0.7 + hat + Math.random() * 0.08);
  }

  update(t, player) {
    const vis = !player || Math.hypot(player.pos.x + 5, player.pos.z + 10) < 110;
    this.machine.visible = this.stall.visible = vis;
    if (!vis) return;
    const lv = this.level(t);
    this.arcs.forEach((m, i) => { const k = this.playing ? 1.2 + Math.sin(t * 4 + i) * 0.6 + lv : 1 + Math.sin(t * 1.5 + i) * 0.3; m.color.setScalar(1).multiplyScalar(k); m.color.multiply(new THREE.Color(['#ff4fa3', '#ffb347', '#6af2ff'][i])); });
    if (!this._eqT || t - this._eqT > 0.07) {
      this._eqT = t;
      const g = this.eqCtx; g.fillStyle = '#120806'; g.fillRect(0, 0, 128, 64);
      for (let i = 0; i < 12; i++) {
        const h = (this.playing ? (0.2 + Math.random() * 0.8) * lv : 0.1 + 0.05 * Math.sin(t + i)) * 60;
        g.fillStyle = `hsl(${320 - i * 18}, 100%, 60%)`; g.fillRect(4 + i * 10, 62 - h, 7, h);
      }
      this.eqTex.needsUpdate = true;
    }
    this.lanterns.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.3 + i) * 0.08));
  }
}
