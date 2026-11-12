import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * The landing's ice bricks and rocks (public/models/world.glb, built by
 * scripts/build-models.mjs) for the course backgrounds.
 *
 * The course keeps its own small loader instead of importing the landing's
 * (src/landing/materials.ts): the landing and the course are two separate
 * pages, and a module of ours shared between them makes the bundler load the
 * whole course on the landing. Every mesh named brickN / rockN is taken, each
 * centred and scaled to a radius of one.
 */
export async function loadPieces(): Promise<{ bricks: THREE.BufferGeometry[]; rocks: THREE.BufferGeometry[] }> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(import.meta.env.BASE_URL + 'models/world.glb');
  gltf.scene.updateMatrixWorld(true);
  const bricks: THREE.BufferGeometry[] = [], rocks: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const to = /^brick\d+$/.test(o.name) ? bricks : /^rock\d+$/.test(o.name) ? rocks : null;
    if (!to) return;
    // The file is quantised: copy positions and normals out as plain floats.
    const src = o.geometry as THREE.BufferGeometry, g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const a = src.getAttribute(name);
      if (!a) continue;
      const out = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(name, new THREE.BufferAttribute(out, 3));
    }
    if (src.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
    g.applyMatrix4(o.matrixWorld);
    if (!g.getAttribute('normal')) g.computeVertexNormals(); else g.normalizeNormals();
    g.computeBoundingSphere();
    const b = g.boundingSphere;
    if (b && b.radius > 0) { g.translate(-b.center.x, -b.center.y, -b.center.z); g.scale(1 / b.radius, 1 / b.radius, 1 / b.radius); }
    to.push(g);
  });
  if (!bricks.length || !rocks.length) throw new Error('world.glb: no bricks or rocks');
  return { bricks, rocks };
}
