import { ANOMALY_DATA, TOTAL } from './anomalies.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.pips = $('pips');
    ANOMALY_DATA.forEach((d) => { const i = document.createElement('i'); i.dataset.id = d.id; i.style.setProperty('--c', d.color); this.pips.appendChild(i); });
    this.radar = $('radar'); this.rg = this.radar.getContext('2d');
    this.toastTimer = null;
  }

  setCount(n, foundSet) {
    $('count').textContent = n;
    [...this.pips.children].forEach((p) => p.classList.toggle('on', foundSet.has(p.dataset.id)));
    const obj = $('objective');
    if (n >= TOTAL) obj.textContent = 'Every anomaly found. Watch the sky.';
    else if (n === TOTAL - 1) obj.textContent = 'One left. It is not on the ground.';
    else if (n >= 3) obj.textContent = 'A beacon burns over the studio by the Sea Wall.';
    else obj.textContent = 'Explore. Find the glitches.';
  }

  bump() { const c = $('counter'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }

  flash(color) {
    document.body.style.setProperty('--flash', color + '66');
    document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash');
  }

  showCard(d, n) {
    const card = $('card');
    card.style.setProperty('--c', d.color);
    $('card-n').textContent = `${n}/${TOTAL}`;
    $('card-title').textContent = d.title;
    $('card-tag').textContent = d.tag;
    $('card-text').textContent = d.text;
    $('card-credit').textContent = d.credit || '';
    const wrap = $('card-img-wrap'), img = $('card-img');
    if (d.img) {
      wrap.classList.remove('hidden');
      img.onerror = () => { if (d.imgRemote && img.src !== d.imgRemote) img.src = d.imgRemote; else wrap.classList.add('hidden'); };
      img.src = d.img; img.alt = d.title;
    } else wrap.classList.add('hidden');
    $('card-link').textContent = d.linkNote ? 'OPEN SIMONHILDELL.COM ↗' : 'OPEN THE PROJECT ↗';
    $('card-note').textContent = d.linkNote || '';
    this.cardData = d;
    card.classList.remove('hidden');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  }
  hideCard() { $('card').classList.add('hidden'); }

  prompt(label) {
    const p = $('prompt'), a = $('act-btn');
    if (!label) { p.classList.add('hidden'); a.classList.add('hidden'); this._pl = null; return; }
    if (this._pl === label) return;
    this._pl = label;
    $('prompt-text').textContent = label;
    p.classList.remove('hidden');
    if (document.body.classList.contains('touch')) { a.classList.remove('hidden'); a.textContent = label.toUpperCase(); p.classList.add('hidden'); }
  }

  toast(msg, ms = 4200) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  nowPlaying(track) {
    const n = $('nowplaying');
    if (!track) { n.classList.add('hidden'); return; }
    $('np-text').textContent = `${track[1]} · ${track[2]}`;
    n.classList.remove('hidden');
  }

  // static top-down map of the whole city, drawn once; the radar shows a rotating window into it
  buildMap(world) {
    const N = 1024, E = 100, k = N / (2 * E);
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    const R = (x0, x1, z0, z1, fill) => { g.fillStyle = fill; g.fillRect((x0 + E) * k, (z0 + E) * k, (x1 - x0) * k, (z1 - z0) * k); };
    g.fillStyle = '#05070c'; g.fillRect(0, 0, N, N);
    for (const s of world.surfaces) if (s.kerb) R(s.x0, s.x1, s.z0, s.z1, '#101520');
    for (const c2 of world.colliders) if (!c2.rail && (c2.h ?? 999) > 50) R(c2.x0, c2.x1, c2.z0, c2.z1, '#273042');
    for (const s of world.surfaces) {
      if (s.kerb) continue;
      const y = s.axis ? Math.max(s.ya, s.yb) : s.y;
      const col = s.ramp ? 'rgba(255,190,90,0.75)' : y > 30 ? 'rgba(255,110,60,0.6)' : y > 15 ? 'rgba(180,140,255,0.55)' : y > 9 ? 'rgba(255,79,163,0.45)' : 'rgba(106,242,255,0.38)';
      R(s.x0, s.x1, s.z0, s.z1, col);
    }
    this.map = c; this.mapE = E;
  }

  // radar: rotates with the camera; city map underneath, nearby signals, spinners, studio beacon
  drawRadar(player, items, studio, beaconOn, t, opts = {}) {
    const g = this.rg, S = 280, R = S / 2 - 6;
    const range = opts.flying ? 120 : 60;
    const yaw = opts.yaw ?? player.yaw;
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2);
    g.fillStyle = 'rgba(6,10,18,0.85)'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
    if (this.map) {
      g.save();
      const k = R / range;
      g.rotate(yaw); g.scale(k, k); g.translate(-player.pos.x, -player.pos.z);
      g.globalAlpha = 0.95;
      g.drawImage(this.map, -this.mapE, -this.mapE, this.mapE * 2, this.mapE * 2);
      g.globalAlpha = 1;
      g.restore();
    }
    g.strokeStyle = 'rgba(106,242,255,0.12)'; g.lineWidth = 1.5;
    [0.5].forEach((q) => { g.beginPath(); g.arc(0, 0, R * q, 0, Math.PI * 2); g.stroke(); });
    const sw = (t * 1.4) % (Math.PI * 2);
    const grd = g.createConicGradient ? g.createConicGradient(sw, 0, 0) : null;
    if (grd) { grd.addColorStop(0, 'rgba(106,242,255,0.22)'); grd.addColorStop(0.12, 'rgba(106,242,255,0)'); grd.addColorStop(1, 'rgba(106,242,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); }
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const toRadar = (x, z) => {
      const dx = x - player.pos.x, dz = z - player.pos.z;
      return [(dx * c - dz * s) / range * R, (dx * s + dz * c) / range * R];
    };
    const edge = (px, py) => {
      const l = Math.hypot(px, py);
      if (l > R - 10) { px *= (R - 12) / l; py *= (R - 12) / l; }
      return [px, py];
    };
    // parked spinners
    for (const car of opts.cars || []) {
      if (car === opts.activeCar) continue;
      const [px, py] = toRadar(car.pos.x, car.pos.z);
      if (Math.hypot(px, py) > R - 8) continue;
      g.strokeStyle = '#6af2ff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke();
    }
    for (const it of items) {
      let [px, py] = toRadar(it.g.position.x, it.g.position.z);
      const far = Math.hypot(px, py) > R - 10;
      if (it.found) {
        if (far) continue;
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px - 3, py - 3, 6, 6);
      } else {
        if (Math.hypot(it.g.position.x - player.pos.x, it.g.position.z - player.pos.z) > 90) continue;
        [px, py] = edge(px, py);
        const a = 0.5 + 0.5 * Math.sin(t * 5 + it.g.position.x);
        g.globalAlpha = 0.45 + a * 0.55;
        g.fillStyle = it.d.color; g.shadowColor = it.d.color; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(px, py - 8); g.lineTo(px + 7, py); g.lineTo(px, py + 8); g.lineTo(px - 7, py); g.closePath(); g.fill();
        if (it.d.sky) { g.strokeStyle = it.d.color; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py - 12); g.lineTo(px, py - 20); g.stroke(); }
        g.shadowBlur = 0; g.globalAlpha = 1;
      }
    }
    if (beaconOn) {
      let [px, py] = toRadar(0, studio);
      [px, py] = edge(px, py);
      g.strokeStyle = '#6af2ff'; g.lineWidth = 3; g.shadowColor = '#6af2ff'; g.shadowBlur = 14;
      g.beginPath(); g.arc(px, py, 9 + Math.sin(t * 4) * 2, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#6af2ff'; g.fillRect(px - 3, py - 3, 6, 6); g.shadowBlur = 0;
    }
    g.restore();
    g.save(); g.translate(S / 2, S / 2);
    g.strokeStyle = 'rgba(106,242,255,0.45)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
    // level readout
    const y = player.pos.y;
    const lvl = opts.flying ? `SKY ${Math.round(y)} M` : y > 30 ? 'SKY PLATFORM' : y > 15 ? 'ROOF 18 M' : y > 9 ? 'LEVEL 2 · 12 M' : y > 3 ? 'LEVEL 1 · 6 M' : 'STREET';
    g.font = 'bold 20px "Share Tech Mono", monospace'; g.textAlign = 'center';
    g.fillStyle = 'rgba(6,10,18,0.8)'; g.fillRect(-70, R - 34, 140, 26);
    g.fillStyle = '#6af2ff'; g.fillText(lvl, 0, R - 14);
    g.restore();
  }
}
