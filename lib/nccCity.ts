// City-wide 3D map of New Clark City.
// The map itself (buildings, roads, rivers, land use, solar panels, terrain) is real open data, built by
// scripts/geo/build-ncc-city.py into public/geo/ncc-city.json. Every number painted on it (energy, water,
// solar, carbon, alerts) is SAMPLE data for the demo, made here from a fixed seed so it looks the same each visit.
// The Pax Silica campus is a concept: the zone was announced in 2026 but no site plan or buildings are public.

import { solarShape, SITES } from "@/lib/green";

export type TerrainData = { nx: number; nz: number; x0: number; z0: number; step: number; base: number; h: number[] };
export type DistrictShape = { id: string; name: string; p: number[]; c: [number, number] };
export type TerrainFile = { meta: { origin: [number, number]; bbox: number[]; chunks: string[]; sources: string[] }; terrain: TerrainData; districts: DistrictShape[] };
export type ChunkData = {
  chunk: string; kinds: string[]; names: string[];
  /** per box, all integers: cx, cz, width×2, depth×2, angle (milliradians), height×10, kind, district */
  boxes: number[];
  polys: { p: number[]; h: number; k: number; d: number; n?: number }[];
  roads: { c: number; p: number[]; n?: string; b?: number }[];
  waterLines: { w: number; p: number[]; n?: string }[];
  waterPolys: { c: string; p: number[] }[];
  landuse: { c: string; p: number[] }[];
  solar: { t: "pv" | "plant" | "bess"; p: number[]; n?: string }[];
  airport: { t: "runway" | "taxiway" | "apron"; w?: number; p: number[] }[];
  pvArea: number;
};

// Same origin and scale as the build script.
const OLON = 120.531, OLAT = 15.3445;
const KX = Math.cos((OLAT * Math.PI) / 180) * 111320, KY = 110574;
export const toLocal = (lon: number, lat: number): [number, number] => [(lon - OLON) * KX, -(lat - OLAT) * KY];

export type Kind = "home" | "apartment" | "civic" | "sports" | "school" | "retail" | "industrial" | "farm" | "religious" | "utility" | "datahall" | "hotel" | "transport";
/** Same order as the build script. */
export const KINDS: Kind[] = ["home", "apartment", "civic", "sports", "school", "retail", "industrial", "farm", "religious", "utility", "datahall", "hotel", "transport"];
export const KIND_LABEL: Record<Kind, string> = {
  home: "House", apartment: "Apartment block", civic: "Government / civic", sports: "Sports venue", school: "School", retail: "Shop / commercial",
  industrial: "Factory / warehouse", farm: "Farm building", religious: "Church / chapel", utility: "Utility", datahall: "AI data hall (concept)",
  hotel: "Hotel / resort / casino", transport: "Airport / transport",
};
/** Okabe-Ito based so the categories stay readable for colour-blind viewers. */
export const KIND_COLOR: Record<Kind, string> = {
  home: "#d9d4c7", apartment: "#56B4E9", civic: "#0072B2", sports: "#E69F00", school: "#F0E442", retail: "#CC79A7",
  industrial: "#9a8f80", farm: "#b9ad8f", religious: "#e8dcc0", utility: "#8a63d2", datahall: "#00a39a", hotel: "#D55E00", transport: "#009E73",
};

export type DistrictInfo = { status: "real" | "nearby" | "concept" | "community"; title: string; blurb: string; facts: string[] };
export const DISTRICTS: Record<string, DistrictInfo> = {
  ngac: { status: "real", title: "National Government Administrative Center", blurb: "The first big build of New Clark City: the athletics stadium and aquatics center from the 2019 SEA Games, the disaster response center and government offices, beside the Sapang Kawayan creek.",
    facts: ["Athletics stadium and aquatics center outlines from OpenStreetMap", "Integrated Disaster Response Operation Center (mapped as 7 floors)", "Bus terminal and stops mapped by OSM volunteers"] },
  village: { status: "real", title: "Athletes' Village & government housing", blurb: "Mid-rise blocks built for the 2019 SEA Games athletes, now used as government employee housing.", facts: ["Building heights estimated at about 4 floors", "Outlines from OpenStreetMap"] },
  hub: { status: "real", title: "NCC Transport Hub", blurb: "Mapped in OpenStreetMap as a construction site west of the government center, linked by One Clark Boulevard.", facts: ["Shown as a construction area in OSM"] },
  filinvest: { status: "real", title: "Filinvest New Clark City", blurb: "Filinvest's mixed-use estate inside New Clark City, mapped in OpenStreetMap as an active construction area.", facts: ["Boundary from OSM land use", "Few buildings mapped yet"] },
  shrine: { status: "real", title: "Capas National Shrine", blurb: "The memorial park at the end of the 1942 Death March, with its obelisk and forest of trees. Shown for context.", facts: ["Protected area outline from OSM"] },
  substation: { status: "real", title: "Shin Clark Power substation", blurb: "Mapped power substation feeding the New Clark City grid.", facts: ["Location from OSM"] },
  solarfarm: { status: "nearby", title: "Concepcion Solar Farm & battery", blurb: "A large solar farm and battery storage site just east of the map's NCC area. Every panel row on the map is mapped in OpenStreetMap.", facts: ["2,200 panel rows mapped in OSM", "Capacity estimated from mapped panel area, not an official figure"] },
  waste: { status: "real", title: "Metro Clark Waste Management", blurb: "The regional sanitary landfill at Kalangitan, south of New Clark City.", facts: ["Location from OSM points of interest"] },
  camp: { status: "community", title: "Camp O'Donnell", blurb: "Military training camp north-west of the city core. Shown for context.", facts: ["Outline from OSM land use"] },
  cristorey: { status: "community", title: "Cristo Rey, Bueno & Lawy", blurb: "Existing barangays around New Clark City, home to thousands of families. Happier residents start here too.", facts: ["Houses from OSM, Google and Microsoft building outlines"] },
  capas: { status: "community", title: "Capas town centre", blurb: "The town proper of Capas, east of New Clark City, with its market, municipal hall and schools.", facts: ["Shown for context"] },
  technopark: { status: "real", title: "Pampanga Technopark", blurb: "Industrial estate in Mabalacat along MacArthur Highway, between New Clark City and Clark.", facts: ["Boundary from OSM land use"] },
  airport: { status: "real", title: "Clark International Airport", blurb: "Central Luzon's international gateway. The new Terminal 2, the older Terminal 1, cargo terminal, aprons, runway and taxiways are all mapped in OpenStreetMap.", facts: ["Terminal 2 footprint about 45,600 m², mapped at 4 floors", "Runway, taxiways and aprons from OSM"] },
  ti: { status: "real", title: "Texas Instruments & north industrial area", blurb: "Factories and warehouses north of the Clark main zone, including the Texas Instruments plant.", facts: ["Outlines and names from OSM"] },
  philexcel: { status: "real", title: "PhilExcel Business Park", blurb: "Factory and BPO buildings inside the Freeport, mapped building by building.", facts: ["Boundary from OSM land use"] },
  mimosa: { status: "real", title: "Mimosa leisure estate", blurb: "Hotels, casinos and golf: Hann Casino Resort, Midori Clark, Swissôtel and Quest Plus.", facts: ["Names from OSM; heights from floors where mapped"] },
  cfz: { status: "real", title: "Clark Freeport main zone", blurb: "The old Clark Air Base core: Clark Center, Parade Grounds, duty-free malls, hotels, offices and the regional medical center.", facts: ["Names, outlines and many floor counts from OSM"] },
  gateway: { status: "real", title: "SM City Clark & Aeropark", blurb: "SM City Clark, Clark Cityfront, SMX Convention Center, the Clark Tech Hubs, West Aeropark towers and The Medical City Clark.", facts: ["Tech hubs and Aeropark towers mapped with floor counts"] },
  angeles: { status: "community", title: "Angeles City & Dau", blurb: "Dense neighbourhoods and malls just outside the Freeport. Shown for context.", facts: ["Houses from OSM, Google and Microsoft building outlines"] },
  mabalacat: { status: "community", title: "Mabalacat & Bamban", blurb: "Towns along MacArthur Highway and SCTEX between Clark and New Clark City. Shown for context.", facts: ["Houses from OSM, Google and Microsoft building outlines"] },
  pax: { status: "concept", title: "Pax Silica AI hub (concept)", blurb: "A 4,000-acre AI-native industrial zone in New Clark City was announced in 2026. No site plan is public, so this campus and its location are illustrative only.", facts: ["Location and buildings are illustrative", "Halls sized like the Pax demo: 4 MW IT each"] },
};
export const STATUS_WORD: Record<DistrictInfo["status"], string> = { real: "Real place · OSM", nearby: "Real place nearby · OSM", concept: "Concept · illustrative", community: "Existing community · OSM" };

// ---------- Pax Silica concept campus (illustrative) ----------
export type Concept = { x: number; z: number; w: number; d: number; h: number; kind: Kind | "solar" | "battery"; name: string; detail: string };
export function paxConcept(district: DistrictShape): Concept[] {
  const xs = district.p.filter((_, i) => i % 2 === 0), zs = district.p.filter((_, i) => i % 2 === 1);
  const x0 = Math.min(...xs), z0 = Math.min(...zs), x1 = Math.max(...xs), z1 = Math.max(...zs);
  const out: Concept[] = [];
  for (let i = 0; i < 6; i++) out.push({ x: x0 + 520 + (i % 3) * 420, z: z0 + 420 + Math.floor(i / 3) * 360, w: 300, d: 140, h: 22, kind: "datahall", name: `AI data hall ${i + 1}`, detail: "Concept · 4 MW IT · liquid-cooled racks" });
  out.push({ x: x0 + 900, z: z0 + 1300, w: 380, d: 220, h: 18, kind: "industrial", name: "Advanced packaging & test plant", detail: "Concept · cleanrooms, 24/7 shifts" });
  out.push({ x: x0 + 1500, z: z0 + 1300, w: 160, d: 120, h: 14, kind: "industrial", name: "Critical minerals pilot lab", detail: "Concept · processing R&D" });
  out.push({ x: x0 + 300, z: z1 - 420, w: 90, d: 70, h: 62, kind: "civic", name: "R&D and offices", detail: "Concept · 900 staff" });
  for (let i = 0; i < 4; i++) out.push({ x: x0 + 260 + i * 120, z: z1 - 180, w: 90, d: 40, h: 20, kind: "apartment", name: `Worker housing Block ${"ABCD"[i]}`, detail: "Concept · 300 beds" });
  out.push({ x: x1 - 330, z: z0 + 400, w: 160, d: 130, h: 10, kind: "utility", name: "230 kV substation", detail: "Concept" });
  out.push({ x: x1 - 330, z: z0 + 800, w: 200, d: 150, h: 16, kind: "utility", name: "Cooling & water recycling plant", detail: "Concept · reuses ultrapure-water reject" });
  out.push({ x: x1 - 420, z: z1 - 380, w: 520, d: 380, h: 2.2, kind: "solar", name: "Solar canopy field", detail: "Concept · 12 MWp, matches the Pax demo" });
  out.push({ x: x1 - 820, z: z1 - 260, w: 120, d: 60, h: 4, kind: "battery", name: "Battery storage", detail: "Concept · 20 MWh" });
  return out;
}

// ---------- Sample metrics ----------
/** Energy use intensity (kWh per m² of floor per year) and water (m³ per m² per year), indicative for the Philippines. */
const EUI: Record<Kind, number> = { home: 55, apartment: 85, civic: 190, sports: 230, school: 45, retail: 260, industrial: 140, farm: 25, religious: 35, utility: 15, datahall: 0, hotel: 280, transport: 260 };
const WUI: Record<Kind, number> = { home: 1.3, apartment: 1.5, civic: 0.6, sports: 2.6, school: 0.5, retail: 0.9, industrial: 0.8, farm: 0.9, religious: 0.3, utility: 0.1, datahall: 0, hotel: 2.4, transport: 0.7 };
export const EF = SITES.ncc.ef; // t CO2 per MWh, same as the NCC dashboard
export const TARIFF = SITES.ncc.tariff;
export const SOLAR_DAY = 3.8; // kWh per kWp per day (same assumption as the dashboard)

/** Hourly load shape (0..1 relative) for each kind of building. */
export function loadShape(k: Kind, h: number) {
  const day = h >= 8 && h < 18 ? 1 : 0, eve = h >= 18 && h < 23 ? 1 : 0, night = h < 6 || h >= 23 ? 1 : 0;
  switch (k) {
    case "home": case "apartment": return 0.35 + 0.25 * (h >= 6 && h < 8 ? 1 : 0) + 0.15 * day + 0.65 * eve + 0.25 * night;
    case "civic": case "school": return 0.2 + 0.8 * day;
    case "hotel": return 0.55 + 0.2 * day + 0.3 * eve;
    case "transport": return 0.45 + 0.45 * (h >= 5 && h < 23 ? 1 : 0);
    case "retail": return 0.25 + 0.6 * (h >= 10 && h < 21 ? 1 : 0);
    case "sports": return 0.25 + 0.4 * day + 0.5 * eve;
    case "datahall": return 0.95 + 0.05 * day;
    default: return 0.5 + 0.4 * day;
  }
}
const SHAPE_SUM: Record<string, number> = {};
const shapeSum = (k: Kind) => (SHAPE_SUM[k] ??= Array.from({ length: 24 }, (_, h) => loadShape(k, h)).reduce((a, b) => a + b, 0));

export type Metrics = { floor: number; kwhDay: number; m3Day: number; roofKwp: number; solarKwp: number; label?: string };
const hash = (i: number) => { let x = (i + 1) * 2654435761; x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; return ((x >>> 0) % 10000) / 10000; };

/** Sample metrics for a building, from its real footprint and estimated height. */
export function sampleMetrics(i: number, kind: Kind, footprint: number, height: number, ncc: boolean): Metrics {
  const floors = Math.max(1, Math.round(height / 3.3));
  const floor = footprint * floors;
  const r = 0.75 + 0.5 * hash(i);
  const kwhDay = kind === "datahall" ? 4000 * 24 * 1.31 : (floor * EUI[kind] * r) / 365; // concept halls: 4 MW IT at PUE 1.31
  const m3Day = kind === "datahall" ? 38 : (floor * WUI[kind] * (0.7 + 0.6 * hash(i + 7))) / 365;
  const roofKwp = kind === "utility" ? 0 : footprint * 0.55 * 0.2; // 55% usable roof, 0.2 kWp per m²
  const share = ncc && ["civic", "sports", "school", "apartment", "datahall", "industrial", "transport", "hotel", "retail"].includes(kind) ? 0.35 + 0.4 * hash(i + 3) : hash(i + 5) < 0.04 ? 0.5 : 0;
  return { floor, kwhDay, m3Day, roofKwp, solarKwp: roofKwp * share };
}
export const kwAt = (m: Metrics, k: Kind, h: number) => (m.kwhDay * loadShape(k, h)) / shapeSum(k);
export const solarAt = (kwp: number, h: number) => (kwp * SOLAR_DAY * solarShape(h)) / 7.6; // solarShape integrates to ~7.6 over a day

// ---------- Sample alerts (real places, sample events) ----------
export type AlertKind = "water" | "energy" | "solar" | "grid" | "flood" | "carbon";
export type CityAlert = { id: string; kind: AlertKind; lon: number; lat: number; where: string; title: string; detail: string; ai: string; saving: string; severity: "high" | "medium" | "low"; district: string };
export const ALERT_COLOR: Record<AlertKind, string> = { water: "#3f9be8", energy: "#f59e0b", solar: "#facc15", grid: "#a78bfa", flood: "#22d3ee", carbon: "#ef4444" };
export const ALERT_ICON: Record<AlertKind, string> = { water: "💧", energy: "⚡", solar: "☀️", grid: "🔌", flood: "🌊", carbon: "🔥" };
export const ALERTS: CityAlert[] = [
  { id: "aqua", kind: "water", lon: 120.52906, lat: 15.34309, where: "Aquatics Center", district: "ngac", severity: "high", title: "Pool balance tank: water flowing all night",
    detail: "Night flow 2.1 m³/h against a normal 0.3 m³/h since Tue 2:10 AM. That is about 43 m³ a day down the drain.", ai: "Make-up valve likely stuck open. Ticket sent to the pool contractor with the meter graph.", saving: "₱2,400/day" },
  { id: "stadium", kind: "energy", lon: 120.53355, lat: 15.34557, where: "Athletics Stadium", district: "ngac", severity: "medium", title: "Floodlights still on 3 hours after the event",
    detail: "Field lighting drew 410 kW from 10 PM to 1 AM with no booking on the calendar.", ai: "AI now switches the lights off 30 minutes after the last booking, with a 1-tap override for guards.", saving: "₱13,500/night" },
  { id: "idroc", kind: "energy", lon: 120.53039, lat: 15.34484, where: "Disaster Response Center", district: "ngac", severity: "medium", title: "Chiller running at 1.1 kW per ton",
    detail: "Plant efficiency drifted from 0.68 to 1.1 kW/TR over two weeks. Condenser tubes likely fouled.", ai: "Cleaning booked for Saturday. AI re-sequenced the chillers to cut the waste by half until then.", saving: "₱6,800/day" },
  { id: "village", kind: "water", lon: 120.5349, lat: 15.3431, where: "Government housing, Building A", district: "village", severity: "low", title: "Riser 2: running toilets in 3 homes",
    detail: "Small but steady night flow on floors 2 to 4.", ai: "Friendly Taglish message sent to the 3 households with a free flapper replacement slot.", saving: "₱900/day" },
  { id: "filinvest", kind: "grid", lon: 120.5203, lat: 15.3519, where: "Filinvest New Clark City", district: "filinvest", severity: "medium", title: "Construction feeder near its limit at 2 PM",
    detail: "Peak load hit 94% of the temporary transformer's rating during the afternoon heat.", ai: "Staggered the batching plant and site cooling to keep the peak under 85%.", saving: "Avoids a trip" },
  { id: "substation", kind: "grid", lon: 120.5237, lat: 15.3608, where: "Shin Clark Power substation", district: "substation", severity: "low", title: "Evening peak 6 to 9 PM",
    detail: "Feeder load peaks as homes cool down after work, when grid power is dirtiest.", ai: "Battery and pre-cooling plans shave 1.8 MW off the peak.", saving: "₱19,000/day" },
  { id: "solar", kind: "solar", lon: 120.6078, lat: 15.3752, where: "Concepcion Solar Farm", district: "solarfarm", severity: "low", title: "Panel rows in the south block 9% below forecast",
    detail: "Output lower than clear-sky forecast for 3 dry days in a row. Looks like dust, not faults.", ai: "Cleaning crew scheduled for the dawn shift, before the panels heat up.", saving: "+11 MWh/week" },
  { id: "creek", kind: "flood", lon: 120.5372, lat: 15.3412, where: "Sapang Kawayan creek", district: "ngac", severity: "medium", title: "Creek level rising after heavy rain upstream",
    detail: "Level sensor up 0.6 m in 2 hours. Still 1.4 m below the flood mark.", ai: "Watch posted to the residents' chat in Taglish. Drainage crew on standby.", saving: "Safety" },
  { id: "landfill", kind: "carbon", lon: 120.5245, lat: 15.3021, where: "Metro Clark Waste Management", district: "waste", severity: "low", title: "Landfill gas flare offline for 40 minutes",
    detail: "Methane is about 28 times stronger than CO₂. The flare restarted on its own.", ai: "Logged for the operator and added to the carbon report.", saving: "≈ 9 t CO₂e avoided" },
  { id: "pax", kind: "water", lon: 120.5075, lat: 15.3335, where: "Pax Silica cooling plant (concept)", district: "pax", severity: "high", title: "Cooling tower 2 make-up line: float valve not closing",
    detail: "Night flow 3.4 m³/h against a normal 1.2 m³/h. Concept site, sample alert.", ai: "Crew dispatched with the exact valve location from the digital twin.", saving: "₱3,100/day" },
  { id: "cristo", kind: "water", lon: 120.5308, lat: 15.3579, where: "Cristo Rey water line", district: "cristorey", severity: "low", title: "Low water pressure at night",
    detail: "Pressure drops below 10 psi from 9 PM in 40 homes on the hill.", ai: "Pump schedule changed to refill the tank at noon on solar power.", saving: "Happier homes" },
  { id: "t2", kind: "energy", lon: 120.5605, lat: 15.1945, where: "Clark Airport Terminal 2", district: "airport", severity: "medium", title: "Cooling running full blast at gates with no flights",
    detail: "Gates 7 to 12 held at 22°C from 1 AM to 5 AM with no departures scheduled.", ai: "Zone cooling now follows the flight schedule, with a 45-minute pre-cool before boarding.", saving: "₱21,000/day" },
  { id: "sm", kind: "energy", lon: 120.5800, lat: 15.1685, where: "SM City Clark", district: "gateway", severity: "low", title: "Peak demand 8% above last month at 2 PM",
    detail: "Hot afternoon and a sale event pushed the mall's demand past its usual peak.", ai: "Pre-cooled from 11 AM on cheaper power and staged the escalator lighting.", saving: "₱8,600/day" },
  { id: "ti", kind: "energy", lon: 120.5392, lat: 15.2000, where: "Texas Instruments plant", district: "ti", severity: "medium", title: "Compressed-air leaks on the night shift",
    detail: "Compressors loaded at 38% with production lines idle between 2 and 4 AM.", ai: "Ultrasonic sweep found 14 leaking fittings. Tickets sent with exact locations.", saving: "₱5,200/day" },
  { id: "hann", kind: "water", lon: 120.5245, lat: 15.1908, where: "Hann Casino Resort", district: "mimosa", severity: "low", title: "Cooling tower bleeding more water than needed",
    detail: "Blowdown 30% higher than the water chemistry calls for.", ai: "Conductivity setpoint tuned. Make-up water drops about 18 m³ a day.", saving: "₱1,000/day" },
  { id: "philexcel", kind: "grid", lon: 120.5320, lat: 15.1735, where: "PhilExcel Business Park", district: "philexcel", severity: "low", title: "Low power factor on feeder 2",
    detail: "Power factor dropped to 0.86, risking a utility penalty this month.", ai: "Capacitor bank step 3 found faulty. Repair booked; penalty avoided.", saving: "₱48,000/month" },
  { id: "medical", kind: "carbon", lon: 120.5718, lat: 15.1782, where: "The Medical City Clark", district: "gateway", severity: "low", title: "Diesel generator test ran 50 minutes, not 30",
    detail: "Weekly test overran by 20 minutes, burning about 60 litres more diesel.", ai: "Test window now ends automatically. Logged for the carbon report.", saving: "≈ 160 kg CO₂" },
];

// ---------- Fly-through (camera positions in local metres: [x, y, z] and look-at [x, y, z]) ----------
export type Stop = { pos: [number, number, number]; look: [number, number, number]; title: string; text: string; hold?: number };
export function tourStops(): Stop[] {
  const at = (lon: number, lat: number) => toLocal(lon, lat);
  const [sx, sz] = at(120.53355, 15.34557), [ax, az] = at(120.52906, 15.34309), [vx, vz] = at(120.5345, 15.3432);
  const [fx, fz] = at(120.5202, 15.3518), [ssx, ssz] = at(120.5237, 15.3608), [px, pz] = at(120.501, 15.3345);
  const [cx, cz] = at(120.6078, 15.3758), [tx, tz] = at(120.591, 15.334), [hx, hz] = at(120.5265, 15.3428);
  const [wx, wz] = at(120.575, 15.262), [apx, apz] = at(120.558, 15.192), [mmx, mmz] = at(120.527, 15.188), [phx, phz] = at(120.532, 15.174), [smx, smz] = at(120.579, 15.169);
  return [
    { pos: [5200, 5200, 7800], look: [1500, 60, -400], title: "New Clark City", text: "9,450 hectares in Capas and Bamban, Tarlac. Every building, road and river on this map comes from open map data." },
    { pos: [sx + 520, 260, sz + 640], look: [sx, 70, sz], title: "Athletics Stadium", text: "Built for the 2019 SEA Games. AI switches off the floodlights after the last booking." },
    { pos: [ax - 300, 170, az + 380], look: [ax, 70, az], title: "Aquatics Center", text: "Pools are thirsty. A night-flow alert just caught a stuck valve here (sample)." },
    { pos: [vx + 380, 180, vz - 300], look: [vx, 70, vz], title: "Athletes' Village", text: "Homes for government workers. Residents get friendly tips and Green Points." },
    { pos: [hx - 200, 220, hz + 420], look: [hx, 70, hz], title: "Transport Hub", text: "Where buses and future rail meet. EV shuttles charge here at solar noon." },
    { pos: [fx + 700, 420, fz + 600], look: [fx, 70, fz], title: "Filinvest New Clark City", text: "A new estate rising. AI keeps the construction feeder under its limit." },
    { pos: [ssx + 260, 200, ssz + 260], look: [ssx, 80, ssz], title: "Shin Clark Power substation", text: "Where the city's power comes in. The evening peak is the one to shave." },
    { pos: [px + 1400, 700, pz + 1500], look: [px, 80, pz], title: "Pax Silica AI hub (concept)", text: "An illustrative campus for the announced AI-native industrial zone. Data halls cooled by AI, powered by the sun." },
    { pos: [cx - 1500, 900, cz + 1300], look: [cx, 80, cz], title: "Concepcion Solar Farm", text: "About 2,200 mapped panel rows, roughly 130 MWp by panel area (our estimate)." },
    { pos: [tx - 900, 500, tz + 900], look: [tx, 60, tz], title: "Capas town", text: "The neighbouring town. Happier residents means the communities around the city too." },
    { pos: [wx + 2600, 2200, wz + 3600], look: [wx, 60, wz - 2500], title: "South to Clark", text: "Down the SCTEX and MacArthur Highway corridor, past Bamban, Mabalacat and Pampanga Technopark." },
    { pos: [apx + 1300, 650, apz + 900], look: [apx, 80, apz], title: "Clark International Airport", text: "Terminal 2, Terminal 1, the cargo terminal and the runway, all from OSM. AI cools gates by the flight schedule." },
    { pos: [mmx + 600, 380, mmz + 700], look: [mmx, 70, mmz], title: "Clark Freeport main zone", text: "Hotels, casinos, duty-free malls and offices. Every building gets its own energy and water score." },
    { pos: [phx + 600, 360, phz + 550], look: [phx, 70, phz], title: "PhilExcel Business Park", text: "Factories and BPOs. AI finds compressed-air leaks and power factor penalties before the bill does." },
    { pos: [smx - 700, 420, smz + 650], look: [smx, 70, smz], title: "SM City Clark & Aeropark", text: "The mall, SMX, the tech hubs and the Aeropark towers. Pre-cooling on cheaper power trims the afternoon peak." },
    { pos: [16000, 16000, 26000], look: [1200, 60, 9000], title: "One region, one view", text: "New Clark City to Clark: power, water, solar, carbon and alerts on one live map, run by AI. Sample data for this demo." },
  ];
}

export const PV_KWP_PER_M2 = 0.2;

/** ?focus= keys other pages use (e.g. the Clark command center) mapped to this map's districts. */
export const FOCUS_ALIAS: Record<string, string> = {
  "ncc-gov": "ngac", "ncc-res": "village", "ncc-sports": "ngac", "pax-hub": "pax",
  "cfz-aviation": "airport", "cfz-industrial": "philexcel", "cfz-commercial": "gateway", "cfz-hospitality": "mimosa", "cfz-residential": "cfz",
};
