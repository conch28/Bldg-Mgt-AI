// Google Photorealistic 3D Tiles under the city map. Loaded only when a Google Maps
// Platform key is configured and the viewer picks the "Google 3D" look, so the rest
// of the map keeps working (and costs nothing) without it.
//
// Billing: one root tileset request per map load ("session"). Restrict the key to
// the app's domain and to the Map Tiles API in Google Cloud Console.

import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TileCompressionPlugin, TilesFadePlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export type GoogleTiles = {
  group: THREE.Group;
  update(): void;
  setShade(k: number): void;
  attributions(): string;
  dispose(): void;
};

/**
 * @param lon0/lat0 the scene origin (degrees). Scene axes: x east, y up, z south.
 * @param geoid metres from the WGS84 ellipsoid up to sea level at the origin. Google
 *   tiles use ellipsoid heights, our terrain uses sea level, so this lines them up.
 */
export function createGoogleTiles(opts: {
  key: string; lon0: number; lat0: number; geoid: number; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; mobile: boolean; onError: (msg: string) => void;
}): GoogleTiles {
  const { key, lon0, lat0, geoid, camera, renderer, mobile, onError } = opts;
  const tiles = new TilesRenderer();
  const draco = new DRACOLoader().setDecoderPath("/green/draco/");
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true }));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new TilesFadePlugin());
  // Put (lat0, lon0, sea level) at the origin with +y up. Azimuth 180° turns the
  // library's frame (+x west, +z north) into ours (+x east, +z south).
  tiles.registerPlugin(new ReorientationPlugin({ lat: THREE.MathUtils.degToRad(lat0), lon: THREE.MathUtils.degToRad(lon0), height: geoid, azimuth: Math.PI, recenter: true }));
  tiles.errorTarget = mobile ? 24 : 12;
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);

  // Google tiles are unlit photos, so dim them ourselves at dusk and night.
  const mats = new Set<THREE.MeshBasicMaterial>();
  let shade = 1;
  tiles.addEventListener("load-model", ({ scene }) => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && "color" in m) { m.color.setScalar(shade); mats.add(m); }
    });
  });
  tiles.addEventListener("dispose-model", ({ scene }) => {
    scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (m) mats.delete(m); });
  });
  let failed = false;
  tiles.addEventListener("load-error", ({ tile, error }) => {
    // A failed root means a bad key, billing off, or a blocked network: fall back.
    if (!failed && (tile == null || tile === tiles.root)) { failed = true; onError(String(error?.message ?? error)); }
  });

  const attr: { type: string; value: unknown }[] = [];
  return {
    group: tiles.group,
    update() { camera.updateMatrixWorld(); tiles.setResolutionFromRenderer(camera, renderer); tiles.update(); },
    setShade(k) { if (Math.abs(k - shade) < 0.01) return; shade = k; mats.forEach((m) => m.color.setScalar(k)); },
    attributions() { attr.length = 0; tiles.getAttributions(attr); return attr.filter((a) => a.type === "string").map((a) => String(a.value)).join(" "); },
    dispose() { tiles.dispose(); draco.dispose(); mats.clear(); },
  };
}
