"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { overdueAccounts, toneFor } from "@/lib/metrics";
import { draftReminder } from "@/lib/ai";
import { sendSms } from "@/lib/notify";
import { peso } from "@/lib/format";
import { applyPayment } from "@/lib/billing";

async function account(unitId: string) {
  const a = (await overdueAccounts()).find((x) => x.unitId === unitId);
  if (!a) throw new Error("This unit has no overdue balance.");
  return a;
}

export async function draftAction(unitId: string, softer = false) {
  await requireRole("MANAGER", "ADMIN");
  const a = await account(unitId);
  const order = ["final", "firm", "friendly", "nudge"];
  let tone = toneFor(a.days);
  if (softer) tone = order[Math.min(3, order.indexOf(tone) + 1)];
  return { tone, text: await draftReminder(tone, { code: a.code, owner: a.owner, amount: a.amount, days: a.days }) };
}

export async function sendAction(unitId: string, text: string, tone: string) {
  const u = await requireRole("MANAGER", "ADMIN");
  const msg = z.string().min(10).max(1000).parse(text);
  const a = await account(unitId);
  const r = await sendSms(a.phone, msg);
  await prisma.reminder.create({ data: { billId: a.billIds[0], channel: r.delivered ? "SMS" : "Logged", tone, message: msg, sentBy: u.name } });
  await audit(u.id, "reminder", `Reminder to ${a.code} (${peso(a.amount)}, ${a.days} days): ${r.info}`);
  revalidatePath("/collections");
  return r.info;
}

export async function recordPayment(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ unit: z.string().min(1), amount: z.coerce.number().positive().max(10_000_000), method: z.string().min(2).max(30), reference: z.string().min(2).max(60) }).parse(Object.fromEntries(fd));
  const unit = await prisma.unit.findFirst({ where: { code: p.unit.toUpperCase().trim() } });
  if (!unit) throw new Error(`Unit ${p.unit} not found`);
  await applyPayment(unit.id, p.amount, p.method, p.reference);
  await audit(u.id, "payment", `Recorded ${peso(p.amount)} for ${unit.code} via ${p.method} (${p.reference})`);
  revalidatePath("/collections");
}

