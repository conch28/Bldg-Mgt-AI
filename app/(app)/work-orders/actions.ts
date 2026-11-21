"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SLA = { HIGH: 4, MEDIUM: 24, LOW: 72 } as const;

export async function updateWorkOrder(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ id: z.string(), status: z.enum(["NEW", "ASSIGNED", "IN_PROGRESS", "ESCALATED", "DONE"]), assignee: z.string().max(80).optional(), note: z.string().max(1000).optional() }).parse(Object.fromEntries(fd));
  const before = await prisma.workOrder.findUniqueOrThrow({ where: { id: p.id } });
  const changes: string[] = [];
  if (before.status !== p.status) changes.push(`status ${before.status} → ${p.status}`);
  if ((p.assignee ?? "") !== (before.assignee ?? "")) changes.push(`assigned to ${p.assignee || "nobody"}`);
  await prisma.workOrder.update({ where: { id: p.id }, data: {
    status: p.status, assignee: p.assignee || null, closedAt: p.status === "DONE" ? before.closedAt ?? new Date() : null,
    events: changes.length || p.note ? { create: { note: [changes.join(", "), p.note].filter(Boolean).join(". "), author: u.name } } : undefined,
  } });
  if (changes.length) await audit(u.id, "work_order", `WO-${before.number} ${before.title}: ${changes.join(", ")}`);
  revalidatePath("/work-orders");
}

export async function createWorkOrder(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ title: z.string().min(3).max(120), location: z.string().min(1).max(60), category: z.string().min(1).max(40), priority: z.enum(["LOW", "MEDIUM", "HIGH"]), assignee: z.string().max(80).optional(), source: z.string().max(40).optional() }).parse(Object.fromEntries(fd));
  const unit = await prisma.unit.findFirst({ where: { code: p.location.toUpperCase() } });
  const wo = await prisma.workOrder.create({ data: { title: p.title, location: unit?.code ?? p.location, unitId: unit?.id, category: p.category, priority: p.priority, slaHours: SLA[p.priority], assignee: p.assignee || null, status: p.assignee ? "ASSIGNED" : "NEW", source: p.source || "Walk-in",
    events: { create: { note: `Opened by ${u.name}.`, author: u.name } } } });
  await audit(u.id, "work_order", `Opened WO-${wo.number}: ${wo.title} (${wo.location})`);
  revalidatePath("/work-orders");
}
