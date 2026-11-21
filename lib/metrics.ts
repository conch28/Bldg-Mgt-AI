import { prisma } from "./db";
import { addMonths, currentPeriod, nowManila } from "./format";

/** Share of each period's billing paid by the end of that period. */
export async function collectionTrend(months = 12) {
  const end = currentPeriod();
  const periods = Array.from({ length: months }, (_, i) => addMonths(end, i - months + 1));
  const rows = await prisma.$queryRaw<{ period: string; billed: number; ontime: number; collected: number }[]>`
    SELECT b.period,
           SUM(b.amount)::float AS billed,
           COALESCE(SUM(p.amt_ontime),0)::float AS ontime,
           COALESCE(SUM(p.amt),0)::float AS collected
    FROM "Bill" b
    LEFT JOIN (
      SELECT p."billId", SUM(p.amount) AS amt,
             SUM(CASE WHEN p."createdAt" <= bb."dueDate" THEN p.amount ELSE 0 END) AS amt_ontime
      FROM "Payment" p JOIN "Bill" bb ON bb.id = p."billId" GROUP BY p."billId"
    ) p ON p."billId" = b.id
    WHERE b.period = ANY(${periods})
    GROUP BY b.period ORDER BY b.period`;
  return rows.map((r) => ({ period: r.period, billed: r.billed, collected: r.collected, rate: r.billed ? (r.ontime / r.billed) * 100 : 0 }));
}

export async function overdueAccounts() {
  const now = nowManila();
  const bills = await prisma.bill.findMany({
    where: { status: { not: "PAID" }, dueDate: { lt: now } },
    include: { unit: { include: { owner: true } }, reminders: { orderBy: { sentAt: "desc" }, take: 1 } },
    orderBy: { dueDate: "asc" },
  });
  const byUnit = new Map<string, { unitId: string; code: string; owner: string; phone?: string | null; amount: number; oldestDue: Date; billIds: string[]; lastReminder?: Date }>();
  for (const b of bills) {
    const e = byUnit.get(b.unitId) ?? { unitId: b.unitId, code: b.unit.code, owner: b.unit.owner?.name ?? b.unit.ownerName ?? "Owner", phone: b.unit.owner?.phone, amount: 0, oldestDue: b.dueDate, billIds: [] as string[] };
    e.amount += Number(b.amount) - Number(b.paid);
    e.billIds.push(b.id);
    if (b.dueDate < e.oldestDue) e.oldestDue = b.dueDate;
    const r = b.reminders[0]?.sentAt; if (r && (!e.lastReminder || r > e.lastReminder)) e.lastReminder = r;
    byUnit.set(b.unitId, e);
  }
  return [...byUnit.values()].map((e) => ({ ...e, days: Math.floor((now.getTime() - e.oldestDue.getTime()) / 86400000) })).sort((a, b) => b.days - a.days || b.amount - a.amount);
}

export function toneFor(days: number) {
  return days > 90 ? "final" : days > 45 ? "firm" : days > 14 ? "friendly" : "nudge";
}

export async function slaStats(days = 30) {
  const since = new Date(nowManila().getTime() - days * 86400000);
  const closed = await prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { gte: since } }, select: { createdAt: true, closedAt: true, slaHours: true, rating: true } });
  const onTime = closed.filter((w) => w.closedAt!.getTime() - w.createdAt.getTime() <= w.slaHours * 3600000).length;
  const rated = closed.filter((w) => w.rating != null);
  return {
    closed: closed.length, onTime, pct: closed.length ? (onTime / closed.length) * 100 : 0,
    rating: rated.length ? rated.reduce((s, w) => s + (w.rating ?? 0), 0) / rated.length : 0, ratedCount: rated.length,
  };
}

export async function budgetFor(period: string) {
  const lines = await prisma.budgetLine.findMany({ where: { period }, orderBy: { budget: "desc" } });
  const budget = lines.reduce((s, l) => s + Number(l.budget), 0);
  const actual = lines.reduce((s, l) => s + Number(l.actual), 0);
  return { lines, budget, actual, variance: budget ? (actual / budget - 1) * 100 : 0 };
}

export async function latestClosedPeriod() {
  const l = await prisma.budgetLine.findFirst({ orderBy: { period: "desc" }, select: { period: true } });
  return l?.period ?? addMonths(currentPeriod(), -1);
}

export async function spendTrend(months = 11) {
  const rows = await prisma.budgetLine.groupBy({ by: ["period"], _sum: { actual: true, budget: true }, orderBy: { period: "desc" }, take: months });
  return rows.reverse().map((r) => ({ period: r.period, actual: Number(r._sum.actual), budget: Number(r._sum.budget) }));
}
