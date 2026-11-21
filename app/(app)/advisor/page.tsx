import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import Tip from "@/components/Tip";
import { LineChart } from "@/components/charts";
import { WeatherCard } from "@/components/Weather";
import { savingsIdeas, advisorFallback, leakCheck, RATES } from "@/lib/advisor";
import { savingsThisYear } from "@/lib/procurement";
import { writeAdvice } from "@/lib/ai";
import { getWeather } from "@/lib/weather";
import { REGULATIONS, REVIEWED } from "@/lib/regulations";
import { peso, pesoK, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
const TAG_CLS: Record<string, string> = { Deadline: "t-warn", Safety: "t-bad", Tax: "t-acc", Privacy: "t-mut", Governance: "t-mut", Utilities: "t-acc", Weather: "t-warn" };

export default async function Advisor({ searchParams }: { searchParams: { wx?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const [ideas, saved, leak, weather] = await Promise.all([savingsIdeas(), savingsThisYear(), leakCheck(), getWeather({ drill: searchParams.wx === "storm" })]);
  const total = ideas.reduce((s, i) => s + i.perYear, 0);
  const facts = `Potential yearly savings: ${peso(total)}.\n` + ideas.map((i) => `- ${i.title}: ${peso(i.perYear)}/yr (${i.effort}, confidence ${i.confidence}${i.urgent ? ", URGENT" : ""}). ${i.why}`).join("\n") + `\nAlready saved this year by procurement controls: ${peso(saved.total)}.`;
  const note = await writeAdvice(facts, advisorFallback(ideas));
  const regs = [...REGULATIONS].sort((a, b) => a.priority - b.priority);

  return (
    <>
      <PageHead title="AI advisor" sub="Ways to save money, rules to stay on top of, and the weather ahead" />
      <main className="view">
        <Tip id="advisor" title="Every number comes from Skyland's own records.">Meter readings from guard rounds, budgets, the asset register, vendor contracts and purchases. Assumptions are written next to each estimate so the board can check them.</Tip>

        <div className="card advisor-hero">
          <div className="adv-total"><span className="ai-badge">{note.ai ? "AI summary" : "Summary"}</span>
            <div className="big num">{pesoK(total)}<small>/year</small></div>
            <div className="hint">possible savings from {ideas.filter((i) => i.perYear > 0).length} ideas</div>
          </div>
          <div className="adv-note">
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{note.text}</p>
            <div className="adv-saved"><b className="num">{peso(saved.total)}</b> already saved this year by the purchase controls: {peso(saved.quotes)} from choosing cheaper quotes on {saved.compared} purchases, {peso(saved.warranty)} from {saved.claims} warranty claims. <Link href="/procurement?tab=controls">See controls</Link></div>
          </div>
        </div>

        <h2 className="section-h">Savings ideas</h2>
        <div className="ideas">
          {ideas.map((i) => (
            <div className={"card idea" + (i.urgent ? " urgent" : "")} key={i.key}>
              <div className="idea-top">
                <b>{i.title}</b>
                <span className="idea-amt num">{i.perYear ? `${peso(i.perYear)}/yr` : "Up to 20%"}</span>
              </div>
              <div className="row" style={{ gap: 6 }}>{i.urgent && <span className="tag t-bad">Act now</span>}<span className="tag t-acc">{i.effort}</span><span className="tag t-mut">{i.confidence} confidence</span></div>
              <p className="hint" style={{ margin: "8px 0 4px" }}>{i.why}</p>
              <div style={{ fontSize: 13 }}><b>Do:</b> {i.action}</div>
              {i.href && <Link href={i.href} className="btn sm" style={{ marginTop: 8 }}>Open</Link>}
            </div>
          ))}
        </div>
        <div className="hint">Assumed rates: electricity ₱{RATES.kwh}/kWh, water and sewer ₱{RATES.water}/m³. Change them in lib/advisor.ts when the latest bills come in.</div>

        <div className="grid g-7-5">
          <div className="card">
            <span className="ai-badge">From guard meter readings</span>
            <h3 style={{ marginTop: 4 }}>Night-time water flow</h3>
            <div className="hint">m³ per hour between the late-night and early-morning readings. Almost nobody uses water then, so a rise means a leak.</div>
            {leak && leak.series.length > 1 ? (
              <>
                <LineChart vals={leak.series.map((s) => Number(s.perHour.toFixed(2)))} labels={leak.series.map((s, i) => (i % 4 === 0 || i === leak.series.length - 1 ? new Date(s.date + "T12:00:00+08:00").toLocaleDateString("en-PH", { day: "numeric", month: "short" }) : ""))} min={0} max={Math.ceil(Math.max(...leak.series.map((s) => s.perHour)) + 0.5)} fmt={(v) => v.toFixed(1)} />
                <div className={leak.leak ? "err" : "okmsg"} style={{ marginTop: 8 }}>{leak.leak ? `Up ${Math.round(leak.rise * 100)}% since ${fmtDate(new Date(leak.since + "T12:00:00+08:00"))}. Likely a hidden leak: about ${Math.round((leak.recent - leak.baseline) * 24)} m³ a day.` : "Normal. No sign of a hidden leak."}</div>
              </>
            ) : <div className="empty" style={{ marginTop: 8 }}>Needs a week of guard night readings to start.</div>}
          </div>
          <WeatherCard w={weather} staff={staff} drillHref="/advisor?wx=storm#weather" />
        </div>

        <h2 className="section-h" id="rules">Government updates and rules for Skyland</h2>
        <div className="hint" style={{ marginTop: -6, marginBottom: 8 }}>Curated by Building Mgt AI, last reviewed {fmtDate(new Date(REVIEWED + "T12:00:00+08:00"))}. Summaries, not legal advice: check the source before acting.</div>
        <div className="card" style={{ padding: "4px 16px" }}>
          {regs.map((r) => (
            <details className="reg" key={r.key} open={r.priority === 1}>
              <summary>
                <span className={"tag " + TAG_CLS[r.tag]}>{r.tag}</span>
                <b>{r.title}</b>
                <span className="hint reg-ag">{r.agency}</span>
              </summary>
              <div className="reg-body">
                {r.when && <div className="hint"><b>When:</b> {r.when}</div>}
                <p>{r.summary}</p>
                <div><b>What Skyland should do:</b> {r.action}</div>
                <div className="hint" style={{ marginTop: 6 }}>Source: {r.source} · <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url.replace(/^https?:\/\/(www\.)?/, "")}</a></div>
              </div>
            </details>
          ))}
        </div>
      </main>
    </>
  );
}
