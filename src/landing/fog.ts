import * as THREE from 'three';
import { fbm2 } from './tex';

/**
 * Layered fog for the frozen world (ICE-PLAN stage 4). Three layers on every
 * surface, no ray marching:
 *   1. the far wall: the old smooth distance fog, so far things melt into the
 *      sky colour exactly;
 *   2. ground mist: thick at the snow, thinning with height (the exact
 *      integral of an exponential height fog along the view ray);
 *   3. drifting banks: two layers of 3D noise, large slow banks and fine
 *      wisps, carried downwind at the speed of the snow, sampled at two points
 *      along the ray, so the mist has gaps and moves.
 * The mist is lit: towards the sun it turns a little warmer and brighter.
 *
 * It replaces three.js's fog shader chunks, so every built-in material with
 * `fog: true` gets it. The scene's THREE.Fog carries the two numbers it needs
 * through the usual fog uniforms: `near` is the time (wind drift), `far` how
 * thick the mist is (0 none, 1 normal).
 */

const NEAR = 14, FAR = 46;

export function installLayeredFog(sun: THREE.Vector3) {
  const s = sun.clone().normalize();
  const f = (x: number) => x.toFixed(4);
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  // mvPosition already holds the instancing/skinning; the view matrix is a
  // rotation plus a shift, so its inverse is the transposed rotation.
  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #endif
  uniform float fogNear;
  uniform float fogFar;
  float bkFogHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bkFogNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bkFogHash(i), bkFogHash(i + vec3(1, 0, 0)), f.x), mix(bkFogHash(i + vec3(0, 1, 0)), bkFogHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(bkFogHash(i + vec3(0, 0, 1)), bkFogHash(i + vec3(1, 0, 1)), f.x), mix(bkFogHash(i + vec3(0, 1, 1)), bkFogHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  float fogFactor = smoothstep(${f(NEAR)}, ${f(FAR)}, vFogDepth);
  vec3 bkRay = vFogWorld - cameraPosition;
  float bkDist = max(length(bkRay), 1e-4);
  vec3 bkDir = bkRay / bkDist;
  // Ground mist: density 0.065·exp(-(y - 0.3) / 1.5) integrated along the ray.
  float bkK = bkRay.y / 1.5;
  float bkPath = abs(bkK) > 1e-3 ? (1.0 - exp(-bkK)) / bkK : 1.0;
  float bkDepth = 0.065 * exp(-max(cameraPosition.y - 0.3, -2.0) / 1.5) * bkPath * bkDist;
  // Banks and wisps drifting downwind (+x, like the snow).
  float bkL = min(bkDist, 30.0), bkN = 0.0;
  vec3 bkWind = vec3(fogNear * 0.35, 0.0, fogNear * 0.06);
  for (int i = 0; i < 2; i++) {
    vec3 p = cameraPosition + bkDir * bkL * (0.3 + 0.45 * float(i));
    bkN += 0.62 * bkFogNoise((p - bkWind) * vec3(0.11, 0.22, 0.11)) + 0.38 * bkFogNoise((p - bkWind * 1.7) * vec3(0.34, 0.6, 0.34) + 7.3);
  }
  bkDepth *= 0.3 + 1.9 * smoothstep(0.32, 0.78, bkN * 0.5);
  float bkMist = (1.0 - exp(-bkDepth)) * fogFar;
  // Sunlit: warmer and brighter looking towards the sun.
  float bkSun = pow(max(dot(bkDir, vec3(${f(s.x)}, ${f(s.y)}, ${f(s.z)})), 0.0), 6.0);
  vec3 bkMistColor = fogColor * 1.05 + vec3(0.07, 0.06, 0.035) * bkSun;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, bkMistColor, bkMist);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;
}

/**
 * Soft wisps of mist hanging in the air along the flight: flat billboards of
 * fractal noise that drift downwind and fade out before the camera reaches
 * them (so it flies through mist, never into a card). They give the fog depth
 * where there is no ground for the mist to lie on.
 */
export function makeWisps(count: number, place: (i: number) => THREE.Vector3, rand: (s: number) => number) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!, img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * 2 - 1, v = (y / H) * 2 - 1;
    const r = Math.sqrt(u * u + v * v * 1.1);
    const fall = Math.max(0, 1 - r); // soft oval, nothing at the edge
    const n = fbm2(x / 38 + 3.1, y / 24 + 1.7, 4);
    const a = fall * fall * (3 - 2 * fall) * Math.min(1, Math.max(0, (n - 0.28) / 0.45));
    const k = (y * W + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
    img.data[k + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const wisps: THREE.Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map, color: 0xf1f4f7, transparent: true, opacity: 0, depthWrite: false, fog: false });
    m.rotation = (rand(i + 300) - 0.5) * 0.25;
    const sp = new THREE.Sprite(m);
    sp.position.copy(place(i));
    const w = 7 + rand(i + 301) * 7;
    sp.scale.set(w * (rand(i + 302) < 0.5 ? -1 : 1), w * (0.3 + rand(i + 303) * 0.12), 1);
    sp.userData = { home: sp.position.x, peak: 0.2 + rand(i + 304) * 0.16, speed: 0.25 + rand(i + 305) * 0.2 };
    wisps.push(sp);
  }
  return {
    wisps,
    /** Drift downwind (wrapping round home) and fade by distance to the camera. */
    tick(t: number, cam: THREE.Vector3, drift: boolean) {
      for (const sp of wisps) {
        const u = sp.userData as { home: number; peak: number; speed: number };
        // 18 m of drift, then it starts over: faded in and out at the ends.
        const ph = drift ? ((t * u.speed + u.home * 7.31) % 18 + 18) % 18 : 9;
        sp.position.x = u.home - 9 + ph;
        const d = sp.position.distanceTo(cam), S = THREE.MathUtils.smoothstep;
        const o = u.peak * S(ph, 0, 4) * (1 - S(ph, 14, 18)) * S(d, 3.5, 10) * (1 - S(d, 30, 44));
        (sp.material as THREE.SpriteMaterial).opacity = o;
        sp.visible = o > 0.005;
      }
    },
  };
}
