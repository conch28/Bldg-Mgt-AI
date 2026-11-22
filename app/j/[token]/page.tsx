import { prisma } from "@/lib/db";
import { fmtDateTime, nowManila } from "@/lib/format";
import PhotoField from "@/components/PhotoField";
import SubmitButton from "@/components/SubmitButton";
import { jobStart, jobDone, jobBlocked } from "./actions";
import { staffScores } from "@/lib/staffscore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job · Building Mgt AI", robots: { index: false } };

/** One-tap job page for technicians and vendors (no account). Shows only what they need to do the job. */
export default async function Job({ params, searchParams }: { params: { token: string }; searchParams: { ok?: string; error?: string } }) {
  const token = params.token.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const wo = token ? await prisma.workOrder.findUnique({ where: { jobToken: token }, select: { number: true, title: true, description: true, location: true, category: true, priority: true, status: true, slaHours: true, createdAt: true, assignee: true, photo: true, verifiedAt: true, doneBy: true, donePhoto: true } }) : null;
  if (!wo) return <main className="jobpage"><div className="card"><h2>This job link isn&apos;t valid.</h2><p className="hint">Ask the property manager to send it again.</p></div></main>;
  const due = new Date(wo.createdAt.getTime() + wo.slaHours * 3600000), late = due < nowManila();
  const hidden = <input type="hidden" name="token" value={token} />;
  // The technician's own record, so good work is visible to them too (only their own name is shown).
  const who = wo.assignee ?? wo.doneBy;
  const rec = who ? (await staffScores().catch(() => [])).find((p) => p.kind === "TECH" && p.name === who) : undefined;
  const name = <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" defaultValue={wo.assignee ?? ""} maxLength={80} /></div>;
  return (
    <main className="jobpage">
      <div className="card stack">
        <div className="hint">Skyland Plaza · Job WO-{wo.number}</div>
        <h2 style={{ margin: 0 }}>{wo.title}</h2>
        <div className="row"><span className={"tag " + (wo.priority === "HIGH" ? "t-bad" : wo.priority === "MEDIUM" ? "t-warn" : "t-mut")}>{wo.priority.toLowerCase()} priority</span><span className="tag t-mut">{wo.category}</span><b>{wo.location}</b></div>
        {wo.description && <p style={{ margin: 0 }}>{wo.description}</p>}
        {wo.photo && <img src={wo.photo} alt="Photo of the problem" className="recv-pic" />}
        <div className={late && wo.status !== "DONE" ? "err" : "hint"}>Finish by {fmtDateTime(due)}{late && wo.status !== "DONE" ? " (late)" : ""}</div>
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
      </div>

      {wo.status === "DONE" ? (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>{wo.verifiedAt ? "Checked by the manager. Salamat po!" : "Done. Waiting for the manager to check."}</h3>
          {wo.donePhoto && <img src={wo.donePhoto} alt="After photo" className="recv-pic" />}
          <div className="hint">Marked done by {wo.doneBy}.</div>
        </div>
      ) : (<>
        {(wo.status === "NEW" || wo.status === "ASSIGNED" || wo.status === "ESCALATED") && (
          <form action={jobStart} className="card stack">{hidden}<h3 style={{ margin: 0 }}>1. Start</h3>{name}<SubmitButton label="I'm on it" busy="Saving…" /></form>
        )}
        <form action={jobDone} className="card stack">{hidden}
          <h3 style={{ margin: 0 }}>{wo.status === "IN_PROGRESS" ? "Finish" : "2. Finish"}</h3>
          <div className="hint">Tap Done as soon as you finish, and take a fresh photo of this job&apos;s finished work. Re-used photos and copied notes are flagged for the manager. Tap the mic on your keyboard to talk instead of typing.</div>
          <PhotoField label="Take after photo" required />
          <div className="field"><label htmlFor="note">What did you do? (optional)</label><textarea id="note" name="note" rows={2} maxLength={600} placeholder="e.g. Replaced the faucet cartridge, no more leak" /></div>
          <input type="hidden" name="name" value={wo.assignee ?? ""} />
          <SubmitButton label="Done" busy="Sending…" />
        </form>
        {rec?.score != null && (
          <div className="card"><div className="hint">Your record, last 30 days ({rec.entries} jobs)</div>
            <div className="row" style={{ alignItems: "baseline" }}><b style={{ fontSize: 22 }}>{rec.score}%</b>{rec.band && <span className={"tag " + rec.band.cls}>{rec.band.label}</span>}{rec.bonus && <span className="tag t-ok">Bonus eligible</span>}</div>
            <div className="hint">On time {rec.pillars.onTime.of ? Math.round((rec.pillars.onTime.ok / rec.pillars.onTime.of) * 100) : "–"}% · with photo {rec.pillars.complete.of ? Math.round((rec.pillars.complete.ok / rec.pillars.complete.of) * 100) : "–"}% · passed first check {rec.pillars.verified.of ? Math.round((rec.pillars.verified.ok / rec.pillars.verified.of) * 100) : "–"}%</div></div>
        )}
        <form action={jobBlocked} className="card stack">{hidden}<input type="hidden" name="name" value={wo.assignee ?? ""} />
          <details><summary className="hint" style={{ cursor: "pointer" }}>Can&apos;t finish? Tell the manager</summary>
            <div className="field" style={{ marginTop: 8 }}><textarea name="note" rows={2} maxLength={600} placeholder="e.g. Need a replacement part, ETA tomorrow" aria-label="What's stopping you" /></div>
            <SubmitButton label="Send" small cls="btn" />
          </details>
        </form>
      </>)}
    </main>
  );
}
