/**
 * Three.js scene for the 3D building view. Loaded on demand (dynamic import) so the
 * rest of the app never pays for three.js. Skyland Plaza: two matching towers (4 units per
 * floor around a core, bi-level penthouses on top), a shared podium with the pool deck at the
 * 5th level, glass lobbies and two basement parking levels. Layout facts live in lib/skyland.ts.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SITE, TOWERS, parseUnit } from "@/lib/skyland";

export type Paint = { key: string; color: string; glow?: "red" | "amber" | "watch" | string | null }; // a named state or a CSS colour
export type SceneUnit = { key: string };
export type TwinScene = {
  paint: (p: Paint[]) => void;
  select: (key: string | null) => void;
  reset: () => void;
  setLabels: (on: boolean) => void;
  zoom: (factor: number) => void; // <1 closer, >1 farther
  pan: (floors: number) => void; // + up, - down
  setTheme: (dark: boolean) => void;
  dispose: () => void;
};

const H = 0.56; // floor height
const TX: Record<string, number> = { A: -6.6, B: 6.6 }; // tower centres on the x axis
const PLATE = 7.6; // tower floor plate (square)
// unit slots around each tower core: [x, z, width, depth] relative to the tower centre
const SLOT: Record<string, [number, number, number, number]> = {
  "01": [-1.95, 1.95, 3.5, 3.5], // 187 sqm corner
  "02": [1.95, 1.95, 3.5, 3.5],
  "03": [1.95, -1.95, 3.5, 3.5],
  "04": [-1.95, -1.95, 3.5, 3.5],
};
const PH_SLOT: Record<string, [number, number, number, number]> = { "01": [-1.95, 0, 3.5, 7.4], "02": [1.95, 0, 3.5, 7.4] };
const GLOW: Record<string, string> = { red: "#ff3b30", amber: "#ffb020", watch: "#a26bff" };

function label(text: string, kind: "tower" | "shared" | "park" = "tower") {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = kind === "tower" ? "600 28px system-ui, sans-serif" : "600 24px system-ui, sans-serif";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 44;
  c.width = w; c.height = 64;
  g.fillStyle = kind === "tower" ? "rgba(15,30,50,.78)" : kind === "shared" ? "rgba(13,120,110,.9)" : "rgba(60,72,96,.92)";
  g.beginPath(); g.roundRect(4, 8, w - 8, 48, 24); g.fill();
  g.fillStyle = "#fff"; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = kind === "tower" ? 1 : 0.8;
  sp.scale.set((w / 64) * k, k, 1); sp.renderOrder = 20;
  return sp;
}

/** Top-down parking-bay stripes for the basement slabs. */
function parkingTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8394ab"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3;
  for (const y0 of [12, 156]) for (let x = 8; x <= 504; x += 24) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 88); g.stroke(); }
  g.setLineDash([14, 10]); g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTwinScene(opts: {
  host: HTMLElement; units: SceneUnit[]; dark: boolean; onPick: (key: string | null) => void; motion: boolean;
}): TwinScene {
  const { host, onPick } = opts;
  const units = opts.units.filter((u) => parseUnit(u.key) && TX[parseUnit(u.key)!.tower] != null);
  const hi = SITE.floors;
  let visible = true, raf = 0, idleFrames = 0; // render-loop state (declared first: kick() runs during setup)
  const yOf = (f: number) => (f - 1) * H + H / 2; // floor 1 = lobby
  const top = hi * H;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  const home = { pos: new THREE.Vector3(20, top * 0.8, 29), target: new THREE.Vector3(0, top * 0.42, 0) };
  camera.position.copy(home.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true; // two fingers on phones, right-drag on desktop
  controls.screenSpacePanning = true;
  controls.enableZoom = true; // pinch on phones; ctrl/⌘ + wheel or the buttons on desktop
  controls.zoomToCursor = false;
  controls.minDistance = 9;
  controls.maxDistance = 95;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.5;
  controls.autoRotate = opts.motion;
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener("start", () => { controls.autoRotate = false; });
  // Let the page scroll over the model: OrbitControls sets touch-action:none and grabs the wheel.
  // Vertical swipes and the mouse wheel scroll the page; horizontal drags still turn the towers.
  renderer.domElement.style.touchAction = "pan-y";
  const wheelFn = (controls as unknown as { _onMouseWheel?: EventListener })._onMouseWheel;
  if (wheelFn) renderer.domElement.removeEventListener("wheel", wheelFn);
  // plain wheel scrolls the page; ctrl/⌘ + wheel (and trackpad pinch, which sends ctrlKey) zooms the model
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomNow(Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.004))));
  };
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(20, 40, 25);
  scene.add(sun);

  // ---- materials (theme-dependent colours set in setTheme) ----
  const unitMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  const slabMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const coreMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.4, depthWrite: false });
  const parkMat = new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.85 });
  const parkTex = parkingTexture();
  const lotMat = new THREE.MeshStandardMaterial({ roughness: 0.9, map: parkTex }); // parking levels: their own colour + bay stripes
  const lotSide = new THREE.MeshStandardMaterial({ roughness: 0.9, color: "#6b7d96" });
  const sharedMat = new THREE.MeshStandardMaterial({ roughness: 0.3, transparent: true, opacity: 0.75 }); // shared spaces
  const glassMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55 });
  const poolMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.2 });
  const padMat = new THREE.MeshStandardMaterial({ color: "#f5b301", roughness: 0.6 });

  // ---- units (one instanced mesh) ----
  const box = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(box, unitMat, Math.max(1, units.length));
  inst.count = units.length;
  const m = new THREE.Matrix4();
  const keyIndex = new Map<string, number>();
  const centers: THREE.Vector3[] = [];
  const sizes: THREE.Vector3[] = [];
  units.forEach((u, i) => {
    const p = parseUnit(u.key)!;
    const s = (p.penthouse ? PH_SLOT[p.stack] : SLOT[p.stack]) ?? [0, 0, 1.5, 1.5];
    const span = p.penthouse ? 2 : 1;
    const c = new THREE.Vector3(TX[p.tower] + s[0], (p.floor - 1) * H + (span * H) / 2, s[1]);
    const z = new THREE.Vector3(s[2] - 0.14, span * H - 0.1, s[3] - 0.14);
    m.compose(c, new THREE.Quaternion(), z);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, new THREE.Color("#ccd6e0"));
    keyIndex.set(u.key, i); centers.push(c); sizes.push(z);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  const lobby = new THREE.Group(), core = new THREE.Group(), amenity = new THREE.Group();
  const tags = new THREE.Group(); // area labels (toggle)
  scene.add(tags);
  for (const t of TOWERS) {
    const x = TX[t.id];
    // floor slabs (2 to roof)
    const slabs = new THREE.InstancedMesh(box, slabMat, hi);
    for (let f = 2, i = 0; f <= hi + 1; f++, i++) {
      m.compose(new THREE.Vector3(x, (f - 1) * H, 0), new THREE.Quaternion(), new THREE.Vector3(PLATE, 0.06, PLATE));
      slabs.setMatrixAt(i, m);
    }
    scene.add(slabs);
    // core: elevators, stairs, risers
    const c = new THREE.Mesh(box, coreMat);
    const coreH = top + 0.9;
    c.scale.set(0.7, coreH, 0.7); c.position.set(x, coreH / 2, 0);
    core.add(c);
    const crown = new THREE.Mesh(box, slabMat);
    crown.scale.set(3.6, 0.7, 3.6); crown.position.set(x, top + 0.4, 0);
    core.add(crown);
    // glass lobby on the ground floor
    const lb = new THREE.Mesh(box, sharedMat);
    lb.scale.set(PLATE - 0.4, H - 0.06, PLATE - 0.4); lb.position.set(x, yOf(1), 0);
    lobby.add(lb);
    // 5th-level amenities inside the tower (gym, function rooms)
    const am = new THREE.Mesh(box, sharedMat);
    am.scale.set(PLATE - 0.4, H - 0.08, PLATE - 0.4); am.position.set(x, yOf(SITE.amenityFloor), 0);
    amenity.add(am);
    const tag = label(t.label);
    tag.position.set(x, top + 2.1, 0);
    scene.add(tag);
    const lt = label(`${t.label} lobby`, "shared"); lt.position.set(x, yOf(1) + 0.2, PLATE / 2 + 0.9); tags.add(lt);
    const lift = label("2 lifts", "shared"); lift.position.set(x + (x < 0 ? -2.9 : 2.9), top + 0.6, 0); tags.add(lift);
  }
  const gym = label(`Gym · function rooms (${SITE.amenityFloor}F)`, "shared"); gym.position.set(TX.A - 1, yOf(SITE.amenityFloor) + 0.3, PLATE / 2 + 1.1); tags.add(gym);
  const heli = label("Helipad", "shared"); heli.position.set(TX.A + 2.6, top + 1.2, -1.2); tags.add(heli);
  // helipad on Tower A's roof (which tower has it is our assumption)
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 32), padMat);
  pad.position.set(TX.A, top + 0.8, 0);
  core.add(pad);
  scene.add(lobby, core);

  // podium between the towers (floors 1-4) with the pool deck on its roof (5th level)
  const podH = (SITE.amenityFloor - 1) * H;
  const podW = TX.B - TX.A - PLATE + 0.2;
  const podium = new THREE.Mesh(box, parkMat);
  podium.scale.set(podW, podH, PLATE); podium.position.set(0, podH / 2, 0);
  const deck = new THREE.Mesh(box, slabMat);
  deck.scale.set(podW, 0.14, PLATE); deck.position.set(0, podH + 0.07, 0);
  const pool = new THREE.Mesh(box, poolMat);
  pool.scale.set(podW * 0.62, 0.05, PLATE * 0.42); pool.position.set(0, podH + 0.17, 0.9);
  amenity.add(podium, deck, pool);
  scene.add(amenity);
  const poolTag = label("Pool deck", "shared"); poolTag.position.set(0, podH + 0.9, PLATE / 2 + 0.4); tags.add(poolTag);

  // parking: two basement levels under the whole site
  const parking = new THREE.Group();
  for (let b = 1; b <= 2; b++) {
    const p = new THREE.Mesh(box, [lotSide, lotSide, lotMat, lotSide, lotSide, lotSide]);
    p.scale.set(TX.B - TX.A + PLATE + 3, H - 0.1, PLATE + 3); p.position.set(0, -b * H + H / 2 - 0.1 * b, 0);
    parking.add(p);
    const pt = label(`Parking B${b}`, "park"); pt.position.set(-(TX.B - TX.A + PLATE + 3) / 2 + 2.2, p.position.y, (PLATE + 3) / 2 + 0.5); tags.add(pt);
  }
  scene.add(parking);
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

  // meshes a zone glows on (a zone can sit in both towers, so each part glows on its own)
  const zoneParts = (id: string): THREE.Object3D[] =>
    id === "parking" ? [parking.children[0]] : id === "core" ? core.children.filter((o) => o !== pad && (o as THREE.Mesh).scale.y > 2)
      : id === "amenity" ? amenity.children.filter((o) => o !== podium && o !== pool) : zoneMesh[id]?.children ?? [];
  const boxOf = (o: THREE.Object3D) => { const b = new THREE.Box3().setFromObject(o); return { c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()) }; };

  function boundsOf(key: string): { c: THREE.Vector3; s: THREE.Vector3 } | null {
    const i = keyIndex.get(key);
    if (i != null) return { c: centers[i], s: sizes[i] };
    const id = key.replace("zone:", "");
    return zoneMesh[id] ? boxOf(id === "parking" ? parking.children[0] : id === "amenity" ? deck : zoneMesh[id]) : null;
  }

  function paint(list: Paint[]) {
    for (const g of glows) { glowGroup.remove(g.mesh); (g.mesh.material as THREE.Material).dispose(); }
    glows.length = 0;
    const col = new THREE.Color();
    for (const p of list) {
      const i = keyIndex.get(p.key);
      if (i != null) inst.setColorAt(i, col.set(p.color));
      if (!p.glow) continue;
      const zone = p.key.startsWith("zone:");
      const parts = zone ? zoneParts(p.key.slice(5)).map(boxOf) : [boundsOf(p.key)].filter((b): b is NonNullable<typeof b> => !!b);
      for (const b of parts) {
      // unit alerts show through the building (x-ray) so nothing hides on the far side; big zones stay subtle
      const mat = new THREE.MeshBasicMaterial({ color: GLOW[p.glow] ?? p.glow, transparent: true, opacity: 0.5, depthWrite: false, depthTest: zone || p.glow === "amber" || p.glow === "watch", blending: THREE.AdditiveBlending });
      const g = new THREE.Mesh(box, mat);
      g.position.copy(b.c);
      g.scale.copy(b.s).addScalar(0.18);
      g.userData.base = g.scale.clone();
      g.renderOrder = p.glow === "red" ? 5 : 2;
      glowGroup.add(g);
      glows.push({ mesh: g, kind: p.glow, phase: Math.random() * Math.PI * 2, zone });
      }
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
    const tx = b.c.x < 0 ? TX.A : TX.B;
    if (isUnit) { selFloor.position.set(tx, b.c.y, 0); selFloor.scale.set(PLATE + 0.2, b.s.y + 0.1, PLATE + 0.2); }
    // look at it from the side it faces (away from its tower core), a little above
    const dir = new THREE.Vector3(b.c.x - tx + (tx < 0 ? -0.8 : 0.8), 0, b.c.z === 0 ? 1.5 : b.c.z).normalize();
    if (!isUnit) dir.set(1, 0, 1.4).normalize();
    const dist = isUnit ? 30 : 40;
    const target = isUnit ? new THREE.Vector3(tx + (b.c.x - tx) * 0.5, b.c.y, b.c.z * 0.4) : new THREE.Vector3(b.c.x * 0.3, Math.max(b.c.y, top * 0.3), 0);
    flyTo(target.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, 5, 0)), target);
  }
  const offset = new THREE.Vector3();
  const clampTarget = () => {
    const t = controls.target;
    t.y = Math.max(0, Math.min(top + 1, t.y));
    t.x = Math.max(-14, Math.min(14, t.x)); t.z = Math.max(-10, Math.min(10, t.z));
  };
  function zoomNow(f: number) { // immediate (wheel)
    tween = null;
    offset.copy(camera.position).sub(controls.target);
    const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * f));
    camera.position.copy(controls.target).add(offset.setLength(d));
    controls.autoRotate = false; kick();
  }
  function zoom(f: number) { // eased (buttons)
    const base = tween ? tween.to : [camera.position.clone(), controls.target.clone()] as [THREE.Vector3, THREE.Vector3];
    offset.copy(base[0]).sub(base[1]);
    const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * f));
    controls.autoRotate = false;
    flyTo(base[1].clone().add(offset.clone().setLength(d)), base[1].clone());
  }
  function pan(floors: number) {
    const base = tween ? tween.to : [camera.position.clone(), controls.target.clone()] as [THREE.Vector3, THREE.Vector3];
    const ny = Math.max(0, Math.min(top + 1, base[1].y + floors * H));
    const dy = ny - base[1].y;
    controls.autoRotate = false;
    flyTo(base[0].clone().add(new THREE.Vector3(0, dy, 0)), base[1].clone().add(new THREE.Vector3(0, dy, 0)));
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
    sharedMat.color.set(dark ? "#2bb3a3" : "#5fd0c2");
    lotSide.color.set(dark ? "#3b4a63" : "#6b7d96");
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
    home.pos.set(20 * fit, top * 0.8, 29 * fit);
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
  controls.addEventListener("change", () => { clampTarget(); kick(); });
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);

  return {
    paint, select, reset, setTheme, zoom, pan,
    setLabels(on: boolean) { tags.visible = on; kick(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); el.removeEventListener("wheel", onWheel);
      controls.dispose();
      scene.traverse((o) => { const x = o as THREE.Mesh; x.geometry?.dispose?.(); const mt = x.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((q) => q.dispose()); else mt?.dispose?.(); });
      renderer.dispose(); el.remove();
    },
  };
}
