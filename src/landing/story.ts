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

export function createStory(host: HTMLElement, onReady: () => void): Story | null {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch { return null; }
  try { return build(host, onReady); } catch (e) { console.error('[story]', e); return null; }
}

function build(host: HTMLElement, onReady: () => void): Story {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth <= 820;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(FOG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 14, 46);
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
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  // Contact shadows in the crevices between bricks and rocks (too heavy for phones).
  if (!mobile) {
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 });
    ao.blendIntensity = 0.85;
    skipAiry(ao);
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.97);
  composer.addPass(bloom);
  // Depth of field: the subject sharp, the far fog and near snow soft.
  const bokeh = new BokehPass(scene, camera, { focus: 12, aperture: mobile ? 0.0012 : 0.0018, maxblur: mobile ? 0.005 : 0.008 });
  skipAiry(bokeh);
  composer.addPass(bokeh);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float d = length(vUv-0.5);
        c *= mix(1.0, 0.82, smoothstep(0.35, 0.85, d)); c += (h(vUv*(uTime+1.0)*80.0)-0.5)*0.03;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  composer.addPass(grade);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f8a96, 1.1);
  scene.add(hemi);
  // Without a graphics card (a software renderer: seconds per frame) the scans
  // and the sky only stall the page, so it keeps the light procedural look.
  // ?hq forces them anyway (for recordings).
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  const rich = !/swiftshader|llvmpipe|softpipe|software/i.test(gpu) || new URLSearchParams(location.search).has('hq');
  // The overcast winter-field sky replaces the studio room once it arrives,
  // turned so its bright patch of cloud sits where the sun light comes from.
  scene.environmentRotation.y = -1.5;
  if (rich) loadSky(renderer).then((env) => {
    scene.environment = env; scene.environmentIntensity = 0.62; hemi.intensity = 0.55;
  }).catch((e) => console.warn('[story] sky', e));
  const surf = makeSurfaces(mobile);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-7, 13, 9); sun.target.position.set(0, 2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
  // Photo-scanned snow and rock stream in after the first frames (2k on computers).
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const big = !mobile && Math.min(screen.width, screen.height) * devicePixelRatio >= 1000;

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
  const hillGeo = new THREE.PlaneGeometry(80, 80, mobile ? 170 : 240, mobile ? 170 : 240);
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
    for (let i = 0; i < (mobile ? 2 : 3); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: beamTex, color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set((rand(j * 7 + i) - 0.5) * 16, 7 + rand(j * 7 + i + 1) * 3, z - 6 - rand(j * 7 + i + 2) * 8);
      sp.scale.set(2.2 + rand(j * 7 + i + 3) * 2.5, 16, 1);
      sp.material.rotation = -0.38 + (rand(j * 7 + i + 4) - 0.5) * 0.2;
      sp.userData.phase = rand(j * 7 + i + 5) * 6;
      scene.add(sp); beams.push(sp); airy.push(sp);
    }
  });

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
  let lines: THREE.LineSegments | null = null;
  const charGroup = new THREE.Group(); charGroup.position.set(0, 1.25, 0); scene.add(charGroup);

  // A loose web of thin lines around the character, like a survey being drawn.
  const webN = mobile ? 70 : 120, webPos = new Float32Array(webN * 6);
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
    settled = true;
  }).catch((e) => { console.error('[story] 学', e); settled = true; });

  /* ---------- scene 3: floating ice rocks along the flight ---------- */
  const rocks: THREE.Mesh[] = [];
  const placeRocks = (world: World | null) => { for (let i = 0; i < (mobile ? 26 : 40); i++) {
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
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 16, 28, (Math.PI * 2) / 8 * 0.78), iceMat);
    m.rotation.z = (i / 8) * Math.PI * 2;
    ring.add(m); segs.push(m);
  }
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 12, 96), iceMat); ring.add(inner);

  /* ---------- scene 5: the portal ---------- */
  const portal = new THREE.Group(); portal.position.set(0, 2.4, -110); scene.add(portal);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.7 + rand(i + 60) * 0.5, 0.9, 2, 0.12), iceMat);
    b.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, (rand(i + 61) - 0.5) * 0.4);
    b.rotation.set(rand(i + 62) * 0.6, rand(i + 63) * 0.6, a);
    portal.add(b);
  }
  const coreN = mobile ? 500 : 900, cp = new Float32Array(coreN * 3);
  for (let i = 0; i < coreN; i++) { const a = rand(i + 70) * 6.283, r = Math.pow(rand(i + 71), 0.6) * 2.6; cp[i * 3] = Math.cos(a) * r; cp[i * 3 + 1] = Math.sin(a) * r; cp[i * 3 + 2] = (rand(i + 72) - 0.5) * 0.8; }
  const coreGeo = new THREE.BufferGeometry(); coreGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const coreMat = new THREE.PointsMaterial({ color: new THREE.Color(1.15, 1.2, 1.28), size: 0.045, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
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
  [5, 6.4, 8.2].forEach((r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.06; fin.add(m);
  });
  let dust: THREE.Points | null = null, dustHome: Float32Array | null = null, dustFrom: Float32Array | null = null;
  glyphCells('开始', 220, 110, 2).then((cells) => {
    const n = Math.min(cells.length, mobile ? 2200 : 4000), stride = cells.length / n;
    dustHome = new Float32Array(n * 3); dustFrom = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = cells[Math.floor(i * stride)];
      dustHome.set([c.x * 0.032, c.y * 0.032 + 2.3, (rand(i + 80) - 0.5) * 0.25], i * 3);
      dustFrom.set([(rand(i + 81) - 0.5) * 18, rand(i + 82) * 9 - 1, (rand(i + 83) - 0.5) * 12], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dustFrom.slice(), 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.06 : 0.05, transparent: true, depthWrite: false }));
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

  /* ---------- snow everywhere ---------- */
  const snowN = mobile ? 900 : 1800, sp = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) { sp[i * 3] = (rand(i + 90) - 0.5) * 40; sp[i * 3 + 1] = rand(i + 91) * 14 - 1; sp[i * 3 + 2] = 18 - rand(i + 92) * 170; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const flakes = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.06 : 0.05, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(flakes); airy.push(flakes);

  /* ---------- the camera path ---------- */
  const keys: [number, THREE.Vector3, THREE.Vector3][] = [
    [0.0, new THREE.Vector3(0, 4.6, mobile ? 21 : 16), new THREE.Vector3(0, 4.2, 0)],
    [0.2, new THREE.Vector3(3.4, 3.4, mobile ? 17 : 13), new THREE.Vector3(0, mobile ? 2.7 : 3.2, 0)],
    [0.3, new THREE.Vector3(0, 3.2, mobile ? 12 : 9.5), new THREE.Vector3(0, 3.2, 0)],
    [0.46, new THREE.Vector3(0.5, 2.6, -40), new THREE.Vector3(0, 2.2, -70)],
    [0.6, new THREE.Vector3(0, 2.4, mobile ? -68 : -71), new THREE.Vector3(0, 2.4, -80)],
    [0.76, new THREE.Vector3(0, 2.4, mobile ? -98 : -101), new THREE.Vector3(0, 2.4, -110)],
    [0.92, new THREE.Vector3(0, 5.2, mobile ? -125 : -128), new THREE.Vector3(0, 1.8, -140)],
    [1.0, new THREE.Vector3(0, 3.6, mobile ? -128 : -131), new THREE.Vector3(0, 2.3, -140)],
  ];
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[2]), false, 'centripetal');
  const along = (s: number) => {
    let i = 0; while (i < keys.length - 2 && s > keys[i + 1][0]) i++;
    const t = ease(clamp01((s - keys[i][0]) / (keys[i + 1][0] - keys[i][0])));
    return (i + t) / (keys.length - 1);
  };

  /* ---------- wind ---------- */
  let audio: { ctx: AudioContext; master: GainNode; lp: BiquadFilterNode } | null = null, soundOn = false;
  const ensureAudio = () => {
    if (audio) return audio;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(), master = ctx.createGain(), lp = ctx.createBiquadFilter();
    master.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master); master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 480; band.Q.value = 0.6;
    const wob = ctx.createOscillator(), wg = ctx.createGain(); wob.frequency.value = 0.08; wg.gain.value = 240; wob.connect(wg); wg.connect(band.frequency);
    const ng = ctx.createGain(); ng.gain.value = 0.06; noise.connect(band); band.connect(ng); ng.connect(lp);
    [146.8, 220, 329.6].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.detune.value = i * 5 - 5; g.gain.value = 0.01; o.connect(g); g.connect(lp); o.start(); });
    noise.start(); wob.start();
    return (audio = { ctx, master, lp });
  };
  let pushGoal = 0, push = 0;
  const applyAudio = () => {
    if (!audio) return;
    const now = audio.ctx.currentTime, muffled = pushGoal > 0.5;
    audio.master.gain.cancelScheduledValues(now); audio.master.gain.setValueAtTime(audio.master.gain.value, now);
    audio.master.gain.linearRampToValueAtTime(soundOn ? (muffled ? 0.35 : 0.8) : 0, now + 1);
    audio.lp.frequency.cancelScheduledValues(now); audio.lp.frequency.setValueAtTime(audio.lp.frequency.value, now);
    audio.lp.frequency.linearRampToValueAtTime(muffled ? 280 : 900, now + 1);
  };

  /* ---------- loop ---------- */
  let scrollP = 0, story = 0, intro = reduced ? 1 : 0, mx = 0, my = 0, tx = 0, ty = 0, ready = false;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; } }, { passive: true });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); });

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
    push += (pushGoal - push) * Math.min(1, dt * 3);
    mx += (tx - mx) * dt * 2; my += (ty - my) * dt * 2;

    // Camera.
    const u = along(s);
    posCurve.getPoint(u, camera.position);
    lookCurve.getPoint(u, look);
    camera.position.x += mx * 0.6; camera.position.y -= my * 0.35;
    camera.lookAt(look);
    (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.distanceTo(look);
    // Mountains only where there is ground under them: the hill and the final platform.
    ranges.forEach((r) => { r.position.set(camera.position.x, 0, camera.position.z); r.visible = s < 0.46 || s > 0.84; });
    beams.forEach((b) => { (b.material as THREE.SpriteMaterial).opacity = 0.11 + 0.06 * Math.sin(t * 0.35 + b.userData.phase); });

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
      const settle = s, out = ease(ramp(s, 0.31, 0.47));
      for (const { mesh, ids } of brickSets) for (let j = 0; j < ids.length; j++) {
        const i = ids[j];
        const a = ease(ramp(settle, 0.06 + delay[i] * 0.25, 0.15 + delay[i] * 0.25));
        v3.copy(scatter[i]).lerp(targets[i], a);
        if (out > 0) v3.lerp(burst[i], out);
        const hover = push * (1 - out);
        v3.x += (targets[i].x) * 0.25 * hover; v3.y += (targets[i].y - 3) * 0.25 * hover; v3.z += Math.sin(i) * 0.6 * hover;
        e3.set(spin[i].x * (1 - a + out) + jitter[i].x, spin[i].y * (1 - a + out) + jitter[i].y, spin[i].z * (1 - a + out) + jitter[i].z);
        q.setFromEuler(e3);
        const k = a * (1 - ramp(s, 0.44, 0.5)) * jscale[i];
        sc.set(k, k, k);
        mesh.setMatrixAt(j, m4.compose(v3, q, k > 0.001 ? sc : one.clone().multiplyScalar(0.0001)));
      }
      blockMat.emissiveIntensity = ramp(s, 0.13, 0.2) * (0.9 + 0.35 * Math.sin(t * 1.6)) + push * 0.8;
      for (const { mesh } of brickSets) { mesh.instanceMatrix.needsUpdate = true; mesh.visible = s < 0.5; }
    }
    hill.visible = s < 0.5;

    for (const r of rocks) { r.rotation.y += r.userData.spin * dt; r.rotation.x += r.userData.spin * dt * 0.5; }
    // Scene 4: the ring turns, its segments open with the scroll.
    const open = ramp(s, 0.5, 0.62);
    ring.rotation.z = (reduced ? 0 : t * 0.15) + s * 4;
    ring.rotation.x = Math.sin(t * 0.3) * 0.15 + 0.2;
    segs.forEach((m, i) => { const a = (i / 8) * Math.PI * 2 + 0.3; m.position.set(Math.cos(a) * (1 - open) * 1.2, Math.sin(a) * (1 - open) * 1.2, (1 - open) * (i % 2 ? 1.5 : -1.5)); });
    inner.rotation.y = t * 0.6;
    // Scene 5: the portal breathes.
    portal.rotation.z = reduced ? 0 : t * 0.08;
    core.rotation.z = -t * 0.4;
    portalLight.intensity = 4 + Math.sin(t * 2) * 1.5;
    // Fade the core as the camera flies through it, so it never floods the screen.
    const pd = Math.abs(camera.position.z - portal.position.z);
    coreMat.opacity = 0.9 * clamp01((pd - 2) / 6);
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
    tickMaterials(t);
    composer.render();
    if (!ready && (settled || t > 3) && t > 0.15) { ready = true; onReady(); }
  };
  frame();

  return {
    setScroll(p) { scrollP = clamp01(p); },
    progress: () => story,
    hover(on) { pushGoal = on && !reduced ? 1 : 0; applyAudio(); },
    toggleSound() {
      try { const a = ensureAudio(); if (a.ctx.state === 'suspended') void a.ctx.resume(); soundOn = !soundOn; applyAudio(); } catch { soundOn = false; }
      return soundOn;
    },
  };
}
