/**
 * Data readiness register. REQUIREMENTS is the single source of truth for "what information the
 * building runs on": where it comes from, who owns it, how fresh it must be, how it is verified, and
 * a live measure of how complete it is today. The Data Center page prints it, the docs mirror it
 * (docs/data-governance/MASTER_DATA_REGISTER.md), and the score is computed from it.
 *
 * Rules:
 * - Existing data is not assumed accurate. "Verified" means a person checked it against a source.
 * - A high overall score never hides a safety gap: safety rows gate readiness on their own.
 * - Rows the app cannot measure yet are shown as "Not tracked yet" and left out of the score.
 */
import { prisma } from "./db";
import { nowManila } from "./format";
import { requiredKinds } from "./vetting";

export type Crit = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ReqStatus = "VERIFIED" | "INCOMPLETE" | "MISSING" | "OUTDATED" | "NOT_TRACKED";
export type Measure = { have: number; of: number; stale?: number; note: string };
export type Requirement = {
  id: string; category: string; data: string; module: string; source: string; owner: string;
  frequency: string; criticality: Crit; safety?: boolean; verify: string; action: string;
  measure?: (c: Ctx) => Measure;
};

const DAY = 86400000;
const SAFE = (a: { criticality: string }) => a.criticality === "SAFETY";
const KEY = (a: { criticality: string }) => a.criticality === "SAFETY" || a.criticality === "HIGH";
const specOk = (a: { manufacturer: string | null; model: string | null; serial: string | null }) => !!(a.manufacturer && a.model && a.serial);

/** Everything the measures need, loaded once per page view. */
export async function loadCtx(buildingId: string) {
  const now = nowManila();
  const [building, units, owners, leases, assets, pm, compliance, vendors, creds, meters, budget, docs, staff, wos] = await Promise.all([
    prisma.building.findUnique({ where: { id: buildingId } }),
    prisma.unit.findMany({ where: { buildingId }, select: { id: true, code: true, sqm: true, ownerId: true, ownerName: true, occupancy: true } }),
    prisma.user.findMany({ where: { buildingId, role: "OWNER", active: true }, select: { id: true, email: true, phone: true } }),
    prisma.lease.findMany({ where: { unit: { buildingId } }, select: { id: true, unitId: true, tenantName: true, rent: true, start: true, end: true } }),
    prisma.asset.findMany({ orderBy: { tag: "asc" } }),
    prisma.pMTask.findMany(),
    prisma.complianceItem.findMany({ where: { buildingId }, orderBy: { expiresAt: "asc" } }),
    prisma.vendor.findMany({ where: { active: true } }),
    prisma.vendorCredential.findMany(),
    prisma.meterReading.findMany({ where: { takenAt: { gte: new Date(now.getTime() - 7 * DAY) } }, select: { meter: true, takenAt: true } }),
    prisma.budgetLine.findMany({ select: { period: true } }),
    prisma.document.findMany({ select: { id: true, category: true, createdAt: true } }),
    prisma.user.findMany({ where: { buildingId, role: { in: ["MANAGER", "ADMIN", "BOARD", "GUARD"] }, active: true }, select: { id: true, role: true, phone: true, email: true } }),
    prisma.workOrder.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, select: { status: true, assignee: true, category: true } }),
  ]);
  return { now, building, units, owners, leases, assets, pm, compliance, vendors, creds, meters, budget, docs, staff, wos };
}
export type Ctx = Awaited<ReturnType<typeof loadCtx>>;

const pmFor = (c: Ctx, tag: string) => c.pm.filter((p) => p.assetTag === tag);
const current = (l: { start: Date; end: Date }, now: Date) => l.start <= now && l.end >= now;
const verifiedCred = (c: Ctx, vendorId: string, kind: string) => c.creds.some((x) => x.vendorId === vendorId && x.kind === kind && x.status === "VERIFIED" && (!x.expiresAt || x.expiresAt > c.now));
const docCount = (c: Ctx, cats: string[]) => c.docs.filter((d) => cats.includes(d.category)).length;

export const REQUIREMENTS: Requirement[] = [
  // A. Property
  { id: "prop-profile", category: "Property", data: "Building profile: name, address, towers, floors, units, year built, floor areas", module: "Every page, reports, AI assistant", source: "Master deed, occupancy permit, as-built plans", owner: "Property manager", frequency: "On change", criticality: "HIGH",
    verify: "Compare with the master deed and occupancy permit", action: "Enter from the master deed during onboarding",
    measure: (c) => ({ have: c.building && c.units.length ? 1 : 0, of: 1, note: c.building ? `${c.building.name}, ${c.units.length} units on record` : "No building record" }) },
  { id: "prop-contacts", category: "Property", data: "Emergency contacts and building staff (manager, engineer, guards, utilities, BFP, hospital)", module: "SOS, typhoon mode, guard rounds", source: "Building administration", owner: "Property manager", frequency: "On change, checked monthly", criticality: "CRITICAL", safety: true,
    verify: "Call each number once a quarter", action: "Every staff login needs a mobile number for alerts",
    measure: (c) => { const ok = c.staff.filter((s) => s.phone).length; return { have: ok, of: c.staff.length, note: `${ok} of ${c.staff.length} staff and board logins have a mobile number for alerts` }; } },

  // B. Plans and technical documents
  { id: "docs-plans", category: "Plans & documents", data: "As-built, electrical, plumbing, fire protection and structural plans", module: "Maintenance, renovations, AI assistant", source: "Developer turnover, Office of the Building Official", owner: "Engineering (property manager for now)", frequency: "On renovation", criticality: "HIGH",
    verify: "Engineer confirms plans match the building", action: "Upload to Documents under Plans",
    measure: (c) => { const n = docCount(c, ["Plans"]); return { have: Math.min(n, 5), of: 5, note: `${n} plan set(s) uploaded (target: architectural, structural, electrical, plumbing/sanitary, fire protection)` }; } },
  { id: "docs-manuals", category: "Plans & documents", data: "Equipment manuals, datasheets and warranties", module: "Asset pages (QR), preventive maintenance", source: "Manufacturer, supplier, turnover documents", owner: "Chief engineer", frequency: "On purchase", criticality: "MEDIUM",
    verify: "Model on the manual matches the nameplate", action: "Attach the manual on each key asset's page",
    measure: (c) => { const k = c.assets.filter(KEY); const ok = k.filter((a) => a.manualDocId).length; return { have: ok, of: k.length, note: `${ok} of ${k.length} safety and high-criticality assets have a manual attached` }; } },

  // C. Assets
  { id: "asset-register", category: "Assets", data: "Asset register: every safety and high-criticality asset has make, model, serial, location, install date", module: "Maintenance, budgeting, procurement, QR pages", source: "Nameplate photo, turnover list, invoices", owner: "Chief engineer", frequency: "Every inspection", criticality: "CRITICAL", safety: true,
    verify: "Nameplate photo matches the record", action: "Walk the plant rooms with the asset list and photograph each nameplate",
    measure: (c) => { const k = c.assets.filter(KEY); const ok = k.filter(specOk).length; return { have: ok, of: k.length, note: `${ok} of ${k.length} key assets have make, model and serial` }; } },
  { id: "asset-verified", category: "Assets", data: "Key asset specifications verified by a person", module: "Maintenance intervals, replacement budget", source: "Nameplate, manual or contractor report", owner: "Chief engineer", frequency: "Every inspection", criticality: "CRITICAL", safety: true,
    verify: "Second person signs off in the asset page", action: "Tap Verify specs on each asset page after checking the nameplate",
    measure: (c) => { const k = c.assets.filter(KEY); const ok = k.filter((a) => a.verifiedAt).length; return { have: ok, of: k.length, note: `${ok} of ${k.length} key assets verified` }; } },
  { id: "asset-costs", category: "Assets", data: "Replacement cost and expected life", module: "Reserve fund and capex plan", source: "Supplier quotes, manufacturer life data", owner: "Chief engineer with finance", frequency: "Yearly", criticality: "MEDIUM",
    verify: "Based on a dated quote", action: "Add replacement cost from a current quote",
    measure: (c) => { const k = c.assets.filter(KEY); const ok = k.filter((a) => a.replacementCost != null).length; return { have: ok, of: k.length, note: `${ok} of ${k.length} key assets have a replacement cost` }; } },

  // D. Maintenance
  { id: "pm-coverage", category: "Maintenance", data: "Every safety-critical asset has a preventive maintenance schedule", module: "Maintenance calendar, work orders", source: "Manufacturer manual, statutory rules, engineer", owner: "Facilities management", frequency: "On approved change", criticality: "CRITICAL", safety: true,
    verify: "Schedule linked to the asset", action: "Link each safety asset to its maintenance task",
    measure: (c) => { const s = c.assets.filter(SAFE); const ok = s.filter((a) => pmFor(c, a.tag).length).length; return { have: ok, of: s.length, note: `${ok} of ${s.length} safety assets have a schedule` }; } },
  { id: "pm-source", category: "Maintenance", data: "Maintenance intervals come from the manufacturer, a statutory rule or an engineer (never guessed)", module: "Maintenance calendar", source: "Manual, regulation, engineer's recommendation", owner: "Chief engineer", frequency: "On approved change", criticality: "CRITICAL", safety: true,
    verify: "Interval source recorded on the schedule", action: "Set the interval source on each safety task",
    measure: (c) => { const tags = new Set(c.assets.filter(SAFE).map((a) => a.tag)); const t = c.pm.filter((p) => p.compliance || (p.assetTag && tags.has(p.assetTag))); const ok = t.filter((p) => p.intervalSource !== "UNVERIFIED").length; return { have: ok, of: t.length, note: `${ok} of ${t.length} safety schedules have a verified interval source` }; } },
  { id: "pm-current", category: "Maintenance", data: "Preventive maintenance done on time", module: "Maintenance calendar", source: "Work orders, contractor reports", owner: "Facilities management", frequency: "On completion", criticality: "HIGH",
    verify: "Completion photo and checklist", action: "Close overdue tasks or reschedule with a reason",
    measure: (c) => { const late = c.pm.filter((p) => p.nextDue < c.now).length; return { have: c.pm.length - late, of: c.pm.length, stale: late, note: `${late} of ${c.pm.length} tasks overdue` }; } },
  { id: "wo-history", category: "Maintenance", data: "Work orders with assignee, cost and completion photo", module: "Work orders, vendor scoring, reports", source: "App (technician job link)", owner: "Property manager", frequency: "On change", criticality: "HIGH",
    verify: "Manager verifies the after photo", action: "Already captured by the accountability workflow",
    measure: (c) => { const ok = c.wos.filter((w) => w.status === "NEW" || w.assignee).length; return { have: ok, of: c.wos.length, note: `${ok} of ${c.wos.length} work orders in the last 30 days have an assignee or are brand new` }; } },

  // E. Contractors
  { id: "vendor-vetting", category: "Contractors", data: "Contractor registration, permits, licences and insurance, verified", module: "Procurement, maintenance, vendor scoring", source: "Contractor submits; we check with the issuer", owner: "Procurement (operations head)", frequency: "Before engagement and on expiry", criticality: "HIGH",
    verify: "Someone other than who entered it checks each document", action: "Request missing documents from each active contractor",
    measure: (c) => { const ok = c.vendors.filter((v) => requiredKinds(v.service).every((k) => verifiedCred(c, v.id, k))).length; return { have: ok, of: c.vendors.length, note: `${ok} of ${c.vendors.length} active contractors fully vetted` }; } },
  { id: "vendor-insurance", category: "Contractors", data: "Contractor insurance current", module: "Procurement, permits-to-work", source: "Insurer certificate", owner: "Procurement (operations head)", frequency: "On change and before expiry", criticality: "HIGH",
    verify: "Certificate checked with insurer", action: "Chase expired certificates before any new job",
    measure: (c) => { const ok = c.vendors.filter((v) => v.insuranceExpiry && v.insuranceExpiry > c.now).length; return { have: ok, of: c.vendors.length, stale: c.vendors.length - ok, note: `${c.vendors.length - ok} contractor(s) with expired or missing insurance` }; } },

  // F. Procurement (already strong in the app)
  { id: "proc-controls", category: "Procurement", data: "Purchase requests, quotes, approvals, delivery photos, receipts", module: "Procurement & controls", source: "App", owner: "Procurement (operations head)", frequency: "Every transaction", criticality: "HIGH",
    verify: "Money gates: no receipt, no payment", action: "Already enforced in Procurement", measure: () => ({ have: 1, of: 1, note: "Enforced by the procurement workflow (approval limits, 3 quotes, receive with photo, receipt before payment)" }) },

  // G. Units and owners
  { id: "unit-register", category: "Units & owners", data: "Unit codes, floors and floor areas", module: "Dues billing, voting weights, 3D view", source: "Master deed, condominium certificates of title", owner: "Property administration", frequency: "On change", criticality: "CRITICAL",
    verify: "Floor area matches the master deed", action: "Import the unit list from the master deed",
    measure: (c) => { const ok = c.units.filter((u) => Number(u.sqm) > 0).length; return { have: ok, of: c.units.length, note: `${ok} of ${c.units.length} units have a floor area` }; } },
  { id: "unit-owner", category: "Units & owners", data: "Registered owner for each unit with a way to reach them", module: "Billing, resident updates, voting", source: "Title, owner registration form", owner: "Property administration", frequency: "On sale or change", criticality: "HIGH",
    verify: "Title or deed of sale on file", action: "Run the owner registration drive",
    measure: (c) => { const ok = c.units.filter((u) => u.ownerId || u.ownerName).length; return { have: ok, of: c.units.length, note: `${ok} of ${c.units.length} units have an owner on record` }; } },
  { id: "unit-occupancy", category: "Units & owners", data: "Occupancy: owner-occupied, leased or vacant", module: "Leasing, emergency headcount, typhoon mode", source: "Owner, lease registration", owner: "Property administration", frequency: "On change", criticality: "MEDIUM",
    verify: "Owner confirms in the app", action: "Ask owners to confirm in the app",
    measure: (c) => { const leased = new Set(c.leases.filter((l) => current(l, c.now)).map((l) => l.unitId)); const ok = c.units.filter((u) => u.occupancy || leased.has(u.id)).length; return { have: ok, of: c.units.length, note: `${ok} of ${c.units.length} units have occupancy recorded` }; } },
  { id: "lease-register", category: "Leasing", data: "Active leases: tenant, rent, deposit, dates (no overlaps)", module: "Leasing, occupancy, access", source: "Signed lease contract", owner: "Leasing", frequency: "On change", criticality: "HIGH",
    verify: "Matches the signed contract; dates do not overlap", action: "Upload lease contracts and fix overlaps",
    measure: (c) => { const act = c.leases.filter((l) => current(l, c.now)); const bad = new Set<string>(); for (const a of act) for (const b of c.leases) if (a.id !== b.id && a.unitId === b.unitId && a.start < b.end && b.start < a.end) bad.add(a.id); const ok = act.filter((l) => !bad.has(l.id) && Number(l.rent) > 0 && l.tenantName && l.end > l.start).length; return { have: ok, of: act.length, note: `${ok} of ${act.length} active leases complete and consistent` }; } },
  { id: "market-comps", category: "Leasing", data: "Rental and sale comparables with source, date and asking vs actual", module: "AI price check, listings", source: "Listings, broker partner, actual transactions", owner: "Leasing", frequency: "Weekly to monthly", criticality: "MEDIUM",
    verify: "Each comp has a source and date; estimates are labelled", action: "Already labelled in the price check", measure: () => ({ have: 1, of: 1, note: "Comps carry source and date; AI estimates are labelled as estimates" }) },

  // I. Utilities
  { id: "meter-readings", category: "Utilities", data: "Daily main water and electric meter readings", module: "Energy & water, leak check", source: "Guard rounds (measured)", owner: "Engineering and finance", frequency: "Daily", criticality: "HIGH",
    verify: "Reading photo or second reading", action: "Guards enter readings on each round",
    measure: (c) => { const fresh = ["WATER_MAIN", "ELECTRIC_MAIN"].filter((m) => c.meters.some((r) => r.meter === m && r.takenAt > new Date(c.now.getTime() - 1.5 * DAY))).length; return { have: fresh, of: 2, stale: 2 - fresh, note: `${fresh} of 2 main meters read in the last 36 hours` }; } },

  // J. Money
  { id: "budget", category: "Money", data: "Approved operating budget by line", module: "Reports, budget vs actual, AI advisor", source: "Board-approved budget", owner: "Finance", frequency: "Monthly review", criticality: "HIGH",
    verify: "Board resolution approving the budget", action: "Enter the approved budget",
    measure: (c) => ({ have: c.budget.length ? 1 : 0, of: 1, note: c.budget.length ? `${c.budget.length} budget lines on record` : "No budget entered" }) },
  { id: "bank-recon", category: "Money", data: "Bank reconciliation against the accounting system", module: "Collections, reports", source: "Bank statement, accounting system", owner: "Finance", frequency: "Monthly (by the 10th)", criticality: "CRITICAL",
    verify: "Treasurer signs the reconciliation", action: "Upload the signed reconciliation each month to Documents (Financial)",
    measure: (c) => { const recent = c.docs.filter((d) => d.category === "Financial" && d.createdAt > new Date(c.now.getTime() - 40 * DAY)).length; return { have: recent ? 1 : 0, of: 1, stale: recent ? 0 : 1, note: recent ? "A financial document was filed in the last 40 days" : "No reconciliation filed in the last 40 days" }; } },

  // K. Compliance
  { id: "compliance-register", category: "Compliance", data: "Mandatory permits, certificates and insurance: verified, on file and not expired", module: "Compliance register, reminders", source: "Issuing agency documents", owner: "Compliance officer (operations head)", frequency: "On change and before expiry", criticality: "CRITICAL", safety: true,
    verify: "Original seen and file attached; verified by a second person", action: "Upload each certificate and verify it",
    measure: (c) => { const m = c.compliance.filter((x) => x.mandatory); const ok = m.filter((x) => x.status === "VERIFIED" && x.documentId && (!x.expiresAt || x.expiresAt > c.now)).length; return { have: ok, of: Math.max(m.length, 1), stale: m.filter((x) => x.expiresAt && x.expiresAt <= c.now).length, note: m.length ? `${ok} of ${m.length} mandatory items verified, on file and current` : "Compliance register is empty" }; } },
  { id: "compliance-rules", category: "Compliance", data: "Which PH rules apply, confirmed by a qualified person", module: "Compliance register", source: "Lawyer, engineer or safety officer", owner: "Compliance officer (operations head)", frequency: "Yearly", criticality: "HIGH",
    verify: "Name of the person who confirmed", action: "Have counsel and the safety officer confirm the default checklist",
    measure: (c) => { const m = c.compliance.filter((x) => x.mandatory); const ok = m.filter((x) => x.ruleConfirmedAt).length; return { have: ok, of: Math.max(m.length, 1), note: `${ok} of ${m.length} rules confirmed by a qualified person` }; } },

  // L. Security
  { id: "security-logs", category: "Security", data: "Guard rounds, visitor logs, incidents", module: "Front desk, guard rounds, SOS", source: "App (guards)", owner: "Security management", frequency: "Each shift", criticality: "HIGH",
    verify: "Manager reviews next morning", action: "Already tracked as a duty with escalation", measure: () => ({ have: 1, of: 1, note: "Captured by guard rounds and front desk; late rounds escalate" }) },
  { id: "drills", category: "Security", data: "Fire and evacuation drill records", module: "Typhoon & safety, compliance", source: "Drill report", owner: "Security management", frequency: "Per drill (at least yearly)", criticality: "HIGH",
    verify: "Signed drill report", action: "Upload the last drill report to Documents (Safety)",
    measure: (c) => { const n = c.docs.filter((d) => d.category === "Safety" && d.createdAt > new Date(c.now.getTime() - 365 * DAY)).length; return { have: n ? 1 : 0, of: 1, note: n ? "Drill record filed this year" : "No drill record in the last 12 months" }; } },

  // M. Service and knowledge
  { id: "kb-policies", category: "Resident service", data: "House rules, policies and FAQs the AI assistant answers from", module: "Helpdesk, Messenger/Viber AI", source: "Board-approved house rules", owner: "Property manager", frequency: "On change", criticality: "HIGH",
    verify: "Board-approved version on file", action: "Upload the approved house rules (Governance)",
    measure: (c) => { const n = docCount(c, ["Governance"]); return { have: n ? 1 : 0, of: 1, note: n ? `${n} governance document(s) on file` : "No house rules uploaded" }; } },
  { id: "owner-contacts", category: "Resident service", data: "Owner contact details (email or mobile) with consent", module: "Resident updates, billing reminders", source: "Owner registration", owner: "Property administration", frequency: "On change", criticality: "MEDIUM",
    verify: "One-time code proves the number or email works", action: "Owners confirm by signing in once",
    measure: (c) => { const ok = c.owners.filter((o) => o.phone || o.email).length; return { have: ok, of: c.owners.length, note: `${ok} of ${c.owners.length} owner logins reachable` }; } },

  // Not yet tracked in the app
  { id: "insurance-building", category: "Compliance", data: "Building insurance policy (fire, all-risk, CGL)", module: "Compliance register", source: "Insurer", owner: "Finance", frequency: "On renewal", criticality: "CRITICAL", verify: "Policy schedule on file", action: "Add as a compliance item with the policy file" },
  { id: "utility-bills", category: "Utilities", data: "Monthly utility bills (Meralco, Maynilad/Manila Water)", module: "Energy & water, billing checks", source: "Utility bills", owner: "Finance", frequency: "Monthly", criticality: "MEDIUM", verify: "Matches meter readings within tolerance", action: "Phase 2: upload bills and match against readings" },
  { id: "capex-plan", category: "Money", data: "Capital expenditure and reserve fund plan", module: "Board reports", source: "Engineer's assessment, board resolution", owner: "Finance with chief engineer", frequency: "Yearly", criticality: "MEDIUM", verify: "Board-approved plan", action: "Phase 2: generate from asset life and replacement cost" },
];

export type RowResult = Requirement & { status: ReqStatus; pct: number | null; m?: Measure };

export function evaluate(c: Ctx): RowResult[] {
  return REQUIREMENTS.map((r) => {
    if (!r.measure) return { ...r, status: "NOT_TRACKED" as const, pct: null };
    const m = r.measure(c);
    const pct = m.of ? Math.round((m.have / m.of) * 100) : 0;
    const status: ReqStatus = m.of === 0 || m.have === 0 ? "MISSING" : m.stale ? "OUTDATED" : pct >= 100 ? "VERIFIED" : "INCOMPLETE";
    return { ...r, status, pct, m };
  });
}

const W: Record<Crit, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export function score(rows: RowResult[]) {
  const t = rows.filter((r) => r.pct != null);
  const total = t.reduce((s, r) => s + W[r.criticality], 0);
  const overall = total ? Math.round(t.reduce((s, r) => s + W[r.criticality] * r.pct!, 0) / total) : 0;
  const safetyGaps = rows.filter((r) => r.safety && r.status !== "VERIFIED");
  const byCat = [...new Set(rows.map((r) => r.category))].map((cat) => {
    const rs = t.filter((r) => r.category === cat); const w = rs.reduce((s, r) => s + W[r.criticality], 0);
    return { cat, pct: w ? Math.round(rs.reduce((s, r) => s + W[r.criticality] * r.pct!, 0) / w) : null, rows: rows.filter((r) => r.category === cat).length, gaps: rows.filter((r) => r.category === cat && r.status !== "VERIFIED" && r.status !== "NOT_TRACKED").length };
  });
  return { overall, safetyGaps, ready: safetyGaps.length === 0, byCat };
}

/** Production targets from the data governance standard. Each value is measured, not estimated. */
export function targets(c: Ctx, openP0: number) {
  const key = c.assets.filter(KEY), safe = c.assets.filter(SAFE);
  const m = c.compliance.filter((x) => x.mandatory);
  const act = c.leases.filter((l) => current(l, c.now));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const unverifiedSafety = safe.filter((a) => !a.verifiedAt).length + m.filter((x) => x.status !== "VERIFIED").length;
  return [
    { k: "Critical asset registry completeness", v: pct(key.filter(specOk).length, key.length), unit: "%", target: 100 },
    { k: "Critical equipment information verified", v: pct(key.filter((a) => a.verifiedAt).length, key.length), unit: "%", target: 100 },
    { k: "Safety-critical maintenance schedule coverage", v: pct(safe.filter((a) => pmFor(c, a.tag).length).length, safe.length), unit: "%", target: 100 },
    { k: "Active lease information complete", v: pct(act.filter((l) => Number(l.rent) > 0 && l.tenantName && l.end > l.start).length, act.length), unit: "%", target: 100 },
    { k: "Mandatory compliance documents accounted for", v: pct(m.filter((x) => x.status === "VERIFIED" && x.documentId && (!x.expiresAt || x.expiresAt > c.now)).length, m.length), unit: "%", target: 100 },
    { k: "Unresolved critical (P0) data defects", v: openP0, unit: "", target: 0 },
    { k: "Safety and compliance records not yet verified", v: unverifiedSafety, unit: "", target: 0 },
  ];
}

export const STATUS_LABEL: Record<ReqStatus, string> = { VERIFIED: "Complete", INCOMPLETE: "Incomplete", MISSING: "Missing", OUTDATED: "Outdated", NOT_TRACKED: "Not tracked yet" };
export const STATUS_CLS: Record<ReqStatus, string> = { VERIFIED: "t-ok", INCOMPLETE: "t-warn", MISSING: "t-bad", OUTDATED: "t-bad", NOT_TRACKED: "t-mut" };
