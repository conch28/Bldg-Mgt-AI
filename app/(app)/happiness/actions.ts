"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordPulse } from "@/lib/pulse";
import { notifyUser } from "@/lib/comms";

export async function submitPulse(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ score: z.coerce.number().int().min(1).max(5), comment: z.string().max(1000).optional(), back: z.string().optional() }).parse(Object.fromEntries(fd));
  const unit = await prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  await recordPulse({ userId: u.id, unitCode: unit?.code, kind: "MONTHLY", score: p.score, comment: p.comment });
  revalidatePath("/home");
  redirect((p.back === "/updates" ? "/updates" : "/home") + "?thanks=" + p.score);
}

export async function followUp(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ id: z.string(), note: z.string().trim().min(3).max(1000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/happiness?error=" + encodeURIComponent("Write a short note on what you'll do for the resident."));
  const pulse = await prisma.pulse.findUnique({ where: { id: p.data.id } });
  if (!pulse) redirect("/happiness");
  await prisma.pulse.update({ where: { id: pulse.id }, data: { followedUp: new Date(), followNote: p.data.note } });
  await notifyUser(pulse.userId, "We heard you", `Thank you for your honest feedback. ${p.data.note}\n\n${u.name}, Property Manager`, ["APP", "SMS", "EMAIL"]);
  await audit(u.id, "resident follow-up", `Unit ${pulse.unitCode}: ${p.data.note}`);
  revalidatePath("/happiness");
  redirect("/happiness?ok=" + encodeURIComponent("Follow-up sent to the resident."));
}
