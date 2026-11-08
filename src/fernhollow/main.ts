import * as THREE from 'three';
import './style.css';

const valley = document.querySelector<HTMLElement>('#valley');
const container = document.querySelector<HTMLElement>('.js-canvas-container');
const ui = document.querySelector<HTMLElement>('#ui');
const loader = document.querySelector<HTMLElement>('#loader');
const sound = document.querySelector<HTMLButtonElement>('#sound');

if (!valley || !container) {
  throw new Error('Fernhollow scene container is missing.');
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 820px)').matches;
const TAU = Math.PI * 2;
const FLOWER_COUNT = mobile ? 720 : 2200;
const LEAF_COUNT = mobile ? 1200 : 3600;

const terrainHeight = (x: number, z: number): number => {
  const valleyBowl = -4.8 - Math.max(0, Math.abs(x) - 17) * 0.24;
  const ridges = Math.sin(z * 0.085 + x * 0.12) * 0.7 + Math.cos(x * 0.31 - z * 0.045) * 0.42;
  return valleyBowl + ridges + Math.sin((x + z) * 0.23) * 0.12;
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020302);
scene.fog = new THREE.FogExp2(0x020302, 0.012);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.15 : 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const moonLight = new THREE.DirectionalLight(0x9aa88d, 1.8);
moonLight.position.set(-18, 32, 22);
scene.add(moonLight);
scene.add(new THREE.HemisphereLight(0x263d35, 0x020201, 0.75));

const terrainGeometry = new THREE.PlaneGeometry(150, 220, mobile ? 54 : 86, mobile ? 72 : 112);
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
  new THREE.MeshStandardMaterial({ color: 0x10150f, roughness: 1, metalness: 0, flatShading: true }),
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
  const t = random(seed) * 0.999;
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
  attribute float aSize;
  attribute float aPhase;
  attribute float aHue;
  varying float vGlow;
  varying float vHue;
  varying float vPhase;
  void main() {
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToCamera = distance(position, uCameraPosition);
    float nearGrowth = 1.0 - smoothstep(7.0, 36.0, distanceToCamera);
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
    gl_PointSize = max(1.0, aSize * (0.25 + growth * 1.15) * (260.0 / -modelViewPosition.z));
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
  vec3 palette(float h) {
    vec3 a = vec3(0.48, 0.38, 0.25);
    vec3 b = vec3(0.48, 0.42, 0.38);
    vec3 c = vec3(1.0, 0.92, 0.72);
    vec3 d = vec3(0.00, 0.16, 0.28);
    return a + b * cos(6.28318 * (c * h + d));
  }
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float petalEdge = 0.23 + 0.19 * pow(0.5 + 0.5 * sin(angle * 5.0 + vPhase), 2.0);
    float petals = 1.0 - smoothstep(petalEdge, petalEdge + 0.07, radius);
    float softCircle = 1.0 - smoothstep(0.46, 0.5, radius);
    float core = 1.0 - smoothstep(0.0, 0.16, radius);
    float alpha = petals * softCircle;
    if (alpha < 0.02) discard;
    vec3 color = mix(palette(vHue), vec3(1.0, 0.76, 0.38), core * 0.75);
    float shimmer = 0.9 + 0.1 * sin(uTime * 1.8 + vPhase);
    gl_FragColor = vec4(color * vGlow * shimmer, alpha * min(1.0, vGlow));
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
  for (let i = 0; i < count; i += 1) {
    const point = sampleFloraPosition(i, count, kind === 'flower' ? 42 : 48);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    const seed = i * 5.21 + (kind === 'flower' ? 0 : 2000);
    sizes[i] = kind === 'flower' ? 1.6 + random(seed) * 3.4 : 1.3 + random(seed) * 2.6;
    phases[i] = random(seed + 1.1) * TAU;
    hues[i] = random(seed + 3.7);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aHue', new THREE.BufferAttribute(hues, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMouse: { value: new THREE.Vector2(10, 10) },
      uCameraPosition: { value: camera.position.clone() },
      uTime: { value: 0 },
      uGrowthFar: { value: kind === 'leaf' ? 1 : 0 },
    },
    vertexShader: floraVertex,
    fragmentShader: kind === 'flower' ? flowerFragment : leafFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { geometry, material };
};

const flowers = createFlora(FLOWER_COUNT, 'flower');
const leaves = createFlora(LEAF_COUNT, 'leaf');
scene.add(new THREE.Points(leaves.geometry, leaves.material));
scene.add(new THREE.Points(flowers.geometry, flowers.material));

const mouse = new THREE.Vector2(10, 10);
const targetMouse = new THREE.Vector2(10, 10);
let progress = 0.015;
let scrollVelocity = 0;
let lastPointerY: number | null = null;
let idleTime = 0;
let introElapsed = 0;
let ready = false;

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
});

const setUniforms = (time: number): void => {
  for (const material of [flowers.material, leaves.material]) {
    material.uniforms.uMouse.value.copy(mouse);
    material.uniforms.uCameraPosition.value.copy(camera.position);
    material.uniforms.uTime.value = time;
  }
};

const clock = new THREE.Clock();
const animate = (): void => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  introElapsed += delta;
  idleTime += delta;

  if (!reducedMotion && Math.abs(scrollVelocity) < 0.00002 && idleTime > 0.8) progress += delta * 0.0026;
  progress = (progress + scrollVelocity + 1) % 1;
  scrollVelocity *= Math.pow(0.055, delta);
  mouse.lerp(targetMouse, 1 - Math.pow(0.0001, delta));

  const introAmount = Math.min(1, introElapsed / (reducedMotion ? 0.25 : 1.15));
  const flightT = (progress + introAmount * 0.06) % 1;
  const pathPosition = path.getPointAt(flightT);
  const lookAhead = path.getPointAt((flightT + 0.018) % 1);
  const cameraHeight = 2.8 + Math.sin(time * 0.22) * 0.16;
  camera.position.lerp(new THREE.Vector3(pathPosition.x, pathPosition.y + cameraHeight, pathPosition.z), 0.12);
  camera.lookAt(lookAhead.x + mouse.x * 1.2, lookAhead.y + 0.6 + mouse.y * 0.6, lookAhead.z);
  camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -mouse.x * 0.025, 0.08);

  setUniforms(time);
  renderer.render(scene, camera);

  if (!ready && introElapsed > (reducedMotion ? 0.3 : 1.35)) {
    ready = true;
    loader?.classList.add('gone');
    window.setTimeout(() => ui?.classList.add('on'), reducedMotion ? 0 : 160);
  }
  window.requestAnimationFrame(animate);
};

sound?.addEventListener('click', () => {
  const isPlaying = sound.getAttribute('aria-pressed') === 'true';
  sound.setAttribute('aria-pressed', String(!isPlaying));
  sound.setAttribute('aria-label', isPlaying ? 'Turn ambient sound on' : 'Turn ambient sound off');
});

animate();
