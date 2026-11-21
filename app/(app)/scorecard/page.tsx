import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { budgetFor, collectionTrend, latestClosedPeriod, slaStats } from "@/lib/metrics";
import { peso, monthLong, addMonths } from "@/lib/format";

export const dynamic = "force-dynamic";
const BASE = Number(process.env.MANAGER_BASE_SALARY ?? 70000);
const lin = (v: number, floor: number, target: number) => Math.max(0, Math.min(100, ((v - floor) / (target - floor)) * 100));

export default async function Scorecard() {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const period = await latestClosedPeriod();
  const [trend, sla, budget, report, manager] = await Promise.all([
    collectionTrend(12), slaStats(30), budgetFor(period),
    prisma.report.findFirst({ where: { period }, orderBy: { createdAt: "asc" } }),
    prisma.user.findFirst({ where: { role: "MANAGER", active: true } }),
  ]);
  const rate = trend.find((t) => t.period === period)?.rate ?? 0;
  const [y, m] = addMonths(period, 1).split("-").map(Number);
  const reportDeadline = new Date(Date.UTC(y, m - 1, 7, 15, 59));
  const reportOnTime = report ? report.createdAt <= reportDeadline : false;
  const K = [
    { k: "Dues collection rate", w: 25, actual: `${rate.toFixed(1)}%`, target: "≥ 92%", a: lin(rate, 80, 92) },
    { k: "Owner satisfaction (repair ratings)", w: 20, actual: `${sla.rating.toFixed(2)} / 5`, target: "≥ 4.5", a: lin(sla.rating, 3.5, 4.5) },
    { k: "Work orders closed within SLA", w: 20, actual: `${sla.pct.toFixed(0)}%`, target: "≥ 95%", a: lin(sla.pct, 80, 95) },
    { k: "Budget variance", w: 15, actual: `${budget.variance >= 0 ? "+" : ""}${budget.variance.toFixed(1)}%`, target: "within ±2%", a: lin(-Math.abs(budget.variance), -6, -2) },
    { k: "Board report by day 7", w: 10, actual: report ? (reportOnTime ? "On time" : "Late") : "Not yet", target: "Day 7", a: reportOnTime ? 100 : 0 },
  ];
  const wsum = K.reduce((s, k) => s + k.w, 0);
  const score = K.reduce((s, k) => s + k.w * k.a, 0) / wsum;
  const maxB = BASE * 0.2, bonus = (maxB * score) / 100;
  const R = 58, C = 2 * Math.PI * R;
  return (
    <>
      <PageHead title="Manager scorecard" sub={`Measured from live data · ${monthLong(period)} close and last 30 days`} />
      <main className="view">
        <div className="grid g-7-5">
          <div className="card">
            <div className="cardhead"><div><h3>{manager?.name ?? "Property manager"}</h3><div className="hint">KPI weights agreed with the board</div></div></div>
            <div className="tablewrap"><table>
              <thead><tr><th>KPI</th><th className="r">Weight</th><th className="r">Actual</th><th className="r">Target</th><th style={{ width: "28%" }}>Achievement</th></tr></thead>
              <tbody>{K.map((k) => (
                <tr key={k.k}><td>{k.k}</td><td className="r num">{k.w}%</td><td className="r num"><b>{k.actual}</b></td><td className="r hint">{k.target}</td>
                  <td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className="hbar" style={{ flex: 1 }}><span style={{ width: `${k.a}%`, background: k.a >= 100 ? "var(--ok)" : k.a >= 75 ? "var(--warn)" : "var(--bad)" }} /></div><span className="num" style={{ width: 36, textAlign: "right" }}>{k.a.toFixed(0)}%</span></div></td></tr>))}
                <tr><td>Safety &amp; compliance</td><td className="r num">10%</td><td className="r hint" colSpan={3}>Tracked by the board outside the app for now. A safety lapse forfeits the bonus.</td></tr>
              </tbody></table></div>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <h3>Score</h3>
            <svg className="score-ring" viewBox="0 0 150 150"><circle cx="75" cy="75" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="14" /><circle cx="75" cy="75" r={R} fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * score) / 100} ${C}`} transform="rotate(-90 75 75)" /><text x="75" y="82" textAnchor="middle" style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 800, fill: "var(--fg)" }}>{score.toFixed(0)}</text><text x="75" y="102" textAnchor="middle">out of 100</text></svg>
            <div><div className="big num">{peso(bonus)}</div><div className="hint">projected quarterly bonus (of {peso(maxB)} max, 20% of {peso(BASE)} base)</div></div>
            <div className="aibox" style={{ textAlign: "left", width: "100%" }}>The bonus is paid by Building Mgt AI from its own fee, not by the association. It is forfeited for any safety lapse or vendor kickback.</div>
          </div>
        </div>
      </main>
    </>
  );
}
