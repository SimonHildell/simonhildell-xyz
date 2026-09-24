import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY } from './util.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGlitch: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGlitch; uniform vec3 uTint; uniform float uAspect;
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
      // vignette
      col *= 1.0 - smoothstep(0.18, 0.75, r * 1.15);
      // grain + scanlines
      col += (h(uv * 900.0 + uTime) - 0.5) * 0.035;
      col *= 0.97 + 0.03 * sin(vUv.y * 900.0);
      col = mix(col, col * vec3(1.2, 0.6, 1.3), g * 0.35 * step(0.5, h(vec2(floor(uTime*30.0), 1.0))));
      gl_FragColor = vec4(col, 1.0);
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
  composer.addPass(new OutputPass());
  let glitch = 0;
  return {
    composer, bloom, final,
    glitch(amount = 1) { glitch = Math.max(glitch, amount); },
    clearGlitch() { glitch = 0; },
    setSize(w, h) { composer.setSize(w, h); bloom.setSize(w * QUALITY.bloomScale, h * QUALITY.bloomScale); final.uniforms.uAspect.value = w / h; },
    render(t, dt) {
      glitch = Math.max(0, glitch - dt * 1.3);
      final.uniforms.uTime.value = t;
      final.uniforms.uGlitch.value = glitch;
      composer.render(dt);
    },
  };
}
