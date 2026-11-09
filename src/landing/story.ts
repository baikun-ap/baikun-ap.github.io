import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

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

const BLOCK_VERT = `
  varying vec3 vN; varying vec2 vUv; varying float vDepth;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vN = normalize(mat3(m) * normal);
    vUv = uv;
    vec4 mv = viewMatrix * m * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const BLOCK_FRAG = `
  uniform float uGlow; uniform vec3 uFog; uniform float uNear; uniform float uFar;
  varying vec3 vN; varying vec2 vUv; varying float vDepth;
  void main() {
    float l = 0.58 + 0.42 * max(dot(normalize(vN), normalize(vec3(-0.4, 0.85, 0.35))), 0.0);
    vec3 col = vec3(0.86, 0.89, 0.92) * l;
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float seam = 1.0 - smoothstep(0.03, 0.11, e);
    col = mix(col, vec3(1.12, 1.18, 1.25), seam * uGlow);
    col += vec3(0.12, 0.16, 0.2) * uGlow * (1.0 - seam) * 0.4;
    float f = smoothstep(uNear, uFar, vDepth);
    gl_FragColor = vec4(mix(col, uFog, f), 1.0);
  }
`;

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
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.4 : 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(FOG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 14, 46);
  const camera = new THREE.PerspectiveCamera(mobile ? 60 : 46, innerWidth / innerHeight, 0.1, 140);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.97);
  composer.addPass(bloom);
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7f8a96, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-6, 10, 6); scene.add(sun);

  const rand = (s: number) => { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

  /* ---------- scene 2: the snowy hill ---------- */
  const hillGeo = new THREE.PlaneGeometry(70, 70, mobile ? 90 : 140, mobile ? 90 : 140);
  hillGeo.rotateX(-Math.PI / 2);
  const hp = hillGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), z = hp.getZ(i);
    const r2 = x * x + z * z;
    const mound = 1.7 * Math.exp(-r2 / 40) - 0.6 * Math.exp(-r2 / 6) + 0.6;
    const n = Math.sin(x * 0.9) * Math.cos(z * 1.1) * 0.12 + Math.sin(x * 2.7 + z * 1.9) * 0.05 + (rand(i) - 0.5) * 0.06;
    hp.setY(i, mound + n - 1.2 + Math.max(0, (Math.abs(x) - 14)) * 0.35);
  }
  hillGeo.computeVertexNormals();
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ color: 0xe7ebef, roughness: 0.95, flatShading: true }));
  scene.add(hill);

  /* ---------- scenes 1–3: the character 学, lines → ice blocks → burst ---------- */
  const CELL = 0.28;
  const blockMat = new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0 }, uFog: { value: FOG }, uNear: { value: 14 }, uFar: { value: 46 } },
    vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG,
  });
  let blocks: THREE.InstancedMesh | null = null;
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

  glyphCells('学', 120, 120, 5).then((cells) => {
    const s = CELL / 5;
    targets = cells.map((c) => new THREE.Vector3(c.x * s, c.y * s + 3.6, (rand(c.x * 3 + c.y) - 0.5) * 0.06));
    const n = targets.length;
    scatter = targets.map((t, i) => t.clone().add(new THREE.Vector3((rand(i + 10) - 0.5) * 14, (rand(i + 11) - 0.2) * 9, (rand(i + 12) - 0.5) * 10)));
    burst = targets.map((t, i) => new THREE.Vector3(t.x * 1.4 + (rand(i + 13) - 0.5) * 10, (rand(i + 14) - 0.3) * 9, -6 - rand(i + 15) * 26));
    spin = targets.map((_, i) => new THREE.Vector3(rand(i + 16) - 0.5, rand(i + 17) - 0.5, rand(i + 18) - 0.5).multiplyScalar(6));
    delay = targets.map((t, i) => (t.y + 2) * 0.02 + rand(i + 19) * 0.25);
    const geo = new THREE.BoxGeometry(CELL * 0.94, CELL * 0.94, CELL * 1.6);
    blocks = new THREE.InstancedMesh(geo, blockMat, n);
    blocks.frustumCulled = false;
    charGroup.add(blocks);
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
  });

  /* ---------- scene 3: floating ice rocks along the flight ---------- */
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xe3e8ec, roughness: 0.75, flatShading: true, emissive: 0x7d8894, emissiveIntensity: 0.35 });
  const rocks: THREE.Mesh[] = [];
  for (let i = 0; i < (mobile ? 26 : 40); i++) {
    const g = new THREE.IcosahedronGeometry(0.5 + rand(i + 40) * 1.6, 1);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const f = 1 + (rand(i * 31 + k) - 0.5) * 0.45; p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.8, p.getZ(k) * f); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat);
    const side = i % 2 ? 1 : -1;
    m.position.set(side * (1.8 + rand(i + 41) * 7), -1 + rand(i + 42) * 7, -14 - rand(i + 43) * 52);
    m.rotation.set(rand(i + 44) * 6, rand(i + 45) * 6, 0);
    m.userData.spin = (rand(i + 46) - 0.5) * 0.3;
    scene.add(m); rocks.push(m);
  }

  /* ---------- scene 4: eight ice segments in a ring ---------- */
  const ring = new THREE.Group(); ring.position.set(0, 2.4, -80); scene.add(ring);
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.35, metalness: 0.05, flatShading: true, emissive: 0x9fb6cc, emissiveIntensity: 0.12 });
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 6, 10, (Math.PI * 2) / 8 * 0.78), iceMat);
    m.rotation.z = (i / 8) * Math.PI * 2;
    ring.add(m); segs.push(m);
  }
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 6, 48), iceMat); ring.add(inner);

  /* ---------- scene 5: the portal ---------- */
  const portal = new THREE.Group(); portal.position.set(0, 2.4, -110); scene.add(portal);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7 + rand(i + 60) * 0.5, 0.9), iceMat);
    b.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, (rand(i + 61) - 0.5) * 0.4);
    b.rotation.set(rand(i + 62) * 0.6, rand(i + 63) * 0.6, a);
    portal.add(b);
  }
  const coreN = mobile ? 500 : 900, cp = new Float32Array(coreN * 3);
  for (let i = 0; i < coreN; i++) { const a = rand(i + 70) * 6.283, r = Math.pow(rand(i + 71), 0.6) * 2.6; cp[i * 3] = Math.cos(a) * r; cp[i * 3 + 1] = Math.sin(a) * r; cp[i * 3 + 2] = (rand(i + 72) - 0.5) * 0.8; }
  const coreGeo = new THREE.BufferGeometry(); coreGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const coreMat = new THREE.PointsMaterial({ color: new THREE.Color(1.15, 1.2, 1.28), size: 0.045, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.Points(coreGeo, coreMat);
  portal.add(core);
  const portalLight = new THREE.PointLight(0xdaf0ff, 6, 9); portal.add(portalLight);

  /* ---------- scene 6: 开始 out of ice dust on a platform ---------- */
  const fin = new THREE.Group(); fin.position.set(0, 0, -140); scene.add(fin);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.35, 64), new THREE.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.6 }));
  plat.position.y = 0.1; fin.add(plat);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0xcfd5db, roughness: 1 }));
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
    fin.add(dust);
  });

  /* ---------- snow everywhere ---------- */
  const snowN = mobile ? 900 : 1800, sp = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) { sp[i * 3] = (rand(i + 90) - 0.5) * 40; sp[i * 3 + 1] = rand(i + 91) * 14 - 1; sp[i * 3 + 2] = 18 - rand(i + 92) * 170; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: mobile ? 0.06 : 0.05, transparent: true, opacity: 0.9, depthWrite: false })));

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
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const look = new THREE.Vector3();
  const clock = new THREE.Clock();
  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    // Wall-clock time drives the intro and the scroll follow, so a slow device
    // is never held back; the clamped step drives the physical motion.
    const real = clock.getDelta(), dt = Math.min(real, 0.05), t = clock.elapsedTime;
    if (intro < 1) intro = Math.min(1, intro + real / 3.6);
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

    // Scene 1–3: web, outline, blocks.
    webMat.opacity = 0.75 * (1 - ramp(s, 0.1, 0.18)) * ramp(s, 0, 0.03);
    web.visible = webMat.opacity > 0.01;
    if (lines) {
      const total = lines.geometry.getAttribute('position').count;
      lines.geometry.setDrawRange(0, Math.floor(total * ramp(s, 0.0, 0.09) / 2) * 2);
      (lines.material as THREE.LineBasicMaterial).opacity = 1 - ramp(s, 0.13, 0.19);
      lines.visible = s < 0.2;
    }
    if (blocks) {
      const settle = s, out = ease(ramp(s, 0.31, 0.47));
      for (let i = 0; i < targets.length; i++) {
        const a = ease(ramp(settle, 0.06 + delay[i] * 0.25, 0.15 + delay[i] * 0.25));
        v3.copy(scatter[i]).lerp(targets[i], a);
        if (out > 0) v3.lerp(burst[i], out);
        const hover = push * (1 - out);
        v3.x += (targets[i].x) * 0.25 * hover; v3.y += (targets[i].y - 3) * 0.25 * hover; v3.z += Math.sin(i) * 0.6 * hover;
        e3.set(spin[i].x * (1 - a + out), spin[i].y * (1 - a + out) + (reduced ? 0 : t * 0.0), spin[i].z * (1 - a + out));
        q.setFromEuler(e3);
        const k = a * (1 - ramp(s, 0.44, 0.5));
        sc.set(k, k, k);
        blocks.setMatrixAt(i, m4.compose(v3, q, k > 0.001 ? sc : one.clone().multiplyScalar(0.0001)));
      }
      blocks.instanceMatrix.needsUpdate = true;
      blockMat.uniforms.uGlow.value = ramp(s, 0.13, 0.2) * (0.55 + 0.2 * Math.sin(t * 1.6)) + push * 0.4;
      blocks.visible = s < 0.5;
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
    composer.render();
    if (!ready && t > 0.15) { ready = true; onReady(); }
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
