"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/comms";

const KIND = ["MEDICAL", "FIRE", "SECURITY", "ELEVATOR", "OTHER"] as const;
export async function sendSos(fd: FormData) {
  const u = await requireRole("OWNER");
  const p = z.object({ kind: z.enum(KIND), note: z.string().max(200).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/sos");
  const open = await prisma.sosAlert.findFirst({ where: { userId: u.id, status: { not: "RESOLVED" }, createdAt: { gte: new Date(Date.now() - 30 * 60000) } } });
  if (open) redirect("/sos");
  const unit = await prisma.unit.findFirst({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  const a = await prisma.sosAlert.create({ data: { userId: u.id, unitCode: unit?.code, kind: p.data.kind, note: p.data.note || null } });
  const staff = await prisma.user.findMany({ where: { role: { in: ["GUARD", "MANAGER"] }, active: true } });
  const msg = `SOS ${p.data.kind} at unit ${unit?.code ?? "?"} from ${u.name}${p.data.note ? `: ${p.data.note}` : ""}. Respond now and tap Acknowledge in the app.`;
  await Promise.all(staff.map((s) => notifyUser(s.id, `SOS: ${p.data.kind.toLowerCase()} at ${unit?.code ?? ""}`, msg, ["APP", "SMS"])));
  await audit(u.id, "SOS sent", `${a.kind} ${a.unitCode}`);
  revalidatePath("/sos");
  redirect("/sos");
}
export async function ackSos(fd: FormData) {
  const u = await requireRole("GUARD", "MANAGER", "ADMIN");
  const a = await prisma.sosAlert.findUnique({ where: { id: String(fd.get("id")) } });
  if (!a) redirect("/sos");
  const resolve = fd.get("resolve") === "1";
  await prisma.sosAlert.update({ where: { id: a.id }, data: resolve ? { status: "RESOLVED", resolvedAt: new Date(), ackBy: a.ackBy ?? u.name, ackAt: a.ackAt ?? new Date() } : { status: "ACK", ackBy: u.name, ackAt: new Date() } });
  if (!resolve) await notifyUser(a.userId, "Help is on the way", `${u.name} received your SOS and is coming to unit ${a.unitCode}.`, ["APP", "SMS"]);
  await audit(u.id, resolve ? "SOS resolved" : "SOS acknowledged", `${a.kind} ${a.unitCode}`);
  revalidatePath("/sos");
  redirect("/sos");
}
