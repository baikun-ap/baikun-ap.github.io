import * as THREE from 'three';

/**
 * Procedural surface textures for the frozen world, drawn once on load:
 * tileable fractal noise turned into normal and roughness maps for snow, ice
 * and rock, plus the soft glowing edge used on the ice bricks. No downloads.
 */

/** Smooth tileable value noise: `period` lattice cells across the tile. */
function tileNoise(size: number, period: number, seed: number) {
  const lat = new Float32Array(period * period);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < lat.length; i++) { s = (s * 9301 + 49297) % 233280; lat[i] = s / 233280; }
  const out = new Float32Array(size * size);
  const f = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * period, y0 = Math.floor(gy), ty = f(gy - y0), y1 = (y0 + 1) % period;
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * period, x0 = Math.floor(gx), tx = f(gx - x0), x1 = (x0 + 1) % period;
      const a = lat[y0 * period + x0], b = lat[y0 * period + x1], c = lat[y1 * period + x0], d = lat[y1 * period + x1];
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** Fractal sum of tileable octaves; `ridged` folds it into crack-like ridges. */
function fbm(size: number, base: number, octaves: number, seed: number, ridged = false) {
  const h = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, base << o, seed + o * 17);
    for (let i = 0; i < h.length; i++) h[i] += (ridged ? 1 - Math.abs(n[i] * 2 - 1) : n[i]) * amp;
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < h.length; i++) h[i] /= total;
  return h;
}

function toNormalMap(h: Float32Array, size: number, strength: number) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}

function toGrey(h: Float32Array, size: number, lo: number, hi: number, srgb = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size);
  for (let i = 0; i < h.length; i++) { const v = (lo + (hi - lo) * h[i]) * 255; img.data.set([v, v, v, 255], i * 4); }
  g.putImageData(img, 0, 0);
  return tex(c, srgb);
}

function tex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Surface { normal: THREE.Texture; rough: THREE.Texture; color?: THREE.Texture }

export function makeSurfaces(mobile: boolean) {
  const N = mobile ? 256 : 512;
  // Snow: soft wind-blown drifts with fine grain.
  const snowH = fbm(N, 4, 6, 11);
  const snow: Surface = { normal: toNormalMap(snowH, N, mobile ? 4 : 6), rough: toGrey(snowH, N, 0.72, 0.98) };
  // Ice: broad slow ripples, sharp scratches.
  const iceH = fbm(N, 2, 5, 23);
  const scratch = fbm(N, 16, 2, 29, true);
  for (let i = 0; i < iceH.length; i++) iceH[i] = iceH[i] * 0.8 + Math.pow(scratch[i], 6) * 0.25;
  const ice: Surface = { normal: toNormalMap(iceH, N, 3), rough: toGrey(iceH, N, 0.08, 0.35) };
  // Rock: cracked, ridged, with a darker tint in the cracks.
  const rockH = fbm(N, 3, 6, 41, true);
  const rock: Surface = { normal: toNormalMap(rockH, N, 9), rough: toGrey(rockH, N, 0.55, 0.95), color: toGrey(rockH, N, 0.62, 1, true) };
  return { snow, ice, rock };
}

/** A square with softly glowing edges and a dark middle: the seams of the ice bricks. */
export function makeSeamMap() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!, img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const e = Math.min(x, y, S - 1 - x, S - 1 - y) / S;
    const v = Math.pow(Math.max(0, 1 - e / 0.13), 2.2) * 255;
    img.data.set([v, v, v, 255], (y * S + x) * 4);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A tall soft beam for shafts of light in the fog. */
export function makeBeam() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, 'rgba(255,255,255,0.9)'); v.addColorStop(0.55, 'rgba(255,255,255,0.35)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 512);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plain 2D value noise for terrain heights (not tileable, any coordinates). */
export function noise2(x: number, y: number) {
  const h = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}
export function fbm2(x: number, y: number, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
