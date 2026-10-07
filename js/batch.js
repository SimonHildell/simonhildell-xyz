import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Static batching: merges every non-moving mesh under `root` that shares an equivalent material
// into one mesh, so dozens of draw calls become a handful. Looks identical.
// `keep` = objects (and their subtrees) that animate and must stay separate.
function matKey(m) {
  if (m.isShaderMaterial || m.clippingPlanes) return m.uuid;
  const c = (x) => (x ? x.getHexString() + (x.r > 1 || x.g > 1 || x.b > 1 ? `:${x.r.toFixed(2)},${x.g.toFixed(2)},${x.b.toFixed(2)}` : '') : '-');
  return [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid, m.emissiveMap?.uuid, m.transparent, m.opacity, m.side, m.blending, m.vertexColors, m.toneMapped, m.wireframe, m.depthWrite].join('|');
}

export function batchStatic(root, keep = []) {
  const skip = new Set();
  for (const k of keep) k.traverse((o) => skip.add(o));
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || skip.has(o) || o.children.length || Array.isArray(o.material)) return;
    if (o.material.userData && o.material.userData.noBatch) return;
    const key = matKey(o.material);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  let saved = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    // all geometries must share the same attribute set
    const attrs = (g) => Object.keys(g.attributes).sort().join(',');
    const base = attrs(list[0].geometry);
    const group = list.filter((o) => attrs(o.geometry) === base && !o.geometry.morphAttributes?.position);
    if (group.length < 2) continue;
    const geos = group.map((o) => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, group[0].material);
    mesh.renderOrder = group[0].renderOrder;
    root.add(mesh);
    for (const o of group) o.parent.remove(o);
    saved += group.length - 1;
  }
  return saved;
}
