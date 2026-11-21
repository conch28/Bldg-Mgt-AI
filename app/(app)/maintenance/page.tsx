import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import { fmtDate, nowManila } from "@/lib/format";
import { markDone } from "./actions";

export const dynamic = "force-dynamic";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const every = (n: number) => (n === 7 ? "Weekly" : n === 30 ? "Monthly" : n === 90 ? "Quarterly" : n === 180 ? "Every 6 months" : n === 365 ? "Yearly" : `Every ${n} days`);

export default async function Maintenance({ searchParams }: { searchParams: { ok?: string; m?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const tasks = await prisma.pMTask.findMany({ orderBy: { nextDue: "asc" } });
  const offset = Number(searchParams.m ?? 0) || 0;
  const [y, mo] = ymd(now).split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1 + offset, 1));
  const label = first.toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  const lead = first.getUTCDay();
  const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  // project recurring tasks forward into the month shown
  const events = new Map<string, { t: (typeof tasks)[number]; late: boolean }[]>();
  const monthEnd = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1) + 86400000);
  for (const t of tasks) {
    let d = new Date(t.nextDue);
    while (d < monthEnd) { const k = ymd(d); events.set(k, [...(events.get(k) ?? []), { t, late: d < now }]); d = new Date(d.getTime() + t.frequencyDays * 86400000); if (t.frequencyDays < 1) break; }
  }
  const overdue = tasks.filter((t) => t.nextDue < now);
  const week = tasks.filter((t) => t.nextDue >= now && t.nextDue < new Date(now.getTime() + 7 * 86400000));
  const today = ymd(now);
  return (
    <>
      <PageHead title="Maintenance calendar" sub="Preventive maintenance and compliance checks. Work orders open automatically 3 days before each due date." />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <div className="grid g4">
          <Kpi k="Overdue" v={overdue.length} cls={overdue.length ? "down" : "up"} />
          <Kpi k="Due this week" v={week.length} />
          <Kpi k="Compliance items" v={tasks.filter((t) => t.compliance).length} d="BFP, DOLE and LGU requirements" />
          <Kpi k="Tracked assets" v={new Set(tasks.map((t) => t.asset)).size} />
        </div>
        <div className="card">
          <div className="cardhead"><h3>{label}</h3><div className="r"><a className="btn sm" href={`/maintenance?m=${offset - 1}`}>‹ Prev</a><a className="btn sm" href="/maintenance">This month</a><a className="btn sm" href={`/maintenance?m=${offset + 1}`}>Next ›</a></div></div>
          <div className="cal">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="hint" style={{ fontSize: 11, fontWeight: 700, textAlign: "center" }}>{d}</div>)}
            {cells.map((c, i) => c ? <div key={c} className={"d" + (c === today ? " today" : "")}><div className="dn">{Number(c.slice(8))}</div>
              {(events.get(c) ?? []).map((e, j) => <span key={j} className={"ev" + (e.late ? " bad" : e.t.compliance ? " warn" : "")} title={`${e.t.asset}: ${e.t.task}`}>{e.t.asset}</span>)}</div> : <div key={"x" + i} />)}
          </div>
          <div className="row hint" style={{ marginTop: 10, fontSize: 12 }}><span style={{ padding: "1px 6px", borderRadius: 5, background: "var(--accent-soft)" }}>Routine</span><span style={{ padding: "1px 6px", borderRadius: 5, background: "var(--warn-soft)" }}>Compliance</span><span style={{ padding: "1px 6px", borderRadius: 5, background: "var(--bad-soft)" }}>Overdue</span></div>
        </div>
        <div className="card"><h3>All tasks</h3><div className="tablewrap"><table>
          <thead><tr><th>Asset</th><th>Task</th><th>How often</th><th>Last done</th><th>Next due</th><th>Who</th><th></th></tr></thead>
          <tbody>{tasks.map((t) => <tr key={t.id}><td><b>{t.asset}</b>{t.compliance && <span className="tag t-warn" style={{ marginLeft: 6 }}>Compliance</span>}</td><td>{t.task}</td><td className="hint">{every(t.frequencyDays)}</td>
            <td className="hint">{t.lastDone ? fmtDate(t.lastDone) : "—"}</td><td><span className={"tag " + (t.nextDue < now ? "t-bad" : t.nextDue < new Date(now.getTime() + 7 * 86400000) ? "t-warn" : "t-mut")}>{fmtDate(t.nextDue)}</span></td>
            <td className="hint">{t.vendor ?? t.assignee ?? "—"}{t.lastWorkOrder ? ` · WO-${t.lastWorkOrder}` : ""}</td>
            <td className="r">{u.role !== "BOARD" && <form action={markDone}><input type="hidden" name="id" value={t.id} /><button className="btn sm">Mark done</button></form>}</td></tr>)}</tbody>
        </table></div></div>
      </main>
    </>
  );
}
