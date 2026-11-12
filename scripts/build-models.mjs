// Builds the landing's 3D models and bakes their light (no Blender needed).
//
//   node scripts/build-models.mjs
//
// Writes to public/models/:
//   world.glb         8 ice bricks for 学 (bevelled, uneven, with chipped corners)
//                     and 8 rocks (lumps, cracks, flat fracture faces), each with
//                     ambient occlusion baked into its vertex colours; meshopt-
//                     compressed (three.js decodes it with MeshoptDecoder).
//   ground-light.png  the snowy hill's baked light over BAKE_RECT: R = ambient
//                     occlusion (sky light), G = sun shadow, from the hill's relief,
//                     the drifts and every stone and outcrop on it.
// The relief and the stones come from src/landing/shapes.ts, the same code the
// page builds the hill from, so the baked shadows land exactly under the stones.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { BAKE_RECT, BRICKS, ROCKS, STONES, SUN, groundHeight, rand } from '../src/landing/shapes.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models');
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${m}`);

/* ---------- 3D noise and distance-field helpers ---------- */
const smooth = (t) => t * t * (3 - 2 * t);
const h3 = (x, y, z) => rand(x * 157.31 + y * 311.7 + z * 74.7 + 0.5);
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const tx = smooth(x - xi), ty = smooth(y - yi), tz = smooth(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), tx), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), tx), ty),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), tx), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), tx), ty), tz);
}
function fbm3(x, y, z, oct) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += noise3(x, y, z) * a; n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; z = z * 2.03 + 3.7; a *= 0.5; }
  return s / n;
}
/** Smooth maximum (a rounded intersection of two shapes). */
function smax(a, b, k) { const h = Math.min(1, Math.max(0, 0.5 - 0.5 * (b - a) / k)); return b + (a - b) * h + k * h * (1 - h); }
function grad(f, x, y, z, e) {
  const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
/** Ambient occlusion read off the distance field: how much the shape crowds the normal. */
function fieldAO(f, p, n, step, strength) {
  let occ = 0, w = 1;
  for (let i = 1; i <= 5; i++) { const d = step * i; occ += w * (d - f(p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d)) / d; w *= 0.6; }
  return Math.min(1, Math.max(0.3, 1 - strength * occ));
}

/* ---------- ice bricks ---------- */
// One cell of 学 is 0.28 m: a brick 0.95 cells square and 1.6 cells deep.
function brick(k) {
  const R = (n) => rand(k * 31.7 + n * 1.37 + 900);
  const h = [0.133 * (1 + (R(1) - 0.5) * 0.06), 0.133 * (1 + (R(2) - 0.5) * 0.06), 0.224 * (1 + (R(3) - 0.5) * 0.05)];
  const rb = 0.02 + R(4) * 0.014;
  const shx = (R(5) - 0.5) * 0.06, shy = (R(6) - 0.5) * 0.06;
  // Chips: spherical scoops out of edges and corners, like flakes knocked off ice.
  const chips = [];
  for (let c = 0, n = 1 + Math.floor(R(7) * 3); c < n; c++) {
    const sg = [R(10 + c) < 0.5 ? -1 : 1, R(20 + c) < 0.5 ? -1 : 1, R(30 + c) < 0.5 ? -1 : 1];
    const free = R(40 + c) < 0.45 ? -1 : Math.floor(R(50 + c) * 3); // -1: a corner, else the edge along that axis
    const p = h.map((v, a) => (a === free ? (R(60 + c) - 0.5) * 1.4 * v : sg[a] * v));
    const out = sg.map((s, a) => (a === free ? 0 : s)), ol = Math.hypot(...out);
    const r = 0.03 + R(70 + c) * 0.04;
    chips.push([p[0] + out[0] / ol * r * 0.55, p[1] + out[1] / ol * r * 0.55, p[2] + out[2] / ol * r * 0.55, r]);
  }
  const f = (x, y, z) => {
    const qx = Math.abs(x - y * shx) - (h[0] - rb), qy = Math.abs(y) - (h[1] - rb), qz = Math.abs(z - y * shy) - (h[2] - rb);
    let d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rb;
    // Hand-cut, slightly wavy faces and a fine frost grain.
    d += (noise3(x * 14 + k * 5, y * 14, z * 14) - 0.5) * 0.007 + (noise3(x * 45, y * 45 + k, z * 45) - 0.5) * 0.002;
    for (const [cx, cy, cz, r] of chips) d = smax(d, r - Math.hypot(x - cx, y - cy, z - cz), 0.008);
    return d;
  };
  // A box grid, denser towards the edges so the bevels stay round.
  const N = [10, 10, 12];
  const at = (a, i) => -h[a] * Math.cos(Math.PI * i / N[a]);
  const pos = [], nor = [], uv = [], col = [], idx = [];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const b = (a + 1) % 3, c = (a + 2) % 3, base = pos.length / 3;
    for (let j = 0; j <= N[c]; j++) for (let i = 0; i <= N[b]; i++) {
      const p = [0, 0, 0]; p[a] = s * h[a]; p[b] = at(b, i); p[c] = at(c, j);
      p[0] += p[1] * shx; p[2] += p[1] * shy;
      for (let it = 0; it < 12; it++) { // walk onto the surface
        const d = f(...p); if (Math.abs(d) < 1e-5) break;
        const g = grad(f, ...p, 1e-4); p[0] -= g[0] * d; p[1] -= g[1] * d; p[2] -= g[2] * d;
      }
      const n = grad(f, ...p, 0.002);
      pos.push(...p); nor.push(...n); uv.push(i / N[b], j / N[c]);
      const ao = fieldAO(f, p, n, 0.008, 1.1);
      col.push(ao, ao, ao);
    }
    for (let j = 0; j < N[c]; j++) for (let i = 0; i < N[b]; i++) {
      const v = base + j * (N[b] + 1) + i, w = v + N[b] + 1;
      if (s > 0) idx.push(v, v + 1, w + 1, v, w + 1, w); else idx.push(v, w + 1, v + 1, v, w, w + 1);
    }
  }
  return { pos, nor, uv, col, idx };
}

/* ---------- rocks ---------- */
const UVR = 1.6; // rock UVs are box projections in -UVR..UVR, stored as 0..1
function rock(k) {
  const R = (n) => rand(k * 47.3 + n * 2.11 + 300);
  const e = [1, 0.84 + R(1) * 0.14, 0.9 + R(2) * 0.18], emin = Math.min(...e);
  const cuts = [];
  for (let c = 0, n = 3 + Math.floor(R(3) * 3); c < n; c++) {
    const z = R(10 + c) * 2 - 1, a = R(20 + c) * Math.PI * 2, s = Math.sqrt(1 - z * z);
    cuts.push([Math.cos(a) * s, z, Math.sin(a) * s, 0.5 + R(30 + c) * 0.3]);
  }
  const f = (x, y, z) => {
    let d = (Math.hypot(x / e[0], y / e[1], z / e[2]) - 1) * emin;
    d += (fbm3(x * 1.3 + k * 7.1, y * 1.3, z * 1.3, 4) - 0.5) * 0.5;
    d += (fbm3(x * 4.5 + k, y * 4.5, z * 4.5 + k, 3) - 0.5) * 0.08;
    // Cracks: thin grooves along the zero lines of a noise field.
    const cr = Math.abs(noise3(x * 2.2 + k * 3, y * 2.2, z * 2.2) - 0.5);
    d += 0.035 * (1 - Math.min(1, cr / 0.05));
    // Flat fracture faces where the rock split off a larger one.
    for (const [nx, ny, nz, o] of cuts) d = smax(d, x * nx + y * ny + z * nz - o, 0.06);
    return d;
  };
  const ico = mergeVertices(new THREE.IcosahedronGeometry(1, 13).deleteAttribute('normal').deleteAttribute('uv'));
  const P = ico.getAttribute('position'), I = ico.index.array;
  const vp = [], vn = [], va = [];
  for (let i = 0; i < P.count; i++) {
    const dx = P.getX(i), dy = P.getY(i), dz = P.getZ(i), l = Math.hypot(dx, dy, dz);
    let lo = 0.05, hi = 2.6; // along the ray from the centre: inside → outside
    for (let it = 0; it < 28; it++) { const m = (lo + hi) / 2; if (f(dx / l * m, dy / l * m, dz / l * m) < 0) lo = m; else hi = m; }
    const p = [dx / l * lo, dy / l * lo, dz / l * lo], n = grad(f, ...p, 0.004);
    vp.push(p); vn.push(n); va.push(fieldAO(f, p, n, 0.045, 1.6));
  }
  // Split vertices where the box projection changes axis, so the scanned rock
  // texture lands clean on every face (one uv per vertex and axis).
  const pos = [], nor = [], uv = [], col = [], idx = [], seen = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [vp[I[t]], vp[I[t + 1]], vp[I[t + 2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [Math.abs(u[1] * v[2] - u[2] * v[1]), Math.abs(u[2] * v[0] - u[0] * v[2]), Math.abs(u[0] * v[1] - u[1] * v[0])];
    const ax = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    for (let j = 0; j < 3; j++) {
      const vi = I[t + j], key = vi * 3 + ax;
      let o = seen.get(key);
      if (o === undefined) {
        o = pos.length / 3; seen.set(key, o);
        const p = vp[vi];
        pos.push(...p); nor.push(...vn[vi]); col.push(va[vi], va[vi], va[vi]);
        const [s0, s1] = ax === 0 ? [p[2], p[1]] : ax === 1 ? [p[0], p[2]] : [p[0], p[1]];
        uv.push((s0 + UVR) / (2 * UVR), (s1 + UVR) / (2 * UVR));
      }
      idx.push(o);
    }
  }
  return { pos, nor, uv, col, idx };
}

/* ---------- build the models ---------- */
const bricks = Array.from({ length: BRICKS }, (_, k) => brick(k));
log(`bricks: ${bricks.map((b) => b.idx.length / 3).join(' ')} triangles`);
const rocks = Array.from({ length: ROCKS }, (_, k) => rock(k));
log(`rocks: ${rocks.map((b) => b.idx.length / 3).join(' ')} triangles`);

const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene('world');
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
[...bricks.map((m, k) => [`brick${k}`, m]), ...rocks.map((m, k) => [`rock${k}`, m])].forEach(([name, m]) => {
  for (const v of m.uv) if (v < 0 || v > 1) throw new Error(`${name}: uv out of 0..1`);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(m.pos)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(m.nor)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(m.uv)))
    .setAttribute('COLOR_0', acc('VEC3', new Float32Array(m.col)))
    .setIndices(acc('SCALAR', m.pos.length / 3 > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx)));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
});
await MeshoptEncoder.ready;
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const glb = await io.writeBinary(doc);
writeFileSync(join(OUT, 'world.glb'), glb);
log(`world.glb ${(glb.length / 1024).toFixed(0)} KB`);

/* ---------- bake the hill's light ---------- */
const N = 1024, [X0, Z0, S] = BAKE_RECT, cell = S / N;
const G = new Float32Array(N * N), H = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const g = groundHeight(X0 + (i + 0.5) * cell, Z0 + (j + 0.5) * cell);
  G[j * N + i] = H[j * N + i] = g;
}
log('ground heights');
// Stones and outcrops: rasterise each rock's triangles into the height of whatever is on top.
{
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const s of STONES) {
    m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s.rx, s.ry, s.rz)), new THREE.Vector3(s.sx, s.sy, s.sz));
    const src = rocks[s.v], w = [];
    for (let i = 0; i < src.pos.length; i += 3) { v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(m); w.push([(v.x - X0) / cell - 0.5, v.y, (v.z - Z0) / cell - 0.5]); }
    for (let t = 0; t < src.idx.length; t += 3) {
      const a = w[src.idx[t]], b = w[src.idx[t + 1]], c = w[src.idx[t + 2]];
      const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(den) < 1e-9) continue;
      for (let j = Math.max(0, Math.ceil(Math.min(a[2], b[2], c[2]))); j <= Math.min(N - 1, Math.floor(Math.max(a[2], b[2], c[2]))); j++)
        for (let i = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]))); i <= Math.min(N - 1, Math.floor(Math.max(a[0], b[0], c[0]))); i++) {
          const l1 = ((b[2] - c[2]) * (i - c[0]) + (c[0] - b[0]) * (j - c[2])) / den, l2 = ((c[2] - a[2]) * (i - c[0]) + (a[0] - c[0]) * (j - c[2])) / den, l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
          if (y > H[j * N + i]) H[j * N + i] = y;
        }
    }
  }
}
log('stones rasterised');
const hAt = (x, z) => { // bilinear height of the occluders at texel coordinates
  x = Math.min(N - 1.001, Math.max(0, x)); z = Math.min(N - 1.001, Math.max(0, z));
  const i = Math.floor(x), j = Math.floor(z), tx = x - i, tz = z - j, k = j * N + i;
  return (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + N] * (1 - tx) + H[k + N + 1] * tx) * tz;
};
const AO = new Float32Array(N * N), SH = new Float32Array(N * N);
const DIRS = 12, STEPS = 18, SUNS = 6;
const sunXZ = Math.hypot(SUN[0], SUN[2]), sunA = Math.atan2(SUN[2], SUN[0]), sunE = Math.atan2(SUN[1], sunXZ);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i, h0 = H[k] + 0.01, jit = rand(k * 0.37 + 11);
  // Ambient occlusion: the horizon in each direction, above the ground's own slope.
  let vis = 0;
  for (let d = 0; d < DIRS; d++) {
    const a = (d + jit) / DIRS * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    const i1 = Math.min(N - 1, Math.max(0, Math.round(i + cx * 4))), j1 = Math.min(N - 1, Math.max(0, Math.round(j + cz * 4)));
    const i0 = Math.min(N - 1, Math.max(0, Math.round(i - cx * 4))), j0 = Math.min(N - 1, Math.max(0, Math.round(j - cz * 4)));
    const slope = (G[j1 * N + i1] - G[j0 * N + i0]) / (Math.hypot(i1 - i0, j1 - j0) * cell || 1);
    let best = -Infinity;
    for (let s = 0, r = 1.2; s < STEPS; s++, r *= 1.33) {
      const t = (hAt(i + cx * r, j + cz * r) - h0) / (r * cell);
      if (t > best) best = t;
    }
    const lift = Math.atan(best) - Math.atan(slope);
    vis += 1 - Math.sin(Math.min(Math.PI / 2, Math.max(0, lift)));
  }
  AO[k] = vis / DIRS;
  // Sun shadow: a few rays across the sun's disc and its soft glow.
  let lit = 0;
  for (let q = 0; q < SUNS; q++) {
    const a = sunA + (rand(k + q * 7.7) - 0.5) * 0.09, e = sunE + (rand(k + q * 3.1 + 5) - 0.5) * 0.06;
    const cx = Math.cos(a), cz = Math.sin(a), rise = Math.tan(e) * cell;
    let free = 1;
    for (let s = 0, r = 1; s < STEPS; s++, r *= 1.3) {
      if (hAt(i + cx * r, j + cz * r) > h0 + 0.01 + r * rise) { free = 0; break; }
    }
    lit += free;
  }
  SH[k] = lit / SUNS;
}
log('baked');
// Soften the sampling noise: a small blur.
const blur = (A, r) => {
  const B = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let s = 0, n = 0;
    for (let y = Math.max(0, j - r); y <= Math.min(N - 1, j + r); y++) for (let x = Math.max(0, i - r); x <= Math.min(N - 1, i + r); x++) { s += A[y * N + x]; n++; }
    B[j * N + i] = s / n;
  }
  return B;
};
const ao = blur(AO, 2), sh = blur(SH, 1);

// PNG, top row = far edge (largest z), so with the usual flipY v = (z - z0) / size.
// Each row is stored as its difference to the row above (PNG filter "Up").
const px = Buffer.alloc(N * N * 3);
for (let row = 0; row < N; row++) for (let i = 0; i < N; i++) {
  const k = (N - 1 - row) * N + i, o = (row * N + i) * 3;
  px[o] = Math.round(ao[k] * 255); px[o + 1] = Math.round(sh[k] * 255); px[o + 2] = 255;
}
const raw = Buffer.alloc((N * 3 + 1) * N);
for (let row = 0; row < N; row++) {
  raw[row * (N * 3 + 1)] = 2;
  for (let x = 0; x < N * 3; x++) raw[row * (N * 3 + 1) + 1 + x] = (px[row * N * 3 + x] - (row ? px[(row - 1) * N * 3 + x] : 0)) & 255;
}
const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(join(OUT, 'ground-light.png'), png);
log(`ground-light.png ${(png.length / 1024).toFixed(0)} KB`);
