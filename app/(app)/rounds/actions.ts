"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";
import { CHECKPOINTS, ISSUES, METERS, SLA_HOURS, shiftOf } from "@/lib/rounds";
import { isUnitCode } from "@/lib/skyland";
import { photoOk } from "@/lib/image";
import { notifyUser } from "@/lib/comms";
import { rateLimit } from "@/lib/ratelimit";

const STAFF = ["GUARD", "MANAGER", "ADMIN"] as const;
const ROUND_HOURS = 14;

async function myOpenRound(userId: string) {
  return prisma.guardRound.findFirst({ where: { guardId: userId, submittedAt: null, startedAt: { gte: new Date(nowManila().getTime() - ROUND_HOURS * 3600000) } }, orderBy: { startedAt: "desc" } });
}
async function ownRound(roundId: string, userId: string) {
  const r = await prisma.guardRound.findUnique({ where: { id: roundId } });
  if (!r || r.guardId !== userId) throw new Error("That round isn't yours.");
  if (r.submittedAt) throw new Error("This round was already submitted.");
  return r;
}

export async function startRound() {
  const u = await requireRole(...STAFF);
  const open = await myOpenRound(u.id);
  if (open) return { id: open.id };
  const now = nowManila();
  const r = await prisma.guardRound.create({ data: { guardId: u.id, shift: shiftOf(now), startedAt: now } });
  await audit(u.id, "round started", `${r.shift.toLowerCase()} shift round`);
  revalidatePath("/rounds");
  return { id: r.id };
}

export async function markOk(roundId: string, key: string) {
  const u = await requireRole(...STAFF);
  const r = await ownRound(roundId, u.id);
  if (!CHECKPOINTS.some((c) => c.key === key)) throw new Error("Unknown checkpoint.");
  if (!r.checked.includes(key)) await prisma.guardRound.update({ where: { id: r.id }, data: { checked: [...r.checked, key] } });
  revalidatePath("/rounds");
  return { ok: true };
}

const Issue = z.object({
  roundId: z.string().min(5).max(40),
  checkpoint: z.string().max(40),
  issue: z.string().max(20),
  where: z.string().trim().max(80).optional(),
  note: z.string().trim().max(600).optional(),
  photo: z.string().max(560_000).nullable().optional(),
});

/** Logs a problem as a work order. If the same problem is already open there, adds a note instead of a duplicate. */
export async function logIssue(input: z.infer<typeof Issue>): Promise<{ number: number; sla: number; dup: boolean }> {
  const u = await requireRole(...STAFF);
  if (!(await rateLimit(`round-issue:${u.id}`, 60, 3600)).ok) throw new Error("Too many reports this hour. Call the engineer on duty instead.");
  const p = Issue.parse(input);
  const r = await ownRound(p.roundId, u.id);
  const cp = CHECKPOINTS.find((c) => c.key === p.checkpoint);
  const kind = ISSUES.find((i) => i.key === p.issue);
  if (!cp || !kind) throw new Error("Pick the checkpoint and the kind of problem.");
  if (!photoOk(p.photo)) throw new Error("That photo couldn't be used. Try another one.");
  const where = p.where?.replace(/\s+/g, " ") || "";
  const unitCode = isUnitCode(where) ? where.toUpperCase() : null;
  const unit = unitCode ? await prisma.unit.findFirst({ where: { code: unitCode } }) : null;
  const location = unit?.code ?? (!where ? cp.label : cp.key === "hallways" || /tower|floor|\d+f\b/i.test(where) ? where : `${cp.label}, ${where}`).slice(0, 120);
  const title = kind.title;
  const now = nowManila();

  const dup = await prisma.workOrder.findFirst({ where: { location, title, status: { not: "DONE" }, createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } } });
  if (dup) {
    await prisma.wOEvent.create({ data: { workOrderId: dup.id, note: `Seen again by ${u.name} on the ${r.shift.toLowerCase()} round${p.note ? `: "${p.note}"` : "."}`, author: u.name } });
    if (!r.checked.includes(cp.key)) await prisma.guardRound.update({ where: { id: r.id }, data: { checked: [...r.checked, cp.key] } });
    revalidatePath("/rounds");
    return { number: dup.number, sla: dup.slaHours, dup: true };
  }

  const sla = SLA_HOURS[kind.priority];
  const wo = await prisma.workOrder.create({ data: {
    title, description: [p.note, where && !unit ? `Where: ${where}` : null].filter(Boolean).join("\n") || null,
    location, unitId: unit?.id ?? null, category: kind.category, priority: kind.priority, slaHours: sla,
    source: "Guard round", status: "NEW", reporterId: u.id, roundId: r.id, photo: p.photo || null,
    events: { create: { note: `Logged by ${u.name} at ${cp.label} on the ${r.shift.toLowerCase()} round. Priority ${kind.priority.toLowerCase()}, ${sla}h deadline.`, author: u.name } },
  } });
  if (!r.checked.includes(cp.key)) await prisma.guardRound.update({ where: { id: r.id }, data: { checked: [...r.checked, cp.key] } });
  await audit(u.id, "work_order", `Guard round: WO-${wo.number} ${title} at ${location}`);
  if (kind.priority === "HIGH") {
    const mgrs = await prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true } });
    await Promise.all(mgrs.map((m) => notifyUser(m.id, `Urgent from rounds: ${title}`, `${u.name} logged WO-${wo.number} at ${location}. 4-hour deadline.`, ["APP", "SMS"])));
  }
  revalidatePath("/rounds"); revalidatePath("/today");
  return { number: wo.number, sla, dup: false };
}

/** Saves meter readings and checks them against the last reading so typos are caught on the spot. */
export async function saveReadings(roundId: string, values: Record<string, string>): Promise<{ saved: number; warnings: string[] }> {
  const u = await requireRole(...STAFF);
  await ownRound(roundId, u.id);
  const warnings: string[] = []; let saved = 0;
  for (const m of METERS) {
    const raw = (values[m.key] ?? "").replace(/,/g, "").trim();
    if (!raw) continue;
    const v = Number(raw);
    if (!isFinite(v) || v < m.min || v > m.max) { warnings.push(`${m.label}: "${raw}" doesn't look right.`); continue; }
    const last = await prisma.meterReading.findFirst({ where: { meter: m.key }, orderBy: { takenAt: "desc" } });
    if (last && (m.key === "WATER_MAIN" || m.key === "ELECTRIC_MAIN") && v < last.value) { warnings.push(`${m.label} is lower than the last reading (${last.value.toLocaleString()}). Please read it again.`); continue; }
    if (m.key === "GENSET_FUEL" && v < 50) warnings.push(`Genset fuel is at ${v}%. Engineering has been told to refill.`);
    if (m.key === "CISTERN" && v < 30) warnings.push(`Water tank is at ${v}%. Check the pumps.`);
    await prisma.meterReading.create({ data: { meter: m.key, value: v, takenBy: u.name, roundId, takenAt: nowManila() } });
    saved++;
  }
  if (saved) await audit(u.id, "meter readings", `${saved} readings saved`);
  revalidatePath("/rounds");
  return { saved, warnings };
}

export async function submitRound(roundId: string, notes: string) {
  const u = await requireRole(...STAFF);
  const r = await ownRound(roundId, u.id);
  const issues = await prisma.workOrder.count({ where: { roundId: r.id } });
  await prisma.guardRound.update({ where: { id: r.id }, data: { submittedAt: nowManila(), notes: notes.trim().slice(0, 1000) || null } });
  await audit(u.id, "round submitted", `${r.shift.toLowerCase()} round: ${r.checked.length}/${CHECKPOINTS.length} checkpoints, ${issues} issues`);
  revalidatePath("/rounds"); revalidatePath("/today");
  return { ok: true };
}
