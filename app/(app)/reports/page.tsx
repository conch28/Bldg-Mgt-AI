import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi, Markdown } from "@/components/ui";
import { Bars } from "@/components/charts";
import DuesPlanner from "@/components/DuesPlanner";
import { budgetFor, collectionTrend, latestClosedPeriod, spendTrend } from "@/lib/metrics";
import { peso, pesoK, monthLabel, monthLong, fmtDateTime } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { createReport } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function Finances() {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const period = await latestClosedPeriod();
  const [b, trend, spend, reports, building, unitCount] = await Promise.all([
    budgetFor(period), collectionTrend(12), spendTrend(11),
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.building.findFirst(), prisma.unit.count(),
  ]);
  const m = trend.find((t) => t.period === period);
  const income = spend.map((s) => trend.find((t) => t.period === s.period)?.collected ?? 0);
  const max = Math.ceil(Math.max(...income, ...spend.map((s) => s.actual)) / 500000) * 500000;
  const canGenerate = u.role !== "BOARD";
  return (
    <>
      <PageHead title="Finances & reports" sub={`${monthLong(period)} books · every peso traceable to a vendor`} />
      <main className="view">
        <div className="grid g4">
          <Kpi k={`${monthLabel(period)} billed`} v={pesoK(m?.billed ?? 0)} d={<span className="hint">{unitCount} units · ₱{Number(building?.duesRate ?? 0)}/sqm</span>} />
          <Kpi k={`${monthLabel(period)} collected`} v={pesoK(m?.collected ?? 0)} d={<span className="up">{m?.rate.toFixed(1)}% by due date</span>} />
          <Kpi k={`${monthLabel(period)} spending`} v={pesoK(b.actual)} cls={b.variance > 0 ? "amber" : ""} d={<span className={b.variance > 0 ? "amber" : "up"}>{b.variance >= 0 ? "+" : ""}{b.variance.toFixed(1)}% vs budget</span>} />
          <Kpi k="Budget lines" v={b.lines.length} d={<span className="hint">{b.lines.filter((l) => Number(l.actual) > Number(l.budget)).length} over budget</span>} />
        </div>
        <div className="grid g-7-5">
          <div className="card">
            <div className="cardhead"><div><h3>Where {monthLong(period)}&apos;s money went</h3><div className="hint">Bar is actual spend; the marker is the budget. Amber means over budget.</div></div></div>
            {b.lines.map((l) => { const a = Number(l.actual), bu = Number(l.budget), over = a > bu, v = (a / bu - 1) * 100; return (
              <div className="budget-row" key={l.id} title={l.note ?? l.vendor}>
                <span>{l.category}<div className="hint" style={{ fontSize: 11.5 }}>{l.vendor}{l.note ? ` · ${l.note}` : ""}</div></span>
                <div className="bb"><div className={"fill" + (over ? " over" : "")} style={{ width: `${(a / 500000) * 100}%` }} /><div className="mark" style={{ left: `${(bu / 500000) * 100}%` }} /></div>
                <span className="num" style={{ textAlign: "right" }}>{peso(a)}</span>
                <span className={"num " + (over ? "amber" : v < 0 ? "up" : "hint")} style={{ textAlign: "right" }}>{Math.abs(v) < 0.05 ? "on budget" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"}</span>
              </div>); })}
            <div className="budget-row" style={{ fontWeight: 700 }}><span>Total</span><span /><span className="num" style={{ textAlign: "right" }}>{peso(b.actual)}</span><span className="num" style={{ textAlign: "right" }}>{b.variance >= 0 ? "+" : ""}{b.variance.toFixed(1)}%</span></div>
          </div>
          <div className="card">
            <h3>Income vs spending</h3>
            <div className="legend" style={{ margin: "4px 0 8px" }}><span><i style={{ background: "var(--accent)" }} />Dues collected</span><span><i style={{ background: "var(--warn)", opacity: 0.75 }} />Spending</span></div>
            <Bars a={income} b={spend.map((s) => s.actual)} labels={spend.map((s) => monthLabel(s.period))} max={max} />
          </div>
        </div>
        <div className="grid g2">
          <div className="card">
            <div className="cardhead"><div><span className="ai-badge">AI board report</span><h3 style={{ marginTop: 6 }}>{monthLong(period)} monthly report</h3><div className="hint">{aiEnabled() ? "Written by Claude from the ledger, collections and tickets." : "Template mode. Set ANTHROPIC_API_KEY to have Claude write it."} Review before sending to the board.</div></div>
              {canGenerate && <div className="r"><form action={createReport}><SubmitButton label={reports.length ? "Regenerate" : "Generate report"} busy="Writing…" /></form></div>}
            </div>
            {reports[0] ? <><Markdown text={reports[0].content} /><div className="hint" style={{ marginTop: 8 }}>Drafted {fmtDateTime(reports[0].createdAt)} by {reports[0].createdBy} · {reports[0].model}</div></> : <div className="hint">No report yet for this month.{canGenerate ? " Press Generate report." : " The manager will publish it here."}</div>}
          </div>
          <div className="card"><span className="ai-badge">Dues increase planner</span><h3 style={{ margin: "6px 0 10px" }}>Do we need to raise dues next year, and by how much?</h3>
            <DuesPlanner billed={m?.billed ?? 1} units={unitCount} rate={Number(building?.duesRate ?? 98)} typicalSqm={45} />
          </div>
        </div>
      </main>
    </>
  );
}
