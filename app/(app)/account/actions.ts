"use server";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { notifyUser } from "@/lib/comms";
import { rateLimit } from "@/lib/ratelimit";
/** Data Privacy Act requests: correction or deletion. Admins handle them under System & privacy. */
export async function requestPrivacy(fd: FormData) {
  const u = await requireRole();
  const p = z.object({ kind: z.enum(["CORRECT", "DELETE"]), note: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/account?error=1");
  if (!(await rateLimit(`privacy:${u.id}`, 5, 86400)).ok) redirect("/account?error=limit");
  const open = await prisma.privacyRequest.findFirst({ where: { userId: u.id, kind: p.data.kind, status: "OPEN" } });
  if (!open) {
    await prisma.privacyRequest.create({ data: { userId: u.id, kind: p.data.kind, note: p.data.note || null } });
    await audit(u.id, "privacy_request", p.data.kind === "DELETE" ? "Asked to delete their data" : "Asked to correct their data");
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
    for (const a of admins) await notifyUser(a.id, "New privacy request", `${u.name} asked to ${p.data.kind === "DELETE" ? "delete" : "correct"} their data. Please reply within 15 days under System & privacy.`, ["APP", "EMAIL"]);
  }
  redirect("/account?sent=" + p.data.kind);
}
