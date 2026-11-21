import Link from "next/link";
import { LineChart } from "@/components/charts";
import { happinessNow, happinessTrend, aiSavings, scoreTone, scoreWord } from "@/lib/happiness";
import { monthLabel } from "@/lib/format";
import { submitPulse } from "@/app/(app)/happiness/actions";

/** The north-star panel shown first on the board, manager and scorecard pages. */
export async function HappinessHero({ compact = false }: { compact?: boolean }) {
  const [now, trend, ai] = await Promise.all([happinessNow(), happinessTrend(6), aiSavings(30)]);
  const delta = now.score - (now.lastMonth || now.score);
  const vals = trend.map((t) => Math.round(t.score));
  return (
    <div className="card hero-happy">
      <div className="hh-score">
        <span className="ai-badge">North-star metric</span>
        <div className="k" style={{ marginTop: 8 }}>Resident Happiness Score</div>
        <div className={"hh-big " + scoreTone(now.score)}>{Math.round(now.score)}<small>/100</small></div>
        <div className="row" style={{ gap: 8 }}><span className={"tag " + (now.score >= 80 ? "t-ok" : now.score >= 65 ? "t-warn" : "t-bad")}>{scoreWord(now.score)}</span>
          <span className={delta >= 0 ? "up" : "down"} style={{ fontSize: 13, fontWeight: 600 }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} vs last month</span></div>
        <div className="hint" style={{ marginTop: 6 }}>{now.responses} ratings in 30 days · {now.responseRate.toFixed(0)}% of owners responded · {now.detractors} unhappy</div>
        {!compact && <Link href="/happiness" className="btn sm pri" style={{ marginTop: 10 }}>See what residents are saying</Link>}
      </div>
      <div className="hh-chart"><div className="hint" style={{ fontSize: 11.5, marginBottom: 2 }}>Monthly average, last 6 months</div><LineChart vals={vals} labels={trend.map((t) => monthLabel(t.period))} min={Math.max(0, Math.min(...vals) - 10)} max={100} h={150} /></div>
      <div className="hh-ai">
        <div className="k">AI saved the team</div>
        <div className="hh-big" style={{ fontSize: 34 }}>{Math.round(ai.hours)}<small> hrs</small></div>
        <div className="hint">in the last 30 days, about {(ai.hours / 8).toFixed(0)} working days given back to residents</div>
        <div className="hint" style={{ marginTop: 6, fontSize: 12 }}>{ai.items.filter((i) => i.n).slice(0, 3).map((i) => `${i.n.toLocaleString()} ${i.k.charAt(0).toLowerCase() + i.k.slice(1)}`).join(" · ")}</div>
      </div>
    </div>
  );
}

const FACES: [number, string, string][] = [[1, "😞", "Unhappy"], [2, "🙁", "Not great"], [3, "😐", "Okay"], [4, "🙂", "Good"], [5, "😄", "Love it"]];
export function PulseCard({ back = "/home" }: { back?: string }) {
  return (
    <form action={submitPulse} className="card pulse-card">
      <input type="hidden" name="back" value={back} />
      <div><h3>How happy are you living at Skyland this month?</h3><div className="hint">Takes 5 seconds. Kumusta po kayo? The board reads every answer.</div></div>
      <input name="comment" placeholder="Anything we can do better? (optional)" aria-label="Comment" className="inline-input" style={{ width: "100%" }} />
      <div className="faces">{FACES.map(([v, e, l]) => <button key={v} name="score" value={v} className="face" aria-label={l}><span>{e}</span><small>{l}</small></button>)}</div>
    </form>
  );
}
