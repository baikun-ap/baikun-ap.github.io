import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fbm2, makeBeam, makeSeamMap, makeSurfaces } from './tex';
import { applyScan, loadGroundLight, loadScan, loadSky, loadWorld, makeDusted, makeIce, makeSnow, sunDir, tickMaterials, type World } from './materials';
import { ROCKS, STONES, groundHeight, squeeze } from './shapes';
import { installLayeredFog, makeWisps } from './fog';
import { createSound } from './sound';

/**
 * The landing story, one long scroll through a frozen, foggy world:
 *   1. lines draw the character 学 in the fog,
 *   2. it sets into glowing ice blocks on a snowy hill,
 *   3. the blocks burst and the camera flies on through floating ice rocks,
 *   4. eight ice segments turn in a ring (the eight steps of a lesson),
 *   5. a glowing ice portal (the exams),
 *   6. 开始 gathers out of ice dust on a round platform.
 * Story progress s runs 0 → 1: the first 0.2 plays by itself as an intro,
 * the rest follows the page scroll. Original three.js scene.
 *
 * Direction (ICE-PLAN stage 3): the camera flies on smooth keyframes with
 * banking, framing changes (FOV) and a light handheld drift; the bricks of 学
 * break off one at a time, each in a puff of snow dust; the eight segments fly
 * in and lock into the ring one by one; the portal flashes as the camera
 * passes through; snow keeps falling around the camera wherever it is.
 *
 * Atmosphere and sound (ICE-PLAN stage 4): layered fog (far wall, ground
 * mist, drifting banks, fog.ts) with wisps of mist in the air; film grain;
 * sound that follows the story (sound.ts): crunching ice, clinking ring
 * segments, the portal's hum and boom, wind with the scroll speed.
 */

export interface Story {
  setScroll(p: number): void;
  /** Current story progress, 0..1 (what the HTML captions follow). */
  progress(): number;
  hover(on: boolean): void;
  toggleSound(): boolean;
}

const FOG = new THREE.Color(0xc4cad1);

/** Filled cells of a glyph drawn on a small canvas, centred, y up. */
async function glyphCells(text: string, w: number, h: number, step: number): Promise<THREE.Vector2[]> {
  try { await Promise.race([document.fonts.load(`700 ${h}px "Noto Serif SC"`, text), new Promise((r) => setTimeout(r, 1500))]); } catch { /* use what is there */ }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(h * 0.9)}px "Noto Serif SC", "Songti SC", "PingFang SC", "Noto Sans CJK SC", serif`;
  g.fillText(text, w / 2, h / 2 + h * 0.04);
  const d = g.getImageData(0, 0, w, h).data;
  const out: THREE.Vector2[] = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    if (d[(y * w + x) * 4] > 128) out.push(new THREE.Vector2(x - w / 2, h / 2 - y));
  }
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (s: number, a: number, b: number) => clamp01((s - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);
/** Overshoots a little and settles: a piece clicking into place. */
const easeBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** 0 → 1 → 0 over [a, b]. */
const bump = (s: number, a: number, b: number) => Math.sin(Math.PI * ramp(s, a, b));

/** Soft round sprites (snow dust, falling snow): white, fading at the edge. */
const SOFT_FRAG = /* glsl */`
  varying float vA; varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = vA * (1.0 - smoothstep(mix(0.55, 0.0, vSoft), 1.0, d));
    gl_FragColor = vec4(0.97, 0.985, 1.0, a);
  }`;

/** Three levels of cost: an old phone, a new phone, a computer. */
export type Quality = 'low' | 'mid' | 'high';

/**
 * The starting level. A software renderer and phones that say they are short
 * of memory start low, other phones in the middle, computers high. `?q=low`,
 * `?q=mid` or `?q=high` in the address forces a level, and so does the GFX
 * chip on the page (main.ts). Whatever the level, the
 * frame-time governor in the loop steps the cost down on a device that cannot
 * keep up.
 */
function pickQuality(mobile: boolean, soft: boolean): Quality {
  const asked = new URLSearchParams(location.search).get('q');
  if (asked === 'low' || asked === 'mid' || asked === 'high') return asked;
  // The GFX chip in the footer keeps the visitor's own choice.
  try { const kept = localStorage.getItem('baikun-gfx'); if (kept === 'low' || kept === 'mid' || kept === 'high') return kept; } catch { /* storage blocked */ }
  if (soft) return 'low';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8, cores = nav.hardwareConcurrency || 8;
  const phone = mobile || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 700);
  if (phone) return mem <= 3 || cores <= 2 ? 'low' : 'mid';
  return mem <= 2 || cores <= 2 ? 'mid' : 'high';
}

export function createStory(host: HTMLElement, onReady: () => void, onProgress?: (p: number) => void): Story | null {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch { return null; }
  try { return build(host, onReady, onProgress); } catch (e) { console.error('[story]', e); return null; }
}

function build(host: HTMLElement, onReady: () => void, onProgress?: (p: number) => void): Story {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth <= 820;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // Without a graphics card (a software renderer: seconds per frame) the scans
  // and the sky only stall the page, so it keeps the light procedural look.
  // ?hq forces them anyway (for recordings).
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  const soft = /swiftshader|llvmpipe|softpipe|software/i.test(gpu);
  const rich = !soft || new URLSearchParams(location.search).has('hq');
  // Cost follows the quality level, layout follows the screen (`mobile`).
  const quality = pickQuality(mobile, soft && !rich);
  const low = quality === 'low', lite = quality !== 'high';
  document.documentElement.dataset.quality = quality;
  let pixelRatio = Math.min(devicePixelRatio, low ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(FOG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Layered fog (fog.ts): its distances are built into the shader; the
  // uniforms carry the wind time (near) and how thick the mist is (far).
  const fog = new THREE.Fog(FOG, 0, 1);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(mobile ? 60 : 46, innerWidth / innerHeight, 0.1, 140);

  // Glowing see-through things (light shafts, snow, dust) must stay out of the
  // depth/normal renders of the AO and depth-of-field passes: drawn there as
  // solid quads they turned into big dark rectangles on computers.
  const airy: THREE.Object3D[] = [];
  const skipAiry = (pass: { render: (...a: never[]) => void }) => {
    const draw = pass.render.bind(pass);
    pass.render = (...a: never[]) => {
      const shown = airy.map((o) => o.visible);
      airy.forEach((o) => { o.visible = false; });
      try { draw(...a); } finally { airy.forEach((o, i) => { o.visible = shown[i]; }); }
    };
  };
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: low ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  // Contact shadows in the crevices between bricks and rocks (too heavy for phones).
  let ao: GTAOPass | null = null;
  if (!lite) {
    ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 });
    ao.blendIntensity = 0.85;
    skipAiry(ao);
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.97);
  composer.addPass(bloom);
  // Depth of field: the subject sharp, the far fog and near snow soft.
  const bokeh = new BokehPass(scene, camera, { focus: 12, aperture: lite ? 0.0012 : 0.0018, maxblur: lite ? 0.005 : 0.008 });
  skipAiry(bokeh);
  // An old phone goes without depth of field: two more full-screen renders.
  bokeh.enabled = !low;
  composer.addPass(bokeh);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uGrain: { value: 0 }, uCell: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    // Vignette, the portal flash, and film grain: a new grain pattern 24 times
    // a second, cells about a CSS pixel big, strongest in the mid-tones (as on
    // film), with a faint flicker of the whole frame.
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uFlash; uniform float uGrain; uniform float uCell; varying vec2 vUv;
      float h(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float d = length(vUv-0.5);
        c *= mix(1.0, 0.82, smoothstep(0.35, 0.85, d));
        c = mix(c, vec3(1.0, 1.0, 1.02), uFlash * (0.85 - 0.35 * d));
        vec2 cell = floor(gl_FragCoord.xy / uCell); float f = uGrain;
        vec2 o = vec2(fract(f * 0.1373) * 913.0, fract(f * 0.2917) * 577.0);
        float g = (h(cell + o) + h(cell * 1.37 + o.yx + 11.0)) - 1.0;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mid = 1.0 - 0.65 * pow(abs(clamp(lum, 0.0, 1.0) * 2.0 - 1.0), 2.0);
        c += g * 0.042 * mid;
        c *= 1.0 + (h(vec2(f, 3.7)) - 0.5) * 0.012;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  composer.addPass(grade);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f8a96, 1.1);
  scene.add(hemi);
  // The overcast winter-field sky replaces the studio room once it arrives,
  // turned so its bright patch of cloud sits where the sun light comes from.
  scene.environmentRotation.y = -1.5;
  if (rich) loadSky(renderer).then((env) => {
    scene.environment = env; scene.environmentIntensity = 0.62; hemi.intensity = 0.55;
  }).catch((e) => console.warn('[story] sky', e));
  const surf = makeSurfaces(lite);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-7, 13, 9); sun.target.position.set(0, 2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
  installLayeredFog(sunDir.value);
  // Photo-scanned snow and rock stream in after the first frames (2k on computers).
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const big = !lite && Math.min(screen.width, screen.height) * devicePixelRatio >= 1000;

  const rand = (s: number) => { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

  // Modelled bricks and rocks with baked occlusion, and the hill's baked light
  // (scripts/build-models.mjs), fetched at once. The story waits for them (at
  // most 2.5 s) so nothing changes shape on screen; procedural shapes stand in
  // if they do not come.
  const wait = new Promise<void>((r) => setTimeout(r, 2500));
  let late = false;
  void wait.then(() => { late = true; });
  const worldP: Promise<World | null> = Promise.race([
    loadWorld().catch((e) => { console.warn('[story] models', e); return null; }),
    wait.then(() => null),
  ]);
  const bakedLight = { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) as THREE.Texture };
  bakedLight.value.needsUpdate = true;
  const lightP: Promise<boolean> = Promise.race([
    loadGroundLight().then((t) => { if (late) { t.dispose(); return false; } bakedLight.value = t; return true; }, (e) => { console.warn('[story] light', e); return false; }),
    wait.then(() => false),
  ]);
  let settled = false;
  // What the first picture waits for: models, baked light, the 学 glyph, first frames.
  let loaded = 0;
  const step = () => { loaded++; onProgress?.(Math.min(1, loaded / 4)); };
  void worldP.then(step); void lightP.then(step);
  /** All vertices white: procedural stand-ins for the models' baked occlusion. */
  const white = (g: THREE.BufferGeometry) => g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  /** A modelled rock with its own texture placement (shares the vertex data). */
  const rockFor = (src: THREE.BufferGeometry, size: number, seed: number) => {
    const g = new THREE.BufferGeometry();
    (['position', 'normal', 'color'] as const).forEach((n) => g.setAttribute(n, src.getAttribute(n)));
    g.setIndex(src.index);
    const u0 = src.getAttribute('uv'), uv = new Float32Array(u0.count * 2);
    // Stored as 0..1 over -1.6..1.6 m of the unit rock; scans tile every 1/0.45 m.
    for (let i = 0; i < u0.count; i++) { uv[i * 2] = (u0.getX(i) * 3.2 - 1.6) * size * 0.45 + seed * 0.37; uv[i * 2 + 1] = (u0.getY(i) * 3.2 - 1.6) * size * 0.45 + seed * 0.11; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (!src.boundingSphere) src.computeBoundingSphere();
    g.boundingSphere = src.boundingSphere;
    return g;
  };

  /* ---------- scene 2: the snowy hill ---------- */
  // The relief (swells, wind ridges, drifts piled against the stones) comes
  // from shapes.ts, the same code the light was baked from; the grid is
  // squeezed so it is densest around the character.
  const hillGeo = new THREE.PlaneGeometry(80, 80, low ? 130 : lite ? 170 : 240, low ? 130 : lite ? 170 : 240);
  hillGeo.rotateX(-Math.PI / 2);
  const hp = hillGeo.getAttribute('position') as THREE.BufferAttribute, huv = hillGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const x = squeeze(hp.getX(i)), z = squeeze(hp.getZ(i));
    hp.setXYZ(i, x, groundHeight(x, z), z);
    huv.setXY(i, (x + 40) / 80, (40 - z) / 80);
  }
  hillGeo.computeVertexNormals();
  [surf.snow.normal, surf.snow.rough].forEach((t) => t.repeat.set(14, 14));
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xd4dae0, roughness: 1, roughnessMap: surf.snow.rough, normalMap: surf.snow.normal, normalScale: new THREE.Vector2(0.9, 0.9) });
  makeSnow(hillMat, mobile ? 2.2 : 3, bakedLight);
  const hill = new THREE.Mesh(hillGeo, hillMat);
  hill.receiveShadow = true;
  scene.add(hill);

  // Rock material (scattered stones, floating rocks): cracked and normal-mapped.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb9c1c9, map: surf.rock.color, roughnessMap: surf.rock.rough, normalMap: surf.rock.normal, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1, vertexColors: true });
  // Stones in the snow carry snow on their tops.
  const stoneMat = rockMat.clone();
  makeDusted(stoneMat);
  const rockGeo = (seed: number, r: number) => {
    const g = new THREE.IcosahedronGeometry(r, 4);
    const p = g.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).normalize();
      const f = 1 + (fbm2(v.x * 2.2 + seed, v.y * 2.2 + v.z * 1.7) - 0.5) * 0.7 + (fbm2(v.z * 6 + seed, v.x * 6, 2) - 0.5) * 0.12;
      p.setXYZ(k, v.x * r * f, v.y * r * f * 0.78, v.z * r * f);
    }
    g.computeVertexNormals();
    white(g);
    // Box-projected UVs per triangle (by its facing), so the scanned rock keeps
    // the same texel size on every stone and never pinches at a pole.
    const uv = g.getAttribute('uv') as THREE.BufferAttribute, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let k = 0; k < p.count; k += 3) {
      a.fromBufferAttribute(p, k); b.fromBufferAttribute(p, k + 1); c.fromBufferAttribute(p, k + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(p, k + j);
        const [s0, t0] = ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y];
        uv.setXY(k + j, s0 * 0.45 + seed * 0.37, t0 * 0.45 + seed * 0.11);
      }
    }
    return g;
  };
  // Stones half-buried in the drifts around the character and rock outcrops on
  // the flanks. Their sun shadows and contact shade are baked into the hill, so
  // they stay out of the live shadow map (unless the baked light is missing).
  const placeStones = (world: World | null, baked: boolean) => {
    STONES.forEach((s, i) => {
      const m = new THREE.Mesh(world ? rockFor(world.rocks[s.v], s.r, i) : rockGeo(i, 1), stoneMat);
      m.position.set(s.x, s.y, s.z);
      m.rotation.set(s.rx, s.ry, s.rz);
      m.scale.set(s.sx, s.sy * (world ? 1 : 1.28), s.sz);
      m.castShadow = !baked; m.receiveShadow = true;
      scene.add(m);
    });
  };

  // Mountain ranges on the horizon: fog-coloured silhouettes that follow the camera.
  const ranges: THREE.Mesh[] = [];
  [[62, 9, 0xaab3bc, 0], [88, 15, 0xb8c0c8, 31]].forEach(([r, h, col, seed]) => {
    const g = new THREE.CylinderGeometry(r, r, h, 360, 1, true);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) < 0) { p.setY(k, -h * 0.5 - 4); continue; }
      const ang = Math.atan2(p.getZ(k), p.getX(k));
      const ridge = Math.pow(fbm2(Math.cos(ang) * 4 + seed, Math.sin(ang) * 4, 6), 1.6);
      p.setY(k, -h * 0.5 - 4 + h * (0.25 + ridge * 1.6));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.BackSide }));
    m.renderOrder = -1;
    scene.add(m); ranges.push(m);
  });

  // Shafts of light leaning through the fog, one cluster per scene.
  const beamTex = makeBeam();
  const beams: THREE.Sprite[] = [];
  [0, -38, -78, -108, -138].forEach((z, j) => {
    for (let i = 0; i < (lite ? 2 : 3); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: beamTex, color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set((rand(j * 7 + i) - 0.5) * 16, 7 + rand(j * 7 + i + 1) * 3, z - 6 - rand(j * 7 + i + 2) * 8);
      sp.scale.set(2.2 + rand(j * 7 + i + 3) * 2.5, 16, 1);
      sp.material.rotation = -0.38 + (rand(j * 7 + i + 4) - 0.5) * 0.2;
      sp.userData.phase = rand(j * 7 + i + 5) * 6;
      scene.add(sp); beams.push(sp); airy.push(sp);
    }
  });

  // Wisps of mist along the flight: low over the snow behind and beside 学
  // (never in front of it), between the floating rocks, round the ring and
  // the portal (clear of their middles), low over the final platform.
  const mist = makeWisps(low ? 9 : lite ? 16 : 28, (i) => {
    const z = 4 - rand(i + 310) * 150, side = rand(i + 311) < 0.5 ? -1 : 1;
    let x = side * (1.5 + rand(i + 312) * 9), y: number;
    if (z > -40) {
      if (z > -2) x = side * (4.5 + rand(i + 312) * 7);
      y = groundHeight(x, z) + 1.5 + rand(i + 313) * 1.4;
    } else if (z < -124) y = 1 + rand(i + 313) * 0.8;
    else { if (Math.abs(z + 80) < 8 || Math.abs(z + 110) < 8) x = side * (4.5 + rand(i + 312) * 6); y = -0.5 + rand(i + 313) * 6; }
    return new THREE.Vector3(x, y, z);
  }, rand);
  mist.wisps.forEach((w) => { scene.add(w); airy.push(w); });

  /* ---------- scenes 1–3: the character 学, lines → ice blocks → burst ---------- */
  const CELL = 0.28;
  const blockMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6edf3, roughness: 0.42, roughnessMap: surf.ice.rough, normalMap: surf.ice.normal, normalScale: new THREE.Vector2(0.7, 0.7),
    clearcoat: 0.7, clearcoatRoughness: 0.25, emissive: 0xffffff, emissiveMap: makeSeamMap(), emissiveIntensity: 0,
  });
  makeIce(blockMat, { deep: 0x6f9cc4, glow: 0xe4f4ff, depth: 0.6, scale: 7 });
  blockMat.vertexColors = true;
  /** One instanced mesh per brick model; ids: which cells of 学 it draws. */
  let brickSets: { mesh: THREE.InstancedMesh; ids: number[] }[] = [];
  let jitter: THREE.Vector3[] = [], jscale: number[] = [];
  let targets: THREE.Vector3[] = [], scatter: THREE.Vector3[] = [], burst: THREE.Vector3[] = [], spin: THREE.Vector3[] = [], delay: number[] = [];
  // Breaking off: when each brick lets go (story progress), which way it pops
  // out first, and the real time it did (-1: still in place).
  let detachAt: number[] = [], kick: THREE.Vector3[] = [], detachT: number[] = [];
  /** Snow dust puffed out by each brick as it breaks off (DUST particles per brick). */
  const DUST = low ? 3 : lite ? 4 : 7;
  let dustBirth: THREE.BufferAttribute | null = null, dustDirty = false;
  const markDust = (i: number, at: number) => {
    if (!dustBirth) return;
    (dustBirth.array as Float32Array).fill(at, i * DUST, (i + 1) * DUST);
    dustDirty = true;
  };
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 } },
    vertexShader: /* glsl */`
      attribute vec3 aVel; attribute float aBirth; attribute float aSeed;
      uniform float uTime; uniform float uScale;
      varying float vA; varying float vSoft;
      void main() {
        float age = uTime - aBirth, life = 1.5 + aSeed * 1.6;
        if (aBirth < 0.0 || age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vSoft = 0.0; return; }
        // Thrown out, braked by the air, then drifting down and downwind.
        vec3 p = position + aVel * (1.0 - exp(-2.4 * age)) / 2.4 + vec3(0.22 * age, -0.09 * age * age - 0.06 * age, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (0.14 + aSeed * 0.2) * (1.0 + age * 1.3);
        gl_PointSize = min(size * uScale / max(0.2, -mv.z), 150.0);
        float x = age / life;
        vA = smoothstep(0.0, 0.07, age) * (1.0 - x) * (1.0 - x) * 0.9;
        vSoft = 1.0;
      }`,
    fragmentShader: SOFT_FRAG,
    transparent: true, depthWrite: false,
  });
  let lines: THREE.LineSegments | null = null;
  const charGroup = new THREE.Group(); charGroup.position.set(0, 1.25, 0); scene.add(charGroup);

  // A loose web of thin lines around the character, like a survey being drawn.
  const webN = lite ? 70 : 120, webPos = new Float32Array(webN * 6);
  for (let i = 0; i < webN; i++) {
    const a = new THREE.Vector3((rand(i + 1) - 0.5) * 16, rand(i + 2) * 8 - 1, (rand(i + 3) - 0.5) * 10);
    const b = a.clone().add(new THREE.Vector3((rand(i + 4) - 0.5) * 3, (rand(i + 5) - 0.5) * 3, (rand(i + 6) - 0.5) * 3));
    webPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
  }
  const webGeo = new THREE.BufferGeometry(); webGeo.setAttribute('position', new THREE.BufferAttribute(webPos, 3));
  const webMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const web = new THREE.LineSegments(webGeo, webMat); web.position.y = 1.2; scene.add(web);

  void Promise.all([glyphCells('学', 120, 120, 5), worldP, lightP]).then(([cells, world, baked]) => {
    placeStones(world, baked);
    placeRocks(world);
    const s = CELL / 5;
    targets = cells.map((c) => new THREE.Vector3(c.x * s, c.y * s + 3.6, (rand(c.x * 3 + c.y) - 0.5) * 0.06));
    scatter = targets.map((t, i) => t.clone().add(new THREE.Vector3((rand(i + 10) - 0.5) * 14, (rand(i + 11) - 0.2) * 9, (rand(i + 12) - 0.5) * 10)));
    burst = targets.map((t, i) => new THREE.Vector3(t.x * 1.4 + (rand(i + 13) - 0.5) * 10, (rand(i + 14) - 0.3) * 9, -6 - rand(i + 15) * 26));
    spin = targets.map((_, i) => new THREE.Vector3(rand(i + 16) - 0.5, rand(i + 17) - 0.5, rand(i + 18) - 0.5).multiplyScalar(6));
    delay = targets.map((t, i) => (t.y + 2) * 0.02 + rand(i + 19) * 0.25);
    jitter = targets.map((_, i) => new THREE.Vector3(rand(i + 30) - 0.5, rand(i + 31) - 0.5, rand(i + 32) - 0.5).multiplyScalar(0.09));
    jscale = targets.map((_, i) => 0.9 + rand(i + 33) * 0.12);
    // The bricks let go one at a time, the crack running down from the top:
    // the first few slowly, one by one, then faster and faster.
    const order = targets.map((t, i) => ({ i, k: -t.y + t.x * 0.22 + rand(i + 34) * 1.4 })).sort((p, q) => p.k - q.k);
    detachAt = new Array(targets.length).fill(0);
    order.forEach(({ i }, r) => { detachAt[i] = 0.312 + 0.098 * Math.pow(r / Math.max(1, order.length - 1), 0.6); });
    kick = targets.map((t, i) => new THREE.Vector3(t.x * 0.5 + (rand(i + 35) - 0.5) * 1.4, 1.2 + rand(i + 36) * 1.6, 2.6 + rand(i + 37) * 2.4));
    detachT = targets.map(() => -1);
    // Their dust: a few soft puffs around each brick, all waiting unborn.
    const n = targets.length * DUST, org = new Float32Array(n * 3), vel = new Float32Array(n * 3), seed = new Float32Array(n);
    targets.forEach((t, i) => { for (let k = 0; k < DUST; k++) {
      const j = i * DUST + k, r = (q: number) => rand(j * 7.1 + q);
      org.set([t.x + (r(1) - 0.5) * 0.3, t.y + (r(2) - 0.5) * 0.3, t.z + (r(3) - 0.5) * 0.3], j * 3);
      vel.set([(r(4) - 0.5) * 1.8 + t.x * 0.12, 0.2 + r(5) * 1.3, 0.3 + r(6) * 1.5], j * 3);
      seed[j] = r(7);
    } });
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(org, 3));
    dg.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    dustBirth = new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1);
    dg.setAttribute('aBirth', dustBirth);
    const puff = new THREE.Points(dg, dustMat);
    puff.frustumCulled = false;
    charGroup.add(puff); airy.push(puff);
    const geos = world ? world.bricks : [white(new RoundedBoxGeometry(CELL * 0.95, CELL * 0.95, CELL * 1.6, 3, CELL * 0.14))];
    brickSets = geos.map((g, k) => {
      const ids = targets.map((_, i) => i).filter((i) => Math.floor(rand(i + 77) * geos.length) === k);
      const mesh = new THREE.InstancedMesh(g, blockMat, Math.max(1, ids.length));
      mesh.count = ids.length;
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = true;
      charGroup.add(mesh);
      return { mesh, ids };
    });
    // Grid edges between neighbouring cells: the outline that draws itself first.
    const key = new Map(cells.map((c, i) => [`${c.x},${c.y}`, i]));
    const seg: number[] = [];
    cells.forEach((c, i) => {
      for (const [dx, dy] of [[5, 0], [0, -5], [5, -5]] as const) {
        const j = key.get(`${c.x + dx},${c.y + dy}`);
        if (j !== undefined && (dx === 0 || dy === 0 || rand(i) < 0.35)) { const a = targets[i], b = targets[j]; seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      }
    });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false }));
    charGroup.add(lines);
    settled = true; step();
  }).catch((e) => { console.error('[story] 学', e); settled = true; step(); });

  /* ---------- scene 3: floating ice rocks along the flight ---------- */
  const rocks: THREE.Mesh[] = [];
  const placeRocks = (world: World | null) => { for (let i = 0; i < (low ? 18 : lite ? 26 : 40); i++) {
    const r = 0.5 + rand(i + 40) * 1.6;
    const m = new THREE.Mesh(world ? rockFor(world.rocks[(i * 5 + 3) % ROCKS], r, i + 100) : rockGeo(i + 100, r), rockMat);
    if (world) m.scale.set(r, r * 0.78, r);
    const side = i % 2 ? 1 : -1;
    m.position.set(side * (1.8 + rand(i + 41) * 7), -1 + rand(i + 42) * 7, -14 - rand(i + 43) * 52);
    m.rotation.set(rand(i + 44) * 6, rand(i + 45) * 6, 0);
    m.userData.spin = (rand(i + 46) - 0.5) * 0.3;
    scene.add(m); rocks.push(m);
  } };

  /* ---------- scene 4: eight ice segments in a ring ---------- */
  const ring = new THREE.Group(); ring.position.set(0, 2.4, -80); scene.add(ring);
  const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xeef3f7, roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color(0xcfe9ff), roughnessMap: surf.ice.rough, normalMap: surf.ice.normal, normalScale: new THREE.Vector2(0.5, 0.5), emissive: 0x9fb6cc, emissiveIntensity: 0.08 });
  makeIce(iceMat, { deep: 0x93b5d2, glow: 0xeaf6ff, depth: 0.6, scale: 1.6 });
  // Each segment (and the inner ring) has its own copy of the ice, so it can
  // flash on its own as it locks into place.
  const lockMat = () => { const m = iceMat.clone(); makeIce(m, { deep: 0x93b5d2, glow: 0xeaf6ff, depth: 0.6, scale: 1.6 }); return m; };
  const segs: THREE.Mesh<THREE.TorusGeometry, THREE.MeshPhysicalMaterial>[] = [];
  const segFrom: THREE.Vector3[] = [], segTurn: THREE.Vector2[] = [], segLock: number[] = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 16, 28, (Math.PI * 2) / 8 * 0.78), lockMat());
    m.rotation.z = (i / 8) * Math.PI * 2;
    // Where it waits before flying in: spread wide around the ring, turned askew.
    const a = (i / 8) * Math.PI * 2 + 0.3;
    segFrom.push(new THREE.Vector3(Math.cos(a) * 7.5, Math.sin(a) * 6, (i % 2 ? 1 : -1) * (4 + rand(i + 50) * 3)));
    segTurn.push(new THREE.Vector2((rand(i + 51) - 0.5) * 3, (rand(i + 52) - 0.5) * 3));
    segLock.push(-1);
    ring.add(m); segs.push(m);
  }
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 12, 96), lockMat()); ring.add(inner);
  let innerLock = -1;

  /* ---------- scene 5: the portal ---------- */
  const portal = new THREE.Group(); portal.position.set(0, 2.4, -110); scene.add(portal);
  const portalBlocks: THREE.Mesh[] = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.7 + rand(i + 60) * 0.5, 0.9, 2, 0.12), iceMat);
    b.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, (rand(i + 61) - 0.5) * 0.4);
    b.rotation.set(rand(i + 62) * 0.6, rand(i + 63) * 0.6, a);
    b.userData.home = b.position.clone();
    portal.add(b); portalBlocks.push(b);
  }
  const coreN = lite ? 500 : 900, cp = new Float32Array(coreN * 3);
  for (let i = 0; i < coreN; i++) { const a = rand(i + 70) * 6.283, r = Math.pow(rand(i + 71), 0.6) * 2.6; cp[i * 3] = Math.cos(a) * r; cp[i * 3 + 1] = Math.sin(a) * r; cp[i * 3 + 2] = (rand(i + 72) - 0.5) * 0.8; }
  const coreGeo = new THREE.BufferGeometry(); coreGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const coreMat = new THREE.PointsMaterial({ color: new THREE.Color(1.15, 1.2, 1.28), size: 0.045, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const core = new THREE.Points(coreGeo, coreMat);
  portal.add(core); airy.push(core);
  const portalLight = new THREE.PointLight(0xdaf0ff, 6, 9); portal.add(portalLight);

  /* ---------- scene 6: 开始 out of ice dust on a platform ---------- */
  const fin = new THREE.Group(); fin.position.set(0, 0, -140); scene.add(fin);
  const platMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe4e9, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  makeIce(platMat, { deep: 0x88abc9, glow: 0xeef7ff, depth: 0.45, scale: 0.9 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.35, 128), platMat);
  plat.position.y = 0.1; fin.add(plat);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xcfd5db, roughness: 1, normalMap: surf.snow.normal, normalScale: new THREE.Vector2(0.6, 0.6) });
  makeSnow(floorMat, mobile ? 1.6 : 2.2);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.08; fin.add(floor);
  // The floor and its rings show only from the portal on: seen from the ring
  // they were a grey disc hanging in the fog.
  const finGround: THREE.Object3D[] = [floor];
  [5, 6.4, 8.2].forEach((r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.06; fin.add(m); finGround.push(m);
  });
  let dust: THREE.Points | null = null, dustHome: Float32Array | null = null, dustFrom: Float32Array | null = null;
  glyphCells('开始', 220, 110, 2).then((cells) => {
    const n = Math.min(cells.length, low ? 1500 : lite ? 2200 : 4000), stride = cells.length / n;
    dustHome = new Float32Array(n * 3); dustFrom = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = cells[Math.floor(i * stride)];
      dustHome.set([c.x * 0.032, c.y * 0.032 + 2.3, (rand(i + 80) - 0.5) * 0.25], i * 3);
      dustFrom.set([(rand(i + 81) - 0.5) * 18, rand(i + 82) * 9 - 1, (rand(i + 83) - 0.5) * 12], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dustFrom.slice(), 3));
    // Glowing dust is light, not a thing in the mist: no fog on it (nor on the portal core).
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.06 : 0.05, transparent: true, depthWrite: false, fog: false }));
    fin.add(dust); airy.push(dust);
  });

  /* ---------- scanned materials replace the procedural ones ---------- */
  // Fetched after the page has loaded, so they never delay it.
  const scans = () => {
    loadScan('snow', big, aniso).then((s) => {
      hillMat.normalScale.set(0.6, 0.6); applyScan(hillMat, s, 22, 0.35); hillMat.color.set(0xf2f5f8);
      // The floor is a circle of radius 30: its uv spans 60 m, the hill's 80 m.
      floorMat.normalScale.set(0.5, 0.5); applyScan(floorMat, { col: s.col.clone(), nor: s.nor.clone(), arm: s.arm.clone() }, 16, 0.35); floorMat.color.set(0xeaeef2);
    }).catch((e) => console.warn('[story] snow', e));
    loadScan('rock', big, aniso).then((s) => {
      for (const m of [rockMat, stoneMat]) { m.normalScale.set(1.1, 1.1); applyScan(m, s, 1, 0.6); m.color.set(0xd3dae1); }
    }).catch((e) => console.warn('[story] rock', e));
  };
  if (!rich) { /* procedural maps only */ } else if (document.readyState === 'complete') scans(); else addEventListener('load', scans, { once: true });

  /* ---------- snow falling around the camera ---------- */
  // A box of flakes that travels with the camera (centred a little ahead of
  // it): each flake falls and drifts in the wind, and wraps round the box, so
  // it snows wherever the flight goes. Near flakes are big and soft, like out
  // of focus; far ones fade into the fog.
  const snowN = low ? 800 : lite ? 1300 : 2600, sp = new Float32Array(snowN * 4);
  for (let i = 0; i < snowN; i++) sp.set([rand(i + 90), rand(i + 91), rand(i + 92), rand(i + 93)], i * 4);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(snowN * 3), 3));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(sp, 4));
  const snowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 15, 34) }, uFall: { value: reduced ? 0 : 1 }, uMax: { value: 34 * renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime; uniform float uScale; uniform vec3 uCenter; uniform vec3 uBox; uniform float uFall; uniform float uMax;
      varying float vA; varying float vSoft;
      void main() {
        float w = aSeed.w;
        vec3 p = aSeed.xyz * uBox;
        p.y -= uTime * (0.5 + w * 0.8) * uFall;
        p.x += uTime * 0.3 * uFall + sin(uTime * 0.7 + w * 31.0) * 0.4 * uFall;
        p.z += sin(uTime * 0.5 + aSeed.x * 23.0) * 0.3 * uFall;
        vec3 lo = uCenter - uBox * 0.5;
        p = lo + mod(p - lo, uBox);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        float px = (0.018 + w * w * w * 0.05) * uScale / max(0.05, depth);
        gl_PointSize = clamp(px, 1.0, uMax);
        vSoft = clamp((px - 5.0) / 20.0, 0.0, 1.0);
        vA = smoothstep(0.3, 1.3, depth) * (1.0 - smoothstep(uBox.z * 0.38, uBox.z * 0.5, depth)) * mix(0.95, 0.55, vSoft);
      }`,
    fragmentShader: SOFT_FRAG,
    transparent: true, depthWrite: false,
  });
  const flakes = new THREE.Points(snowGeo, snowMat);
  flakes.frustumCulled = false;
  scene.add(flakes); airy.push(flakes);

  /* ---------- the camera path ---------- */
  // Keyframes: [story, position, look-at, roll (banking), extra FOV, hold].
  // Position and aim follow Catmull-Rom curves through the keys; the speed
  // along them is a smooth monotone spline, so the camera never stops dead at
  // a key, except where `hold` (< 1) makes it linger: on the finished 学 and on
  // the assembled ring.
  const M = mobile, V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const keys: [number, THREE.Vector3, THREE.Vector3, number, number, number][] = [
    [0.0, V(-2.4, 6.4, M ? 22.5 : 17.5), V(0, 4.5, 0), 0, 0, 1], // crane down onto the drawing
    [0.2, V(3.4, 3.4, M ? 17 : 13), V(0, M ? 2.7 : 3.2, 0), -0.035, 0, 0.7], // arc round the ice 学
    [0.3, V(M ? 0 : 0.3, 3.3, M ? 14.5 : 10), V(0, 3.5, 0), 0, 0, 0.35], // linger on it
    [0.35, V(-1.6, 4.6, M ? 14.5 : 11.5), V(0, 4.2, -2), 0.04, 2, 1], // back off as it starts to crumble
    [0.4, V(3.6, 4.2, 1), V(0, 3, -22), 0.14, 8, 1], // swoop past it, banking
    [0.44, V(-0.6, 3.5, -20), V(0.6, 2.5, -50), -0.12, 8, 1], // weave through the rocks
    [0.5, V(0.5, 2.6, -46), V(0, 2.4, -80), 0.06, 4, 1],
    [0.56, V(M ? 1.8 : 3.6, 3.4, M ? -61 : -66), V(0, 2.4, -80), 0.03, 0, 0.6], // the ring assembles, seen askew
    [0.63, V(0, 2.4, M ? -68 : -71), V(0, 2.4, -80), 0, 0, 0.4], // and face on
    [0.72, V(0, 2.4, M ? -90 : -92), V(0, 2.4, -110), 0, 0, 1], // through it to the portal
    [0.79, V(0, 2.4, -105), V(0, 2.4, -112), 0, 14, 1], // dolly-zoom into the portal
    [0.86, V(0, 3.4, -121), V(0, 1.8, -140), 0, 2, 1],
    [0.93, V(-2.6, 5.2, M ? -127 : -129), V(0, 1.8, -140), -0.03, 0, 1], // crane over the platform
    [1.0, V(0, 3.6, M ? -128 : -131), V(0, 2.3, -140), 0, 0, 1],
  ];
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[2]), false, 'centripetal');
  const feelCurve = new THREE.CatmullRomCurve3(keys.map((k) => V(k[3], k[4], 0)), false, 'catmullrom', 0.5);
  // Monotone cubic (Fritsch–Butland) from story progress to key index.
  const ks = keys.map((k) => k[0]), last = keys.length - 1;
  const slope = ks.map((_, i) => {
    if (i === 0 || i === last) return 0;
    const h0 = ks[i] - ks[i - 1], h1 = ks[i + 1] - ks[i], d0 = 1 / h0, d1 = 1 / h1;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return ((w1 + w2) / (w1 / d0 + w2 / d1)) * keys[i][5];
  });
  const along = (s: number) => {
    let i = 0; while (i < last - 1 && s > ks[i + 1]) i++;
    const h = ks[i + 1] - ks[i], x = clamp01((s - ks[i]) / h), x2 = x * x, x3 = x2 * x;
    const y = (2 * x3 - 3 * x2 + 1) * i + (x3 - 2 * x2 + x) * h * slope[i] + (-2 * x3 + 3 * x2) * (i + 1) + (x3 - x2) * h * slope[i + 1];
    return Math.min(1, Math.max(0, y / last));
  };
  const baseFov = camera.fov, feel = new THREE.Vector3(), fwd = new THREE.Vector3(), buf = new THREE.Vector2();

  /* ---------- sound (sound.ts) ---------- */
  const sound = createSound();
  let pushGoal = 0, push = 0;

  /* ---------- loop ---------- */
  let scrollP = 0, story = 0, intro = reduced ? 1 : 0, mx = 0, my = 0, tx = 0, ty = 0, ready = false;
  // The portal flash: the time the camera last passed through it going forward.
  let flashT = -1, flash = 0, prevZ = Infinity, prevS = 0;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; } }, { passive: true });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); });

  // The governor: if the device cannot hold about 40 frames a second, the
  // picture gets cheaper, one step at a time, and never dearer again:
  // fewer pixels, then no depth of field and contact shadows, then fewer still.
  let govN = 0, govSum = 0, govSkip = 2, govLevel = 0;
  const setRatio = (r: number) => {
    pixelRatio = r; renderer.setPixelRatio(r); composer.setPixelRatio(r);
    snowMat.uniforms.uMax.value = 34 * r;
  };
  const govern = (real: number) => {
    if (soft || govLevel >= 3 || real > 0.25) return; // a software renderer has nothing left to give; a long gap is a hidden tab
    govSum += real;
    if (++govN < 50) return;
    const avg = govSum / govN; govN = 0; govSum = 0;
    if (govSkip > 0) { govSkip--; return; } // the first windows include shader compilation
    if (avg < 0.026) return;
    govLevel++; govSkip = 1;
    if (govLevel === 2) { bokeh.enabled = false; if (ao) ao.enabled = false; }
    else setRatio(Math.max(1, pixelRatio * 0.75));
    document.documentElement.dataset.quality = `${quality}-${govLevel}`;
  };

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const look = new THREE.Vector3();
  const clock = new THREE.Clock();
  // ?capture: frames advance only when a recorder calls __step(dt), for smooth offline video.
  const capture = new URLSearchParams(location.search).has('capture');
  let stepDt = 0, capT = 0;
  if (capture) (window as unknown as { __step: (d: number) => void }).__step = (d: number) => { stepDt = d; capT += d; frame(); };
  const frame = () => {
    if (!capture) requestAnimationFrame(frame);
    if (document.hidden && !capture) return;
    // Wall-clock time drives the intro and the scroll follow, so a slow device
    // is never held back; the clamped step drives the physical motion.
    const real = capture ? stepDt : clock.getDelta(), dt = Math.min(real, 0.05), t = capture ? capT : clock.elapsedTime;
    // The intro starts once the models are in (or given up on).
    if (intro < 1 && (settled || t > 3)) intro = Math.min(1, intro + real / 3.6);
    const goal = 0.2 * ease(intro) + 0.8 * scrollP;
    story += (goal - story) * Math.min(1, real * 3.2);
    const s = story;
    const speed = real > 0 ? (s - prevS) / real : 0;
    prevS = s;
    push += (pushGoal - push) * Math.min(1, dt * 3);
    flash = flashT >= 0 && !reduced ? Math.exp(-(t - flashT) * 2.6) : 0;
    mx += (tx - mx) * dt * 2; my += (ty - my) * dt * 2;

    // Camera: the path, the mouse parallax, a slow handheld drift and a shake
    // when the bricks break and when the portal flashes.
    const u = along(s);
    posCurve.getPoint(u, camera.position);
    lookCurve.getPoint(u, look);
    feelCurve.getPoint(u, feel);
    const pathZ = camera.position.z;
    camera.position.x += mx * 0.6; camera.position.y -= my * 0.35;
    let roll = feel.x;
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.43) * 0.05 + Math.sin(t * 0.91 + 1.3) * 0.025;
      camera.position.y += Math.sin(t * 0.57 + 0.7) * 0.04;
      roll += Math.sin(t * 0.37 + 2.1) * 0.006;
      const shake = 0.035 * bump(s, 0.31, 0.41) + 0.14 * flash;
      if (shake > 0.001) {
        camera.position.x += (Math.sin(t * 37.1) + Math.sin(t * 23.7 + 1)) * 0.5 * shake;
        camera.position.y += (Math.sin(t * 31.3 + 2) + Math.sin(t * 19.9)) * 0.5 * shake;
        roll += Math.sin(t * 27.3) * shake * 0.12;
      }
    }
    camera.lookAt(look);
    camera.rotateZ(roll);
    camera.fov = baseFov + feel.y;
    camera.updateProjectionMatrix();
    (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.distanceTo(look);
    // Pixels per metre at one metre away, for the soft sprites.
    const pxScale = renderer.getDrawingBufferSize(buf).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    dustMat.uniforms.uScale.value = snowMat.uniforms.uScale.value = pxScale;
    dustMat.uniforms.uTime.value = snowMat.uniforms.uTime.value = t;
    camera.getWorldDirection(fwd);
    snowMat.uniforms.uCenter.value.copy(camera.position).addScaledVector(fwd, 11);
    // Mountains only where there is ground under them: the hill and the final platform.
    ranges.forEach((r) => { r.position.set(camera.position.x, 0, camera.position.z); r.visible = s < 0.46 || s > 0.84; });
    beams.forEach((b) => { (b.material as THREE.SpriteMaterial).opacity = 0.11 + 0.06 * Math.sin(t * 0.35 + b.userData.phase); });
    // The fog's wind time, and the wisps drifting with it.
    fog.near = reduced ? 0 : t;
    mist.tick(t, camera.position, !reduced);

    // Scene 1–3: web, outline, blocks.
    webMat.opacity = 0.75 * (1 - ramp(s, 0.1, 0.18)) * ramp(s, 0, 0.03);
    web.visible = webMat.opacity > 0.01;
    if (lines) {
      const total = lines.geometry.getAttribute('position').count;
      lines.geometry.setDrawRange(0, Math.floor(total * ramp(s, 0.0, 0.09) / 2) * 2);
      (lines.material as THREE.LineBasicMaterial).opacity = 1 - ramp(s, 0.13, 0.19);
      lines.visible = s < 0.2;
    }
    if (brickSets.length) {
      let broke = 0;
      for (const { mesh, ids } of brickSets) for (let j = 0; j < ids.length; j++) {
        const i = ids[j];
        const a = ease(ramp(s, 0.06 + delay[i] * 0.25, 0.15 + delay[i] * 0.25));
        v3.copy(scatter[i]).lerp(targets[i], a);
        // Breaking off: a short tremble, then the brick lets go in a puff of
        // snow dust, pops out towards the camera and arcs away down the flight.
        // It keeps drifting a little on its own even if the scroll stops.
        const d = detachAt[i];
        if (s >= d && detachT[i] < 0) { detachT[i] = t; markDust(i, t); broke++; }
        else if (s < d && detachT[i] >= 0) { detachT[i] = -1; markDust(i, -1); }
        let f = ramp(s, d, d + 0.075);
        if (detachT[i] >= 0 && !reduced) f = Math.max(f, 0.3 * (1 - Math.exp(-(t - detachT[i]) * 1.8)));
        if (f > 0) {
          const g = 1 - (1 - f) * (1 - f), w0 = (1 - g) * (1 - g), w1 = 2 * (1 - g) * g, w2 = g * g, tg = targets[i], kk = kick[i], bu = burst[i];
          v3.set(w0 * v3.x + w1 * (tg.x + kk.x) + w2 * bu.x, w0 * v3.y + w1 * (tg.y + kk.y) + w2 * bu.y, w0 * v3.z + w1 * (tg.z + kk.z) + w2 * bu.z);
        } else if (!reduced) {
          const shiver = ramp(s, d - 0.014, d);
          if (shiver > 0) { v3.x += Math.sin(t * 61 + i) * 0.02 * shiver; v3.y += Math.sin(t * 47 + i * 1.7) * 0.014 * shiver; }
        }
        const out = f * 1.6;
        const hover = push * (1 - Math.min(1, f * 3));
        v3.x += (targets[i].x) * 0.25 * hover; v3.y += (targets[i].y - 3) * 0.25 * hover; v3.z += Math.sin(i) * 0.6 * hover;
        e3.set(spin[i].x * (1 - a + out) + jitter[i].x, spin[i].y * (1 - a + out) + jitter[i].y, spin[i].z * (1 - a + out) + jitter[i].z);
        q.setFromEuler(e3);
        const k = a * (1 - ramp(s, 0.44, 0.5)) * jscale[i];
        sc.set(k, k, k);
        mesh.setMatrixAt(j, m4.compose(v3, q, k > 0.001 ? sc : one.clone().multiplyScalar(0.0001)));
      }
      blockMat.emissiveIntensity = ramp(s, 0.13, 0.2) * (0.9 + 0.35 * Math.sin(t * 1.6)) + push * 0.8;
      for (const { mesh } of brickSets) { mesh.instanceMatrix.needsUpdate = true; mesh.visible = s < 0.5; }
      if (dustBirth && dustDirty) { dustBirth.needsUpdate = true; dustDirty = false; }
      if (broke) sound.crunch(broke);
    }
    hill.visible = s < 0.5;
    finGround.forEach((o) => { o.visible = s > 0.78; });

    for (const r of rocks) { r.rotation.y += r.userData.spin * dt; r.rotation.x += r.userData.spin * dt * 0.5; }
    // Scene 4: the eight segments (the eight steps of a lesson) fly in one by
    // one and click into the turning ring, each flashing as it locks; then the
    // inner ring springs up.
    ring.rotation.z = (reduced ? 0 : t * 0.15) + s * 4;
    ring.rotation.x = Math.sin(t * 0.3) * 0.15 + 0.2;
    segs.forEach((m, i) => {
      const r = ramp(s, 0.49 + i * 0.0145, 0.518 + i * 0.0145), e = easeBack(r), k = 1 - e;
      m.position.copy(segFrom[i]).multiplyScalar(k);
      m.rotation.x = segTurn[i].x * k; m.rotation.y = segTurn[i].y * k;
      if (r >= 1 && segLock[i] < 0) { segLock[i] = t; sound.clink(i); } else if (r < 1) segLock[i] = -1;
      m.material.emissiveIntensity = 0.08 + (segLock[i] >= 0 && !reduced ? 1.5 * Math.exp(-(t - segLock[i]) * 3) : 0);
    });
    const ir = ramp(s, 0.6, 0.635);
    inner.scale.setScalar(Math.max(0.0001, easeBack(ir)));
    if (ir >= 1 && innerLock < 0) { innerLock = t; sound.clink(8); } else if (ir < 1) innerLock = -1;
    inner.material.emissiveIntensity = 0.08 + (innerLock >= 0 && !reduced ? 1.2 * Math.exp(-(t - innerLock) * 2.5) : 0);
    inner.rotation.y = t * 0.6;
    // Scene 5: the portal breathes; its core spins faster as the camera
    // comes near, and flashes white when the camera passes through.
    if (prevZ > portal.position.z && pathZ <= portal.position.z && Number.isFinite(prevZ)) { flashT = t; sound.boom(); }
    prevZ = pathZ;
    const pd = Math.abs(camera.position.z - portal.position.z);
    const near = pathZ > portal.position.z ? clamp01(1 - (pd - 1) / 12) : 0;
    portal.rotation.z = reduced ? 0 : t * 0.08;
    core.rotation.z -= dt * (0.4 + near * 3.5);
    core.scale.setScalar(1 + flash * 1.8 - near * 0.25);
    portalBlocks.forEach((b) => b.position.copy(b.userData.home).multiplyScalar(1 + flash * 0.3));
    portalLight.intensity = 4 + Math.sin(t * 2) * 1.5 + near * 3 + flash * 30;
    iceMat.emissiveIntensity = 0.08 + flash * 1.2;
    bloom.strength = 0.32 + flash * 1.1;
    grade.uniforms.uFlash.value = flash;
    // Fade the core as the camera flies through it, so it never floods the screen.
    coreMat.opacity = 0.9 * clamp01((pd - 2) / 6);
    // The portal hums louder the nearer the camera is, and dies away behind it.
    sound.update(speed, pathZ > portal.position.z ? clamp01(1 - (pd - 2) / 34) : clamp01(1 - pd / 10) * 0.5);
    // Scene 6: dust gathers into 开始.
    if (dust && dustHome && dustFrom) {
      const g = ease(ramp(s, 0.8, 0.95));
      const arr = (dust.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const w = Math.sin(t * 1.3 + i) * 0.03 * (1 - g);
        arr[i] = dustFrom[i] + (dustHome[i] - dustFrom[i]) * g + w;
        arr[i + 1] = dustFrom[i + 1] + (dustHome[i + 1] - dustFrom[i + 1]) * g + w;
        arr[i + 2] = dustFrom[i + 2] + (dustHome[i + 2] - dustFrom[i + 2]) * g;
      }
      dust.geometry.getAttribute('position').needsUpdate = true;
      dust.rotation.y = Math.sin(t * 0.4) * 0.12 * (1 - g * 0.6);
    }

    grade.uniforms.uTime.value = t;
    grade.uniforms.uGrain.value = reduced ? 1 : Math.floor(t * 24);
    grade.uniforms.uCell.value = Math.max(1, renderer.getPixelRatio() * 0.75);
    tickMaterials(t);
    composer.render();
    if (!ready && (settled || t > 3) && t > 0.15) { ready = true; step(); onProgress?.(1); onReady(); }
    else if (ready && !capture) govern(real);
  };
  frame();

  return {
    setScroll(p) { scrollP = clamp01(p); },
    progress: () => story,
    hover(on) { pushGoal = on && !reduced ? 1 : 0; sound.muffle(on); },
    toggleSound: () => sound.toggle(),
  };
}
