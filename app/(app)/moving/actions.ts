"use server";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/comms";
import { fmtDate } from "@/lib/format";
import { CHECKLIST } from "./checklist";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

export async function requestMove(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ unitId: z.string(), kind: z.enum(["MOVE_IN", "MOVE_OUT", "RENOVATION"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(300).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/moving?error=" + encodeURIComponent("Pick the type and a date."));
  const unit = await prisma.unit.findFirst({ where: { id: p.data.unitId, ownerId: u.id } });
  if (!unit) redirect("/moving");
  const m = await prisma.moveRequest.create({ data: { unitId: unit.id, userId: u.id, kind: p.data.kind, date: new Date(`${p.data.date}T08:00:00+08:00`), note: p.data.note || null, done: ["request"] } });
  await audit(u.id, "move requested", `${m.kind} ${unit.code} ${p.data.date}`);
  revalidatePath("/moving");
  redirect("/moving?new=" + m.id);
}

export async function toggleStep(fd: FormData) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN", "GUARD");
  const m = await prisma.moveRequest.findUnique({ where: { id: String(fd.get("id")) } });
  const key = String(fd.get("key"));
  if (!m) redirect("/moving");
  const step = CHECKLIST[m.kind]?.find((s) => s.key === key);
  if (!step) redirect("/moving");
  if (u.role === "OWNER" ? m.userId !== u.id || step.who !== "OWNER" : step.who === "OWNER") redirect("/moving");
  const done = m.done.includes(key) ? m.done.filter((k) => k !== key) : [...m.done, key];
  await prisma.moveRequest.update({ where: { id: m.id }, data: { done } });
  revalidatePath("/moving");
  redirect("/moving");
}

export async function approveMove(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const m = await prisma.moveRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { unit: true } });
  if (!m || m.status !== "PENDING") redirect("/moving");
  let code = newCode(); while (await prisma.pass.findUnique({ where: { code } })) code = newCode();
  const label = m.kind === "RENOVATION" ? "Renovation crew" : "Movers";
  await prisma.pass.create({ data: { code, kind: m.kind === "RENOVATION" ? "CONTRACTOR" : "MOVE", name: `${label} for ${m.unit.code}`, unitId: m.unitId, userId: m.userId, validFrom: m.date, validTo: new Date(m.date.getTime() + (m.kind === "RENOVATION" ? 14 : 1) * 86400000), note: m.note } });
  await prisma.moveRequest.update({ where: { id: m.id }, data: { status: "APPROVED", passCode: code, done: [...new Set([...m.done, "approve", "pass"])] } });
  await notifyUser(m.userId, `${m.kind === "RENOVATION" ? "Renovation" : "Move"} approved for ${fmtDate(m.date)}`, `Your request for ${m.unit.code} is approved. Gate pass code: ${code}. The service elevator is reserved for you 8 AM to 5 PM.`, ["APP", "SMS"]);
  await audit(u.id, "move approved", `${m.kind} ${m.unit.code}`);
  revalidatePath("/moving");
  redirect("/moving");
}
