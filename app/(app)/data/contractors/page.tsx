import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import DataTabs from "@/components/DataTabs";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, nowManila, peso } from "@/lib/format";
import { CRED_KINDS, requiredKinds, scoreVendor } from "@/lib/vetting";
import { addCredential, verifyCredential } from "../actions";

export const dynamic = "force-dynamic";

export default async function Contractors({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const now = nowManila();
  const [vendors, creds, quotes, pm] = await Promise.all([
    prisma.vendor.findMany({ where: { active: true }, orderBy: { monthlyValue: "desc" } }),
    prisma.vendorCredential.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.quote.findMany({ select: { requestId: true, vendor: true, total: true } }),
    prisma.pMTask.findMany({ select: { vendor: true, nextDue: true } }),
  ]);
  // price evidence: for each request with 2+ quotes, lowest quote divided by this vendor's quote
  const byReq = new Map<string, { vendor: string; total: number }[]>();
  for (const q of quotes) byReq.set(q.requestId, [...(byReq.get(q.requestId) ?? []), { vendor: q.vendor, total: Number(q.total) }]);
  const ratio = (name: string) => {
    const rs: number[] = [];
    for (const qs of byReq.values()) { if (qs.length < 2) continue; const mine = qs.find((q) => q.vendor === name); if (mine && mine.total > 0) rs.push(Math.min(...qs.map((q) => q.total)) / mine.total); }
    return rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : null;
  };
  const rows = vendors.map((v) => {
    const mine = creds.filter((c) => c.vendorId === v.id);
    const tasks = pm.filter((p) => p.vendor === v.name);
    return { v, mine, s: scoreVendor(v, mine, now, { quoteRatio: ratio(v.name), overduePm: tasks.length ? tasks.filter((t) => t.nextDue < now).length : null }) };
  });
  const vetted = rows.filter((r) => r.s.vetted).length;
  return (
    <>
      <PageHead title="Contractor vetting" sub="Registration, permits, licences and insurance, checked by a second person. Scores show their evidence." />
      <main className="view">
        <DataTabs on="/data/contractors" />
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <div className="grid g4">
          <Kpi k="Fully vetted" v={`${vetted}/${rows.length}`} d="Every required document verified and current" cls={vetted === rows.length ? "" : "amber"} />
          <Kpi k="Waiting for a check" v={creds.filter((c) => c.status === "PENDING").length} d="Entered, not yet verified" />
          <Kpi k="Insurance expired" v={vendors.filter((v) => !v.insuranceExpiry || v.insuranceExpiry < now).length} cls={vendors.some((v) => !v.insuranceExpiry || v.insuranceExpiry < now) ? "red" : ""} d="No new jobs until renewed" />
          <Kpi k="Contract value at stake" v={peso(rows.filter((r) => !r.s.vetted).reduce((s, r) => s + Number(r.v.monthlyValue), 0))} d="Per month, with contractors not fully vetted" />
        </div>
        <p className="hint" style={{ marginTop: 12 }}>How the score works: verified qualifications 40 points, service quality 25, price against competing quotes 20, reliability on scheduled jobs 15. Parts with no evidence are left out, and the score says how much evidence it rests on. A contractor is never "vetted" on score alone; every required document must be verified. AI never writes a contractor's credentials or rating.</p>
        {rows.map(({ v, mine, s }) => (
          <section key={v.id} id={`v-${v.id}`} className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div><b style={{ fontSize: 16 }}>{v.name}</b><div className="hint">{v.service} · {peso(v.monthlyValue)}/month{v.contractEnd ? ` · contract to ${fmtDate(v.contractEnd)}` : ""}</div></div>
              <div className="row" style={{ gap: 8 }}>
                <span className={"tag " + (s.vetted ? "t-ok" : "t-bad")}>{s.vetted ? "Vetted" : "Not vetted"}</span>
                <span className="tag t-acc">{s.score == null ? "No score yet" : `Score ${s.score}/100`}</span>
                <span className="hint">based on {s.evidence}% evidence</span>
              </div>
            </div>
            <div className="grid g2" style={{ marginTop: 10 }}>
              <div>
                <div className="hint" style={{ fontWeight: 600, marginBottom: 4 }}>Required documents</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{requiredKinds(v.service).map((k) => {
                  const c = mine.find((x) => x.kind === k && x.status !== "REJECTED");
                  const exp = c?.expiresAt && c.expiresAt < now;
                  return <li key={k} className="row" style={{ justifyContent: "space-between", gap: 6, padding: "5px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                    <span>{CRED_KINDS[k].label}{c?.number && <span className="hint mono"> · {c.number}</span>}{c?.expiresAt && <span className="hint"> · to {fmtDate(c.expiresAt)}</span>}{c?.documentId && <a className="hint" href={`/api/documents/${c.documentId}`}> · file</a>}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className={"tag " + (!c ? "t-bad" : exp ? "t-bad" : c.status === "VERIFIED" ? "t-ok" : "t-warn")}>{!c ? "Missing" : exp ? "Expired" : c.status === "VERIFIED" ? `Verified by ${c.verifiedBy}` : "Needs a check"}</span>
                      {c && c.status === "PENDING" && c.enteredBy !== u.name && <form action={verifyCredential} className="inline-form"><input type="hidden" name="id" value={c.id} /><button className="btn sm pri" name="verdict" value="ok">Verify</button><button className="btn sm" name="verdict" value="reject">Reject</button></form>}
                    </span>
                  </li>; })}</ul>
              </div>
              <div>
                <div className="hint" style={{ fontWeight: 600, marginBottom: 4 }}>Score breakdown</div>
                <table><tbody>{s.parts.map((p) => <tr key={p.key}><td>{p.label}<div className="hint">{p.why}</div></td><td className="r num">{p.points == null ? <span className="hint">no data</span> : `${p.points}/${p.weight}`}</td></tr>)}</tbody></table>
              </div>
            </div>
            {staff && <details style={{ marginTop: 8 }}><summary className="hint" style={{ cursor: "pointer" }}>Add a document</summary>
              <form action={addCredential} style={{ marginTop: 8 }}>
                <input type="hidden" name="vendorId" value={v.id} />
                <div className="formgrid">
                  <div className="field"><label htmlFor={`k-${v.id}`}>Document</label><select id={`k-${v.id}`} name="kind">{Object.entries(CRED_KINDS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>
                  <div className="field"><label htmlFor={`n-${v.id}`}>Number</label><input id={`n-${v.id}`} name="number" /></div>
                  <div className="field"><label htmlFor={`e-${v.id}`}>Expires</label><input id={`e-${v.id}`} name="expiresAt" type="date" /></div>
                  <div className="field"><label htmlFor={`f-${v.id}`}>Copy (PDF or photo)</label><input id={`f-${v.id}`} name="file" type="file" accept=".pdf,image/*" /></div>
                  <div className="field"><label htmlFor={`o-${v.id}`}>Note</label><input id={`o-${v.id}`} name="note" placeholder="e.g. checked on SEC online" /></div>
                </div>
                <SubmitButton label="Add document" cls="btn" />
              </form></details>}
          </section>
        ))}
      </main>
    </>
  );
}
