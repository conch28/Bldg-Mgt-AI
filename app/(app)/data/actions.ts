"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/files";
import { syncIssues } from "@/lib/datachecks";
import { REQUIREMENTS } from "@/lib/readiness";
import { CRED_KINDS } from "@/lib/vetting";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => s(fd, k) || null;
const date = (fd: FormData, k: string) => { const v = s(fd, k); if (!v) return null; const d = new Date(v + "T00:00:00+08:00"); return isNaN(d.getTime()) ? null : d; };
const back = (path: string, kind: "ok" | "error", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

/* ---------- Issues and register ---------- */

export async function resolveIssue(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const evidence = s(fd, "evidence");
  if (evidence.length < 10) back("/data", "error", "Write what was done or checked (at least a sentence). An issue is never closed without evidence.");
  const i = await prisma.dataIssue.findFirst({ where: { id: s(fd, "id"), buildingId: u.buildingId } });
  if (!i) back("/data", "error", "Issue not found.");
  await prisma.dataIssue.update({ where: { id: i!.id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: u.name, evidence } });
  await audit(u.id, "data issue resolved", `${i!.severity} ${i!.title}: ${evidence}`);
  revalidatePath("/data");
  back("/data", "ok", "Closed with your evidence. If the records still show the problem in 30 days, the check will reopen it.");
}

export async function runChecksNow() {
  const u = await requireRole("MANAGER", "ADMIN");
  const r = await syncIssues(u.buildingId, { notify: false });
  await audit(u.id, "data checks run", `${r.open.length} open, ${r.opened} new, ${r.closed} closed`);
  revalidatePath("/data");
  back("/data", "ok", `Checks done: ${r.opened} new, ${r.closed} closed automatically, ${r.open.length} open.`);
}

export async function signoff(fd: FormData) {
  const u = await requireRole("BOARD", "ADMIN");
  const req = REQUIREMENTS.find((r) => r.id === s(fd, "reqId"));
  const ownerName = s(fd, "ownerName");
  if (!req) back("/data/register", "error", "Unknown requirement.");
  if (ownerName.length < 2) back("/data/register", "error", "Name the person who owns this data.");
  await prisma.readinessSignoff.upsert({ where: { buildingId_reqId: { buildingId: u.buildingId, reqId: req!.id } }, update: { ownerName, approvedBy: u.name, approvedAt: new Date(), note: opt(fd, "note") }, create: { buildingId: u.buildingId, reqId: req!.id, ownerName, approvedBy: u.name, note: opt(fd, "note") } });
  await audit(u.id, "data owner confirmed", `${req!.data}: ${ownerName}`);
  revalidatePath("/data/register");
  back("/data/register", "ok", `Owner confirmed: ${ownerName}.`);
}

/* ---------- Assets ---------- */

const CRIT = ["SAFETY", "HIGH", "NORMAL"];
const SPEC_SOURCES = ["NAMEPLATE", "MANUAL", "INVOICE", "CONTRACTOR", "UNKNOWN"];
export async function saveAsset(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = s(fd, "id");
  const tag = s(fd, "tag").toUpperCase().replace(/\s+/g, "-");
  const path = id ? `/data/assets/${encodeURIComponent(tag)}` : "/data/assets";
  if (!/^[A-Z0-9-]{3,30}$/.test(tag)) back(path, "error", "Tag should be letters, numbers and dashes, e.g. EL-GEN-1.");
  const name = s(fd, "name"), category = s(fd, "category"), location = s(fd, "location");
  if (!name || !category || !location) back(path, "error", "Name, category and location are required.");
  const installedAt = date(fd, "installedAt"); if (!installedAt) back(path, "error", "Install date is required (estimate from turnover if unknown, and note it).");
  const lifeMonths = Number(s(fd, "lifeMonths")); if (!(lifeMonths > 0 && lifeMonths < 1200)) back(path, "error", "Expected life is in months, e.g. 120.");
  const cost = Number(s(fd, "cost") || 0); if (!(cost >= 0)) back(path, "error", "Acquisition cost should be a peso amount.");
  const rc = s(fd, "replacementCost"); const replacementCost = rc ? Number(rc) : null;
  if (replacementCost != null && !(replacementCost >= 0)) back(path, "error", "Replacement cost should be a peso amount.");
  const criticality = CRIT.includes(s(fd, "criticality")) ? s(fd, "criticality") : "NORMAL";
  const specSource = SPEC_SOURCES.includes(s(fd, "specSource")) ? s(fd, "specSource") : null;
  const serial = opt(fd, "serial");
  if (serial) {
    const dup = await prisma.asset.findFirst({ where: { serial: { equals: serial, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { tag: true } });
    if (dup) back(path, "error", `Serial ${serial} is already on ${dup.tag}. Check for a duplicate before saving.`);
  }
  const data = { tag, name, category, location, installedAt: installedAt!, lifeMonths, cost, replacementCost, criticality, specSource, serial, manufacturer: opt(fd, "manufacturer"), model: opt(fd, "model"), ownerName: opt(fd, "ownerName"), vendor: opt(fd, "vendor"), warrantyUntil: date(fd, "warrantyUntil") };
  if (id) {
    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) back("/data/assets", "error", "Asset not found.");
    const specChanged = (["manufacturer", "model", "serial", "criticality", "lifeMonths"] as const).some((k) => String(before![k] ?? "") !== String((data as any)[k] ?? ""));
    await prisma.asset.update({ where: { id }, data: { ...data, ...(specChanged ? { verifiedAt: null, verifiedBy: null } : {}) } });
    await audit(u.id, "asset updated", `${tag}${specChanged ? " (specs changed: needs verification again)" : ""}`);
    revalidatePath(path);
    back(path, "ok", specChanged ? "Saved. Specs changed, so a second person needs to verify them again." : "Saved.");
  }
  if (await prisma.asset.findUnique({ where: { tag } })) back(path, "error", `Tag ${tag} already exists.`);
  await prisma.asset.create({ data });
  await audit(u.id, "asset added", `${tag} ${name}`);
  revalidatePath("/data/assets");
  redirect(`/data/assets/${encodeURIComponent(tag)}?ok=${encodeURIComponent("Asset added. Print its QR label from the asset list.")}`);
}

export async function verifyAsset(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const a = await prisma.asset.findUnique({ where: { id: s(fd, "id") } });
  if (!a) back("/data/assets", "error", "Asset not found.");
  const path = `/data/assets/${encodeURIComponent(a!.tag)}`;
  if (!(a!.manufacturer && a!.model && a!.serial)) back(path, "error", "Fill in manufacturer, model and serial before verifying.");
  if (!a!.specSource || a!.specSource === "UNKNOWN") back(path, "error", "Say where the specs come from (nameplate, manual, invoice or contractor) before verifying.");
  const last = await prisma.auditLog.findFirst({ where: { action: { in: ["asset updated", "asset added"] }, detail: { startsWith: a!.tag } }, orderBy: { createdAt: "desc" } });
  if (last?.userId === u.id) back(path, "error", "You made the last change to this asset. Someone else must verify it.");
  await prisma.asset.update({ where: { id: a!.id }, data: { verifiedAt: new Date(), verifiedBy: u.name } });
  await audit(u.id, "asset verified", `${a!.tag} against ${a!.specSource}`);
  revalidatePath(path);
  back(path, "ok", "Specs verified.");
}

const SOURCES = ["MANUFACTURER", "STATUTORY", "ENGINEER", "CONTRACT", "UNVERIFIED"];
export async function savePm(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const tag = s(fd, "assetTag");
  const path = `/data/assets/${encodeURIComponent(tag)}`;
  const a = await prisma.asset.findUnique({ where: { tag } });
  if (!a) back("/data/assets", "error", "Asset not found.");
  const intervalSource = SOURCES.includes(s(fd, "intervalSource")) ? s(fd, "intervalSource") : "UNVERIFIED";
  const pmId = s(fd, "pmId");
  if (pmId) {
    await prisma.pMTask.update({ where: { id: pmId }, data: { assetTag: tag, intervalSource } });
    await audit(u.id, "maintenance schedule linked", `${tag}: ${intervalSource}`);
  } else {
    const task = s(fd, "task"); const frequencyDays = Number(s(fd, "frequencyDays"));
    if (!task || !(frequencyDays > 0)) back(path, "error", "Pick an existing schedule, or give a task and an interval in days.");
    if (a!.criticality === "SAFETY" && intervalSource === "UNVERIFIED") back(path, "error", "This is safety-critical equipment. Take the interval from the manual, a regulation or an engineer, and say which. We never guess it.");
    await prisma.pMTask.create({ data: { asset: a!.name, assetTag: tag, task, frequencyDays, nextDue: date(fd, "nextDue") ?? new Date(Date.now() + frequencyDays * 86400000), vendor: opt(fd, "vendor"), compliance: a!.criticality === "SAFETY", intervalSource } });
    await audit(u.id, "maintenance schedule added", `${tag}: ${task} every ${frequencyDays} days (${intervalSource})`);
  }
  revalidatePath(path);
  back(path, "ok", "Maintenance schedule saved.");
}

export async function attachManual(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const a = await prisma.asset.findUnique({ where: { id: s(fd, "id") } });
  if (!a) back("/data/assets", "error", "Asset not found.");
  const path = `/data/assets/${encodeURIComponent(a!.tag)}`;
  const up = await saveUpload(fd.get("file"), `Manual: ${a!.name} (${a!.tag})`, "Manuals", u.name);
  if (up.error) back(path, "error", up.error);
  if (!up.id) back(path, "error", "Choose a file.");
  await prisma.asset.update({ where: { id: a!.id }, data: { manualDocId: up.id } });
  await audit(u.id, "asset manual attached", a!.tag);
  revalidatePath(path);
  back(path, "ok", "Manual attached.");
}

export async function reportFault(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "GUARD");
  const a = await prisma.asset.findUnique({ where: { id: s(fd, "id") } });
  if (!a) back("/data/assets", "error", "Asset not found.");
  const note = s(fd, "note");
  const safety = a!.criticality === "SAFETY";
  const wo = await prisma.workOrder.create({ data: { title: `${a!.name} (${a!.tag}): fault reported`, description: note || "Reported from the asset QR page.", category: a!.category, priority: safety ? "HIGH" : "MEDIUM", slaHours: safety ? 4 : 24, location: a!.location, source: "Asset QR", status: "NEW", reporterId: u.id } });
  await prisma.asset.update({ where: { id: a!.id }, data: { status: "FAULTY" } });
  await audit(u.id, "work order created", `#${wo.number} from asset ${a!.tag}`);
  revalidatePath(`/data/assets/${encodeURIComponent(a!.tag)}`);
  back(`/data/assets/${encodeURIComponent(a!.tag)}`, "ok", `Work order #${wo.number} opened${safety ? " as high priority" : ""}.`);
}

/* ---------- Compliance ---------- */

const KINDS = ["PERMIT", "CERTIFICATE", "INSURANCE", "PLAN", "PRIVACY", "OTHER"];
export async function saveCompliance(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const id = s(fd, "id");
  const title = s(fd, "title"), authority = s(fd, "authority");
  if (!title || !authority) back("/data/compliance", "error", "Title and issuing authority are required.");
  const issuedAt = date(fd, "issuedAt"), expiresAt = date(fd, "expiresAt");
  if (issuedAt && expiresAt && expiresAt <= issuedAt) back("/data/compliance", "error", "Expiry must be after the issue date.");
  const up = await saveUpload(fd.get("file"), `Compliance: ${title}`, "Compliance", u.name);
  if (up.error) back("/data/compliance", "error", up.error);
  const data = { title, authority, kind: KINDS.includes(s(fd, "kind")) ? s(fd, "kind") : "OTHER", docNumber: opt(fd, "docNumber"), issuedAt, expiresAt, renewal: opt(fd, "renewal"), ownerName: opt(fd, "ownerName"), note: opt(fd, "note"), mandatory: fd.get("mandatory") === "on", ...(up.id ? { documentId: up.id } : {}) };
  if (id) {
    const x = await prisma.complianceItem.findFirst({ where: { id, buildingId: u.buildingId } });
    if (!x) back("/data/compliance", "error", "Item not found.");
    // any change to the facts needs a fresh check by someone else
    await prisma.complianceItem.update({ where: { id }, data: { ...data, status: "PENDING", verifiedAt: null, verifiedBy: null, enteredBy: u.name } });
    await audit(u.id, "compliance item updated", `${title} (needs verification)`);
  } else {
    await prisma.complianceItem.create({ data: { ...data, buildingId: u.buildingId, enteredBy: u.name } });
    await audit(u.id, "compliance item added", title);
  }
  revalidatePath("/data/compliance");
  back("/data/compliance", "ok", "Saved. A second person now checks the original and taps Verify.");
}

export async function verifyCompliance(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const x = await prisma.complianceItem.findFirst({ where: { id: s(fd, "id"), buildingId: u.buildingId } });
  if (!x) back("/data/compliance", "error", "Item not found.");
  if (x!.enteredBy === u.name) back("/data/compliance", "error", "You entered this item. Someone else must verify it.");
  if (!x!.documentId) back("/data/compliance", "error", "Attach the scanned certificate first. We verify against the document, not memory.");
  const verdict = s(fd, "verdict") === "reject" ? "REJECTED" : "VERIFIED";
  await prisma.complianceItem.update({ where: { id: x!.id }, data: { status: verdict, verifiedAt: new Date(), verifiedBy: u.name, ...(verdict === "REJECTED" ? { note: opt(fd, "note") ?? x!.note } : {}) } });
  await audit(u.id, `compliance item ${verdict.toLowerCase()}`, x!.title);
  revalidatePath("/data/compliance");
  back("/data/compliance", "ok", verdict === "VERIFIED" ? `Verified: ${x!.title}.` : `Rejected: ${x!.title}. The owner has been asked to fix it.`);
}

export async function confirmRule(fd: FormData) {
  const u = await requireRole("ADMIN", "BOARD");
  const who = s(fd, "who");
  if (who.length < 3) back("/data/compliance", "error", "Name the qualified person who confirmed it (e.g. Atty. Reyes, counsel).");
  const x = await prisma.complianceItem.findFirst({ where: { id: s(fd, "id"), buildingId: u.buildingId } });
  if (!x) back("/data/compliance", "error", "Item not found.");
  await prisma.complianceItem.update({ where: { id: x!.id }, data: { ruleConfirmedBy: who, ruleConfirmedAt: new Date() } });
  await audit(u.id, "compliance rule confirmed", `${x!.title} by ${who}`);
  revalidatePath("/data/compliance");
  back("/data/compliance", "ok", `Recorded: ${who} confirmed this rule applies.`);
}

/* ---------- Contractors ---------- */

export async function addCredential(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const vendorId = s(fd, "vendorId"), kind = s(fd, "kind");
  const path = `/data/contractors#v-${vendorId}`;
  const v = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!v || !CRED_KINDS[kind]) back("/data/contractors", "error", "Pick a contractor and a document type.");
  const expiresAt = date(fd, "expiresAt");
  if (CRED_KINDS[kind].expires && !expiresAt) back("/data/contractors", "error", `${CRED_KINDS[kind].label} has an expiry date. Enter it.`);
  const up = await saveUpload(fd.get("file"), `${v!.name}: ${CRED_KINDS[kind].label}`, "Contracts", u.name);
  if (up.error) back("/data/contractors", "error", up.error);
  await prisma.vendorCredential.create({ data: { vendorId, kind, number: opt(fd, "number"), issuer: opt(fd, "issuer") ?? CRED_KINDS[kind].issuer, expiresAt, documentId: up.id ?? null, enteredBy: u.name, note: opt(fd, "note") } });
  if (kind === "INSURANCE" && expiresAt) await prisma.vendor.update({ where: { id: vendorId }, data: { insuranceExpiry: expiresAt } });
  await audit(u.id, "contractor credential added", `${v!.name}: ${kind}`);
  revalidatePath("/data/contractors");
  redirect(`/data/contractors?ok=${encodeURIComponent("Added. Someone else checks it with the issuer and taps Verify.")}${path.slice(path.indexOf("#"))}`);
}

export async function verifyCredential(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const c = await prisma.vendorCredential.findUnique({ where: { id: s(fd, "id") } });
  if (!c) back("/data/contractors", "error", "Not found.");
  if (c!.enteredBy === u.name) back("/data/contractors", "error", "You entered this document. Someone else must verify it.");
  if (!c!.documentId && c!.kind !== "REFERENCE") back("/data/contractors", "error", "Attach a copy of the document first.");
  const verdict = s(fd, "verdict") === "reject" ? "REJECTED" : "VERIFIED";
  await prisma.vendorCredential.update({ where: { id: c!.id }, data: { status: verdict, verifiedBy: u.name, verifiedAt: new Date() } });
  await audit(u.id, `contractor credential ${verdict.toLowerCase()}`, `${c!.kind} ${c!.number ?? ""}`);
  revalidatePath("/data/contractors");
  back("/data/contractors", "ok", verdict === "VERIFIED" ? "Verified." : "Rejected. Ask the contractor for a valid copy.");
}
