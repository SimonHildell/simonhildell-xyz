import { ANOMALY_DATA } from './anomalies.js';

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
    if (n >= 9) obj.textContent = 'Every anomaly found. The workstation awaits.';
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
    $('card-n').textContent = `${n}/9`;
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

  // radar: rotates with the camera; shows unfound anomalies within range + studio beacon
  drawRadar(player, items, studio, beaconOn, t) {
    const g = this.rg, S = 280, R = S / 2 - 6, range = 75;
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2);
    g.fillStyle = 'rgba(6,10,18,0.72)'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(106,242,255,0.35)'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(106,242,255,0.12)';
    [0.33, 0.66].forEach((k) => { g.beginPath(); g.arc(0, 0, R * k, 0, Math.PI * 2); g.stroke(); });
    // sweep
    const sw = (t * 1.4) % (Math.PI * 2);
    const grd = g.createConicGradient ? g.createConicGradient(sw, 0, 0) : null;
    if (grd) { grd.addColorStop(0, 'rgba(106,242,255,0.25)'); grd.addColorStop(0.12, 'rgba(106,242,255,0)'); grd.addColorStop(1, 'rgba(106,242,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
    const yaw = player.yaw;
    const toRadar = (x, z) => {
      const dx = x - player.pos.x, dz = z - player.pos.z;
      // rotate so camera-forward points up
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      return [rx / range * R, rz / range * R];
    };
    const edge = (px, py, col) => {
      const l = Math.hypot(px, py);
      if (l > R - 10) { px *= (R - 12) / l; py *= (R - 12) / l; }
      return [px, py];
    };
    for (const it of items) {
      let [px, py] = toRadar(it.g.position.x, it.g.position.z);
      const far = Math.hypot(px, py) > R - 10;
      if (it.found) {
        if (far) continue;
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(px - 3, py - 3, 6, 6);
      } else {
        if (Math.hypot(it.g.position.x - player.pos.x, it.g.position.z - player.pos.z) > range * 1.25) continue;
        [px, py] = edge(px, py);
        const a = 0.5 + 0.5 * Math.sin(t * 5 + it.g.position.x);
        g.globalAlpha = 0.45 + a * 0.55;
        g.fillStyle = it.d.color; g.shadowColor = it.d.color; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(px, py - 8); g.lineTo(px + 7, py); g.lineTo(px, py + 8); g.lineTo(px - 7, py); g.closePath(); g.fill();
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
    // player arrow
    g.save(); g.translate(S / 2, S / 2);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
    g.restore();
  }
}
