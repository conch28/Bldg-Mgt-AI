import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate } from "@/lib/format";
import { markReturned, markSold, postItem, reportLostFound } from "./actions";

export const dynamic = "force-dynamic";
const CATS = ["Furniture", "Appliances", "Kids", "Food", "Services", "Free", "Other"];

export default async function Community({ searchParams }: { searchParams: { tab?: string; error?: string } }) {
  const u = await requireRole();
  const owner = u.role === "OWNER", staff = !owner && u.role !== "BOARD";
  const tab = searchParams.tab === "lost" || u.role === "GUARD" && searchParams.tab !== "market" ? "lost" : "market";
  const [items, lf] = await Promise.all([
    prisma.marketItem.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 40, include: { user: { include: { units: true } } } }),
    prisma.lostFound.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 40, include: { user: true } }),
  ]);
  return (
    <>
      <PageHead title={tab === "lost" ? "Lost & found" : "Resident marketplace"} sub={tab === "lost" ? "Report it once; the guard and your neighbours see it." : "Buy, sell or give away to neighbours. Pick up in the lobby, no strangers."} />
      <main className="view">
        <div className="tabs"><Link href="/community?tab=market" className={"chip" + (tab === "market" ? " on" : "")}>Marketplace</Link><Link href="/community?tab=lost" className={"chip" + (tab === "lost" ? " on" : "")}>Lost & found</Link></div>
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {tab === "market" ? <>
          <div className="item-grid">{items.length ? items.map((it) => (
            <div className="item" key={it.id}><span className="tag t-acc" style={{ alignSelf: "flex-start" }}>{it.category}</span><b>{it.title}</b>
              <div className="price">{it.price == null ? "Ask" : Number(it.price) === 0 ? "Free" : peso(it.price)}</div>
              {it.description && <div className="hint">{it.description}</div>}
              <div className="hint">{it.user.name.split(" ")[0]} · {it.user.units[0]?.code ?? ""} · {fmtDate(it.createdAt)}</div>
              {(it.userId === u.id || staff) && <form action={markSold}><input type="hidden" name="id" value={it.id} /><button className="btn sm">{it.userId === u.id ? "Mark sold" : "Remove"}</button></form>}
            </div>)) : <div className="empty">Nothing for sale yet.</div>}</div>
          {owner && <form action={postItem} className="card stack"><h3>Sell or give something away</h3>
            <div className="field"><label htmlFor="t">What is it?</label><input id="t" name="title" required placeholder="Ikea sofa bed, grey" /></div>
            <div className="field"><label htmlFor="c">Category</label><select id="c" name="category">{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label htmlFor="p">Price (₱, 0 for free)</label><input id="p" name="price" type="number" inputMode="numeric" min={0} /></div>
            <div className="field"><label htmlFor="d">Details (optional)</label><input id="d" name="description" placeholder="Good condition, pick up at 12B" /></div>
            <SubmitButton label="Post to neighbours" busy="Posting…" /></form>}
        </> : <>
          <div className="card"><div className="list">{lf.length ? lf.map((x) => (
            <div className="li" key={x.id}><span className={"tag " + (x.status === "RETURNED" ? "t-ok" : x.kind === "LOST" ? "t-bad" : "t-acc")}>{x.status === "RETURNED" ? "Returned" : x.kind === "LOST" ? "Lost" : "Found"}</span>
              <div style={{ flex: 1 }}><b>{x.title}</b><div className="hint">{x.place} · {fmtDate(x.createdAt)}{x.description ? ` · ${x.description}` : ""}{x.kind === "FOUND" && x.status === "OPEN" ? " · claim at the lobby desk" : ""}</div></div>
              {x.status === "OPEN" && (x.userId === u.id || staff) && <form action={markReturned}><input type="hidden" name="id" value={x.id} /><button className="btn sm">Returned</button></form>}
            </div>)) : <div className="empty">Nothing reported.</div>}</div></div>
          {u.role !== "BOARD" && <form action={reportLostFound} className="card stack"><h3>Report an item</h3>
            <div className="tabs"><label className="chip"><input type="radio" name="kind" value="LOST" defaultChecked={owner} /> I lost something</label><label className="chip"><input type="radio" name="kind" value="FOUND" defaultChecked={!owner} /> I found something</label></div>
            <div className="field"><label htmlFor="lt">What is it?</label><input id="lt" name="title" required placeholder="Black umbrella / car keys with Toyota fob" /></div>
            <div className="field"><label htmlFor="lp">Where?</label><input id="lp" name="place" required placeholder="Pool area, 3rd floor" /></div>
            <div className="field"><label htmlFor="ld">Details (optional)</label><input id="ld" name="description" /></div>
            <SubmitButton label="Report" busy="Sending…" /></form>}
        </>}
      </main>
    </>
  );
}
