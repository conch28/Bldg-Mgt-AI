/**
 * Resident communications engine.
 *  - URGENT: sent immediately from a template; the manager is notified.
 *  - ROUTINE / REMINDER: drafted (often by AI), approved by a manager, then sent now or at a scheduled time.
 *  - TICKET: automatic one-to-one updates when a work order changes.
 * dispatchDue() is called by the cron route and opportunistically when managers open the Communications page.
 */
import type { Announcement, User } from "@prisma/client";
import { prisma } from "./db";
import { sendEmail, sendMessenger, sendSms, type SendResult } from "./notify";
import { nowManila, addMonths, currentPeriod, monthLong } from "./format";
import { overdueAccounts } from "./metrics";

export const CHANNELS = ["APP", "SMS", "EMAIL", "MESSENGER"] as const;

export const URGENT_TEMPLATES: { key: string; label: string; title: string; en: string; tl: string }[] = [
  { key: "water", label: "Water interruption", title: "Water interruption {when}",
    en: "Water supply will be interrupted {when} for {reason}. Please store enough water beforehand. We'll send an update once supply is back.",
    tl: "Magkakaroon po ng water interruption {when} dahil sa {reason}. Mag-ipon po muna ng tubig. Mag-a-update kami pag may tubig na ulit." },
  { key: "power", label: "Power interruption", title: "Power interruption {when}",
    en: "Power will be interrupted {when} for {reason}. Elevators 1 and 3 will run on the generator. Please unplug sensitive appliances.",
    tl: "Magkakaroon po ng brownout {when} dahil sa {reason}. Gagana ang Elevator 1 at 3 sa generator. Paki-unplug po ang mga sensitive na appliances." },
  { key: "typhoon", label: "Typhoon advisory", title: "Typhoon advisory: {reason}",
    en: "{reason}. Please bring in plants and items from balconies, close windows, and charge your devices. The lobby and P1 parking stay open; avoid the basement levels if flooding starts. Guard house: local 100.",
    tl: "{reason}. Paki-pasok po ang mga halaman at gamit sa balcony, isara ang bintana, at mag-charge ng gadgets. Bukas ang lobby at P1; iwasan ang basement kung bumaha. Guard house: local 100." },
  { key: "elevator", label: "Elevator outage", title: "Elevator out of service {when}",
    en: "{reason} is out of service {when}. The other elevators are running. We're sorry for the inconvenience.",
    tl: "Hindi po magagamit ang {reason} {when}. Gumagana ang ibang elevators. Pasensya na po sa abala." },
  { key: "safety", label: "Safety alert", title: "Safety alert",
    en: "Safety alert: {reason}. Please follow instructions from building staff. Emergency: call the guard house at local 100 or 911.",
    tl: "Safety alert: {reason}. Sundin po ang instructions ng building staff. Emergency: tumawag sa guard house, local 100, o 911." },
];

export function fillTemplate(t: string, v: { when?: string; reason?: string }) {
  return t.replaceAll("{when}", v.when || "today").replaceAll("{reason}", v.reason || "maintenance work");
}

/** Owners (with logins) the announcement goes to, plus a count of units with no login yet. */
export async function resolveAudience(audience: string) {
  const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true }, include: { units: true } });
  let units: string[] | null = null;
  if (audience.startsWith("FLOORS:")) {
    const floors = audience.slice(7).split(",").map((x) => Number(x.trim())).filter(Boolean);
    units = (await prisma.unit.findMany({ where: { floor: { in: floors } }, select: { code: true } })).map((u) => u.code);
  } else if (audience.startsWith("UNITS:")) {
    units = audience.slice(6).split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  } else if (audience === "OVERDUE") {
    units = (await overdueAccounts()).map((o) => o.code);
  }
  if (audience === "BOARD") {
    const board = await prisma.user.findMany({ where: { role: { in: ["BOARD", "MANAGER"] }, active: true }, include: { units: true } });
    return { users: board, unitCount: 0, unlinked: 0 };
  }
  const inScope = (u: (typeof owners)[number]) => !units || u.units.some((x) => units!.includes(x.code));
  const users = owners.filter(inScope);
  const unitCount = units ? units.length : await prisma.unit.count();
  const linked = new Set(users.flatMap((u) => u.units.map((x) => x.code)));
  return { users, unitCount, unlinked: Math.max(0, unitCount - linked.size) };
}

export function audienceLabel(a: string) {
  if (a === "ALL") return "All owners";
  if (a === "OVERDUE") return "Owners with overdue dues";
  if (a === "BOARD") return "Board and manager";
  if (a.startsWith("FLOORS:")) return "Floors " + a.slice(7);
  if (a.startsWith("UNITS:")) return "Units " + a.slice(6);
  return a;
}

async function deliverTo(user: User & { units: { code: string }[] }, a: Announcement, channels: string[]) {
  const tl = user.language === "TL";
  const body = (tl && a.bodyTl) || a.bodyEn;
  const sms = ((tl && a.smsTl) || a.smsEn || body).slice(0, 450);
  const unitCode = user.units[0]?.code ?? null;
  const out: { channel: string; to: string | null; r: SendResult }[] = [];
  for (const ch of channels) {
    if (ch === "APP") out.push({ channel: ch, to: null, r: { status: "SENT", info: "In-app" } });
    if (ch === "SMS" && user.notifySms) out.push({ channel: ch, to: user.phone, r: await sendSms(user.phone, `Skyland: ${sms}`) });
    if (ch === "EMAIL" && user.notifyEmail) out.push({ channel: ch, to: user.email, r: await sendEmail(user.email, `Skyland: ${a.title}`, body) });
    if (ch === "MESSENGER" && user.notifyMessenger) out.push({ channel: ch, to: user.messengerPsid, r: await sendMessenger(user.messengerPsid, `${a.title}\n\n${body}`) });
  }
  if (out.length) await prisma.delivery.createMany({ data: out.map((o) => ({ announcementId: a.id, userId: user.id, unitCode, channel: o.channel, to: o.to, status: o.r.status, info: o.r.info })) });
  return out;
}

/** Sends one announcement to its audience. Safe to call twice: it only sends from SCHEDULED/APPROVED states. */
export async function dispatch(id: string) {
  const claimed = await prisma.announcement.updateMany({ where: { id, status: { in: ["SCHEDULED", "DRAFT", "PENDING_APPROVAL"] } }, data: { status: "SENDING" } });
  if (!claimed.count) return { sent: 0 };
  const a = await prisma.announcement.findUniqueOrThrow({ where: { id } });
  const { users } = await resolveAudience(a.audience);
  let sent = 0;
  // small batches so one slow provider doesn't time out the whole request
  for (let i = 0; i < users.length; i += 10) {
    const res = await Promise.all(users.slice(i, i + 10).map((u) => deliverTo(u, a, a.channels)));
    sent += res.flat().length;
  }
  await prisma.announcement.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  if (a.kind === "URGENT") {
    const managers = await prisma.user.findMany({ where: { role: { in: ["MANAGER"] }, active: true }, include: { units: true } });
    const note = await prisma.announcement.create({ data: { kind: "TICKET", category: "Manager alert", title: `Urgent alert sent: ${a.title}`, bodyEn: `An urgent alert went to ${users.length} owners (${sent} messages). Check replies and follow up.`, audience: "BOARD", channels: ["APP", "SMS"], status: "SENT", sentAt: new Date(), createdBy: "System" } });
    for (const m of managers) await deliverTo(m, note, ["APP", "SMS"]);
  }
  return { sent, recipients: users.length };
}

/** Sends a single automatic update to one owner (ticket changes, receipts). */
export async function notifyUser(userId: string, title: string, body: string, channels: string[] = ["APP", "SMS"]) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { units: true } });
  if (!user || !user.active) return;
  const a = await prisma.announcement.create({ data: { kind: "TICKET", category: "Automatic update", title, bodyEn: body, smsEn: body, audience: `UNITS:${user.units[0]?.code ?? ""}`, channels, status: "SENT", sentAt: new Date(), createdBy: "Automation" } });
  await deliverTo(user, a, channels);
}

/** Cron: send due scheduled announcements, open work orders for due maintenance, and queue the monthly dues reminder for approval. */
export async function runAutomations() {
  const now = nowManila();
  const due = await prisma.announcement.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true } });
  for (const d of due) await dispatch(d.id);

  const pm = await prisma.pMTask.findMany({ where: { nextDue: { lte: new Date(now.getTime() + 3 * 86400000) } } });
  let opened = 0;
  for (const t of pm) {
    if (t.lastWorkOrder) { const wo = await prisma.workOrder.findUnique({ where: { number: t.lastWorkOrder } }); if (wo && wo.status !== "DONE") continue; }
    const wo = await prisma.workOrder.create({ data: { title: `Preventive maintenance: ${t.task}`, location: t.asset, category: "Preventive", priority: t.compliance ? "HIGH" : "MEDIUM", slaHours: 72, assignee: t.assignee ?? t.vendor, source: "PM calendar", status: t.assignee || t.vendor ? "ASSIGNED" : "NEW", events: { create: { note: `Opened automatically: due ${t.nextDue.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}.`, author: "PM calendar" } } } });
    await prisma.pMTask.update({ where: { id: t.id }, data: { lastWorkOrder: wo.number } });
    opened++;
  }

  // On or after the 25th, queue this month's dues reminder for manager approval (once).
  const day = Number(now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }));
  const period = currentPeriod(now);
  let queued = false;
  if (day >= 25 && !(await prisma.announcement.findFirst({ where: { kind: "REMINDER", category: `Dues ${period}` } }))) {
    await prisma.announcement.create({ data: { kind: "REMINDER", category: `Dues ${period}`, title: `${monthLong(period)} dues are due on the last day of the month`,
      bodyEn: `Hi! A friendly reminder that ${monthLong(period)} association dues are due on the last day of the month. Pay in seconds from the owner portal with GCash, Maya or card. If you've already paid, thank you!`,
      bodyTl: `Hi po! Paalala lang na ang ${monthLong(period)} dues ay due sa huling araw ng buwan. Pwede po kayong magbayad sa owner portal gamit ang GCash, Maya o card. Kung nakabayad na kayo, salamat po!`,
      smsEn: `Reminder: ${monthLong(period)} dues are due at month-end. Pay via GCash/Maya/card in the owner portal. Thank you!`,
      smsTl: `Paalala po: ang ${monthLong(period)} dues ay due sa katapusan. Magbayad via GCash/Maya/card sa owner portal. Salamat po!`,
      audience: "ALL", channels: ["APP", "SMS", "EMAIL"], status: "PENDING_APPROVAL", aiDrafted: false, createdBy: "Automation" } });
    queued = true;
  }
  void addMonths;
  return { sent: due.length, pmOpened: opened, duesReminderQueued: queued };
}

/** Sends scheduled announcements whose time has come. Cheap; called when managers open pages. */
export async function sendDueScheduled() {
  const due = await prisma.announcement.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: nowManila() } }, select: { id: true } });
  for (const d of due) await dispatch(d.id);
  return due.length;
}
