"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { briefingFacts } from "@/lib/briefing";
import { writeBriefing } from "@/lib/ai";
import { earlyWarnings } from "@/lib/building";

export async function getBriefing(): Promise<{ text: string; ai: boolean }> {
  const u = await requireRole("MANAGER", "ADMIN");
  const { text, facts } = await briefingFacts(u.name);
  return writeBriefing(facts, text);
}

/** Opens an inspection ticket for an early warning (once; repeats return the open ticket). */
export async function openInspection(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const key = z.string().max(200).parse(fd.get("key"));
  const w = (await earlyWarnings()).find((x) => x.key === key);
  if (!w) return;
  const title = `Inspection: ${w.title}`.slice(0, 120);
  const existing = await prisma.workOrder.findFirst({ where: { title, status: { not: "DONE" } } });
  if (existing) return;
  const unit = await prisma.unit.findFirst({ where: { code: w.location } });
  const priority = w.level === "high" ? "HIGH" : "MEDIUM";
  const wo = await prisma.workOrder.create({ data: {
    title, description: `${w.why}\n\nSuggested: ${w.action}`, location: unit?.code ?? w.location, unitId: unit?.id, category: w.category,
    priority, slaHours: priority === "HIGH" ? 24 : 72, source: "Early warning", status: "NEW",
    events: { create: { note: `Opened from an early warning by ${u.name}. ${w.why}`, author: "Early warning" } },
  } });
  await audit(u.id, "work_order", `Opened WO-${wo.number} from early warning: ${w.title}`);
  revalidatePath("/today");
}
