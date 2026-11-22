import type { Asset } from "@prisma/client";

const d = (x: Date | null | undefined) => (x ? new Date(x.getTime() + 8 * 3600000).toISOString().slice(0, 10) : undefined);
const CATS = ["Elevator", "Electrical", "Pump", "Fire protection", "Safety", "Aircon", "Plumbing", "Lighting", "Security", "Telecom", "Fixture"];
/** Shared fields for adding and editing an asset. */
export default function AssetFields({ a }: { a?: Asset }) {
  return (
    <div className="formgrid">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="field"><label htmlFor="af-tag">Tag (printed on the label)</label><input id="af-tag" name="tag" required defaultValue={a?.tag} readOnly={!!a} placeholder="FP-JOCKEY-1" /></div>
      <div className="field"><label htmlFor="af-name">Name</label><input id="af-name" name="name" required defaultValue={a?.name} placeholder="Jockey pump" /></div>
      <div className="field"><label htmlFor="af-cat">Category</label><select id="af-cat" name="category" defaultValue={a?.category ?? "Electrical"}>{[...new Set([...(a ? [a.category] : []), ...CATS])].map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label htmlFor="af-loc">Location</label><input id="af-loc" name="location" required defaultValue={a?.location} placeholder="Pump room" /></div>
      <div className="field"><label htmlFor="af-crit">Criticality</label><select id="af-crit" name="criticality" defaultValue={a?.criticality ?? "NORMAL"}><option value="SAFETY">Safety-critical (fire, lifts, power, gas)</option><option value="HIGH">High (building stops without it)</option><option value="NORMAL">Normal</option></select></div>
      <div className="field"><label htmlFor="af-man">Manufacturer</label><input id="af-man" name="manufacturer" defaultValue={a?.manufacturer ?? ""} /></div>
      <div className="field"><label htmlFor="af-mod">Model</label><input id="af-mod" name="model" defaultValue={a?.model ?? ""} /></div>
      <div className="field"><label htmlFor="af-ser">Serial number</label><input id="af-ser" name="serial" defaultValue={a?.serial ?? ""} /></div>
      <div className="field"><label htmlFor="af-src">Specs taken from</label><select id="af-src" name="specSource" defaultValue={a?.specSource ?? "UNKNOWN"}><option value="NAMEPLATE">Nameplate (photo)</option><option value="MANUAL">Manual or datasheet</option><option value="INVOICE">Invoice or delivery receipt</option><option value="CONTRACTOR">Contractor report</option><option value="UNKNOWN">Not sure yet</option></select></div>
      <div className="field"><label htmlFor="af-inst">Installed</label><input id="af-inst" name="installedAt" type="date" required defaultValue={d(a?.installedAt)} /></div>
      <div className="field"><label htmlFor="af-life">Expected life (months)</label><input id="af-life" name="lifeMonths" type="number" min="1" required defaultValue={a?.lifeMonths ?? 120} /></div>
      <div className="field"><label htmlFor="af-war">Warranty until</label><input id="af-war" name="warrantyUntil" type="date" defaultValue={d(a?.warrantyUntil)} /></div>
      <div className="field"><label htmlFor="af-cost">Acquisition cost (₱)</label><input id="af-cost" name="cost" type="number" min="0" step="0.01" defaultValue={a ? Number(a.cost) : 0} /></div>
      <div className="field"><label htmlFor="af-rc">Replacement cost today (₱)</label><input id="af-rc" name="replacementCost" type="number" min="0" step="0.01" defaultValue={a?.replacementCost != null ? Number(a.replacementCost) : ""} placeholder="From a current quote" /></div>
      <div className="field"><label htmlFor="af-own">Responsible person</label><input id="af-own" name="ownerName" defaultValue={a?.ownerName ?? ""} placeholder="Chief engineer" /></div>
      <div className="field"><label htmlFor="af-ven">Service contractor</label><input id="af-ven" name="vendor" defaultValue={a?.vendor ?? ""} /></div>
    </div>
  );
}
