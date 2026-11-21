"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nowManila } from "@/lib/format";
import { notifyUser } from "@/lib/comms";

export async function vote(fd: FormData) {
  const u = await requireRole("OWNER");
  const poll = await prisma.poll.findUnique({ where: { id: String(fd.get("pollId")) }, include: { options: true } });
  const opt = poll?.options.find((o) => o.id === fd.get("optionId"));
  if (!poll || !opt) redirect("/polls?error=" + encodeURIComponent("Pick an option."));
  if (poll.closesAt < nowManila()) redirect("/polls?error=" + encodeURIComponent("Voting has closed."));
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  // AGM resolutions: also vote for the units this owner holds a proxy for (unless that owner already voted personally).
  const held = poll.meetingId ? await prisma.proxy.findMany({ where: { meetingId: poll.meetingId, holderUserId: u.id, revokedAt: null } }) : [];
  if (!units.length && !held.length) redirect("/polls?error=No+unit+linked");
  // Resolutions: one vote per unit, weighted by floor area (per the master deed). Polls: one vote per unit, weight 1.
  const behind = await prisma.bill.count({ where: { unitId: { in: units.map((x) => x.id) }, status: { not: "PAID" }, dueDate: { lt: new Date(nowManila().getTime() - 60 * 86400000) } } });
  if (poll.kind === "RESOLUTION" && behind) redirect("/polls?error=" + encodeURIComponent("Only owners in good standing can vote on resolutions. Please settle dues over 60 days late."));
  for (const unit of units) {
    await prisma.vote.upsert({ where: { pollId_unitId: { pollId: poll.id, unitId: unit.id } }, update: { optionId: opt.id, userId: u.id, byProxy: false }, create: { pollId: poll.id, optionId: opt.id, unitId: unit.id, userId: u.id, weight: poll.kind === "RESOLUTION" ? unit.sqm : 1 } });
  }
  let proxyN = 0;
  for (const px of held) {
    const cur = await prisma.vote.findUnique({ where: { pollId_unitId: { pollId: poll.id, unitId: px.unitId } } });
    if (cur && !cur.byProxy) continue; // the owner voted in person; their own vote stands
    const unit = await prisma.unit.findUnique({ where: { id: px.unitId } });
    if (!unit) continue;
    const late = await prisma.bill.count({ where: { unitId: unit.id, status: { not: "PAID" }, dueDate: { lt: new Date(nowManila().getTime() - 60 * 86400000) } } });
    if (poll.kind === "RESOLUTION" && late) continue;
    await prisma.vote.upsert({ where: { pollId_unitId: { pollId: poll.id, unitId: unit.id } }, update: { optionId: opt.id, userId: u.id, byProxy: true }, create: { pollId: poll.id, optionId: opt.id, unitId: unit.id, userId: u.id, weight: poll.kind === "RESOLUTION" ? unit.sqm : 1, byProxy: true } });
    proxyN++;
  }
  await audit(u.id, "vote", `${poll.question} → ${opt.label}${proxyN ? ` (+${proxyN} by proxy)` : ""}`);
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

/** Owner names a proxy for an AGM: a board member, or the owner of another unit. Counts toward quorum; holders with an account can vote for the unit. */
export async function assignProxy(fd: FormData) {
  const u = await requireRole("OWNER");
  const meeting = await prisma.meeting.findUnique({ where: { id: String(fd.get("meetingId")) } });
  if (!meeting || meeting.kind !== "AGM" || meeting.startsAt < nowManila()) redirect("/polls?error=" + encodeURIComponent("This meeting is no longer taking proxies."));
  const pick = String(fd.get("holder") || "");
  let holderUserId: string | null = null, holderName = "";
  if (pick.startsWith("user:")) {
    const h = await prisma.user.findFirst({ where: { id: pick.slice(5), role: "BOARD", active: true } });
    if (!h) redirect("/polls?error=" + encodeURIComponent("Pick someone from the list."));
    holderUserId = h.id; holderName = h.name;
  } else {
    const code = String(fd.get("unit") || "").trim().toUpperCase();
    const unit = code ? await prisma.unit.findFirst({ where: { code }, include: { owner: true } }) : null;
    if (!unit?.owner || unit.owner.id === u.id) redirect("/polls?error=" + encodeURIComponent("Type the unit code of the owner you trust, e.g. 903A. They need an app account."));
    holderUserId = unit.owner.id; holderName = `${unit.owner.name} (${unit.code})`;
  }
  const units = await prisma.unit.findMany({ where: { ownerId: u.id } });
  for (const x of units) await prisma.proxy.upsert({ where: { meetingId_unitId: { meetingId: meeting.id, unitId: x.id } }, update: { holderUserId, holderName, grantorId: u.id, revokedAt: null, createdAt: new Date() }, create: { meetingId: meeting.id, unitId: x.id, unitCode: x.code, grantorId: u.id, holderUserId, holderName } });
  await audit(u.id, "proxy assigned", `${meeting.title}: ${units.map((x) => x.code).join(", ")} → ${holderName}`);
  if (holderUserId) await notifyUser(holderUserId, "You've been named a proxy", `${u.name} named you their proxy for ${meeting.title} on ${meeting.startsAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}. You can vote for their unit on the Voting page.`, ["APP"]);
  revalidatePath("/polls");
  redirect("/polls?ok=" + encodeURIComponent(`${holderName} is your proxy. You can still attend or vote yourself; your own vote always counts first.`));
}

export async function revokeProxy(fd: FormData) {
  const u = await requireRole("OWNER");
  const meetingId = String(fd.get("meetingId"));
  const r = await prisma.proxy.updateMany({ where: { meetingId, grantorId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(u.id, "proxy revoked", `${meetingId} (${r.count})`);
  revalidatePath("/polls");
  redirect("/polls?ok=" + encodeURIComponent("Proxy cancelled."));
}
