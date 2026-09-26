// Small shared helpers
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const IS_TOUCH =
  (typeof window !== 'undefined') &&
  (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

export const QUALITY = (() => {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const low = IS_TOUCH || small;
  return {
    low,
    pixelRatio: Math.min(window.devicePixelRatio || 1, low ? 1.3 : 1.75),
    rain: low ? 2600 : 7000,
    spinners: low ? 18 : 40,
    bloomScale: low ? 0.5 : 0.75,
  };
})();

export const storage = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// City grid: streets on lines x,z = 17 + 34k, cells centred on multiples of 34.
export const GRID = {
  cell: 34,
  road: 3.5,           // half road width
  slab: 13.5,          // half size of the raised sidewalk/block slab
  block: 11.5,         // half size of the buildable block
  half: 85,            // perimeter street centreline
  bound: 88,           // player clamp
  kerb: 0.15,          // sidewalk height
  cellCenter: (i) => -68 + 34 * i,
};

// Walkable surfaces: flat {x0,x1,z0,z1,y} or ramps {..., axis:'x'|'z', a, b, ya, yb}
export function surfaceHeight(s, x, z) {
  if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return -Infinity;
  if (s.axis == null) return s.y;
  const v = s.axis === 'z' ? z : x;
  const t = clamp((v - s.a) / (s.b - s.a), 0, 1);
  return s.ya + (s.yb - s.ya) * t;
}
