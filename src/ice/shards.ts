import * as THREE from 'three';

/**
 * The ice field behind the course pages: pieces of the landing's frozen world
 * drifting in a dark (or frosty light) void. The page scroll flies the camera
 * forward through them, the pointer tilts the view a little.
 *
 * Each group of sections has its own piece of the story: crystal shards on
 * the home page, the ice bricks of 学 behind the lessons, the ring of eight
 * segments behind the cards and the sound pages, the portal behind the exams,
 * the rocks behind the characters. Original three.js scene.
 */

export type IceSection = 'shards' | 'bricks' | 'ring' | 'portal' | 'stones';
export interface IceField { setTheme(dark: boolean): void; setSection(s: IceSection): void; dispose(): void }

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
  uniform float uRock;
  uniform float uFade;
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
    // Rocks: matt grey stone with a frosted rim, as on the landing's hill.
    vec3 rock = mix(vec3(0.56, 0.6, 0.65) * (0.72 + facet * 0.28) + rim * 0.25, vec3(0.13, 0.17, 0.24) * (0.5 + facet) + iri * rim * 0.55, uDark);
    color = mix(color, rock, uRock);
    alpha = mix(alpha, (0.62 + rim * 0.3) * fog, uRock);
    gl_FragColor = vec4(color, alpha * uFade);
  }
`;

export function createIceField(host: HTMLElement, dark: boolean, section: IceSection = 'shards'): IceField | null {
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
    uniforms: { uTime: { value: 0 }, uDark: { value: dark ? 1 : 0 }, uHue: { value: 0 }, uRock: { value: 0 }, uFade: { value: 1 } },
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
  // One fade for everything: a section change dips it to nothing and back.
  const fade = { value: 1 };
  const mats: THREE.ShaderMaterial[] = [];
  const iceMat = (hue: number) => {
    const m = material.clone();
    m.uniforms.uHue.value = hue; m.uniforms.uFade = fade;
    mats.push(m);
    return m;
  };
  // What drifts in each section. Bricks and rocks start as plain shapes; the
  // landing's own models replace them once they arrive (models.ts).
  const box = new THREE.BoxGeometry(1.3, 0.9, 0.9);
  const pools: Record<IceSection, THREE.BufferGeometry[]> = {
    shards: shapes, ring: shapes,
    bricks: [box], portal: [box],
    stones: [new THREE.DodecahedronGeometry(1, 0), new THREE.IcosahedronGeometry(1, 0)],
  };
  const shards: { mesh: THREE.Mesh; spin: THREE.Vector3; baseZ: number; crystal: THREE.Vector3; even: number }[] = [];
  for (let i = 0; i < count; i++) {
    const mat = iceMat(rand(i + 9));
    const mesh = new THREE.Mesh(shapes[i % shapes.length], mat);
    const side = rand(i + 1) < 0.5 ? -1 : 1;
    // Keep the middle of the screen clear for the content.
    mesh.position.set(side * (2.4 + rand(i + 2) * 7), (rand(i + 3) - 0.5) * 9, -rand(i + 4) * DEPTH);
    const s = 0.35 + rand(i + 5) * 1.3;
    const crystal = new THREE.Vector3(s * (0.6 + rand(i + 6) * 0.6), s * (1 + rand(i + 7) * 1.4), s * (0.6 + rand(i + 8) * 0.5));
    mesh.scale.copy(crystal);
    mesh.rotation.set(rand(i + 10) * 6, rand(i + 11) * 6, rand(i + 12) * 6);
    scene.add(mesh);
    shards.push({ mesh, spin: new THREE.Vector3(rand(i + 13) - 0.5, rand(i + 14) - 0.5, 0).multiplyScalar(0.25), baseZ: mesh.position.z, crystal, even: 0.3 + s * 0.45 });
  }

  // Set pieces from the story, off to the side of the content: the ring of
  // eight segments (the eight steps of a lesson) and the portal's frame.
  // On a phone a set piece sits up in a top corner, clear of the text.
  const piece = (x: number) => { const g = new THREE.Group(); g.position.set(small ? Math.sign(x) * 3.6 : x, small ? 7.4 : 0.6, small ? -17 : -15); g.visible = false; scene.add(g); return g; };
  const ringSet = piece(10.5);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.42, 10, 18, (Math.PI * 2) / 8 * 0.78), iceMat(i / 8));
    m.rotation.z = (i / 8) * Math.PI * 2;
    ringSet.add(m);
  }
  ringSet.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 8, 48), iceMat(0.5)));
  const portalSet = piece(-10.5);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7 + rand(i + 60) * 0.5, 0.9), iceMat(rand(i + 64)));
    b.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, (rand(i + 61) - 0.5) * 0.4);
    b.rotation.set(rand(i + 62) * 0.6, rand(i + 63) * 0.6, a);
    portalSet.add(b);
  }

  let current: IceSection = section, wanted: IceSection = section, isDark = dark;
  const look = () => {
    const rock = current === 'stones';
    for (const m of mats) {
      m.uniforms.uDark.value = isDark ? 1 : 0;
      m.uniforms.uRock.value = rock ? 1 : 0;
      m.blending = isDark && !rock ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.needsUpdate = true;
    }
  };
  const apply = () => {
    const pool = pools[current], crystals = pool === shapes;
    // Beside a set piece the drifting field thins out.
    const shown = current === 'ring' || current === 'portal' ? Math.ceil(count * 0.55) : count;
    shards.forEach((s, i) => {
      s.mesh.geometry = pool[i % pool.length];
      if (crystals) s.mesh.scale.copy(s.crystal); else s.mesh.scale.setScalar(s.even);
      s.mesh.visible = i < shown;
    });
    ringSet.visible = current === 'ring';
    portalSet.visible = current === 'portal';
    look();
  };
  apply();
  // The landing's modelled bricks and rocks, fetched only when a section shows them.
  let models: 'no' | 'loading' | 'done' = 'no';
  const needModels = () => {
    if (models !== 'no' || (wanted !== 'bricks' && wanted !== 'stones')) return;
    models = 'loading';
    import('./models').then((m) => m.loadPieces()).then((w) => {
      if (!alive) return;
      pools.bricks = w.bricks; pools.stones = w.rocks;
      models = 'done';
      if (current === 'bricks' || current === 'stones') apply();
    }).catch((e) => console.warn('[ice] models', e));
  };

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
  needModels();
  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    travel += (goal + (reduced ? 0 : time * 0.15) - travel) * Math.min(1, dt * 3);
    mx += (tx - mx) * dt * 2; my += (ty - my) * dt * 2;
    camera.position.set(mx * 0.6, -my * 0.4, 0);
    camera.rotation.set(-my * 0.04, -mx * 0.06, 0);
    // A section change: fade out, swap the pieces, fade back in.
    if (wanted !== current) {
      fade.value = Math.max(0, fade.value - dt * 4);
      if (fade.value === 0) { current = wanted; apply(); }
    } else if (fade.value < 1) fade.value = Math.min(1, fade.value + dt * 2.5);
    if (!reduced) { ringSet.rotation.z = time * 0.12; ringSet.rotation.y = -0.5 + Math.sin(time * 0.2) * 0.12; portalSet.rotation.z = -time * 0.08; portalSet.rotation.y = 0.45; }
    else { ringSet.rotation.y = -0.5; portalSet.rotation.y = 0.45; }
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
      isDark = d; look();
      snowMat.color.set(d ? 0xcfefff : 0x7fa6c9);
    },
    setSection(next: IceSection) { wanted = next; needModels(); },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); removeEventListener('resize', onResize);
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
