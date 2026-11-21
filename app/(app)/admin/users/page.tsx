import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { CreateUserForm, ResetForm } from "@/components/AdminForms";
import { fmtDateTime } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { paymongoEnabled } from "@/lib/payments";
import { toggleActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function Users() {
  const me = await requireRole("ADMIN");
  const [users, units, linked, log] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { units: { select: { code: true } } } }),
    prisma.unit.count(), prisma.unit.count({ where: { ownerId: { not: null } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: true } }),
  ]);
  const Check = ({ on, label }: { on: boolean; label: string }) => <span className={"tag " + (on ? "t-ok" : "t-warn")}>{on ? "✓" : "○"} {label}</span>;
  return (
    <>
      <PageHead title="Users & units" sub={`${users.length} accounts · ${linked} of ${units} units linked to an owner login`} />
      <main className="view">
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <b style={{ marginRight: 6 }}>Integrations</b>
          <Check on={aiEnabled()} label="Claude AI (ANTHROPIC_API_KEY)" />
          <Check on={paymongoEnabled()} label="Online payments (PAYMONGO_SECRET_KEY)" />
          <Check on={Boolean(process.env.SEMAPHORE_API_KEY)} label="SMS reminders (SEMAPHORE_API_KEY)" />
        </div>
        <div className="card"><h3>Add an account</h3><div className="hint" style={{ marginBottom: 10 }}>A temporary password is generated. Owners are linked to their unit.</div><CreateUserForm /></div>
        <div className="card"><h3>Accounts</h3>
          <div className="tablewrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Unit</th><th>Status</th><th /></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td className="mono">{u.email}</td><td>{u.role.toLowerCase()}</td><td>{u.units.map((x) => x.code).join(", ")}</td>
                <td><span className={"tag " + (u.active ? "t-ok" : "t-mut")}>{u.active ? "active" : "disabled"}</span></td>
                <td className="r"><div className="inline-form" style={{ justifyContent: "flex-end" }}>
                  <ResetForm id={u.id} />
                  {u.id !== me.id && <form action={toggleActive}><input type="hidden" name="id" value={u.id} /><SubmitButton label={u.active ? "Disable" : "Enable"} small cls="btn" /></form>}
                </div></td></tr>))}
            </tbody></table></div></div>
        <div className="card"><h3>Audit log</h3>
          <div className="list">{log.map((l) => <div className="li" key={l.id}><span className="hint mono" style={{ width: 140, flex: "none" }}>{fmtDateTime(l.createdAt)}</span><div><b>{l.user?.name ?? "System"}</b> · {l.action}{l.detail ? `: ${l.detail}` : ""}</div></div>)}</div></div>
      </main>
    </>
  );
}
