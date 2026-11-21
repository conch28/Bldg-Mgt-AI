import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import ImportForm from "./ImportForm";

export const dynamic = "force-dynamic";
export default async function Import() {
  await requireRole("ADMIN");
  return (<>
    <PageHead title="Import data" sub="Bring in the building's real units, owners and unpaid balances" back="/admin/users" />
    <main className="view">
      <div className="card" style={{ maxWidth: 680 }}>
        <ol className="steps-plain" style={{ paddingLeft: 18, lineHeight: 1.7, marginTop: 0 }}>
          <li><a href="/admin/import/template">Download the template</a> and open it in Google Sheets or Excel.</li>
          <li>One row per unit. Columns: <span className="mono">unit, floor, sqm, owner_name</span> (required), <span className="mono">owner_email, owner_mobile, balance_due, balance_as_of</span> (optional).</li>
          <li>Save as CSV, check it here, fix anything flagged, then import. Running it again updates units instead of duplicating them.</li>
        </ol>
        <ImportForm />
        <p className="hint" style={{ fontSize: 12, marginTop: 14 }}>Owners with an email get a login and sign in with a one-time code. balance_due becomes an unpaid bill for the balance_as_of month (last month if blank). The file is read once and not stored. Every import is written to the audit log.</p>
      </div>
    </main>
  </>);
}
