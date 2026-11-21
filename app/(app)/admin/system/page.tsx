import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDateTime } from "@/lib/format";
import { demoMode } from "@/lib/env";
import { closeRequest, eraseUser } from "./actions";

export const dynamic = "force-dynamic";
const on = (...k: string[]) => k.every((x) => Boolean(process.env[x]));

export default async function System({ searchParams }: { searchParams: { error?: string; erased?: string } }) {
  await requireRole("ADMIN");
  const since = new Date(Date.now() - 7 * 86400000);
  const [errors, errCount, reqs, lastLogin] = await Promise.all([
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.errorLog.count({ where: { createdAt: { gte: since } } }),
    prisma.privacyRequest.findMany({ orderBy: [{ status: "desc" }, { createdAt: "desc" }], take: 30, include: { user: { select: { name: true, email: true, role: true } } } }),
    prisma.auditLog.count({ where: { action: "login", createdAt: { gte: since } } }),
  ]);
  const items: [string, boolean, string][] = [
    ["Mode", !demoMode(), demoMode() ? "Demo (one-tap logins, sample data, test payments)" : "Production (sign-in codes, real data)"],
    ["Session secret", on("NEXTAUTH_SECRET"), "NEXTAUTH_SECRET"],
    ["Sign-in codes by email", on("RESEND_API_KEY", "EMAIL_FROM"), "RESEND_API_KEY, EMAIL_FROM"],
    ["Sign-in codes and alerts by text", on("SEMAPHORE_API_KEY"), "SEMAPHORE_API_KEY, SEMAPHORE_SENDER"],
    ["Claude AI", on("ANTHROPIC_API_KEY"), "ANTHROPIC_API_KEY"],
    ["Online payments", on("PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET"), "PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET"],
    ["Facebook Page posting", on("FB_PAGE_ID", "FB_PAGE_TOKEN"), "FB_PAGE_ID, FB_PAGE_TOKEN"],
    ["Messenger updates", on("MESSENGER_PAGE_TOKEN"), "MESSENGER_PAGE_TOKEN"],
    ["Daily automations", on("CRON_SECRET"), "CRON_SECRET"],
    ["Error alerts (Sentry)", on("SENTRY_DSN"), "SENTRY_DSN"],
    ["Privacy officer contact", on("DPO_NAME", "DPO_EMAIL"), "DPO_NAME, DPO_EMAIL"],
  ];
  const open = reqs.filter((r) => r.status === "OPEN");
  return (<>
    <PageHead title="System & privacy" sub={`${errCount} errors and ${lastLogin} sign-ins in the last 7 days · ${open.length} open privacy request${open.length === 1 ? "" : "s"}`} />
    <main className="view">
      {searchParams.erased && <div className="okmsg">Personal data deleted and the request closed.</div>}
      {searchParams.error && <div className="err">{searchParams.error === "confirm" ? "Type DELETE to confirm." : searchParams.error === "self" ? "You can't delete your own admin account here." : "Write a short reply to the resident."}</div>}
      <div className="card"><h3>Privacy requests</h3>
        <p className="hint" style={{ marginTop: 0 }}>The Data Privacy Act gives residents the right to a copy, a correction or deletion. Reply within 15 days. Copies are self-service (Account → Download my data).</p>
        {reqs.length === 0 && <p className="hint">No requests yet.</p>}
        <div className="list">{reqs.map((r) => (
          <div className="li" key={r.id} style={{ display: "block" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><b style={{ flex: 1 }}>{r.user.name} · {r.kind === "DELETE" ? "delete data" : "fix data"}</b><span className={"tag " + (r.status === "OPEN" ? "t-warn" : "t-ok")}>{r.status.toLowerCase()}</span></div>
            <div className="hint">{fmtDateTime(r.createdAt)} · {r.user.email}{r.note ? ` · “${r.note}”` : ""}{r.reply ? ` · Reply: ${r.reply}` : ""}</div>
            {r.status === "OPEN" && <details className="more" style={{ marginTop: 6 }}><summary>Handle this request</summary>
              <form action={closeRequest} className="inline-form" style={{ marginTop: 8 }}><input type="hidden" name="id" value={r.id} />
                <input name="reply" placeholder="Reply to the resident, e.g. We updated your mobile number po." required style={{ flex: 1, minWidth: 220 }} />
                <select name="status" defaultValue="DONE"><option value="DONE">Done</option><option value="DECLINED">Decline</option></select>
                <SubmitButton label="Send reply" cls="btn" small /></form>
              {r.kind === "DELETE" && r.user.role !== "ADMIN" && <form action={eraseUser} className="inline-form" style={{ marginTop: 8 }}><input type="hidden" name="requestId" value={r.id} />
                <input name="confirm" placeholder="Type DELETE" required style={{ width: 130 }} />
                <SubmitButton label="Delete their personal data" busy="Deleting…" cls="btn danger" small />
                <span className="hint" style={{ fontSize: 12 }}>Cannot be undone. Billing rows stay, without the name.</span></form>}
            </details>}
          </div>))}</div>
      </div>
      <div className="card"><h3>Connections</h3>
        <p className="hint" style={{ marginTop: 0 }}>Keys are added in Vercel → Settings → Environment Variables, then redeploy. Values are never shown here.</p>
        <div className="list">{items.map(([label, ok, keys]) => <div className="li" key={label}><span className={"tag " + (ok ? "t-ok" : "t-warn")}>{ok ? "✓ on" : "○ off"}</span><div style={{ flex: 1 }}><b>{label}</b><div className="hint mono" style={{ fontSize: 12 }}>{keys}</div></div></div>)}</div>
        <p className="hint">Uptime check URL: <span className="mono">/api/health</span>. Nightly encrypted database backups run from GitHub Actions (see DEPLOY.md).</p>
      </div>
      <div className="card"><h3>Recent errors</h3>
        {errors.length === 0 ? <p className="hint">No errors recorded. 🎉</p> :
        <div className="list importlog">{errors.map((e) => <div className="li" key={e.id}><span className="hint mono" style={{ width: 130, flex: "none" }}>{fmtDateTime(e.createdAt)}</span><div style={{ minWidth: 0 }}><b>{e.message}</b><div className="hint">{e.source}{e.path ? ` · ${e.path}` : ""}</div></div></div>)}</div>}
        <p className="hint" style={{ fontSize: 12 }}>Kept 90 days. Emails and phone numbers are masked before saving.</p>
      </div>
    </main>
  </>);
}
