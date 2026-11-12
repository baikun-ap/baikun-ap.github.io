/**
 * The landing's ground: the snowy hill's relief and the stones on it, as plain
 * deterministic functions. Shared by the page (which builds the hill mesh from
 * them) and by scripts/build-models.mjs (which bakes the hill's light from the
 * very same shapes), so the baked shadows always sit where the stones are.
 * No imports: Node runs this file directly at build time.
 */

/** Towards the sun: the light at (-7, 13, 9) aiming at (0, 2, 0) in story.ts. */
export const SUN: readonly [number, number, number] = norm3(-7, 11, 9);
/** Where the wind blows to (x, z): snow piles up in the lee of each stone. */
export const WIND: readonly [number, number] = norm2(-0.85, -0.53);
/** The square of ground the baked light covers: x0, z0, size (m). */
export const BAKE_RECT: readonly [number, number, number] = [-24, -28, 48];
/** Brick and rock variants in public/models/world.glb. */
export const BRICKS = 8, ROCKS = 8;

function norm3(x: number, y: number, z: number) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] as const; }
function norm2(x: number, z: number) { const l = Math.hypot(x, z); return [x / l, z / l] as const; }

export const rand = (s: number) => { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const smooth = (t: number) => t * t * (3 - 2 * t);
const hash2 = (x: number, y: number) => rand(x * 157.31 + y * 311.7 + 0.5);

/** Smooth value noise in 0..1. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = smooth(x - xi), ty = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
export function fbm(x: number, y: number, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += noise2(x, y) * a; n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; }
  return s / n;
}

/** The hill without the stones' drifts: a broad mound, swells, wind ridges. */
export function baseHeight(x: number, z: number) {
  const r2 = x * x + z * z;
  const mound = 1.8 * Math.exp(-r2 / 42) - 0.55 * Math.exp(-r2 / 6) + 0.6;
  const swell = (fbm(x * 0.12 + 7, z * 0.12) - 0.5) * 1.6 + (fbm(x * 0.55, z * 0.55 + 3, 3) - 0.5) * 0.35;
  // Sastrugi: ridges carved across the wind, broken up by noise, two sizes.
  const along = x * WIND[0] + z * WIND[1], across = -x * WIND[1] + z * WIND[0];
  const warp = fbm(x * 0.2, z * 0.2) * 3;
  const ridges = Math.pow(Math.abs(Math.sin(along * 0.9 + across * 0.12 + warp)), 6) * 0.12
    + Math.pow(Math.abs(Math.sin(along * 3.1 + warp * 2.2)), 8) * 0.035 * fbm(x * 0.4 + 5, z * 0.4);
  // The flanks rise past |x| = 13 m (a soft knee, no crease).
  const side = (Math.abs(x) - 13) / 2;
  return mound + swell + ridges - 1.2 + 0.8 * (side > 20 ? side : Math.log1p(Math.exp(side)));
}

export interface Stone {
  x: number; y: number; z: number;
  /** Euler rotation (XYZ). */
  rx: number; ry: number; rz: number;
  /** Scale of the unit rock. */
  sx: number; sy: number; sz: number;
  /** Footprint radius (m). */
  r: number;
  /** Rock variant. */
  v: number;
  /** A big rock outcrop on the hill's flank. */
  big: boolean;
}

function makeStones(): Stone[] {
  const out: Stone[] = [];
  const free = (x: number, z: number, r: number) => out.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r + 0.6);
  // Stones half buried around the character, clear of it and of the camera.
  for (let i = 0, k = 0; out.length < 24 && k < 400; k++, i++) {
    const a = rand(i + 500) * Math.PI * 2, d = 4 + rand(i + 501) * 9, r = 0.25 + rand(i + 502) * 0.6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8;
    if (!free(x, z, r) || (Math.abs(x) < 2.2 && z > 0)) continue;
    out.push({
      x, z, y: baseHeight(x, z) - r * (0.08 + rand(i + 506) * 0.17),
      rx: (rand(i + 503) - 0.5) * 0.5, ry: rand(i + 504) * 6.28, rz: (rand(i + 505) - 0.5) * 0.5,
      sx: r, sy: r * (0.75 + rand(i + 507) * 0.3), sz: r * (0.85 + rand(i + 508) * 0.3), r, v: i % ROCKS, big: false,
    });
  }
  // Rock outcrops on the flanks and further back, fading into the fog.
  [[-13.5, -7, 3.2], [14.5, -10, 3.6], [-8.5, -19, 2.6], [10, -21, 3], [-19, -15, 3.4]].forEach(([x, z, r], i) => {
    out.push({
      x, z, y: baseHeight(x, z) - r * 0.35,
      rx: (rand(i + 600) - 0.5) * 0.3, ry: rand(i + 601) * 6.28, rz: (rand(i + 602) - 0.5) * 0.3,
      sx: r, sy: r * (1.05 + rand(i + 603) * 0.35), sz: r * 0.8, r, v: (i * 3 + 1) % ROCKS, big: true,
    });
  });
  return out;
}
export const STONES: readonly Stone[] = makeStones();

/** Snow banked around a stone, a drift trailing in its lee, scour on the windward side. */
function drift(s: Stone, x: number, z: number) {
  const dx = x - s.x, dz = z - s.z, r = Math.min(s.r, 1.6), d = Math.hypot(dx, dz);
  if (d > s.r + 7 * r) return 0;
  const a = dx * WIND[0] + dz * WIND[1], b = -dx * WIND[1] + dz * WIND[0];
  const ring = (d - s.r * 0.85) / (0.45 * r);
  let h = 0.17 * r * Math.exp(-ring * ring);
  if (a > 0) {
    const w = 0.7 * r + 0.15 * a;
    h += 0.4 * r * Math.exp(-(b * b) / (w * w)) * Math.exp(-a / (2.4 * r)) * smooth(Math.min(1, a / s.r));
  }
  const sa = a + s.r + 0.5 * r;
  h -= 0.14 * r * Math.exp(-(sa * sa + b * b) / (0.5 * r * r + 0.3 * s.r * s.r));
  return h;
}

/** Height of the snow surface at (x, z). */
export function groundHeight(x: number, z: number) {
  let h = baseHeight(x, z);
  for (const s of STONES) h += drift(s, x, z);
  return h;
}

/**
 * Where a vertex of the 80 m hill grid goes: the grid is squeezed towards the
 * middle (≈ 3× denser around the character than at the edges).
 */
export const squeeze = (u: number) => u * (0.45 + 0.55 * (u / 40) * (u / 40));
