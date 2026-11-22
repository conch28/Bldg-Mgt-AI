import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { templateByKey } from "@/lib/templates";
import ImportAssets from "./ImportAssets";

export const dynamic = "force-dynamic";
export default async function ImportPage() {
  await requireRole("MANAGER", "ADMIN");
  const t = templateByKey("assets")!;
  return (<>
    <PageHead title="Import assets" sub="Bring in the equipment list from a spreadsheet" back="/data/assets" />
    <main className="view">
      <div className="card" style={{ maxWidth: 760 }}>
        <ol style={{ paddingLeft: 18, lineHeight: 1.7, marginTop: 0 }}>
          <li><a href="/data/templates/assets">Download the template</a>, delete the EXAMPLE row, one row per piece of equipment.</li>
          <li>Required: <span className="mono">{t.cols.filter((c) => c.required).map((c) => c.name).join(", ")}</span>. Safety-critical rows also need manufacturer, model and serial.</li>
          <li>Check first: every problem is listed by row and nothing is saved. Then import. Rows with an existing tag update that asset.</li>
        </ol>
        <ImportAssets />
        <p className="hint" style={{ fontSize: 12, marginTop: 14 }}>Imported specs start as <b>not verified</b>. Changing a verified asset's make, model, serial, criticality or life clears its verification. Each import saves an undo snapshot in Documents (Imports) and is written to the audit log.</p>
      </div>
    </main>
  </>);
}
