import { requireRole } from "@/lib/auth";
import { PageHead, Kpi } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { happinessNow, happinessTrend, aiSavings, scoreWord } from "@/lib/happiness";
import { collectionTrend, slaStats } from "@/lib/metrics";
import { savingsThisYear } from "@/lib/procurement";
import { STREAMS, PIPELINE, BUILDING_COSTS, YEAR1_OVERHEAD, unitEconomics } from "@/lib/investor";
import { peso, pesoK, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Read-only investor view: the business case on one page, backed by Skyland Plaza's live sample data. */
export default async function Investor() {
  await requireRole("INVESTOR", "ADMIN");
  const [hNow, hTrend, ai, trend, sla, saved] = await Promise.all([happinessNow(), happinessTrend(6), aiSavings(30), collectionTrend(12), slaStats(30), savingsThisYear()]);
  const ue = unitEconomics();
  const months = trend.slice(0, -1); // the current month is still open
  const first = months[0], last = months[months.length - 1];
  const hv = hTrend.map((t) => Math.round(t.score));
  return (
    <>
      <PageHead title="Investor snapshot" sub="Building Mgt AI · read-only view" />
      <main className="view">
        <div className="card">
          <span className="ai-badge">Our goal</span>
          <h2 style={{ margin: "8px 0 4px" }}>Happier residents, through innovation and heartfelt service.</h2>
          <div className="hint">AI handles the routine work, so every peso and hour goes to residents. Better service shows up in the numbers below: happier residents pay on time, and buildings spend less.</div>
        </div>

        <h3 style={{ margin: "18px 0 8px" }}>Results at Skyland Plaza (demo building)</h3>
        <div className="grid g4">
          <Kpi k="Resident happiness" v={`${Math.round(hNow.score)}/100`} d={<span className="hint">{scoreWord(hNow.score)} · {hNow.responses} ratings in 30 days</span>} />
          <Kpi k="Dues paid on time" v={`${last?.rate.toFixed(1) ?? "–"}%`} d={first && last ? <span className={last.rate >= first.rate ? "up" : "down"}>{last.rate >= first.rate ? "▲" : "▼"} {Math.abs(last.rate - first.rate).toFixed(1)} pts in 12 months</span> : null} />
          <Kpi k="Repairs within deadline" v={`${sla.pct.toFixed(0)}%`} d={<span className="hint">{sla.closed} closed in 30 days · {sla.rating.toFixed(1)}/5 rating</span>} />
          <Kpi k="AI hours saved" v={Math.round(ai.hours)} d={<span className="hint">last 30 days · {peso(saved.total)} saved on purchases this year</span>} />
        </div>
        <div className="grid g2">
          <div className="card"><h3>On-time collection rate</h3><div className="hint">Share of each month&apos;s dues paid by the due date</div>
            <LineChart vals={months.map((t) => t.rate)} labels={months.map((t) => monthLabel(t.period))} min={76} max={100} fmt={(v) => v.toFixed(0) + "%"} />
          </div>
          <div className="card"><h3>Resident happiness</h3><div className="hint">Monthly average of in-app ratings, out of 100</div>
            <LineChart vals={hv} labels={hTrend.map((t) => monthLabel(t.period))} min={Math.max(0, Math.floor((Math.min(...hv) - 5) / 10) * 10)} max={100} fmt={(v) => String(Math.round(v))} />
          </div>
        </div>

        <h3 style={{ margin: "18px 0 8px" }}>Unit economics, one mature building</h3>
        <div className="grid g4">
          <Kpi k="Revenue per month" v={pesoK(ue.revenue)} d={<span className="hint">8 revenue streams</span>} />
          <Kpi k="Gross profit" v={pesoK(ue.gross)} d={<span className="hint">{((ue.gross / ue.revenue) * 100).toFixed(0)}% after subcontractors</span>} />
          <Kpi k="Building contribution" v={pesoK(ue.contribution)} d={<span className="up">{(ue.margin * 100).toFixed(0)}% margin</span>} />
          <Kpi k="Profit with one building" v={pesoK(ue.oneBuildingProfit)} cls={ue.oneBuildingProfit > 0 ? "up" : "down"} d={<span className="hint">after {pesoK(YEAR1_OVERHEAD)}/mo year-1 overhead</span>} />
        </div>
        <div className="grid g-7-5">
          <div className="card">
            <h3>Where the money comes from</h3>
            <div className="hint">Monthly, PHP. Estimates from our P&amp;L model for a 400-unit tower at maturity.</div>
            <div className="list" style={{ marginTop: 6 }}>
              {STREAMS.map((s) => (
                <div className="li" key={s.k}><span className="dot" style={{ background: "var(--accent)" }} /><div style={{ flex: 1 }}><b>{s.k}</b><div className="hint">{peso(s.rev)} revenue · {peso(s.rev * (1 - s.costPct))} gross profit</div></div></div>
              ))}
              <div className="li"><span className="dot" style={{ background: "var(--warn)" }} /><div><b>Outsourced building costs</b><div className="hint">{peso(BUILDING_COSTS)} for the manager bonus, CPA, AI tools, insurance and transport. On-site staff are paid by the condo corporation at cost.</div></div></div>
            </div>
          </div>
          <div className="card">
            <h3>Why it scales</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>Profitable from one building.</b> No fixed team: AI does the routine work, specialists are outsourced.</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>Same software, every building.</b> Each new building adds about {pesoK(ue.contribution)} a month with little new overhead.</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>Plan: {PIPELINE.map((p) => `${p.n} buildings by end of ${p.k.toLowerCase()}`).join(", ")}.</b></div></div>
              <div className="li"><span className="dot" style={{ background: "var(--accent)" }} /><div><b>Incentives point at residents.</b> 60% of the on-site manager&apos;s bonus rides on happiness and repair speed.</div></div>
            </div>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 14 }}>Skyland figures are sample data for the demo. Unit economics are planning estimates, not results. This view is read-only. To see the app from a resident&apos;s or manager&apos;s seat, sign out and pick another demo login.</p>
      </main>
    </>
  );
}
