/**
 * Three.js scene for the BCDA building view: the NGAC Government Building as two low-rise office
 * blocks (North and South) joined by a glass atrium, each floor split into 4 bays you can tap.
 * The massing is simplified and illustrative, not a survey. Loaded on demand so other pages never pay for three.js.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type BcdaPaint = { id: string; color: string; pulse?: boolean };
export type BcdaScene = { paint: (p: BcdaPaint[]) => void; select: (id: string | null) => void; setTheme: (dark: boolean) => void; reset: () => void; dispose: () => void };

const FH = 1.1; // floor height
const BAY_W = 4.2, BAY_D = 6; // each bay
const WING_Z: Record<string, number> = { N: -6.2, S: 6.2 };

function label(text: string) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = "600 28px system-ui, sans-serif";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 44;
  c.width = w; c.height = 64;
  g.fillStyle = "rgba(10,40,70,.82)"; g.beginPath(); g.roundRect(4, 8, w - 8, 48, 24); g.fill();
  g.fillStyle = "#fff"; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set((w / 64) * 1.1, 1.1, 1); sp.renderOrder = 20;
  return sp;
}

export function createBcdaScene(opts: { host: HTMLElement; zones: { id: string; wing: string; floor: number; bay: number }[]; floors: number; dark: boolean; motion: boolean; onPick: (id: string | null) => void }): BcdaScene {
  const { host } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 400);
  const HOME = new THREE.Vector3(25, 18, 29);
  camera.position.copy(HOME);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, opts.floors * FH * 0.45, 0);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.48; controls.minDistance = 14; controls.maxDistance = 90;
  controls.autoRotate = opts.motion; controls.autoRotateSpeed = 0.5;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(20, 40, 18); scene.add(sun);

  // ground: lawn, plaza, river-park strip
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xcfe3c4 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 64), groundMat); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0xe6e1d6 });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), plazaMat); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; scene.add(plaza);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(96, 4.5), new THREE.MeshLambertMaterial({ color: 0x6fa8d6 })); river.rotation.x = -Math.PI / 2; river.position.set(0, 0.02, 24); scene.add(river);
  // trees
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x4f8f4a });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2; const r = 20 + (i % 3) * 3;
    const t = new THREE.Mesh(new THREE.SphereGeometry(1 + (i % 2) * 0.4, 10, 8), treeMat); t.position.set(Math.cos(a) * r, 1.2, Math.sin(a) * r * 0.75 - 2); scene.add(t);
  }

  const width = 4 * BAY_W;
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const slabMat = new THREE.MeshLambertMaterial({ color: 0xd9dee4 });
  const disposables: { dispose: () => void }[] = [];
  // wings: base slab, roof, solar on roof
  for (const w of Object.keys(WING_Z)) {
    for (let f = 0; f <= opts.floors; f++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.12, BAY_D + 0.6), slabMat);
      s.position.set(0, f * FH, WING_Z[w]); scene.add(s);
    }
    const roofY = opts.floors * FH + 0.1;
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.3), new THREE.MeshLambertMaterial({ color: 0x1c3d66 }));
      p.position.set(-width / 2 + 1.6 + i * 2.6, roofY + 0.18, WING_Z[w] - 1.2); p.rotation.x = -0.2; scene.add(p);
      const p2 = p.clone(); p2.position.z = WING_Z[w] + 1.2; scene.add(p2);
    }
    const lab = label(w === "N" ? "North Building" : "South Building"); lab.position.set(0, opts.floors * FH + 2.2, WING_Z[w]); scene.add(lab);
  }
  // glass atrium joining the wings
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5, opts.floors * FH, 6.2), new THREE.MeshPhongMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.35, shininess: 90 }));
  glass.position.set(0, (opts.floors * FH) / 2, 0); scene.add(glass);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 7.4), shellMat); canopy.position.set(0, opts.floors * FH + 0.1, 0); scene.add(canopy);
  // plant yard: chillers and generators
  const yardMat = new THREE.MeshLambertMaterial({ color: 0x8a9199 });
  for (let i = 0; i < 2; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.4), yardMat); g.position.set(width / 2 + 4, 0.7, -5 + i * 2.2); scene.add(g); }
  const ylab = label("Generators"); ylab.scale.multiplyScalar(0.7); ylab.position.set(width / 2 + 4, 2.6, -4); scene.add(ylab);

  // bays (the tappable zones)
  const bays = new Map<string, THREE.Mesh>();
  const edges: THREE.LineSegments[] = [];
  for (const z of opts.zones) {
    const geo = new THREE.BoxGeometry(BAY_W - 0.14, FH - 0.2, BAY_D - 0.1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xdde6ee, transparent: true, opacity: 0.92 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-width / 2 + BAY_W / 2 + (z.bay - 1) * BAY_W, (z.floor - 1) * FH + FH / 2 + 0.06, WING_Z[z.wing]);
    m.userData.id = z.id;
    scene.add(m); bays.set(z.id, m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    e.position.copy(m.position); scene.add(e); edges.push(e);
    disposables.push(geo, mat);
  }
  // window mullions for a building feel
  const mull = new THREE.MeshBasicMaterial({ color: 0x5a6b7d });
  for (const w of Object.keys(WING_Z)) for (const side of [-1, 1]) for (let i = 0; i <= 16; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, opts.floors * FH, 0.05), mull);
    b.position.set(-width / 2 + i * (width / 16), (opts.floors * FH) / 2, WING_Z[w] + side * (BAY_D / 2 + 0.02)); scene.add(b);
  }

  // selection ring
  const selBox = new THREE.Mesh(new THREE.BoxGeometry(BAY_W + 0.1, FH, BAY_D + 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  selBox.visible = false; scene.add(selBox);

  let pulses = new Set<string>();
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects([...bays.values()])[0];
    opts.onPick(hit ? (hit.object.userData.id as string) : null);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  const setTheme = (dark: boolean) => {
    groundMat.color.set(dark ? 0x1d3326 : 0xcfe3c4);
    plazaMat.color.set(dark ? 0x2a3442 : 0xe6e1d6);
    slabMat.color.set(dark ? 0x3a4656 : 0xd9dee4);
    hemi.intensity = dark ? 0.8 : 1.1;
  };
  setTheme(opts.dark);

  const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); });
  ro.observe(host);
  let raf = 0; const t0 = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = (performance.now() - t0) / 1000;
    const k = opts.motion ? 0.5 + 0.5 * Math.sin(t * 4) : 1;
    for (const id of pulses) { const m = bays.get(id); if (m) (m.material as THREE.MeshLambertMaterial).emissive.setRGB(0.55 * k, 0.08 * k, 0.05 * k); }
    controls.update(); renderer.render(scene, camera);
  };
  loop();

  return {
    paint(list) {
      pulses = new Set();
      for (const p of list) {
        const m = bays.get(p.id); if (!m) continue;
        const mat = m.material as THREE.MeshLambertMaterial;
        mat.color.set(p.color); mat.emissive.setRGB(0, 0, 0);
        if (p.pulse) pulses.add(p.id);
      }
    },
    select(id) {
      const m = id ? bays.get(id) : null;
      selBox.visible = !!m; if (m) selBox.position.copy(m.position);
    },
    setTheme,
    reset() { camera.position.copy(HOME); controls.target.set(0, opts.floors * FH * 0.45, 0); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
      disposables.forEach((d) => d.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
