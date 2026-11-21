"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";

export async function vote(fd: FormData) {
  const u = await requireRole("OWNER");
  const poll = await prisma.poll.findUnique({ where: { id: String(fd.get("pollId")) }, include: { options: true } });
  const opt = poll?.options.find((o) => o.id === fd.get("optionId"));
  if (!poll || !opt) redirect("/polls?error=" + encodeURIComponent("Pick an option."));
  if (poll.closesAt < nowManila()) redirect("/polls?error=" + encodeURIComponent("Voting has closed."));
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  if (!units.length) redirect("/polls?error=No+unit+linked");
  // Resolutions: one vote per unit, weighted by floor area (per the master deed). Polls: one vote per unit, weight 1.
  const behind = await prisma.bill.count({ where: { unitId: { in: units.map((x) => x.id) }, status: { not: "PAID" }, dueDate: { lt: new Date(nowManila().getTime() - 60 * 86400000) } } });
  if (poll.kind === "RESOLUTION" && behind) redirect("/polls?error=" + encodeURIComponent("Only owners in good standing can vote on resolutions. Please settle dues over 60 days late."));
  for (const unit of units) {
    await prisma.vote.upsert({ where: { pollId_unitId: { pollId: poll.id, unitId: unit.id } }, update: { optionId: opt.id, userId: u.id }, create: { pollId: poll.id, optionId: opt.id, unitId: unit.id, userId: u.id, weight: poll.kind === "RESOLUTION" ? unit.sqm : 1 } });
  }
  await audit(u.id, "vote", `${poll.question} → ${opt.label}`);
  revalidatePath("/polls");
  redirect("/polls?ok=" + encodeURIComponent("Thanks, your vote is in. You can change it until voting closes."));
}

export async function createPoll(fd: FormData) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const p = z.object({ question: z.string().trim().min(5).max(200), detail: z.string().max(2000).optional(), kind: z.enum(["POLL", "RESOLUTION"]), closes: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), options: z.string().min(3) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/polls?error=" + encodeURIComponent("Add a question, a closing date and at least two options."));
  const options = p.data.options.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (options.length < 2) redirect("/polls?error=" + encodeURIComponent("Add at least two options, one per line."));
  const poll = await prisma.poll.create({ data: { question: p.data.question, detail: p.data.detail || null, kind: p.data.kind, closesAt: new Date(p.data.closes + "T23:59:00+08:00"), createdBy: u.name, options: { create: options.map((label) => ({ label })) } } });
  await audit(u.id, "poll created", poll.question);
  revalidatePath("/polls");
  redirect("/polls?ok=" + encodeURIComponent("Published. Announce it from Resident updates so owners know to vote."));
}
