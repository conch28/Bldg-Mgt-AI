/**
 * Three.js scene for the 3D building view. Loaded on demand (dynamic import) so the
 * rest of the app never pays for three.js. Stylized tower: 10 units per floor around
 * a central core, lobby, two basement parking levels and a 6th-floor amenity deck.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Paint = { key: string; color: string; glow?: "red" | "amber" | "watch" | null };
export type SceneUnit = { key: string; floor: number; letter: string };
export type TwinScene = {
  paint: (p: Paint[]) => void;
  select: (key: string | null) => void;
  reset: () => void;
  setTheme: (dark: boolean) => void;
  dispose: () => void;
};

const H = 0.56; // floor height
// unit slots around the core: [x, z, width, depth]
const SLOT: Record<string, [number, number, number, number]> = {
  A: [-3.75, 2.05, 2.4, 1.9], B: [-1.25, 2.05, 2.4, 1.9], C: [1.25, 2.05, 2.4, 1.9], D: [3.75, 2.05, 2.4, 1.9],
  E: [5.95, 0, 1.9, 4.6],
  F: [3.75, -2.05, 2.4, 1.9], G: [1.25, -2.05, 2.4, 1.9], H: [-1.25, -2.05, 2.4, 1.9], J: [-3.75, -2.05, 2.4, 1.9],
  K: [-5.95, 0, 1.9, 4.6],
};
const GLOW: Record<string, string> = { red: "#ff3b30", amber: "#ffb020", watch: "#a26bff" };

export function createTwinScene(opts: {
  host: HTMLElement; units: SceneUnit[]; floors: [number, number]; zones: string[]; dark: boolean;
  onPick: (key: string | null) => void; motion: boolean;
}): TwinScene {
  const { host, units, floors, onPick } = opts;
  const [lo, hi] = floors;
  let visible = true, raf = 0, idleFrames = 0; // render-loop state (declared first: kick() runs during setup)
  const yOf = (f: number) => (f - 1) * H + H / 2; // floor 1 = lobby
  const top = yOf(hi) + H / 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y";
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  const home = { pos: new THREE.Vector3(34, top * 0.62, 40), target: new THREE.Vector3(0, top * 0.44, 0) };
  camera.position.copy(home.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false; // wheel would fight page scroll; tapping a unit zooms instead
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.5;
  controls.autoRotate = opts.motion;
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(20, 40, 25);
  scene.add(sun);

  // ---- materials (theme-dependent colours set in setTheme) ----
  const unitMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  const slabMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const coreMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.7 });
  const parkMat = new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55 });
  const poolMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.2 });

  // ---- units (one instanced mesh, 400 boxes) ----
  const box = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(box, unitMat, units.length);
  const m = new THREE.Matrix4();
  const keyIndex = new Map<string, number>();
  const centers: THREE.Vector3[] = [];
  const sizes: THREE.Vector3[] = [];
  units.forEach((u, i) => {
    const s = SLOT[u.letter] ?? [0, 0, 1.5, 1.5];
    const c = new THREE.Vector3(s[0], yOf(u.floor), s[1]);
    const z = new THREE.Vector3(s[2] - 0.12, H - 0.1, s[3] - 0.12);
    m.compose(c, new THREE.Quaternion(), z);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, new THREE.Color("#ccd6e0"));
    keyIndex.set(u.key, i); centers.push(c); sizes.push(z);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  // floor slabs
  const slabs = new THREE.InstancedMesh(box, slabMat, hi - lo + 2);
  for (let f = lo, i = 0; f <= hi + 1; f++, i++) {
    m.compose(new THREE.Vector3(0, (f - 1) * H, 0), new THREE.Quaternion(), new THREE.Vector3(14.2, 0.06, 6.3));
    slabs.setMatrixAt(i, m);
  }
  scene.add(slabs);

  // core (elevators, stairs, risers) and roof crown
  const coreH = top + 1.2;
  const core = new THREE.Mesh(box, coreMat);
  core.scale.set(9.6, coreH, 1.9); core.position.set(0, coreH / 2, 0);
  scene.add(core);
  const crown = new THREE.Mesh(box, slabMat);
  crown.scale.set(5, 0.9, 2.6); crown.position.set(0, top + 0.6, 0);
  scene.add(crown);

  // lobby (glass), parking (2 basements), amenity deck (east wing at floor 6), ground
  const lobby = new THREE.Mesh(box, glassMat);
  lobby.scale.set(13.6, H - 0.06, 5.8); lobby.position.set(0, yOf(1), 0);
  scene.add(lobby);
  const parking = new THREE.Group();
  for (let b = 1; b <= 2; b++) {
    const p = new THREE.Mesh(box, parkMat);
    p.scale.set(17, H - 0.08, 9); p.position.set(0, -b * H + H / 2 - 0.08, 0);
    parking.add(p);
  }
  scene.add(parking);
  const amenity = new THREE.Group(); // tap target: deck + podium; glow uses the deck only
  const deck = new THREE.Mesh(box, slabMat);
  deck.scale.set(4.4, 0.16, 6); deck.position.set(9.3, yOf(6) - H / 2 + 0.08, 0);
  const pool = new THREE.Mesh(box, poolMat);
  pool.scale.set(2.6, 0.05, 3.4); pool.position.set(9.6, yOf(6) - H / 2 + 0.19, 0.6);
  const podium = new THREE.Mesh(box, parkMat);
  const podH = yOf(6) - H / 2;
  podium.scale.set(4.4, podH, 6); podium.position.set(9.3, podH / 2, 0);
  amenity.add(deck, pool, podium);
  scene.add(amenity);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.005;
  scene.add(ground);

  const zoneMesh: Record<string, THREE.Object3D> = { lobby, parking, amenity, core };

  // ---- glows and selection ----
  const glows: { mesh: THREE.Mesh; kind: string; phase: number; zone: boolean }[] = [];
  const glowGroup = new THREE.Group();
  scene.add(glowGroup);
  const edge = new THREE.EdgesGeometry(box);
  const selBox = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: "#ffffff", depthTest: false, transparent: true }));
  selBox.renderOrder = 10; selBox.visible = false;
  const selFloor = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: "#3cc4c9", transparent: true, opacity: 0.9 }));
  selFloor.visible = false;
  scene.add(selBox, selFloor);

  function boundsOf(key: string): { c: THREE.Vector3; s: THREE.Vector3 } | null {
    const i = keyIndex.get(key);
    if (i != null) return { c: centers[i], s: sizes[i] };
    const id = key.replace("zone:", "");
    if (zoneMesh[id]) {
      const b = new THREE.Box3().setFromObject(id === "amenity" ? deck : id === "parking" ? parking.children[0] : zoneMesh[id]);
      return { c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()) };
    }
    return null;
  }

  function paint(list: Paint[]) {
    for (const g of glows) { glowGroup.remove(g.mesh); (g.mesh.material as THREE.Material).dispose(); }
    glows.length = 0;
    const col = new THREE.Color();
    for (const p of list) {
      const i = keyIndex.get(p.key);
      if (i != null) inst.setColorAt(i, col.set(p.color));
      if (!p.glow) continue;
      const b = boundsOf(p.key);
      if (!b) continue;
      const zone = p.key.startsWith("zone:");
      // unit alerts show through the building (x-ray) so nothing hides on the far side; big zones stay subtle
      const mat = new THREE.MeshBasicMaterial({ color: GLOW[p.glow], transparent: true, opacity: 0.5, depthWrite: false, depthTest: zone || p.glow !== "red", blending: THREE.AdditiveBlending });
      const g = new THREE.Mesh(box, mat);
      g.position.copy(b.c);
      g.scale.copy(b.s).addScalar(0.18);
      g.userData.base = g.scale.clone();
      g.renderOrder = p.glow === "red" ? 5 : 2;
      glowGroup.add(g);
      glows.push({ mesh: g, kind: p.glow, phase: Math.random() * Math.PI * 2, zone });
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    kick();
  }

  // camera easing
  let tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null = null;
  function flyTo(pos: THREE.Vector3, target: THREE.Vector3) {
    tween = { from: [camera.position.clone(), controls.target.clone()], to: [pos, target], t: 0 };
    kick();
  }
  function select(key: string | null) {
    const b = key ? boundsOf(key) : null;
    if (!b) { selBox.visible = false; selFloor.visible = false; return; }
    controls.autoRotate = false;
    selBox.visible = true; selBox.position.copy(b.c); selBox.scale.copy(b.s).addScalar(0.06);
    const isUnit = keyIndex.has(key!);
    selFloor.visible = isUnit;
    if (isUnit) { selFloor.position.set(0, b.c.y, 0); selFloor.scale.set(14.4, H, 6.5); }
    // look at it from the side it faces, a little above
    const dir = new THREE.Vector3(b.c.x * 0.6, 0, b.c.z === 0 ? 0.5 : Math.sign(b.c.z)).normalize();
    if (!isUnit) dir.set(1, 0, 1).normalize();
    const dist = isUnit ? 30 : 38;
    const target = new THREE.Vector3(b.c.x * 0.4, b.c.y, b.c.z * 0.3);
    flyTo(target.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, 5, 0)), target);
  }
  function reset() {
    selBox.visible = false; selFloor.visible = false;
    flyTo(home.pos.clone(), home.target.clone());
    controls.autoRotate = opts.motion;
  }

  function setTheme(dark: boolean) {
    unitMat.color.set("#ffffff");
    slabMat.color.set(dark ? "#3a4d66" : "#f4f6f8");
    coreMat.color.set(dark ? "#1c2a3d" : "#aab6c3");
    groundMat.color.set(dark ? "#13233a" : "#d5dee6");
    parkMat.color.set(dark ? "#22344c" : "#b9c4cf");
    glassMat.color.set(dark ? "#4fb6c9" : "#9fd6dd");
    hemi.intensity = dark ? 1.25 : 1.6;
    kick();
  }
  setTheme(opts.dark);

  // ---- picking: a tap (not a drag) selects ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number } | null = null;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([inst, lobby, parking, amenity, core], true)[0];
    if (!hit) { onPick(null); return; }
    if (hit.object === inst && hit.instanceId != null) { onPick(units[hit.instanceId].key); return; }
    for (const [id, o] of Object.entries(zoneMesh)) {
      let p: THREE.Object3D | null = hit.object;
      while (p) { if (p === o) { onPick("zone:" + id); return; } p = p.parent; }
    }
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);

  // ---- sizing and render loop (paused when off-screen or tab hidden) ----
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    el.style.width = w + "px"; el.style.height = h + "px";
    camera.aspect = w / h;
    // fit the tower: farther away on narrow (phone) screens
    const fit = camera.aspect < 0.9 ? 1.5 : camera.aspect < 1.3 ? 1.25 : 1.12;
    home.pos.set(34 * fit, top * 0.62, 40 * fit);
    camera.updateProjectionMatrix();
    kick();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  camera.position.copy(home.pos);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
  io.observe(host);
  const clock = new THREE.Clock();
  function frame() {
    // keep raf set while drawing, so "change" events fired by controls.update() don't schedule a second loop
    if (!visible || document.hidden) { raf = 0; return; }
    const t = clock.getElapsedTime();
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.035);
      const k = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.from[0], tween.to[0], k);
      controls.target.lerpVectors(tween.from[1], tween.to[1], k);
      if (tween.t >= 1) tween = null;
    }
    for (const g of glows) {
      const mat = g.mesh.material as THREE.MeshBasicMaterial;
      if (!opts.motion) { mat.opacity = g.kind === "red" ? 0.7 : 0.4; continue; }
      const speed = g.kind === "red" ? 4.2 : g.kind === "amber" ? 1.6 : 1.1;
      const w = (Math.sin(t * speed + g.phase) + 1) / 2;
      mat.opacity = (g.kind === "red" ? 0.25 + w * 0.65 : 0.15 + w * 0.35) * (g.zone ? 0.45 : 1);
      if (g.kind === "red" && !g.zone) g.mesh.scale.copy(g.mesh.userData.base as THREE.Vector3).multiplyScalar(1 + w * 0.08);
    }
    controls.update();
    renderer.render(scene, camera);
    const animating = opts.motion && (controls.autoRotate || glows.length > 0);
    if (animating || tween) { idleFrames = 0; raf = requestAnimationFrame(frame); }
    else if (idleFrames++ < 40) raf = requestAnimationFrame(frame); // let damping settle
    else raf = 0;
  }
  function kick() { idleFrames = 0; if (!raf) raf = requestAnimationFrame(frame); }
  controls.addEventListener("change", kick);
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);

  return {
    paint, select, reset, setTheme,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => { const x = o as THREE.Mesh; x.geometry?.dispose?.(); const mt = x.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((q) => q.dispose()); else mt?.dispose?.(); });
      renderer.dispose(); el.remove();
    },
  };
}
