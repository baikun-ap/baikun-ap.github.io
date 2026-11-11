import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/**
 * Real materials for the frozen world.
 *
 * - Photo-scanned snow and rock from Poly Haven (CC0), 1k on phones and 2k on
 *   computers, as webp colour / normal / AO-rough-metal maps in public/tex
 *   (built by scripts/build-textures.py). They stream in after the first frame;
 *   until then the procedural maps from tex.ts stand in.
 * - An overcast winter-field HDRI (Poly Haven, CC0) as the lighting environment.
 * - Our own shader layers on top of the standard three.js materials:
 *   ice gets depth (frost veils seen through the surface), a blue scattering
 *   glow and light shining through it against the sun; snow gets sparkling
 *   frost crystals that catch the sun as the camera moves.
 */

const BASE = import.meta.env.BASE_URL + 'tex/';

/** World direction towards the sun, shared by every patched material. */
export const sunDir = { value: new THREE.Vector3(-7, 13, 9).normalize() };
const time = { value: 0 };
export function tickMaterials(t: number) { time.value = t; }

/* ---------- shader snippets ---------- */

const NOISE = /* glsl */`
  float iceHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float iceNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(iceHash(i), iceHash(i + vec3(1,0,0)), f.x), mix(iceHash(i + vec3(0,1,0)), iceHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(iceHash(i + vec3(0,0,1)), iceHash(i + vec3(1,0,1)), f.x), mix(iceHash(i + vec3(0,1,1)), iceHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

/** Varyings with the world position and the object-space position (instance-aware). */
function addPositions(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vIceW;\nvarying vec3 vIceL;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 iceW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        iceW = instanceMatrix * iceW;
        vIceL = transformed + vec3(float(gl_InstanceID) * 3.17, float(gl_InstanceID) * 1.31, 0.0);
      #else
        vIceL = transformed;
      #endif
      vIceW = (modelMatrix * iceW).xyz;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vIceW;\nvarying vec3 vIceL;\nuniform vec3 uSun;\nuniform float uTime;' + NOISE);
  shader.uniforms.uSun = sunDir;
  shader.uniforms.uTime = time;
}

export interface IceLook {
  /** Colour deep inside the ice, seen face-on. */
  deep: number;
  /** Colour of the scattered glow near the surface. */
  glow: number;
  /** How strongly the inner frost and glow show (0..1). */
  depth: number;
  /** Frost veil frequency in object units. */
  scale: number;
}

/**
 * Turns a MeshPhysicalMaterial into ice: three frost veils sampled along the
 * view ray beneath the surface give it depth, the edge-on rim scatters white,
 * the face-on body tints blue, and the sun glows through it when behind.
 */
export function makeIce(mat: THREE.MeshPhysicalMaterial, look: IceLook) {
  const u = {
    uDeep: { value: new THREE.Color(look.deep) },
    uGlow: { value: new THREE.Color(look.glow) },
    uDepth: { value: look.depth },
    uScale: { value: look.scale },
  };
  mat.onBeforeCompile = (shader) => {
    addPositions(shader);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 uSun;', 'uniform vec3 uSun;\nuniform vec3 uDeep;\nuniform vec3 uGlow;\nuniform float uDepth;\nuniform float uScale;')
      .replace('#include <opaque_fragment>', `
        {
          vec3 rayW = normalize(vIceW - cameraPosition);
          float nv = saturate(dot(normal, normalize(vViewPosition)));
          // Frost veils at three depths under the surface, seen through it.
          float veil = 0.0;
          for (int k = 1; k <= 3; k++) {
            vec3 p = vIceL * uScale + rayW * float(k) * 0.55;
            float n = iceNoise(p) * 0.65 + iceNoise(p * 2.7 + 7.1) * 0.35;
            veil += smoothstep(0.52, 0.8, n) / float(k);
          }
          veil = saturate(veil * 0.8);
          float face = pow(nv, 1.5);
          vec3 body = mix(uGlow, uDeep, face);
          // Light coming through the ice from the sun behind it.
          float through = pow(saturate(dot(rayW, uSun) * 0.5 + 0.5), 5.0) * (0.35 + 0.65 * face);
          vec3 inner = body * (0.28 + 0.55 * veil) + uGlow * through * 0.9;
          outgoingLight = mix(outgoingLight, outgoingLight * (body * 0.6 + 0.55) + inner * 0.45, uDepth);
          outgoingLight += uGlow * pow(1.0 - nv, 4.0) * 0.18 * uDepth;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'bk-ice';
  return u;
}

/**
 * Snow that sparkles: a sparse grid of tiny frost crystals, each with its own
 * random facet; a crystal flashes when its facet mirrors the sun into the eye.
 * Shadowed snow does not sparkle. Also breaks up the tiling with soft drifts.
 */
export function makeSnow(mat: THREE.MeshStandardMaterial, strength: number) {
  const u = { uSparkle: { value: strength } };
  mat.onBeforeCompile = (shader) => {
    addPositions(shader);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 uSun;', 'uniform vec3 uSun;\nuniform float uSparkle;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.93 + 0.1 * iceNoise(vIceW * 0.18) - 0.05 * iceNoise(vIceW * 1.3 + 3.0);`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(cameraPosition - vIceW);
          float dist = length(cameraPosition - vIceW);
          float glint = 0.0;
          // Two grid scales so crystals stay visible both near and far.
          for (int k = 0; k < 2; k++) {
            float cs = k == 0 ? 0.045 : 0.11;
            vec3 g = vIceW / cs, c = floor(g), f = fract(g) - 0.5;
            float h = iceHash(c + float(k) * 19.0);
            if (h > 0.86) {
              vec3 facet = normalize(vec3(iceHash(c + 1.3), iceHash(c + 2.7), iceHash(c + 4.1)) * 2.0 - 1.0 + vec3(0.0, 1.2, 0.0));
              vec3 H = normalize(uSun + V);
              float spec = pow(saturate(dot(facet, H)), 900.0);
              float dot_ = smoothstep(0.5, 0.0, length(f));
              // Slow twinkle as the air shimmers.
              float tw = 0.65 + 0.35 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
              glint += spec * dot_ * tw * (k == 0 ? smoothstep(16.0, 4.0, dist) : smoothstep(40.0, 10.0, dist));
            }
          }
          float lit = smoothstep(0.04, 0.35, dot(reflectedLight.directDiffuse, vec3(0.3333)));
          outgoingLight += vec3(1.0, 0.98, 0.94) * glint * lit * uSparkle;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'bk-snow';
  return u;
}

/* ---------- photo scans and sky ---------- */

export interface ScanSet { col: THREE.Texture; nor: THREE.Texture; arm: THREE.Texture }

// Decoded off the main thread where the browser can (ImageBitmap), so the intro
// never stutters; fetches also do not hold up the page's load event.
const bitmaps = typeof createImageBitmap === 'function';
const loader: THREE.Loader<THREE.Texture | ImageBitmap> = bitmaps
  ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  : new THREE.TextureLoader();
function load(url: string, srgb: boolean, aniso: number) {
  return new Promise<THREE.Texture>((res, rej) => loader.load(url, (img) => {
    // Bitmaps arrive unflipped (top row at v = 0): a mirror image of the tile,
    // which only matters for the normal map's green channel (see applyScan).
    const t = img instanceof THREE.Texture ? img : new THREE.Texture(img);
    if (!(img instanceof THREE.Texture)) { t.flipY = false; t.needsUpdate = true; }
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }, undefined, rej));
}

/** Loads one scanned surface at the size that fits the device. */
export async function loadScan(name: 'snow' | 'rock', big: boolean, aniso: number): Promise<ScanSet> {
  const k = big ? '2k' : '1k';
  const [col, nor, arm] = await Promise.all([
    load(`${BASE}${name}_col_${k}.webp`, true, aniso),
    load(`${BASE}${name}_nor_${k}.webp`, false, aniso),
    load(`${BASE}${name}_arm_${k}.webp`, false, aniso),
  ]);
  return { col, nor, arm };
}

/** Puts a scan on a material: colour, normal, AO (R), roughness (G). */
export function applyScan(mat: THREE.MeshStandardMaterial, s: ScanSet, repeat: number, ao = 1) {
  [s.col, s.nor, s.arm].forEach((t) => t.repeat.set(repeat, repeat));
  mat.map = s.col; mat.normalMap = s.nor; mat.roughnessMap = s.arm; mat.aoMap = s.arm; mat.aoMapIntensity = ao;
  // A mirrored tile turns bumps into dents unless green is flipped too.
  if (!s.nor.flipY) mat.normalScale.y = -Math.abs(mat.normalScale.y);
  mat.needsUpdate = true;
}

/** The overcast winter sky as an environment map (pre-filtered for roughness). */
export function loadSky(renderer: THREE.WebGLRenderer) {
  return new Promise<THREE.Texture>((res, rej) => new HDRLoader().load(`${BASE}sky.hdr`, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(hdr).texture;
    hdr.dispose(); pm.dispose();
    res(env);
  }, undefined, rej));
}
