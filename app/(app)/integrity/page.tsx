import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import Tip from "@/components/Tip";
import PhotoField from "@/components/PhotoField";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, fmtDateTime, nowManila } from "@/lib/format";
import { staffScores, coachingTip, pillarPct, PILLARS, SCORE_POLICY, SCORE_DAYS } from "@/lib/staffscore";
import { drawSpotAudits, weekOf, AUDIT_HOW, AUDIT_RULES, FLAG_KIND } from "@/lib/integrity";
import { captureError } from "@/lib/monitor";
import { checkSpotAudit, reviewFlag, runChecksNow } from "./actions";

export const dynamic = "force-dynamic";

const TABS = [["scores", "Scores"], ["audits", "Spot checks"], ["flags", "Entry flags"]] as const;
const KIND_LABEL: Record<string, string> = { WO: "Repair", ROUND: "Guard round", RECEIPT: "Receipt" };

/** Staff data scores: per-person score, weekly random spot checks, and flags for entries worth a second look. */
export default async function Integrity({ searchParams: sp }: { searchParams: { tab?: string; ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "scores";
  const now = nowManila();
  await drawSpotAudits(now).catch((e) => captureError(e, { source: "integrity", path: "/integrity" }));
  const wk = weekOf(now);
  const [scores, thisWeek, pastAudits, openFlags, doneFlags] = await Promise.all([
    staffScores(now),
    prisma.spotAudit.findMany({ where: { weekOf: wk.key }, orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }, { kind: "asc" }] }),
    prisma.spotAudit.findMany({ where: { weekOf: { not: wk.key }, checkedAt: { not: null } }, orderBy: { checkedAt: "desc" }, take: 30 }),
    prisma.entryFlag.findMany({ where: { status: "OPEN" }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] }),
    prisma.entryFlag.findMany({ where: { status: { not: "OPEN" } }, orderBy: { reviewedAt: "desc" }, take: 20 }),
  ]);
  const scored = scores.filter((s) => s.score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, p) => s + p.score!, 0) / scored.length) : null;
  const weekDone = thisWeek.filter((a) => a.checkedAt).length;
  const allChecked = [...thisWeek, ...pastAudits].filter((a) => a.result);
  const passRate = allChecked.length ? Math.round((allChecked.filter((a) => a.result === "PASS").length / allChecked.length) * 100) : null;
  const mine = (person: string) => person.split(" and ").includes(u.name);

  return (
    <>
      <PageHead title="Staff data scores" sub="Is each person's data on time, complete, accurate and checked?" />
      <main className="view">
        <Tip id="integrity" title="Coaching first, not punishment.">
          Scores show each person exactly which entries pulled them down. Flags are prompts to check, never proof, and only flags a manager confirms count. Good scores earn a monthly data bonus; nothing is deducted from pay.
        </Tip>
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        {sp.error && <div className="err">{sp.error}</div>}
        <div className="grid g4">
          <Kpi k="Team average" v={avg == null ? "–" : `${avg}%`} cls={avg != null && avg < 85 ? "amber" : ""} d={<span className="hint">last {SCORE_DAYS} days, {scored.length} people</span>} />
          <Kpi k="Staff bonus eligible" v={`${scores.filter((s) => s.bonus).length} of ${scored.filter((s) => !s.vendor).length}`} d={<span className="hint">{SCORE_POLICY.bonusMin}%+ and no confirmed serious flag</span>} />
          <Kpi k="Spot checks this week" v={`${weekDone}/${thisWeek.length}`} cls={thisWeek.length && weekDone < thisWeek.length ? "amber" : ""} d={<span className="hint">{passRate == null ? "no results yet" : `${passRate}% passed overall`}</span>} />
          <Kpi k="Open flags" v={openFlags.length} cls={openFlags.some((f) => f.severity >= 2) ? "amber" : ""} d={<span className="hint">{openFlags.filter((f) => f.severity >= 2).length} likely, {openFlags.filter((f) => f.severity < 2).length} worth a look</span>} />
        </div>
        <div className="tabs">{TABS.map(([k, l]) => <Link key={k} href={`/integrity?tab=${k}`} className={"chip" + (tab === k ? " on" : "")}>{l}{k === "flags" && openFlags.length ? ` (${openFlags.length})` : k === "audits" && thisWeek.length - weekDone ? ` (${thisWeek.length - weekDone})` : ""}</Link>)}</div>

        {tab === "scores" && (
          <>
            <div className="grid g3">
              {scores.map((p) => {
                const tip = coachingTip(p);
                return (
                  <div className="card" key={p.kind + p.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}><b>{p.name}</b><div className="hint">{p.kindLabel} · {p.entries} entries</div></div>
                      <div style={{ textAlign: "right" }}><div className="big" style={{ fontSize: 30 }}>{p.score == null ? "–" : `${p.score}%`}</div>
                        {p.band ? <span className={"tag " + p.band.cls}>{p.band.label}</span> : <span className="tag t-mut">Not enough entries</span>}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                      {p.bonus && <span className="tag t-ok">Bonus eligible</span>}
                      {p.vendor && p.score != null && <span className={"tag " + (p.score >= SCORE_POLICY.bonusMin ? "t-ok" : "t-mut")}>{p.score >= SCORE_POLICY.bonusMin ? "Counts toward renewal" : "Vendor: raise at review"}</span>}
                      {p.openFlags > 0 && <span className="tag t-warn">{p.openFlags} open flag{p.openFlags > 1 ? "s" : ""}</span>}
                      {p.confirmedFlags > 0 && <span className="tag t-bad">{p.confirmedFlags} confirmed</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {PILLARS.map((x) => { const m = p.pillars[x.key], v = pillarPct(m); return (
                        <div key={x.key}><div className="hint" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><span title={x.what}>{x.label}</span><b>{v == null ? "not checked yet" : `${v}% (${m.ok}/${m.of})`}</b></div>
                          <div className="meter"><i style={{ width: `${v ?? 0}%`, background: v != null && v < 85 ? "var(--warn)" : undefined }} /></div></div>); })}
                    </div>
                    {tip && <div className="hint" style={{ marginTop: 8 }}>💬 {tip}</div>}
                    {p.misses.length > 0 && (
                      <details style={{ marginTop: 6 }}><summary className="hint" style={{ cursor: "pointer" }}>What lowered it ({p.misses.length})</summary>
                        <div className="list">{p.misses.map((m, i) => <div className="li" key={i}><span className="hint" style={{ flex: 1 }}>{PILLARS.find((x) => x.key === m.pillar)!.label}: {m.text}</span><Link className="btn sm" href={m.href}>Open</Link></div>)}</div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            <details className="card" open={scores.length === 0}>
              <summary style={{ cursor: "pointer" }}><b>How the score works</b></summary>
              <div className="list" style={{ marginTop: 6 }}>
                {PILLARS.map((x) => <div className="li" key={x.key}><div><b>{x.label}</b><div className="hint">{x.what}</div></div></div>)}
                <div className="li"><div><b>Score</b><div className="hint">The average of the four, over the last {SCORE_DAYS} days. Shown once a person has {SCORE_POLICY.minEntries} or more entries. {SCORE_POLICY.bands.map((b) => `${b.label} ${b.min}%+`).join(", ").replace(" 0%+", " below 70%")}.</div></div></div>
                <div className="li"><div><b>Pay</b><div className="hint">{SCORE_POLICY.bonusMin}% or higher, with no confirmed serious flag, earns the monthly data bonus. Low scores get coaching and a simple improvement plan; nothing is ever deducted from pay. Vendors don&apos;t get a bonus: their score is raised at the contract review.</div></div></div>
                <div className="li"><div><b>Fairness</b><div className="hint">Everyone sees their own score and the exact entries behind it. Open flags never count. Staff can give their side before a flag is reviewed, and no one reviews a flag or spot check about themselves.</div></div></div>
              </div>
            </details>
          </>
        )}

        {tab === "audits" && (
          <>
            <div className="card">
              <h3>This week&apos;s random sample <span className="hint">(week of {fmtDate(wk.start)})</span></h3>
              <div className="hint">Picked by the app each Monday: {Math.round(AUDIT_RULES.woShare * 100)}% of finished repairs ({AUDIT_RULES.woMin} to {AUDIT_RULES.woMax}), {AUDIT_RULES.rounds} guard rounds and {AUDIT_RULES.receipts} receipt. No one chooses which work gets checked. Due Sunday night.</div>
              <div style={{ marginTop: 6 }}>
                {thisWeek.length ? thisWeek.map((a) => (
                  <div className={"task" + (!a.checkedAt && a.dueAt < now ? " lv1" : "")} key={a.id}>
                    <div className="tbody">
                      <b>{a.label}</b>
                      <div className="tmeta"><span className="tag t-acc">{KIND_LABEL[a.kind]}</span><span className="hint">entered by {a.person}</span>
                        {a.result && <span className={"tag " + (a.result === "PASS" ? "t-ok" : "t-bad")}>{a.result === "PASS" ? "Passed" : "Problem found"}</span>}</div>
                      {a.checkedAt ? <div className="hint" style={{ marginTop: 4 }}>Checked by {a.checkedBy}, {fmtDateTime(a.checkedAt)}{a.note ? `: ${a.note}` : ""}</div>
                        : <div className="hint" style={{ marginTop: 4 }}>{AUDIT_HOW[a.kind]}</div>}
                      {!a.checkedAt && staff && !mine(a.person) && (
                        <form action={checkSpotAudit} className="stack" style={{ marginTop: 8 }}>
                          <input type="hidden" name="id" value={a.id} />
                          <input name="note" maxLength={600} placeholder="What did you see? (required if there's a problem)" aria-label="What did you see" />
                          <div className="row"><PhotoField label="Photo (optional)" />
                            <button className="btn pri sm" name="decision" value="PASS">Passed</button>
                            <button className="btn sm" name="decision" value="ISSUE">Found a problem</button></div>
                        </form>
                      )}
                      {!a.checkedAt && staff && mine(a.person) && <div className="hint">Your own entry: the operations head checks this one.</div>}
                    </div>
                    <Link className="btn sm" href={a.href}>Open</Link>
                  </div>
                )) : <div className="okmsg">Nothing finished in the last 7 days to sample yet.</div>}
              </div>
            </div>
            <div className="card">
              <h3>Earlier results</h3>
              <div style={{ marginTop: 4 }}>
                {pastAudits.length ? pastAudits.map((a) => (
                  <div className="task" key={a.id}><div className="tbody"><b>{a.label}</b>
                    <div className="tmeta"><span className={"tag " + (a.result === "PASS" ? "t-ok" : "t-bad")}>{a.result === "PASS" ? "Passed" : "Problem found"}</span><span className="hint">{a.person} · checked by {a.checkedBy}, {fmtDate(a.checkedAt!)}</span></div>
                    {a.note && <div className="hint">{a.note}</div>}</div></div>
                )) : <div className="hint">No earlier spot checks yet.</div>}
              </div>
            </div>
          </>
        )}

        {tab === "flags" && (
          <>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Needs a look</h3>
                {staff && <form action={runChecksNow}><SubmitButton label="Run checks now" busy="Checking…" cls="btn" small /></form>}
              </div>
              <div className="hint">The app checks every day for reused or near-identical photos, an after photo that matches the resident&apos;s problem photo, copy-pasted notes, and many entries made at once. There can be innocent reasons, so hear the person out first.</div>
              <div style={{ marginTop: 6 }}>
                {openFlags.length ? openFlags.map((f) => (
                  <div className={`task lv${f.severity >= 2 ? 2 : 1}`} key={f.id}>
                    <div className="tbody">
                      <b>{f.title}</b>
                      <div className="tmeta"><span className={"tag " + (f.severity >= 2 ? "t-bad" : "t-warn")}>{FLAG_KIND[f.kind]?.label ?? f.kind}</span><span className="hint">{f.person} · {fmtDateTime(f.createdAt)}</span></div>
                      <div className="hint" style={{ marginTop: 4 }}>{f.detail}</div>
                      <div className="hint" style={{ marginTop: 4 }}><b>What to check:</b> {f.aiNote ?? FLAG_KIND[f.kind]?.check}</div>
                      {f.explanation && <div className="hint" style={{ marginTop: 4 }}><b>Their side:</b> “{f.explanation}”</div>}
                      <div className="tmeta" style={{ marginTop: 4 }}>{f.refs.map((r) => r.startsWith("WO-") ? <Link key={r} className="chip" href={`/work-orders?wo=${r.slice(3)}`}>{r}</Link> : <Link key={r} className="chip" href={f.href}>{r}</Link>)}</div>
                      {staff && !mine(f.person) && (
                        <form action={reviewFlag} className="stack" style={{ marginTop: 8 }}>
                          <input type="hidden" name="id" value={f.id} />
                          {!f.explanation && <input name="explanation" maxLength={600} placeholder="Their explanation, if you've asked (optional)" aria-label="Their explanation" />}
                          <input name="note" maxLength={600} placeholder="Your note (required to confirm: what happened, what to do next time)" aria-label="Your note" />
                          <div className="row"><button className="btn sm" name="decision" value="CLEAR">Looks fine</button><button className="btn pri sm" name="decision" value="CONFIRM">Confirm and coach</button></div>
                        </form>
                      )}
                      {staff && mine(f.person) && <div className="hint" style={{ marginTop: 4 }}>This flag is about you, so the operations head reviews it. You can add your side from My tasks.</div>}
                    </div>
                  </div>
                )) : <div className="okmsg">No open flags. Entries look genuine.</div>}
              </div>
            </div>
            <div className="card">
              <h3>Reviewed</h3>
              <div style={{ marginTop: 4 }}>
                {doneFlags.length ? doneFlags.map((f) => (
                  <div className="task" key={f.id}><div className="tbody"><b>{f.title}</b>
                    <div className="tmeta"><span className={"tag " + (f.status === "CONFIRMED" ? "t-bad" : "t-ok")}>{f.status === "CONFIRMED" ? "Confirmed, coached" : "Cleared"}</span><span className="hint">{f.person} · by {f.reviewedBy}{f.reviewedAt ? `, ${fmtDate(f.reviewedAt)}` : ""}</span></div>
                    {f.explanation && <div className="hint">Their side: “{f.explanation}”</div>}
                    {f.reviewNote && <div className="hint">Note: {f.reviewNote}</div>}</div></div>
                )) : <div className="hint">Nothing reviewed yet.</div>}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
