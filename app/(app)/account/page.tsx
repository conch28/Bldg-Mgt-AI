import { PageHead } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ChangePassword from "@/components/ChangePassword";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/format";
import { DPO } from "@/lib/privacy";
import { requestPrivacy } from "./actions";

export const dynamic = "force-dynamic";
export default async function Account({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  const u = await requireRole();
  const reqs = await prisma.privacyRequest.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return (<>
    <PageHead title="Account" sub={`${u.name} · ${u.email}`} />
    <main className="view">
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Your data</h3>
        <p className="hint" style={{ marginTop: 0 }}>You can get a copy of everything we keep about you, or ask us to fix or delete it. We reply within 15 days. <a href="/privacy">Read the privacy notice</a>.</p>
        {searchParams.sent && <div className="okmsg" style={{ marginBottom: 10 }}>Got it po. Your request was sent to {DPO.name}. We&apos;ll update you here.</div>}
        {searchParams.error && <div className="err" style={{ marginBottom: 10 }}>{searchParams.error === "limit" ? "You've sent several requests today. Please wait until tomorrow." : "Please choose what you want us to do."}</div>}
        <p><a className="btn" href="/api/me/export" download>Download my data</a></p>
        <details className="more"><summary>Fix or delete my data</summary>
          <form action={requestPrivacy} style={{ marginTop: 10 }}>
            <div className="seg" role="radiogroup" style={{ marginBottom: 10 }}>
              <label><input type="radio" name="kind" value="CORRECT" defaultChecked /> <span>Fix something</span></label>
              <label><input type="radio" name="kind" value="DELETE" /> <span>Delete my data</span></label>
            </div>
            <div className="field"><label htmlFor="pnote">What should we change? (optional)</label><textarea id="pnote" name="note" rows={3} maxLength={1000} /></div>
            <p className="hint" style={{ fontSize: 12 }}>If you delete, we remove your name, contact details, messages and listings. Billing records stay for 10 years because tax rules require it, with your name removed.</p>
            <SubmitButton label="Send request" cls="btn" busy="Sending…" />
          </form>
        </details>
        {reqs.length > 0 && <div className="list" style={{ marginTop: 12 }}>{reqs.map((r) => <div className="li" key={r.id}><div style={{ flex: 1 }}><b>{r.kind === "DELETE" ? "Delete my data" : r.kind === "CORRECT" ? "Fix my data" : "Copy of my data"}</b><div className="hint">{fmtDate(r.createdAt)}{r.reply ? ` · ${r.reply}` : ""}</div></div><span className={"tag " + (r.status === "OPEN" ? "t-warn" : "t-ok")}>{r.status === "OPEN" ? "in progress" : r.status.toLowerCase()}</span></div>)}</div>}
      </div>
      <div className="card" style={{ maxWidth: 560 }}><h3>Change password</h3><p className="hint" style={{ marginTop: 0 }}>Optional. You can always sign in with a one-time code sent to your email or phone.</p><ChangePassword /></div>
    </main>
  </>);
}
