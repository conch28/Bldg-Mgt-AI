import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate, nowManila } from "@/lib/format";
import { saveVendor } from "./actions";

export const dynamic = "force-dynamic";
const days = (d: Date | null, now: Date) => (d ? Math.ceil((d.getTime() - now.getTime()) / 86400000) : null);
function Due({ d, now }: { d: Date | null; now: Date }) {
  const n = days(d, now);
  if (n == null) return <span className="hint">—</span>;
  const cls = n < 0 ? "t-bad" : n <= 30 ? "t-warn" : n <= 60 ? "t-acc" : "t-mut";
  return <span className={"tag " + cls}>{fmtDate(d!)}{n < 0 ? " · expired" : n <= 60 ? ` · ${n}d` : ""}</span>;
}

export default async function Vendors({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { monthlyValue: "desc" } });
  const monthly = vendors.reduce((s, v) => s + Number(v.monthlyValue), 0);
  const soon = vendors.filter((v) => { const a = days(v.contractEnd, now), b = days(v.insuranceExpiry, now); return (a != null && a <= 60) || (b != null && b <= 30); });
  const rated = vendors.filter((v) => v.rating != null);
  return (
    <>
      <PageHead title="Vendors & contracts" sub="Every service contract, its value, renewal date and insurance, so nothing lapses quietly." />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <div className="grid g4">
          <Kpi k="Active contracts" v={vendors.length} />
          <Kpi k="Monthly contract value" v={peso(monthly)} d={`${peso(monthly * 12)} a year`} />
          <Kpi k="Need attention" v={soon.length} cls={soon.length ? "amber" : ""} d="Renewal within 60 days or insurance within 30" />
          <Kpi k="Average rating" v={rated.length ? (rated.reduce((s, v) => s + Number(v.rating), 0) / rated.length).toFixed(1) + "★" : "—"} d="From ticket ratings and board review" />
        </div>
        <div className="card"><div className="tablewrap"><table>
          <thead><tr><th>Vendor</th><th>Service</th><th className="r">Monthly</th><th>Contract ends</th><th>Insurance</th><th className="r">Rating</th><th>Contact</th></tr></thead>
          <tbody>{vendors.map((v) => <tr key={v.id}><td><b>{v.name}</b>{v.notes && <div className="hint">{v.notes}</div>}</td><td>{v.service}</td><td className="r num">{peso(v.monthlyValue)}</td>
            <td><Due d={v.contractEnd} now={now} /></td><td><Due d={v.insuranceExpiry} now={now} /></td><td className="r num">{v.rating ? Number(v.rating).toFixed(1) + "★" : "—"}</td><td className="hint">{v.contact}{v.phone ? ` · ${v.phone}` : ""}</td></tr>)}</tbody>
        </table></div></div>
        {u.role !== "BOARD" && (
          <div className="card"><h3>Add a vendor</h3>
            <form action={saveVendor} style={{ marginTop: 8 }}>
              <div className="formgrid">
                <div className="field"><label htmlFor="vn">Name</label><input id="vn" name="name" required /></div>
                <div className="field"><label htmlFor="vs">Service</label><input id="vs" name="service" required placeholder="Security, cleaning, elevator…" /></div>
                <div className="field"><label htmlFor="vm">Monthly value (₱)</label><input id="vm" name="monthlyValue" type="number" min="0" step="100" required /></div>
                <div className="field"><label htmlFor="vc">Contact person</label><input id="vc" name="contact" /></div>
                <div className="field"><label htmlFor="vp">Phone</label><input id="vp" name="phone" /></div>
                <div className="field"><label htmlFor="ve">Contract ends</label><input id="ve" name="contractEnd" type="date" /></div>
                <div className="field"><label htmlFor="vi">Insurance expires</label><input id="vi" name="insuranceExpiry" type="date" /></div>
              </div>
              <SubmitButton label="Add vendor" />
            </form>
          </div>
        )}
      </main>
    </>
  );
}
