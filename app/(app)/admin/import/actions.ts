"use server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { normalizePhone } from "@/lib/otp";
import { peso } from "@/lib/format";

export type ImportResult = { error?: string; checked?: boolean; imported?: boolean; rows?: number; units?: { create: number; update: number }; owners?: { create: number; link: number }; balances?: { count: number; total: number }; problems?: string[] };
type Row = { line: number; unit: string; floor: number; sqm: number; ownerName: string; email: string | null; phone: string | null; balance: number; asOf: string };

const REQUIRED = ["unit", "floor", "sqm", "owner_name"];
const MAX_ROWS = 3000;
const prevMonth = () => { const d = new Date(Date.now() + 8 * 3600000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

function validate(text: string): { rows: Row[]; problems: string[] } {
  const all = parseCsv(text);
  const problems: string[] = [];
  if (all.length < 2) return { rows: [], problems: ["The file has no data rows. Use the template and keep the header row."] };
  const head = all[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const miss = REQUIRED.filter((c) => !head.includes(c));
  if (miss.length) return { rows: [], problems: [`Missing column${miss.length > 1 ? "s" : ""}: ${miss.join(", ")}. Use the template's header row.`] };
  if (all.length - 1 > MAX_ROWS) return { rows: [], problems: [`Too many rows (${all.length - 1}). Split the file into parts of ${MAX_ROWS}.`] };
  const col = (r: string[], c: string) => (head.indexOf(c) >= 0 ? r[head.indexOf(c)] ?? "" : "");
  const rows: Row[] = []; const seenUnits = new Set<string>();
  all.slice(1).forEach((r, i) => {
    const line = i + 2; const errs: string[] = [];
    const unit = col(r, "unit").toUpperCase().replace(/\s+/g, "");
    const floor = Number(col(r, "floor")); const sqm = Number(col(r, "sqm").replace(/,/g, ""));
    const ownerName = col(r, "owner_name").replace(/\s+/g, " ");
    const emailRaw = col(r, "owner_email").toLowerCase(); const phoneRaw = col(r, "owner_mobile");
    const balRaw = col(r, "balance_due").replace(/[₱,\s]/g, ""); const balance = balRaw ? Number(balRaw) : 0;
    const asOf = col(r, "balance_as_of") || prevMonth();
    if (!/^[A-Z0-9-]{1,10}$/.test(unit)) errs.push("unit code should be like 1202B (letters, numbers, dash)");
    else if (seenUnits.has(unit)) errs.push(`unit ${unit} appears twice`);
    if (!Number.isInteger(floor) || floor < -5 || floor > 120) errs.push("floor should be a whole number");
    if (!(sqm > 5 && sqm < 2000)) errs.push("sqm should be the floor area, e.g. 48.5");
    if (ownerName.length < 2 || ownerName.length > 80) errs.push("owner_name is missing");
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) errs.push("owner_email doesn't look like an email");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) errs.push("owner_mobile should be a PH mobile number like 0917 123 4567");
    if (!Number.isFinite(balance) || balance < 0 || balance > 10_000_000) errs.push("balance_due should be a peso amount, 0 if paid up");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(asOf)) errs.push("balance_as_of should be a month like 2026-10");
    seenUnits.add(unit);
    if (errs.length) problems.push(`Row ${line}${unit ? ` (${unit})` : ""}: ${errs.join("; ")}.`);
    else rows.push({ line, unit, floor, sqm, ownerName, email: emailRaw || null, phone, balance: Math.round(balance * 100) / 100, asOf });
  });
  return { rows, problems };
}

/** Units, owners and opening balances from the CSV template. "Check" is a dry run; "Import" writes. */
export async function importCsv(_: ImportResult, fd: FormData): Promise<ImportResult> {
  const a = await requireRole("ADMIN");
  const file = fd.get("file");
  const mode = fd.get("mode") === "import" ? "import" : "check";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > 2_000_000) return { error: "That file is over 2 MB. Save it as CSV (not Excel) and try again." };
  if (!/\.csv$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return { error: "Save the sheet as CSV first (File → Download → CSV)." };
  const { rows, problems } = validate(await file.text());
  if (problems.length) return { checked: true, rows: rows.length, problems };

  const [units, users] = await Promise.all([
    prisma.unit.findMany({ where: { buildingId: a.buildingId }, select: { id: true, code: true } }),
    prisma.user.findMany({ where: { email: { in: rows.flatMap((r) => (r.email ? [r.email] : [])) } }, select: { id: true, email: true, role: true } }),
  ]);
  const unitBy = new Map(units.map((u) => [u.code, u.id])); const userBy = new Map(users.map((u) => [u.email, u]));
  const staff = rows.filter((r) => r.email && userBy.get(r.email) && userBy.get(r.email)!.role !== "OWNER");
  if (staff.length) return { checked: true, rows: rows.length, problems: staff.map((r) => `Row ${r.line} (${r.unit}): ${r.email} is a staff or board login. Use the owner's personal email.`) };
  const newEmails = new Set(rows.filter((r) => r.email && !userBy.has(r.email)).map((r) => r.email));
  const summary: ImportResult = {
    rows: rows.length,
    units: { create: rows.filter((r) => !unitBy.has(r.unit)).length, update: rows.filter((r) => unitBy.has(r.unit)).length },
    owners: { create: newEmails.size, link: rows.filter((r) => r.email).length },
    balances: { count: rows.filter((r) => r.balance > 0).length, total: rows.reduce((s, r) => s + r.balance, 0) },
  };
  if (mode === "check") return { ...summary, checked: true };

  const pw = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10); // owners sign in with one-time codes
  await prisma.$transaction(async (tx) => {
    const ownerIds = new Map<string, string>();
    for (const r of rows) {
      let ownerId: string | null = null;
      if (r.email) {
        ownerId = ownerIds.get(r.email) ?? userBy.get(r.email)?.id ?? null;
        if (!ownerId) ownerId = (await tx.user.create({ data: { email: r.email, name: r.ownerName, phone: r.phone, role: "OWNER", passwordHash: pw, buildingId: a.buildingId } })).id;
        else if (r.phone) await tx.user.update({ where: { id: ownerId }, data: { phone: r.phone } });
        ownerIds.set(r.email, ownerId);
      }
      const data = { floor: r.floor, sqm: r.sqm, ownerId, ownerName: r.ownerName };
      const unitId = unitBy.get(r.unit) ?? (await tx.unit.create({ data: { ...data, code: r.unit, buildingId: a.buildingId } })).id;
      if (unitBy.has(r.unit)) await tx.unit.update({ where: { id: unitId }, data });
      if (r.balance > 0) {
        const [y, m] = r.asOf.split("-").map(Number);
        const dueDate = new Date(Date.UTC(y, m, 0, 15, 59)); // end of that month, Manila
        await tx.bill.upsert({ where: { unitId_period: { unitId, period: r.asOf } }, update: { amount: r.balance, paid: 0, status: "UNPAID", dueDate }, create: { unitId, period: r.asOf, amount: r.balance, dueDate } });
      }
    }
  }, { timeout: 120_000, maxWait: 20_000 });
  await audit(a.id, "data_import", `Imported ${rows.length} units (${summary.units!.create} new), ${summary.owners!.create} new owner logins, ${summary.balances!.count} opening balances totalling ${peso(summary.balances!.total)}`);
  revalidatePath("/admin/users");
  return { ...summary, imported: true };
}
