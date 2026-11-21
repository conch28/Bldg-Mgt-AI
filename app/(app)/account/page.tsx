import { PageHead } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import ChangePassword from "@/components/ChangePassword";
export default async function Account() {
  const u = await requireRole();
  return (<><PageHead title="Account" sub={`${u.name} · ${u.email}`} /><main className="view"><div className="card" style={{ maxWidth: 460 }}><h3>Change password</h3><ChangePassword /></div></main></>);
}
