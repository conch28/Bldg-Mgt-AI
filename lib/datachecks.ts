/**
 * Daily data quality checks. Plain rules, no AI: cheaper and more reliable for this job.
 * Each finding becomes a DataIssue (P0 critical … P3 low). syncIssues() opens new ones, refreshes
 * existing ones and closes those whose condition is gone, recording that as the evidence.
 * A person can close an issue only with written evidence; a check can reopen it after 30 days.
 */
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { loadCtx, type Ctx } from "./readiness";
import { requiredKinds, CRED_KINDS } from "./vetting";
import { fmtDate } from "./format";
import { notifyUser } from "./comms";

export type Sev = "P0" | "P1" | "P2" | "P3";
export type Finding = { checkId: string; entityKey: string; severity: Sev; title: string; detail: string; ownerRole: Role; href: string };
export const SEV_LABEL: Record<Sev, string> = { P0: "P0 Critical", P1: "P1 High", P2: "P2 Medium", P3: "P3 Low" };
export const SEV_CLS: Record<Sev, string> = { P0: "t-bad", P1: "t-warn", P2: "t-acc", P3: "t-mut" };
export const SEV_HELP: Record<Sev, string> = {
  P0: "Immediate safety, financial or operational risk", P1: "Material operations or compliance risk",
  P2: "Needs timely correction", P3: "Non-critical improvement",
};

const DAY = 86400000;
/** Every check, so the docs and the page can list them. */
export const CHECKS: { id: string; severity: Sev | string; rule: string }[] = [
  { id: "asset-safety-no-pm", severity: "P0", rule: "Safety-critical asset has no preventive maintenance schedule" },
  { id: "pm-safety-overdue", severity: "P0", rule: "Safety or statutory maintenance task is overdue" },
  { id: "compliance-expired", severity: "P0", rule: "Mandatory permit, certificate or policy has expired" },
  { id: "paid-no-receipt", severity: "P0", rule: "Purchase marked paid with no receipt photo" },
  { id: "compliance-unverified", severity: "P1", rule: "Mandatory compliance item not verified or no file attached" },
  { id: "compliance-expiring", severity: "P1", rule: "Mandatory item expires within 45 days" },
  { id: "pm-interval-unverified", severity: "P1", rule: "Safety maintenance interval has no verified source (manufacturer, statute, engineer)" },
  { id: "asset-unverified", severity: "P1", rule: "Safety or high-criticality asset specs not verified by a person" },
  { id: "vendor-unvetted", severity: "P1", rule: "Active contractor missing verified required credentials" },
  { id: "vendor-insurance", severity: "P1", rule: "Active contractor insurance expired or missing" },
  { id: "lease-overlap", severity: "P1", rule: "Two leases on the same unit overlap, or a lease ends before it starts" },
  { id: "payment-duplicate", severity: "P1", rule: "Two payments to the same vendor for the same amount within 30 days" },
  { id: "compliance-rule-unconfirmed", severity: "P2", rule: "Default PH rule not yet confirmed by a qualified person" },
  { id: "asset-incomplete", severity: "P2/P3", rule: "Asset missing make, model or serial (P2 for key assets, P3 grouped for others)" },
  { id: "asset-duplicate", severity: "P2", rule: "Two assets share a serial number" },
  { id: "asset-past-life", severity: "P2/P3", rule: "Asset past its expected life with no replacement planned" },
  { id: "meter-missing", severity: "P2", rule: "No main meter reading in 36 hours" },
  { id: "unit-incomplete", severity: "P2", rule: "Units with no floor area or no owner on record (grouped)" },
];

export function runChecks(c: Ctx, paid: { id: string; number: number; title: string; paidAt: Date | null; receiptPic: string | null; invoiceTotal: unknown; vendor: string | null }[]): Finding[] {
  const out: Finding[] = [];
  const add = (f: Finding) => out.push(f);
  const now = c.now;
  const safeTags = new Set(c.assets.filter((a) => a.criticality === "SAFETY").map((a) => a.tag));

  for (const a of c.assets) {
    const key = a.criticality === "SAFETY" || a.criticality === "HIGH";
    const href = `/data/assets/${encodeURIComponent(a.tag)}`;
    if (a.criticality === "SAFETY" && !c.pm.some((p) => p.assetTag === a.tag))
      add({ checkId: "asset-safety-no-pm", entityKey: `asset:${a.tag}`, severity: "P0", title: `${a.name} has no maintenance schedule`, detail: `${a.tag} is safety-critical but no preventive maintenance task is linked to it.`, ownerRole: "MANAGER", href });
    if (key && !a.verifiedAt)
      add({ checkId: "asset-unverified", entityKey: `asset:${a.tag}`, severity: "P1", title: `${a.name}: specs not verified`, detail: `Check the nameplate against the record and tap Verify on ${a.tag}.`, ownerRole: "MANAGER", href });
    if (key && !(a.manufacturer && a.model && a.serial))
      add({ checkId: "asset-incomplete", entityKey: `asset:${a.tag}`, severity: "P2", title: `${a.name}: make, model or serial missing`, detail: `Missing: ${[!a.manufacturer && "manufacturer", !a.model && "model", !a.serial && "serial"].filter(Boolean).join(", ")}. Photograph the nameplate.`, ownerRole: "MANAGER", href });
    const end = new Date(a.installedAt.getTime() + a.lifeMonths * 30.44 * DAY);
    if (key && a.status !== "RETIRED" && end < now)
      add({ checkId: "asset-past-life", entityKey: `asset:${a.tag}`, severity: "P2", title: `${a.name} is past its expected life`, detail: `Expected life ended ${fmtDate(end)}. Add a replacement cost and plan it in the reserve fund.`, ownerRole: "MANAGER", href });
  }
  const minor = c.assets.filter((a) => a.criticality === "NORMAL");
  const minorInc = minor.filter((a) => !(a.manufacturer && a.model));
  if (minorInc.length) add({ checkId: "asset-incomplete", entityKey: "assets:normal", severity: "P3", title: `${minorInc.length} other assets missing make or model`, detail: `For example ${minorInc.slice(0, 3).map((a) => a.tag).join(", ")}. Fill in when next serviced.`, ownerRole: "MANAGER", href: "/data/assets?f=incomplete" });
  const minorOld = minor.filter((a) => a.status !== "RETIRED" && a.installedAt.getTime() + a.lifeMonths * 30.44 * DAY < now.getTime());
  if (minorOld.length) add({ checkId: "asset-past-life", entityKey: "assets:normal", severity: "P3", title: `${minorOld.length} minor assets past expected life`, detail: `For example ${minorOld.slice(0, 3).map((a) => a.tag).join(", ")}. Group them into one replacement project.`, ownerRole: "MANAGER", href: "/data/assets?f=old" });
  const bySerial = new Map<string, string[]>();
  for (const a of c.assets) if (a.serial) bySerial.set(a.serial.toUpperCase(), [...(bySerial.get(a.serial.toUpperCase()) ?? []), a.tag]);
  for (const [serial, tags] of bySerial) if (tags.length > 1)
    add({ checkId: "asset-duplicate", entityKey: `serial:${serial}`, severity: "P2", title: `Possible duplicate asset (serial ${serial})`, detail: `${tags.join(" and ")} share a serial number. Retire the duplicate or correct the serial.`, ownerRole: "MANAGER", href: "/data/assets" });

  for (const p of c.pm) {
    const safety = p.compliance || (p.assetTag && safeTags.has(p.assetTag));
    if (safety && p.nextDue < now)
      add({ checkId: "pm-safety-overdue", entityKey: `pm:${p.id}`, severity: "P0", title: `Overdue: ${p.asset}, ${p.task}`, detail: `Was due ${fmtDate(p.nextDue)}${p.vendor ? ` (${p.vendor})` : ""}. Do it or record why it moved.`, ownerRole: "MANAGER", href: "/maintenance" });
    if (safety && p.intervalSource === "UNVERIFIED")
      add({ checkId: "pm-interval-unverified", entityKey: `pm:${p.id}`, severity: "P1", title: `Interval not verified: ${p.asset}, ${p.task}`, detail: `Every ${p.frequencyDays} days, but nobody recorded whether this comes from the manual, a regulation or an engineer.`, ownerRole: "MANAGER", href: p.assetTag ? `/data/assets/${encodeURIComponent(p.assetTag)}` : "/maintenance" });
  }

  for (const x of c.compliance.filter((i) => i.mandatory)) {
    const href = `/data/compliance#c-${x.id}`;
    if (x.expiresAt && x.expiresAt < now)
      add({ checkId: "compliance-expired", entityKey: `comp:${x.id}`, severity: "P0", title: `Expired: ${x.title}`, detail: `${x.authority}. Expired ${fmtDate(x.expiresAt)}. ${x.renewal ?? "Start the renewal now."}`, ownerRole: "ADMIN", href });
    else if (x.expiresAt && x.expiresAt < new Date(now.getTime() + 45 * DAY))
      add({ checkId: "compliance-expiring", entityKey: `comp:${x.id}`, severity: "P1", title: `Expiring: ${x.title}`, detail: `${x.authority}. Expires ${fmtDate(x.expiresAt)}. ${x.renewal ?? ""}`.trim(), ownerRole: "ADMIN", href });
    if (x.status !== "VERIFIED" || !x.documentId)
      add({ checkId: "compliance-unverified", entityKey: `comp:${x.id}`, severity: "P1", title: `${x.title}: ${!x.documentId ? "no file on record" : "not verified"}`, detail: !x.documentId ? "Upload a scan of the certificate, then have a second person verify it." : "A second person must check the original and tap Verify.", ownerRole: "ADMIN", href });
    if (!x.ruleConfirmedAt)
      add({ checkId: "compliance-rule-unconfirmed", entityKey: `comp:${x.id}`, severity: "P2", title: `Rule not confirmed: ${x.title}`, detail: "This is on the default Philippine checklist. Have counsel, the engineer or the safety officer confirm it applies to this building.", ownerRole: "ADMIN", href });
  }

  for (const v of c.vendors) {
    const href = `/data/contractors#v-${v.id}`;
    const missing = requiredKinds(v.service).filter((k) => !c.creds.some((x) => x.vendorId === v.id && x.kind === k && x.status === "VERIFIED" && (!x.expiresAt || x.expiresAt > now)));
    if (missing.length)
      add({ checkId: "vendor-unvetted", entityKey: `vendor:${v.id}`, severity: "P1", title: `${v.name} not fully vetted`, detail: `Missing or unverified: ${missing.map((k) => CRED_KINDS[k].label).join(", ")}.`, ownerRole: "ADMIN", href });
    if (!v.insuranceExpiry || v.insuranceExpiry < now)
      add({ checkId: "vendor-insurance", entityKey: `vendor:${v.id}`, severity: "P1", title: `${v.name}: insurance ${v.insuranceExpiry ? "expired" : "missing"}`, detail: v.insuranceExpiry ? `Expired ${fmtDate(v.insuranceExpiry)}. No new jobs until a current certificate is on file.` : "No insurance certificate on record.", ownerRole: "ADMIN", href });
  }

  for (const a of c.leases) {
    if (a.end <= a.start) add({ checkId: "lease-overlap", entityKey: `lease:${a.id}`, severity: "P1", title: `Lease for ${a.tenantName} ends before it starts`, detail: `${fmtDate(a.start)} to ${fmtDate(a.end)}. Correct the dates from the contract.`, ownerRole: "MANAGER", href: "/listings" });
    for (const b of c.leases) if (a.id < b.id && a.unitId === b.unitId && a.start < b.end && b.start < a.end) {
      const unit = c.units.find((u) => u.id === a.unitId)?.code ?? "";
      add({ checkId: "lease-overlap", entityKey: `lease:${a.id}:${b.id}`, severity: "P1", title: `Overlapping leases on unit ${unit}`, detail: `${a.tenantName} (${fmtDate(a.start)} to ${fmtDate(a.end)}) and ${b.tenantName} (${fmtDate(b.start)} to ${fmtDate(b.end)}).`, ownerRole: "MANAGER", href: "/listings" });
    }
  }

  for (const m of ["WATER_MAIN", "ELECTRIC_MAIN"]) if (!c.meters.some((r) => r.meter === m && r.takenAt > new Date(now.getTime() - 1.5 * DAY)))
    add({ checkId: "meter-missing", entityKey: `meter:${m}`, severity: "P2", title: `No ${m === "WATER_MAIN" ? "water" : "electric"} meter reading in 36 hours`, detail: "Leak and spike alerts need a daily reading. Guards enter it on the round.", ownerRole: "GUARD", href: "/rounds" });

  const noArea = c.units.filter((u) => !(Number(u.sqm) > 0)), noOwner = c.units.filter((u) => !u.ownerId && !u.ownerName);
  if (noArea.length) add({ checkId: "unit-incomplete", entityKey: "units:sqm", severity: "P2", title: `${noArea.length} units have no floor area`, detail: "Dues and voting weights depend on floor area. Copy it from the master deed.", ownerRole: "ADMIN", href: "/admin/import" });
  if (noOwner.length) add({ checkId: "unit-incomplete", entityKey: "units:owner", severity: "P2", title: `${noOwner.length} units have no owner on record`, detail: `For example ${noOwner.slice(0, 4).map((u) => u.code).join(", ")}.`, ownerRole: "ADMIN", href: "/admin/import" });

  for (const p of paid) if (!p.receiptPic)
    add({ checkId: "paid-no-receipt", entityKey: `pr:${p.number}`, severity: "P0", title: `PR #${p.number} paid without a receipt`, detail: `${p.title}. Attach the official receipt or reverse the payment.`, ownerRole: "ADMIN", href: "/procurement" });
  for (let i = 0; i < paid.length; i++) for (let j = i + 1; j < paid.length; j++) {
    const a = paid[i], b = paid[j];
    if (a.vendor && a.vendor === b.vendor && a.invoiceTotal != null && String(a.invoiceTotal) === String(b.invoiceTotal) && a.paidAt && b.paidAt && Math.abs(a.paidAt.getTime() - b.paidAt.getTime()) < 30 * DAY)
      add({ checkId: "payment-duplicate", entityKey: `pr:${Math.min(a.number, b.number)}:${Math.max(a.number, b.number)}`, severity: "P1", title: `Possible duplicate payment to ${a.vendor}`, detail: `PR #${a.number} and #${b.number}, same amount, paid within 30 days. Confirm they are separate deliveries.`, ownerRole: "ADMIN", href: "/procurement" });
  }
  return out;
}

async function paidRequests() {
  const rows = await prisma.purchaseRequest.findMany({ where: { status: "PAID" }, select: { id: true, number: true, title: true, paidAt: true, receiptPic: true, invoiceTotal: true, chosenQuote: true, quotes: { select: { id: true, vendor: true } } } });
  return rows.map((r) => ({ ...r, vendor: r.quotes.find((q) => q.id === r.chosenQuote)?.vendor ?? null }));
}

/** Runs every check and brings DataIssue up to date. Returns the open issues, worst first. */
export async function syncIssues(buildingId: string, opts: { notify?: boolean; ctx?: Ctx } = {}) {
  const c = opts.ctx ?? await loadCtx(buildingId);
  const found = runChecks(c, await paidRequests());
  const existing = await prisma.dataIssue.findMany({ where: { buildingId } });
  const byKey = new Map(existing.map((e) => [`${e.checkId}|${e.entityKey}`, e]));
  const seen = new Set<string>();
  const fresh: Finding[] = [];
  for (const f of found) {
    const k = `${f.checkId}|${f.entityKey}`; if (seen.has(k)) continue; seen.add(k);
    const e = byKey.get(k);
    if (!e) { await prisma.dataIssue.create({ data: { buildingId, ...f } }); fresh.push(f); continue; }
    const acceptedByPerson = e.status === "RESOLVED" && e.resolvedBy !== "Data checks" && e.resolvedAt && e.resolvedAt > new Date(c.now.getTime() - 30 * DAY);
    if (acceptedByPerson) continue;
    await prisma.dataIssue.update({ where: { id: e.id }, data: { severity: f.severity, title: f.title, detail: f.detail, ownerRole: f.ownerRole, href: f.href, lastSeen: c.now, ...(e.status === "RESOLVED" ? { status: "OPEN", resolvedAt: null, resolvedBy: null, evidence: null, firstSeen: c.now } : {}) } });
    if (e.status === "RESOLVED") fresh.push(f);
  }
  const gone = existing.filter((e) => e.status === "OPEN" && !seen.has(`${e.checkId}|${e.entityKey}`));
  if (gone.length) await prisma.dataIssue.updateMany({ where: { id: { in: gone.map((g) => g.id) } }, data: { status: "RESOLVED", resolvedAt: c.now, resolvedBy: "Data checks", evidence: `Check passed on ${fmtDate(c.now)}: the condition is no longer present in the records.` } });

  let notified = 0;
  if (opts.notify) {
    const urgent = await prisma.dataIssue.findMany({ where: { buildingId, status: "OPEN", severity: { in: ["P0", "P1"] }, notifiedAt: null } });
    const roles = [...new Set(urgent.map((u) => u.ownerRole))] as Role[];
    const people = await prisma.user.findMany({ where: { buildingId, active: true, role: { in: roles } }, select: { id: true, role: true } });
    for (const role of roles) {
      const mine = urgent.filter((u) => u.ownerRole === role);
      const p0 = mine.filter((u) => u.severity === "P0").length;
      const body = `${mine.length} data issue${mine.length > 1 ? "s" : ""} need you${p0 ? ` (${p0} critical)` : ""}: ${mine.slice(0, 3).map((u) => u.title).join("; ")}${mine.length > 3 ? "…" : ""}. Open the Data Center to fix them.`;
      for (const p of people.filter((x) => x.role === role)) { await notifyUser(p.id, "Data issues to fix", body, p0 ? ["APP", "SMS"] : ["APP"]); notified++; }
    }
    if (urgent.length) await prisma.dataIssue.updateMany({ where: { id: { in: urgent.map((u) => u.id) } }, data: { notifiedAt: c.now } });
  }
  const open = await prisma.dataIssue.findMany({ where: { buildingId, status: "OPEN" }, orderBy: [{ severity: "asc" }, { firstSeen: "asc" }] });
  return { open, opened: fresh.length, closed: gone.length, notified };
}

/** Cron entry point: every building, with notifications. */
export async function runDataChecks() {
  const buildings = await prisma.building.findMany({ select: { id: true } });
  let open = 0, opened = 0, closed = 0, notified = 0;
  for (const b of buildings) { const r = await syncIssues(b.id, { notify: true }); open += r.open.length; opened += r.opened; closed += r.closed; notified += r.notified; }
  return { open, opened, closed, notified };
}
