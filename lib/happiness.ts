/**
 * Resident happiness: the product's north-star metric.
 * Score (0-100) = average of pulse ratings (monthly check-ins + post-repair surveys; rating a repair
 * also records a pulse), mapped 1★→0, 5★→100. Also tracks themes, residents who may be unhappy, and time AI saved the team.
 */
import { prisma } from "./db";
import { nowManila, currentPeriod, addMonths } from "./format";

const toScore = (stars: number) => ((stars - 1) / 4) * 100;
const monthStart = (period: string) => new Date(`${period}-01T00:00:00+08:00`);

export async function happinessTrend(months = 6) {
  const cur = currentPeriod();
  const from = monthStart(addMonths(cur, -(months - 1)));
  const pulses = await prisma.pulse.findMany({ where: { createdAt: { gte: from } }, select: { score: true, createdAt: true } });
  const all = pulses.map((p) => ({ s: p.score, d: p.createdAt }));
  return Array.from({ length: months }, (_, i) => {
    const period = addMonths(cur, i - (months - 1));
    const a = monthStart(period), b = monthStart(addMonths(period, 1));
    const xs = all.filter((x) => x.d >= a && x.d < b);
    return { period, score: xs.length ? xs.reduce((s, x) => s + toScore(x.s), 0) / xs.length : 0, n: xs.length };
  });
}

export async function happinessNow() {
  const since = new Date(nowManila().getTime() - 30 * 86400000);
  const [pulses, prev] = await Promise.all([
    prisma.pulse.findMany({ where: { createdAt: { gte: since } } }),
    happinessTrend(2),
  ]);
  const stars = pulses.map((p) => p.score);
  const score = stars.length ? stars.reduce((s, x) => s + toScore(x), 0) / stars.length : 0;
  const promoters = stars.filter((s) => s === 5).length, detractors = stars.filter((s) => s <= 2).length;
  const owners = await prisma.user.count({ where: { role: "OWNER", active: true } });
  const responders = new Set(pulses.map((p) => p.userId)).size;
  return { score, responses: stars.length, promoters, detractors, responseRate: owners ? (responders / owners) * 100 : 0, lastMonth: prev[0]?.score ?? 0 };
}

export async function happinessDrivers(days = 90) {
  const since = new Date(nowManila().getTime() - days * 86400000);
  const pulses = await prisma.pulse.findMany({ where: { createdAt: { gte: since }, topic: { not: null } }, select: { topic: true, score: true } });
  const m = new Map<string, { n: number; sum: number; neg: number }>();
  for (const p of pulses) { const e = m.get(p.topic!) ?? { n: 0, sum: 0, neg: 0 }; e.n++; e.sum += p.score; if (p.score <= 2) e.neg++; m.set(p.topic!, e); }
  return [...m.entries()].map(([topic, e]) => ({ topic, n: e.n, score: toScore(e.sum / e.n), neg: e.neg })).sort((a, b) => a.score - b.score);
}

/** Residents whose latest rating was 1-2★ and nobody has followed up yet. */
export async function atRiskResidents() {
  return prisma.pulse.findMany({ where: { score: { lte: 2 }, followedUp: null, createdAt: { gte: new Date(nowManila().getTime() - 45 * 86400000) } }, orderBy: { createdAt: "desc" }, include: { user: true }, take: 12 });
}

/** Rough minutes of manager/admin time each automated action replaces. Shown as "hours AI saved". */
const MINUTES = { chat: 6, ticket: 5, draft: 25, update: 2, reminder: 4, report: 180, pass: 2 };
export async function aiSavings(days = 30) {
  const since = new Date(nowManila().getTime() - days * 86400000);
  const [chat, tickets, drafts, updates, reminders, reports, passes] = await Promise.all([
    prisma.chatMessage.count({ where: { role: "assistant", createdAt: { gte: since } } }),
    prisma.workOrder.count({ where: { source: { in: ["Chat", "PM calendar"] }, createdAt: { gte: since } } }),
    prisma.announcement.count({ where: { aiDrafted: true, createdAt: { gte: since } } }),
    prisma.delivery.count({ where: { createdAt: { gte: since }, announcement: { kind: "TICKET" } } }),
    prisma.reminder.count({ where: { sentAt: { gte: since } } }),
    prisma.report.count({ where: { createdAt: { gte: since } } }),
    prisma.pass.count({ where: { createdAt: { gte: since } } }),
  ]);
  const items = [
    { k: "Helpdesk questions answered by AI", n: chat, m: MINUTES.chat },
    { k: "Tickets filed automatically", n: tickets, m: MINUTES.ticket },
    { k: "Announcements drafted by AI", n: drafts, m: MINUTES.draft },
    { k: "Automatic ticket updates and receipts", n: updates, m: MINUTES.update },
    { k: "Dues reminders written and sent", n: reminders, m: MINUTES.reminder },
    { k: "Board reports written by AI", n: reports, m: MINUTES.report },
    { k: "Visitor passes (no calls to units)", n: passes, m: MINUTES.pass },
  ];
  return { items, hours: items.reduce((s, i) => s + i.n * i.m, 0) / 60 };
}

export const scoreTone = (s: number) => (s >= 80 ? "up" : s >= 65 ? "amber" : "down");
export const scoreWord = (s: number) => (s >= 85 ? "Delighted" : s >= 75 ? "Happy" : s >= 65 ? "Okay" : s >= 50 ? "Mixed" : "Unhappy");
