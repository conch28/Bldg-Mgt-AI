import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Markdown } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { quorum } from "@/lib/meetings";
import { redraftAgenda, saveAgenda, writeMinutes, toggleAction, markPresent } from "../actions";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string; edit?: string } }) {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const m = await prisma.meeting.findUnique({ where: { id: params.id }, include: { actions: { orderBy: { createdAt: "asc" } }, proxies: { where: { revokedAt: null }, orderBy: { unitCode: "asc" } }, attendees: { orderBy: { unitCode: "asc" } } } });
  if (!m) notFound();
  const q = m.kind === "AGM" ? await quorum(m.id) : null;
  const polls = m.kind === "AGM" ? await prisma.poll.findMany({ where: { meetingId: m.id }, include: { _count: { select: { votes: true } } } }) : [];
  return (
    <>
      <PageHead back="/meetings" title={m.title} sub={`${m.kind === "AGM" ? "Annual general meeting" : "Board meeting"} · ${fmtDateTime(m.startsAt)} · ${m.place}`} />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {q && (
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}><h3>Quorum</h3><span className={"tag " + (q.met ? "t-ok" : "t-warn")}>{q.met ? "Quorum reached" : `Need ${Math.max(0, 50.01 - q.pct).toFixed(1)}% more`}</span></div>
            <div className="quorum" role="img" aria-label={`${q.pct.toFixed(1)}% of floor area represented`}><i style={{ width: `${q.presentPct}%` }} className="qp" /><i style={{ width: `${q.proxyPct}%` }} className="qx" /><b style={{ left: "50%" }} /></div>
            <div className="row hint" style={{ flexWrap: "wrap", gap: 14 }}><span><i className="dotp" style={{ background: "#0072B2" }} /> Present {q.present} units ({q.presentPct.toFixed(1)}%)</span><span><i className="dotp" style={{ background: "#56B4E9" }} /> By proxy {q.proxies} units ({q.proxyPct.toFixed(1)}%)</span><span>Total {q.pct.toFixed(1)}% of floor area · majority needed</span></div>
            <div className="grid g2" style={{ marginTop: 10 }}>
              <form action={markPresent}><input type="hidden" name="id" value={m.id} />
                <div className="field"><label htmlFor="units">Mark units present (codes, comma-separated)</label><input id="units" name="units" placeholder="1202B, 903A" /></div>
                <div className="row" style={{ gap: 8 }}><select name="via" aria-label="How"><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option></select><SubmitButton label="Mark present" small /></div>
              </form>
              <div><b>Proxies ({m.proxies.length})</b><div className="hint" style={{ maxHeight: 120, overflow: "auto" }}>{m.proxies.length ? m.proxies.map((p) => `${p.unitCode} → ${p.holderName}`).join(" · ") : "None yet. Owners assign proxies from the Voting page."}</div></div>
            </div>
            {polls.length > 0 && <div className="hint" style={{ marginTop: 8 }}>Resolutions for this AGM: {polls.map((p) => `${p.question} (${p._count.votes} votes)`).join(" · ")}. <Link href="/polls">Open voting</Link></div>}
          </div>
        )}
        <div className="grid g2">
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h3>Agenda</h3>
              <div className="row" style={{ gap: 6 }}>
                <form action={redraftAgenda}><input type="hidden" name="id" value={m.id} /><SubmitButton label="Refresh with AI" busy="Drafting…" small cls="btn" /></form>
                <Link className="btn sm" href={`/meetings/${m.id}?edit=1`}>Edit</Link>
              </div></div>
            {searchParams.edit ? <form action={saveAgenda} style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} /><textarea name="agenda" rows={16} defaultValue={m.agenda ?? ""} style={{ width: "100%" }} aria-label="Agenda" /><SubmitButton label="Save agenda" small /></form>
              : m.agenda ? <div className="doc"><Markdown text={m.agenda} /></div> : <div className="empty">No agenda yet.</div>}
          </div>
          <div className="card">
            <h3>{m.minutes ? "Minutes (draft)" : "Notes → minutes"}</h3>
            {m.minutes && <div className="doc"><Markdown text={m.minutes} /></div>}
            <details className="more" open={!m.minutes}><summary>{m.minutes ? "Edit notes and redraft" : "Paste or type your notes"}</summary>
              <form action={writeMinutes} style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} />
                <div className="field"><label htmlFor="present">Present</label><input id="present" name="present" placeholder="Pres. Cruz, VP Lim, Treas. Tan, Sec. Ramos; PM Engr. Santos" /></div>
                <div className="field"><label htmlFor="notes">Notes (rough is fine, Taglish is fine)</label><textarea id="notes" name="notes" rows={9} defaultValue={m.notes ?? ""} placeholder={"Collections 91% ok. Treas wants demand letter sa 2 units >90 days.\nGenset battery weak - replace bago typhoon season.\nAction: Engr. Santos - get 3 quotes for genset battery - Dec 5\nAction: Treasurer - send demand letters - Dec 1"} /></div>
                <div className="hint" style={{ marginBottom: 8 }}>Lines starting with <b>Action:</b> become tracked action items (who - what - when).</div>
                <SubmitButton label="Draft minutes" busy="Writing minutes…" />
              </form>
            </details>
          </div>
        </div>
        <div className="card"><h3>Action items from this meeting</h3>
          <div className="list" style={{ marginTop: 6 }}>{m.actions.length ? m.actions.map((a) => <div className="li" key={a.id}>
            <form action={toggleAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={`/meetings/${m.id}`} /><button className={"chk" + (a.status === "DONE" ? " on" : "")} aria-label={a.status === "DONE" ? "Mark not done" : "Mark done"}>{a.status === "DONE" ? "✓" : ""}</button></form>
            <div style={{ flex: 1 }}><b>{a.text}</b><div className="hint">{a.owner}{a.due ? ` · due ${fmtDate(a.due)}` : ""}</div></div>
          </div>) : <div className="empty">None yet. They appear when you draft the minutes.</div>}</div>
        </div>
      </main>
    </>
  );
}
