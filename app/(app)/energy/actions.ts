"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Open a free leak check for a unit the meters flagged. */
export async function openLeakCheck(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const code = String(fd.get("code") || "").toUpperCase();
  const note = String(fd.get("note") || "").slice(0, 500);
  const unit = await prisma.unit.findFirst({ where: { code } });
  if (!unit) redirect("/energy?error=Unit+not+found");
  const open = await prisma.workOrder.findFirst({ where: { unitId: unit.id, status: { not: "DONE" }, title: { startsWith: "Meter check" } } });
  if (open) redirect(`/energy?ok=${encodeURIComponent(`WO-${open.number} is already open for ${code}.`)}`);
  const wo = await prisma.workOrder.create({ data: { title: `Meter check: possible leak in ${code}`, description: note || "Sub-meter readings are unusual for this unit.", category: "Plumbing", priority: "MEDIUM", slaHours: 24, location: code, unitId: unit.id, source: "Meter AI", status: "NEW" } });
  await audit(u.id, "meter check opened", `WO-${wo.number} ${code}`);
  revalidatePath("/energy");
  redirect(`/energy?ok=${encodeURIComponent(`Opened WO-${wo.number} for ${code}. The owner will be told when it's scheduled.`)}`);
}
