"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";

export async function markDone(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const t = await prisma.pMTask.findUnique({ where: { id: String(fd.get("id")) } });
  if (!t) redirect("/maintenance");
  const now = nowManila();
  await prisma.pMTask.update({ where: { id: t.id }, data: { lastDone: now, nextDue: new Date(now.getTime() + t.frequencyDays * 86400000) } });
  if (t.lastWorkOrder) await prisma.workOrder.updateMany({ where: { number: t.lastWorkOrder, status: { not: "DONE" } }, data: { status: "DONE", closedAt: now } });
  await audit(u.id, "maintenance done", `${t.asset}: ${t.task}`);
  revalidatePath("/maintenance");
  redirect("/maintenance?ok=" + encodeURIComponent(`${t.asset}: ${t.task} marked done.`));
}
