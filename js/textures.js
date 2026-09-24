import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}

// Facade window textures. One tile = 32 m wide x 102.4 m tall (16 x 32 cells).
export function windowTexture(kind, seed) {
  const rnd = mulberry32(seed);
  const W = 512, H = 1024, cols = 16, rows = 32;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#040508';
  g.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  const warm = ['#ffcf8a', '#ffb45e', '#ffe3b8', '#fff2d6'];
  const cool = ['#9fe8ff', '#7fc8ff', '#c8f4ff'];
  const neon = ['#ff5fd2', '#6affff', '#ff9a3c'];
  for (let r = 0; r < rows; r++) {
    const floorLit = rnd() < (kind === 2 ? 0.25 : 0.7);
    for (let q = 0; q < cols; q++) {
      let p = kind === 0 ? 0.42 : kind === 1 ? 0.3 : 0.12;
      if (!floorLit) p *= 0.25;
      if (rnd() > p) {
        // unlit window, faint glass
        g.fillStyle = 'rgba(40,50,70,0.35)';
        if (kind === 0) g.fillRect(q * cw + 2, r * ch + 8, cw - 4, ch - 14);
        else g.fillRect(q * cw + 7, r * ch + 7, cw - 14, ch - 14);
        continue;
      }
      const pal = rnd() < 0.72 ? warm : rnd() < 0.8 ? cool : neon;
      g.fillStyle = pal[(rnd() * pal.length) | 0];
      g.globalAlpha = 0.35 + rnd() * 0.65;
      if (kind === 0) {
        // office strip glazing
        g.fillRect(q * cw + 1, r * ch + 8, cw - 2, ch - 14);
      } else if (kind === 1) {
        g.fillRect(q * cw + 7, r * ch + 7, cw - 14, ch - 14);
        // curtain / silhouette
        if (rnd() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(q * cw + 7, r * ch + 7, (cw - 14) * rnd(), ch - 14); }
      } else {
        // megablock: narrow vertical slits
        g.fillRect(q * cw + cw * 0.42, r * ch + 3, cw * 0.16, ch - 6);
      }
      g.globalAlpha = 1;
    }
  }
  // vertical accent strips on megablocks
  if (kind === 2) {
    for (let i = 0; i < 3; i++) {
      const x = (rnd() * cols | 0) * cw + cw / 2 - 2;
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(255,120,60,0)');
      grd.addColorStop(0.5, 'rgba(255,120,60,0.9)');
      grd.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = grd; g.fillRect(x, 0, 4, H);
    }
  }
  // keep (0,0) corner black for roofs
  g.fillStyle = '#040508'; g.fillRect(0, 0, 6, 6);
  return tex(c, { repeat: true, aniso: 8 });
}

// Ground tile: 40 m x 40 m, roads cross through the tile centre.
export function groundTextures() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const [rc, rg] = canvas(S, S); // roughness (G channel)
  const rnd = mulberry32(7);
  const m = S / 40; // px per metre
  // base paving
  g.fillStyle = '#0d0f14'; g.fillRect(0, 0, S, S);
  // paving slabs on blocks
  g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i += 2) {
    g.beginPath(); g.moveTo(i * m, 0); g.lineTo(i * m, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * m); g.lineTo(S, i * m); g.stroke();
  }
  const r0 = (20 - 6) * m, r1 = (20 + 6) * m;
  // sidewalks
  g.fillStyle = '#15171d';
  g.fillRect(r0 - 2.5 * m, 0, r1 - r0 + 5 * m, S);
  g.fillRect(0, r0 - 2.5 * m, S, r1 - r0 + 5 * m);
  // asphalt
  g.fillStyle = '#07080b';
  g.fillRect(r0, 0, r1 - r0, S);
  g.fillRect(0, r0, S, r1 - r0);
  // curbs
  g.fillStyle = '#2a2c33';
  [r0, r1].forEach((x) => { g.fillRect(x - 3, 0, 6, S); g.fillRect(0, x - 3, S, 6); });
  g.fillStyle = '#07080b';
  g.fillRect(r0, r0, r1 - r0, r1 - r0);
  // lane dashes
  g.fillStyle = 'rgba(255,190,90,0.55)';
  for (let y = 0; y < S; y += 3 * m) {
    if (y > r0 - m && y < r1 + m) continue;
    g.fillRect(S / 2 - 3, y, 6, 1.5 * m);
    g.fillRect(y, S / 2 - 3, 1.5 * m, 6);
  }
  // crosswalk stripes
  g.fillStyle = 'rgba(220,230,255,0.28)';
  for (let k = 0; k < 10; k++) {
    const o = r0 + (k + 0.5) * ((r1 - r0) / 10);
    g.fillRect(o - 8, r0 - 3.2 * m, 16, 2.4 * m);
    g.fillRect(o - 8, r1 + 0.8 * m, 16, 2.4 * m);
    g.fillRect(r0 - 3.2 * m, o - 8, 2.4 * m, 16);
    g.fillRect(r1 + 0.8 * m, o - 8, 2.4 * m, 16);
  }
  // grime
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`;
    g.fillRect(rnd() * S, rnd() * S, rnd() * 20, rnd() * 20);
  }
  // roughness: mostly rough, puddles smooth
  rg.fillStyle = 'rgb(0,150,0)'; rg.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 110;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,10,0,1)');
    grd.addColorStop(0.7, 'rgba(0,30,0,0.8)');
    grd.addColorStop(1, 'rgba(0,150,0,0)');
    rg.fillStyle = grd;
    rg.beginPath(); rg.ellipse(x, y, r, r * (0.4 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); rg.fill();
  }
  // road is wetter overall
  rg.fillStyle = 'rgba(0,60,0,0.6)';
  rg.fillRect(r0, 0, r1 - r0, S); rg.fillRect(0, r0, S, r1 - r0);
  const map = tex(c, { repeat: true, aniso: 8 });
  const rough = tex(rc, { repeat: true, srgb: false, aniso: 8 });
  return { map, rough };
}

// Neon sign with glowing text
export function signTexture(text, color, { vertical = false, font = '"Share Tech Mono", monospace', bg = 'rgba(5,5,10,0.85)', size = 110 } = {}) {
  const chars = [...text];
  const W = vertical ? 160 : Math.max(256, chars.length * size * 0.66 + 80);
  const H = vertical ? chars.length * size + 60 : 180;
  const [c, g] = canvas(Math.ceil(W), Math.ceil(H));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 16;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#fff';
  g.font = `bold ${size}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowBlur = 24;
  if (vertical) chars.forEach((ch, i) => g.fillText(ch, W / 2, 30 + size * (i + 0.5)));
  else g.fillText(text, W / 2, H / 2 + 4);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color; g.globalAlpha = 0.55; g.fillRect(0, 0, W, H);
  const t = tex(c);
  t.userData = { aspect: W / H };
  return t;
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, g] = canvas(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return tex(c);
}

// Billboard content texture (big adverts)
export function billboardTexture(lines, colorA, colorB, seed = 1) {
  const rnd = mulberry32(seed);
  const W = 512, H = 896;
  const [c, g] = canvas(W, H);
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, colorA); grd.addColorStop(1, colorB);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.25;
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = '#fff'; g.lineWidth = 1 + rnd() * 3;
    g.beginPath(); g.arc(W / 2, H * 0.4, 30 + i * 22, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.shadowColor = '#fff'; g.shadowBlur = 20;
  lines.forEach((l, i) => {
    g.font = `bold ${i === 0 ? 96 : 44}px "Share Tech Mono", monospace`;
    g.fillText(l, W / 2, H * 0.72 + i * 70);
  });
  return tex(c);
}
