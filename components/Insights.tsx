import { prisma } from "@/lib/db";
import { earlyWarnings, fixLeaderboard } from "@/lib/building";
import { openInspection } from "@/app/(app)/today/actions";
import SubmitButton from "@/components/SubmitButton";

/** Patterns in repair history that predict the next breakdown. Manager can open an inspection ticket in one tap. */
export async function EarlyWarnings({ canAct }: { canAct: boolean }) {
  const ws = await earlyWarnings();
  const open = ws.length ? await prisma.workOrder.findMany({ where: { source: "Early warning", status: { not: "DONE" } }, select: { title: true, number: true } }) : [];
  return (
    <div className="card">
      <span className="ai-badge">Predicted</span>
      <h3 style={{ marginTop: 4 }}>Early warnings</h3>
      <div className="hint">Problems likely to happen next, found in the last 60 days of repairs.</div>
      <div style={{ marginTop: 8 }}>
        {!ws.length && <div className="hint">No worrying patterns right now.</div>}
        {ws.map((w) => {
          const t = open.find((o) => o.title === `Inspection: ${w.title}`.slice(0, 120));
          return (
            <div className="warn-item" key={w.key}>
              <span className="lvl" style={{ background: w.level === "high" ? "#a78bfa" : "var(--warn)" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{w.title}</b>
                <div className="hint" style={{ marginTop: 2 }}>{w.why}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}><b>Do:</b> {w.action}</div>
                {canAct && (t
                  ? <span className="tag t-acc" style={{ marginTop: 6 }}>Inspection open: WO-{t.number}</span>
                  : <form action={openInspection} style={{ marginTop: 6 }}><input type="hidden" name="key" value={w.key} /><SubmitButton label="Open inspection ticket" busy="Opening…" cls="btn" small /></form>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Time-to-fix leaderboard: who closes repairs fastest and on time. */
export async function FixLeaderboard() {
  const rows = await fixLeaderboard(30);
  const max = Math.max(1, ...rows.map((r) => r.medianHrs));
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <div className="card">
      <span className="ai-badge">Live</span>
      <h3 style={{ marginTop: 4 }}>Time-to-fix leaderboard</h3>
      <div className="hint">Last 30 days. Ranked by repairs closed on time, then speed.</div>
      {!rows.length ? <div className="hint" style={{ marginTop: 8 }}>Not enough closed repairs yet.</div> : (
        <table className="lead" style={{ marginTop: 8 }}>
          <thead><tr><th /><th>Team</th><th>On time</th><th>Typical fix</th><th>Rating</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.who}>
                <td className="rank">{medal[i] ?? i + 1}</td>
                <td><b>{r.who.replace(/^Vendor: /, "")}</b><div className="hint">{r.jobs} jobs</div></td>
                <td className="num">{r.onTimePct.toFixed(0)}%</td>
                <td className="num">{r.medianHrs < 1 ? `${Math.round(r.medianHrs * 60)} min` : `${r.medianHrs.toFixed(1)} h`}<span className="bar" style={{ width: `${Math.max(8, (r.medianHrs / max) * 100)}%` }} /></td>
                <td className="num">{r.rating ? `${r.rating.toFixed(1)}★` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
