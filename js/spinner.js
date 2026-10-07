import * as THREE from 'three';
import { GeoBuilder } from './geo.js';

// Spinner (flying car) geometry, shared by sky traffic, street traffic and the flyable cars.
// body: lit metal (vertex colours = paint), lights: unlit emissive parts. Car faces +z.
let cache = null;
export function spinnerGeometries() {
  if (cache) return cache;
  const b = new GeoBuilder();
  const paint = [0.16, 0.17, 0.2], dark = [0.06, 0.06, 0.07], glass = [0.08, 0.12, 0.16];
  b.box(0, -0.75, 0.2, 2.1, 0.55, 4.6, { color: paint });          // lower hull
  b.box(0, -0.75, 2.75, 1.7, 0.4, 0.7, { color: paint });          // nose
  b.box(0, -0.2, -0.3, 1.9, 0.45, 3.4, { color: paint });          // shoulder
  b.box(0, 0.25, -0.35, 1.6, 0.6, 2.2, { color: glass });          // canopy
  b.box(0, 0.85, -0.45, 1.5, 0.08, 1.9, { color: paint });         // roof
  b.box(-1.25, -0.95, 0.1, 0.45, 0.5, 3.8, { color: dark });       // side pods
  b.box(1.25, -0.95, 0.1, 0.45, 0.5, 3.8, { color: dark });
  b.box(0, -0.25, -2.35, 2.3, 0.18, 0.5, { color: dark });         // rear spoiler
  b.box(-0.9, -0.25, -2.25, 0.1, 0.55, 0.4, { color: dark });
  b.box(0.9, -0.25, -2.25, 0.1, 0.55, 0.4, { color: dark });
  const body = b.build();

  const l = new GeoBuilder();
  l.box(-0.6, -0.6, 3.11, 0.42, 0.14, 0.04, { color: [3.2, 3.2, 2.8] });   // headlights
  l.box(0.6, -0.6, 3.11, 0.42, 0.14, 0.04, { color: [3.2, 3.2, 2.8] });
  l.box(0, -0.25, -2.62, 2.1, 0.08, 0.04, { color: [3.2, 0.12, 0.08] });   // tail bar
  l.box(-1.25, -1.21, 0.1, 0.3, 0.04, 3.4, { color: [0.3, 1.0, 2.4] });     // under-glow
  l.box(1.25, -1.21, 0.1, 0.3, 0.04, 3.4, { color: [0.3, 1.0, 2.4] });
  l.box(0, 0.3, 0.77, 1.4, 0.05, 0.03, { color: [0.4, 1.4, 2.0] });         // dash strip
  const lights = l.build();

  // a soft forward headlight beam (additive), pointing along +z
  const beam = new THREE.CylinderGeometry(0.25, 2.6, 16, 12, 1, true);
  beam.rotateX(Math.PI / 2); beam.translate(0, -0.65, 3.1 + 8);
  const bar = new THREE.BoxGeometry(0.9, 0.12, 0.25); bar.translate(0, 0.95, -0.45);
  cache = { body, lights, beam, bar };
  return cache;
}

export const spinnerBodyMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.4 });
export const spinnerLightMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export const beamMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = clamp((position.z - 3.1) / 16.0, 0.0, 1.0);
    mat4 M = modelMatrix;
    #ifdef USE_INSTANCING
      M = modelMatrix * instanceMatrix;
    #endif
    vec4 w = M * vec4(position, 1.0);
    vN = normalize(mat3(M) * normal); vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(normalize(vN), vV)), 1.5);
    float a = (1.0 - vD) * (1.0 - vD) * 0.10 * edge; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, a); }`,
});
