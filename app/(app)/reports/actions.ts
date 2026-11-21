"use server";
import { revalidatePath } from "next/cache";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBoardReport } from "@/lib/ai";
import { latestClosedPeriod } from "@/lib/metrics";
import { monthLong } from "@/lib/format";

export async function createReport() {
  const u = await requireRole("MANAGER", "ADMIN");
  const period = await latestClosedPeriod();
  const r = await generateBoardReport(period);
  await prisma.report.create({ data: { period, content: r.content, model: r.model, createdBy: u.name } });
  await audit(u.id, "report", `Drafted the ${monthLong(period)} board report`);
  revalidatePath("/reports");
}
