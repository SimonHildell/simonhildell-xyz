import * as THREE from 'three';

// Accumulates boxes with world-scaled UVs into a single BufferGeometry.
export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  quad(p0, p1, p2, p3, n, uvs, color) {
    const b = this.pos.length / 3;
    for (const p of [p0, p1, p2, p3]) this.pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) this.nor.push(n[0], n[1], n[2]);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    const c = color || [1, 1, 1];
    for (let i = 0; i < 4; i++) this.col.push(c[0], c[1], c[2]);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  // Box sitting on y0, centred at (cx, cz). su/sv = metres per texture tile.
  box(cx, y0, cz, w, h, d, { su = 24, sv = 76.8, ou = 0, ov = 0, color, top = true, sides = true, bottom = false, vRange } = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    const V = (y) => vRange ? (vRange[0] + (y - y0) / h * (vRange[1] - vRange[0])) : y / sv + ov;
    if (sides) {
      // +z face
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1],
        [[ou, V(y0)], [ou + w / su, V(y0)], [ou + w / su, V(y1)], [ou, V(y1)]], color);
      // -z face
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1],
        [[ou + 0.37, V(y0)], [ou + 0.37 + w / su, V(y0)], [ou + 0.37 + w / su, V(y1)], [ou + 0.37, V(y1)]], color);
      // +x face
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0],
        [[ou + 0.61, V(y0)], [ou + 0.61 + d / su, V(y0)], [ou + 0.61 + d / su, V(y1)], [ou + 0.61, V(y1)]], color);
      // -x face
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0],
        [[ou + 0.13, V(y0)], [ou + 0.13 + d / su, V(y0)], [ou + 0.13 + d / su, V(y1)], [ou + 0.13, V(y1)]], color);
    }
    const r = [0.001, 0.001];
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [r, r, r, r], color);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [r, r, r, r], color);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Shared hologram-ish shader: fresnel rim + scanlines + flicker.
export function holoMaterial(color, { opacity = 0.35, rim = 1.6, scan = 1, side = THREE.DoubleSide, glitch = 0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uRim: { value: rim },
      uScan: { value: scan },
      uGlitch: { value: glitch },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uGlitch;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec3 p = position;
        float g = step(0.985, fract(sin(floor(uTime*12.0)+p.y*3.0)*43758.5453)) * uGlitch;
        p.x += g * 0.6;
        vec4 w = modelMatrix * vec4(p,1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uRim; uniform float uScan;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float f = pow(clamp(1.0 - abs(dot(normalize(vN + vec3(1e-5)), vV)), 0.0, 1.0), 2.0);
        float s = 0.75 + 0.25 * sin(vW.y * 18.0 - uTime * 6.0) * uScan;
        float fl = 0.9 + 0.1 * sin(uTime * 37.0) * sin(uTime * 13.0);
        float a = (uOpacity + f * uRim) * s * fl;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

export function glowLineMaterial(color, opacity = 0.9) {
  return new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}
