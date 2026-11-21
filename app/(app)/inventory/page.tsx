import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import Tip from "@/components/Tip";
import SubmitButton from "@/components/SubmitButton";
import PhotoField from "@/components/PhotoField";
import { peso, fmtDate, nowManila } from "@/lib/format";
import { countStock, issueStock, logReplacement } from "./actions";

export const dynamic = "force-dynamic";
type SP = { tab?: string; tag?: string; error?: string; ok?: string };

export default async function Inventory({ searchParams: sp }: { searchParams: SP }) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD");
  const staff = u.role !== "BOARD";
  const tab = sp.tab === "stock" || sp.tab === "assets" ? sp.tab : "log";
  return (
    <>
      <PageHead title="Stock & assets" sub="Every fixture, every part, every replacement" />
      <main className="view">
        <Tip id="inventory" title="If it was replaced, it's in the log.">Each light, aircon, pump and fixture has a tag. Logging a replacement records what, where, when, who, the cost and the new warranty, takes the part out of stock and asks for the old part back.</Tip>
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <div className="tabs">
          <Link href="/inventory?tab=log" className={"chip" + (tab === "log" ? " on" : "")}>Replacement log</Link>
          <Link href="/inventory?tab=stock" className={"chip" + (tab === "stock" ? " on" : "")}>Storeroom stock</Link>
          <Link href="/inventory?tab=assets" className={"chip" + (tab === "assets" ? " on" : "")}>Fixtures & equipment</Link>
          <Link href="/procurement?tab=controls" className="chip">Red flags</Link>
        </div>
        {tab === "log" && <Log staff={staff} />}
        {tab === "stock" && <Stock staff={staff} />}
        {tab === "assets" && <Assets tag={sp.tag} />}
      </main>
    </>
  );
}

async function Log({ staff }: { staff: boolean }) {
  const [reps, assets, items] = await Promise.all([
    prisma.replacement.findMany({ include: { asset: true, item: true }, orderBy: { doneAt: "desc" }, take: 40 }),
    staff ? prisma.asset.findMany({ where: { status: { not: "RETIRED" } }, orderBy: [{ location: "asc" }, { name: "asc" }] }) : [],
    staff ? prisma.stockItem.findMany({ orderBy: { name: "asc" } }) : [],
  ]);
  const yearAgo = nowManila().getTime() - 365 * 86400000;
  const countBy = new Map<string, number>();
  for (const r of reps) if (r.doneAt.getTime() >= yearAgo) countBy.set(r.assetId, (countBy.get(r.assetId) ?? 0) + 1);
  return (
    <div className="grid g-7-5">
      <div className="card"><h3>Recent replacements</h3>
        <div className="list" style={{ marginTop: 4 }}>
          {reps.length ? reps.map((r) => {
            const n = countBy.get(r.assetId) ?? 0, often = n >= 3 && n > Math.ceil(12 / r.asset.lifeMonths) * 2;
            return (
              <div className="li" key={r.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{r.asset.name}</b> <span className="hint">· {r.asset.location}</span>
                  <div className="hint">{fmtDate(r.doneAt)} · by {r.doneBy}{r.workOrder ? ` · WO-${r.workOrder}` : ""}{r.item ? ` · ${r.item.name} from stock` : ""} · logged by {r.loggedBy}</div>
                  <div className="row" style={{ gap: 5, marginTop: 4 }}>
                    {r.warrantyClaim ? <span className="tag t-ok">Warranty claim</span> : <span className="tag t-mut num">{peso(Number(r.cost))}</span>}
                    {r.newWarrantyTil && <span className="tag t-acc">Warranty to {r.newWarrantyTil.toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "Asia/Manila" })}</span>}
                    {r.oldPartReturned ? <span className="tag t-ok">Old part returned</span> : !r.warrantyClaim && <span className="tag t-bad">Old part not returned</span>}
                    {often && <Link href={`/inventory?tab=assets&tag=${encodeURIComponent(r.asset.tag)}`} className="tag t-warn">{n}× in 12 months</Link>}
                  </div>
                </div>
                {r.photo && <img src={r.photo} alt={`New ${r.asset.name}`} className="stop-thumb" />}
              </div>
            );
          }) : <div className="empty">No replacements logged yet.</div>}
        </div>
      </div>
      {staff && (
        <form action={logReplacement} className="card">
          <h3>Log a replacement</h3>
          <div className="field" style={{ marginTop: 8 }}><label htmlFor="assetId">Which fixture? (tag on the item)</label>
            <select id="assetId" name="assetId" required defaultValue=""><option value="" disabled>Pick a fixture</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.location} · {a.name} ({a.tag})</option>)}</select></div>
          <div className="field"><label htmlFor="itemId">Part from the storeroom (optional)</label>
            <select id="itemId" name="itemId" defaultValue=""><option value="">Supplied by the vendor</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.onHand} left</option>)}</select></div>
          <div className="formgrid">
            <div className="field"><label htmlFor="doneBy">Replaced by</label><input id="doneBy" name="doneBy" required placeholder="e.g. Jun P. or LiftCare" maxLength={80} /></div>
            <div className="field"><label htmlFor="workOrder">Work order</label><input id="workOrder" name="workOrder" placeholder="e.g. 1042" /></div>
            <div className="field"><label htmlFor="cost">Cost ₱</label><input id="cost" name="cost" inputMode="decimal" defaultValue="0" required /></div>
            <div className="field"><label htmlFor="warrantyMonths">New warranty (months)</label><input id="warrantyMonths" name="warrantyMonths" inputMode="numeric" placeholder="e.g. 12" /></div>
          </div>
          <label className="toggle"><input type="checkbox" name="oldPartReturned" /> Old part handed back to the storeroom</label>
          <label className="toggle"><input type="checkbox" name="warrantyClaim" /> Free replacement under warranty</label>
          <div className="field" style={{ marginTop: 8 }}><label htmlFor="rnote">Note (optional)</label><input id="rnote" name="note" maxLength={400} placeholder="e.g. ballast burnt, replaced with LED" /></div>
          <div className="row"><PhotoField label="Photo of the new part" /><SubmitButton label="Save to log" busy="Saving…" /></div>
        </form>
      )}
    </div>
  );
}

async function Stock({ staff }: { staff: boolean }) {
  const [items, moves] = await Promise.all([
    prisma.stockItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockMove.findMany({ include: { item: true }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const value = items.reduce((s, i) => s + i.onHand * Number(i.lastPrice ?? i.benchmark), 0);
  const low = items.filter((i) => i.onHand <= i.reorderPoint);
  return (
    <div className="stack">
      <div className="mini-row">
        <div className="mini"><b className="n">{items.length}</b><span>items<br />tracked</span></div>
        <div className="mini"><b className="n num">{peso(value)}</b><span>stock<br />value</span></div>
        <div className="mini"><b className="n" style={{ color: low.length ? "var(--warn)" : undefined }}>{low.length}</b><span>below<br />reorder point</span></div>
      </div>
      <div className="card"><h3>Storeroom</h3>
        <div className="tablewrap"><table className="stack-m">
          <thead><tr><th>Item</th><th>On hand</th><th>Reorder at</th><th>Last price</th><th>Benchmark</th>{staff && <th />}</tr></thead>
          <tbody>{items.map((i) => {
            const over = i.lastPrice && Number(i.lastPrice) > Number(i.benchmark) * 1.15;
            return (
              <tr key={i.id}>
                <td data-l="Item"><b>{i.name}</b><div className="hint">{i.sku} · {i.category}</div></td>
                <td data-l="On hand" className="num"><b style={{ color: i.onHand <= i.reorderPoint ? "var(--warn)" : undefined }}>{i.onHand}</b> {i.uom}</td>
                <td data-l="Reorder at" className="num">{i.reorderPoint}</td>
                <td data-l="Last price" className="num" style={{ color: over ? "var(--bad)" : undefined }}>{i.lastPrice ? peso(Number(i.lastPrice)) : "–"}</td>
                <td data-l="Benchmark" className="num">{peso(Number(i.benchmark))}</td>
                {staff && <td>{i.onHand <= i.reorderPoint && <Link href={`/procurement?new=1&item=${i.id}`} className="btn sm pri">Reorder</Link>}</td>}
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
      {staff && (
        <div className="grid g2">
          <form action={issueStock} className="card"><h3>Take items out</h3>
            <div className="field" style={{ marginTop: 8 }}><label htmlFor="iitem">Item</label><select id="iitem" name="itemId" required>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.onHand})</option>)}</select></div>
            <div className="formgrid"><div className="field"><label htmlFor="iqty">How many</label><input id="iqty" name="qty" inputMode="numeric" defaultValue={1} /></div>
              <div className="field"><label htmlFor="iref">For which job?</label><input id="iref" name="ref" placeholder="WO-1042 or fixture tag" required maxLength={40} /></div></div>
            <SubmitButton label="Take out" cls="btn" />
          </form>
          <form action={countStock} className="card"><h3>Stock count</h3><div className="hint">Count with a second person. Differences are recorded and shortages are flagged.</div>
            <div className="field" style={{ marginTop: 8 }}><label htmlFor="citem">Item</label><select id="citem" name="itemId" required>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
            <div className="field"><label htmlFor="counted">Counted</label><input id="counted" name="counted" inputMode="numeric" required /></div>
            <SubmitButton label="Save count" cls="btn" />
          </form>
        </div>
      )}
      <div className="card"><h3>Recent stock movements</h3>
        <div className="list" style={{ marginTop: 4 }}>{moves.map((m) => (
          <div className="li" key={m.id}><span className={"tag " + (m.kind === "RECEIVE" ? "t-ok" : m.kind === "ADJUST" ? (m.qty < 0 ? "t-bad" : "t-acc") : m.kind === "RETURN" ? "t-mut" : "t-warn")}>{m.kind === "RECEIVE" ? "In" : m.kind === "ISSUE" ? "Out" : m.kind === "RETURN" ? "Old part" : "Count"}</span>
            <div style={{ flex: 1 }}><b className="num">{m.qty > 0 ? "+" : ""}{m.qty || ""}</b> {m.item.name}<div className="hint">{fmtDate(m.createdAt)} · {m.byName}{m.ref ? ` · ${m.ref}` : " · no job named"}{m.note ? ` · ${m.note}` : ""}</div></div></div>
        ))}</div>
      </div>
    </div>
  );
}

async function Assets({ tag }: { tag?: string }) {
  const assets = await prisma.asset.findMany({ include: { replacements: { orderBy: { doneAt: "desc" } } }, orderBy: [{ category: "asc" }, { location: "asc" }] });
  const sel = tag ? assets.find((a) => a.tag === tag) : null;
  const now = nowManila();
  const cats = [...new Set(assets.map((a) => a.category))];
  return (
    <div className="stack">
      {sel && (
        <div className="card pr-detail"><span className="tag t-mut">{sel.tag}</span><h3 style={{ marginTop: 6 }}>{sel.name} · {sel.location}</h3>
          <div className="hint">Installed {fmtDate(sel.installedAt)} · expected life {sel.lifeMonths} months · {sel.warrantyUntil && sel.warrantyUntil > now ? `under warranty until ${fmtDate(sel.warrantyUntil)}` : "no active warranty"} · {sel.vendor ?? "vendor not recorded"}</div>
          <h4 className="sub-h">Replacement history ({sel.replacements.length})</h4>
          <div className="list">{sel.replacements.map((r) => <div className="li" key={r.id}><div style={{ flex: 1 }}>{fmtDate(r.doneAt)} · {r.doneBy}{r.workOrder ? ` · WO-${r.workOrder}` : ""}<div className="hint">{r.note}</div></div><b className="num">{r.warrantyClaim ? "Warranty" : peso(Number(r.cost))}</b>{!r.oldPartReturned && !r.warrantyClaim && <span className="tag t-bad">No old part</span>}</div>)}</div>
        </div>
      )}
      {cats.map((c) => (
        <details className="card more" key={c} open={!sel && c === cats[0]}>
          <summary><h3 style={{ display: "inline" }}>{c}</h3><span className="hint" style={{ marginLeft: 8 }}>{assets.filter((a) => a.category === c).length}</span></summary>
          <div className="list" style={{ marginTop: 4 }}>{assets.filter((a) => a.category === c).map((a) => {
            const ageM = (now.getTime() - a.installedAt.getTime()) / (30.4 * 86400000);
            const warr = a.warrantyUntil && a.warrantyUntil > now;
            return (
              <Link href={`/inventory?tab=assets&tag=${encodeURIComponent(a.tag)}`} className="li pr-row" key={a.id}>
                <div style={{ flex: 1, minWidth: 0 }}><b>{a.name}</b><div className="hint">{a.location} · {a.tag} · {a.replacements.length} replacement{a.replacements.length === 1 ? "" : "s"}</div></div>
                {a.status === "FAULTY" ? <span className="tag t-bad">Faulty</span> : ageM > a.lifeMonths ? <span className="tag t-warn">Past expected life</span> : warr ? <span className="tag t-ok">Warranty</span> : <span className="tag t-mut">OK</span>}
              </Link>
            );
          })}</div>
        </details>
      ))}
      {!assets.length && <div className="empty">No fixtures registered yet.</div>}
    </div>
  );
}
