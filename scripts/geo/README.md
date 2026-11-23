# 3D city map data (New Clark City to Clark Freeport)

`public/green/geo/*.json` feeds the `/green/map` page. It is built from open data:

- Buildings, roads, rivers, land use, airport and solar panels: OpenStreetMap contributors via
  [Overture Maps](https://overturemaps.org) (release 2026-11-18, ODbL). Some building outlines come from
  Google Open Buildings and Microsoft ML Buildings through Overture.
- Terrain: AWS Terrain Tiles (terrarium PNG, zoom 13), `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png`.

To rebuild (Python 3 with pyarrow, shapely, numpy, pillow):

```bash
# 1. extract each Overture theme for a bounding box (lon0,lon1,lat0,lat1) into one folder per chunk
for t in "buildings building" "transportation segment" "base water" "base land_use" "base infrastructure" "base land"; do
  set -- $t; BBOX=120.44,120.62,15.27,15.43 python3 scripts/geo/fetch-overture.py $1 $2 /tmp/ncc/ncc/$2.parquet
  set -- $t; BBOX=120.47,120.61,15.13,15.30 python3 scripts/geo/fetch-overture.py $1 $2 /tmp/ncc/clark/$2.parquet
done
# 2. download terrarium tiles 13/6836..6841/3741..3750 into /tmp/ncc/tiles as 13_<x>_<y>.png
# 3. build
python3 scripts/geo/build-city.py public/green/geo /tmp/ncc/tiles ncc=/tmp/ncc/ncc clark=/tmp/ncc/clark
```

Heights come from OSM `height` / `building:levels` where mapped and are estimated from building type and size elsewhere.
All energy, water, solar, carbon and alert numbers on the map are sample data made in `lib/nccCity.ts`.
The Pax Silica campus is a concept: its site and buildings are illustrative.

## Satellite photo (free fallback look)

`fetch-satellite.py` bakes `public/green/geo/sat-ncc.jpg` and `sat-clark.jpg` from free Copernicus
Sentinel-2 imagery on AWS (`sentinel-cogs`, no key). It masks clouds with each scene's SCL band and
takes the per-pixel median of 14 dry-season scenes, so the result is cloud-free. Images are aligned to
the ground meshes using `terrain.json`, so rerun it whenever the terrain grid changes.

    pip install rasterio numpy pillow
    python3 scripts/geo/fetch-satellite.py public/green/geo

Attribution: "Contains modified Copernicus Sentinel data 2025 to 2026".

## Google photorealistic 3D (optional)

Set `GOOGLE_MAPS_API_KEY` (Map Tiles API enabled, billing on, key restricted to the site's domain).
The map then offers a "Google 3D" look via `3d-tiles-renderer`; the Draco decoder it needs is served
from `public/green/draco/` (copied from `three/examples/jsm/libs/draco/gltf`). If Google fails to load,
the map falls back to the satellite look on its own.
