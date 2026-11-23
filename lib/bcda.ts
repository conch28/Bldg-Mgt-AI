// BCDA building demo: the same building management system we run for Skyland, pointed at one
// BCDA-owned building in New Clark City and re-weighted to what BCDA measures instead of resident happiness.
//
// Building: the NGAC Government Building (North and South buildings) at the National Government
// Administrative Center, New Clark City, Capas, Tarlac. Owned by BCDA and developed with MTD under a
// 25-year joint venture; operational since Oct 2019; meant as backup offices for national agencies.
//
// Pure data and maths (no database). EVERY TENANT, READING, ASSET, CONTRACT AND PESO FIGURE BELOW IS
// ILLUSTRATIVE SAMPLE DATA, and the page says so. Floors, floor areas and the zone layout are simplified
// assumptions, not surveyed facts. Tenants are generic on purpose: no real agency's lease is implied.
// Real, sourced facts are only the ones listed in FACTS and SOURCES.

export const BCDA_LOGIN = "bcda@greendemo.test";
export const BCDA_NAME = "NGAC Government Building";

export const SOURCES = [
  { label: "PPP Center: NCC National Government Administrative Center (JV under RA 7227, 25 years, operational since Oct 2019)", url: "https://ppp.gov.ph/ppp_projects/new-clark-city-national-government-administrative-center-ncc-ngac" },
  { label: "BCDA 2025 Corporate Performance Scorecard, annual accomplishment report", url: "https://www.bcda.gov.ph/sites/default/files/2026-04/2.%20BCDA%20Corporate%20Performance%20Scorecard%20Annual%20Accomplishment%20Report%20for%20CY%202025.pdf" },
  { label: "BCDA: agency execs inspect future office in the NGAC North Building (Dec 2021)", url: "https://www.bcda.gov.ph/news/nia-execs-inspect-future-office-new-clark-city" },
  { label: "BCDA at the Building Green Conference with PHILGBC (Oct 2025)", url: "https://bcda.gov.ph/news/bcda-philgbc-tie-bid-advance-green-building-initiatives-0" },
  { label: "News: BCDA earns highest COA audit rating for the 15th straight year", url: "https://insiderph.com/bcda-earns-highest-coa-audit-rating-for-15th-straight-year" },
  { label: "Wikipedia: National Government Administrative Center", url: "https://en.wikipedia.org/wiki/National_Government_Administrative_Center" },
];

/** Why this building. Facts from SOURCES, written plainly. */
export const WHY = [
  "BCDA owns it outright through the NGAC joint venture, so BCDA is the client who feels every peso of power, repairs and unpaid rent.",
  "It is the backup seat of government and houses operations-centre space, so uptime and continuity matter more here than almost anywhere in Clark.",
  "Many agencies share it, so occupancy, rent billing and collections can be shown agency by agency.",
  "As a government-owned building, every purchase must survive a COA audit, which our approval trail is built for.",
];

/** How each section maps to BCDA's own 2025 corporate scorecard (GCG). Actuals are BCDA's published figures. */
export const SCORECARD = [
  { sm: "SM5", what: "Cash from JVs, leases and business contracts", target: "₱7.8B", actual: "₱11.68B", ours: "Lease billing, collections and renewals for this building", section: "leases" },
  { sm: "SM6", what: "Budget utilization (obligations and disbursements)", target: "90%", actual: "reported", ours: "Spend vs approved budget, month by month", section: "spend" },
  { sm: "SM7", what: "Satisfied customers (ARTA survey)", target: "≥ 90%", actual: "99.3%", ours: "Agency tenant satisfaction after every job", section: "tenants" },
  { sm: "SM10", what: "ISO 9001:2015 quality management", target: "Maintain", actual: "Maintained", ours: "Every job, check and approval logged as evidence", section: "assets" },
  { sm: "SM12", what: "Public Service Continuity Plan", target: "Board-approved", actual: "Approved Nov 2025", ours: "Uptime, generator tests and continuity drills", section: "uptime" },
] as const;

export const ASSUMPTIONS = {
  tariff: 10.8, // ₱/kWh blended commercial rate (assumed)
  water: 62, // ₱/m³ water and sewer (assumed)
  ef: 0.71, // t CO₂ per MWh, Luzon-Visayas grid (assumed)
  gemp: 10, // % cut vs baseline the Government Energy Management Program asks of agencies (target used here)
  benchmarkEui: 190, // kWh/m²/yr, typical air-conditioned PH government office (assumed)
  start: "Jul 2026", // when the sample AI programme started
};

// ---------- Building model ----------
export type Wing = "N" | "S";
export type LeaseState = "LEASED" | "EXPIRING" | "ARREARS" | "VACANT" | "SERVICE";
export type Lens = "uptime" | "energy" | "assets" | "leases" | "safety";
export type Tenant = { id: string; name: string; kind: string; areaM2: number; rent: number; start: string; end: string; paidPct: number; arrears: number; sat: number; critical: boolean };
export type Zone = {
  id: string; wing: Wing; floor: number; bay: number; label: string; tenant: string | null; use: string; areaM2: number;
  lease: LeaseState; kwhDay: number; eui: number; // kWh/m²/yr
  cond: 1 | 2 | 3 | 4 | 5; pmOverdue: number; safety: number; // open safety findings
  power: "OK" | "UPS" | "DEGRADED"; note: string;
};

export const WINGS: Record<Wing, { name: string; floors: number }> = { N: { name: "North Building", floors: 4 }, S: { name: "South Building", floors: 4 } };
export const BAYS = 4;
export const GFA = 2 * 4 * 2600; // m², assumed

export const TENANTS: Tenant[] = [
  { id: "ops", name: "Integrated operations centre (24/7)", kind: "Disaster and continuity operations", areaM2: 2050, rent: 780, start: "2021-03", end: "2031-02", paidPct: 100, arrears: 0, sat: 4.8, critical: true },
  { id: "exec", name: "Backup executive offices", kind: "Satellite offices, used in drills and emergencies", areaM2: 1900, rent: 780, start: "2021-03", end: "2031-02", paidPct: 100, arrears: 0, sat: 4.7, critical: true },
  { id: "a", name: "Agency A · regional office", kind: "National agency, regional HQ", areaM2: 1450, rent: 720, start: "2022-07", end: "2027-06", paidPct: 100, arrears: 0, sat: 4.5, critical: false },
  { id: "b", name: "Agency B · regional office", kind: "National agency, regional HQ", areaM2: 970, rent: 720, start: "2022-09", end: "2027-03", paidPct: 92, arrears: 375_000, sat: 4.2, critical: false },
  { id: "c", name: "Agency C · records centre", kind: "Archive and records", areaM2: 1300, rent: 650, start: "2023-01", end: "2028-12", paidPct: 100, arrears: 0, sat: 4.6, critical: false },
  { id: "d", name: "Agency D · field office", kind: "Field and liaison office", areaM2: 650, rent: 720, start: "2023-05", end: "2026-12", paidPct: 100, arrears: 0, sat: 4.4, critical: false },
  { id: "osc", name: "Region III one-stop business centre", kind: "Permits and licensing for businesses", areaM2: 1300, rent: 740, start: "2022-01", end: "2027-12", paidPct: 84, arrears: 1_210_000, sat: 4.1, critical: false },
  { id: "e", name: "Agency E · training rooms", kind: "Training and conference", areaM2: 650, rent: 680, start: "2024-02", end: "2029-01", paidPct: 100, arrears: 0, sat: 4.6, critical: false },
];

// Layout: [wing, floor, bay, tenantId | null (vacant) | "svc:<use>"]
const LAYOUT: [Wing, number, number, string | null][] = [
  ["N", 1, 1, "svc:Lobby and security"], ["N", 1, 2, "osc"], ["N", 1, 3, "osc"], ["N", 1, 4, "svc:Electrical room and UPS"],
  ["N", 2, 1, "a"], ["N", 2, 2, "a"], ["N", 2, 3, "b"], ["N", 2, 4, "b"],
  ["N", 3, 1, "exec"], ["N", 3, 2, "exec"], ["N", 3, 3, "exec"], ["N", 3, 4, "a"],
  ["N", 4, 1, null], ["N", 4, 2, null], ["N", 4, 3, "e"], ["N", 4, 4, "svc:Server and comms room"],
  ["S", 1, 1, "svc:Lobby and canteen"], ["S", 1, 2, "c"], ["S", 1, 3, "c"], ["S", 1, 4, "svc:Fire pump and water tanks"],
  ["S", 2, 1, "ops"], ["S", 2, 2, "ops"], ["S", 2, 3, "ops"], ["S", 2, 4, "d"],
  ["S", 3, 1, "c"], ["S", 3, 2, null], ["S", 3, 3, "exec"], ["S", 3, 4, "e"],
  ["S", 4, 1, null], ["S", 4, 2, "ops"], ["S", 4, 3, "d"], ["S", 4, 4, "svc:Chiller and AHU plant"],
];

// Per-zone sample conditions, keyed by zone id; everything else is computed.
const QUIRKS: Record<string, Partial<Pick<Zone, "cond" | "pmOverdue" | "safety" | "power" | "note">> & { euiX?: number }> = {
  "N1-4": { cond: 3, pmOverdue: 1, note: "UPS-2 battery string at 71% health. Replacement in the 2027 plan." },
  "N4-4": { power: "UPS", cond: 4, note: "Comms room ran 6 min on UPS during Tuesday's grid dip; generator picked up in 9 s." },
  "S4-4": { cond: 2, pmOverdue: 2, safety: 1, euiX: 1.0, note: "Chiller 2 efficiency down to 0.86 kW/TR. Tube cleaning overdue; quotes in." },
  "S1-4": { cond: 3, safety: 1, note: "Fire pump weekly churn test missed once in October. Logged and closed." },
  "N2-3": { euiX: 1.45, note: "Agency B floor: AC left on until 11 PM most nights. AI schedule proposed." },
  "N2-4": { euiX: 1.38 },
  "S3-1": { cond: 3, pmOverdue: 1, note: "Two AHU filters overdue in the records area. Dust risk to archives." },
  "N4-1": { euiX: 0.35, note: "Vacant 1,300 m² across two bays. Lights and AC off by schedule." },
  "N4-2": { euiX: 0.35 },
  "S2-1": { power: "OK", note: "Operations centre: dual feed, 2N UPS, generator in 9 s. 100% available this quarter." },
  "S1-2": { safety: 1, note: "Records area: one fire extinguisher past its refill date. Fixed Friday, photo on file." },
  "N1-1": { note: "Lobby and security. Visitor log and CCTV, 24/7 guards." },
};

const TENANT_EUI: Record<string, number> = { ops: 290, exec: 165, a: 175, b: 185, c: 120, d: 170, osc: 205, e: 150 };
const SVC_EUI: Record<string, number> = { "Lobby and security": 140, "Electrical room and UPS": 90, "Server and comms room": 820, "Lobby and canteen": 260, "Fire pump and water tanks": 40, "Chiller and AHU plant": 60 };

const ZONE_M2 = 650;
function expiring(end: string) { const [y, m] = end.split("-").map(Number); return (y - 2026) * 12 + (m - 11) <= 6; }

export const ZONES: Zone[] = LAYOUT.map(([wing, floor, bay, t]) => {
  const id = `${wing}${floor}-${bay}`;
  const q = QUIRKS[id] ?? {};
  const tenant = t && !t.startsWith("svc:") ? TENANTS.find((x) => x.id === t)! : null;
  const svc = t?.startsWith("svc:") ? t.slice(4) : null;
  const lease: LeaseState = svc ? "SERVICE" : !tenant ? "VACANT" : tenant.arrears > 0 ? "ARREARS" : expiring(tenant.end) ? "EXPIRING" : "LEASED";
  const baseEui = tenant ? TENANT_EUI[tenant.id] : svc ? SVC_EUI[svc] ?? 120 : 60;
  const eui = Math.round(baseEui * (q.euiX ?? 1));
  return {
    id, wing, floor, bay, label: `${WINGS[wing].name}, floor ${floor}, bay ${bay}`,
    tenant: tenant?.id ?? null, use: tenant?.name ?? svc ?? "Vacant, ready to lease", areaM2: ZONE_M2,
    lease, eui, kwhDay: Math.round((eui * ZONE_M2) / 365),
    cond: q.cond ?? (svc ? 4 : 5) as Zone["cond"], pmOverdue: q.pmOverdue ?? 0, safety: q.safety ?? 0, power: q.power ?? "OK",
    note: q.note ?? (tenant ? `${tenant.name}. Lease to ${tenant.end}.` : svc ? svc : "Vacant. Lights and AC off by schedule."),
  };
});

// ---------- Uptime and continuity ----------
export const SYSTEMS = [
  { name: "Critical power (ops centre, comms)", target: 99.99, actual: 100, note: "Dual utility feed, 2N UPS, 2 × 1,000 kVA generators" },
  { name: "Building power", target: 99.9, actual: 99.96, note: "3 grid dips this quarter, all caught by generator in under 10 s" },
  { name: "Cooling (chillers and AHUs)", target: 99.5, actual: 99.3, note: "Chiller 2 off 14 h for an emergency repair on 4 Nov" },
  { name: "Lifts (6 cars)", target: 99.0, actual: 99.6, note: "One car out 9 h for a door-operator part" },
  { name: "Water supply and pumps", target: 99.5, actual: 100, note: "Two days of storage in the tanks" },
  { name: "Network and CCTV", target: 99.9, actual: 99.97, note: "Two carriers; 128 cameras, 2 offline for 3 h" },
];
export const CONTINUITY = [
  { k: "Generator auto-start (last test)", v: "9.2 s", d: "target under 10 s · 18 Nov, full load 45 min", ok: true },
  { k: "Fuel on site", v: "72 h", d: "at full load · BCDA continuity plan asks 72 h", ok: true },
  { k: "UPS autonomy, critical loads", v: "28 min", d: "UPS-2 battery health 71%, replace by Q2 2027", ok: false },
  { k: "Last continuity drill", v: "14 Nov", d: "Backup offices up in 38 min (target 60)", ok: true },
];

// ---------- Energy and water ----------
export const SHAPE = (h: number, weekend = false) => {
  if (weekend) return 0.42;
  return h < 6 ? 0.38 : h < 7 ? 0.6 : h < 9 ? 1.05 : h < 12 ? 1.35 : h < 13 ? 1.2 : h < 17 ? 1.42 : h < 19 ? 0.95 : h < 23 ? 0.62 : 0.42;
};
const SOLAR = (h: number) => (h < 6 || h > 18 ? 0 : Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)));
export const SOLAR_KWP = 420; // rooftop solar, sample
export const ENERGY = {
  kwhDay: ZONES.reduce((s, z) => s + z.kwhDay, 0),
  baselineKwhDay: Math.round(ZONES.reduce((s, z) => s + z.kwhDay, 0) / 0.86), // −14% vs baseline since the AI programme
  m3Day: 96, baselineM3Day: 118, solarKwhDay: Math.round(SOLAR_KWP * 3.8),
};
export function dayCurve(on: boolean) {
  const mean = 24 / Array.from({ length: 24 }, (_, h) => SHAPE(h)).reduce((s, x) => s + x, 0);
  const total = on ? ENERGY.kwhDay : ENERGY.baselineKwhDay;
  return Array.from({ length: 24 }, (_, h) => {
    const load = (total / 24) * SHAPE(h) * mean * (on || (h > 6 && h < 19) ? 1 : 1.25);
    const solar = on ? (ENERGY.solarKwhDay / 7.6) * SOLAR(h) : 0;
    return { h, load: Math.round(load), solar: Math.round(Math.min(solar, load)), grid: Math.round(Math.max(0, load - solar)) };
  });
}
export const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((m, i) => {
  const season = [0.9, 0.88, 0.92, 1.02, 1.12, 1.12, 1.04, 1.0, 0.99, 0.98, 0.97, 0.95][i];
  const base = Math.round((ENERGY.baselineKwhDay * 30 * season) / 1000);
  const live = i >= 7; // programme live from Jul
  const cut = live ? Math.min(0.16, 0.05 + (i - 7) * 0.025) : 0;
  return { m, base, actual: Math.round(base * (1 - cut)) };
});
export const LEAKS = [
  { where: "South Building, floor 1 toilets", what: "Night flow 0.6 m³/h when it should be zero", since: "Sun 1:40 AM", m3Day: 9, status: "Plumber booked today" },
  { where: "Cooling tower make-up line", what: "Float valve sticking open twice a week", since: "Last week", m3Day: 0, status: "Fixed, being watched" },
];
export const AI_MOVES = [
  { title: "AC schedule follows each agency's real hours", saves: 410, kind: "Power", state: "Live" },
  { title: "Chiller sequencing and chilled-water reset", saves: 520, kind: "Power", state: "Live" },
  { title: "Vacant floors: lights and AC off, weekly check", saves: 300, kind: "Power", state: "Live" },
  { title: "Agency B after-hours AC (until 11 PM)", saves: 180, kind: "Power", state: "Awaiting agency OK" },
  { title: "Night-flow leak alarms on every water meter", saves: 22, kind: "Water", state: "Live" },
  { title: "Condensate recovery to cooling towers", saves: 9, kind: "Water", state: "Quote in" },
];

// ---------- Green rating ----------
export const CERTS = [
  { name: "BERDE for Operations", body: "Philippine Green Building Council", target: "4 stars", items: [["12 months of metered power and water", true], ["Energy use below benchmark", true], ["Water-efficient fixtures", true], ["Waste segregation report (RA 9003)", false], ["Indoor air quality survey", false]] },
  { name: "Government Energy Management Program", body: "DOE · applies to government buildings", target: "−10% vs baseline", items: [["Monthly energy and fuel report to DOE", true], ["Office AC at 24°C, lights schedule", true], ["Cut ≥ 10% vs baseline", true], ["Energy-efficient lighting retrofit", true]] },
  { name: "RA 11285 Energy Efficiency Act", body: "Department of Energy", target: "Compliant", items: [["Certified energy manager named", true], ["Annual energy report (drafted by AI)", true], ["Energy audit every 3 years", false], ["Energy conservation plan filed", true]] },
] as const;

// ---------- Assets and preventive maintenance ----------
export type Asset = { tag: string; name: string; zone: string; cond: 1 | 2 | 3 | 4 | 5; pm: string; pmDue: string; overdue: boolean; age: number; life: number; replace: number; note: string };
export const ASSETS: Asset[] = [
  { tag: "CH-01", name: "Chiller 1 (400 TR)", zone: "S4-4", cond: 4, pm: "Quarterly", pmDue: "12 Dec", overdue: false, age: 7, life: 20, replace: 18_500_000, note: "0.68 kW/TR" },
  { tag: "CH-02", name: "Chiller 2 (400 TR)", zone: "S4-4", cond: 2, pm: "Quarterly", pmDue: "28 Oct", overdue: true, age: 7, life: 20, replace: 18_500_000, note: "0.86 kW/TR, tube cleaning overdue" },
  { tag: "GEN-01", name: "Generator 1 (1,000 kVA)", zone: "N1-4", cond: 5, pm: "Monthly", pmDue: "18 Dec", overdue: false, age: 7, life: 25, replace: 9_800_000, note: "Started in 9.2 s" },
  { tag: "GEN-02", name: "Generator 2 (1,000 kVA)", zone: "N1-4", cond: 4, pm: "Monthly", pmDue: "18 Dec", overdue: false, age: 7, life: 25, replace: 9_800_000, note: "Coolant hose replaced" },
  { tag: "UPS-02", name: "UPS 2 (critical loads)", zone: "N1-4", cond: 3, pm: "Semi-annual", pmDue: "Jan", overdue: false, age: 7, life: 10, replace: 2_600_000, note: "Battery health 71%" },
  { tag: "TX-01", name: "Transformer 1 (2,500 kVA)", zone: "N1-4", cond: 5, pm: "Annual", pmDue: "Mar", overdue: false, age: 7, life: 30, replace: 6_200_000, note: "Thermal scan clean" },
  { tag: "AHU-S3", name: "AHUs, South floor 3 (×4)", zone: "S3-1", cond: 3, pm: "Monthly", pmDue: "10 Nov", overdue: true, age: 7, life: 18, replace: 3_400_000, note: "2 filters overdue" },
  { tag: "FP-01", name: "Fire pump set", zone: "S1-4", cond: 4, pm: "Weekly churn", pmDue: "Mon", overdue: false, age: 7, life: 20, replace: 2_100_000, note: "1 missed churn in Oct" },
  { tag: "LIFT-1-6", name: "Lifts (6 cars)", zone: "N1-1", cond: 4, pm: "Monthly", pmDue: "5 Dec", overdue: false, age: 7, life: 25, replace: 21_000_000, note: "Permits valid to Jun 2027" },
  { tag: "PV-ROOF", name: "Rooftop solar (420 kWp)", zone: "N4-3", cond: 5, pm: "Quarterly clean", pmDue: "Jan", overdue: false, age: 1, life: 25, replace: 17_600_000, note: "Yield 3.8 kWh/kWp/day" },
];
export const PM_STATS = { done: 412, scheduled: 431, backlog: 9, avgCloseH: 26, reactiveShare: 18 };
export const RESERVE = [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036].map((y, i) => ({ y, need: [2.6, 0.8, 3.4, 1.2, 0.9, 4.1, 1.5, 18.5, 2.2, 3.4][i] }));

// ---------- Spend and procurement (COA audit-ready) ----------
export const BUDGET = { annual: 64_000_000, ytd: 52_900_000, plannedYtd: 56_100_000 }; // ₱, sample
export const SPEND_LINES = [
  { k: "Power", ytd: 23_400_000, plan: 25_900_000 }, { k: "Water", ytd: 1_900_000, plan: 2_200_000 },
  { k: "Repairs and PM contracts", ytd: 11_300_000, plan: 11_000_000 }, { k: "Security and janitorial", ytd: 12_100_000, plan: 12_100_000 },
  { k: "Insurance, permits, other", ytd: 4_200_000, plan: 4_900_000 },
];
export type Buy = { ref: string; what: string; amount: number; mode: string; philgeps: string | null; quotes: number; steps: [string, boolean][]; status: string; saved: number };
export const BUYS: Buy[] = [
  { ref: "PR-2026-118", what: "Chiller 2 tube cleaning and eddy-current test", amount: 485_000, mode: "Small value procurement", philgeps: "PhilGEPS ref posted", quotes: 3, status: "Awaiting award", saved: 0,
    steps: [["In the annual procurement plan", true], ["Posted on PhilGEPS", true], ["3 quotes, AI price check vs past buys", true], ["Award approved by BAC", false], ["Inspection and acceptance report", false], ["Paid against invoice", false]] },
  { ref: "PR-2026-112", what: "UPS-2 battery string replacement", amount: 1_240_000, mode: "Public bidding", philgeps: "PhilGEPS ref posted", quotes: 4, status: "Bid evaluation", saved: 0,
    steps: [["In the annual procurement plan", true], ["Posted on PhilGEPS", true], ["Bids opened in public", true], ["Award approved by BAC", false], ["Inspection and acceptance report", false], ["Paid against invoice", false]] },
  { ref: "PR-2026-097", what: "AHU filters, 12-month supply", amount: 318_000, mode: "Small value procurement", philgeps: "PhilGEPS ref posted", quotes: 3, status: "Paid", saved: 46_000,
    steps: [["In the annual procurement plan", true], ["Posted on PhilGEPS", true], ["3 quotes, AI price check vs past buys", true], ["Award approved by BAC", true], ["Inspection and acceptance report", true], ["Paid against invoice", true]] },
  { ref: "PR-2026-090", what: "Fire extinguisher refill and testing", amount: 96_000, mode: "Small value procurement", philgeps: "PhilGEPS ref posted", quotes: 3, status: "Paid", saved: 12_500,
    steps: [["In the annual procurement plan", true], ["Posted on PhilGEPS", true], ["3 quotes, AI price check vs past buys", true], ["Award approved by BAC", true], ["Inspection and acceptance report", true], ["Paid against invoice", true]] },
  { ref: "PR-2026-084", what: "Emergency repair, Chiller 2 compressor contactor", amount: 142_000, mode: "Emergency (negotiated)", philgeps: "Posted after award", quotes: 2, status: "Paid", saved: 0,
    steps: [["Emergency reason written and signed", true], ["Posted on PhilGEPS after award", true], ["2 quotes on the day", true], ["Award approved by head of office", true], ["Inspection and acceptance report", true], ["Paid against invoice", true]] },
];
export const AUDIT = { trail: 98.6, aomsOpen: 0, aomsClosed: 3, priceFlags: 4, avgDaysToPay: 11 };

// ---------- Leases ----------
export const leasable = () => ZONES.filter((z) => z.lease !== "SERVICE");
export function leaseStats() {
  const L = leasable();
  const leasedM2 = L.filter((z) => z.lease !== "VACANT").reduce((s, z) => s + z.areaM2, 0);
  const totalM2 = L.reduce((s, z) => s + z.areaM2, 0);
  const billedMonth = TENANTS.reduce((s, t) => s + t.areaM2 * t.rent, 0);
  const arrears = TENANTS.reduce((s, t) => s + t.arrears, 0);
  const vacantM2 = totalM2 - leasedM2;
  return { leasedM2, totalM2, occ: leasedM2 / totalM2, billedMonth, billedYear: billedMonth * 12, arrears, vacantM2, vacantRentYear: vacantM2 * 720 * 12,
    collect: 1 - arrears / (billedMonth * 3) };
}
export const PIPELINE = [
  { who: "Agency F (regional office)", m2: 1300, stage: "Site visit done", fit: "North floor 4, bays 1–2" },
  { who: "Agency G (training centre)", m2: 650, stage: "Letter of intent", fit: "South floor 3, bay 2" },
  { who: "Agency H (data processing)", m2: 650, stage: "First call", fit: "South floor 4, bay 1" },
];

// ---------- Safety and compliance ----------
export const PERMITS = [
  { name: "Fire Safety Inspection Certificate (BFP)", due: "Mar 2027", days: 124, ok: true },
  { name: "Lift permits to operate (6 cars)", due: "Jun 2027", days: 215, ok: true },
  { name: "Generator permit to operate (DENR air)", due: "Jan 2027", days: 52, ok: true },
  { name: "Sanitary permit and potable water test", due: "15 Dec 2026", days: 22, ok: false },
  { name: "Electrical inspection (annual)", due: "Feb 2027", days: 85, ok: true },
  { name: "Structural check after Oct quake (M5.4)", due: "Done 21 Oct", days: 0, ok: true },
];
export const DRILLS = [
  { k: "Fire drill", last: "17 Oct", next: "Jan", note: "Full evacuation in 6 min 40 s" },
  { k: "Earthquake drill (NSED)", last: "11 Sep", next: "Dec", note: "With all agencies" },
  { k: "Continuity drill", last: "14 Nov", next: "Feb", note: "Backup offices live in 38 min" },
];
export const SAFETY = { daysNoLti: 412, nearMiss: 3, openFindings: ZONES.reduce((s, z) => s + z.safety, 0), guardRounds: 98.2 };

// ---------- Tenant satisfaction (replaces resident happiness for BCDA) ----------
export const tenantSat = () => {
  const w = TENANTS.reduce((s, t) => s + t.areaM2, 0);
  const avg = TENANTS.reduce((s, t) => s + t.sat * t.areaM2, 0) / w;
  return { avg, satisfiedPct: 96.4, jobs: 286, medianFixH: 5.5 };
};

// ---------- Headline score: BCDA building health ----------
export function healthScore() {
  const ls = leaseStats();
  const parts = [
    { k: "Uptime", v: 98, w: 0.2 },
    { k: "Energy and water", v: 86, w: 0.2 },
    { k: "Asset condition", v: Math.round((PM_STATS.done / PM_STATS.scheduled) * 100) - 7, w: 0.15 },
    { k: "Audit-ready spending", v: Math.round(AUDIT.trail), w: 0.15 },
    { k: "Occupancy and collections", v: Math.round(ls.occ * 100), w: 0.15 },
    { k: "Safety and permits", v: 94, w: 0.15 },
  ];
  return { score: Math.round(parts.reduce((s, p) => s + p.v * p.w, 0)), parts };
}

export function briefingFacts() {
  const ls = leaseStats();
  const ch2 = ASSETS.find((a) => a.tag === "CH-02")!;
  const facts = [
    `Building: ${BCDA_NAME}, New Clark City. Sample data.`,
    `Critical power availability this quarter: 100%. Generator start time at last test: 9.2 seconds.`,
    `Power use today about ${Math.round(ENERGY.kwhDay).toLocaleString("en-PH")} kWh, down ${Math.round((1 - ENERGY.kwhDay / ENERGY.baselineKwhDay) * 100)}% vs baseline (GEMP target 10%).`,
    `Chiller 2 efficiency is ${ch2.note}. A ₱485,000 cleaning job is awaiting BAC award.`,
    `Occupancy ${Math.round(ls.occ * 100)}% of leasable space; ${Math.round(ls.vacantM2).toLocaleString("en-PH")} m² vacant. Arrears ₱${(ls.arrears / 1e6).toFixed(2)}M, mostly the one-stop business centre.`,
    `Sanitary permit and potable water test due in 22 days.`,
    `Audit trail complete on ${AUDIT.trail}% of purchases; no open COA audit observations.`,
  ].join("\n");
  const fallback = `Good morning po. One thing needs action today: Chiller 2 is running at ${ch2.note.split(",")[0]}, so please push the ₱485,000 cleaning job through BAC award this week. Power use is down ${Math.round((1 - ENERGY.kwhDay / ENERGY.baselineKwhDay) * 100)}% against baseline, ahead of the 10% GEMP target, and critical power stayed at 100% this quarter. Occupancy is ${Math.round(ls.occ * 100)}%, with two agencies in the pipeline for the vacant fourth floor. Arrears of ₱${(ls.arrears / 1e6).toFixed(2)}M sit mostly with the one-stop business centre, and a reminder is drafted. The sanitary permit renewal is due in 22 days, and every purchase this year has a complete COA-ready trail.`;
  return { facts, fallback };
}
