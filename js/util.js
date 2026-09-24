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

// City grid: streets on lines x,z = 20 + 40k, cells centred on multiples of 40.
export const GRID = {
  cell: 40,
  street: 12,
  half: 100,           // playable half-extent (street centreline of the perimeter)
  bound: 104,          // player clamp
  cellCenter: (i) => -80 + 40 * i,
};
