import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import DataTabs from "@/components/DataTabs";
import SubmitButton from "@/components/SubmitButton";
import { loadCtx, evaluate, STATUS_LABEL, STATUS_CLS } from "@/lib/readiness";
import { fmtDate } from "@/lib/format";
import { signoff } from "../actions";

export const dynamic = "force-dynamic";
const CRIT_CLS: Record<string, string> = { CRITICAL: "t-bad", HIGH: "t-warn", MEDIUM: "t-acc", LOW: "t-mut" };

export default async function Register({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const [c, signs] = await Promise.all([loadCtx(u.buildingId), prisma.readinessSignoff.findMany({ where: { buildingId: u.buildingId } })]);
  const rows = evaluate(c);
  const canSign = u.role === "BOARD" || u.role === "ADMIN";
  const cats = [...new Set(rows.map((r) => r.category))];
  return (
    <>
      <PageHead title="Readiness register" sub="Every piece of information the building runs on: source, owner, freshness, how it is verified and where it stands today." />
      <main className="view">
        <DataTabs on="/data/register" />
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <p className="hint">Owners are suggested defaults. The board or operations head confirms the real person for each row; that sign-off is the approval to use the data in operations. {signs.length} of {rows.length} confirmed.</p>
        {cats.map((cat) => (
          <section key={cat} className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>{cat}</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Information</th><th>Used by</th><th>Source</th><th>Owner</th><th>Freshness</th><th>Verified by</th><th>Status</th><th>Approved</th></tr></thead>
              <tbody>{rows.filter((r) => r.category === cat).map((r) => { const s = signs.find((x) => x.reqId === r.id); return (
                <tr key={r.id}>
                  <td><b>{r.data}</b> <span className={"tag " + CRIT_CLS[r.criticality]}>{r.criticality.toLowerCase()}</span>{r.safety && <span className="tag t-bad" style={{ marginLeft: 4 }}>safety</span>}<div className="hint">{r.m?.note ?? r.action}</div></td>
                  <td className="hint">{r.module}</td>
                  <td className="hint">{r.source}</td>
                  <td>{s ? <b>{s.ownerName}</b> : r.owner}</td>
                  <td className="hint">{r.frequency}</td>
                  <td className="hint">{r.verify}</td>
                  <td><span className={"tag " + STATUS_CLS[r.status]}>{STATUS_LABEL[r.status]}{r.pct != null && r.status !== "VERIFIED" ? ` ${r.pct}%` : ""}</span></td>
                  <td style={{ minWidth: 160 }}>{s ? <span className="hint">By {s.approvedBy}, {fmtDate(s.approvedAt)}</span> : canSign ? (
                    <form action={signoff} className="inline-form"><input type="hidden" name="reqId" value={r.id} /><input name="ownerName" placeholder="Owner's name" aria-label={`Owner for ${r.data}`} required style={{ width: 120 }} /><SubmitButton label="Confirm" small cls="btn" /></form>
                  ) : <span className="hint">Not yet</span>}</td>
                </tr>); })}</tbody>
            </table></div>
          </section>
        ))}
      </main>
    </>
  );
}
