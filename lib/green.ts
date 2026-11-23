// Sustainability demos for prospective clients: New Clark City and the Pax Silica hub.
// Pure data and maths (no database), so the dashboard can re-run the simulation in the browser
// when someone toggles an AI action or moves a planner slider.
//
// All site numbers are SAMPLE data made for the demo. Public facts we lean on are listed in `sources`.
// Rates and factors are assumptions, labelled as such on screen.

export type SiteKey = "ncc" | "pax";
export type Kind = "home" | "office" | "sports" | "retail" | "datahall" | "plant" | "lab";
export type Bldg = { name: string; kind: Kind; icon: string; detail: string; kwhDay: number; m3Day: number; occupants: number; comfort: number; vsLastMonth: number };
export type Area = "Cooling" | "Lighting" | "Solar & battery" | "Water" | "Computing" | "Residents";
export type AiAction = {
  id: string; area: Area; title: string; detail: string; on: boolean; approval: "Auto" | "Manager" | "Board";
  kwhDay?: number; hours?: [number, number]; // energy saved per day, spread over these hours (end exclusive)
  shift?: { kwh: number; from: [number, number]; to: [number, number] }; // flexible load moved into solar hours
  m3Day?: number; comfort: string; battery?: boolean;
};
export type Leak = { where: string; zone: string; night: number; normal: number; since: string; m3Day: number; cause: string; status: "New" | "Crew on the way" | "Fixed" };
export type Flow = { label: string; m3Day: number; color: string };
export type Cert = { name: string; body: string; target: string; items: [string, boolean][] };
export type Team = { name: string; pct: number; points: number };
export type Special = { k: string; v: string; d: string; pct?: number };
export type Site = {
  key: SiteKey; name: string; short: string; place: string; kind: string; tagline: string; disclaimer: string;
  login: string; sources: { label: string; url: string }[];
  tariff: number; waterRate: number; ef: number; solarKwp: number; batteryKwh: number; batteryKw: number; rainTankM3: number; rainFill: number;
  netZeroYear: number; aiLive: string;
  buildings: Bldg[]; actions: AiAction[]; leaks: Leak[]; sourcesWater: Flow[]; usesWater: Flow[];
  certs: Cert[]; teams: Team[]; nudges: { title: string; body: string }[]; specials: Special[];
  residentWord: string; comfortNote: string;
};

// Assumptions shared by both demos (shown on screen).
export const SOLAR_YIELD = 3.8; // kWh per kWp per day, Central Luzon average (assumed)
export const CAPEX = { solarPerKwp: 42000, batteryPerKwh: 28000, retrofitPerPct: 0 }; // ₱, indicative installed costs (assumed)
export const TREE_KG_YEAR = 22; // kg CO2 one mature tree absorbs per year (common rule of thumb)

const NCC: Site = {
  key: "ncc", name: "New Clark City", short: "NCC", place: "Capas, Tarlac", kind: "Green smart city · sample district",
  tagline: "Cooler homes, lower bills, a greener city. AI runs the buildings so residents and workers simply feel the difference.",
  disclaimer: "Demo with sample data for a district of five buildings in New Clark City. Not live BCDA data.",
  login: "ncc@greendemo.test",
  sources: [
    { label: "BCDA: USD 200M ACWA Power clean energy deal for New Clark City (Jan 2026)", url: "https://bcda.gov.ph/news/bcda-seals-usd-200m-deal-acwa-power-boost-clean-energy-new-clark-city" },
    { label: "PNA: district cooling could cut power use up to 50%; 60% of land kept green (2023)", url: "https://alpha.pna.gov.ph/articles/1211403" },
  ],
  tariff: 11.0, waterRate: 55, ef: 0.71, solarKwp: 1800, batteryKwh: 2000, batteryKw: 800, rainTankM3: 1200, rainFill: 64,
  netZeroYear: 2035, aiLive: "Jun 2026",
  buildings: [
    { name: "Residences Block A", kind: "home", icon: "🏘️", detail: "240 homes · 7 floors", kwhDay: 4800, m3Day: 150, occupants: 720, comfort: 4.6, vsLastMonth: -14 },
    { name: "Residences Block B", kind: "home", icon: "🏘️", detail: "240 homes · 7 floors", kwhDay: 4600, m3Day: 145, occupants: 700, comfort: 4.5, vsLastMonth: -11 },
    { name: "Civic office building", kind: "office", icon: "🏛️", detail: "2,000 staff · 6 floors", kwhDay: 14000, m3Day: 90, occupants: 2000, comfort: 4.4, vsLastMonth: -19 },
    { name: "Sports & aquatics centre", kind: "sports", icon: "🏊", detail: "Pool, gym, courts", kwhDay: 9500, m3Day: 260, occupants: 900, comfort: 4.5, vsLastMonth: -9 },
    { name: "Town centre retail", kind: "retail", icon: "🛍️", detail: "38 shops · food hall", kwhDay: 6800, m3Day: 70, occupants: 1400, comfort: 4.3, vsLastMonth: -12 },
  ],
  actions: [
    { id: "chiller", area: "Cooling", title: "AI chiller sequencing at the district cooling plant", detail: "Runs the fewest chillers at their sweet spot and resets chilled-water temperature every 5 minutes from weather and occupancy.", on: true, approval: "Auto", kwhDay: 2600, hours: [7, 22], comfort: "No change residents can feel" },
    { id: "precool", area: "Cooling", title: "Pre-cool offices at solar peak, then coast", detail: "Cools the civic building harder from 11 AM to 2 PM on solar power, then lets it drift 1°C in the evening.", on: true, approval: "Manager", shift: { kwh: 1500, from: [16, 20], to: [11, 15] }, kwhDay: 600, hours: [9, 18], comfort: "Offices stay at 24–25°C" },
    { id: "lights", area: "Lighting", title: "Occupancy-based corridor and parking lights", detail: "Sensors dim empty corridors, stairs and parking to 20% and brighten in under a second when someone walks in.", on: true, approval: "Auto", kwhDay: 900, hours: [18, 24], comfort: "Always bright where people are" },
    { id: "pumps", area: "Water", title: "Shift pool filtration and water pumping to solar hours", detail: "Fills roof tanks and runs pool pumps when the panels are producing, instead of at night.", on: true, approval: "Auto", shift: { kwh: 1200, from: [19, 24], to: [10, 15] }, comfort: "No change" },
    { id: "battery", area: "Solar & battery", title: "Battery peak shaving, 6–10 PM", detail: "Stores midday solar and releases it during the evening peak, when grid power is dirtiest and dearest.", on: true, approval: "Auto", battery: true, comfort: "Backup power for lifts and pumps during brownouts" },
    { id: "irrigation", area: "Water", title: "Rain-aware irrigation", detail: "Skips watering when PAGASA-style forecasts show rain and waters at dawn using harvested rainwater first.", on: false, approval: "Manager", m3Day: 45, comfort: "Parks stay green" },
    { id: "condensate", area: "Water", title: "Recover aircon condensate for cooling-tower make-up", detail: "Clean water dripping from air handlers is piped to the cooling towers instead of the drain.", on: false, approval: "Board", m3Day: 18, comfort: "No change" },
    { id: "nudges", area: "Residents", title: "Green Points challenge for residents", detail: "Weekly Taglish tips, unit-vs-similar-unit comparisons and points residents redeem at town-centre shops.", on: true, approval: "Manager", kwhDay: 520, hours: [18, 23], m3Day: 12, comfort: "Opt-in, friendly, never shaming" },
    { id: "plugs", area: "Lighting", title: "After-hours plug-load schedule in offices", detail: "Switches off printers, water dispensers and idle monitors from 8 PM to 6 AM and on weekends.", on: false, approval: "Manager", kwhDay: 700, hours: [0, 6], comfort: "No change during work hours" },
  ],
  leaks: [
    { where: "Sports centre, pool balance tank", zone: "Zone S", night: 2.1, normal: 0.3, since: "Tue 2:10 AM", m3Day: 43, cause: "Make-up valve likely stuck open", status: "New" },
    { where: "Residences Block B, riser 3 (floors 7–9)", zone: "Zone B", night: 0.9, normal: 0.2, since: "Sun 11:40 PM", m3Day: 17, cause: "Running toilets in 3 homes", status: "Crew on the way" },
    { where: "Town centre irrigation line", zone: "Zone T", night: 0.2, normal: 0.2, since: "Last week", m3Day: 0, cause: "Cracked lateral, repaired Friday", status: "Fixed" },
  ],
  sourcesWater: [
    { label: "Utility water", m3Day: 620, color: "#3f7fd1" }, { label: "Harvested rainwater", m3Day: 70, color: "#36a3c9" },
    { label: "Recycled greywater", m3Day: 55, color: "#2f8a4e" }, { label: "Aircon condensate", m3Day: 28, color: "#7fbf5a" },
  ],
  usesWater: [
    { label: "Homes", m3Day: 290, color: "#0d8a84" }, { label: "Pool & sports", m3Day: 180, color: "#36a3c9" }, { label: "Offices & retail", m3Day: 140, color: "#5b6b67" },
    { label: "Parks irrigation", m3Day: 95, color: "#2f8a4e" }, { label: "Cooling towers", m3Day: 68, color: "#c07a12" },
  ],
  certs: [
    { name: "BERDE for Operations", body: "Philippine Green Building Council", target: "4 stars", items: [["12 months of metered energy and water", true], ["Energy below the local benchmark", true], ["Water-efficient fixtures in 80%+ of homes", true], ["Waste segregation and diversion report", false], ["Indoor air quality survey", false]] },
    { name: "EDGE Advanced", body: "IFC (World Bank Group)", target: "40%+ energy savings", items: [["Energy savings vs base case ≥ 20%", true], ["Water savings vs base case ≥ 20%", true], ["Energy savings ≥ 40% (Advanced)", false], ["Embodied energy savings ≥ 20%", true]] },
    { name: "RA 11285 Energy Efficiency Act", body: "Department of Energy", target: "Compliant", items: [["Certified energy manager named", true], ["Annual energy report drafted by AI", true], ["Energy audit within 3 years", false], ["Energy-saving plan filed", true]] },
  ],
  teams: [
    { name: "Block A · 6th floor", pct: -23, points: 1480 }, { name: "Block B · 3rd floor", pct: -19, points: 1310 }, { name: "Civic building · Finance", pct: -17, points: 1205 },
    { name: "Block A · 2nd floor", pct: -15, points: 1090 }, { name: "Town centre food hall", pct: -12, points: 870 },
  ],
  nudges: [
    { title: "Great week po, Ana! 🌿", body: "Your home used 18% less power than similar 2-bedroom homes. +40 Green Points. Redeem them for coffee at the town centre." },
    { title: "Tip: laundry at 1 PM ☀️", body: "Tomorrow 11 AM to 3 PM is solar peak. Washing then is cleaner and helps keep the building's bill (and dues) down." },
    { title: "Water running at 3 AM? 💧", body: "Your water meter didn't stop overnight. It may be a running toilet. Want a free check po? Tap to book." },
  ],
  specials: [
    { k: "District cooling efficiency", v: "0.64 kW/TR", d: "was 0.81 before AI tuning", pct: 79 },
    { k: "Clean energy share", v: "31%", d: "rooftop solar + clean energy supply", pct: 31 },
    { k: "Land kept green", v: "60%", d: "parks, green space and water (BCDA plan)", pct: 60 },
    { k: "EV shuttle charging today", v: "1,240 kWh", d: "≈ 1.1 t CO₂ avoided vs diesel", pct: 55 },
  ],
  residentWord: "residents", comfortNote: "Heat complaints down 38% since AI cooling went live, and homes stay at 25–26°C.",
};

const PAX: Site = {
  key: "pax", name: "Pax Silica Hub", short: "Pax", place: "New Clark City, Tarlac", kind: "AI-native industrial hub · concept campus",
  tagline: "An AI hub that runs on sunshine and saves every drop. Lower power and water per chip and per AI job, and a campus people love to live and work in.",
  disclaimer: "Concept demo with sample data. The Pax Silica economic security zone was announced in April 2026; tenants and buildings are not yet set, so this campus is illustrative.",
  login: "pax@greendemo.test",
  sources: [
    { label: "Avasant: Pax Silica and the Philippines, 4,000-acre economic security zone (May 2026)", url: "https://avasant.com/report/pax-silica-and-the-philippines-what-the-new-economic-security-zone-means-for-global-supply-chains/" },
    { label: "SunStar: an AI-native industrial hub in New Clark City (May 2026)", url: "https://www.sunstar.com.ph/cebu/tell-it-to-sunstar-pax-silica-an-ai-native-industrial-hub-in-new-clark-city" },
  ],
  tariff: 9.5, waterRate: 60, ef: 0.71, solarKwp: 12000, batteryKwh: 20000, batteryKw: 5000, rainTankM3: 5000, rainFill: 48,
  netZeroYear: 2032, aiLive: "Jun 2026",
  buildings: [
    { name: "AI data hall 1", kind: "datahall", icon: "🖥️", detail: "4 MW IT · liquid-cooled racks", kwhDay: 134400, m3Day: 230, occupants: 60, comfort: 4.4, vsLastMonth: -8 },
    { name: "Advanced packaging & test plant", kind: "plant", icon: "🔬", detail: "Cleanrooms · 24/7 shifts", kwhDay: 60000, m3Day: 900, occupants: 1100, comfort: 4.3, vsLastMonth: -11 },
    { name: "Critical minerals pilot lab", kind: "lab", icon: "⚗️", detail: "Processing R&D", kwhDay: 12000, m3Day: 280, occupants: 140, comfort: 4.4, vsLastMonth: -6 },
    { name: "R&D and offices", kind: "office", icon: "🏢", detail: "900 staff", kwhDay: 9000, m3Day: 80, occupants: 900, comfort: 4.6, vsLastMonth: -16 },
    { name: "Worker housing", kind: "home", icon: "🏘️", detail: "1,200 beds · 4 blocks", kwhDay: 7500, m3Day: 220, occupants: 1200, comfort: 4.5, vsLastMonth: -13 },
  ],
  actions: [
    { id: "dccool", area: "Computing", title: "AI cooling setpoints for the data hall", detail: "Raises supply air within ASHRAE's recommended 18–27°C band and tunes pumps and dry coolers rack by rack. PUE 1.40 → 1.31.", on: true, approval: "Auto", kwhDay: 8600, hours: [0, 24], comfort: "Chips stay inside safe temperature limits" },
    { id: "carbonaware", area: "Computing", title: "Carbon-aware scheduling of AI training jobs", detail: "Moves flexible training and batch jobs out of the 5–10 PM peak into solar hours. Inference and customer jobs are never delayed.", on: true, approval: "Manager", shift: { kwh: 15000, from: [17, 22], to: [9, 15] }, comfort: "No change to customer latency" },
    { id: "heat", area: "Cooling", title: "Reuse data-hall waste heat", detail: "Warm water from the racks drives an absorption chiller and hot water for worker housing.", on: true, approval: "Board", kwhDay: 2400, hours: [0, 24], comfort: "Free hot showers in worker housing" },
    { id: "air", area: "Computing", title: "Find compressed-air leaks in the plant", detail: "Ultrasonic sensors and AI pinpoint leaking fittings; a ticket goes to the maintenance crew with the exact location.", on: true, approval: "Auto", kwhDay: 1800, hours: [0, 24], comfort: "No change" },
    { id: "upw", area: "Water", title: "Recycle ultrapure-water reject to cooling towers", detail: "Reject water from the plant's RO system is reused for cooling-tower make-up and toilet flushing.", on: true, approval: "Manager", m3Day: 260, comfort: "No change" },
    { id: "setback", area: "Cooling", title: "Night setback in non-cleanroom areas", detail: "Warehouses, corridors and offices drift to 27°C overnight. Cleanrooms are never touched.", on: false, approval: "Manager", kwhDay: 1500, hours: [20, 24], comfort: "Cleanrooms untouched" },
    { id: "battery", area: "Solar & battery", title: "Battery peak shaving and grid demand response", detail: "20 MWh battery stores solar and covers the evening peak; it also answers grid calls to cut load when Luzon's reserves are thin.", on: true, approval: "Auto", battery: true, comfort: "Ride-through for brownouts" },
    { id: "irrigation", area: "Water", title: "Rain-aware landscape irrigation", detail: "Uses harvested rainwater first and skips watering before forecast rain.", on: false, approval: "Manager", m3Day: 60, comfort: "Campus stays green" },
    { id: "nudges", area: "Residents", title: "Green Points for worker housing", detail: "Friendly tips and dorm-vs-dorm challenges; points go to canteen meals and transport.", on: true, approval: "Manager", kwhDay: 400, hours: [18, 23], m3Day: 15, comfort: "Opt-in and fun" },
  ],
  leaks: [
    { where: "Cooling tower 2, make-up line", zone: "Utility yard", night: 3.4, normal: 1.2, since: "Mon 1:30 AM", m3Day: 52, cause: "Float valve not closing", status: "New" },
    { where: "Plant RO system", zone: "Packaging plant", night: 6.8, normal: 5.1, since: "Sat", m3Day: 38, cause: "Membrane fouling: reject rising. Clean-in-place booked", status: "Crew on the way" },
    { where: "Worker housing Block C, 2nd floor", zone: "Housing", night: 0.3, normal: 0.3, since: "Last week", m3Day: 0, cause: "Leaking shower valve, repaired", status: "Fixed" },
  ],
  sourcesWater: [
    { label: "Utility water", m3Day: 1250, color: "#3f7fd1" }, { label: "Harvested rainwater", m3Day: 140, color: "#36a3c9" },
    { label: "Recycled process water", m3Day: 420, color: "#2f8a4e" }, { label: "Aircon condensate", m3Day: 60, color: "#7fbf5a" },
  ],
  usesWater: [
    { label: "Ultrapure water (plant)", m3Day: 900, color: "#7a5cc2" }, { label: "Minerals lab", m3Day: 280, color: "#c07a12" }, { label: "Data hall cooling", m3Day: 230, color: "#36a3c9" },
    { label: "Worker housing", m3Day: 220, color: "#0d8a84" }, { label: "Landscape", m3Day: 160, color: "#2f8a4e" }, { label: "Offices", m3Day: 80, color: "#5b6b67" },
  ],
  certs: [
    { name: "LEED v4.1 O+M", body: "US Green Building Council", target: "Gold", items: [["Energy Star-style benchmark from metered data", true], ["Water metering by end use", true], ["Refrigerant management plan", true], ["Occupant comfort survey", false], ["Waste diversion ≥ 50%", false]] },
    { name: "ISO 50001 Energy Management", body: "ISO", target: "Certified", items: [["Energy baseline and indicators", true], ["Significant energy uses ranked by AI", true], ["Action plans with owners", true], ["Internal audit", false]] },
    { name: "24/7 clean energy (hourly matching)", body: "Customer pledge", target: "80% by 2030", items: [["Hourly meter data for every building", true], ["Solar + battery dispatch optimised", true], ["Clean energy supply contract", false], ["Public hourly report", true]] },
    { name: "RA 11285 Energy Efficiency Act", body: "Department of Energy", target: "Compliant", items: [["Certified energy manager named", true], ["Annual energy report drafted by AI", true], ["Energy audit", false]] },
  ],
  teams: [
    { name: "Housing Block A", pct: -21, points: 1620 }, { name: "Packaging line 2", pct: -17, points: 1380 }, { name: "Housing Block C", pct: -16, points: 1240 },
    { name: "R&D floor 3", pct: -14, points: 1100 }, { name: "Housing Block B", pct: -10, points: 860 },
  ],
  nudges: [
    { title: "Block A is #1 this week! 🏆", body: "Your dorm used 21% less power than last month. Everyone in Block A gets a free merienda Friday po." },
    { title: "Free hot water, thanks to AI ♨️", body: "Showers in worker housing now use heat recovered from the data hall. That's 2,400 kWh saved every day." },
    { title: "Shower running for 40 min? 💧", body: "Room C-214's water hasn't stopped since 6:10 AM. Is a tap open? Tap here and maintenance will check." },
  ],
  specials: [
    { k: "Data hall PUE (live)", v: "1.31", d: "design target 1.25 · was 1.40", pct: 76 },
    { k: "Water per AI kWh (WUE)", v: "0.42 L/kWh", d: "closed-loop liquid cooling", pct: 58 },
    { k: "Hourly clean energy match", v: "61%", d: "solar + battery + clean supply", pct: 61 },
    { k: "Process water recycled", v: "72%", d: "ultrapure water reject reused", pct: 72 },
  ],
  residentWord: "workers and residents", comfortNote: "Worker housing comfort score 4.5/5, and canteen and dorm complaints are down 29% since the AI went live.",
};

export const SITES: Record<SiteKey, Site> = { ncc: NCC, pax: PAX };
export const siteForEmail = (email: string): SiteKey | null => (Object.values(SITES).find((s) => s.login === email.toLowerCase())?.key ?? null);
export const CLIENT_LOGINS = Object.values(SITES).map((s) => ({ email: s.login, name: `${s.name} demo` }));

// ---------- Hourly simulation ----------
const SHAPE: Record<Kind, (h: number) => number> = {
  home: (h) => (h < 6 ? 0.7 : h < 9 ? 1.0 : h < 17 ? 0.75 : h < 23 ? 1.7 : 0.9),
  office: (h) => (h < 6 ? 0.25 : h < 8 ? 0.6 : h < 18 ? 1.8 : h < 21 ? 0.6 : 0.3),
  sports: (h) => (h < 5 ? 0.4 : h < 8 ? 0.9 : h < 21 ? 1.35 : 0.5),
  retail: (h) => (h < 9 ? 0.3 : h < 22 ? 1.6 : 0.35),
  datahall: (h) => 0.95 + 0.1 * Math.max(0, Math.sin(((h - 9) / 12) * Math.PI)),
  plant: (h) => 0.97 + 0.06 * Math.max(0, Math.sin(((h - 8) / 12) * Math.PI)),
  lab: (h) => (h < 7 ? 0.7 : h < 19 ? 1.35 : 0.8),
};
export const solarShape = (h: number) => { const x = (h + 0.5 - 6) / 12; return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); };
const SOLAR_NORM = Array.from({ length: 24 }, (_, h) => solarShape(h)).reduce((a, b) => a + b, 0);

export type Hour = { h: number; base: number; load: number; solar: number; batt: number; grid: number; soc: number };
export type Opts = { on: Set<string>; extraKwp?: number; extraBatt?: number; retrofitPct?: number };

const inHours = (h: number, r: [number, number]) => h >= r[0] && h < r[1];
const span = (r: [number, number]) => r[1] - r[0];
/** Time-of-use price multiplier (assumed): evening peak dearest, late night cheapest. */
export const tou = (h: number) => (h >= 17 && h < 22 ? 1.35 : h >= 22 || h < 7 ? 0.75 : 1.0);
/** Hourly grid emission factor (assumed): a little cleaner at midday when Luzon solar is producing. */
export const efAt = (site: Site, h: number) => site.ef * (1.07 - 0.2 * solarShape(h));

/** One typical day, hour by hour: building load, solar, battery (+ discharge, - charge), grid import. */
export function simulateDay(site: Site, o: Opts): Hour[] {
  const base = Array.from({ length: 24 }, (_, h) => site.buildings.reduce((s, b) => {
    const norm = Array.from({ length: 24 }, (_, i) => SHAPE[b.kind](i)).reduce((a, c) => a + c, 0);
    return s + (b.kwhDay * SHAPE[b.kind](h)) / norm;
  }, 0));
  const load = [...base];
  for (const a of site.actions) {
    if (!o.on.has(a.id)) continue;
    if (a.kwhDay && a.hours) for (let h = 0; h < 24; h++) if (inHours(h, a.hours)) load[h] -= a.kwhDay / span(a.hours);
    if (a.shift) for (let h = 0; h < 24; h++) {
      if (inHours(h, a.shift.from)) load[h] -= a.shift.kwh / span(a.shift.from);
      if (inHours(h, a.shift.to)) load[h] += a.shift.kwh / span(a.shift.to);
    }
  }
  const retro = 1 - (o.retrofitPct ?? 0) / 100;
  const kwp = site.solarKwp + (o.extraKwp ?? 0);
  const cap = site.batteryKwh + (o.extraBatt ?? 0), pw = (site.batteryKw * cap) / Math.max(1, site.batteryKwh);
  const useBatt = site.actions.some((a) => a.battery && o.on.has(a.id));
  // Battery plan: charge from spare solar, else cheaply after midnight; discharge in the 5-10 PM peak.
  // The day is run twice so the battery starts the day where it ended (steady state).
  let soc = cap * 0.5; let out: Hour[] = [];
  for (let pass = 0; pass < 2; pass++) {
    out = [];
    for (let h = 0; h < 24; h++) {
      const l = Math.max(0, load[h] * retro), solar = (kwp * SOLAR_YIELD * solarShape(h)) / SOLAR_NORM;
      let batt = 0;
      if (useBatt && cap > 0) {
        const surplus = solar - l;
        if (surplus > 0) { const c = Math.min(surplus, pw, (cap - soc) / 0.92); soc += c * 0.92; batt = -c; }
        else if (h >= 17 && h < 22) { const d = Math.min(-surplus, pw, soc / (22 - h)); soc -= d; batt = d; }
        else if (h >= 0 && h < 6) { const c = Math.min(pw * 0.5, (cap - soc) / 0.92 / (6 - h)); soc += c * 0.92; batt = -c; }
      }
      const grid = Math.max(0, l - solar - batt);
      out.push({ h, base: base[h], load: l, solar, batt, grid, soc: cap ? soc / cap : 0 });
    }
  }
  return out;
}

export type DaySum = { load: number; base: number; solar: number; grid: number; gridBase: number; peakGrid: number; peakBase: number; m3: number; m3Base: number; cost: number; costBase: number; co2: number; co2Base: number; solarShare: number };
const dayCost = (site: Site, d: Hour[]) => d.reduce((s, x) => s + x.grid * site.tariff * tou(x.h), 0);
const dayCo2 = (site: Site, d: Hour[]) => d.reduce((s, x) => s + (x.grid * efAt(site, x.h)) / 1000, 0);
/** Totals for one day. "Base" is the same site before AI: same solar panels, no AI actions, no battery optimisation. */
export function summarize(site: Site, o: Opts): DaySum {
  const d = simulateDay(site, o), b = simulateDay(site, { on: new Set() });
  const base = d.reduce((s, x) => s + x.base, 0), load = d.reduce((s, x) => s + x.load, 0);
  const grid = d.reduce((s, x) => s + x.grid, 0), gridBase = b.reduce((s, x) => s + x.grid, 0);
  const m3Base = site.buildings.reduce((s, x) => s + x.m3Day, 0);
  const m3 = m3Base - site.actions.filter((a) => o.on.has(a.id)).reduce((s, a) => s + (a.m3Day ?? 0), 0);
  return {
    load, base, solar: d.reduce((s, x) => s + x.solar, 0), grid, gridBase, peakGrid: Math.max(...d.map((x) => x.grid)), peakBase: Math.max(...b.map((x) => x.grid)), m3, m3Base,
    cost: dayCost(site, d) + m3 * site.waterRate, costBase: dayCost(site, b) + m3Base * site.waterRate,
    co2: dayCo2(site, d), co2Base: dayCo2(site, b), solarShare: load ? Math.min(1, (load - grid) / load) : 0,
  };
}

/** Saving each action adds on its own (everything else as currently set). */
export function actionValue(site: Site, on: Set<string>, id: string) {
  const withIt = new Set(on); withIt.add(id); const without = new Set(on); without.delete(id);
  const a = summarize(site, { on: withIt }), b = summarize(site, { on: without });
  return { pesoYear: (b.cost - a.cost) * 365, kwhDay: b.grid - a.grid, m3Day: b.m3 - a.m3, co2Year: (b.co2 - a.co2) * 365 };
}

export const defaultOn = (site: Site) => new Set(site.actions.filter((a) => a.on).map((a) => a.id));

// ---------- 12-month history (deterministic) ----------
const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const HEAT = [0.93, 0.92, 0.94, 1.0, 1.09, 1.11, 1.04, 1.0, 0.99, 0.99, 0.98, 0.95]; // hotter April-May
function rng(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
export function history(site: Site) {
  const r = rng(site.key === "ncc" ? 11 : 29);
  const live = summarize(site, { on: defaultOn(site) });
  const fullSave = 1 - live.grid / live.gridBase, waterSave = 1 - live.m3 / live.m3Base;
  return MONTHS.map((m, i) => {
    const ramp = i < 6 ? 0 : Math.min(1, (i - 5) / 4); // AI went live in June
    const days = 30, wob = 0.97 + r() * 0.06;
    const base = live.gridBase * days * HEAT[i] * wob, m3b = live.m3Base * days * (0.9 + 0.2 * (HEAT[i] - 0.9)) * wob;
    const kwh = base * (1 - fullSave * ramp), m3 = m3b * (1 - waterSave * ramp);
    return { m, base, kwh, m3b, m3, co2: (kwh * site.ef) / 1000, co2b: (base * site.ef) / 1000, live: ramp > 0 };
  });
}

/** What-if planner: added solar, battery and efficiency retrofits vs today. */
export function plan(site: Site, on: Set<string>, extraKwp: number, extraBatt: number, retrofitPct: number) {
  const now = summarize(site, { on }), next = summarize(site, { on, extraKwp, extraBatt, retrofitPct });
  const retrofitCapex = retrofitPct * now.load * 365 * site.tariff * 0.03; // ≈ 3% of yearly energy spend per % saved, ~3-year payback (assumed)
  const capex = extraKwp * CAPEX.solarPerKwp + extraBatt * CAPEX.batteryPerKwh + retrofitCapex;
  const save = (now.cost - next.cost) * 365, co2 = (now.co2 - next.co2) * 365;
  return { capex, save, payback: save > 0 ? capex / save : Infinity, co2, solarShare: next.solarShare, gridDay: next.grid };
}

// ---------- Plain-English briefing (template; AI may rewrite it) ----------
export function briefingFacts(site: Site) {
  const on = defaultOn(site), s = summarize(site, { on });
  const top = site.actions.filter((a) => !a.on).map((a) => ({ a, v: actionValue(site, on, a.id) })).sort((x, y) => y.v.pesoYear - x.v.pesoYear)[0];
  const leak = site.leaks.find((l) => l.status === "New");
  const pct = Math.round((1 - s.grid / s.gridBase) * 100);
  const facts = [
    `Site: ${site.name} (${site.kind}). Sample data for a demo.`,
    `Today grid power is ${pct}% below the same day before AI: ${Math.round(s.grid).toLocaleString()} kWh vs ${Math.round(s.gridBase).toLocaleString()} kWh. Solar and battery cover ${Math.round(s.solarShare * 100)}% of use.`,
    `Saving about ${Math.round((s.costBase - s.cost)).toLocaleString()} pesos and ${(s.co2Base - s.co2).toFixed(1)} tonnes CO2 today.`,
    leak ? `New water leak: ${leak.where}, night flow ${leak.night} m3/h vs normal ${leak.normal}, about ${leak.m3Day} m3 a day lost. Likely cause: ${leak.cause}.` : "",
    top ? `Best next step waiting for approval: ${top.a.title}, worth about ${Math.round(top.v.pesoYear).toLocaleString()} pesos a year.` : "",
    `Comfort: ${site.comfortNote}`,
  ].filter(Boolean).join("\n");
  const fallback = [
    `Good morning po. ${site.name} is drawing ${pct}% less grid power than before AI today, with solar and battery covering ${Math.round(s.solarShare * 100)}%.`,
    leak ? `One thing needs you: water is running at ${leak.where} since ${leak.since}, about ${leak.m3Day} m³ a day. ${leak.cause}. A ticket is ready to send.` : "",
    top ? `Best next step: approve "${top.a.title}". It's worth about ₱${Math.round(top.v.pesoYear).toLocaleString()} a year.` : "",
    site.comfortNote,
  ].filter(Boolean).join(" ");
  return { facts, fallback };
}
