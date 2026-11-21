import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, fmtDateTime, nowManila } from "@/lib/format";
import { createMeeting, toggleAction, addAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Meetings({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const [meetings, actions] = await Promise.all([
    prisma.meeting.findMany({ orderBy: { startsAt: "desc" }, take: 20, include: { _count: { select: { actions: true, proxies: true } } } }),
    prisma.actionItem.findMany({ where: { OR: [{ status: "OPEN" }, { doneAt: { gte: new Date(now.getTime() - 14 * 86400000) } }] }, orderBy: [{ status: "desc" }, { due: "asc" }], include: { meeting: { select: { title: true } } } }),
  ]);
  const upcoming = meetings.filter((m) => m.startsAt >= new Date(now.getTime() - 6 * 3600000)).reverse();
  const past = meetings.filter((m) => !upcoming.includes(m));
  const open = actions.filter((a) => a.status === "OPEN");
  const late = open.filter((a) => a.due && a.due < now).length;
  const in2w = new Date(now.getTime() + 14 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <>
      <PageHead title="Board meetings" sub="AI drafts the agenda from this month's numbers, turns your notes into minutes, and tracks every action item until it's done." />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className="grid g-7-5">
          <div className="stack">
            <div className="card"><h3>Upcoming</h3>
              <div className="list" style={{ marginTop: 6 }}>{upcoming.length ? upcoming.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`} className="li" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className={"tag " + (m.kind === "AGM" ? "t-warn" : "t-acc")}>{m.kind === "AGM" ? "AGM" : "Board"}</span>
                  <div style={{ flex: 1 }}><b>{m.title}</b><div className="hint">{fmtDateTime(m.startsAt)} · {m.place}{m.kind === "AGM" ? ` · ${m._count.proxies} proxies` : ""}</div></div><span className="btn sm">Open</span>
                </Link>)) : <div className="empty">Nothing scheduled.</div>}</div>
            </div>
            <div className="card"><h3>Past meetings</h3>
              <div className="list" style={{ marginTop: 6 }}>{past.length ? past.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`} className="li" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className={"tag " + (m.minutes ? "t-ok" : "t-mut")}>{m.minutes ? "Minutes" : "No minutes"}</span>
                  <div style={{ flex: 1 }}><b>{m.title}</b><div className="hint">{fmtDate(m.startsAt)} · {m._count.actions} action items</div></div>
                </Link>)) : <div className="empty">None yet.</div>}</div>
            </div>
          </div>
          <div className="stack">
            <div className="card"><h3>Action items <span className="hint">{open.length} open{late ? ` · ${late} late` : ""}</span></h3>
              <div className="list" style={{ marginTop: 6 }}>{actions.length ? actions.map((a) => {
                const isLate = a.status === "OPEN" && a.due && a.due < now;
                return <div className="li" key={a.id}>
                  <form action={toggleAction}><input type="hidden" name="id" value={a.id} /><button className={"chk" + (a.status === "DONE" ? " on" : "")} aria-label={a.status === "DONE" ? "Mark not done" : "Mark done"}>{a.status === "DONE" ? "✓" : ""}</button></form>
                  <div style={{ flex: 1, minWidth: 0, opacity: a.status === "DONE" ? 0.6 : 1 }}><b style={{ textDecoration: a.status === "DONE" ? "line-through" : undefined }}>{a.text}</b><div className="hint">{a.owner}{a.due ? ` · due ${fmtDate(a.due)}` : ""}{a.meeting ? ` · ${a.meeting.title}` : ""}</div></div>
                  {isLate && <span className="tag t-bad">Late</span>}
                </div>;
              }) : <div className="empty">No action items.</div>}</div>
              <details className="more" style={{ marginTop: 8 }}><summary>Add an action item</summary>
                <form action={addAction} style={{ marginTop: 8 }}><div className="formgrid">
                  <div className="field full"><label htmlFor="text">What</label><input id="text" name="text" required /></div>
                  <div className="field"><label htmlFor="owner">Who</label><input id="owner" name="owner" required placeholder="Treasurer" /></div>
                  <div className="field"><label htmlFor="due">Due</label><input id="due" name="due" type="date" /></div>
                </div><SubmitButton label="Add" small /></form>
              </details>
            </div>
            <div className="card"><h3>Schedule a meeting</h3>
              <form action={createMeeting} style={{ marginTop: 8 }}><div className="formgrid">
                <div className="field full"><label htmlFor="title">Title</label><input id="title" name="title" required defaultValue="Regular board meeting" /></div>
                <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind"><option value="BOARD">Board meeting</option><option value="AGM">Annual general meeting (owners)</option></select></div>
                <div className="field"><label htmlFor="place">Where</label><input id="place" name="place" defaultValue="Function room, 5th floor" required /></div>
                <div className="field"><label htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={in2w} required /></div>
                <div className="field"><label htmlFor="time">Time</label><input id="time" name="time" type="time" defaultValue="19:00" required /></div>
              </div><SubmitButton label="Create and draft agenda" busy="Drafting agenda…" /></form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
