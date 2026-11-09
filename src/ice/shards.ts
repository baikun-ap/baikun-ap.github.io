import * as THREE from 'three';

/**
 * The ice field behind the course pages: faceted crystal shards drifting in a
 * dark (or frosty light) void. The page scroll flies the camera forward
 * through them, the pointer tilts the view a little. Original three.js scene.
 */

export interface IceField { setTheme(dark: boolean): void; dispose(): void }

const VERT = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
// Fresnel rim in cyan → violet, a faint icy body, faded with depth.
const FRAG = `
  uniform float uTime;
  uniform float uDark;
  uniform float uHue;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDepth;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
    float facet = 0.5 + 0.5 * dot(vNormal, normalize(vec3(-0.4, 0.8, 0.5)));
    vec3 cyan = vec3(0.50, 0.89, 1.0);
    vec3 violet = vec3(0.66, 0.55, 0.98);
    vec3 pink = vec3(0.94, 0.67, 0.99);
    float t = fract(uHue + vNormal.y * 0.25 + uTime * 0.02);
    vec3 iri = t < 0.5 ? mix(cyan, violet, t * 2.0) : mix(violet, pink, (t - 0.5) * 2.0);
    float fog = 1.0 - smoothstep(10.0, 46.0, vDepth);
    vec3 dark = iri * (0.18 + rim * 1.25) + vec3(0.06, 0.12, 0.2) * facet;
    vec3 light = mix(vec3(0.72, 0.84, 0.96), iri * 0.85, 0.35 + rim * 0.5) * (0.82 + facet * 0.18);
    vec3 color = mix(light, dark, uDark);
    float alpha = (mix(0.42, 0.22, uDark) + rim * 0.7) * fog;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createIceField(host: HTMLElement, dark: boolean): IceField | null {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch { return null; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 820;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 80);

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDark: { value: dark ? 1 : 0 }, uHue: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  // A crystal: a stretched octahedron or a two-point prism, randomly tilted.
  const shapes = [
    new THREE.OctahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.ConeGeometry(0.7, 2.2, 5, 1),
  ];
  shapes.forEach((g) => g.computeVertexNormals());
  const rand = (s: number) => { const v = Math.sin(s * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const DEPTH = 60;
  const count = small ? 26 : 40;
  const shards: { mesh: THREE.Mesh; spin: THREE.Vector3; baseZ: number }[] = [];
  for (let i = 0; i < count; i++) {
    const mat = material.clone();
    mat.uniforms.uHue.value = rand(i + 9);
    const mesh = new THREE.Mesh(shapes[i % shapes.length], mat);
    const side = rand(i + 1) < 0.5 ? -1 : 1;
    // Keep the middle of the screen clear for the content.
    mesh.position.set(side * (2.4 + rand(i + 2) * 7), (rand(i + 3) - 0.5) * 9, -rand(i + 4) * DEPTH);
    const s = 0.35 + rand(i + 5) * 1.3;
    mesh.scale.set(s * (0.6 + rand(i + 6) * 0.6), s * (1 + rand(i + 7) * 1.4), s * (0.6 + rand(i + 8) * 0.5));
    mesh.rotation.set(rand(i + 10) * 6, rand(i + 11) * 6, rand(i + 12) * 6);
    scene.add(mesh);
    shards.push({ mesh, spin: new THREE.Vector3(rand(i + 13) - 0.5, rand(i + 14) - 0.5, 0).multiplyScalar(0.25), baseZ: mesh.position.z });
  }

  // Fine snow.
  const snowN = small ? 220 : 420;
  const pos = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) { pos[i * 3] = (rand(i + 50) - 0.5) * 30; pos[i * 3 + 1] = (rand(i + 51) - 0.5) * 18; pos[i * 3 + 2] = -rand(i + 52) * DEPTH; }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snowMat = new THREE.PointsMaterial({ size: 0.05, color: dark ? 0xcfefff : 0x7fa6c9, transparent: true, opacity: 0.7, depthWrite: false });
  scene.add(new THREE.Points(snowGeo, snowMat));

  let mx = 0, my = 0, tx = 0, ty = 0, travel = 0, goal = 0;
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; } };
  const onScroll = () => { goal = scrollY * 0.012; };
  const onResize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  onScroll();

  const clock = new THREE.Clock();
  let raf = 0, alive = true;
  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    travel += (goal + (reduced ? 0 : time * 0.15) - travel) * Math.min(1, dt * 3);
    mx += (tx - mx) * dt * 2; my += (ty - my) * dt * 2;
    camera.position.set(mx * 0.6, -my * 0.4, 0);
    camera.rotation.set(-my * 0.04, -mx * 0.06, 0);
    for (const s of shards) {
      // Wrap each shard through the depth so the field never ends.
      let z = s.baseZ + travel;
      z = ((z % DEPTH) + DEPTH) % DEPTH - DEPTH + 4;
      s.mesh.position.z = z;
      if (!reduced) { s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; }
      (s.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
    renderer.render(scene, camera);
  };
  frame();

  return {
    setTheme(d: boolean) {
      for (const s of shards) {
        const m = s.mesh.material as THREE.ShaderMaterial;
        m.uniforms.uDark.value = d ? 1 : 0;
        m.blending = d ? THREE.AdditiveBlending : THREE.NormalBlending;
        m.needsUpdate = true;
      }
      snowMat.color.set(d ? 0xcfefff : 0x7fa6c9);
    },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); removeEventListener('resize', onResize);
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
