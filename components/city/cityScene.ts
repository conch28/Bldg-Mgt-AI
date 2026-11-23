// three.js scene for the city-wide 3D map (New Clark City down to Clark Freeport).
// Real map data comes in as JSON chunks (see lib/nccCity.ts); this file only draws and animates it.
// Coordinates are local metres: x east, z south (north = -z), y up.

import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { ORIGIN, type ChunkData, type TerrainData, type Concept } from "@/lib/nccCity";
import type { GoogleTiles } from "./googleTiles";

export type Bld = { kind: number; dist: number; foot: number; h: number; x: number; z: number; y: number; name: string | null; concept?: string };
type Target = { mesh: THREE.InstancedMesh; i: number } | { geo: THREE.BufferGeometry; v0: number; vn: number };
export type Label = { id: string; x: number; z: number; y?: number; text: string; cls?: string; min?: number; max?: number; onClick?: () => void };
export type Beacon = { id: string; x: number; z: number; color: string; strong: boolean };
export type Stop = { pos: [number, number, number]; look: [number, number, number] };
/** Ground look: free satellite photo (default), drawn map, or Google photorealistic 3D. */
export type Look = "satellite" | "map" | "google";

export type CityScene = {
  buildings: Bld[];
  addChunk(c: ChunkData): void;
  addConcept(list: Concept[], dist: number): void;
  paint(fn: (i: number, out: THREE.Color) => void): void;
  setHour(h: number): void;
  setDataMode(on: boolean): void;
  select(i: number | null): void;
  setLabels(l: Label[]): void;
  setBeacons(b: Beacon[]): void;
  setOutlines(list: { p: number[]; color: string; dashed?: boolean; strong?: boolean }[]): void;
  flyTo(x: number, z: number, dist?: number, y?: number): void;
  tour(stops: Stop[], onStop: (i: number) => void, onEnd: () => void): void;
  stopTour(): void;
  reset(): void;
  zoom(f: number): void;
  setWheelFree(free: boolean): void;
  heightAt(x: number, z: number): number;
  setLook(look: Look, google?: { key: string; onError: (msg: string) => void }): void;
  attributions(): string;
  dispose(): void;
};

const ROAD = [ // colour, width (m), casing colour, night glow (0..1)
  ["#f3b55f", 26, "#b9792b", 1], ["#f7cd78", 20, "#c49a45", 1], ["#fbe39b", 15, "#c7ad62", 0.9], ["#ffffff", 12, "#b9b4a8", 0.8], ["#ffffff", 9, "#bdb8ac", 0.6],
  ["#fbfaf6", 6, "#cfcabd", 0.32], ["#f3f1ea", 4, "#d3cfc4", 0.18], ["#d7c9a6", 3, "", 0], ["#e9e4d6", 1.6, "", 0], ["#7b7f86", 4, "", 0.12],
] as const;
const LAND: Record<string, string> = {
  res: "#d9d4c3", ind: "#cfc6d3", com: "#e6cbc8", edu: "#ebe1b4", park: "#9ec98a", grass: "#acca90", pitch: "#8fc47b", golf: "#96ca80",
  cem: "#b7caa6", cons: "#dccaa5", farm: "#c6d092", mil: "#c4c8b2", quarry: "#d7ccb5", wood: "#7fae69",
};
const BASE_GROUND = "#bccb9a";
/** EGM96 geoid height near Clark, metres above the WGS84 ellipsoid (Google tiles use the ellipsoid). */
const GEOID = 44;

export function createCityScene(opts: { host: HTMLElement; terrain: TerrainData; mobile: boolean; onPick: (i: number | null, x: number, z: number) => void }): CityScene {
  const { host, terrain: T, mobile } = opts;
  let raf = 0, visible = true, disposed = false, wheelFree = false;

  // ---------- renderer, camera, controls ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance", logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  const labelLayer = document.createElement("div");
  labelLayer.className = "cm-labels";
  host.appendChild(labelLayer);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa9d3f5, 22000, 110000);
  const camera = new THREE.PerspectiveCamera(42, 1, 6, 120000);
  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 60;
  controls.maxDistance = 42000;
  controls.maxPolarAngle = 1.36;
  controls.zoomSpeed = 1.2;
  controls.screenSpacePanning = false;
  const HOME = { pos: new THREE.Vector3(7200, 6800, -7400), target: new THREE.Vector3(-300, 60, 2600) };
  camera.position.copy(HOME.pos); controls.target.copy(HOME.target);
  // Plain mouse-wheel scrolls the page unless the map is full screen; ctrl/⌘ + wheel or a trackpad pinch always zooms.
  const wheelFn = (controls as unknown as { _onMouseWheel?: EventListener })._onMouseWheel;
  if (wheelFn) renderer.domElement.removeEventListener("wheel", wheelFn);
  const onWheel = (e: WheelEvent) => {
    if (!wheelFree && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom(Math.exp(Math.max(-0.4, Math.min(0.4, e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)))));
  };
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  let tourState: null | { stops: Stop[]; i: number; t: number; from: { p: THREE.Vector3; l: THREE.Vector3 }; onStop: (i: number) => void; onEnd: () => void } = null;
  let flight: null | { t: number; dur: number; fromP: THREE.Vector3; fromL: THREE.Vector3; toP: THREE.Vector3; toL: THREE.Vector3; arc: number } = null;
  controls.addEventListener("start", () => { flight = null; if (tourState) { const e = tourState.onEnd; tourState = null; e(); } });

  // ---------- lights & sky ----------
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7a55, 1.0);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  scene.add(hemi, sun, sun.target);
  const sky = new THREE.Color();
  const starsGeo = new THREE.BufferGeometry();
  { const p: number[] = []; const r = new THREE.Vector3(); for (let i = 0; i < 1400; i++) { r.set(Math.random() * 2 - 1, Math.random() * 0.9 + 0.08, Math.random() * 2 - 1).normalize().multiplyScalar(90000); p.push(r.x, r.y, r.z); } starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); }
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  // shared uniforms for building shaders
  const U = { uNight: { value: 0 }, uGlow: { value: 0 }, uWin: { value: 1 } };
  function patch(m: THREE.Material) {
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = "varying vec3 vWP;\nvarying vec3 vNW;\n" + s.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        vec3 nn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4; nn = mat3(instanceMatrix) * nn;
        #endif
        wp4 = modelMatrix * wp4; vWP = wp4.xyz; vNW = normalize(mat3(modelMatrix) * nn);`);
      s.fragmentShader = "uniform float uNight;\nuniform float uGlow;\nuniform float uWin;\nvarying vec3 vWP;\nvarying vec3 vNW;\nfloat hh(vec2 p){return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453);}\n" +
        s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        if (abs(vNW.y) < 0.5 && uNight > 0.01) {
          float fy = vWP.y / 3.3; float fx = (vWP.x + vWP.z) / 3.1;
          float win = step(0.32, fract(fy)) * step(fract(fy), 0.78) * step(0.22, fract(fx)) * step(fract(fx), 0.72);
          float lit = step(0.42, hh(vec2(floor(fy), floor(fx / 3.0)) + floor(vWP.xz / 40.0)));
          totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * win * lit * uNight * uWin * 1.1;
        }
        totalEmissiveRadiance += diffuseColor.rgb * uGlow;`);
    };
    m.customProgramCacheKey = () => "cityPatch";
  }

  // ---------- terrain ----------
  const { nx, nz, x0, z0, step } = T;
  const hAt = (i: number, j: number) => T.h[Math.max(0, Math.min(nz - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  function heightAt(x: number, z: number) {
    const fx = (x - x0) / step, fz = (z - z0) / step;
    const i = Math.floor(fx), j = Math.floor(fz), dx = fx - i, dz = fz - j;
    return hAt(i, j) * (1 - dx) * (1 - dz) + hAt(i + 1, j) * dx * (1 - dz) + hAt(i, j + 1) * (1 - dx) * dz + hAt(i + 1, j + 1) * dx * dz;
  }
  const W = (nx - 1) * step;
  /** Chunk ground meshes, split by row ranges of the shared grid. */
  type Ground = { mesh: THREE.Mesh; zA: number; zB: number; mat: THREE.MeshLambertMaterial; drawn?: THREE.Texture; sat?: THREE.Texture };
  const grounds: Record<string, Ground> = {};
  function ground(id: string, zA: number, zB: number) {
    const jA = Math.max(0, Math.floor((zA - z0) / step)), jB = Math.min(nz - 1, Math.ceil((zB - z0) / step));
    const rows = jB - jA;
    const g = new THREE.PlaneGeometry(W, rows * step, nx - 1, rows);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j <= rows; j++) for (let i = 0; i < nx; i++) pos.setY(j * nx + i, hAt(i, jA + j) - 0.6);
    g.translate(x0 + W / 2, 0, z0 + jA * step + (rows * step) / 2);
    g.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: BASE_GROUND });
    const mesh = new THREE.Mesh(g, mat);
    mesh.userData.ground = true;
    scene.add(mesh);
    grounds[id] = { mesh, zA: z0 + jA * step, zB: z0 + jB * step, mat };
  }
  // the edge between the NCC and Clark chunks (lat 15.295)
  const zSplit = -(15.295 - 15.3445) * 110574;
  ground("ncc", z0, zSplit);
  ground("clark", zSplit, z0 + (nz - 1) * step);
  // A wide plain under everything so the horizon isn't a cliff.
  const plain = (() => { const g = new THREE.PlaneGeometry(400000, 400000); g.rotateX(-Math.PI / 2); g.translate(0, -2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: "#9fb07f" })); m.renderOrder = -1; scene.add(m); return m; })();

  // ---------- ground painting ----------
  function paintGround(c: ChunkData) {
    const gr = grounds[c.chunk]; if (!gr) return;
    const D = gr.zB - gr.zA;
    const maxPx = mobile ? 2048 : 4096;
    const sc = maxPx / Math.max(W, D);
    const cw = Math.round(W * sc), ch = Math.round(D * sc);
    const day = document.createElement("canvas"); day.width = cw; day.height = ch;
    const nightC = document.createElement("canvas"); nightC.width = Math.round(cw / 2); nightC.height = Math.round(ch / 2);
    const g = day.getContext("2d")!, n = nightC.getContext("2d")!;
    const px = (x: number) => (x - x0) * sc, pz = (z: number) => (z - gr.zA) * sc;
    const path = (ctx: CanvasRenderingContext2D, p: number[], k = 1, close = false) => {
      ctx.beginPath();
      for (let i = 0; i < p.length; i += 2) { const X = px(p[i]) * k, Z = pz(p[i + 1]) * k; if (i) ctx.lineTo(X, Z); else ctx.moveTo(X, Z); }
      if (close) ctx.closePath();
    };
    g.fillStyle = BASE_GROUND; g.fillRect(0, 0, cw, ch);
    // subtle noise so the plain isn't flat colour
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "90,110,60" : "230,225,190"},${0.05 + Math.random() * 0.06})`; const r = 6 + Math.random() * 40; g.beginPath(); g.arc(Math.random() * cw, Math.random() * ch, r, 0, 7); g.fill(); }
    for (const l of c.landuse) { g.fillStyle = LAND[l.c] ?? "#cccccc"; path(g, l.p, 1, true); g.fill(); }
    for (const a of c.airport) if (a.t === "apron") { g.fillStyle = "#b6b9bd"; path(g, a.p, 1, true); g.fill(); }
    g.lineCap = "round"; g.lineJoin = "round";
    for (const w of c.waterLines) { g.strokeStyle = "#6aa6da"; g.lineWidth = Math.max(1, w.w * sc); path(g, w.p); g.stroke(); }
    for (const w of c.waterPolys) { g.fillStyle = w.c === "pool" ? "#58c7e6" : "#6aa6da"; path(g, w.p, 1, true); g.fill(); }
    for (const a of c.airport) if (a.t !== "apron") { g.strokeStyle = a.t === "runway" ? "#5f6368" : "#8e9297"; g.lineWidth = (a.w ?? 20) * sc; path(g, a.p); g.stroke(); }
    for (const a of c.airport) if (a.t === "runway") { g.strokeStyle = "#ffffff"; g.setLineDash([30 * sc, 30 * sc]); g.lineWidth = Math.max(1, 1.2 * sc); path(g, a.p); g.stroke(); g.setLineDash([]); }
    for (const s of c.solar) { if (s.t === "pv") { g.fillStyle = "#22355e"; path(g, s.p, 1, true); g.fill(); } else { g.strokeStyle = s.t === "bess" ? "#8a63d2" : "#3c5590"; g.lineWidth = Math.max(1, 3 * sc); path(g, s.p, 1, true); g.stroke(); } }
    const order = [8, 7, 6, 5, 9, 4, 3, 2, 1, 0];
    for (const cls of order) { const [, w, casing] = ROAD[cls]; if (!casing) continue; g.strokeStyle = casing; g.lineWidth = Math.max(1, (w + 3) * sc); for (const r of c.roads) if (r.c === cls) { path(g, r.p); g.stroke(); } }
    for (const cls of order) {
      const [col, w] = ROAD[cls];
      g.strokeStyle = col; g.lineWidth = Math.max(cls >= 7 ? 0.6 : 1, w * sc);
      if (cls === 7 || cls === 9) g.setLineDash([8 * sc + 2, 6 * sc + 2]);
      for (const r of c.roads) if (r.c === cls) { path(g, r.p); g.stroke(); }
      g.setLineDash([]);
    }
    // night: street lights glow along the roads, runway edge lights
    n.fillStyle = "#000"; n.fillRect(0, 0, nightC.width, nightC.height); n.lineCap = "round"; n.lineJoin = "round";
    for (const cls of [6, 5, 4, 3, 2, 1, 0]) {
      const glow = ROAD[cls][3] as number; if (!glow) continue;
      n.strokeStyle = `rgba(255,${cls <= 2 ? 170 : 190},${cls <= 2 ? 80 : 110},${glow})`; n.lineWidth = Math.max(0.7, (ROAD[cls][1] as number) * sc * 0.5 * (cls <= 3 ? 1.6 : 1));
      for (const r of c.roads) if (r.c === cls) { path(n, r.p, 0.5); n.stroke(); }
    }
    for (const a of c.airport) if (a.t === "runway") { n.strokeStyle = "rgba(255,255,230,0.95)"; n.setLineDash([2, 3]); n.lineWidth = 1.4; path(n, a.p, 0.5); n.stroke(); n.setLineDash([]); }
    const tex = new THREE.CanvasTexture(day); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const em = new THREE.CanvasTexture(nightC); em.colorSpace = THREE.SRGBColorSpace;
    gr.drawn = tex;
    gr.mat.color.set("#ffffff"); gr.mat.map = look === "map" || !gr.sat ? tex : gr.sat; gr.mat.emissiveMap = em; gr.mat.emissive.set("#ffffff"); gr.mat.emissiveIntensity = U.uNight.value;
    gr.mat.needsUpdate = true;
    // UVs on PlaneGeometry run u: west→east, v: south→north, which matches the canvas (top = north).
  }

  // ---------- ground look: satellite photo, drawn map or Google 3D ----------
  let look: Look = "satellite";
  let google: GoogleTiles | null = null, googleLoading = false;
  const texLoader = new THREE.TextureLoader();
  function loadSat(id: string, gr: Ground) {
    if (gr.sat) return;
    // Cloud-free Sentinel-2 mosaic baked by scripts/geo/fetch-satellite.py, aligned to this ground mesh.
    gr.sat = texLoader.load(`/green/geo/sat-${id}.jpg`, () => { if (look !== "map") { gr.mat.map = gr.sat!; gr.mat.needsUpdate = true; } });
    gr.sat.colorSpace = THREE.SRGBColorSpace; gr.sat.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  function applyLook() {
    const g = look === "google" && google != null;
    for (const [id, gr] of Object.entries(grounds)) {
      if (look === "satellite") loadSat(id, gr);
      const want = look === "map" ? gr.drawn : gr.sat?.image ? gr.sat : gr.drawn;
      if (want && gr.mat.map !== want) { gr.mat.map = want; gr.mat.needsUpdate = true; }
      gr.mesh.visible = !g;
    }
    (plain.material as THREE.MeshLambertMaterial).color.set(look === "map" ? "#9fb07f" : "#6f7652");
    plain.visible = !g;
    if (google) google.group.visible = g;
    carPts.visible = !g;
    // On Google 3D our boxes would hide the real buildings: show them only as a see-through data layer.
    for (const m of [boxMat, polyMat]) { m.transparent = g; m.opacity = g ? 0.62 : 1; m.depthWrite = !g; m.needsUpdate = true; }
    for (const o of pickables) o.visible = !g || dataMode;
  }
  function setLook(l: Look, gopt?: { key: string; onError: (msg: string) => void }) {
    look = l;
    if (l === "google" && !google && !googleLoading && gopt?.key) {
      googleLoading = true;
      import("./googleTiles").then(({ createGoogleTiles }) => {
        googleLoading = false;
        if (disposed) return;
        google = createGoogleTiles({ key: gopt.key, lon0: ORIGIN.lon, lat0: ORIGIN.lat, geoid: GEOID, camera, renderer, mobile, onError: (msg) => {
          if (look === "google") { look = "satellite"; applyLook(); }
          gopt.onError(msg);
        } });
        scene.add(google.group);
        google.setShade(shade);
        applyLook();
      }).catch((e) => { googleLoading = false; look = "satellite"; applyLook(); gopt.onError(String(e)); });
    }
    applyLook();
  }

  // ---------- buildings ----------
  const buildings: Bld[] = [];
  const targets: Target[] = [];
  const pickables: THREE.Object3D[] = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); patch(boxMat);
  const polyMat = new THREE.MeshLambertMaterial({ vertexColors: true }); patch(polyMat);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();

  function addBoxes(list: { x: number; z: number; w: number; d: number; a: number; h: number; kind: number; dist: number; name: string | null; concept?: string }[]) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, boxMat, list.length);
    const ids = new Int32Array(list.length);
    list.forEach((b, k) => {
      const y = Math.min(heightAt(b.x, b.z), heightAt(b.x + b.w / 2, b.z + b.d / 2), heightAt(b.x - b.w / 2, b.z - b.d / 2)) - 0.4;
      q.setFromAxisAngle(yAxis, -b.a);
      m4.compose(v3.set(b.x, y, b.z), q, s3.set(b.w, b.h + 0.4, b.d));
      mesh.setMatrixAt(k, m4);
      mesh.setColorAt(k, tmpC.set("#dddddd"));
      const id = buildings.length;
      buildings.push({ kind: b.kind, dist: b.dist, foot: b.w * b.d, h: b.h, x: b.x, z: b.z, y, name: b.name, concept: b.concept });
      targets.push({ mesh, i: k });
      ids[k] = id;
    });
    mesh.userData.ids = ids;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    scene.add(mesh); pickables.push(mesh);
  }

  function addPolys(list: { p: number[]; h: number; k: number; d: number; n?: number }[], names: string[]) {
    if (!list.length) return;
    const pos: number[] = [], nor: number[] = [], triIds: number[] = [];
    const first = targets.length;
    for (const b of list) {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < b.p.length - 2; i += 2) pts.push(new THREE.Vector2(b.p[i], b.p[i + 1]));
      if (pts.length < 3) continue;
      if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
      let ymin = Infinity, cx = 0, cz = 0, area = 0;
      for (const p of pts) { ymin = Math.min(ymin, heightAt(p.x, p.y)); cx += p.x; cz += p.y; }
      cx /= pts.length; cz /= pts.length;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a.x * c.y - c.x * a.y; }
      const y0 = ymin - 0.5, y1 = ymin + b.h;
      const id = buildings.length, v0 = pos.length / 3;
      // walls (outward normals; the outline runs counter-clockwise in x/z)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const ex = c.x - a.x, ez = c.y - a.y, L = Math.hypot(ex, ez) || 1, nxw = ez / L, nzw = -ex / L;
        pos.push(a.x, y0, a.y, c.x, y0, c.y, c.x, y1, c.y, a.x, y0, a.y, c.x, y1, c.y, a.x, y1, a.y);
        for (let k = 0; k < 6; k++) nor.push(-nxw, 0, -nzw);
        triIds.push(id, id);
      }
      for (const f of THREE.ShapeUtils.triangulateShape(pts, [])) {
        for (const vi of [f[0], f[2], f[1]]) { pos.push(pts[vi].x, y1, pts[vi].y); nor.push(0, 1, 0); }
        triIds.push(id);
      }
      buildings.push({ kind: b.k, dist: b.d, foot: Math.abs(area) / 2, h: b.h, x: cx, z: cz, y: ymin, name: b.n != null ? names[b.n] : null });
      targets.push({ geo: null as unknown as THREE.BufferGeometry, v0, vn: pos.length / 3 - v0 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0.85), 3));
    geo.computeBoundingSphere();
    for (let t = first; t < targets.length; t++) (targets[t] as { geo: THREE.BufferGeometry }).geo = geo;
    const mesh = new THREE.Mesh(geo, polyMat);
    mesh.userData.tri = Int32Array.from(triIds);
    scene.add(mesh); pickables.push(mesh);
  }

  function addChunk(c: ChunkData) {
    paintGround(c);
    const list = [];
    const B = c.boxes;
    for (let i = 0; i < B.length; i += 8) {
      const kind = B[i + 6], foot = (B[i + 2] * B[i + 3]) / 4;
      if (mobile && kind === 0 && foot < 45 && B[i + 7] < 0) continue; // phones skip the smallest sheds outside named areas
      list.push({ x: B[i], z: B[i + 1], w: B[i + 2] / 2, d: B[i + 3] / 2, a: B[i + 4] / 1000, h: B[i + 5] / 10, kind, dist: B[i + 7], name: null });
    }
    addBoxes(list);
    addPolys(c.polys, c.names);
    addTraffic(c);
  }

  function addConcept(list: Concept[], dist: number) {
    const kinds = ["home", "apartment", "civic", "sports", "school", "retail", "industrial", "farm", "religious", "utility", "datahall", "hotel", "transport"];
    addBoxes(list.map((c) => ({ x: c.x, z: c.z, w: c.w, d: c.d, a: 0, h: c.h, kind: Math.max(0, kinds.indexOf(c.kind === "solar" || c.kind === "battery" ? "utility" : c.kind)), dist, name: c.name, concept: c.detail })));
  }

  function paint(fn: (i: number, out: THREE.Color) => void) {
    const touched = new Set<THREE.InstancedMesh>(); const geos = new Set<THREE.BufferGeometry>();
    for (let i = 0; i < buildings.length; i++) {
      fn(i, tmpC);
      if (i === selected) tmpC.set("#ff2fd0");
      const t = targets[i];
      if ("mesh" in t) { t.mesh.setColorAt(t.i, tmpC); touched.add(t.mesh); }
      else { const a = t.geo.attributes.color as THREE.BufferAttribute; for (let v = t.v0; v < t.v0 + t.vn; v++) a.setXYZ(v, tmpC.r, tmpC.g, tmpC.b); geos.add(t.geo); }
    }
    touched.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    geos.forEach((g) => { (g.attributes.color as THREE.BufferAttribute).needsUpdate = true; });
    lastPaint = fn;
  }
  let lastPaint: ((i: number, out: THREE.Color) => void) | null = null;

  // ---------- selection marker ----------
  let selected: number | null = null;
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: "#ff2fd0", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  marker.visible = false; scene.add(marker);
  function select(i: number | null) {
    selected = i;
    if (i == null) marker.visible = false;
    else { const b = buildings[i]; const r = Math.max(14, Math.sqrt(b.foot) * 0.75); marker.scale.set(r, 260, r); marker.position.set(b.x, b.y + 130, b.z); marker.visible = true; }
    if (lastPaint) paint(lastPaint);
  }

  // ---------- outlines (districts) ----------
  let outlineGroup = new THREE.Group(); scene.add(outlineGroup);
  function setOutlines(list: { p: number[]; color: string; dashed?: boolean; strong?: boolean }[]) {
    scene.remove(outlineGroup); outlineGroup.traverse((o) => { if (o instanceof THREE.Line) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    outlineGroup = new THREE.Group();
    for (const o of list) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < o.p.length - 2; i += 2) {
        const ax = o.p[i], az = o.p[i + 1], bx = o.p[i + 2], bz = o.p[i + 3];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 60));
        for (let k = 0; k < n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; pts.push(new THREE.Vector3(x, heightAt(x, z) + 4, z)); }
      }
      pts.push(pts[0].clone());
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = o.dashed ? new THREE.LineDashedMaterial({ color: o.color, dashSize: 60, gapSize: 40, transparent: true, opacity: o.strong ? 1 : 0.8 }) : new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: o.strong ? 1 : 0.55 });
      const line = new THREE.Line(g, m); if (o.dashed) line.computeLineDistances();
      outlineGroup.add(line);
    }
    scene.add(outlineGroup);
  }

  // ---------- alert beacons ----------
  let beaconGroup = new THREE.Group(); scene.add(beaconGroup);
  const beaconGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0);
  const ringGeo = new THREE.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2);
  function setBeacons(list: Beacon[]) {
    scene.remove(beaconGroup); beaconGroup = new THREE.Group();
    for (const b of list) {
      const y = heightAt(b.x, b.z);
      const beam = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: b.strong ? 0.55 : 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(b.x, y, b.z); beam.scale.set(6, b.strong ? 420 : 220, 6);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      ring.position.set(b.x, y + 3, b.z);
      beam.userData.ring = ring; beam.userData.phase = Math.random() * 6;
      beaconGroup.add(beam, ring);
    }
    scene.add(beaconGroup);
  }

  // ---------- traffic ----------
  type Path = { pts: number[]; cum: number[]; len: number };
  const paths: Path[] = [];
  let cars: { p: number; s: number; v: number; dir: number }[] = [];
  const carGeo = new THREE.BufferGeometry();
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!; const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const carMat = new THREE.PointsMaterial({ size: 14, map: dot, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const carPts = new THREE.Points(carGeo, carMat); carPts.frustumCulled = false; scene.add(carPts);
  function addTraffic(c: ChunkData) {
    for (const r of c.roads) {
      if (r.c > 4) continue;
      const cum = [0]; let L = 0;
      for (let i = 2; i < r.p.length; i += 2) { L += Math.hypot(r.p[i] - r.p[i - 2], r.p[i + 1] - r.p[i - 1]); cum.push(L); }
      if (L < 80) continue;
      paths.push({ pts: r.p, cum, len: L });
    }
    const total = paths.reduce((s, p) => s + p.len, 0);
    const N = mobile ? 450 : 1400;
    cars = [];
    for (const [pi, p] of paths.entries()) {
      const n = Math.round((p.len / total) * N + (Math.random() < ((p.len / total) * N) % 1 ? 1 : 0));
      for (let k = 0; k < n; k++) cars.push({ p: pi, s: Math.random() * p.len, v: 11 + Math.random() * 9, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    carGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(cars.length * 3), 3));
    carGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(cars.length * 3), 3));
    carColors(true);
  }
  let carNight = -1;
  function carColors(force = false) {
    const night = U.uNight.value > 0.4;
    if (!force && (night ? 1 : 0) === carNight) return;
    carNight = night ? 1 : 0;
    const col = carGeo.attributes.color as THREE.BufferAttribute | undefined; if (!col) return;
    const day = ["#f5f5f5", "#d22f2f", "#2f4fd2", "#222222", "#bbbbbb", "#e8c547"];
    cars.forEach((c, i) => { tmpC.set(night ? (c.dir > 0 ? "#fff3c4" : "#ff4a3d") : day[i % day.length]); col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b); });
    col.needsUpdate = true;
    carMat.size = night ? 22 : 12; carMat.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending; carMat.needsUpdate = true;
  }
  function moveCars(dt: number) {
    const pos = carGeo.attributes.position as THREE.BufferAttribute | undefined; if (!pos) return;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i], p = paths[c.p];
      c.s += c.v * dt * 6 * c.dir; // a little faster than life so motion reads from far away
      if (c.s > p.len) c.s -= p.len; if (c.s < 0) c.s += p.len;
      let k = 1; while (k < p.cum.length - 1 && p.cum[k] < c.s) k++;
      const seg = p.cum[k] - p.cum[k - 1] || 1, t = (c.s - p.cum[k - 1]) / seg;
      const ax = p.pts[(k - 1) * 2], az = p.pts[(k - 1) * 2 + 1], bx = p.pts[k * 2], bz = p.pts[k * 2 + 1];
      const ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez) || 1, off = 3.2 * c.dir;
      const x = ax + ex * t + (ez / L) * off, z = az + ez * t - (ex / L) * off;
      pos.setXYZ(i, x, heightAt(x, z) + 2.5, z);
    }
    pos.needsUpdate = true;
  }

  // ---------- labels ----------
  let labels: { l: Label; el: HTMLDivElement }[] = [];
  function setLabels(list: Label[]) {
    labelLayer.replaceChildren();
    labels = list.map((l) => {
      const el = document.createElement("div");
      el.className = "cm-label " + (l.cls ?? "");
      el.textContent = l.text;
      if (l.onClick) { el.addEventListener("click", (e) => { e.stopPropagation(); l.onClick!(); }); el.style.pointerEvents = "auto"; }
      labelLayer.appendChild(el);
      return { l, el };
    });
  }
  const pv = new THREE.Vector3();
  function placeLabels() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const dist = camera.position.distanceTo(controls.target);
    for (const { l, el } of labels) {
      const show = dist >= (l.min ?? 0) && dist <= (l.max ?? Infinity);
      pv.set(l.x, (l.y ?? heightAt(l.x, l.z) + 40), l.z).project(camera);
      if (!show || pv.z > 1 || pv.x < -1.1 || pv.x > 1.1 || pv.y < -1.1 || pv.y > 1.1) { el.style.display = "none"; continue; }
      el.style.display = "";
      el.style.transform = `translate(-50%,-100%) translate(${((pv.x + 1) / 2) * w}px,${((1 - pv.y) / 2) * h}px)`;
    }
  }

  // ---------- day / night ----------
  const DAYSKY = new THREE.Color("#a7d0f2"), DUSK = new THREE.Color("#f0a06a"), NIGHT = new THREE.Color("#0a1326");
  function setHour(h: number) {
    const ang = ((h - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const night = 1 - THREE.MathUtils.smoothstep(elev, -0.12, 0.16);
    const day = THREE.MathUtils.clamp(elev * 1.6 + 0.1, 0, 1);
    sun.position.set(Math.cos(ang) * 20000 + controls.target.x, Math.max(elev, 0.05) * 20000, 8000 + controls.target.z);
    sun.target.position.copy(controls.target);
    sun.intensity = 0.25 + 2.3 * day;
    sun.color.set("#ffffff").lerp(new THREE.Color("#ffad66"), 1 - THREE.MathUtils.clamp(elev * 2.5, 0, 1));
    hemi.intensity = 0.5 + 0.7 * day;
    hemi.color.set("#dfefff").lerp(new THREE.Color("#33456e"), night);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.22) * (night < 0.98 ? 1 : 0);
    sky.copy(DAYSKY).lerp(NIGHT, night).lerp(DUSK, dusk * 0.55);
    renderer.setClearColor(sky); (scene.fog as THREE.Fog).color.copy(sky);
    U.uNight.value = night;
    (stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.3);
    for (const g of Object.values(grounds)) g.mat.emissiveIntensity = night * 1.2;
    shade = 0.22 + 0.78 * Math.max(day, 1 - night) ; google?.setShade(shade);
    carColors();
    if (dataMode) U.uGlow.value = 0.08 + 0.5 * night;
  }
  let dataMode = false, shade = 1;
  function setDataMode(on: boolean) { const ch = on !== dataMode; dataMode = on; U.uWin.value = on ? 0.3 : 1; U.uGlow.value = on ? 0.08 + 0.5 * U.uNight.value : 0; if (ch && look === "google") applyLook(); }

  // ---------- camera moves ----------
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function startFlight(toP: THREE.Vector3, toL: THREE.Vector3, dur: number) {
    const d = camera.position.distanceTo(toP);
    flight = { t: 0, dur, fromP: camera.position.clone(), fromL: controls.target.clone(), toP, toL, arc: Math.min(d * 0.3, 4500) };
  }
  function flyTo(x: number, z: number, dist = 900, y?: number) {
    const gy = y ?? heightAt(x, z);
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    if (!isFinite(dir.x) || dir.lengthSq() < 0.1) dir.set(0.5, 0, 0.85).normalize();
    startFlight(new THREE.Vector3(x + dir.x * dist * 0.75, gy + dist * 0.62, z + dir.z * dist * 0.75), new THREE.Vector3(x, gy + 20, z), 2.2);
  }
  function tour(stops: Stop[], onStop: (i: number) => void, onEnd: () => void) {
    tourState = { stops, i: -1, t: 0, from: { p: camera.position.clone(), l: controls.target.clone() }, onStop, onEnd };
    nextStop();
  }
  function nextStop() {
    if (!tourState) return;
    tourState.i++;
    if (tourState.i >= tourState.stops.length) { const e = tourState.onEnd; tourState = null; e(); return; }
    const s = tourState.stops[tourState.i];
    tourState.onStop(tourState.i);
    const dist = camera.position.distanceTo(new THREE.Vector3(...s.pos));
    startFlight(new THREE.Vector3(...s.pos), new THREE.Vector3(...s.look), Math.min(7, Math.max(3.5, dist / 2500)));
    tourState.t = 0;
  }
  function stopTour() { tourState = null; flight = null; }
  function reset() { startFlight(HOME.pos.clone(), HOME.target.clone(), 2.4); }
  function zoom(f: number) {
    const off = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(off.setLength(len));
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
    if (moved > 6 || dt > 600) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...pickables, ...Object.values(grounds).map((g) => g.mesh)], false);
    const h = hits[0];
    if (!h) { opts.onPick(null, 0, 0); return; }
    let id: number | null = null;
    if (h.object instanceof THREE.InstancedMesh && h.instanceId != null) id = (h.object.userData.ids as Int32Array)[h.instanceId];
    else if (h.object.userData.tri && h.faceIndex != null) id = (h.object.userData.tri as Int32Array)[h.faceIndex];
    opts.onPick(id, h.point.x, h.point.z);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  // ---------- loop ----------
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; if (visible && !raf) loop(); }); io.observe(host);
  const onVis = () => { if (!document.hidden && visible && !raf) loop(); };
  document.addEventListener("visibilitychange", onVis);
  const clock = new THREE.Clock();
  const bound = { x0: x0 - 3000, x1: x0 + W + 3000, z0: z0 - 3000, z1: z0 + (nz - 1) * step + 3000 };
  function loop() {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    raf = requestAnimationFrame(loop);
    const dtReal = Math.min(0.5, clock.getDelta()), dt = Math.min(0.1, dtReal), now = clock.elapsedTime; // camera moves keep real time on slow devices
    if (flight) {
      flight.t += dtReal / flight.dur;
      const t = Math.min(1, flight.t), e = ease(t);
      camera.position.lerpVectors(flight.fromP, flight.toP, e); camera.position.y += Math.sin(Math.PI * e) * flight.arc;
      controls.target.lerpVectors(flight.fromL, flight.toL, e);
      if (t >= 1) { flight = null; if (tourState) tourState.t = 0; }
    } else if (tourState) {
      tourState.t += dtReal;
      // drift slowly around the stop while the caption is read
      const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(yAxis, dt * 0.06); camera.position.copy(controls.target).add(off);
      if (tourState.t > 3.4) nextStop();
    }
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, bound.x0, bound.x1);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, bound.z0, bound.z1);
    controls.update();
    // keep the camera above the hills
    const gy = heightAt(camera.position.x, camera.position.z) + 25;
    if (camera.position.y < gy) camera.position.y = gy;
    moveCars(dt);
    const camD = camera.position.distanceTo(controls.target);
    beaconGroup.children.forEach((o) => {
      if (!o.userData.ring) return;
      const k = Math.max(1, camD / 3000);
      o.scale.x = o.scale.z = 6 * k;
      const ring = o.userData.ring as THREE.Mesh, ph = (now * 0.8 + o.userData.phase) % 1;
      ring.scale.setScalar((12 + ph * 55) * k); (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - ph);
    });
    if (marker.visible) (marker.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(now * 4);
    if (google && google.group.visible) google.update();
    renderer.render(scene, camera);
    placeLabels();
  }
  setHour(13);
  applyLook();
  loop();

  return {
    buildings, addChunk, addConcept, paint, setHour, setDataMode, select, setLabels, setBeacons, setOutlines, flyTo, tour, stopTour, reset, zoom, heightAt, setLook,
    attributions() { return google && look === "google" ? google.attributions() : ""; },
    setWheelFree(f) { wheelFree = f; },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      if (google) { scene.remove(google.group); google.dispose(); google = null; }
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshLambertMaterial).map?.dispose(); (x as THREE.MeshLambertMaterial).emissiveMap?.dispose(); x.dispose(); }); });
      renderer.dispose(); renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
