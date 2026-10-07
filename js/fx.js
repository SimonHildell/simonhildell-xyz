import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { QUALITY } from './util.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGlitch: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uAspect: { value: 1 },
    uExposure: { value: 1.3 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGlitch; uniform vec3 uTint; uniform float uAspect; uniform float uExposure;
    // three.js ACESFilmic (same curve the OutputPass used) + linear -> sRGB
    vec3 shxRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 shxAces(vec3 color){
      const mat3 shxIn = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 shxOut = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExposure / 0.6; color = shxIn * color; color = shxRRT(color); color = shxOut * color; return clamp(color, 0.0, 1.0);
    }
    vec3 shxSRGB(vec3 c){ return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // glitch: block displacement
      float g = uGlitch;
      if (g > 0.001) {
        float row = floor(uv.y * 24.0);
        float n = h(vec2(row, floor(uTime * 18.0)));
        if (n < g * 0.6) uv.x += (h(vec2(row, uTime)) - 0.5) * 0.12 * g;
        float blk = h(floor(uv * vec2(10.0, 30.0)) + floor(uTime * 12.0));
        if (blk < g * 0.08) uv = fract(uv + vec2(0.1, 0.0));
      }
      vec2 c = uv - 0.5;
      float r = dot(c, c);
      float ca = 0.0018 + r * 0.01 + g * 0.018;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;
      col *= uTint;
      col = shxAces(col);
      // vignette
      col *= 1.0 - smoothstep(0.18, 0.75, r * 1.15);
      // grain + scanlines
      col += (h(uv * 900.0 + uTime) - 0.5) * 0.035;
      col *= 0.97 + 0.03 * sin(vUv.y * 900.0);
      col = mix(col, col * vec3(1.2, 0.6, 1.3), g * 0.35 * step(0.5, h(vec2(floor(uTime*30.0), 1.0))));
      gl_FragColor = vec4(shxSRGB(clamp(col, 0.0, 1.0)), 1.0);
    }`,
};

export function createFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(QUALITY.pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * QUALITY.bloomScale, innerHeight * QUALITY.bloomScale), 0.7, 0.5, 0.82);
  composer.addPass(bloom);
  const final = new ShaderPass(FinalShader);
  composer.addPass(final);
  let glitch = 0;
  let scale = QUALITY.low ? 0.85 : 1, W = innerWidth, Hh = innerHeight;
  const applySize = () => {
    const pr = QUALITY.pixelRatio * scale;
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    renderer.setSize(W, Hh); composer.setSize(W, Hh);
    bloom.setSize(W * pr * QUALITY.bloomScale, Hh * pr * QUALITY.bloomScale);
  };
  return {
    composer, bloom, final,
    get scale() { return scale; },
    setScale(s) { if (Math.abs(s - scale) < 0.01) return; scale = s; applySize(); },
    glitch(amount = 1) { glitch = Math.max(glitch, amount); },
    clearGlitch() { glitch = 0; },
    setSize(w, h) { W = w; Hh = h; applySize(); final.uniforms.uAspect.value = w / h; },
    render(t, dt) {
      glitch = Math.max(0, glitch - dt * 1.3);
      final.uniforms.uTime.value = t;
      final.uniforms.uGlitch.value = glitch;
      composer.render(dt);
    },
  };
}
