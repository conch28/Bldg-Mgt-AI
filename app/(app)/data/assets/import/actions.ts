"use server";
import { revalidatePath } from "next/cache";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { templateByKey } from "@/lib/templates";

export type AssetImport = { error?: string; checked?: boolean; imported?: boolean; undone?: boolean; rows?: number; create?: number; update?: number; reverify?: number; problems?: string[]; preview?: string[] };
type Row = { line: number; tag: string; name: string; category: string; location: string; criticality: string; installedAt: Date; lifeMonths: number; manufacturer: string | null; model: string | null; serial: string | null; specSource: string | null; warrantyUntil: Date | null; cost: number; replacementCost: number | null; ownerName: string | null; vendor: string | null };

const T = templateByKey("assets")!;
const REQUIRED = T.cols.filter((c) => c.required).map((c) => c.name);
const allowed = (k: string) => T.cols.find((c) => c.name === k)!.allowed!;
const day = (v: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null; const d = new Date(v + "T00:00:00+08:00"); return isNaN(d.getTime()) ? null : d; };

async function validate(text: string): Promise<{ rows: Row[]; problems: string[] }> {
  const all = parseCsv(text); const problems: string[] = [];
  if (all.length < 2) return { rows: [], problems: ["No data rows. Use the template and keep the header row."] };
  const head = all[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const miss = REQUIRED.filter((c) => !head.includes(c));
  if (miss.length) return { rows: [], problems: [`Missing column(s): ${miss.join(", ")}.`] };
  if (all.length > 2001) return { rows: [], problems: ["Over 2,000 rows. Split the file."] };
  const col = (r: string[], c: string) => (head.indexOf(c) >= 0 ? (r[head.indexOf(c)] ?? "").trim() : "");
  const rows: Row[] = []; const tags = new Set<string>(); const serials = new Map<string, string>();
  all.slice(1).forEach((r, i) => {
    const line = i + 2, errs: string[] = [];
    const tag = col(r, "tag").toUpperCase().replace(/\s+/g, "-");
    if (/^EXAMPLE/i.test(col(r, "name")) || /EXAMPLE/i.test(col(r, "manufacturer"))) errs.push("this is the template's EXAMPLE row; delete it");
    if (!/^[A-Z0-9-]{3,30}$/.test(tag)) errs.push("tag should be letters, numbers and dashes"); else if (tags.has(tag)) errs.push(`tag ${tag} appears twice`);
    const category = col(r, "category"), criticality = col(r, "criticality").toUpperCase(), spec = col(r, "spec_source").toUpperCase();
    if (!allowed("category").includes(category)) errs.push(`category must be one of: ${allowed("category").join(", ")}`);
    if (!allowed("criticality").includes(criticality)) errs.push("criticality must be SAFETY, HIGH or NORMAL");
    if (spec && !allowed("spec_source").includes(spec)) errs.push("spec_source must be NAMEPLATE, MANUAL, INVOICE, CONTRACTOR or UNKNOWN");
    const installedAt = day(col(r, "installed")); if (!installedAt) errs.push("installed should be a date like 2013-06-01");
    const lifeMonths = Number(col(r, "life_months")); if (!(Number.isInteger(lifeMonths) && lifeMonths > 0 && lifeMonths < 1200)) errs.push("life_months should be whole months, e.g. 120");
    const w = col(r, "warranty_until"); const warrantyUntil = w ? day(w) : null; if (w && !warrantyUntil) errs.push("warranty_until should be a date");
    const cost = Number(col(r, "cost").replace(/[₱,]/g, "") || 0); if (!(cost >= 0)) errs.push("cost should be pesos");
    const rcRaw = col(r, "replacement_cost").replace(/[₱,]/g, ""); const replacementCost = rcRaw ? Number(rcRaw) : null; if (replacementCost != null && !(replacementCost >= 0)) errs.push("replacement_cost should be pesos");
    const serial = col(r, "serial") || null;
    if (serial) { const k = serial.toUpperCase(); if (serials.has(k)) errs.push(`serial ${serial} also on ${serials.get(k)} in this file`); serials.set(k, tag); }
    const name = col(r, "name"), location = col(r, "location");
    if (!name) errs.push("name is missing"); if (!location) errs.push("location is missing");
    if (criticality === "SAFETY" && !(col(r, "manufacturer") && col(r, "model") && serial)) errs.push("safety-critical equipment needs manufacturer, model and serial");
    tags.add(tag);
    if (errs.length) problems.push(`Row ${line}${tag ? ` (${tag})` : ""}: ${errs.join("; ")}.`);
    else rows.push({ line, tag, name, category, location, criticality, installedAt: installedAt!, lifeMonths, manufacturer: col(r, "manufacturer") || null, model: col(r, "model") || null, serial, specSource: spec || null, warrantyUntil, cost, replacementCost, ownerName: col(r, "owner") || null, vendor: col(r, "vendor") || null });
  });
  if (!problems.length && serials.size) {
    const clash = await prisma.asset.findMany({ where: { serial: { in: [...serials.keys()], mode: "insensitive" } }, select: { tag: true, serial: true } });
    for (const c of clash) { const t = serials.get(c.serial!.toUpperCase()); if (t && t !== c.tag) problems.push(`Serial ${c.serial} is already on ${c.tag} in the registry (file has it on ${t}). Possible duplicate.`); }
  }
  return { rows, problems };
}

const SPEC = ["manufacturer", "model", "serial", "criticality", "lifeMonths"] as const;

export async function importAssets(_: AssetImport, fd: FormData): Promise<AssetImport> {
  const u = await requireRole("MANAGER", "ADMIN");
  if (fd.get("mode") === "undo") return undoLast(u);
  const file = fd.get("file");
  const mode = fd.get("mode") === "import" ? "import" : "check";
  if (!(file instanceof File) || !file.size) return { error: "Choose a CSV file first." };
  if (file.size > 2_000_000) return { error: "Over 2 MB. Save as CSV and try again." };
  const { rows, problems } = await validate(await file.text());
  if (problems.length) return { checked: true, rows: rows.length, problems };
  const existing = await prisma.asset.findMany({ where: { tag: { in: rows.map((r) => r.tag) } } });
  const by = new Map(existing.map((e) => [e.tag, e]));
  const changed = (r: Row) => { const e = by.get(r.tag); return !!e && SPEC.some((k) => String(e[k] ?? "") !== String(r[k] ?? "")); };
  const summary: AssetImport = { rows: rows.length, create: rows.filter((r) => !by.has(r.tag)).length, update: rows.filter((r) => by.has(r.tag)).length, reverify: rows.filter((r) => by.get(r.tag)?.verifiedAt && changed(r)).length,
    preview: rows.slice(0, 5).map((r) => `${by.has(r.tag) ? "Update" : "New"}: ${r.tag} ${r.name}, ${r.location} (${r.criticality.toLowerCase()})`) };
  if (mode === "check") return { ...summary, checked: true };

  // Snapshot what we are about to change so the import can be undone.
  const snap = { at: new Date().toISOString(), by: u.name, created: rows.filter((r) => !by.has(r.tag)).map((r) => r.tag), before: existing };
  const buf = Buffer.from(JSON.stringify(snap));
  const doc = await prisma.document.create({ data: { title: `Asset import ${snap.at.slice(0, 16).replace("T", " ")} (undo snapshot)`, category: "Imports", visibility: "BOARD", fileName: "asset-import-snapshot.json", mime: "application/json", size: buf.length, data: buf, uploadedBy: u.name } });
  await prisma.$transaction(rows.map(({ line: _l, ...r }) => by.has(r.tag)
    ? prisma.asset.update({ where: { tag: r.tag }, data: { ...r, ...(changed({ line: 0, ...r }) ? { verifiedAt: null, verifiedBy: null } : {}) } })
    : prisma.asset.create({ data: r })));
  await audit(u.id, "asset import", `${summary.create} new, ${summary.update} updated (snapshot ${doc.id})`);
  revalidatePath("/data/assets");
  return { ...summary, imported: true };
}

async function undoLast(u: { id: string; name: string }): Promise<AssetImport> {
  const last = await prisma.auditLog.findFirst({ where: { action: { in: ["asset import", "asset import undone"] } }, orderBy: { createdAt: "desc" } });
  const id = last?.action === "asset import" ? last.detail?.match(/snapshot (\w+)/)?.[1] : null;
  if (!id) return { error: "No import to undo (the last one was already undone)." };
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: "The undo snapshot is missing." };
  const snap = JSON.parse(Buffer.from(doc.data).toString()) as { created: string[]; before: any[] };
  const linked = await prisma.asset.findMany({ where: { tag: { in: snap.created }, OR: [{ replacements: { some: {} } }, { sensors: { some: {} } }] }, select: { tag: true } });
  if (linked.length) return { error: `Can't undo: ${linked.map((l) => l.tag).join(", ")} already have repairs or sensor data. Edit them one by one instead.` };
  await prisma.$transaction([
    prisma.pMTask.updateMany({ where: { assetTag: { in: snap.created } }, data: { assetTag: null } }),
    prisma.asset.deleteMany({ where: { tag: { in: snap.created } } }),
    ...snap.before.map(({ id: aid, createdAt: _c, ...b }) => prisma.asset.update({ where: { id: aid }, data: { ...b, installedAt: new Date(b.installedAt), warrantyUntil: b.warrantyUntil ? new Date(b.warrantyUntil) : null, verifiedAt: b.verifiedAt ? new Date(b.verifiedAt) : null } })),
  ]);
  await audit(u.id, "asset import undone", `snapshot ${id}: ${snap.created.length} removed, ${snap.before.length} restored`);
  revalidatePath("/data/assets");
  return { undone: true, create: snap.created.length, update: snap.before.length };
}
