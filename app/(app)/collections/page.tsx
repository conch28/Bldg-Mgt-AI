import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import { LineChart } from "@/components/charts";
import ReminderPanel from "@/components/ReminderPanel";
import SubmitButton from "@/components/SubmitButton";
import { collectionTrend, overdueAccounts } from "@/lib/metrics";
import { peso, pesoK, monthLabel, currentPeriod, fmtDate } from "@/lib/format";
import { recordPayment } from "./actions";

export const dynamic = "force-dynamic";

export default async function Collections() {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const [trend, overdue, cur, methods] = await Promise.all([
    collectionTrend(12), overdueAccounts(),
    prisma.bill.aggregate({ where: { period: currentPeriod() }, _sum: { amount: true, paid: true } }),
    prisma.payment.groupBy({ by: ["method"], _sum: { amount: true }, where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } } }),
  ]);
  const total = overdue.reduce((s, o) => s + o.amount, 0);
  const buckets = [[0, 30, "1–30 days", "var(--accent)"], [31, 60, "31–60 days", "var(--warn)"], [61, 90, "61–90 days", "var(--warn)"], [91, 99999, "Over 90 days", "var(--bad)"]] as const;
  const bsum = buckets.map(([a, b]) => overdue.filter((o) => o.days >= a && o.days <= b));
  const bmax = Math.max(1, ...bsum.map((x) => x.reduce((s, o) => s + o.amount, 0)));
  const mt = methods.reduce((s, m) => s + Number(m._sum.amount), 0);
  const digital = methods.filter((m) => ["GCash", "Maya", "Card"].includes(m.method)).reduce((s, m) => s + Number(m._sum.amount), 0);
  const last = trend[trend.length - 2];
  return (
    <>
      <PageHead title="Dues & collections" sub={`${monthLabel(currentPeriod())} billing · due on the last day of the month`} />
      <main className="view">
        <div className="grid g4">
          <Kpi k={`${monthLabel(currentPeriod())} billed`} v={pesoK(Number(cur._sum.amount ?? 0))} d={<span className="hint">{peso(Number(cur._sum.paid ?? 0))} paid so far</span>} />
          <Kpi k={`${monthLabel(last.period)} collection rate`} v={`${last.rate.toFixed(1)}%`} d={<span className="hint">paid by due date</span>} />
          <Kpi k="Total overdue" v={pesoK(total)} cls="amber" d={<span className="hint">{overdue.length} units</span>} />
          <Kpi k="Paid digitally (90 days)" v={`${mt ? ((digital / mt) * 100).toFixed(0) : 0}%`} d={<span className="hint">GCash, Maya, card</span>} />
        </div>
        <ReminderPanel canSend={u.role !== "BOARD"} rows={overdue.map((o) => ({ unitId: o.unitId, code: o.code, owner: o.owner, amount: o.amount, days: o.days, lastReminder: o.lastReminder ? fmtDate(o.lastReminder) : undefined }))} />
        <div className="grid g2">
          <div className="card"><h3>Aging of receivables</h3><div className="hint">Total {peso(total)} overdue</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {buckets.map(([, , l, c], i) => { const s = bsum[i].reduce((x, o) => x + o.amount, 0); return (
                <div key={l}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span><b>{l}</b> · <span className="hint">{bsum[i].length} units</span></span><span className="num">{peso(s)}</span></div>
                  <div className="hbar" style={{ marginTop: 4 }}><span style={{ width: `${(s / bmax) * 100}%`, background: c }} /></div></div>); })}
            </div></div>
          <div className="card"><h3>Collection rate, last 12 months</h3>
            <LineChart vals={trend.slice(0, -1).map((t) => t.rate)} labels={trend.slice(0, -1).map((t) => monthLabel(t.period))} min={76} max={100} fmt={(v) => v.toFixed(0) + "%"} /></div>
        </div>
        {u.role !== "BOARD" && <div className="card"><h3>Record a payment</h3><div className="hint">For bank deposits, cheques and cash at the admin office. Applied to the oldest unpaid month first.</div>
          <form action={recordPayment} className="inline-form" style={{ marginTop: 12 }}>
            <input name="unit" required placeholder="Unit, e.g. 12B" aria-label="Unit" style={{ width: 120 }} />
            <input name="amount" required type="number" step="0.01" min="1" placeholder="Amount (₱)" aria-label="Amount" style={{ width: 130 }} />
            <select name="method" aria-label="Method"><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>GCash</option><option>Maya</option></select>
            <input name="reference" required placeholder="OR / reference no." aria-label="Reference" style={{ width: 160 }} />
            <SubmitButton label="Record payment" small />
          </form></div>}
      </main>
    </>
  );
}
