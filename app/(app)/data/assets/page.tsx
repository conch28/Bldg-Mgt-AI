import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import DataTabs from "@/components/DataTabs";
import { nowManila } from "@/lib/format";
import { saveAsset } from "../actions";
import AssetFields from "./AssetFields";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";
const CRIT_CLS: Record<string, string> = { SAFETY: "t-bad", HIGH: "t-warn", NORMAL: "t-mut" };
const CRIT_LABEL: Record<string, string> = { SAFETY: "Safety-critical", HIGH: "High", NORMAL: "Normal" };
const FILTERS: [string, string][] = [["all", "All"], ["key", "Safety & high"], ["incomplete", "Missing specs"], ["unverified", "Not verified"], ["nopm", "No schedule"], ["old", "Past expected life"], ["faulty", "Faulty"]];

export default async function Assets({ searchParams: sp }: { searchParams: { f?: string; q?: string; ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const [assets, pm] = await Promise.all([prisma.asset.findMany({ orderBy: [{ criticality: "asc" }, { tag: "asc" }] }), prisma.pMTask.findMany({ select: { assetTag: true } })]);
  const hasPm = new Set(pm.map((p) => p.assetTag));
  const spec = (a: (typeof assets)[number]) => [a.manufacturer, a.model, a.serial, a.location, a.installedAt].filter(Boolean).length;
  const old = (a: (typeof assets)[number]) => a.installedAt.getTime() + a.lifeMonths * 30.44 * 86400000 < now.getTime();
  const key = (a: (typeof assets)[number]) => a.criticality !== "NORMAL";
  const f = sp.f ?? "all";
  const q = (sp.q ?? "").toLowerCase();
  const list = assets.filter((a) => (f === "key" ? key(a) : f === "incomplete" ? spec(a) < 5 : f === "unverified" ? key(a) && !a.verifiedAt : f === "nopm" ? a.criticality === "SAFETY" && !hasPm.has(a.tag) : f === "old" ? old(a) && a.status !== "RETIRED" : f === "faulty" ? a.status === "FAULTY" : true)
    && (!q || `${a.tag} ${a.name} ${a.location} ${a.serial ?? ""}`.toLowerCase().includes(q)));
  const keys = assets.filter(key);
  return (
    <>
      <PageHead title="Assets & QR" sub="One record per piece of equipment. Scan the label to see its history, manual, schedule and open jobs." />
      <main className="view">
        <DataTabs on="/data/assets" />
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <div className="grid g4">
          <Kpi k="Assets on record" v={assets.length} d={`${keys.length} safety or high criticality`} />
          <Kpi k="Key assets with full specs" v={`${keys.filter((a) => spec(a) === 5).length}/${keys.length}`} d="Make, model, serial, location, install date" cls={keys.every((a) => spec(a) === 5) ? "" : "amber"} />
          <Kpi k="Key assets verified" v={`${keys.filter((a) => a.verifiedAt).length}/${keys.length}`} d="Checked against nameplate or manual" cls={keys.every((a) => a.verifiedAt) ? "" : "amber"} />
          <Kpi k="Safety assets with a schedule" v={`${assets.filter((a) => a.criticality === "SAFETY" && hasPm.has(a.tag)).length}/${assets.filter((a) => a.criticality === "SAFETY").length}`} d="Target 100%" cls={assets.filter((a) => a.criticality === "SAFETY").every((a) => hasPm.has(a.tag)) ? "" : "red"} />
        </div>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, margin: "16px 0 8px" }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{FILTERS.map(([k, l]) => <Link key={k} href={`/data/assets?f=${k}`} className={"chip" + (f === k ? " on" : "")}>{l}</Link>)}</div>
          <div className="row" style={{ gap: 8 }}>
            <form className="inline-form"><input type="hidden" name="f" value={f} /><input name="q" defaultValue={sp.q} placeholder="Search tag, name, serial" aria-label="Search assets" /></form>
            <Link href={`/data/assets/qr?f=${f}`} className="btn sm">Print QR labels</Link>
            {u.role !== "BOARD" && <Link href="/data/assets/import" className="btn sm">Import CSV</Link>}
          </div>
        </div>
        <div className="card"><div className="tablewrap"><table>
          <thead><tr><th>Asset</th><th>Location</th><th>Criticality</th><th>Specs</th><th>Verified</th><th>Schedule</th><th>Status</th></tr></thead>
          <tbody>{list.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/data/assets/${encodeURIComponent(a.tag)}`}><b>{a.name}</b></Link><div className="hint mono">{a.tag}{a.serial ? ` · S/N ${a.serial}` : ""}</div></td>
              <td>{a.location}</td>
              <td><span className={"tag " + CRIT_CLS[a.criticality]}>{CRIT_LABEL[a.criticality] ?? a.criticality}</span></td>
              <td><span className={"tag " + (spec(a) === 5 ? "t-ok" : "t-warn")}>{spec(a)}/5</span></td>
              <td>{a.verifiedAt ? <span className="tag t-ok">Yes</span> : <span className={"tag " + (key(a) ? "t-bad" : "t-mut")}>No</span>}</td>
              <td>{hasPm.has(a.tag) ? <span className="tag t-ok">Linked</span> : <span className={"tag " + (a.criticality === "SAFETY" ? "t-bad" : "t-mut")}>None</span>}</td>
              <td>{a.status === "FAULTY" ? <span className="tag t-bad">Faulty</span> : old(a) ? <span className="tag t-warn">Past life</span> : <span className="tag t-mut">{a.status.toLowerCase()}</span>}</td>
            </tr>))}</tbody>
        </table></div>{!list.length && <p className="hint">No assets match.</p>}</div>
        {u.role !== "BOARD" && (
          <details className="card" style={{ marginTop: 16 }}><summary><b>Add an asset</b></summary>
            <form action={saveAsset} style={{ marginTop: 10 }}>
              <AssetFields />
              <SubmitButton label="Add asset" />
            </form>
          </details>
        )}
      </main>
    </>
  );
}
