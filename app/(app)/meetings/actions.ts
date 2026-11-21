"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { draftAgenda, draftMinutes } from "@/lib/meetings";

const BOARD = ["BOARD", "MANAGER", "ADMIN"] as const;
const back = (id: string, q: string) => redirect(`/meetings/${id}?${q}`);

export async function createMeeting(fd: FormData) {
  const u = await requireRole(...BOARD);
  const p = z.object({ title: z.string().trim().min(3).max(120), kind: z.enum(["BOARD", "AGM"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), place: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/meetings?error=" + encodeURIComponent("Add a title, date, time and place."));
  const m = await prisma.meeting.create({ data: { title: p.data.title, kind: p.data.kind, startsAt: new Date(`${p.data.date}T${p.data.time}:00+08:00`), place: p.data.place, createdBy: u.name } });
  await audit(u.id, "meeting created", `${m.kind} ${m.title}`);
  const a = await draftAgenda(m.kind, m.title, m.startsAt);
  await prisma.meeting.update({ where: { id: m.id }, data: { agenda: a.text } });
  redirect(`/meetings/${m.id}?ok=${encodeURIComponent(a.ai ? "Meeting created. AI drafted the agenda from this month's numbers." : "Meeting created with an agenda from this month's numbers.")}`);
}

export async function redraftAgenda(fd: FormData) {
  const u = await requireRole(...BOARD);
  const m = await prisma.meeting.findUnique({ where: { id: String(fd.get("id")) } });
  if (!m) redirect("/meetings");
  const a = await draftAgenda(m.kind, m.title, m.startsAt);
  await prisma.meeting.update({ where: { id: m.id }, data: { agenda: a.text } });
  await audit(u.id, "agenda drafted", m.title);
  revalidatePath(`/meetings/${m.id}`);
  back(m.id, "ok=" + encodeURIComponent("Agenda refreshed with the latest numbers."));
}

export async function saveAgenda(fd: FormData) {
  const u = await requireRole(...BOARD);
  const id = String(fd.get("id"));
  const agenda = String(fd.get("agenda") || "").slice(0, 8000);
  await prisma.meeting.update({ where: { id }, data: { agenda } });
  await audit(u.id, "agenda edited", id);
  back(id, "ok=Agenda+saved");
}

export async function writeMinutes(fd: FormData) {
  const u = await requireRole(...BOARD);
  const m = await prisma.meeting.findUnique({ where: { id: String(fd.get("id")) } });
  const notes = String(fd.get("notes") || "").trim().slice(0, 12000);
  const present = String(fd.get("present") || "").trim().slice(0, 300) || "Attendance not recorded";
  if (!m) redirect("/meetings");
  if (notes.length < 10) back(m.id, "error=" + encodeURIComponent("Add your notes first. Rough is fine, Taglish is fine."));
  const r = await draftMinutes(m, notes, present);
  await prisma.$transaction([
    prisma.meeting.update({ where: { id: m.id }, data: { notes, minutes: r.text, status: "HELD" } }),
    prisma.actionItem.deleteMany({ where: { meetingId: m.id, status: "OPEN" } }),
    prisma.actionItem.createMany({ data: r.actions.map((a) => ({ meetingId: m.id, text: a.text, owner: a.owner, due: a.due })) }),
  ]);
  await audit(u.id, "minutes drafted", `${m.title}: ${r.actions.length} action items`);
  revalidatePath(`/meetings/${m.id}`);
  back(m.id, "ok=" + encodeURIComponent(`Minutes drafted${r.ai ? " by AI" : ""} with ${r.actions.length} action item${r.actions.length === 1 ? "" : "s"}. Review before circulating.`));
}

export async function addAction(fd: FormData) {
  const u = await requireRole(...BOARD);
  const p = z.object({ meetingId: z.string().optional(), text: z.string().trim().min(3).max(300), owner: z.string().trim().min(2).max(80), due: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) redirect("/meetings?error=" + encodeURIComponent("Add what needs doing and who owns it."));
  await prisma.actionItem.create({ data: { meetingId: p.data.meetingId || null, text: p.data.text, owner: p.data.owner, due: p.data.due ? new Date(p.data.due + "T17:00:00+08:00") : null } });
  await audit(u.id, "action item added", p.data.text);
  revalidatePath("/meetings");
  if (p.data.meetingId) back(p.data.meetingId, "ok=Added");
  redirect("/meetings?ok=Added");
}

export async function toggleAction(fd: FormData) {
  const u = await requireRole(...BOARD);
  const a = await prisma.actionItem.findUnique({ where: { id: String(fd.get("id")) } });
  if (!a) redirect("/meetings");
  const done = a.status !== "DONE";
  await prisma.actionItem.update({ where: { id: a.id }, data: { status: done ? "DONE" : "OPEN", doneAt: done ? new Date() : null } });
  await audit(u.id, done ? "action item done" : "action item reopened", a.text);
  revalidatePath("/meetings");
  const to = String(fd.get("back") || "/meetings");
  redirect(to.startsWith("/meetings") ? to : "/meetings");
}

export async function markPresent(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const id = String(fd.get("id"));
  const via = fd.get("via") === "ONLINE" ? "ONLINE" : "IN_PERSON";
  const codes = String(fd.get("units") || "").toUpperCase().split(/[\s,]+/).filter(Boolean).slice(0, 50);
  const units = await prisma.unit.findMany({ where: { code: { in: codes } } });
  for (const x of units) await prisma.attendance.upsert({ where: { meetingId_unitId: { meetingId: id, unitId: x.id } }, update: { via }, create: { meetingId: id, unitId: x.id, unitCode: x.code, via } });
  await audit(u.id, "attendance", `${units.length} units ${via}`);
  revalidatePath(`/meetings/${id}`);
  back(id, "ok=" + encodeURIComponent(`${units.length} unit${units.length === 1 ? "" : "s"} marked present${codes.length > units.length ? `; ${codes.length - units.length} code(s) not found` : ""}.`));
}
