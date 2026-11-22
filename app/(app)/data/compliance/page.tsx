import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import DataTabs from "@/components/DataTabs";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, nowManila } from "@/lib/format";
import { saveCompliance, verifyCompliance, confirmRule } from "../actions";

export const dynamic = "force-dynamic";
const dIn = (x: Date | null) => (x ? new Date(x.getTime() + 8 * 3600000).toISOString().slice(0, 10) : undefined);

export default async function Compliance({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const now = nowManila();
  const items = await prisma.complianceItem.findMany({ where: { buildingId: u.buildingId }, orderBy: [{ mandatory: "desc" }, { expiresAt: "asc" }] });
  const m = items.filter((i) => i.mandatory);
  const state = (i: (typeof items)[number]) => i.expiresAt && i.expiresAt < now ? ["Expired", "t-bad"] : i.status === "REJECTED" ? ["Rejected", "t-bad"] : !i.documentId ? ["No file", "t-bad"] : i.status !== "VERIFIED" ? ["Needs a second check", "t-warn"] : i.expiresAt && i.expiresAt.getTime() - now.getTime() < 45 * 86400000 ? ["Renew soon", "t-warn"] : ["Valid", "t-ok"];
  const valid = m.filter((i) => state(i)[0] === "Valid" || state(i)[0] === "Renew soon").length;
  return (
    <>
      <PageHead title="Permits & insurance" sub="Every permit, certificate and policy the building must keep valid, with the file, the expiry and who checked it." />
      <main className="view">
        <DataTabs on="/data/compliance" />
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <div className="grid g4">
          <Kpi k="Mandatory items valid" v={`${valid}/${m.length}`} d="Verified, file attached, not expired" cls={valid === m.length ? "" : "red"} />
          <Kpi k="Expired" v={m.filter((i) => i.expiresAt && i.expiresAt < now).length} cls={m.some((i) => i.expiresAt && i.expiresAt < now) ? "red" : ""} />
          <Kpi k="Expiring in 45 days" v={m.filter((i) => i.expiresAt && i.expiresAt >= now && i.expiresAt.getTime() - now.getTime() < 45 * 86400000).length} d="Reminders go to the owner; overdue escalates" />
          <Kpi k="Rules confirmed" v={`${m.filter((i) => i.ruleConfirmedAt).length}/${m.length}`} d="By counsel, engineer or safety officer" />
        </div>
        <div className="tip" style={{ marginTop: 16 }} role="note"><div><b>About the default list.</b> The starting checklist covers common requirements for a Metro Manila condominium (BFP, Building Official, DENR, DOLE, NPC, SEC, insurance). It is not legal advice. Each rule counts as mandatory for this building only after a qualified person confirms it applies.</div></div>
        <div className="card" style={{ marginTop: 16 }}><div className="tablewrap"><table>
          <thead><tr><th>Item</th><th>Issued by</th><th>Number</th><th>Expires</th><th>Status</th><th>Checked by</th><th></th></tr></thead>
          <tbody>{items.map((i) => { const [label, cls] = state(i); return (
            <tr key={i.id} id={`c-${i.id}`}>
              <td><b>{i.title}</b>{!i.mandatory && <span className="tag t-mut" style={{ marginLeft: 6 }}>optional</span>}<div className="hint">{i.renewal ?? ""}{i.ownerName ? ` Owner: ${i.ownerName}.` : ""}</div>
                {i.mandatory && !i.ruleConfirmedAt && <div className="hint" style={{ color: "var(--warn)" }}>Rule not yet confirmed for this building</div>}
                {i.ruleConfirmedAt && <div className="hint">Rule confirmed by {i.ruleConfirmedBy}</div>}</td>
              <td>{i.authority}</td>
              <td className="mono">{i.docNumber ?? "—"}</td>
              <td>{i.expiresAt ? fmtDate(i.expiresAt) : <span className="hint">no expiry</span>}</td>
              <td><span className={"tag " + cls}>{label}</span>{i.documentId && <div><a className="hint" href={`/api/documents/${i.documentId}`}>View file</a></div>}</td>
              <td className="hint">{i.verifiedBy ? `${i.verifiedBy}, ${fmtDate(i.verifiedAt!)}` : `Entered by ${i.enteredBy}`}</td>
              <td style={{ minWidth: 180 }}>
                {i.status !== "VERIFIED" && i.documentId && i.enteredBy !== u.name && <form action={verifyCompliance} className="inline-form"><input type="hidden" name="id" value={i.id} /><button className="btn sm pri" name="verdict" value="ok">Verify</button><button className="btn sm" name="verdict" value="reject">Reject</button></form>}
                {(u.role === "ADMIN" || u.role === "BOARD") && i.mandatory && !i.ruleConfirmedAt && <details><summary className="hint" style={{ cursor: "pointer" }}>Confirm rule</summary><form action={confirmRule} className="inline-form"><input type="hidden" name="id" value={i.id} /><input name="who" placeholder="Atty. / Engr. name" aria-label="Who confirmed" required /><SubmitButton label="Save" small cls="btn" /></form></details>}
                {staff && <details><summary className="hint" style={{ cursor: "pointer" }}>Update / renew</summary><Fields i={i} /></details>}
              </td>
            </tr>); })}</tbody>
        </table></div>{!items.length && <p className="hint">Nothing yet. Add the building's permits below, or ask us to load the default checklist.</p>}</div>
        {staff && <details className="card" style={{ marginTop: 16 }}><summary><b>Add a permit, certificate or policy</b></summary><Fields /></details>}
      </main>
    </>
  );
}

function Fields({ i }: { i?: { id: string; title: string; kind: string; authority: string; docNumber: string | null; issuedAt: Date | null; expiresAt: Date | null; renewal: string | null; ownerName: string | null; mandatory: boolean; note: string | null } }) {
  const p = i?.id ?? "new";
  return (
    <form action={saveCompliance} style={{ marginTop: 8 }}>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="formgrid">
        <div className="field"><label htmlFor={`t-${p}`}>Title</label><input id={`t-${p}`} name="title" required defaultValue={i?.title} placeholder="Fire Safety Inspection Certificate" /></div>
        <div className="field"><label htmlFor={`k-${p}`}>Type</label><select id={`k-${p}`} name="kind" defaultValue={i?.kind ?? "CERTIFICATE"}>{["PERMIT", "CERTIFICATE", "INSURANCE", "PLAN", "PRIVACY", "OTHER"].map((k) => <option key={k}>{k}</option>)}</select></div>
        <div className="field"><label htmlFor={`a-${p}`}>Issued by</label><input id={`a-${p}`} name="authority" required defaultValue={i?.authority} placeholder="Bureau of Fire Protection" /></div>
        <div className="field"><label htmlFor={`n-${p}`}>Document number</label><input id={`n-${p}`} name="docNumber" defaultValue={i?.docNumber ?? ""} /></div>
        <div className="field"><label htmlFor={`i-${p}`}>Issued</label><input id={`i-${p}`} name="issuedAt" type="date" defaultValue={dIn(i?.issuedAt ?? null)} /></div>
        <div className="field"><label htmlFor={`e-${p}`}>Expires</label><input id={`e-${p}`} name="expiresAt" type="date" defaultValue={dIn(i?.expiresAt ?? null)} /></div>
        <div className="field"><label htmlFor={`o-${p}`}>Responsible person</label><input id={`o-${p}`} name="ownerName" defaultValue={i?.ownerName ?? ""} /></div>
        <div className="field"><label htmlFor={`r-${p}`}>What renewal needs</label><input id={`r-${p}`} name="renewal" defaultValue={i?.renewal ?? ""} placeholder="Book inspection 60 days before expiry" /></div>
        <div className="field"><label htmlFor={`f-${p}`}>Scan of the document</label><input id={`f-${p}`} name="file" type="file" accept=".pdf,image/*" /></div>
        <div className="field"><label><input type="checkbox" name="mandatory" defaultChecked={i?.mandatory ?? true} /> Mandatory for this building</label></div>
      </div>
      <p className="hint" style={{ fontSize: 12 }}>Saving changes sets the item back to "needs a second check". Someone other than you verifies it against the original.</p>
      <SubmitButton label={i ? "Save" : "Add"} cls="btn" />
    </form>
  );
}
