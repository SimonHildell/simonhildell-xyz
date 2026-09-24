import * as THREE from 'three';
import { QUALITY, IS_TOUCH, lerp, storage } from './util.js';
import { buildCity, districtT } from './city.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Anomalies } from './anomalies.js';
import { Studio, STUDIO } from './studio.js';
import { Jukebox } from './jukebox.js';
import { Ambience } from './audio.js';
import { createFX } from './fx.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
if (IS_TOUCH) document.body.classList.add('touch');

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  if (!webglOK()) { $('fallback').classList.remove('hidden'); $('intro').classList.add('hidden'); return; }
  // fonts are used inside canvas textures, so wait (briefly) for them
  try { await Promise.race([Promise.all([document.fonts.load('64px "Share Tech Mono"'), document.fonts.load('800 40px Orbitron')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* ignore */ }

  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(QUALITY.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const fogWest = new THREE.Color('#4a2210'), fogEast = new THREE.Color('#0a1826');
  scene.fog = new THREE.FogExp2(fogEast.clone(), 0.012);
  scene.background = scene.fog.color;
  const camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 70 : 60, innerWidth / innerHeight, 0.08, 900);

  const hemi = new THREE.HemisphereLight(0x6a5a90, 0x100808, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.35); moon.position.set(-40, 80, 30); scene.add(moon);

  const world = { colliders: [], colliderCircles: [], interactables: [], updaters: [], buildingMeshes: [] };
  buildCity(scene, world, renderer);

  const ui = new UI();
  const ambience = new Ambience();
  const fx = createFX(renderer, scene, camera);

  let started = false;
  const state = { card: null };

  const anomalies = new Anomalies(scene, world, {
    onFound(d, n) {
      fx.glitch(1.3); ambience.blip('find'); ui.flash(d.color); ui.bump();
      ui.setCount(n, anomalies.found);
      ui.showCard(d, n); state.card = d.id; this.cardOpen = d.id;
      if (n === 3) setTimeout(() => ui.toast('A beacon has lit up over the studio by the Sea Wall. Follow it on the radar.', 6500), 1800);
      if (n === 9) setTimeout(() => ui.toast('All nine anomalies found. Now go and sit down at the workstation.', 6500), 1800);
      studio.setBeacon(n >= 3);
    },
    onLeave() { ui.hideCard(); state.card = null; this.cardOpen = null; },
    cardOpen: null,
  });
  $('card-close').onclick = () => { ui.hideCard(); anomalies.hooks.cardOpen = null; ambience.blip('ui'); };

  const input = new Input(canvas);
  const player = new Player(scene, camera, world);

  // ---------- jukebox
  const jb = new Jukebox(scene, world, {
    openUI: () => openJukebox(),
    onTrack: (tr) => { ui.nowPlaying(tr); $('spotify-dock').classList.remove('hidden'); renderList(); },
    onState: (playing) => { $('jb-play').textContent = playing ? '❚❚' : '▶'; $('btn-music').classList.toggle('live', playing); ambience.setDuck(playing); },
    onError: () => ui.toast('Could not reach Spotify. Check your connection or ad-blocker.'),
  });
  const list = $('jb-list');
  function renderList() {
    const q = $('jb-search').value.trim().toLowerCase();
    list.innerHTML = '';
    jb.tracks.forEach((tr, i) => {
      if (q && !(`${tr[1]} ${tr[2]}`.toLowerCase().includes(q))) return;
      const li = document.createElement('li');
      li.className = i === jb.current ? 'cur' : '';
      li.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span><span class="t"></span><span class="a"></span></span>`;
      li.querySelector('.t').textContent = tr[1];
      li.querySelector('.a').textContent = tr[2];
      li.onclick = () => { jb.play(i); ambience.blip('ui'); };
      list.appendChild(li);
    });
  }
  function openJukebox() {
    $('jukebox').classList.remove('hidden'); input.enabled = false; renderList(); ambience.blip('ui');
    jb.ensureApi();
  }
  function closeJukebox() { $('jukebox').classList.add('hidden'); input.enabled = player.mode === 'walk'; }
  $('jb-close').onclick = closeJukebox;
  $('jb-play').onclick = () => jb.toggle();
  $('jb-next').onclick = () => jb.next();
  $('jb-prev').onclick = () => jb.prev();
  $('jb-shuffle').classList.toggle('on', jb.shuffle);
  $('jb-shuffle').onclick = () => { jb.setShuffle(!jb.shuffle); $('jb-shuffle').classList.toggle('on', jb.shuffle); };
  $('jb-search').oninput = renderList;
  $('jb-open').href = jb.playlistUrl;
  $('btn-music').onclick = () => ($('jukebox').classList.contains('hidden') ? openJukebox() : closeJukebox());
  $('nowplaying').onclick = () => $('spotify-dock').classList.toggle('min');

  // ---------- studio / finale
  const desk = { active: false, t: 0, from: null, to: null };
  const studio = new Studio(scene, world, {
    enterDesk: () => {
      if (desk.active) return;
      desk.active = true; desk.t = 0;
      player.mode = 'desk'; input.enabled = false; player.fig.visible = false; player.shadow.visible = false;
      desk.from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      const pose = studio.seatPose(camera);
      const m = new THREE.Matrix4().lookAt(pose.pos, pose.look, new THREE.Vector3(0, 1, 0));
      desk.to = { pos: pose.pos, quat: new THREE.Quaternion().setFromRotationMatrix(m) };
      ui.prompt(null); ui.hideCard();
      $('desk-ui').classList.remove('hidden'); $('desk-open').classList.add('hidden');
      $('hud').classList.add('hidden');
    },
    onType: () => ambience.blip('type'),
  });
  studio.setBeacon(anomalies.count >= 3);
  function exitDesk() {
    desk.active = false; studio.reset();
    player.mode = 'walk'; input.enabled = true; player.fig.visible = true; player.shadow.visible = true;
    player.pos.set(0, 0, -86.5); player.yaw = Math.PI; player.pitch = 0.2; player.curDist = 2;
    $('desk-ui').classList.add('hidden'); $('hud').classList.remove('hidden');
  }
  $('desk-back').onclick = exitDesk;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('click', (e) => {
    if (!desk.active) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(studio.screen)[0];
    if (hit && studio.linkHit(hit.uv)) window.open(studio.link, '_blank', 'noopener');
  });

  // ---------- HUD buttons
  let muted = storage.get('shx-muted', false);
  const syncSound = () => { $('btn-sound').classList.toggle('off', muted); ambience.setMuted(muted); };
  $('btn-sound').onclick = () => { muted = !muted; storage.set('shx-muted', muted); syncSound(); };
  $('btn-help').onclick = () => { $('help').classList.remove('hidden'); input.enabled = false; };
  $('help-close').onclick = () => { $('help').classList.add('hidden'); input.enabled = player.mode === 'walk'; };
  $('help-reset').onclick = () => { storage.set('shx-found', []); location.reload(); };
  $('act-btn').addEventListener('touchstart', (e) => { e.preventDefault(); input.pressInteract(); }, { passive: false });
  $('act-btn').onclick = () => input.pressInteract();
  $('jump-btn').addEventListener('touchstart', (e) => { e.preventDefault(); input.pressJump(); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') closeJukebox(); return; }
    if (e.code === 'KeyM') $('btn-music').click();
    if (e.code === 'Escape') {
      if (!$('jukebox').classList.contains('hidden')) closeJukebox();
      else if (desk.active) exitDesk();
      else if (!$('help').classList.contains('hidden')) $('help-close').click();
      else { ui.hideCard(); anomalies.hooks.cardOpen = null; }
    }
  });
  ui.setCount(anomalies.count, anomalies.found);

  // phones: keep only a handful of dynamic lights
  if (QUALITY.low) {
    const keep = new Set([player.light, ...studio.keepLights]);
    const drop = [];
    scene.traverse((o) => { if (o.isPointLight && !keep.has(o)) drop.push(o); });
    drop.forEach((l) => l.parent.remove(l));
  }

  // ---------- environment reflections: a small synthetic neon "room" (cheap + controlled)
  {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x05060a);
    const panel = (color, k, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
    };
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const col = ['#ff9a3c', '#6af2ff', '#ff4fa3', '#ffd2a0', '#7fa8ff'][i % 5];
      panel(col, 1.2 + (i % 3) * 0.6, Math.cos(a) * 20, 2 + (i % 4) * 3, Math.sin(a) * 20, 3 + (i % 3) * 2, 1 + (i % 2) * 4);
    }
    panel('#2a3450', 0.6, 0, 25, 0, 60, 60);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
  }

  // ---------- resize
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < innerHeight ? 70 : 60;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    fx.setSize(innerWidth, innerHeight);
    if (desk.active) { const p = studio.seatPose(camera); desk.to.pos.copy(p.pos); }
  };
  addEventListener('resize', onResize);
  onResize();

  // ---------- loop
  const clock = new THREE.Clock();
  let t = 0, frames = 0;
  const tmpC = new THREE.Color();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt; frames++;
    input.update();
    player.update(dt, input, t);
    // keep the camera under the studio ceiling
    if (player.mode === 'walk' && player.pos.z < STUDIO.z1 && player.pos.z > STUDIO.z0 && Math.abs(player.pos.x) < STUDIO.x1) {
      camera.position.y = Math.min(camera.position.y, STUDIO.h - 0.4);
      camera.position.z = Math.max(camera.position.z, STUDIO.z0 - 1.5);
      camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
    }
    if (desk.active) {
      desk.t = Math.min(1, desk.t + dt / 1.8);
      const k = desk.t < 0.5 ? 4 * desk.t ** 3 : 1 - Math.pow(-2 * desk.t + 2, 3) / 2;
      camera.position.lerpVectors(desk.from.pos, desk.to.pos, k);
      camera.quaternion.slerpQuaternions(desk.from.quat, desk.to.quat, k);
      if (desk.t >= 1 && studio.state !== 'desk') studio.startTyping();
      if (studio.complete && $('desk-open').classList.contains('hidden')) $('desk-open').classList.remove('hidden');
    }

    // district atmosphere follows the player
    const dT = districtT(player.pos.x);
    const wall = Math.max(0, Math.min(1, (-player.pos.z - 55) / 40));
    scene.fog.color.copy(fogWest).lerp(fogEast, dT).lerp(tmpC.set('#1a1030'), wall * 0.5);
    scene.fog.density = lerp(0.017, 0.011, dT);
    world.sky.u.uBottom.value.copy(scene.fog.color);
    world.sky.u.uTop.value.copy(scene.fog.color).multiplyScalar(0.25);
    world.sky.mesh.position.copy(camera.position);
    hemi.color.set('#7a5a50').lerp(tmpC.set('#5a5aa0'), dT);
    fx.final.uniforms.uTint.value.setRGB(lerp(1.1, 0.94, dT), lerp(0.95, 1.0, dT), lerp(0.82, 1.1, dT));
    world.rain.uTime.value = t; world.rain.uCam.value.copy(camera.position); world.rain.uAmount.value = lerp(0.12, 1, dT);
    world.dust.uTime.value = t; world.dust.uCam.value.copy(camera.position); world.dust.uAmount.value = 1 - dT;
    if (started && frames % 30 === 0) ambience.setRain(dT);

    for (const u of world.updaters) u(t, dt);
    anomalies.musicLevel = jb.level(t);
    anomalies.update(t, dt, player);
    studio.update(t, dt, player);
    jb.update(t, player);

    // interactables
    if (player.mode === 'walk' && started) {
      let best = null, bd = 1e9;
      for (const it of world.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z);
        if (d < it.r && d < bd) { bd = d; best = it; }
      }
      ui.prompt(best ? best.label : null);
      if (input.consumeInteract() && best) best.action();
    } else input.consumeInteract();

    fx.render(t, dt);
    if (started && frames % 2 === 0) ui.drawRadar(player, anomalies.items, (STUDIO.z0 + STUDIO.z1) / 2, anomalies.count >= 3, t);
  }
  frame();

  // ---------- intro
  const enter = $('enter');
  enter.disabled = false; $('enter-label').textContent = 'ENTER THE CITY';
  enter.onclick = () => {
    started = true;
    ambience.start(); syncSound();
    $('intro').classList.add('out');
    setTimeout(() => $('intro').classList.add('hidden'), 900);
    $('hud').classList.remove('hidden');
    fx.glitch(0.8);
    const n = anomalies.count;
    setTimeout(() => ui.toast(n ? `Welcome back. ${n}/9 anomalies found so far.` : 'Nine anomalies are hiding in the city. Look for the light pillars.', 5000), 900);
  };
  window.__shx = { desk, player, anomalies, studio, jb, camera, renderer, scene, world, fx }; // debug handle
}

boot();
