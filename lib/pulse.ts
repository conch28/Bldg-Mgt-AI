import { prisma } from "./db";
import { classifyFeedback } from "./ai";
import { notifyUser } from "./comms";

/** Saves a resident rating. A 1-2★ rating alerts the manager right away so someone calls the resident the same day. */
export async function recordPulse(input: { userId: string; unitCode?: string | null; kind: string; score: number; comment?: string | null; workOrder?: number | null }) {
  const comment = input.comment?.trim().slice(0, 1000) || null;
  const c = await classifyFeedback(comment, input.score);
  const p = await prisma.pulse.create({ data: { userId: input.userId, unitCode: input.unitCode ?? null, kind: input.kind, score: input.score, comment, topic: c.topic, sentiment: c.sentiment, workOrder: input.workOrder ?? null } });
  if (input.score <= 2) {
    const managers = await prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true } });
    for (const m of managers) await notifyUser(m.id, `Unhappy resident: Unit ${input.unitCode ?? "?"} rated ${input.score}★`, `${comment ? `"${comment}"` : "No comment."}${c.topic ? ` (topic: ${c.topic})` : ""}\nPlease follow up today from Resident happiness.`, ["APP", "SMS"]);
  }
  return p;
}
