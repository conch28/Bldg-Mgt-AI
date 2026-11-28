"use server";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/assist";

const Input = z.object({ question: z.string().trim().min(3).max(2000), topic: z.string().max(120).optional() });

/** "Talk to a person": hands an Ask AI question to the property manager as an escalated ticket. */
export async function askPerson(input: { question: string; topic?: string }): Promise<{ ok: true; ticket: string } | { ok: false; error: string }> {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const p = Input.safeParse(input);
  if (!p.success) return { ok: false, error: "Please type your question first." };
  const unit = u.role === "OWNER" ? await prisma.unit.findFirst({ where: { ownerId: u.id } }) : null;
  const board = u.role !== "OWNER";
  const recent = await prisma.workOrder.findFirst({ where: { reporterId: u.id, source: "Ask AI", createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent) return { ok: true, ticket: `WO-${recent.number}` };
  const wo = await prisma.workOrder.create({ data: {
    title: (board ? "Board question: " : "Resident question: ") + (p.data.topic || p.data.question).slice(0, 90),
    description: p.data.question, category: board ? "Board request" : "Owner concern", priority: "MEDIUM", slaHours: board ? 24 : 4,
    location: unit?.code ?? (board ? "Board" : "N/A"), unitId: unit?.id ?? null, source: "Ask AI", reporterId: u.id,
    assignee: "Property manager", status: "ESCALATED",
    events: { create: { note: `Sent from Ask AI by ${u.name}. ${board ? "Board question; get legal counsel if needed." : "Resident wants a person to follow up."}`, author: "Ask AI" } },
  } });
  await audit(u.id, "work_order", `Opened WO-${wo.number} from Ask AI`);
  return { ok: true, ticket: `WO-${wo.number}` };
}

/** The owner tapped Confirm on a draft from the AI helper (repair, pass or amenity booking). */
export async function confirmAction(action: unknown): Promise<ActionResult> {
  const u = await requireRole("OWNER");
  const r = await runAction(u, action);
  if (r.ok) revalidatePath(r.href.split("?")[0]);
  return r;
}
