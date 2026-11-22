import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import Tip from "@/components/Tip";
import { DUTIES, OWNER_LABEL, allTasks, roleScores, dueLabel, LEVEL_LABEL, LEVEL_CLS } from "@/lib/duties";

export const dynamic = "force-dynamic";

/** Accountability: the matrix of who enters what, how and by when, plus how each role is doing. */
export default async function Duties() {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const [scores, all] = await Promise.all([roleScores(), allTasks()]);
  const escalated = all.filter((t) => t.level >= 2);
  const areas = [...new Set(DUTIES.map((d) => d.area))];
  return (
    <>
      <PageHead title="Accountability" sub="Who enters each record, how, by when, and who checks it" />
      <main className="view">
        <Tip id="duties" title="One owner, one deadline, one checker.">
          The app reminds the owner when a record is late, then tells their supervisor, then the board. Money only moves when the paperwork is in.
        </Tip>
        <div className="grid g4">
          {scores.map((s) => (
            <div className="card kpi" key={s.owner}><div className="k">{s.label}</div>
              <div className={"v " + (s.pct != null && s.pct < 80 ? "amber" : "")}>{s.pct == null ? "–" : `${s.pct}%`}</div>
              <div className="d" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {s.measures.map((m) => (
                  <div key={m.label}><div className="hint" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><span>{m.label}</span><b>{m.of ? `${m.ok}/${m.of}` : "–"}</b></div>
                    <div className="meter"><i style={{ width: `${m.of ? Math.round((m.ok / m.of) * 100) : 0}%` }} /></div></div>
                ))}
              </div></div>
          ))}
        </div>
        <div className="hint">On time and complete, last 30 days. Target: 95% or better. <Link href="/integrity">See each person&apos;s score, spot checks and entry flags</Link>.</div>

        <div className="card">
          <h3>Escalated now <span className="hint">({escalated.length})</span></h3>
          <div style={{ marginTop: 4 }}>
            {escalated.length ? escalated.slice(0, 25).map((t) => (
              <div className={`task lv${t.level}`} key={t.key}><div className="tbody"><b>{t.title}</b><div className="tmeta"><span className={"tag " + LEVEL_CLS[t.level]}>{LEVEL_LABEL[t.level]}</span><span className="hint">{dueLabel(t)} · owner: {t.who ?? OWNER_LABEL[t.owner]}</span></div></div>
                <Link className="btn sm" href={t.href}>Open</Link></div>)) : <div className="okmsg">Nothing escalated. Everyone is on time.</div>}
          </div>
        </div>

        {areas.map((a) => (
          <div className="card" key={a}>
            <h3>{a}</h3>
            <div className="tablewrap"><table className="stack-m matrix">
              <thead><tr><th>Record</th><th>Who enters it</th><th>How</th><th>Deadline</th><th>Checked by</th><th>If late</th></tr></thead>
              <tbody>{DUTIES.filter((d) => d.area === a).map((d) => (
                <tr key={d.id}><td><b>{d.record}</b>{d.gate && <div className="gate">{d.gate}</div>}{d.tracked && <div><span className="tag t-acc">Tracked</span></div>}</td>
                  <td>{d.owner.map((o) => OWNER_LABEL[o]).join(", ")}</td><td>{d.how}</td><td>{d.deadline}</td><td>{d.checker}</td><td>{d.escalate}</td></tr>))}
              </tbody></table></div>
          </div>
        ))}
      </main>
    </>
  );
}
