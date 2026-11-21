import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi, StatusTag } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { monthLabel } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate, fmtDateTime, monthLong, nowManila } from "@/lib/format";
import { paymongoEnabled, testPaymentsAllowed } from "@/lib/payments";
import { payBalance, rateWorkOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function My({ searchParams }: { searchParams: { paid?: string } }) {
  const u = await requireRole("OWNER");
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  const ids = units.map((x) => x.id);
  const [bills, payments, wos, bookings] = await Promise.all([
    prisma.bill.findMany({ where: { unitId: { in: ids } }, orderBy: { period: "desc" }, take: 6 }),
    prisma.payment.findMany({ where: { bill: { unitId: { in: ids } } }, orderBy: { createdAt: "desc" }, take: 5, include: { bill: true } }),
    prisma.workOrder.findMany({ where: { OR: [{ reporterId: u.id }, { unitId: { in: ids } }] }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.booking.findMany({ where: { userId: u.id }, orderBy: { slot: "desc" }, take: 5, include: { service: true } }),
  ]);
  const util = await prisma.utilityReading.findMany({ where: { unitId: ids[0] }, orderBy: { period: "asc" } });
  const series = (k: string) => util.filter((x) => x.kind === k).slice(-6);
  const elec = series("ELECTRIC"), water = series("WATER");
  const lastOf = (a: typeof util) => a[a.length - 1];
  const avgOf = (a: typeof util) => a.slice(0, -1).reduce((s, x) => s + x.usage, 0) / Math.max(1, a.length - 1);
  const waterJump = water.length > 2 ? lastOf(water).usage / avgOf(water) - 1 : 0;
  const elecJump = elec.length > 2 ? lastOf(elec).usage / avgOf(elec) - 1 : 0;
  const unpaid = bills.filter((b) => b.status !== "PAID");
  const due = unpaid.reduce((s, b) => s + Number(b.amount) - Number(b.paid), 0);
  const overdue = unpaid.some((b) => b.dueDate < nowManila());
  const canPay = paymongoEnabled() || testPaymentsAllowed();
  if (!units.length) return (<><PageHead title="My unit" /><main className="view"><div className="card">No unit is linked to your account yet. Please contact the admin office.</div></main></>);
  return (
    <>
      <PageHead title="Bills & dues" sub="Pay in seconds with GCash, Maya or card. Receipts are saved here." />
      <main className="view">
        {searchParams.paid && <div className="okmsg">Payment received. Thank you! Your receipt is in Payments below.</div>}
        <div className={"card status-card" + (due ? "" : " ok")}>
          <div style={{ flex: 1, minWidth: 180 }}><div className="k">{due ? (overdue ? "Overdue" : "Amount due") : "Dues"}</div><div className="v num">{due ? peso(due) : "All paid ✓"}</div>
            <div className="s">{unpaid.length ? `${[...new Set(unpaid.map((b) => monthLong(b.period)))].join(", ")} · due ${fmtDate(unpaid[unpaid.length - 1].dueDate)}` : "Salamat po! Nothing to pay right now."}</div></div>
          {due > 0 && canPay && <form action={payBalance} className="paybox">
            <input type="hidden" name="unitId" value={units[0].id} />
            {!paymongoEnabled() && <div className="seg" role="radiogroup" aria-label="Payment method">{["GCash", "Maya", "Card"].map((m, i) => <label key={m}><input type="radio" name="method" value={m} defaultChecked={i === 0} /><span>{m}</span></label>)}</div>}
            <SubmitButton label={`Pay ${peso(due)}`} busy="Processing…" cls="btn" />
            {!paymongoEnabled() && <span className="s" style={{ fontSize: 12 }}>Demo mode · no money moves</span>}
          </form>}
          {due > 0 && !canPay && <div className="s">Pay by bank transfer and send the slip to the admin office.</div>}
        </div>
        <div className="grid g2">
          <div className="card"><h3>My repair tickets</h3>
            <div className="list" style={{ marginTop: 6 }}>{wos.length ? wos.map((w) => (
              <div className="li" key={w.id}><StatusTag s={w.status} /><div style={{ flex: 1 }}><b>WO-{w.number}</b> · {w.title}<div className="hint">{fmtDateTime(w.createdAt)}{w.assignee ? ` · ${w.assignee}` : ""}</div>
                {w.status === "DONE" && w.reporterId === u.id && !w.rating && <form action={rateWorkOrder} className="inline-form" style={{ marginTop: 6 }}><input type="hidden" name="id" value={w.id} /><span className="hint">How did we do?</span><input name="comment" placeholder="Optional comment" aria-label="Comment" style={{ flex: 1, minWidth: 140 }} />{[5, 4, 3, 2, 1].map((r) => <button key={r} name="rating" value={r} className="chip">{r}★</button>)}</form>}
                {w.rating && <div className="hint">You rated {w.rating}★</div>}
              </div></div>)) : <div className="hint">No tickets yet.</div>}</div></div>
          <div className="card"><h3>Statements and payments</h3>
            <div className="tablewrap"><table><thead><tr><th>Month</th><th className="r">Amount</th><th>Status</th></tr></thead>
              <tbody>{bills.map((b) => <tr key={b.id}><td>{monthLong(b.period)}{units.length > 1 && <span className="hint"> · {units.find((x) => x.id === b.unitId)?.code}</span>}</td><td className="r num">{peso(b.amount)}</td><td><StatusTag s={b.status} /></td></tr>)}</tbody></table></div>
            <div className="hint" style={{ marginTop: 10 }}>Recent payments</div>
            <div className="list">{payments.map((p) => <div className="li" key={p.id}><div style={{ flex: 1 }}>{peso(p.amount)} for {monthLong(p.bill.period)} via {p.method}<div className="hint mono">{p.reference} · {fmtDate(p.createdAt)}</div></div></div>)}</div>
          </div>
        </div>
        {elec.length > 0 && <div className="card">
          <div className="cardhead"><div><h3>Utilities · {units[0].code}</h3><div className="hint">Read from the sub-meters every month</div></div></div>
          <div className="mini-row">
            <div className="mini"><b className="n num">{peso(lastOf(elec).amount)}</b><span>electricity<br />{lastOf(elec).usage.toFixed(0)} kWh</span></div>
            <div className="mini"><b className={"n num" + (waterJump > 0.25 ? " amber" : "")}>{peso(lastOf(water).amount)}</b><span>water<br />{lastOf(water).usage.toFixed(1)} m³</span></div>
          </div>
          <div style={{ marginTop: 10 }}><LineChart vals={elec.map((x) => Math.round(x.usage))} labels={elec.map((x) => monthLabel(x.period))} min={0} max={Math.ceil(Math.max(...elec.map((x) => x.usage)) / 50) * 50 + 50} fmt={(v) => `${Math.round(v)}`} h={160} /></div>
          <div className="hint" style={{ textAlign: "center" }}>Electricity, kWh per month</div>
          {waterJump > 0.25 ? <div className="aibox" style={{ marginTop: 10 }}><span className="ai-badge">AI noticed</span><div style={{ marginTop: 4 }}>Water use is up {Math.round(waterJump * 100)}% versus your usual. That's often a running toilet or a dripping faucet. <Link href="/chat" style={{ color: "var(--accent)", fontWeight: 600 }}>Ask for a free check →</Link></div></div>
            : elecJump > 0.2 ? <div className="aibox" style={{ marginTop: 10 }}><span className="ai-badge">AI noticed</span><div style={{ marginTop: 4 }}>Electricity is up {Math.round(elecJump * 100)}% versus your usual. An aircon cleaning often brings it down. <Link href="/services" style={{ color: "var(--accent)", fontWeight: 600 }}>Book one →</Link></div></div> : null}
        </div>}
        {bookings.length > 0 && <div className="card"><h3>My bookings</h3><div className="list">{bookings.map((b) => <div className="li" key={b.id}><StatusTag s={b.status} /><div>{b.service.name}{b.qty > 1 ? ` × ${b.qty}` : ""} · {fmtDateTime(b.slot)} · {peso(b.total)} ({b.payMethod})</div></div>)}</div></div>}
      </main>
    </>
  );
}
