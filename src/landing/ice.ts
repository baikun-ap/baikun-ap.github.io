import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * The landing's ice world: a dark polar void full of faceted ice monoliths.
 * The page scroll flies the camera forward through the field (a slow drift
 * when idle), the pointer tilts the view, hovering the call to action pushes
 * the ice apart. Bloom, a light chromatic grain and a vignette finish it.
 * Original three.js scene; the same interface the old valley had.
 */

export interface World {
  setScroll(p: number): void;
  hover(on: boolean): void;
  toggleSound(): boolean;
}

const VERT = `
  varying vec3 vN; varying vec3 vV; varying float vDepth; varying vec3 vW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vDepth = -mv.z; vW = world.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
// Ice: dark body, bright fresnel rim in cyan → violet, internal facet glints.
const FRAG = `
  uniform float uTime; uniform float uHue; uniform float uGlow;
  varying vec3 vN; varying vec3 vV; varying float vDepth; varying vec3 vW;
  void main() {
    float ndv = abs(dot(vN, vV));
    float rim = pow(1.0 - ndv, 2.4);
    float key = max(0.0, dot(vN, normalize(vec3(-0.35, 0.9, 0.45))));
    float glint = pow(key, 18.0);
    vec3 cyan = vec3(0.55, 0.92, 1.0), violet = vec3(0.62, 0.52, 1.0), white = vec3(0.92, 0.97, 1.0);
    float h = fract(uHue + vW.y * 0.04 + uTime * 0.015);
    vec3 iri = mix(cyan, violet, smoothstep(0.2, 0.8, h));
    vec3 body = vec3(0.025, 0.06, 0.12) + vec3(0.05, 0.12, 0.22) * key;
    vec3 c = body + iri * rim * (1.15 + uGlow) + white * glint * 0.9;
    float fog = 1.0 - smoothstep(18.0, 70.0, vDepth);
    gl_FragColor = vec4(c * fog, 1.0);
  }
`;

export function createIceWorld(host: HTMLElement, onReady: () => void): World | null {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch { return null; }
  try { return build(host, onReady); } catch (e) { console.error('[ice world]', e); return null; }
}

function build(host: HTMLElement, onReady: () => void): World {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth <= 820;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.3 : 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x02060d, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x02060d, 20, 72);
  const camera = new THREE.PerspectiveCamera(mobile ? 62 : 50, innerWidth / innerHeight, 0.1, 120);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.55 : 0.75, 0.6, 0.18);
  composer.addPass(bloom);
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uSpeed; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
      void main(){
        vec2 c = vUv - 0.5; float d = length(c); vec2 dir = normalize(c + 1e-4);
        float s = (0.0006 + uSpeed * 0.004) * (0.4 + d * 2.0);
        vec3 col = vec3(texture2D(tDiffuse, vUv + dir*s).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - dir*s).b);
        col += (hash(vUv * (uTime + 1.0) * 90.0) - 0.5) * 0.035;
        col *= smoothstep(0.95 - uSpeed * 0.2, 0.25, d);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(finish);

  const rand = (s: number) => { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

  // A monolith: a tall crystal with chipped, jittered facets.
  const makeShard = (seed: number) => {
    const g = rand(seed) < 0.55 ? new THREE.CylinderGeometry(0.0, 1, 3.2, 5 + Math.floor(rand(seed + 1) * 3), 3) : new THREE.OctahedronGeometry(1.2, 1);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = rand(seed * 7 + i * 1.31) - 0.5;
      p.setXYZ(i, p.getX(i) * (1 + k * 0.35), p.getY(i) * (1 + k * 0.15), p.getZ(i) * (1 + k * 0.35));
    }
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    return ng;
  };

  const LENGTH = 120;
  const count = mobile ? 46 : 80;
  const shards: { mesh: THREE.Mesh; home: THREE.Vector3; out: THREE.Vector3; spin: number }[] = [];
  const baseMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uHue: { value: 0 }, uGlow: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG });
  for (let i = 0; i < count; i++) {
    const mat = baseMat.clone();
    mat.uniforms.uHue.value = rand(i + 40);
    const mesh = new THREE.Mesh(makeShard(i + 1), mat);
    const side = i % 2 ? 1 : -1;
    // A tunnel: shards on both sides, above and below, the middle stays open for the text.
    const ang = rand(i + 2) * Math.PI * 2;
    const rad = 3.4 + rand(i + 3) * 7.5;
    const x = Math.cos(ang) * rad * 1.35 + side * 0.6, y = Math.sin(ang) * rad * 0.8;
    const z = -rand(i + 4) * LENGTH;
    mesh.position.set(x, y, z);
    const s = 0.5 + rand(i + 5) * 1.9;
    mesh.scale.set(s, s * (0.8 + rand(i + 6) * 1.2), s);
    mesh.rotation.set((rand(i + 7) - 0.5) * 1.4, rand(i + 8) * 6.28, (rand(i + 9) - 0.5) * 1.4);
    scene.add(mesh);
    shards.push({ mesh, home: mesh.position.clone(), out: new THREE.Vector3(x, y, 0).normalize().multiplyScalar(4 + rand(i + 10) * 5), spin: (rand(i + 11) - 0.5) * 0.25 });
  }

  // The hero crystal: a cluster floating ahead of the camera at the start.
  const hero = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(makeShard(200 + i), baseMat.clone());
    (m.material as THREE.ShaderMaterial).uniforms.uHue.value = i / 7;
    const a = (i / 7) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.7, (rand(i + 300) - 0.5) * 0.8, Math.sin(a) * 0.7);
    m.rotation.set(Math.cos(a) * 0.6, a, Math.sin(a) * 0.6);
    const s = i === 0 ? 1.5 : 0.55 + rand(i + 310) * 0.6;
    m.scale.set(s, s * 1.4, s);
    hero.add(m);
  }
  hero.position.set(0, -0.2, -11);
  scene.add(hero);

  // Snow and ice dust.
  const dustN = mobile ? 700 : 1600;
  const dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = (rand(i + 500) - 0.5) * 34; dp[i * 3 + 1] = (rand(i + 501) - 0.5) * 22; dp[i * 3 + 2] = -rand(i + 502) * LENGTH; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd8f3ff, size: mobile ? 0.05 : 0.04, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // Ambient wind: filtered noise plus a low glassy drone.
  let audio: { ctx: AudioContext; master: GainNode; lp: BiquadFilterNode } | null = null;
  let soundOn = false;
  const ensureAudio = () => {
    if (audio) return audio;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain(); master.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(master); master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 520; band.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    const wob = ctx.createOscillator(); wob.frequency.value = 0.07; const wg = ctx.createGain(); wg.gain.value = 260;
    wob.connect(wg); wg.connect(band.frequency);
    noise.connect(band); band.connect(ng); ng.connect(lp);
    [146.8, 220, 293.7].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = i * 4 - 4; const g = ctx.createGain(); g.gain.value = 0.012; o.connect(g); g.connect(lp); o.start(); });
    noise.start(); wob.start();
    audio = { ctx, master, lp };
    return audio;
  };
  const applyAudio = (muffled: boolean) => {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now); audio.master.gain.setValueAtTime(audio.master.gain.value, now);
    audio.master.gain.linearRampToValueAtTime(soundOn ? (muffled ? 0.35 : 0.8) : 0, now + 1);
    audio.lp.frequency.cancelScheduledValues(now); audio.lp.frequency.setValueAtTime(audio.lp.frequency.value, now);
    audio.lp.frequency.linearRampToValueAtTime(muffled ? 260 : 900, now + 1);
  };

  let scrollP = 0, travel = 0, drift = 0, speed = 0, push = 0, pushGoal = 0, mx = 0, my = 0, tx = 0, ty = 0, ready = false;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; } }, { passive: true });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!reduced) drift += dt * 0.35 * (1 - push);
    const goal = scrollP * (LENGTH - 30) + drift;
    const before = travel;
    travel += (goal - travel) * Math.min(1, dt * 2.6);
    speed += (Math.min(1, Math.abs(travel - before) * 3) - speed) * Math.min(1, dt * 5);
    push += (pushGoal - push) * Math.min(1, dt * 3);
    mx += (tx - mx) * dt * 2.2; my += (ty - my) * dt * 2.2;

    camera.position.set(mx * 0.9, -my * 0.6, -travel % LENGTH);
    camera.rotation.set(-my * 0.06, -mx * 0.09, -mx * 0.02);
    const camZ = camera.position.z;
    for (const s of shards) {
      // Wrap shards so the tunnel never ends.
      let z = s.home.z;
      while (z > camZ + 6) z -= LENGTH;
      while (z < camZ - LENGTH + 6) z += LENGTH;
      s.mesh.position.set(s.home.x + s.out.x * push, s.home.y + s.out.y * push, z);
      if (!reduced) s.mesh.rotation.y += s.spin * dt;
      const u = (s.mesh.material as THREE.ShaderMaterial).uniforms; u.uTime.value = t; u.uGlow.value = push * 0.8;
    }
    hero.rotation.y = t * (reduced ? 0 : 0.18); hero.rotation.x = Math.sin(t * 0.3) * 0.08;
    hero.position.z = -11 - Math.floor(travel / LENGTH) * LENGTH;
    hero.children.forEach((c) => { (c as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material.uniforms.uTime.value = t; });
    dust.position.z = -Math.floor(travel / LENGTH) * LENGTH;
    finish.uniforms.uTime.value = t; finish.uniforms.uSpeed.value = speed;
    bloom.strength = (mobile ? 0.55 : 0.75) + push * 0.4;
    composer.render();
    if (!ready && t > 0.1) { ready = true; onReady(); }
  };
  frame();

  return {
    setScroll(p) { scrollP = Math.min(1, Math.max(0, p)); },
    hover(on) { pushGoal = on && !reduced ? 1 : 0; applyAudio(on); },
    toggleSound() {
      try { const a = ensureAudio(); if (a.ctx.state === 'suspended') void a.ctx.resume(); soundOn = !soundOn; applyAudio(pushGoal > 0.5); } catch { soundOn = false; }
      return soundOn;
    },
  };
}
