import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import './style.css';

const valley = document.querySelector<HTMLElement>('#valley');
const container = document.querySelector<HTMLElement>('.js-canvas-container');
const ui = document.querySelector<HTMLElement>('#ui');
const loader = document.querySelector<HTMLElement>('#loader');
const sound = document.querySelector<HTMLButtonElement>('#sound');
const go = document.querySelector<HTMLAnchorElement>('#go');

if (!valley || !container) {
  throw new Error('Fernhollow scene container is missing.');
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 820px)').matches || ('ontouchstart' in window && window.innerWidth <= 820);
const TAU = Math.PI * 2;
const FLOWER_COUNT = mobile ? 760 : 2200;
const LEAF_COUNT = mobile ? 900 : 3600;

const terrainHeight = (x: number, z: number): number => {
  const valleyBowl = 1.8 - Math.max(0, Math.abs(x) - 17) * 0.24;
  const ridges = Math.sin(z * 0.085 + x * 0.12) * 0.7 + Math.cos(x * 0.31 - z * 0.045) * 0.42;
  return valleyBowl + ridges + Math.sin((x + z) * 0.23) * 0.12;
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020302);
scene.fog = new THREE.FogExp2(0x020302, mobile ? 0.0045 : 0.008);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.15 : 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  mobile ? 0.12 : 0.18,
  0.32,
  0.56,
);
composer.addPass(bloomPass);
const atmospherePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uChromatic: { value: mobile ? 0.00045 : 0.0007 },
    uNoise: { value: mobile ? 0.004 : 0.006 },
    uVignette: { value: 0.22 },
    uSpeed: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromatic;
    uniform float uNoise;
    uniform float uVignette;
    uniform float uSpeed;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    void main() {
      vec2 centred = vUv - 0.5;
      float distanceFromCentre = length(centred);
      vec2 direction = normalize(centred + vec2(0.0001));
      float split = uChromatic * (0.35 + distanceFromCentre * 2.5) * (1.0 + uSpeed * 0.9);
      float red = texture2D(tDiffuse, vUv + direction * split).r;
      float green = texture2D(tDiffuse, vUv).g;
      float blue = texture2D(tDiffuse, vUv - direction * split).b;
      vec3 colour = vec3(red, green, blue);
      float grain = (hash(vUv * (uTime + 1.0) * 80.0) - 0.5) * uNoise;
      float vignette = smoothstep(0.92 - uVignette, 0.28, distanceFromCentre);
      colour = colour * vignette + grain;
      gl_FragColor = vec4(colour, 1.0);
    }
  `,
});
composer.addPass(atmospherePass);

const moonLight = new THREE.DirectionalLight(0x829681, 0.85);
moonLight.position.set(-18, 32, 22);
scene.add(moonLight);
scene.add(new THREE.HemisphereLight(0x263d35, 0x020201, 0.38));

const terrainGeometry = new THREE.PlaneGeometry(280, 420, mobile ? 64 : 96, mobile ? 96 : 160);
terrainGeometry.rotateX(-Math.PI / 2);
const terrainPositions = terrainGeometry.getAttribute('position');
for (let i = 0; i < terrainPositions.count; i += 1) {
  const x = terrainPositions.getX(i);
  const z = terrainPositions.getZ(i);
  terrainPositions.setY(i, terrainHeight(x, z));
}
terrainPositions.needsUpdate = true;
terrainGeometry.computeVertexNormals();
const terrain = new THREE.Mesh(
  terrainGeometry,
  new THREE.MeshStandardMaterial({ color: 0x203a27, emissive: 0x0a1a0e, emissiveIntensity: 0.36, roughness: 1, metalness: 0, flatShading: true }),
);
terrain.position.z = -42;
scene.add(terrain);

const pathPoints = [
  new THREE.Vector3(0, 1.8, 18),
  new THREE.Vector3(13, 2.8, -2),
  new THREE.Vector3(-12, 2.4, -25),
  new THREE.Vector3(10, 3.3, -51),
  new THREE.Vector3(-14, 2.6, -76),
  new THREE.Vector3(3, 2.2, -101),
  new THREE.Vector3(17, 2.9, -123),
  new THREE.Vector3(-8, 2.1, -143),
];
const path = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.55);

const random = (seed: number): number => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const sampleFloraPosition = (index: number, count: number, spread: number): THREE.Vector3 => {
  const seed = index * 17.31 + count * 0.013;
  const distribution = random(seed);
  const t = (mobile && distribution < 0.68 ? distribution * 0.28 : distribution) * 0.999;
  const centre = path.getPointAt(t);
  const tangent = path.getTangentAt(t).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const lateral = (random(seed + 2.1) - 0.5) * spread;
  const forward = (random(seed + 4.4) - 0.5) * 7;
  const point = centre.clone().addScaledVector(side, lateral).addScaledVector(tangent, forward);
  point.y = terrainHeight(point.x, point.z + 42) + 0.4 + random(seed + 6.8) * 0.8;
  return point;
};

type FloraData = {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
};

const floraVertex = `
  uniform vec2 uMouse;
  uniform vec3 uCameraPosition;
  uniform float uTime;
  uniform float uGrowthFar;
  uniform float uScatter;
  uniform float uMaxPointSize;
  attribute float aSize;
  attribute float aPhase;
  attribute float aHue;
  attribute vec3 aScatter;
  varying float vGlow;
  varying float vHue;
  varying float vPhase;
  varying float vVisibility;
  void main() {
    vec3 scatteredPosition = position + aScatter * uScatter;
    vec4 modelViewPosition = modelViewMatrix * vec4(scatteredPosition, 1.0);
    float distanceToCamera = distance(position, uCameraPosition);
    float nearGrowth = 0.24 + 0.76 * (1.0 - smoothstep(8.0, 64.0, distanceToCamera));
    float farGrowth = smoothstep(10.0, 58.0, distanceToCamera);
    float growth = mix(nearGrowth, farGrowth, uGrowthFar);
    float sway = sin(uTime * 0.8 + aPhase + position.x * 0.2) * 0.035 * growth;
    modelViewPosition.x += sway;
    vec4 clipPosition = projectionMatrix * modelViewPosition;
    vec2 screenPosition = clipPosition.xy / clipPosition.w;
    vec2 cursorDelta = screenPosition - uMouse;
    float cursorDistance = length(cursorDelta);
    float influence = smoothstep(0.34, 0.0, cursorDistance);
    if (cursorDistance > 0.001) {
      clipPosition.xy += normalize(cursorDelta) * influence * 0.13 * clipPosition.w;
    }
    gl_Position = clipPosition;
    vVisibility = smoothstep(1.5, 3.5, distanceToCamera);
    gl_PointSize = clamp(aSize * (0.5 + growth * 1.1) * (260.0 / -modelViewPosition.z), 1.0, uMaxPointSize);
    vGlow = 0.35 + growth * 0.65 + influence * 0.65;
    vHue = aHue;
    vPhase = aPhase;
  }
`;

const flowerFragment = `
  uniform float uTime;
  varying float vGlow;
  varying float vHue;
  varying float vPhase;
  varying float vVisibility;
  vec3 palette(float h) {
    vec3 cream = vec3(0.96, 0.83, 0.61);
    vec3 pink = vec3(0.95, 0.48, 0.56);
    vec3 blue = vec3(0.45, 0.72, 0.92);
    vec3 yellow = vec3(0.98, 0.88, 0.45);
    if (h < 0.25) return mix(cream, pink, smoothstep(0.08, 0.25, h));
    if (h < 0.5) return mix(pink, blue, smoothstep(0.25, 0.5, h));
    if (h < 0.75) return mix(blue, yellow, smoothstep(0.5, 0.75, h));
    return mix(yellow, cream, smoothstep(0.75, 1.0, h));
  }
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float radius = length(p);
    float petals = 0.0;
    for (int i = 0; i < 6; i++) {
      float petalAngle = float(i) * 1.0471976 + vPhase;
      vec2 petalCentre = vec2(cos(petalAngle), sin(petalAngle)) * 0.19;
      float petal = 1.0 - smoothstep(0.145, 0.19, length(p - petalCentre));
      petals = max(petals, petal);
    }
    float core = 1.0 - smoothstep(0.0, 0.14, radius);
    float alpha = petals * vVisibility;
    if (alpha < 0.02) discard;
    vec3 color = mix(palette(vHue), vec3(1.0, 0.92, 0.68), core * 0.9);
    float shimmer = 0.9 + 0.1 * sin(uTime * 1.8 + vPhase);
    gl_FragColor = vec4(color * (0.42 + vGlow * 0.42) * shimmer, alpha * 0.82);
  }
`;

const leafFragment = `
  uniform float uTime;
  varying float vGlow;
  varying float vHue;
  varying float vPhase;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float angle = vPhase * 0.7;
    mat2 rotate = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    p = rotate * p;
    float leaf = 1.0 - smoothstep(0.34, 0.48, length(vec2(p.x * 1.7, p.y * 0.7)));
    leaf *= smoothstep(-0.03, 0.16, p.x + 0.18);
    if (leaf < 0.02) discard;
    vec3 color = mix(vec3(0.14, 0.28, 0.16), vec3(0.51, 0.64, 0.31), vHue);
    float shimmer = 0.82 + 0.18 * sin(uTime + vPhase);
    gl_FragColor = vec4(color * vGlow * shimmer, leaf * 0.72);
  }
`;

const createFlora = (count: number, kind: 'flower' | 'leaf'): FloraData => {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const hues = new Float32Array(count);
  const scatter = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const point = sampleFloraPosition(i, count, kind === 'flower' ? 42 : 48);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    const seed = i * 5.21 + (kind === 'flower' ? 0 : 2000);
    sizes[i] = kind === 'flower' ? 1.8 + random(seed) * 2.8 : 0.9 + random(seed) * 1.6;
    phases[i] = random(seed + 1.1) * TAU;
    hues[i] = random(seed + 3.7);
    const scatterLength = kind === 'flower' ? 7 + random(seed + 5.4) * 16 : 0;
    const scatterAngle = random(seed + 7.8) * TAU;
    scatter[i * 3] = Math.cos(scatterAngle) * scatterLength;
    scatter[i * 3 + 1] = (random(seed + 9.2) - 0.2) * scatterLength;
    scatter[i * 3 + 2] = Math.sin(scatterAngle) * scatterLength;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aHue', new THREE.BufferAttribute(hues, 1));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMouse: { value: new THREE.Vector2(10, 10) },
      uCameraPosition: { value: camera.position.clone() },
      uTime: { value: 0 },
      uGrowthFar: { value: kind === 'leaf' ? 1 : 0 },
      uScatter: { value: 0 },
      uMaxPointSize: { value: kind === 'flower' ? (mobile ? 28 : 40) : (mobile ? 18 : 26) },
    },
    vertexShader: floraVertex,
    fragmentShader: kind === 'flower' ? flowerFragment : leafFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  return { geometry, material };
};

const flowers = createFlora(FLOWER_COUNT, 'flower');
const leaves = createFlora(LEAF_COUNT, 'leaf');
scene.add(new THREE.Points(leaves.geometry, leaves.material));
scene.add(new THREE.Points(flowers.geometry, flowers.material));

const rayCanvas = document.createElement('canvas');
rayCanvas.width = 64;
rayCanvas.height = 256;
const rayContext = rayCanvas.getContext('2d');
if (rayContext) {
  const rayGradient = rayContext.createRadialGradient(32, 22, 2, 32, 128, 128);
  rayGradient.addColorStop(0, 'rgba(218, 231, 187, 0.34)');
  rayGradient.addColorStop(0.28, 'rgba(153, 190, 128, 0.12)');
  rayGradient.addColorStop(1, 'rgba(80, 116, 71, 0)');
  rayContext.fillStyle = rayGradient;
  rayContext.fillRect(0, 0, 64, 256);
}
const rayTexture = new THREE.CanvasTexture(rayCanvas);
const rays: THREE.Sprite[] = [];
for (let i = 0; i < (mobile ? 3 : 6); i += 1) {
  const ray = new THREE.Sprite(new THREE.SpriteMaterial({
    map: rayTexture,
    color: 0xbed8a2,
    transparent: true,
    opacity: 0.16 + random(i + 2) * 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  ray.position.set((random(i + 4) - 0.5) * 52, 8 + random(i + 6) * 12, -30 - random(i + 8) * 100);
  ray.scale.set(7 + random(i + 10) * 8, 26 + random(i + 12) * 18, 1);
  ray.material.rotation = (random(i + 14) - 0.5) * 0.35;
  scene.add(ray);
  rays.push(ray);
}

const dustGeometry = new THREE.BufferGeometry();
const dustCount = mobile ? 180 : 520;
const dustPositions = new Float32Array(dustCount * 3);
const dustPhases = new Float32Array(dustCount);
for (let i = 0; i < dustCount; i += 1) {
  const seed = i * 3.17;
  dustPositions[i * 3] = (random(seed) - 0.5) * 65;
  dustPositions[i * 3 + 1] = 1 + random(seed + 1) * 24;
  dustPositions[i * 3 + 2] = 12 - random(seed + 2) * 150;
  dustPhases[i] = random(seed + 3) * TAU;
}
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMaterial = new THREE.PointsMaterial({
  color: 0xdde8bd,
  size: mobile ? 0.075 : 0.105,
  transparent: true,
  opacity: 0.42,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
scene.add(new THREE.Points(dustGeometry, dustMaterial));

const mouse = new THREE.Vector2(10, 10);
const targetMouse = new THREE.Vector2(10, 10);
let progress = 0.015;
let scrollVelocity = 0;
let lastPointerY: number | null = null;
let idleTime = 0;
let introElapsed = 0;
let ready = false;
let hoverAmount = 0;
let hoverTarget = 0;
let soundEnabled = false;

type AmbientAudio = {
  context: AudioContext;
  master: GainNode;
  lowpass: BiquadFilterNode;
  oscillators: OscillatorNode[];
};

let ambientAudio: AmbientAudio | null = null;

const ensureAmbientAudio = (): AmbientAudio => {
  if (ambientAudio) return ambientAudio;
  const context = new AudioContext();
  const master = context.createGain();
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1450;
  lowpass.Q.value = 0.45;
  master.gain.value = 0;
  lowpass.connect(master);
  master.connect(context.destination);
  const oscillators: OscillatorNode[] = [];
  [55, 82.5, 110].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    oscillator.type = index === 1 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 3 - 3;
    voiceGain.gain.value = index === 0 ? 0.032 : 0.018;
    oscillator.connect(voiceGain);
    voiceGain.connect(lowpass);
    oscillator.start();
    oscillators.push(oscillator);
  });
  ambientAudio = { context, master, lowpass, oscillators };
  return ambientAudio;
};

const setAudioHoverState = (muffled: boolean): void => {
  if (!ambientAudio) return;
  const now = ambientAudio.context.currentTime;
  ambientAudio.lowpass.frequency.cancelScheduledValues(now);
  ambientAudio.lowpass.frequency.linearRampToValueAtTime(muffled ? 320 : 1450, now + 0.9);
  ambientAudio.master.gain.linearRampToValueAtTime(soundEnabled ? (muffled ? 0.055 : 0.13) : 0, now + 0.9);
};

const startHoverTransition = (): void => {
  hoverTarget = reducedMotion ? 0 : 1;
  scrollVelocity *= 0.18;
  setAudioHoverState(true);
};

const stopHoverTransition = (): void => {
  hoverTarget = 0;
  setAudioHoverState(false);
};

const updateInput = (delta: number, touch = false): void => {
  scrollVelocity += delta * (touch ? 20 : 1) * 0.00022;
  scrollVelocity = THREE.MathUtils.clamp(scrollVelocity, -0.018, 0.018);
  idleTime = 0;
};

window.addEventListener('wheel', (event) => updateInput(event.deltaY));
window.addEventListener('pointermove', (event) => {
  targetMouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  if (lastPointerY !== null && event.pointerType !== 'mouse') updateInput(lastPointerY - event.clientY, true);
  lastPointerY = event.pointerType === 'mouse' ? null : event.clientY;
});
window.addEventListener('pointerup', () => {
  lastPointerY = null;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 820 ? 1.15 : 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const setUniforms = (time: number): void => {
  for (const material of [flowers.material, leaves.material]) {
    material.uniforms.uMouse.value.copy(mouse);
    material.uniforms.uCameraPosition.value.copy(camera.position);
    material.uniforms.uTime.value = time;
  }
  flowers.material.uniforms.uScatter.value = hoverAmount;
  atmospherePass.uniforms.uTime.value = time;
  atmospherePass.uniforms.uSpeed.value = Math.min(1, Math.abs(scrollVelocity) * 55);
  atmospherePass.uniforms.uVignette.value = 0.22 + Math.min(0.32, Math.abs(scrollVelocity) * 16);
  bloomPass.strength = (mobile ? 0.12 : 0.18) + hoverAmount * 0.04;
};

const clock = new THREE.Clock();
const animate = (): void => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  introElapsed += delta;
  idleTime += delta;
  hoverAmount = THREE.MathUtils.damp(hoverAmount, hoverTarget, 3.6, delta);

  if (!reducedMotion && hoverAmount < 0.02 && Math.abs(scrollVelocity) < 0.00002 && idleTime > 0.8) progress += delta * 0.0026;
  progress = (progress + scrollVelocity * (1 - hoverAmount) + 1) % 1;
  scrollVelocity *= Math.pow(0.055, delta);
  mouse.lerp(targetMouse, 1 - Math.pow(0.0001, delta));

  const dustAttribute = dustGeometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < dustCount; i += 1) {
    const seed = dustPhases[i];
    dustAttribute.setX(i, dustAttribute.getX(i) + Math.sin(time * 0.18 + seed) * delta * 0.22);
    dustAttribute.setY(i, dustAttribute.getY(i) + Math.sin(time * 0.32 + seed) * delta * 0.12);
    dustAttribute.setZ(i, dustAttribute.getZ(i) + delta * (0.8 + Math.sin(seed) * 0.2));
    if (dustAttribute.getZ(i) > 20) dustAttribute.setZ(i, -155);
  }
  dustAttribute.needsUpdate = true;
  rays.forEach((ray, index) => {
    ray.material.opacity = (0.14 + Math.sin(time * 0.28 + index) * 0.035) * (1 + hoverAmount * 0.35);
    ray.position.x += Math.sin(time * 0.07 + index) * delta * 0.08;
  });

  const introAmount = Math.min(1, introElapsed / (reducedMotion ? 0.25 : 1.15));
  const flightT = (progress + introAmount * 0.06) % 1;
  const pathPosition = path.getPointAt(flightT);
  const lookAhead = path.getPointAt((flightT + 0.018) % 1);
  const cameraHeight = (mobile ? 1.7 : 2.8) + Math.sin(time * 0.22) * 0.16;
  camera.position.lerp(new THREE.Vector3(pathPosition.x, pathPosition.y + cameraHeight, pathPosition.z), 0.12);
  camera.lookAt(lookAhead.x + mouse.x * 1.2, lookAhead.y + (mobile ? -5.5 : 0.6) + mouse.y * 0.6, lookAhead.z);
  camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -mouse.x * 0.025, 0.08);

  setUniforms(time);
  composer.render();

  if (!ready && introElapsed > (reducedMotion ? 0.04 : 0.1)) {
    ready = true;
    loader?.classList.add('gone');
    window.setTimeout(() => ui?.classList.add('on'), reducedMotion ? 0 : 350);
  }
  window.requestAnimationFrame(animate);
};

sound?.addEventListener('click', () => {
  const audio = ensureAmbientAudio();
  if (audio.context.state === 'suspended') void audio.context.resume();
  soundEnabled = !soundEnabled;
  const now = audio.context.currentTime;
  audio.master.gain.cancelScheduledValues(now);
  audio.master.gain.linearRampToValueAtTime(soundEnabled ? (hoverAmount > 0.5 ? 0.055 : 0.13) : 0, now + 0.9);
  sound.setAttribute('aria-pressed', String(soundEnabled));
  sound.setAttribute('aria-label', soundEnabled ? 'Turn ambient sound off' : 'Turn ambient sound on');
});

go?.addEventListener('pointerenter', startHoverTransition);
go?.addEventListener('pointerleave', stopHoverTransition);

animate();
