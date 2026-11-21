"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, audit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { URGENT_TEMPLATES, fillTemplate, dispatch, runAutomations, CHANNELS } from "@/lib/comms";
import { draftAnnouncement } from "@/lib/ai";

const back = (q: string) => redirect("/comms?" + q);
const channelsFrom = (fd: FormData) => fd.getAll("channels").map(String).filter((c) => (CHANNELS as readonly string[]).includes(c));
const audienceFrom = (fd: FormData) => {
  const a = String(fd.get("audience") || "ALL");
  const extra = String(fd.get("audienceValue") || "").trim();
  if (a === "FLOORS" || a === "UNITS") return extra ? `${a}:${extra.replace(/\s+/g, "")}` : "ALL";
  return ["ALL", "OVERDUE", "BOARD"].includes(a) ? a : "ALL";
};

export async function sendUrgent(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const t = URGENT_TEMPLATES.find((x) => x.key === fd.get("template"));
  if (!t) return back("error=" + encodeURIComponent("Pick a template."));
  if (fd.get("confirm") !== "on") return back("error=" + encodeURIComponent("Tick the box to confirm before sending an urgent alert."));
  const v = { when: String(fd.get("when") || "").trim(), reason: String(fd.get("reason") || "").trim() };
  const channels = channelsFrom(fd);
  const en = fillTemplate(t.en, v), tl = fillTemplate(t.tl, v);
  const a = await prisma.announcement.create({ data: { kind: "URGENT", category: t.label, title: fillTemplate(t.title, v), bodyEn: en, bodyTl: tl, smsEn: en, smsTl: tl, audience: audienceFrom(fd), channels: channels.length ? channels : ["APP", "SMS"], status: "SCHEDULED", createdBy: u.name, approvedBy: u.name } });
  const r = await dispatch(a.id);
  await audit(u.id, "urgent alert", `${a.title} → ${r.recipients ?? 0} owners`);
  revalidatePath("/comms");
  back("ok=" + encodeURIComponent(`Urgent alert sent to ${r.recipients ?? 0} owners (${r.sent} messages). You've been notified too.`));
}

export async function aiDraft(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = z.object({ category: z.string().min(2).max(60), notes: z.string().min(5).max(3000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return back("error=" + encodeURIComponent("Add a type and a few notes for the AI to work from."));
  const audience = audienceFrom(fd);
  let d;
  try { d = await draftAnnouncement({ category: p.data.category, notes: p.data.notes, audience }); }
  catch (e) { return back("error=" + encodeURIComponent((e as Error).message || "Drafting failed.")); }
  const a = await prisma.announcement.create({ data: { kind: p.data.category.toLowerCase().includes("reminder") ? "REMINDER" : "ROUTINE", category: p.data.category, title: d.title, bodyEn: d.bodyEn, bodyTl: d.bodyTl, smsEn: d.smsEn, smsTl: d.smsTl, audience, channels: ["APP", "SMS", "EMAIL"], status: "PENDING_APPROVAL", aiDrafted: d.ai, createdBy: u.name } });
  back("edit=" + a.id);
}

const Edit = z.object({ id: z.string(), title: z.string().min(3).max(140), bodyEn: z.string().min(5).max(6000), bodyTl: z.string().max(6000).optional(), smsEn: z.string().max(450).optional(), smsTl: z.string().max(450).optional(), when: z.string().optional(), intent: z.enum(["save", "send", "schedule", "cancel"]) });

export async function saveAnnouncement(fd: FormData) {
  const u = await requireRole("MANAGER", "ADMIN");
  const p = Edit.safeParse(Object.fromEntries(fd));
  if (!p.success) return back(`edit=${fd.get("id")}&error=` + encodeURIComponent("Check the title and message (SMS max 450 characters)."));
  const { id, intent, when, ...rest } = p.data;
  if (intent === "cancel") { await prisma.announcement.update({ where: { id }, data: { status: "CANCELLED" } }); await audit(u.id, "announcement cancelled", rest.title); revalidatePath("/comms"); return back("ok=Cancelled."); }
  const data = { ...rest, audience: audienceFrom(fd), channels: channelsFrom(fd) };
  if (!data.channels.length) data.channels = ["APP"];
  if (/\[ADD:/i.test(`${rest.bodyEn} ${rest.bodyTl ?? ""} ${rest.smsEn ?? ""}`) && intent !== "save") return back(`edit=${id}&error=` + encodeURIComponent("Fill in the [ADD: …] placeholders before approving."));
  if (intent === "save") { await prisma.announcement.update({ where: { id }, data }); return back(`edit=${id}&ok=Saved.`); }
  if (intent === "schedule") {
    const at = when ? new Date(when + ":00+08:00") : null;
    if (!at || isNaN(+at) || at < new Date()) return back(`edit=${id}&error=` + encodeURIComponent("Pick a future date and time."));
    await prisma.announcement.update({ where: { id }, data: { ...data, status: "SCHEDULED", scheduledAt: at, approvedBy: u.name } });
    await audit(u.id, "announcement scheduled", `${rest.title} for ${at.toISOString()}`);
    revalidatePath("/comms");
    return back("ok=" + encodeURIComponent("Approved and scheduled."));
  }
  await prisma.announcement.update({ where: { id }, data: { ...data, status: "SCHEDULED", scheduledAt: new Date(), approvedBy: u.name } });
  const r = await dispatch(id);
  await audit(u.id, "announcement sent", `${rest.title} → ${r.recipients ?? 0} owners`);
  revalidatePath("/comms");
  back("ok=" + encodeURIComponent(`Sent to ${r.recipients ?? 0} owners (${r.sent} messages).`));
}

export async function runNow() {
  const u = await requireRole("MANAGER", "ADMIN");
  const r = await runAutomations();
  await audit(u.id, "automations run", JSON.stringify(r));
  revalidatePath("/comms");
  back("ok=" + encodeURIComponent(`Automations ran: ${r.sent} scheduled sent, ${r.pmOpened} maintenance work orders opened${r.duesReminderQueued ? ", dues reminder queued for approval" : ""}.`));
}
