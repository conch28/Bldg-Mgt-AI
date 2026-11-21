"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function bookService(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const a = await prisma.asset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!a) redirect("/equipment");
  const open = await prisma.workOrder.findFirst({ where: { location: a.location, source: "Equipment AI", status: { not: "DONE" } } });
  if (open) redirect(`/equipment?ok=${encodeURIComponent(`WO-${open.number} is already open for ${a.name}.`)}`);
  const why = String(fd.get("why") || "").slice(0, 400);
  const wo = await prisma.workOrder.create({ data: { title: `Preventive service: ${a.name}`, description: `Sensors flagged this before it broke down. ${why}`, category: a.category === "Elevator" ? "Elevator" : "Mechanical", priority: "MEDIUM", slaHours: 72, location: a.location, source: "Equipment AI", status: "ASSIGNED", assignee: a.vendor ?? "Engineering" } });
  await audit(u.id, "preventive service", `WO-${wo.number} ${a.tag}`);
  revalidatePath("/equipment");
  redirect(`/equipment?ok=${encodeURIComponent(`WO-${wo.number} sent to ${a.vendor ?? "Engineering"}.`)}`);
}
