import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { collectionTrend, overdueAccounts, slaStats, budgetFor, latestClosedPeriod } from "@/lib/metrics";
import { peso, pesoK, monthLabel, monthLong, fmtDateTime, nowManila, currentPeriod } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Board() {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const closed = await latestClosedPeriod();
  const [trend, overdue, sla, budget, openWO, escalated, recent, nov] = await Promise.all([
    collectionTrend(12), overdueAccounts(), slaStats(30), budgetFor(closed),
    prisma.workOrder.count({ where: { status: { not: "DONE" } } }),
    prisma.workOrder.findMany({ where: { status: "ESCALATED" }, take: 3, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { action: { in: ["payment", "work_order", "booking", "reminder", "report"] } }, orderBy: { createdAt: "desc" }, take: 6, include: { user: true } }),
    prisma.bill.aggregate({ where: { period: currentPeriod() }, _sum: { amount: true, paid: true } }),
  ]);
  const last = trend.find((t) => t.period === closed);
  const first = trend[0];
  const overBudget = budget.lines.filter((l) => Number(l.actual) > Number(l.budget) * 1.02);
  const overdueTotal = overdue.reduce((s, o) => s + o.amount, 0);
  const novPct = nov._sum.amount ? (Number(nov._sum.paid) / Number(nov._sum.amount)) * 100 : 0;
  return (
    <>
      <PageHead title="Today at Skyland" sub={`Board view · ${nowManila().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full" })}`} />
      <main className="view">
        <div className="grid g4">
          <Kpi k={`${monthLong(closed)} collections`} v={`${last?.rate.toFixed(1) ?? "–"}%`} d={first && last ? <span className={last.rate >= first.rate ? "up" : "down"}>{last.rate >= first.rate ? "▲" : "▼"} {Math.abs(last.rate - first.rate).toFixed(1)} pts in 12 months</span> : null} />
          <Kpi k="Open work orders" v={openWO} d={<><span className="up">{sla.pct.toFixed(0)}% on time</span> · {escalated.length} escalated</>} />
          <Kpi k="Overdue balances" v={pesoK(overdueTotal)} cls="amber" d={<span className="hint">{overdue.length} units</span>} />
          <Kpi k={`${monthLabel(currentPeriod())} dues collected`} v={`${novPct.toFixed(0)}%`} d={<span className="hint">{peso(Number(nov._sum.paid ?? 0))} of {peso(Number(nov._sum.amount ?? 0))}</span>} />
        </div>
        <div className="grid g-7-5">
          <div className="card">
            <div className="cardhead"><div><span className="ai-badge">What needs attention</span><h3 style={{ marginTop: 6 }}>Board briefing</h3></div></div>
            <div className="list">
              {escalated.map((w) => (
                <div className="li" key={w.id}><span className="dot" style={{ background: "var(--bad)" }} /><div><b>Escalated: {w.title}</b> ({w.location}). Opened {fmtDateTime(w.createdAt)}, assigned to {w.assignee ?? "manager"}. <Link href="/work-orders" style={{ color: "var(--accent)" }}>View</Link></div></div>
              ))}
              {overBudget.map((l) => (
                <div className="li" key={l.id}><span className="dot" style={{ background: "var(--warn)" }} /><div><b>{l.category} was {((Number(l.actual) / Number(l.budget) - 1) * 100).toFixed(1)}% over budget in {monthLong(closed)}.</b> {l.note}</div></div>
              ))}
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>{monthLabel(currentPeriod())} dues: {peso(Number(nov._sum.paid ?? 0))} collected so far ({novPct.toFixed(0)}%).</b> {overdue.filter((o) => o.days > 60).length} units are more than 60 days late, owing {peso(overdue.filter((o) => o.days > 60).reduce((s, o) => s + o.amount, 0))}.</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--accent)" }} /><div><b>{sla.closed} repairs closed in the last 30 days</b>, {sla.pct.toFixed(0)}% within deadline, average owner rating {sla.rating.toFixed(1)}/5.</div></div>
            </div>
          </div>
          <div className="card">
            <div className="cardhead"><div><h3>Collection rate, last 12 months</h3><div className="hint">Share of each month&apos;s dues paid by the due date</div></div></div>
            <LineChart vals={trend.slice(0, -1).map((t) => t.rate)} labels={trend.slice(0, -1).map((t) => monthLabel(t.period))} min={76} max={100} fmt={(v) => v.toFixed(0) + "%"} />
          </div>
        </div>
        <div className="grid g2">
          <div className="card"><h3>Recent activity</h3>
            <div className="list" style={{ marginTop: 6 }}>
              {recent.length ? recent.map((r) => <div className="li" key={r.id}><span className="dot" style={{ background: "var(--accent)" }} /><div><b>{r.user?.name ?? "System"}</b> · <span className="hint">{fmtDateTime(r.createdAt)}</span><div>{r.detail}</div></div></div>) : <div className="hint">Payments, tickets and bookings will appear here as they happen.</div>}
            </div>
          </div>
          <div className="card"><h3>Spending, {monthLong(closed)}</h3><div className="hint">{peso(budget.actual)} against a budget of {peso(budget.budget)} ({budget.variance >= 0 ? "+" : ""}{budget.variance.toFixed(1)}%)</div>
            <div style={{ marginTop: 12 }}><Link className="btn pri" href="/finances">Open finances and AI report</Link></div>
          </div>
        </div>
      </main>
    </>
  );
}
