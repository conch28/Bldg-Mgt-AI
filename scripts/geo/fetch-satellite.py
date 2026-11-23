#!/usr/bin/env python3
"""Bake a cloud-free satellite photo under the 3D city map, from free Sentinel-2 imagery.

Reads Sentinel-2 L2A true-colour COGs from the public AWS bucket `sentinel-cogs`
(no key, no cost), masks clouds with each scene's SCL band, takes the per-pixel
median over several dry-season scenes, and writes one JPEG per ground chunk,
aligned exactly to the ground meshes in components/city/cityScene.ts.

  pip install rasterio numpy pillow
  AWS_NO_SIGN_REQUEST=YES python3 scripts/geo/fetch-satellite.py public/green/geo

Licence: Copernicus Sentinel data is free for any use, with attribution
("Contains modified Copernicus Sentinel data 2025-2026").
"""
import json, os, sys
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from PIL import Image

os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
BUCKET = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs"
# Dry-season scenes with little cloud over Clark (MGRS tiles 51PTS and 51PTT).
SCENES = [
    "S2A_51PTS_20260319_0_L2A", "S2B_51PTS_20250106_0_L2A", "S2C_51PTS_20260406_0_L2A", "S2B_51PTS_20250116_0_L2A",
    "S2C_51PTS_20260416_0_L2A", "S2B_51PTS_20260401_0_L2A", "S2C_51PTS_20251227_0_L2A", "S2C_51PTS_20260426_0_L2A",
    "S2C_51PTT_20260327_0_L2A", "S2C_51PTT_20250421_0_L2A", "S2A_51PTT_20250314_0_L2A", "S2B_51PTT_20260501_0_L2A",
    "S2C_51PTT_20260506_0_L2A", "S2B_51PTT_20250426_0_L2A",
]
BAD_SCL = {0, 1, 3, 8, 9, 10}  # no data, saturated, cloud shadow, cloud medium/high, cirrus
WIDTH = 2048


def url(scene: str, band: str) -> str:
    _, tile, date, *_ = scene.split("_")
    return f"{BUCKET}/{tile[:2]}/{tile[2]}/{tile[3:]}/{date[:4]}/{int(date[4:6])}/{scene}/{band}.tif"


def main(outdir: str):
    tf = json.load(open(os.path.join(outdir, "terrain.json")))
    T, meta = tf["terrain"], tf["meta"]
    lon0, lat0 = meta["origin"]
    KX = np.cos(np.radians(lat0)) * 111320.0
    KY = 110574.0
    nx, nz, x0, z0, step = T["nx"], T["nz"], T["x0"], T["z0"], T["step"]
    W = (nx - 1) * step
    z_split = -(15.295 - lat0) * KY
    # Same row maths as ground() in cityScene.ts
    def rows(zA, zB):
        jA = max(0, int(np.floor((zA - z0) / step))); jB = min(nz - 1, int(np.ceil((zB - z0) / step)))
        return z0 + jA * step, z0 + jB * step
    chunks = {"ncc": rows(z0, z_split), "clark": rows(z_split, z0 + (nz - 1) * step)}
    dst_crs = CRS.from_epsg(4326)
    for name, (zA, zB) in chunks.items():
        w = WIDTH; h = int(round(WIDTH * (zB - zA) / W))
        west, east = lon0 + x0 / KX, lon0 + (x0 + W) / KX
        north, south = lat0 - zA / KY, lat0 - zB / KY
        dst_tr = from_bounds(west, south, east, north, w, h)
        stack = []
        for sc in SCENES:
            rgb = np.zeros((3, h, w), np.uint8); scl = np.zeros((h, w), np.uint8)
            try:
                with rasterio.open(url(sc, "TCI")) as s:
                    for b in range(3):
                        reproject(rasterio.band(s, b + 1), rgb[b], dst_transform=dst_tr, dst_crs=dst_crs, resampling=Resampling.bilinear)
                with rasterio.open(url(sc, "SCL")) as s:
                    reproject(rasterio.band(s, 1), scl, dst_transform=dst_tr, dst_crs=dst_crs, resampling=Resampling.nearest)
            except Exception as e:  # a missing scene just drops out of the median
                print("skip", sc, e); continue
            bad = np.isin(scl, list(BAD_SCL)) | (rgb.sum(0) == 0)
            a = rgb.astype(np.float32); a[:, bad] = np.nan
            print(name, sc, f"clear {100 * (1 - bad.mean()):.0f}%")
            stack.append(a)
        med = np.nanmedian(np.stack(stack), axis=0)
        med = np.where(np.isnan(med), np.nanmedian(med), med)
        # TCI is dark and hazy: lift it with a gentle levels + gamma stretch.
        lo, hi = np.percentile(med, 0.5), np.percentile(med, 99.7)
        out = np.clip((med - lo) / (hi - lo), 0, 1) ** 0.8
        img = Image.fromarray((out.transpose(1, 2, 0) * 255).astype(np.uint8))
        p = os.path.join(outdir, f"sat-{name}.jpg")
        img.save(p, quality=82, optimize=True, progressive=True)
        print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/green/geo")
