import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead, Kpi } from "@/components/ui";
import Tip from "@/components/Tip";
import PhotoField from "@/components/PhotoField";
import SubmitButton from "@/components/SubmitButton";
import { DUTIES, allTasks, tasksFor, roleScores, runDutyNudges, dueLabel, LEVEL_LABEL, LEVEL_CLS, OWNER_LABEL, type Owner } from "@/lib/duties";
import { captureError } from "@/lib/monitor";
import { createWorkOrder } from "../work-orders/actions";

export const dynamic = "force-dynamic";

/** "My tasks due": every record this person must enter, overdue first, with a one-tap way to do it. */
export default async function Tasks({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("MANAGER", "ADMIN", "GUARD", "BOARD");
  // Reminders go out when staff open their list as well as from the daily job, so nothing waits a day.
  if (u.role === "MANAGER" || u.role === "ADMIN") await runDutyNudges().catch((e) => captureError(e, { source: "duties", path: "/tasks" }));
  const [all, scores] = await Promise.all([allTasks(), roleScores()]);
  const mine = tasksFor(all, u.role);
  const overdue = mine.filter((t) => t.level >= 1).length;
  const myScore = scores.find((s) => s.owner === u.role);
  const myDuties = DUTIES.filter((d) => d.owner.includes(u.role as Owner) || (u.role === "MANAGER" && d.owner.includes("TECH")));
  const canLog = u.role !== "BOARD";
  return (
    <>
      <PageHead title="My tasks" sub="Records you're responsible for, and when they're due" />
      <main className="view">
        <Tip id="tasks" title="If it isn't in the app, it didn't happen.">
          Each record has one owner and a deadline. Late items remind you first, then your supervisor, then the board. Do the oldest red ones first.
        </Tip>
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className="grid g3">
          <Kpi k="Overdue" v={overdue} cls={overdue ? "amber" : ""} d={<span className="hint">{mine.filter((t) => t.level >= 2).length} already escalated</span>} />
          <Kpi k="Due soon" v={mine.length - overdue} />
          <Kpi k="Your on-time score (30 days)" v={myScore?.pct == null ? "–" : `${myScore.pct}%`} d={<Link href="/duties" className="hint">How it's measured</Link>} />
        </div>

        <div className="card">
          <h3>To do</h3>
          <div style={{ marginTop: 4 }}>
            {mine.length ? mine.map((t) => (
              <div className={`task lv${t.level}`} key={t.key}>
                <div className="tbody"><b>{t.title}</b><div className="hint">{t.detail}</div>
                  <div className="tmeta"><span className={"tag " + LEVEL_CLS[t.level]}>{LEVEL_LABEL[t.level]}</span><span className="hint">{dueLabel(t)}</span>
                    {u.role !== "GUARD" && <span className="hint">· {t.who ? t.who : OWNER_LABEL[t.owner]}</span>}</div></div>
                <Link className={"btn sm" + (t.level >= 1 ? " pri" : "")} href={t.href}>Do it</Link>
              </div>)) : <div className="okmsg">All caught up. Salamat po!</div>}
          </div>
        </div>

        {canLog && (
          <form action={createWorkOrder} className="card stack">
            <h3 style={{ margin: 0 }}>Log a complaint or request</h3>
            <div className="hint">For walk-ins and phone calls. Log it within 15 minutes, while the resident is still with you.</div>
            <input type="hidden" name="back" value="/tasks" />
            <input name="title" required minLength={3} maxLength={120} placeholder="What's wrong? e.g. Leak under kitchen sink" aria-label="What's wrong" />
            <div className="row">
              <input name="location" required maxLength={60} placeholder="Unit or area" aria-label="Unit or area" style={{ width: 130 }} />
              <select name="category" aria-label="Category">{["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Noise", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
              <select name="priority" defaultValue="MEDIUM" aria-label="How urgent"><option value="HIGH">Urgent (4h)</option><option value="MEDIUM">Normal (24h)</option><option value="LOW">Can wait (72h)</option></select>
              <select name="source" aria-label="How it came in"><option>Walk-in</option><option>Phone</option><option>Messenger</option><option>Viber</option><option>Email</option></select>
            </div>
            <input name="detail" maxLength={1000} placeholder="Details (optional). Tap the mic on your keyboard to talk." aria-label="Details" />
            <div className="row"><PhotoField label="Add photo" /><SubmitButton label="Log it" busy="Saving…" /></div>
          </form>
        )}

        <details className="card">
          <summary style={{ cursor: "pointer" }}><b>What you&apos;re responsible for</b> <span className="hint">({myDuties.length} records, with deadlines)</span></summary>
          <div className="list" style={{ marginTop: 4 }}>
            {myDuties.map((d) => (
              <div className="li" key={d.id}><div style={{ flex: 1 }}><b>{d.record}</b><div className="hint">{d.how}</div>
                <div className="tmeta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}><span className="tag t-acc">{d.deadline}</span>{d.gate && <span className="tag t-bad">{d.gate}</span>}</div></div></div>
            ))}
          </div>
        </details>
      </main>
    </>
  );
}
