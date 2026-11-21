import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, nowManila } from "@/lib/format";
import { CHECKLIST, KIND_LABEL } from "./checklist";
import { approveMove, requestMove, toggleStep } from "./actions";

export const dynamic = "force-dynamic";
type M = Awaited<ReturnType<typeof load>>[number];
const load = (where: object) => prisma.moveRequest.findMany({ where, orderBy: { date: "asc" }, include: { unit: true, user: true }, take: 30 });

function MoveCard({ m, owner, mgr }: { m: M; owner: boolean; mgr: boolean }) {
  const steps = CHECKLIST[m.kind]; const n = steps.filter((s) => m.done.includes(s.key)).length;
  return (
    <div className="card">
      <div className="row"><b style={{ fontSize: 16 }}>{KIND_LABEL[m.kind]} · {m.unit.code}</b><span className={"tag " + (m.status === "APPROVED" ? "t-ok" : "t-warn")}>{m.status === "APPROVED" ? "Approved" : "Waiting for approval"}</span><span className="hint" style={{ marginLeft: "auto" }}>{fmtDate(m.date)}</span></div>
      {!owner && <div className="hint">{m.user.name}{m.note ? ` · ${m.note}` : ""}</div>}
      <div className="hbar" style={{ margin: "10px 0 4px" }}><span style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      <div className="hint">{n} of {steps.length} done{m.passCode ? ` · gate pass ${m.passCode}` : ""}</div>
      <div style={{ marginTop: 6 }}>{steps.map((s) => {
        const done = m.done.includes(s.key); const can = owner ? s.who === "OWNER" : mgr && s.who === "OFFICE" && s.key !== "approve" && s.key !== "pass";
        return <form key={s.key} action={toggleStep} className={"check" + (done ? " done" : "")}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="key" value={s.key} />
          <button disabled={!can} aria-label={done ? "Mark not done" : "Mark done"}>{done ? "✓" : ""}</button><span className="t">{s.label}</span><span className="hint">{s.who === "OWNER" ? "You" : "Office"}</span></form>;
      })}</div>
      {mgr && m.status === "PENDING" && <form action={approveMove} style={{ marginTop: 10 }}><input type="hidden" name="id" value={m.id} /><SubmitButton label="Approve and send gate pass" busy="Approving…" /></form>}
    </div>
  );
}

export default async function Moving({ searchParams }: { searchParams: { error?: string; new?: string } }) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN", "GUARD");
  const owner = u.role === "OWNER", mgr = u.role === "MANAGER" || u.role === "ADMIN";
  const now = nowManila(); const since = new Date(now.getTime() - 2 * 86400000);
  if (owner) {
    const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
    const moves = await load({ userId: u.id, date: { gte: since } });
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    return (
      <>
        <PageHead title="Moving & renovation" sub="Book the service elevator, get gate passes and track every step. No forms to print." />
        <main className="view">
          {searchParams.error && <div className="err">{searchParams.error}</div>}
          {searchParams.new && <div className="okmsg">Request sent. The admin office usually approves within a day, then your gate pass appears here.</div>}
          {moves.map((m) => <MoveCard key={m.id} m={m} owner mgr={false} />)}
          <form action={requestMove} className="card stack"><h3>New request</h3>
            <div className="field"><label htmlFor="kind">What's happening?</label><select id="kind" name="kind">{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {units.length > 1 && <div className="field"><label htmlFor="unitId">Unit</label><select id="unitId" name="unitId">{units.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}</select></div>}
            {units.length === 1 && <input type="hidden" name="unitId" value={units[0].id} />}
            <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" name="date" min={today} required /></div>
            <div className="field"><label htmlFor="note">Details (optional)</label><input id="note" name="note" placeholder="e.g. Lalamove truck, 3 movers / kitchen repainting" /></div>
            <SubmitButton label="Send request" busy="Sending…" />
          </form>
        </main>
      </>
    );
  }
  const moves = await load({ date: { gte: since } });
  const todays = moves.filter((m) => m.date.toDateString() === now.toDateString());
  return (
    <>
      <PageHead title="Moves & renovations" sub={`${todays.length} today · ${moves.filter((m) => m.status === "PENDING").length} waiting for approval`} />
      <main className="view">{moves.length ? moves.map((m) => <MoveCard key={m.id} m={m} owner={false} mgr={mgr} />) : <div className="empty">No moves or renovations scheduled.</div>}</main>
    </>
  );
}
