import * as THREE from 'three';
import { QUALITY, IS_TOUCH, lerp, storage } from './util.js';
import { buildCity, districtT } from './city.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Anomalies, TOTAL } from './anomalies.js';
import { Studio, STUDIO, DESK_Z } from './studio.js';
import { buildVertical } from './vertical.js';
import { buildOpenBuildings } from './openbuildings.js';
import { FlyCars } from './cars.js';
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
  // ---------- loading screen: real progress, one step per build phase
  const HINTS = [
    'Spinners with a glowing ring can be flown. Walk up and press E.',
    'Some anomalies are up on the skyways. Find the stairs.',
    'The radar shows signals close to you, and the city around you.',
    'Put a song on the jukebox in the central plaza.',
    'Find three anomalies and a beacon lights up over the studio.',
    'One anomaly is not on the ground at all.',
    'The walk-through buildings connect the street to the skyways.',
    'Shift to run. Space to jump. Drag to look around.',
  ];
  let hintI = (Math.random() * HINTS.length) | 0;
  const showHint = () => { $('load-hint').textContent = HINTS[hintI++ % HINTS.length]; };
  showHint();
  const hintTimer = setInterval(showHint, 3800);
  const step = async (label, pct) => {
    $('load-label').textContent = label; $('load-pct').textContent = `${pct}%`; $('load-bar').style.width = `${pct}%`;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  };
  await step('Loading fonts', 4);
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

  const world = { colliders: [], colliderCircles: [], surfaces: [], interactables: [], updaters: [], buildingMeshes: [] };
  await step('Raising the skyways', 12);
  buildVertical(scene, world);
  await step('Opening the buildings', 20);
  buildOpenBuildings(scene, world);
  await step('Building the city', 28);
  buildCity(scene, world, renderer);
  await step('Hiding the anomalies', 62);

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
      if (n === TOTAL - 1) setTimeout(() => ui.toast('One left, and it is not on the ground. Find a spinner and look up.', 7000), 1800);
      if (n === TOTAL) setTimeout(() => celebrate(), 1400);
      studio.setBeacon(n >= 3);
    },
    onLeave() { ui.hideCard(); state.card = null; this.cardOpen = null; },
    cardOpen: null,
  });
  $('card-close').onclick = () => { ui.hideCard(); anomalies.hooks.cardOpen = null; ambience.blip('ui'); };

  // ---------- completion state (all nine found)
  let complete = storage.get('shx-complete', false) && anomalies.count >= TOTAL;
  let clearSky = complete ? 1 : 0;       // 0 = rain, 1 = cleared after completion
  let dawn = complete ? 1 : 0;           // 0 = night, 1 = hazy 2049 morning after completion
  const DAWN = { fog: new THREE.Color('#a8541c'), top: new THREE.Color('#e88a3c'), hemiSky: new THREE.Color('#ffa860'), hemiGround: new THREE.Color('#3a2418'), night: new THREE.Color('#100808'), sun: new THREE.Color('#ffb070'), moon: new THREE.Color('#8fb4ff') };
  let playTime = storage.get('shx-time', 0);

  // open a project from its card (warn if the game isn't finished)
  $('card-link').onclick = () => {
    const d = ui.cardData; if (!d) return;
    ambience.blip('ui');
    if (complete) { window.open(d.link, '_blank', 'noopener'); return; }
    $('leave-go').href = d.link;
    $('leave').classList.remove('hidden'); input.enabled = false;
  };
  const closeLeave = () => { $('leave').classList.add('hidden'); input.enabled = player.mode === 'walk'; };
  $('leave-stay').onclick = closeLeave;
  $('leave-go').addEventListener('click', () => setTimeout(closeLeave, 50));

  // 9/9: the city glitches out, then Simon says hi
  function celebrate() {
    complete = true; storage.set('shx-complete', true);
    anomalies.flareAll();
    document.body.classList.add('shake');
    $('breach').classList.remove('hidden');
    const colors = ['#ff4fa3', '#6af2ff', '#ffb347', '#8dff6a', '#d24dff'];
    [0, 350, 700, 1100, 1500, 1900, 2300, 2700].forEach((ms, i) => setTimeout(() => {
      fx.glitch(2.4 - i * 0.12); ui.flash(colors[i % colors.length]); ambience.blip(i % 2 ? 'ui' : 'find');
    }, ms));
    setTimeout(() => ambience.blip('win'), 400);
    setTimeout(() => {
      document.body.classList.remove('shake'); $('breach').classList.add('hidden');
      const mins = Math.max(1, Math.round(playTime / 60));
      const body = `Hi Simon!\n\nI just found all ten anomalies in your playground city on simonhildell.xyz. It took me about ${mins} minute${mins === 1 ? '' : 's'}.\n\nMy favourite one was: \n\n`;
      $('complete-mail').href = `mailto:simon@hildell.com?subject=${encodeURIComponent('I found all ten anomalies')}&body=${encodeURIComponent(body)}`;
      $('complete').classList.remove('hidden'); input.enabled = false; ui.hideCard();
      ui.setCount(TOTAL, anomalies.found);
    }, 3300);
  }
  const closeComplete = () => { $('complete').classList.add('hidden'); input.enabled = player.mode === 'walk'; };
  $('complete-stay').onclick = () => { closeComplete(); ui.toast('The rain has stopped. Enjoy the city.', 4000); };
  $('complete-mail').addEventListener('click', () => setTimeout(closeComplete, 50));

  function playAgain() {
    anomalies.reset();
    complete = false; storage.set('shx-complete', false);
    playTime = 0; storage.set('shx-time', 0);
    ui.setCount(0, anomalies.found); ui.hideCard(); anomalies.hooks.cardOpen = null;
    studio.setBeacon(false);
    ['complete', 'help', 'leave'].forEach((id) => $(id).classList.add('hidden'));
    if (desk.active) exitDesk();
    input.enabled = true;
    fx.glitch(1.5); ambience.blip('find');
    ui.toast('The anomalies are back. So is the rain.', 4500);
  }
  $('complete-again').onclick = () => playAgain();

  const input = new Input(canvas);
  await step('Parking the spinners', 72);
  const player = new Player(scene, camera, world);

  // ---------- flyable spinners
  const cars = new FlyCars(scene, world, camera, player, {
    onEnter: () => {
      player.mode = 'fly'; player.fig.visible = false; player.shadow.visible = false; player.light.visible = false;
      document.body.classList.add('flying'); $('fly-ui').classList.remove('hidden'); $('fly-hint').classList.remove('hidden');
      ui.hideCard(); anomalies.hooks.cardOpen = null; ambience.blip('ui'); ambience.engine(true); fx.glitch(0.4);
      setTimeout(() => $('fly-hint').classList.add('hidden'), 9000);
    },
    onExit: () => {
      player.mode = 'walk'; player.fig.visible = true; player.shadow.visible = true; player.light.visible = true;
      player.yaw = cars.cars.length ? player.yaw : 0; player.curDist = 3;
      document.body.classList.remove('flying'); $('fly-ui').classList.add('hidden'); $('fly-hint').classList.add('hidden');
      ambience.engine(false); ui.prompt(null); input.consumeJump();
    },
    onBump: () => { fx.glitch(0.25); },
  });
  const hold = (id, key) => {
    const el = $(id);
    const on = (e) => { e.preventDefault(); input[key] = true; }, off = (e) => { e.preventDefault(); input[key] = false; };
    el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
    el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
  };
  hold('fly-up', 'flyUp'); hold('fly-down', 'flyDown');

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
    player.pos.set(0, STUDIO.y, DESK_Z - 3.4); player.yaw = Math.PI; player.pitch = 0.2; player.curDist = 2;
    $('desk-ui').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('desk-insta').classList.add('hidden'); $('desk-again').classList.add('hidden');
  }
  $('desk-back').onclick = exitDesk;
  $('desk-again').onclick = () => playAgain();
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
  $('help-reset').onclick = () => playAgain();
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

  // ---------- light pool: the scene has ~14 point lights, but only the nearest few are ever visible.
  // Every lit pixel pays for every light, so we keep a small fixed pool and move it to the closest sources.
  const lightSources = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isPointLight && o !== player.light) lightSources.push(o); });
  const srcData = lightSources.map((l) => {
    const p = new THREE.Vector3(); l.getWorldPosition(p);
    l.parent.remove(l);
    return { p, color: l.color.clone(), intensity: l.intensity, distance: l.distance, decay: l.decay };
  });
  const POOL = QUALITY.low ? 2 : 5;
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.5); scene.add(l); l.userData.src = null; return l; });
  function updateLightPool(dt) {
    const c = camera.position;
    if (frames % 6 === 0) {
      const ranked = srcData.map((d) => ({ d, k: d.p.distanceToSquared(c) - d.distance * d.distance })).sort((a, b) => a.k - b.k).slice(0, POOL).map((r) => r.d);
      // keep lights that are still wanted in their slot, give free slots to newcomers
      const free = pool.filter((l) => !ranked.includes(l.userData.src));
      for (const d of ranked) {
        if (pool.some((l) => l.userData.src === d)) continue;
        const l = free.shift(); if (!l) break;
        l.userData.src = d; l.position.copy(d.p); l.color.copy(d.color); l.distance = d.distance; l.decay = d.decay; l.intensity = 0;
      }
      for (const l of free) l.userData.src = null;
    }
    for (const l of pool) {
      const target = l.userData.src ? l.userData.src.intensity : 0;
      l.intensity += (target - l.intensity) * Math.min(1, dt * 6);
    }
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
    await step('Lighting the neon', 82);
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

  // ---------- compile every shader up front (no hitch the first time something comes into view)
  {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    await step('Warming up the shaders', 88);
    try {
      if (renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 8000))]);
      else renderer.compile(scene, camera);
    } catch { /* ignore */ }
    hidden.forEach((o) => (o.visible = false));
  }

  // ---------- adaptive resolution: hold the frame rate on any machine by rendering fewer pixels when needed
  const perf = { acc: 0, n: 0, good: 0, warm: 0, lite: false, last: 0, lastUp: -99, ceiling: QUALITY.maxPixelRatio / QUALITY.pixelRatio, clock: 0 };
  const heavy = [];
  scene.traverse((o) => { if (o.userData && o.userData.heavy) heavy.push(o); });
  // Resizing render targets costs a hitch, so changes are rare, coarse and never ping-pong.
  function adapt(raw) {
    if (!started || document.hidden || raw > 2.5) return;
    perf.clock += raw;
    perf.warm += raw; if (perf.warm < 2) return;
    perf.acc += raw; perf.n++;
    if (perf.acc < 0.75) return;
    const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
    const since = perf.clock - perf.last;
    if (avg > 1 / 50) {
      perf.good = 0;
      if (since < 1.5) return;
      if (perf.clock - perf.lastUp < 8) perf.ceiling = Math.min(perf.ceiling, fx.scale * 0.95); // just went up and it was too much
      if (fx.scale > 0.56) { fx.setScale(Math.max(0.55, fx.scale * (avg > 1 / 30 ? 0.75 : 0.87))); perf.last = perf.clock; }
      else if (!perf.lite && avg > 1 / 38) {
        perf.lite = true; heavy.forEach((o) => (o.visible = false));
        scene.traverse((o) => { if (o.userData.halfInLite && o.geometry) o.geometry.setDrawRange(0, Math.floor(o.geometry.attributes.position.count / 4) * 2); });
      }
    } else if (avg < 1 / 58) {
      perf.good += 0.75;
      if (perf.good >= 4 && fx.scale < perf.ceiling - 0.01 && since > 3) {
        fx.setScale(Math.min(perf.ceiling, fx.scale * 1.12)); perf.good = 0; perf.last = perf.lastUp = perf.clock;
      }
    }
  }

  // ---------- loop
  const clock = new THREE.Clock();
  let t = 0, frames = 0;
  const tmpC = new THREE.Color();
  const camDir = new THREE.Vector3();
  ui.buildMap(world);
  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    adapt(raw);
    t += dt; frames++;
    input.update();
    if (player.mode === 'fly') { cars.update(dt, input, t, ui); ambience.engine(true, cars.speed || 0); }
    else { player.update(dt, input, t); cars.update(dt, input, t, ui); }
    // keep the camera under the studio ceiling
    if (player.mode === 'walk' && player.pos.z < STUDIO.z1 && player.pos.z > STUDIO.z0 && Math.abs(player.pos.x) < STUDIO.x1) {
      camera.position.y = Math.min(camera.position.y, STUDIO.h + STUDIO.y - 0.4);
      camera.position.z = Math.max(camera.position.z, STUDIO.z0 - 1.5);
      camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
    }
    if (desk.active) {
      desk.t = Math.min(1, desk.t + dt / 1.8);
      const k = desk.t < 0.5 ? 4 * desk.t ** 3 : 1 - Math.pow(-2 * desk.t + 2, 3) / 2;
      camera.position.lerpVectors(desk.from.pos, desk.to.pos, k);
      camera.quaternion.slerpQuaternions(desk.from.quat, desk.to.quat, k);
      if (desk.t >= 1 && studio.state !== 'desk') studio.startTyping();
      if (studio.complete && $('desk-open').classList.contains('hidden')) {
        $('desk-open').classList.remove('hidden'); $('desk-insta').classList.remove('hidden');
        $('desk-again').classList.toggle('hidden', !complete);
      }
    }

    // district atmosphere follows the player
    const dT = districtT(player.pos.x);
    const wall = Math.max(0, Math.min(1, (-player.pos.z - 55) / 40));
    scene.fog.color.copy(fogWest).lerp(fogEast, dT).lerp(tmpC.set('#1a1030'), wall * 0.5);
    clearSky += ((complete ? 1 : 0) - clearSky) * Math.min(1, dt * 0.35);
    const wet = 1 - clearSky;
    scene.fog.density = lerp(0.017, 0.011, dT) * (1 - 0.35 * clearSky);
    // night -> dawn after completion (slow, about a minute)
    dawn += ((complete ? 1 : 0) - dawn) * Math.min(1, dt * (complete ? 0.03 : 0.5));
    const dw = dawn * dawn * (3 - 2 * dawn);
    if (dw > 0.001) { scene.fog.color.lerp(DAWN.fog, dw * 0.92); scene.fog.density *= 1 + 0.15 * dw; }
    world.sky.u.uBottom.value.copy(scene.fog.color);
    world.sky.u.uTop.value.copy(scene.fog.color).multiplyScalar(0.25).lerp(DAWN.top, dw * 0.8);
    hemi.intensity = 0.9 + 0.55 * dw;
    hemi.groundColor.copy(DAWN.night).lerp(DAWN.hemiGround, dw);
    moon.color.copy(DAWN.moon).lerp(DAWN.sun, dw); moon.intensity = 0.35 + 0.9 * dw;
    moon.position.set(lerp(-40, 90, dw), lerp(80, 28, dw), lerp(30, -60, dw));
    if (Math.abs(dw - (world._dw ?? -1)) > 0.004) { world._dw = dw; for (const m of world.buildingMeshes) m.material.emissiveIntensity = 1.35 - 0.8 * dw; }
    fx.final.uniforms.uExposure.value = 1.3 - 0.12 * dw;
    world.sky.mesh.position.copy(camera.position);
    hemi.color.set('#7a5a50').lerp(tmpC.set('#5a5aa0'), dT).lerp(DAWN.hemiSky, dw);
    fx.final.uniforms.uTint.value.setRGB(lerp(lerp(1.1, 0.94, dT), 1.2, dw), lerp(lerp(0.95, 1.0, dT), 0.95, dw), lerp(lerp(0.82, 1.1, dT), 0.72, dw));
    world.rain.uTime.value = t; world.rain.uCam.value.copy(camera.position); world.rain.uAmount.value = lerp(0.12, 1, dT) * wet;
    world.dust.uTime.value = t; world.dust.uCam.value.copy(camera.position); world.dust.uAmount.value = (1 - dT) * (0.35 + 0.65 * wet);
    world.ripples.uTime.value = t; world.ripples.uCam.value.copy(camera.position); world.ripples.uAmount.value = lerp(0.2, 1, dT) * wet;
    if (started && frames % 30 === 0) ambience.setRain(dT * wet, wet);
    if (started && player.mode === 'walk') { playTime += dt; if (frames % 300 === 0) storage.set('shx-time', Math.round(playTime)); }

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
        const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z) + (Math.abs(player.pos.y - (it.y ?? 0.15)) > 2 ? 99 : 0);
        if (d < it.r && d < bd) { bd = d; best = it; }
      }
      ui.prompt(best ? best.label : null);
      if (input.consumeInteract() && best) best.action();
    } else input.consumeInteract();

    updateLightPool(dt);
    fx.render(t, dt);
    if (started && frames % 2 === 0) {
      camera.getWorldDirection(camDir);
      ui.drawRadar(player, anomalies.items, (STUDIO.z0 + STUDIO.z1) / 2, anomalies.count >= 3, t, { yaw: Math.atan2(-camDir.x, -camDir.z), flying: player.mode === 'fly', cars: cars.cars, activeCar: cars.active });
    }
  }
  frame();

  // ---------- intro
  const enter = $('enter');
  await step('Ready', 100);
  clearInterval(hintTimer);
  $('loader').classList.add('done');
  enter.disabled = false; $('enter-label').textContent = 'ENTER THE CITY';
  enter.onclick = () => {
    started = true;
    ambience.start(); syncSound();
    $('intro').classList.add('out');
    setTimeout(() => $('intro').classList.add('hidden'), 900);
    $('hud').classList.remove('hidden');
    fx.glitch(0.8);
    const n = anomalies.count;
    setTimeout(() => ui.toast(complete ? 'Welcome back. You found all ten, and the night is over.' : n ? `Welcome back. ${n}/${TOTAL} anomalies found so far.` : 'Ten anomalies are hiding in the city. Some of them are up on the skyways.', 5000), 900);
  };
  window.__shx = { setDawn: (v) => { dawn = v; clearSky = v; complete = v > 0; }, perf, pool, cars, celebrate, playAgain, desk, player, anomalies, studio, jb, camera, renderer, scene, world, fx }; // debug handle
}

boot();
