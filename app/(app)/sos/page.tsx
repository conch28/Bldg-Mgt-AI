import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { ackSos, sendSos } from "./actions";

export const dynamic = "force-dynamic";
const KINDS: [string, string][] = [["MEDICAL", "🚑 Medical"], ["FIRE", "🔥 Fire or smoke"], ["SECURITY", "🛡️ Security"], ["ELEVATOR", "🛗 Stuck in elevator"], ["OTHER", "⚠️ Other"]];
const LABEL = Object.fromEntries(KINDS);
const HOTLINES = [["Lobby guard", "local 100"], ["Building engineer", "local 120"], ["National emergency", "911"], ["Fire (BFP)", "(02) 8426-0219"]];

export default async function Sos() {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN", "GUARD");
  if (u.role === "OWNER") {
    const mine = await prisma.sosAlert.findFirst({ where: { userId: u.id, status: { not: "RESOLVED" } }, orderBy: { createdAt: "desc" } });
    return (
      <>
        <PageHead title="Emergency SOS" sub="One tap alerts the lobby guard and the property manager by app and SMS." />
        <main className="view">
          {mine ? (
            <div className="card" style={{ textAlign: "center", borderColor: mine.status === "ACK" ? "var(--ok)" : "var(--bad)" }}>
              <div className="price-big" style={{ color: mine.status === "ACK" ? "var(--ok)" : "var(--bad)" }}>{mine.status === "ACK" ? "Help is on the way" : "Alert sent"}</div>
              <p>{LABEL[mine.kind]} · sent {fmtTime(mine.createdAt)}</p>
              <p className="hint">{mine.status === "ACK" ? `${mine.ackBy} acknowledged at ${fmtTime(mine.ackAt!)} and is coming to your unit.` : "The guard and manager have been alerted. Stay where you are if it's safe. If you can, call the lobby: local 100."}</p>
            </div>
          ) : (
            <form action={sendSos} className="card stack" style={{ textAlign: "center" }}>
              <div className="sos-kinds">{KINDS.map(([k, l], i) => <label key={k}><input type="radio" name="kind" value={k} defaultChecked={i === 0} />{l}</label>)}</div>
              <input name="note" className="inline-input" placeholder="Optional: what's happening? (e.g. lola fainted)" />
              <button className="sos-big">SOS<small>Tap to send</small></button>
              <div className="hint">For life-threatening emergencies, also call 911.</div>
            </form>
          )}
          <div className="card"><h3>Hotlines</h3><div className="list">{HOTLINES.map(([n, t]) => <div className="li" key={n}><div style={{ flex: 1 }}>{n}</div><b className="mono">{t}</b></div>)}</div></div>
        </main>
      </>
    );
  }
  const alerts = await prisma.sosAlert.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 25, include: { user: true } });
  const open = alerts.filter((a) => a.status !== "RESOLVED");
  return (
    <>
      <PageHead title="SOS alerts" sub={open.length ? `${open.length} need a response` : "No open alerts. All clear."} />
      <main className="view">
        {open.map((a) => (
          <div className="card" key={a.id} style={{ borderColor: "var(--bad)", boxShadow: "inset 4px 0 0 var(--bad)" }}>
            <div className="row"><span className="tag t-bad">{LABEL[a.kind]}</span><b style={{ fontSize: 18 }}>Unit {a.unitCode}</b><span className="hint" style={{ marginLeft: "auto" }}>{fmtTime(a.createdAt)}</span></div>
            <div style={{ marginTop: 6 }}>{a.user.name}{a.note ? ` · "${a.note}"` : ""}</div>
            {a.ackBy && <div className="hint">Acknowledged by {a.ackBy} at {fmtTime(a.ackAt!)}</div>}
            <form action={ackSos} className="row" style={{ marginTop: 10 }}><input type="hidden" name="id" value={a.id} />
              {a.status === "OPEN" && <SubmitButton label="Acknowledge, I'm going" busy="Sending…" />}
              <button name="resolve" value="1" className="btn">Resolved</button></form>
          </div>))}
        <div className="card"><h3>Recent</h3><div className="list">{alerts.filter((a) => a.status === "RESOLVED").map((a) => (
          <div className="li" key={a.id}><span className="tag t-ok">Resolved</span><div style={{ flex: 1 }}>{LABEL[a.kind]} · {a.unitCode}<div className="hint">{fmtDateTime(a.createdAt)} · response {a.ackAt ? Math.max(1, Math.round((a.ackAt.getTime() - a.createdAt.getTime()) / 60000)) : "?"} min · {a.ackBy}</div></div></div>))}</div></div>
      </main>
    </>
  );
}
