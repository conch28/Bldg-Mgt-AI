"""Builds the 3D city map data for the New Clark City + Clark demo.

Inputs: Overture Maps parquet extracts (OpenStreetMap-derived buildings, roads, water, land use, infrastructure)
and AWS Terrain Tiles (terrarium PNG, zoom 13). Outputs to public/geo/:
  terrain.json            one height grid for the whole map
  city-<chunk>.json       buildings, roads, water, land use, solar, airport for each chunk

Usage: python3 build.py <outdir> <tiles dir> <chunk>=<parquet dir> ...
"""
import json, math, random, sys, glob, re, os
import numpy as np
from PIL import Image
import pyarrow.parquet as pq
import shapely, shapely.wkb as wkb
from shapely.geometry import box
from shapely.strtree import STRtree

OUTDIR, TILES = sys.argv[1], sys.argv[2]
CHUNKS = dict(a.split('=') for a in sys.argv[3:])
OLAT, OLON = 15.3445, 120.5310  # origin: New Clark City athletics stadium
KX = math.cos(math.radians(OLAT)) * 111320.0
KY = 110574.0
def X(lon): return (lon - OLON) * KX
def Z(lat): return -(lat - OLAT) * KY  # three.js: north = -z
def tr(g): return shapely.transform(g, lambda a: np.c_[(a[:, 0] - OLON) * KX, -(a[:, 1] - OLAT) * KY])
def llbox(lon0, lat0, lon1, lat1): return box(X(lon0), Z(lat1), X(lon1), Z(lat0))

BBOX = {"ncc": (120.475, 15.295, 120.62, 15.39), "clark": (120.47, 15.14, 120.61, 15.295)}
FULL = (120.47, 15.14, 120.62, 15.39)

# Districts: real places from OpenStreetMap, plus one clearly illustrative concept zone (Pax Silica).
DIST = [
  ("ngac", "National Government Administrative Center", llbox(120.5235, 15.3375, 120.5395, 15.3500)),
  ("village", "Athletes' Village", llbox(120.5322, 15.3420, 120.5360, 15.3442)),
  ("hub", "NCC Transport Hub", llbox(120.5254, 15.3415, 120.5276, 15.3442)),
  ("filinvest", "Filinvest New Clark City", llbox(120.5172, 15.3472, 120.5232, 15.3566)),
  ("shrine", "Capas National Shrine", llbox(120.5423, 15.3456, 120.5481, 15.3551)),
  ("substation", "Shin Clark substation", llbox(120.5228, 15.3602, 120.5246, 15.3614)),
  ("solarfarm", "Concepcion Solar Farm", llbox(120.5965, 15.3655, 120.6200, 15.3862)),
  ("waste", "Metro Clark Waste Management", llbox(120.5195, 15.2985, 120.5300, 15.3075)),
  ("camp", "Camp O'Donnell", llbox(120.4990, 15.3610, 120.5200, 15.3760)),
  ("pax", "Pax Silica AI hub (concept)", llbox(120.4870, 15.3250, 120.5150, 15.3440)),
  ("cristorey", "Cristo Rey & Lawy", llbox(120.5240, 15.3505, 120.5600, 15.3800)),
  ("capas", "Capas town", llbox(120.5780, 15.3100, 120.6200, 15.3700)),
  ("technopark", "Pampanga Technopark", llbox(120.5625, 15.2518, 120.5881, 15.2718)),
  ("airport", "Clark International Airport", llbox(120.5416, 15.1638, 120.5740, 15.2104)),
  ("ti", "Texas Instruments & north industrial area", llbox(120.5300, 15.1950, 120.5480, 15.2120)),
  ("philexcel", "PhilExcel Business Park", llbox(120.5265, 15.1703, 120.5381, 15.1770)),
  ("mimosa", "Mimosa leisure estate", llbox(120.5140, 15.1840, 120.5300, 15.1990)),
  ("cfz", "Clark Freeport main zone", llbox(120.5050, 15.1700, 120.5420, 15.2000)),
  ("gateway", "SM City Clark & Aeropark", llbox(120.5680, 15.1630, 120.5850, 15.1830)),
  ("angeles", "Angeles City & Dau", llbox(120.5750, 15.1400, 120.6100, 15.1900)),
  ("mabalacat", "Mabalacat & Bamban", llbox(120.5450, 15.1900, 120.6100, 15.2950)),
]
ORDER = ["village", "hub", "substation", "shrine", "ngac", "filinvest", "solarfarm", "waste", "camp", "pax", "cristorey", "capas",
         "technopark", "airport", "ti", "philexcel", "mimosa", "gateway", "cfz", "angeles", "mabalacat"]
DI = {d[0]: i for i, d in enumerate(DIST)}
def district_of(p):
  for k in ORDER:
    if DIST[DI[k]][2].contains(p): return DI[k]
  return -1

def r1(v): return int(round(v))
def flat(coords):
  out = []
  for x, y in coords: out += [r1(x), r1(y)]
  return out
def parts(g):
  return list(g.geoms) if hasattr(g, 'geoms') else [g]

# ---------- Terrain (whole map) ----------
tiles = {}
for f in glob.glob(os.path.join(TILES, '13_*.png')):
  _, x, y = re.findall(r'(\d+)_(\d+)_(\d+)', os.path.basename(f))[0]
  a = np.asarray(Image.open(f).convert('RGB')).astype(np.float64)
  tiles[(int(x), int(y))] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
def elev(lon, lat):
  n = 2 ** 13
  fx = (lon + 180) / 360 * n
  r = math.radians(lat); fy = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
  tx, ty = int(fx), int(fy); px, py = (fx - tx) * 256, (fy - ty) * 256
  t = tiles[(tx, ty)]
  i, j = min(int(py), 254), min(int(px), 254); dy, dx = py - i, px - j
  return t[i, j] * (1 - dx) * (1 - dy) + t[i, j + 1] * dx * (1 - dy) + t[i + 1, j] * (1 - dx) * dy + t[i + 1, j + 1] * dx * dy
STEP = 75.0
x0, x1, z0, z1 = X(FULL[0]), X(FULL[2]), Z(FULL[3]), Z(FULL[1])
nx, nz = int((x1 - x0) / STEP) + 1, int((z1 - z0) / STEP) + 1
H = np.array([[elev(OLON + (x0 + i * STEP) / KX, OLAT - (z0 + j * STEP) / KY) for i in range(nx)] for j in range(nz)])
hmin = float(H.min())
terrain = {"nx": nx, "nz": nz, "x0": round(x0), "z0": round(z0), "step": STEP, "base": round(hmin, 1), "h": [int(round(v - hmin)) for v in H.flatten()]}
districts = [{"id": k, "name": n, "p": flat(p.exterior.coords), "c": [r1(p.centroid.x), r1(p.centroid.y)]} for k, n, p in DIST]
meta = {"origin": [OLON, OLAT], "bbox": list(FULL), "chunks": list(CHUNKS),
        "sources": ["Buildings, roads, rivers, land use, airport and solar panels: OpenStreetMap contributors via Overture Maps (release 2026-11-18), ODbL",
                    "Some building outlines: Google Open Buildings and Microsoft ML Buildings via Overture Maps",
                    "Terrain: AWS Terrain Tiles (SRTM and other sources)"]}
json.dump({"meta": meta, "terrain": terrain, "districts": districts}, open(os.path.join(OUTDIR, 'terrain.json'), 'w'), separators=(',', ':'))
print("terrain", nx, nz, hmin, H.max())

LU_KEEP = {"residential": "res", "industrial": "ind", "retail": "com", "commercial": "com", "school": "edu", "university": "edu", "college": "edu",
  "park": "park", "grass": "grass", "pitch": "pitch", "golf_course": "golf", "cemetery": "cem", "construction": "cons", "national_park": "park",
  "farmland": "farm", "orchard": "farm", "meadow": "grass", "military": "mil", "base": "mil", "hospital": "edu", "quarry": "quarry",
  "recreation_ground": "park", "track": "pitch", "resort": "park", "theme_park": "park", "zoo": "park", "garden": "park"}
WW = {"river": 18, "stream": 5, "canal": 5, "drain": 2.5, "ditch": 2}
RC = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4, "residential": 5, "unclassified": 5, "living_street": 5,
      "service": 6, "track": 7, "unknown": 6, "pedestrian": 8, "footway": 8, "path": 8, "cycleway": 8, "steps": 8, "bridleway": 8}
KINDS = ["home", "apartment", "civic", "sports", "school", "retail", "industrial", "farm", "religious", "utility", "datahall", "hotel", "transport"]
K = {k: i for i, k in enumerate(KINDS)}
OVERRIDE = {  # (lon, lat) of a mapped footprint -> (name, kind, height m) where OSM leaves the name or height out
  (120.52906, 15.34309): ("New Clark City Aquatics Center", "sports", 18),
}
NAMED_KIND = [  # name pattern -> kind
  (r"terminal|airport|bus station|cargo", "transport"), (r"hotel|resort|casino|villas|inn\b|suites", "hotel"),
  (r"mall|market|plaza|duty free|shopping|supermart|supermarket|hypermarket|walter|s&r|mart\b|cityfront|central town", "retail"),
  (r"hospital|medical", "civic"), (r"school|university|college|academy", "school"), (r"church|parish|chapel|cathedral", "religious"),
  (r"texas instrument|factory|plant|steel|pipe|depot|warehouse|hangar|metrojet|aderans|geely|yokohama|industr|unit \d|building \d", "industrial"),
  (r"tech hub|aeropark|office|center|centre|sutherland|convention|smx|teleperformance|it park", "civic"),
  (r"stadium|gym|arena|sports|court", "sports"),
]

for chunk, src in CHUNKS.items():
  lon0, lat0, lon1, lat1 = BBOX[chunk]
  EXT = box(X(lon0), Z(lat1), X(lon1), Z(lat0))
  rnd = random.Random(7)
  def rd(name): return pq.read_table(os.path.join(src, name + '.parquet'))

  landuse, lu_geoms, lu_kinds = [], [], []
  for r in rd('land_use').select(['geometry', 'class']).to_pylist():
    c = LU_KEEP.get(r['class'])
    if not c: continue
    g = tr(wkb.loads(r['geometry']))
    if g.area > 5e7: continue
    for p in parts(g.intersection(EXT)):
      if p.geom_type != 'Polygon' or p.area < 200: continue
      p = p.simplify(2)
      landuse.append({"c": c, "p": flat(p.exterior.coords)}); lu_geoms.append(p); lu_kinds.append(c)
  for r in rd('land').select(['geometry', 'class']).to_pylist():
    if r['class'] not in ('wood', 'forest', 'scrub', 'grassland'): continue
    for p in parts(tr(wkb.loads(r['geometry'])).intersection(EXT)):
      if p.geom_type != 'Polygon' or p.area < 500: continue
      landuse.append({"c": "wood" if r['class'] in ('wood', 'forest') else "grass", "p": flat(p.simplify(3).exterior.coords)})
  lu_tree = STRtree(lu_geoms)

  water_lines, water_polys = [], []
  for r in rd('water').select(['geometry', 'class', 'names']).to_pylist():
    name = (r['names'] or {}).get('primary')
    for p in parts(tr(wkb.loads(r['geometry'])).intersection(EXT)):
      if p.geom_type == 'LineString':
        w = WW.get(r['class'])
        if w: water_lines.append({"w": w, "p": flat(p.simplify(2).coords), **({"n": name} if name else {})})
      elif p.geom_type == 'Polygon' and p.area > 30:
        water_polys.append({"c": "pool" if r['class'] == 'swimming_pool' else "w", "p": flat(p.simplify(1).exterior.coords)})

  roads = []
  for r in rd('segment').select(['geometry', 'class', 'subtype', 'names', 'road_flags']).to_pylist():
    c = 9 if r['subtype'] == 'rail' else RC.get(r['class'], 6)
    name = (r['names'] or {}).get('primary')
    bridge = any('is_bridge' in (f.get('values') or []) for f in (r['road_flags'] or []))
    for p in parts(tr(wkb.loads(r['geometry'])).intersection(EXT)):
      if p.geom_type != 'LineString' or p.length < 3: continue
      e = {"c": c, "p": flat(p.simplify(1.5).coords)}
      if name and c <= 4: e["n"] = name
      if bridge: e["b"] = 1
      roads.append(e)

  solar, airport, pv_area = [], [], 0.0
  AIR_W = {"runway": 45, "taxiway": 20}
  for r in rd('infrastructure').select(['geometry', 'class', 'subtype', 'names']).to_pylist():
    g = tr(wkb.loads(r['geometry']))
    if not EXT.intersects(g): continue
    name = (r['names'] or {}).get('primary') or ''
    if r['class'] in ('generator', 'plant') and g.geom_type == 'Polygon':
      if r['class'] == 'plant': solar.append({"t": "bess" if 'BESS' in name else "plant", "p": flat(g.simplify(2).exterior.coords), "n": name})
      else: solar.append({"t": "pv", "p": flat(g.simplify(0.8).exterior.coords)}); pv_area += g.area
    elif r['subtype'] == 'airport' and r['class'] in AIR_W and g.geom_type == 'LineString':
      airport.append({"t": r['class'], "w": AIR_W[r['class']], "p": flat(g.simplify(2).coords)})
    elif r['subtype'] == 'airport' and r['class'] == 'apron' and g.geom_type == 'Polygon':
      airport.append({"t": "apron", "p": flat(g.simplify(2).exterior.coords)})

  names, boxes, polys = [], [], []
  def name_idx(n):
    if not n: return -1
    if n not in names: names.append(n)
    return names.index(n)
  for r in rd('building').select(['geometry', 'names', 'class', 'num_floors', 'height', 'bbox']).to_pylist():
    bb = r['bbox']; clon, clat = (bb['xmin'] + bb['xmax']) / 2, (bb['ymin'] + bb['ymax']) / 2
    if not (lon0 < clon <= lon1 and lat0 < clat <= lat1): continue
    g = tr(wkb.loads(r['geometry']))
    if g.geom_type == 'MultiPolygon': g = max(g.geoms, key=lambda q: q.area)
    if g.geom_type != 'Polygon': continue
    a = g.area
    if a < 15: continue
    c = g.centroid
    name = (r['names'] or {}).get('primary'); cls = r['class']
    d = district_of(c); dk = DIST[d][0] if d >= 0 else None
    lu = None
    for i in lu_tree.query(c):
      if lu_geoms[i].contains(c): lu = lu_kinds[i]; break
    mrr = g.minimum_rotated_rectangle
    xs = list(mrr.exterior.coords)
    e1, e2 = math.dist(xs[0], xs[1]), math.dist(xs[1], xs[2])
    long_, short = max(e1, e2), min(e1, e2)
    kind = "home"
    if cls in ("school", "university", "college", "kindergarten"): kind = "school"
    elif cls in ("church", "chapel", "mosque", "religious", "temple", "cathedral"): kind = "religious"
    elif cls in ("stadium", "sports_hall", "sports_centre", "grandstand"): kind = "sports"
    elif cls in ("office", "public", "civic", "government", "hospital"): kind = "civic"
    elif cls in ("hotel",): kind = "hotel"
    elif cls in ("retail", "commercial", "supermarket", "kiosk"): kind = "retail"
    elif cls in ("industrial", "warehouse", "factory", "manufacture", "hangar"): kind = "industrial"
    elif cls in ("transportation", "train_station"): kind = "transport"
    elif cls in ("apartments", "dormitory"): kind = "apartment"
    elif cls == "roof": kind = "sports"
    elif lu == "ind": kind = "industrial"
    elif lu == "edu": kind = "school"
    elif lu == "com": kind = "retail"
    elif dk in ("solarfarm", "substation"): kind = "utility"
    elif dk == "airport": kind = "transport" if a > 600 else "industrial"
    elif dk in ("philexcel", "technopark", "ti"): kind = "industrial" if a > 250 else "home"
    elif dk == "ngac": kind = "civic" if a > 400 else "home"
    elif dk == "village": kind = "apartment"
    elif a > 900 and long_ / max(short, 1) > 2.8: kind = "farm" if dk not in ("cfz", "gateway", "angeles", "mimosa") else "industrial"
    elif a > 1500: kind = "industrial"
    elif a > 400 and dk in ("capas", "angeles", "gateway", "cfz"): kind = "retail"
    if name:
      for pat, k in NAMED_KIND:
        if re.search(pat, name, re.I): kind = k; break
    if dk == "village" and a > 400: kind = "apartment"
    hgt = None
    for (olon, olat), (n2, k2, h2) in OVERRIDE.items():
      if abs(olon - clon) + abs(olat - clat) < 0.0004: name, kind, hgt = n2, k2, h2
    if name == "New Clark City Athletics Stadium": kind, hgt = "sports", 24
    if r['height']: hgt = float(r['height'])
    elif r['num_floors']: hgt = r['num_floors'] * 3.3 + 0.8
    if hgt is None:
      if kind == "home": hgt = 3.2 + rnd.random() * 2.6 if a < 90 else 4.5 + rnd.random() * 3.5
      elif kind == "apartment": hgt = 13.5
      elif kind == "civic": hgt = 10 + min(a / 400, 10)
      elif kind == "hotel": hgt = 12 + min(a / 500, 14)
      elif kind == "transport": hgt = 9 + min(a / 3000, 10)
      elif kind == "sports": hgt = 9 if a < 2000 else 15
      elif kind == "school": hgt = 6.5 + rnd.random() * 3
      elif kind == "retail": hgt = 5 + min(a / 400, 9)
      elif kind == "industrial": hgt = 8 + min(a / 1500, 6)
      elif kind == "farm": hgt = 4.2
      elif kind == "religious": hgt = 9
      else: hgt = 4
    ni = name_idx(name)
    if a / max(mrr.area, 1) > 0.86 and len(g.exterior.coords) <= 12 and ni < 0:
      (ax, ay), (bx, by) = xs[0], xs[1]
      mc = mrr.centroid
      # cx, cz, w*2, d*2, angle (milliradians), height*10, kind, district  (all integers)
      boxes += [r1(mc.x), r1(mc.y), r1(e1 * 2), r1(e2 * 2), r1(math.atan2(by - ay, bx - ax) * 1000), r1(hgt * 10), K[kind], d]
    else:
      p = g.simplify(0.6)
      if p.geom_type != 'Polygon' or p.is_empty: p = g
      polys.append({"p": flat(p.exterior.coords), "h": round(hgt, 1), "k": K[kind], "d": d, **({"n": ni} if ni >= 0 else {})})
  out = {"chunk": chunk, "kinds": KINDS, "names": names, "boxes": boxes, "polys": polys, "roads": roads, "waterLines": water_lines,
         "waterPolys": water_polys, "landuse": landuse, "solar": solar, "airport": airport, "pvArea": round(pv_area)}
  s = json.dumps(out, separators=(',', ':'))
  open(os.path.join(OUTDIR, f'city-{chunk}.json'), 'w').write(s)
  print(chunk, "boxes", len(boxes) // 8, "polys", len(polys), "roads", len(roads), "solar", len(solar), "airport", len(airport), "pv m2", round(pv_area), "bytes", len(s))
