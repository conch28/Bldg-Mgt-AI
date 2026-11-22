import Link from "next/link";
import { requireRole, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import Tip from "@/components/Tip";
import SubmitButton from "@/components/SubmitButton";
import PhotoField from "@/components/PhotoField";
import { LIMITS, amountOf, approvalProgress, approvalsOf, canApprove, canReceive, controlFlags, ruleFor, savingsThisYear } from "@/lib/procurement";
import { peso, pesoK, fmtDate, fmtDateTime, nowManila } from "@/lib/format";
import { addQuote, approve, createRequest, issuePO, receive, reject, submitForApproval, saveReceipt, releasePayment } from "./actions";

export const dynamic = "force-dynamic";
const STATUS: Record<string, [string, string]> = {
  QUOTING: ["Getting quotes", "t-mut"], PENDING: ["Waiting for approval", "t-warn"], APPROVED: ["Approved", "t-acc"],
  ORDERED: ["Ordered", "t-acc"], RECEIVED: ["Received, to pay", "t-warn"], PAID: ["Paid", "t-ok"], REJECTED: ["Rejected", "t-bad"],
};
const CATS = ["Lighting", "Electrical", "Plumbing", "Aircon", "Pump", "Elevator", "Safety", "Cleaning", "Civil", "Office", "Other"];
type SP = { tab?: string; pr?: string; new?: string; item?: string; cat?: string; error?: string; ok?: string };

export default async function Procurement({ searchParams: sp }: { searchParams: SP }) {
  const u = await requireRole("MANAGER", "ADMIN", "BOARD", "GUARD");
  const isGuard = u.role === "GUARD", isBoard = u.role === "BOARD", staff = !isGuard && !isBoard;
  const tab = isGuard ? "receive" : sp.new && staff ? "new" : sp.tab === "controls" || (isBoard && !sp.tab && !sp.pr) ? "controls" : "requests";
  const detail = sp.pr ? await prisma.purchaseRequest.findUnique({ where: { number: Number(sp.pr) || 0 }, include: { quotes: { orderBy: { total: "asc" } }, item: true } }) : null;

  return (
    <>
      <PageHead title={isGuard ? "Deliveries to receive" : "Procurement"} sub={isGuard ? "Count what arrived, take a photo, then confirm" : "Purchase requests, quotes, approvals and red flags"} back={detail ? "/procurement" : undefined} />
      <main className="view">
        <Tip id="procurement" title={isGuard ? "Count before you sign." : "Every peso has a paper trail."}>
          {isGuard ? "Check the item and quantity against the purchase order. Take a photo of the goods and the delivery receipt. If something is missing, enter the number that actually arrived." : `Up to ${peso(LIMITS.manager)} the manager approves. Above that, 3 quotes and board signatures. Nobody approves or receives their own request, and the AI watches for split orders and inflated prices.`}
        </Tip>
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        {!isGuard && (
          <div className="tabs">
            <Link href="/procurement?tab=controls" className={"chip" + (tab === "controls" ? " on" : "")}>Board view</Link>
            <Link href="/procurement?tab=requests" className={"chip" + (tab === "requests" ? " on" : "")}>Requests</Link>
            {staff && <Link href="/procurement?new=1" className={"chip" + (tab === "new" ? " on" : "")}>+ New request</Link>}
            <Link href="/inventory" className="chip">Stock & assets</Link>
          </div>
        )}
        {detail && <Detail pr={detail} u={u} />}
        {tab === "controls" && <Controls u={u} />}
        {tab === "requests" && <Requests />}
        {tab === "receive" && <ToReceive u={u} />}
        {tab === "new" && <NewRequest sp={sp} />}
      </main>
    </>
  );
}

type Full = NonNullable<Awaited<ReturnType<typeof loadOne>>>;
const loadOne = (n: number) => prisma.purchaseRequest.findUnique({ where: { number: n }, include: { quotes: { orderBy: { total: "asc" } }, item: true } });

function Detail({ pr, u }: { pr: Full; u: SessionUser }) {
  const amount = amountOf(pr), rule = ruleFor(amount), prog = approvalProgress(pr);
  const lowest = pr.quotes[0];
  const chosen = pr.quotes.find((q) => q.id === pr.chosenQuote);
  const unit = chosen ? Number(chosen.total) / Math.max(1, pr.qty) : 0;
  const bench = pr.item ? Number(pr.item.benchmark) : null;
  const ap = canApprove(pr, u), rc = canReceive(pr, u.id);
  const staff = u.role === "MANAGER" || u.role === "ADMIN";
  const [label, cls] = STATUS[pr.status] ?? [pr.status, "t-mut"];
  return (
    <div className="card pr-detail">
      <div className="cardhead"><div><span className={"tag " + cls}>{label}</span><h3 style={{ marginTop: 6 }}>PR-{pr.number} · {pr.title}</h3>
        <div className="hint">{pr.qty} {pr.item?.uom ?? "pc"} · {pr.category} · requested by {pr.requester} on {fmtDate(pr.createdAt)}{pr.workOrder ? ` · for WO-${pr.workOrder}` : ""}</div></div>
        <div className="pr-amt num">{peso(amount)}</div></div>
      <p style={{ margin: "8px 0" }}>{pr.reason}</p>
      <div className="hint"><b>Rule:</b> {rule.label}</div>
      {bench && chosen && <div className={"hint"} style={{ color: unit > bench * (1 + LIMITS.overBenchmark) ? "var(--bad)" : undefined }}><b>Price check:</b> {peso(unit)} each vs benchmark {peso(bench)}{unit > bench * (1 + LIMITS.overBenchmark) ? ` (${Math.round((unit / bench - 1) * 100)}% above, ask for a re-quote)` : " (fair)"}</div>}

      <h4 className="sub-h">Quotes ({pr.quotes.length}{rule.quotes > 1 ? ` of ${rule.quotes} needed` : ""})</h4>
      <div className="list">
        {pr.quotes.map((q) => (
          <div className="li" key={q.id}>
            <div style={{ flex: 1 }}><b>{q.vendor}</b>{q.id === lowest?.id && <span className="tag t-ok" style={{ marginLeft: 6 }}>Lowest</span>}{q.id === pr.chosenQuote && <span className="tag t-acc" style={{ marginLeft: 6 }}>Chosen</span>}<div className="hint">added by {q.addedBy}</div></div>
            <b className="num">{peso(Number(q.total))}</b>
          </div>
        ))}
      </div>
      {pr.chooseNote && <div className="hint"><b>Why not the lowest:</b> {pr.chooseNote}</div>}
      {staff && pr.status === "QUOTING" && (
        <>
          <form action={addQuote} className="inline-form" style={{ marginTop: 8 }}><input type="hidden" name="pr" value={pr.number} />
            <input name="vendor" placeholder="Vendor" required maxLength={80} className="inline-input" /><input name="total" placeholder="Total ₱" inputMode="decimal" required className="inline-input" style={{ maxWidth: 120 }} />
            <SubmitButton label="Add quote" cls="btn" small /></form>
          {pr.quotes.length >= rule.quotes && (
            <form action={submitForApproval} style={{ marginTop: 8 }} className="inline-form"><input type="hidden" name="pr" value={pr.number} />
              <select name="chosen" className="inline-input" defaultValue={lowest?.id}>{pr.quotes.map((q) => <option key={q.id} value={q.id}>{q.vendor} · {peso(Number(q.total))}</option>)}</select>
              <input name="chooseNote" placeholder="If not the lowest, why?" className="inline-input" maxLength={400} />
              <SubmitButton label="Send for approval" small /></form>
          )}
        </>
      )}

      <h4 className="sub-h">Approvals</h4>
      <div className="row" style={{ gap: 6 }}>
        {rule.manager > 0 && <span className={"tag " + (prog.mgr >= rule.manager ? "t-ok" : "t-mut")}>Manager {prog.mgr}/{rule.manager}</span>}
        {rule.board > 0 && <span className={"tag " + (prog.brd >= rule.board ? "t-ok" : "t-mut")}>Board {prog.brd}/{rule.board}</span>}
        {approvalsOf(pr).map((a) => <span className="hint" key={a.id}>✓ {a.name} ({a.role.toLowerCase()}), {fmtDateTime(new Date(a.at))}</span>)}
      </div>
      {pr.status === "PENDING" && (ap.ok ? (
        <div className="row" style={{ marginTop: 8 }}>
          <form action={approve}><input type="hidden" name="pr" value={pr.number} /><SubmitButton label={`Approve ${peso(amount)}`} busy="Approving…" /></form>
          <form action={reject} className="inline-form"><input type="hidden" name="pr" value={pr.number} /><input name="note" placeholder="Reason to reject" className="inline-input" maxLength={400} /><SubmitButton label="Reject" cls="btn" small /></form>
        </div>
      ) : <div className="hint" style={{ marginTop: 6 }}>{ap.why}</div>)}
      {pr.rejectNote && <div className="err" style={{ marginTop: 8 }}>Rejected: {pr.rejectNote}</div>}

      {pr.status === "APPROVED" && staff && <form action={issuePO} style={{ marginTop: 10 }}><input type="hidden" name="pr" value={pr.number} /><SubmitButton label={`Issue purchase order to ${chosen?.vendor ?? "vendor"}`} busy="Issuing…" /></form>}
      {pr.poNumber && <div style={{ marginTop: 10 }}><b>{pr.poNumber}</b> <span className="hint">issued {pr.orderedAt ? fmtDate(pr.orderedAt) : ""}</span></div>}
      {pr.status === "ORDERED" && (rc.ok ? <ReceiveForm pr={pr} /> : <div className="hint" style={{ marginTop: 6 }}>Receiving: {rc.why}</div>)}
      {(pr.status === "RECEIVED" || pr.status === "PAID") && (
        <div className="received">
          <div><b>Received {pr.receivedQty} of {pr.qty}</b> by {pr.receivedBy} on {pr.receivedAt ? fmtDateTime(pr.receivedAt) : ""}{pr.invoiceTotal ? ` · invoice ${peso(Number(pr.invoiceTotal))}` : ""}</div>
          {pr.invoiceTotal && Number(pr.invoiceTotal) > amount * 1.02 && <div className="err">Invoice is {peso(Number(pr.invoiceTotal) - amount)} above the PO. Pay the PO amount only.</div>}
          {(pr.receivedQty ?? 0) < pr.qty && <div className="err">Short delivery: {pr.qty - (pr.receivedQty ?? 0)} missing.</div>}
          {pr.receivedNote && <div className="hint">“{pr.receivedNote}”</div>}
          {pr.receivedPic && <img src={pr.receivedPic} alt="Delivery photo" className="recv-pic" />}
        </div>
      )}
      {(pr.status === "RECEIVED" || pr.status === "PAID") && <PayStep pr={pr} u={u} amount={amount} />}
    </div>
  );
}

/** No receipt, no payment: receipt photo within 24h of delivery, then someone other than the requester releases payment. */
function PayStep({ pr, u, amount }: { pr: Full; u: SessionUser; amount: number }) {
  const staff = u.role === "MANAGER" || u.role === "ADMIN";
  if (pr.status === "PAID") return (
    <div className="received"><div><b>Paid {peso(Number(pr.invoiceTotal ?? amount))}</b> by {pr.paidBy} on {pr.paidAt ? fmtDateTime(pr.paidAt) : ""} · ref {pr.paidRef}</div>
      {pr.receiptPic && <img src={pr.receiptPic} alt="Official receipt" className="recv-pic" />}</div>);
  return (
    <div className="recv-form"><b>Pay the vendor</b>
      <div className="hint">No receipt, no payment. The receipt photo is due within 24 hours of delivery{pr.workOrder ? `, and WO-${pr.workOrder} must be verified first` : ""}.</div>
      {pr.receiptPic ? <div className="wo-proof"><img src={pr.receiptPic} alt="Official receipt" /><div className="hint">Receipt {peso(Number(pr.invoiceTotal))} on file.</div></div>
        : staff && <form action={saveReceipt} className="stack" style={{ marginTop: 8 }}><input type="hidden" name="pr" value={pr.number} />
          <div className="row"><PhotoField name="receipt" label="Photo of official receipt" required /><input name="invoice" inputMode="decimal" placeholder="Amount on receipt ₱" aria-label="Amount on receipt" defaultValue={pr.invoiceTotal ? String(pr.invoiceTotal) : ""} style={{ maxWidth: 170 }} /><SubmitButton label="Save receipt" small /></div></form>}
      {pr.receiptPic && staff && (pr.requestedBy === u.id ? <div className="hint" style={{ marginTop: 6 }}>Someone other than you ({pr.requester}) must release the payment.</div> :
        <form action={releasePayment} className="inline-form" style={{ marginTop: 8 }}><input type="hidden" name="pr" value={pr.number} /><input name="ref" placeholder="Check no. or bank ref" aria-label="Check number or bank reference" required /><SubmitButton label="Release payment" small /></form>)}
    </div>);
}

function ReceiveForm({ pr }: { pr: Full }) {
  return (
    <form action={receive} className="recv-form"><input type="hidden" name="pr" value={pr.number} />
      <b>Receive the delivery</b>
      <div className="formgrid" style={{ marginTop: 8 }}>
        <div className="field"><label htmlFor="qty">Quantity that arrived (ordered {pr.qty})</label><input id="qty" name="qty" inputMode="numeric" defaultValue={pr.qty} required /></div>
        <div className="field"><label htmlFor="invoice">Invoice total ₱ (if given)</label><input id="invoice" name="invoice" inputMode="decimal" /></div>
        <div className="field full"><label htmlFor="rnote">Note (optional)</label><input id="rnote" name="note" placeholder="e.g. 2 boxes dented, items OK" maxLength={400} /></div>
      </div>
      <div className="row"><PhotoField label="Photo of goods and receipt" required /><SubmitButton label="Confirm received" busy="Saving…" /></div>
    </form>
  );
}

async function ToReceive({ u }: { u: SessionUser }) {
  const list = await prisma.purchaseRequest.findMany({ where: { status: "ORDERED" }, include: { quotes: true }, orderBy: { orderedAt: "asc" } });
  return (
    <div className="card"><h3>Expected deliveries</h3>
      <div className="list" style={{ marginTop: 6 }}>
        {list.length ? list.map((p) => { const q = p.quotes.find((x) => x.id === p.chosenQuote); const rc = canReceive(p, u.id); return (
          <div className="li" key={p.id}><div style={{ flex: 1 }}><b>{p.poNumber} · {p.title}</b><div className="hint">{p.qty} pcs from {q?.vendor ?? "vendor"} · ordered {p.orderedAt ? fmtDate(p.orderedAt) : ""}</div></div>
            {rc.ok ? <Link className="btn sm pri" href={`/procurement?pr=${p.number}`}>Receive</Link> : <span className="hint">{rc.why}</span>}</div>); })
          : <div className="empty">No deliveries expected.</div>}
      </div>
    </div>
  );
}

async function Requests() {
  const list = await prisma.purchaseRequest.findMany({ include: { quotes: true }, orderBy: { createdAt: "desc" }, take: 60 });
  const order = ["PENDING", "QUOTING", "APPROVED", "ORDERED", "RECEIVED", "PAID", "REJECTED"];
  const groups = order.map((s) => ({ s, list: list.filter((p) => p.status === s) })).filter((g) => g.list.length);
  return (
    <div className="stack">
      {groups.map((g) => (
        <div className="card" key={g.s}><h3>{STATUS[g.s][0]} <span className="hint">({g.list.length})</span></h3>
          <div className="list" style={{ marginTop: 4 }}>
            {g.list.map((p) => { const q = p.quotes.find((x) => x.id === p.chosenQuote); return (
              <Link href={`/procurement?pr=${p.number}`} className="li pr-row" key={p.id}>
                <div style={{ flex: 1, minWidth: 0 }}><b>PR-{p.number} · {p.title}</b><div className="hint">{p.requester} · {fmtDate(p.createdAt)} · {p.quotes.length} quote{p.quotes.length === 1 ? "" : "s"}{q ? ` · ${q.vendor}` : ""}</div></div>
                <b className="num">{peso(amountOf(p))}</b>
              </Link>); })}
          </div>
        </div>
      ))}
      {!groups.length && <div className="empty">No purchase requests yet.</div>}
    </div>
  );
}

async function NewRequest({ sp }: { sp: SP }) {
  const items = await prisma.stockItem.findMany({ orderBy: { name: "asc" } });
  const pre = sp.item ? items.find((i) => i.id === sp.item) : null;
  return (
    <form action={createRequest} className="card">
      <h3>New purchase request</h3>
      <div className="hint">Up to {peso(LIMITS.manager)}: 1 quote and the manager signs. Above that: 3 quotes from different vendors and board signatures.</div>
      <div className="formgrid" style={{ marginTop: 12 }}>
        <div className="field full"><label htmlFor="title">What do you need?</label><input id="title" name="title" required maxLength={120} defaultValue={pre ? `${pre.name} restock` : ""} placeholder="e.g. LED tubes for B1 parking" /></div>
        <div className="field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={pre?.category ?? sp.cat ?? "Other"}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="itemId">Stock item (optional)</label><select id="itemId" name="itemId" defaultValue={pre?.id ?? ""}><option value="">Not a stock item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.onHand} on hand</option>)}</select></div>
        <div className="field"><label htmlFor="qty">Quantity</label><input id="qty" name="qty" inputMode="numeric" defaultValue={pre?.reorderQty ?? 1} required /></div>
        <div className="field"><label htmlFor="workOrder">For work order (optional)</label><input id="workOrder" name="workOrder" placeholder="e.g. 1042" /></div>
        <div className="field full"><label htmlFor="reason">Why is it needed?</label><textarea id="reason" name="reason" rows={2} required maxLength={800} defaultValue={pre ? `Stock is at ${pre.onHand}, below the reorder point of ${pre.reorderPoint}.` : ""} /></div>
      </div>
      <h4 className="sub-h">Quotes</h4>
      {[0, 1, 2].map((i) => (
        <div className="quote-row" key={i}>
          <label className="radio"><input type="radio" name="chosen" value={i} defaultChecked={i === 0} aria-label={`Choose quote ${i + 1}`} /></label>
          <input name={`v${i}`} placeholder={`Vendor ${i + 1}`} maxLength={80} className="inline-input" />
          <input name={`t${i}`} placeholder="Total ₱" inputMode="decimal" className="inline-input" style={{ maxWidth: 130 }} />
        </div>
      ))}
      <div className="field" style={{ marginTop: 8 }}><label htmlFor="chooseNote">If you chose a quote that isn&apos;t the cheapest, why?</label><input id="chooseNote" name="chooseNote" maxLength={400} placeholder="e.g. 3-year warranty instead of 1" /></div>
      {pre && <div className="hint">Benchmark price: {peso(Number(pre.benchmark))} per {pre.uom}. Quotes far above it will be flagged.</div>}
      <div style={{ marginTop: 10 }}><SubmitButton label="Save request" busy="Saving…" /></div>
    </form>
  );
}

async function Controls({ u }: { u: SessionUser }) {
  const since = new Date(nowManila().getTime() - 180 * 86400000);
  const [flags, saved, waiting, spendRows, low] = await Promise.all([
    controlFlags(), savingsThisYear(),
    prisma.purchaseRequest.findMany({ where: { status: "PENDING" }, include: { quotes: true }, orderBy: { createdAt: "asc" } }),
    prisma.purchaseRequest.findMany({ where: { status: { in: ["APPROVED", "ORDERED", "RECEIVED", "PAID"] }, createdAt: { gte: since } }, include: { quotes: true } }),
    prisma.stockItem.findMany({ where: {} }),
  ]);
  const mine = waiting.filter((p) => canApprove(p, u).ok);
  const byVendor = new Map<string, number>();
  for (const p of spendRows) { const q = p.quotes.find((x) => x.id === p.chosenQuote); if (q) byVendor.set(q.vendor, (byVendor.get(q.vendor) ?? 0) + Number(q.total)); }
  const vendors = [...byVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const vmax = Math.max(1, ...vendors.map((v) => v[1]));
  const spend = spendRows.reduce((s, p) => s + amountOf(p), 0);
  const atStake = flags.reduce((s, f) => s + f.atStake, 0);
  const lowStock = low.filter((i) => i.onHand <= i.reorderPoint);
  return (
    <div className="stack">
      <div className="grid g4">
        <div className="card kpi save-kpi"><div className="k">Saved this year</div><div className="v num">{pesoK(saved.total)}</div><div className="d hint">cheaper quotes + warranty claims</div></div>
        <div className="card kpi"><div className="k">Red flags</div><div className={"v " + (flags.length ? "amber" : "")}>{flags.length}</div><div className="d hint">{peso(atStake)} at stake</div></div>
        <div className="card kpi"><div className="k">Waiting for approval</div><div className="v">{waiting.length}</div><div className="d hint">{mine.length} need you</div></div>
        <div className="card kpi"><div className="k">Spend, 6 months</div><div className="v num">{pesoK(spend)}</div><div className="d hint">{spendRows.length} approved purchases</div></div>
      </div>
      {mine.length > 0 && (
        <div className="card"><h3>Needs your signature</h3>
          <div className="list" style={{ marginTop: 4 }}>{mine.map((p) => <Link href={`/procurement?pr=${p.number}`} className="li pr-row" key={p.id}><div style={{ flex: 1 }}><b>PR-{p.number} · {p.title}</b><div className="hint">{p.requester} · {p.quotes.length} quotes</div></div><b className="num">{peso(amountOf(p))}</b><span className="btn sm pri">Review</span></Link>)}</div>
        </div>
      )}
      <div className="grid g-7-5">
        <div className="card"><span className="ai-badge">AI checks</span><h3 style={{ marginTop: 4 }}>Red flags</h3>
          <div className="hint">Split orders, prices above benchmark, parts replaced too often, missed warranties, missing old parts and stock shortages.</div>
          <div style={{ marginTop: 8 }}>
            {flags.length ? flags.map((f) => (
              <Link href={f.href} className="warn-item flag" key={f.key}>
                <span className="lvl" style={{ background: f.level === "high" ? "var(--bad)" : "var(--warn)" }} />
                <div style={{ minWidth: 0, flex: 1 }}><div className="row" style={{ gap: 6 }}><span className="tag t-mut">{f.kind}</span>{f.atStake > 0 && <span className="hint num">{peso(f.atStake)} at stake</span>}</div>
                  <b>{f.title}</b><div className="hint" style={{ marginTop: 2 }}>{f.why}</div></div>
              </Link>
            )) : <div className="okmsg">No red flags. Nice.</div>}
          </div>
        </div>
        <div className="stack">
          <div className="card"><h3>Approval rules</h3>
            <div className="list" style={{ marginTop: 4 }}>
              <div className="li"><span className="tag t-ok">≤ {pesoK(LIMITS.manager)}</span><div>1 quote · manager approves</div></div>
              <div className="li"><span className="tag t-warn">≤ {pesoK(LIMITS.board1)}</span><div>3 quotes · manager + 1 board member</div></div>
              <div className="li"><span className="tag t-bad">&gt; {pesoK(LIMITS.board1)}</span><div>3 quotes · 2 board members</div></div>
              <div className="li"><span className="tag t-mut">Always</span><div>No one approves or receives their own request. Deliveries need a photo. Every replacement names the fixture and returns the old part.</div></div>
            </div>
          </div>
          <div className="card"><h3>Top vendors, 6 months</h3>
            <div style={{ marginTop: 8 }}>{vendors.length ? vendors.map(([v, t]) => <div className="vrow" key={v}><span>{v}</span><i style={{ width: `${(t / vmax) * 100}%` }} /><b className="num">{pesoK(t)}</b></div>) : <div className="hint">No purchases yet.</div>}</div>
          </div>
          {lowStock.length > 0 && <div className="card"><h3>Low stock</h3><div className="list" style={{ marginTop: 4 }}>{lowStock.map((i) => <div className="li" key={i.id}><div style={{ flex: 1 }}>{i.name}<div className="hint">{i.onHand} left · reorder at {i.reorderPoint}</div></div>{u.role !== "BOARD" && <Link href={`/procurement?new=1&item=${i.id}`} className="btn sm">Reorder</Link>}</div>)}</div></div>}
        </div>
      </div>
    </div>
  );
}
