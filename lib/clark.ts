// Clark City water and power command center: one live view of power and water use across
// New Clark City and Clark Freeport, the alerts AI raises, and the savings pipeline from "found" to "verified".
//
// Pure data and maths (no database) so the page can tick "live" in the browser.
// Every building, reading, alert and peso figure here is ILLUSTRATIVE SAMPLE DATA for the demo,
// shown as such on screen. Building names are generic on purpose: no real tenant's data is implied.
// Rates and unit costs are assumptions, listed in ASSUMPTIONS and in docs/clark-command-center/plan.md.

export type Zone = "New Clark City" | "Clark Freeport";
export type DistrictKey =
  | "ncc-gov" | "ncc-res" | "ncc-sports" | "pax-hub"
  | "cfz-aviation" | "cfz-industrial" | "cfz-commercial" | "cfz-hospitality" | "cfz-residential";
export type BType = "Factory" | "Office" | "Mall" | "Hotel" | "Homes" | "Airport" | "Sports" | "Data centre" | "Hospital" | "School";
export type Metering = "Modbus gateway" | "CT clamp + LoRaWAN" | "Pulse reader + LoRaWAN" | "Camera OCR reader" | "AI photo reads" | "Bills only";

export type District = { key: DistrictKey; name: string; zone: Zone; x: number; y: number; blurb: string };
export type CBldg = {
  id: string; name: string; district: DistrictKey; type: BType;
  kwhDay: number; m3Day: number; // typical day now
  vsBase: number; // % change in use vs the pre-programme baseline (negative = saving)
  meter: Metering; online: boolean; people: number; comfort: number; // comfort 1-5 from occupant pulse surveys
};
export type Severity = "Critical" | "High" | "Medium";
export type Alert = {
  id: string; bldg: string; sev: Severity; kind: "Leak" | "After-hours load" | "Demand spike" | "Power factor" | "Meter offline" | "Compressed air" | "Chiller" | "Pressure";
  title: string; detail: string; since: string; costDay: number; action: string; owner: string; status: "New" | "Assigned" | "Crew on site";
};
export type Stage = "Found" | "Approved" | "Installing" | "Live" | "Verified";
export type Funding = "No capex" | "Own capex" | "ESCO shared savings" | "Solar PPA";
export type Measure = {
  id: string; title: string; what: string; area: "Power" | "Water" | "Both" | "Tariff";
  sites: number; capex: number; kwhYr: number; m3Yr: number; extraYr?: number; // extraYr: peso savings not from use (penalties, supply price)
  stage: Stage; funding: Funding; weeks: number; owner: string; resident: string;
};

export const STAGES: Stage[] = ["Found", "Approved", "Installing", "Live", "Verified"];
export const ASSUMPTIONS = {
  tariff: 10.5, // ₱/kWh blended commercial and industrial rate in Clark (assumed)
  water: 62, // ₱/m³ commercial water and sewer rate (assumed)
  ef: 0.71, // t CO₂ per MWh, Luzon-Visayas grid (assumed)
  start: "Jun 2026", // programme start for the sample
};

export const DISTRICTS: District[] = [
  { key: "ncc-gov", name: "NCC Government Center", zone: "New Clark City", x: 150, y: 70, blurb: "Government offices and data centre" },
  { key: "pax-hub", name: "Pax Silica Hub (concept)", zone: "New Clark City", x: 300, y: 60, blurb: "AI data halls and chip packaging" },
  { key: "ncc-sports", name: "NCC Sports City", zone: "New Clark City", x: 90, y: 170, blurb: "Stadium, aquatics centre, athletes' village" },
  { key: "ncc-res", name: "NCC Residences", zone: "New Clark City", x: 230, y: 165, blurb: "Homes and worker housing" },
  { key: "cfz-aviation", name: "Clark Airport district", zone: "Clark Freeport", x: 320, y: 360, blurb: "Terminals, cargo and aircraft maintenance" },
  { key: "cfz-industrial", name: "Clark industrial parks", zone: "Clark Freeport", x: 110, y: 380, blurb: "Factories, cold storage and logistics" },
  { key: "cfz-hospitality", name: "Clark hotels & resorts", zone: "Clark Freeport", x: 210, y: 455, blurb: "Hotels, casino resort, convention centre" },
  { key: "cfz-commercial", name: "Clark malls & offices", zone: "Clark Freeport", x: 320, y: 470, blurb: "Malls, BPO towers, office park" },
  { key: "cfz-residential", name: "Clark residential", zone: "Clark Freeport", x: 100, y: 500, blurb: "Condos, villages, hospital, school" },
];

const b = (id: string, name: string, district: DistrictKey, type: BType, kwhDay: number, m3Day: number, vsBase: number, meter: Metering, people: number, comfort: number, online = true): CBldg =>
  ({ id, name, district, type, kwhDay, m3Day, vsBase, meter, online, people, comfort });

export const BUILDINGS: CBldg[] = [
  b("gov-a", "Government office block A", "ncc-gov", "Office", 21000, 120, -8, "Modbus gateway", 2400, 4.4),
  b("gov-b", "Government office block B", "ncc-gov", "Office", 16500, 95, -6, "Modbus gateway", 1800, 4.3),
  b("gov-dc", "Government data centre", "ncc-gov", "Data centre", 52000, 140, -3, "Modbus gateway", 80, 4.5),
  b("pax-dh1", "AI data hall 1", "pax-hub", "Data centre", 134000, 230, -4, "Modbus gateway", 60, 4.4),
  b("pax-pkg", "Chip packaging & test plant", "pax-hub", "Factory", 60000, 900, -6, "Modbus gateway", 1100, 4.3),
  b("spt-stad", "Athletics stadium", "ncc-sports", "Sports", 9000, 110, -8, "CT clamp + LoRaWAN", 300, 4.5),
  b("spt-aqua", "Aquatics centre", "ncc-sports", "Sports", 11500, 310, -4, "Pulse reader + LoRaWAN", 450, 4.5),
  b("spt-vill", "Athletes' village", "ncc-sports", "Homes", 7800, 240, -6, "Pulse reader + LoRaWAN", 1100, 4.6),
  b("res-a", "Residences block A", "ncc-res", "Homes", 4800, 150, -7, "Pulse reader + LoRaWAN", 720, 4.6),
  b("res-b", "Residences block B", "ncc-res", "Homes", 4600, 145, -6, "Pulse reader + LoRaWAN", 700, 4.5),
  b("res-w", "Worker housing", "ncc-res", "Homes", 7500, 220, -4, "AI photo reads", 1200, 4.4),
  b("air-pt", "Passenger terminal", "cfz-aviation", "Airport", 96000, 620, -5, "Modbus gateway", 9000, 4.2),
  b("air-cg", "Cargo terminal & cold store", "cfz-aviation", "Airport", 31000, 90, -4, "CT clamp + LoRaWAN", 400, 4.1),
  b("air-mro", "Aircraft maintenance hangar", "cfz-aviation", "Factory", 18500, 160, -6, "CT clamp + LoRaWAN", 650, 4.0),
  b("ind-tire", "Tyre plant", "cfz-industrial", "Factory", 148000, 1850, -4, "Modbus gateway", 2600, 3.9),
  b("ind-semi", "Semiconductor assembly plant", "cfz-industrial", "Factory", 126000, 1400, -6, "Modbus gateway", 3100, 4.2),
  b("ind-elec", "Electronics plant", "cfz-industrial", "Factory", 54000, 380, -7, "CT clamp + LoRaWAN", 1500, 4.1),
  b("ind-food", "Food processing plant", "cfz-industrial", "Factory", 38000, 720, -4, "CT clamp + LoRaWAN", 700, 3.8),
  b("ind-log", "Logistics warehouse", "cfz-industrial", "Factory", 9500, 25, -10, "CT clamp + LoRaWAN", 220, 3.9),
  b("ind-gar", "Garment factory", "cfz-industrial", "Factory", 14000, 160, -2, "Bills only", 1300, 3.6, false),
  b("hot-res", "Resort hotel & casino", "cfz-hospitality", "Hotel", 64000, 780, -6, "Modbus gateway", 2800, 4.4),
  b("hot-2", "Business hotel", "cfz-hospitality", "Hotel", 15500, 210, -8, "Pulse reader + LoRaWAN", 600, 4.5),
  b("hot-3", "Boutique hotel", "cfz-hospitality", "Hotel", 5200, 85, -10, "Camera OCR reader", 180, 4.6),
  b("hot-cc", "Convention centre", "cfz-hospitality", "Office", 12000, 70, -11, "CT clamp + LoRaWAN", 900, 4.3),
  b("com-mall1", "Mall A", "cfz-commercial", "Mall", 82000, 520, -6, "Modbus gateway", 25000, 4.2),
  b("com-mall2", "Mall B", "cfz-commercial", "Mall", 46000, 310, -4, "Modbus gateway", 14000, 4.1),
  b("com-bpo1", "BPO tower 1", "cfz-commercial", "Office", 24000, 110, -9, "CT clamp + LoRaWAN", 3500, 4.3),
  b("com-bpo2", "BPO tower 2", "cfz-commercial", "Office", 19500, 95, -3, "AI photo reads", 2800, 4.0),
  b("com-park", "Office park", "cfz-commercial", "Office", 11000, 60, 0, "Bills only", 1200, 3.9, false),
  b("crs-condo", "Condominium tower", "cfz-residential", "Homes", 9200, 260, -5, "Camera OCR reader", 1100, 4.4),
  b("crs-vill", "Townhouse village", "cfz-residential", "Homes", 8800, 340, -4, "AI photo reads", 1400, 4.5),
  b("crs-hosp", "Hospital", "cfz-residential", "Hospital", 26000, 280, -4, "CT clamp + LoRaWAN", 1600, 4.2),
  b("crs-sch", "International school", "cfz-residential", "School", 6800, 120, -8, "Pulse reader + LoRaWAN", 1300, 4.5, false),
];

// Share of a day's use in each hour, by building type (24 values, relative; normalised below).
const P: Record<BType, number[]> = {
  Factory:      [92, 92, 92, 92, 92, 94, 100, 104, 106, 107, 108, 108, 104, 107, 108, 107, 105, 100, 96, 95, 94, 93, 93, 92],
  Office:       [28, 26, 25, 25, 26, 32, 55, 95, 130, 140, 145, 146, 138, 146, 148, 145, 135, 110, 75, 55, 45, 38, 32, 30],
  Mall:         [35, 32, 30, 30, 30, 32, 38, 55, 85, 120, 140, 148, 150, 152, 152, 150, 148, 146, 145, 140, 120, 80, 50, 40],
  Hotel:        [80, 74, 70, 68, 70, 80, 98, 108, 104, 98, 96, 98, 102, 104, 104, 104, 108, 118, 128, 130, 126, 116, 100, 88],
  Homes:        [70, 62, 58, 56, 58, 72, 96, 92, 76, 70, 70, 74, 80, 82, 82, 86, 98, 124, 148, 156, 150, 134, 110, 86],
  Airport:      [55, 45, 40, 42, 70, 105, 120, 124, 122, 118, 116, 116, 118, 118, 118, 118, 120, 122, 122, 120, 112, 100, 84, 68],
  Sports:       [30, 28, 28, 28, 30, 70, 120, 120, 105, 100, 100, 104, 110, 112, 112, 116, 130, 150, 155, 145, 120, 70, 40, 32],
  "Data centre":[98, 98, 97, 97, 97, 97, 98, 99, 100, 101, 102, 103, 104, 104, 104, 103, 102, 101, 100, 100, 99, 99, 98, 98],
  Hospital:     [86, 84, 82, 82, 84, 90, 100, 110, 116, 118, 118, 116, 114, 114, 114, 112, 108, 104, 102, 100, 96, 92, 90, 88],
  School:       [25, 24, 24, 24, 25, 35, 80, 150, 170, 172, 172, 165, 150, 165, 168, 150, 100, 60, 40, 32, 28, 26, 25, 25],
};
const NORM: Record<BType, number[]> = Object.fromEntries(
  Object.entries(P).map(([k, v]) => { const s = v.reduce((a, x) => a + x, 0); return [k, v.map((x) => (x * 24) / s)]; }),
) as Record<BType, number[]>;

/** Hour of day in Manila (0-23) and minute, independent of the server's time zone. */
export function manilaClock(t: number) {
  const d = new Date(t + 8 * 3600_000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
const noise = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
const idSeed = (id: string) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0);

/** Live power (kW) and water flow (m³/h) for a building at time t, interpolated between hours with a little jitter. */
export function liveOf(bd: CBldg, t: number) {
  const { h, m, s } = manilaClock(t);
  const f = m / 60;
  const shape = NORM[bd.type][h] * (1 - f) + NORM[bd.type][(h + 1) % 24] * f;
  const j = 1 + (noise(idSeed(bd.id) + Math.floor(t / 4000)) - 0.5) * 0.05;
  const kw = bd.online ? (bd.kwhDay / 24) * shape * j : 0;
  const m3h = bd.online ? (bd.m3Day / 24) * (0.35 + 0.65 * shape) * j : 0;
  return { kw, m3h, h, m, s };
}

/** A day's power curve for the whole city (or a district): actual vs the same day before the programme. */
export function cityDay(list: CBldg[]) {
  return Array.from({ length: 24 }, (_, h) => {
    let now = 0, base = 0;
    for (const bd of list) { const v = (bd.kwhDay / 24) * NORM[bd.type][h]; now += v; base += v / (1 + bd.vsBase / 100); }
    return { h, now, base };
  });
}

export function districtTotals(key?: DistrictKey) {
  const list = key ? BUILDINGS.filter((x) => x.district === key) : BUILDINGS;
  const kwh = list.reduce((s, x) => s + x.kwhDay, 0);
  const kwhBase = list.reduce((s, x) => s + x.kwhDay / (1 + x.vsBase / 100), 0);
  const m3 = list.reduce((s, x) => s + x.m3Day, 0);
  const m3Base = list.reduce((s, x) => s + x.m3Day / (1 + (x.vsBase * 0.8) / 100), 0);
  const people = list.reduce((s, x) => s + x.people, 0);
  const comfort = list.reduce((s, x) => s + x.comfort * x.people, 0) / Math.max(1, people);
  return { kwh, kwhBase, m3, m3Base, people, comfort, count: list.length, online: list.filter((x) => x.online).length };
}

export const ALERTS: Alert[] = [
  { id: "a1", bldg: "ind-food", sev: "Critical", kind: "Leak", title: "Water flowing all night at the food plant", detail: "Night flow 6.8 m³/h from 1–4 AM while the plant was shut. Normal is 0.9 m³/h.", since: "Today 1:12 AM", costDay: 8800, action: "Check the CIP tank make-up valve and wash-down hoses", owner: "Plant engineer", status: "Crew on site" },
  { id: "a2", bldg: "com-bpo2", sev: "High", kind: "After-hours load", title: "Aircon left on all weekend in BPO tower 2", detail: "Floors 9–14 drew 310 kW on Saturday and Sunday with badge-ins under 20 people.", since: "Sat 8:00 AM", costDay: 39000, action: "Push the weekend schedule to the BMS and lock the override", owner: "Facilities manager", status: "Assigned" },
  { id: "a3", bldg: "ind-tire", sev: "High", kind: "Compressed air", title: "Compressors running hard on the Sunday shutdown", detail: "Compressed air demand at 61% of weekday on a non-production day: classic leak signature.", since: "Sun 6:00 AM", costDay: 27000, action: "Ultrasonic leak walk, tag and fix the top 20 leaks", owner: "Utilities lead", status: "New" },
  { id: "a4", bldg: "com-mall1", sev: "High", kind: "Demand spike", title: "Mall A heading for a new monthly peak", detail: "15-minute demand at 4,950 kW and rising, 4% above this month's billed peak. Every new kW adds to the whole month's demand charge.", since: "Today 2:30 PM", costDay: 14500, action: "Pre-approved: raise chilled water 1°C for 40 minutes, pause the fountain pumps", owner: "AI (auto)", status: "Assigned" },
  { id: "a5", bldg: "ind-elec", sev: "Medium", kind: "Power factor", title: "Power factor down to 0.82 at the electronics plant", detail: "Below the 0.85 penalty line for 3 days. One capacitor step looks failed.", since: "Thu", costDay: 6200, action: "Replace the failed capacitor step, check the controller", owner: "Electrical contractor", status: "New" },
  { id: "a6", bldg: "hot-res", sev: "Medium", kind: "Chiller", title: "Chiller plant drifting at the resort", detail: "Plant efficiency 0.92 kW/ton vs 0.71 last month. Condenser approach is high: tubes may need cleaning.", since: "5 days", costDay: 11800, action: "Schedule a tube brush, check cooling tower fill", owner: "Chiller service contractor", status: "New" },
  { id: "a7", bldg: "crs-vill", sev: "Medium", kind: "Pressure", title: "High night pressure on the village main", detail: "5.6 bar at 2 AM. Pipes burst and fixtures leak more above 4 bar.", since: "This week", costDay: 2400, action: "Set the pressure reducing valve to 3.5 bar at night", owner: "Village maintenance", status: "New" },
  { id: "a8", bldg: "crs-sch", sev: "Medium", kind: "Meter offline", title: "School water reader offline 26 hours", detail: "No pulses since yesterday 10 AM. Battery shows 2.9 V.", since: "Yesterday", costDay: 0, action: "Swap the reader battery; AI estimates the gap meanwhile", owner: "Field tech", status: "Assigned" },
];

export const MEASURES: Measure[] = [
  { id: "setpoint", title: "Aircon set to 24–25°C and schedules that match real hours", what: "Push setpoints and on/off times to every BMS and smart thermostat; lock overrides after hours.", area: "Power", sites: 22, capex: 900_000, kwhYr: 8_500_000, m3Yr: 0, stage: "Verified", funding: "No capex", weeks: 2, owner: "Facilities teams", resident: "Same comfort; offices stop over-cooling to 20°C" },
  { id: "leaks", title: "Fix leaks found by night-flow alerts", what: "AI flags any meter that never drops to zero at night. Crews fix toilets, valves and pipes within 48 hours.", area: "Water", sites: 33, capex: 1_200_000, kwhYr: 0, m3Yr: 260_000, stage: "Verified", funding: "No capex", weeks: 3, owner: "Plumbing crews", resident: "Fewer leaks, no surprise water bills" },
  { id: "air", title: "Compressed air leak hunt in factories", what: "Ultrasonic survey, tag and fix leaks, lower header pressure by 0.5 bar, switch compressors off on idle days.", area: "Power", sites: 6, capex: 3_500_000, kwhYr: 5_800_000, m3Yr: 0, stage: "Live", funding: "Own capex", weeks: 4, owner: "Plant utilities", resident: "Quieter plant floors" },
  { id: "plugs", title: "After-hours lights and plug loads off", what: "Timers and smart plugs on lighting circuits, water dispensers, printers and signage.", area: "Power", sites: 18, capex: 900_000, kwhYr: 2_400_000, m3Yr: 0, stage: "Live", funding: "No capex", weeks: 2, owner: "Facilities teams", resident: "No change during working hours" },
  { id: "solar", title: "Rooftop solar on factory and mall roofs (15 MWp)", what: "Solar developer builds, owns and maintains; buildings buy the power at a fixed discount for 15–20 years.", area: "Power", sites: 9, capex: 0, kwhYr: 0, m3Yr: 0, extraYr: 52_000_000, stage: "Approved", funding: "Solar PPA", weeks: 20, owner: "Solar developer", resident: "Shadier roofs, cooler top floors" },
  { id: "supply", title: "Switch big users to a cheaper power supplier", what: "Sites drawing 100 kW+ shop for a retail supplier under open access and the green energy option.", area: "Tariff", sites: 11, capex: 0, kwhYr: 0, m3Yr: 0, extraYr: 180_000_000, stage: "Found", funding: "No capex", weeks: 16, owner: "Energy buyer", resident: "Lower cost passed through to dues and rents" },
  { id: "flow", title: "Low-flow aerators and showerheads", what: "₱150–400 aerators and 6 L/min showerheads in hotels, homes and offices. Less hot water too.", area: "Both", sites: 14, capex: 2_600_000, kwhYr: 400_000, m3Yr: 110_000, stage: "Installing", funding: "Own capex", weeks: 6, owner: "Plumbing crews", resident: "Same feel, lower water bills" },
  { id: "chiller", title: "AI chiller plant optimisation", what: "Sequencing, chilled water reset and condenser control every 5 minutes. ESCO funds it and shares the savings.", area: "Power", sites: 7, capex: 32_000_000, kwhYr: 9_000_000, m3Yr: 0, stage: "Approved", funding: "ESCO shared savings", weeks: 12, owner: "ESCO partner", resident: "Steadier temperatures, fewer hot complaints" },
  { id: "pf", title: "Power factor correction", what: "Repair or add capacitor banks so no site pays a low power factor penalty.", area: "Power", sites: 5, capex: 6_000_000, kwhYr: 300_000, m3Yr: 0, extraYr: 12_000_000, stage: "Approved", funding: "Own capex", weeks: 8, owner: "Electrical contractor", resident: "Fewer trips and voltage dips" },
  { id: "prv", title: "Pressure management on water mains", what: "Pressure reducing valves that drop to 3–3.5 bar at night, cutting leaks and burst pipes.", area: "Water", sites: 8, capex: 4_500_000, kwhYr: 0, m3Yr: 140_000, stage: "Approved", funding: "Own capex", weeks: 8, owner: "Water contractor", resident: "Fewer burst pipes and water outages" },
  { id: "tower", title: "Cooling tower cycles and aircon condensate reuse", what: "Run towers at more cycles of concentration and pipe clean condensate into make-up water.", area: "Water", sites: 7, capex: 3_200_000, kwhYr: 0, m3Yr: 120_000, stage: "Found", funding: "Own capex", weeks: 10, owner: "Water treatment vendor", resident: "No change" },
  { id: "irrig", title: "Rain-aware smart irrigation", what: "Controllers skip watering when rain is forecast and water at dawn.", area: "Water", sites: 10, capex: 1_800_000, kwhYr: 0, m3Yr: 60_000, stage: "Found", funding: "Own capex", weeks: 4, owner: "Landscaping", resident: "Parks stay green" },
  { id: "led", title: "LED retrofit: parking, corridors, high-bay", what: "Swap fluorescent and metal-halide fittings for LED with occupancy sensors.", area: "Power", sites: 20, capex: 55_000_000, kwhYr: 6_500_000, m3Yr: 0, stage: "Installing", funding: "ESCO shared savings", weeks: 14, owner: "ESCO partner", resident: "Brighter, safer parking and stairs" },
  { id: "vfd", title: "Variable speed drives on pumps and air handlers", what: "Drives that slow pumps and fans to match the load, instead of throttling valves.", area: "Power", sites: 12, capex: 48_000_000, kwhYr: 5_200_000, m3Yr: 0, stage: "Found", funding: "ESCO shared savings", weeks: 16, owner: "ESCO partner", resident: "Quieter plant rooms" },
  { id: "roof", title: "Cool roof coating on warehouses and plants", what: "Reflective coating on metal roofs: 3–6°C cooler inside.", area: "Power", sites: 6, capex: 22_000_000, kwhYr: 2_600_000, m3Yr: 0, stage: "Found", funding: "Own capex", weeks: 10, owner: "Roofing contractor", resident: "Cooler work floors for staff" },
  { id: "battery", title: "Batteries to shave the evening peak", what: "Charge from solar at noon, discharge 6–10 PM to cut demand charges and back up critical loads.", area: "Power", sites: 3, capex: 120_000_000, kwhYr: 0, m3Yr: 0, extraYr: 22_000_000, stage: "Found", funding: "Own capex", weeks: 30, owner: "Solar developer", resident: "Backup power for lifts and pumps" },
];

export const pesoYr = (x: Measure) => x.kwhYr * ASSUMPTIONS.tariff + x.m3Yr * ASSUMPTIONS.water + (x.extraYr ?? 0);
/** Simple payback in months; 0 for measures with no upfront cost to the building. */
export const paybackMonths = (x: Measure) => (x.capex === 0 || x.funding === "Solar PPA" ? 0 : (x.capex / Math.max(1, pesoYr(x))) * 12);
/** Fastest and cheapest first: payback, then the bigger saving. */
export const ranked = (list: Measure[]) => [...list].sort((a, c) => paybackMonths(a) - paybackMonths(c) || pesoYr(c) - pesoYr(a));

// Verified savings by month since the programme started (sample). ₱ and units saved that month.
export const MONTHS = [
  { m: "Jun", peso: 2_500_000, kwh: 215_000, m3: 3_500 },
  { m: "Jul", peso: 6_800_000, kwh: 590_000, m3: 9_000 },
  { m: "Aug", peso: 11_200_000, kwh: 975_000, m3: 14_000 },
  { m: "Sep", peso: 13_900_000, kwh: 1_210_000, m3: 17_500 },
  { m: "Oct", peso: 15_400_000, kwh: 1_340_000, m3: 19_500 },
  { m: "Nov", peso: 16_600_000, kwh: 1_450_000, m3: 21_000 },
];
export const MONTHLY_TARGET = 17_500_000;

// The rollout playbook (summary of docs/clark-command-center/plan.md).
export const PHASES = [
  { when: "Week 0–2", title: "See it with what's already there", cost: "₱0–₱5k per building", body: "Upload 24 months of bills. Guards photograph every meter daily and AI reads the numbers. Ask the utility for interval data on big accounts. Walk-through finds the first quick wins.", done: true },
  { when: "Week 2–6", title: "Clip-on meters on the big 20%", cost: "₱25k–₱250k per building", body: "Clamp-on CT meters on main incomers, pulse or camera readers on existing water meters, Modbus gateways where digital meters exist. LoRaWAN gateways cover the zone; NB-IoT SIMs where there's no gateway. No shutdowns, no pipe cutting.", done: true },
  { when: "Week 2–8", title: "No- and low-cost fixes first", cost: "About ₱6.5M across 33 buildings", body: "Setpoints and schedules, leak repairs from night-flow alerts, after-hours shutdowns, compressed air leak walk. These pay back in weeks and fund the next phase.", done: true },
  { when: "Month 2–6", title: "Fast-payback retrofits", cost: "₱1–15M, much of it ESCO-funded", body: "Low-flow fixtures, pressure reducing valves, power factor correction, LED, chiller optimisation, VFDs. Ranked by payback; ESCO shared savings means no upfront cost where capex is large.", done: false },
  { when: "Month 4–12", title: "Cleaner, cheaper supply", cost: "Zero capex", body: "Rooftop solar on PPAs, retail supply switching for big users, then batteries where peaks are expensive. Every peso checked against the metered baseline (IPMVP), month by month.", done: false },
];

/** Facts for the AI's spoken morning briefing, plus a no-key fallback. */
export function commandFacts() {
  const t = districtTotals();
  const top = [...ALERTS].sort((a, c) => c.costDay - a.costDay)[0];
  const topB = BUILDINGS.find((x) => x.id === top.bldg)!;
  const live = MEASURES.filter((x) => x.stage === "Live" || x.stage === "Verified");
  const pipe = MEASURES.filter((x) => x.stage !== "Live" && x.stage !== "Verified");
  const toDate = MONTHS.reduce((s, x) => s + x.peso, 0);
  const pct = Math.round((1 - t.kwh / t.kwhBase) * 100);
  const facts = [
    `Scope: ${t.count} buildings across New Clark City and Clark Freeport, ${t.online} sending live readings. Sample data.`,
    `Power use is ${pct}% below the pre-programme baseline; water is ${Math.round((1 - t.m3 / t.m3Base) * 100)}% below.`,
    `Verified savings since ${ASSUMPTIONS.start}: ₱${(toDate / 1e6).toFixed(1)} million.`,
    `Costliest open alert: ${top.title} (${topB.name}), about ₱${Math.round(top.costDay).toLocaleString("en-PH")} a day. Action: ${top.action}.`,
    `${ALERTS.length} open alerts. ${live.length} saving measures live, ${pipe.length} in the pipeline worth ₱${(pipe.reduce((s, x) => s + pesoYr(x), 0) / 1e6).toFixed(0)} million a year.`,
    `Occupant comfort score ${t.comfort.toFixed(1)} out of 5.`,
  ].join("\n");
  const fallback = `Hi po. The one to act on first: ${top.title}, costing about ₱${Math.round(top.costDay / 1000)}k a day. The fix: ${top.action}. Across Clark, power use is ${pct}% below baseline and we've verified ₱${(toDate / 1e6).toFixed(1)} million in savings since ${ASSUMPTIONS.start}. Comfort is holding at ${t.comfort.toFixed(1)} out of 5, so people feel no worse while bills go down.`;
  return { facts, fallback };
}

// BCDA-style city scorecard beyond water and power. Public facts carry a source; everything else is sample data.
export type CityKpi = { group: string; icon: string; k: string; v: string; target: string; pct: number; trend: string; why: string; src?: { label: string; url: string } };
export const CITY_KPIS: CityKpi[] = [
  { group: "People", icon: "😊", k: "Resident & worker happiness", v: "4.2 / 5", target: "4.5 / 5", pct: 84, trend: "+0.3 since Jun", why: "The north star. Weekly one-tap pulse across homes, offices, plants and hotels." },
  { group: "Water", icon: "🚰", k: "Non-revenue water", v: "19%", target: "under 12%", pct: 58, trend: "−4 pts since Jun", why: "Water lost to leaks and bad meters before it reaches anyone. District meters plus night-flow AI find it." },
  { group: "Power", icon: "⚡", k: "Outage minutes per customer (SAIDI)", v: "142 min/yr", target: "under 90", pct: 63, trend: "−18% vs last year", why: "Brownouts hurt residents and factories most. Batteries and early warnings on feeders cut them." },
  { group: "Climate", icon: "🌍", k: "Clean energy share", v: "24%", target: "50% by 2030", pct: 48, trend: "+9 pts with solar PPAs", why: "Rooftop solar, the 37 ha solar farm allocation and green supply contracts.", src: { label: "Wikipedia: New Clark City (solar farm allocation)", url: "https://en.wikipedia.org/wiki/New_Clark_City" } },
  { group: "Climate", icon: "🌳", k: "Green and open space kept", v: "60%", target: "60% of 9,450 ha", pct: 100, trend: "on plan", why: "BCDA keeps 60% of New Clark City green, with a no-cut policy for threatened trees.", src: { label: "BCDA: UK-backed sustainability plan for New Clark City", url: "https://www.bcda.gov.ph/news/bcda-implement-uk-sustainability-plan-new-clark-city" } },
  { group: "Resilience", icon: "🌊", k: "Flood readiness", v: "92%", target: "100% before typhoon season", pct: 92, trend: "3 drains to clear", why: "Retention lake level, drain checks and pump tests, so heavy rain never floods homes or plants." },
  { group: "Waste", icon: "♻️", k: "Waste diverted from landfill", v: "38%", target: "70%", pct: 54, trend: "+6 pts", why: "Segregation at source, recycling and the planned 600 t/day waste-to-energy plant.", src: { label: "Wikipedia: waste-to-energy plant, 600 t/day, 12 MW", url: "https://en.wikipedia.org/wiki/New_Clark_City" } },
  { group: "Mobility", icon: "🚌", k: "Trips by transit, walking or bike", v: "27%", target: "50%", pct: 54, trend: "+5 pts since BRT", why: "Clark Loop BRT, the driverless bus and the coming commuter rail cut traffic and heat." },
  { group: "Growth", icon: "🏗️", k: "Investment pledges built", v: "₱15.9B of ₱143.2B", target: "pipeline delivered", pct: 11, trend: "₱127.3B in the pipeline", why: "Pledges only become jobs once they are built. Track built vs pledged.", src: { label: "Philstar: New Clark City attracts ₱143B pledges (Jul 2024)", url: "https://philstar.com/business/2024/07/15/2370174/new-clark-city-attracts-p143-billion-investment-pledges" } },
  { group: "Growth", icon: "👷", k: "Jobs in Clark Freeport", v: "146,000+", target: "+103,000 more from NCC pledges", pct: 59, trend: "1,213 locators", why: "Cheaper, reliable utilities help win and keep locators.", src: { label: "SunStar: Clark records ₱77B investment in 2024", url: "https://www.sunstar.com.ph/pampanga/clark-records-77b-investment-in-2024" } },
  { group: "Buildings", icon: "🏅", k: "Green-rated floor area (BERDE / EDGE / LEED)", v: "31%", target: "60%", pct: 52, trend: "+4 buildings this year", why: "Ratings need 12 months of metered data, which the command center already collects." },
  { group: "Climate", icon: "🌡️", k: "CO₂ per resident and worker", v: "2.1 t/yr", target: "1.5 t by 2030", pct: 71, trend: "−7% since Jun", why: "One number for the whole city that rolls up power, fuel and waste." },
];
