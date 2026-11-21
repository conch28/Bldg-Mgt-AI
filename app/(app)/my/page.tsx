import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi, StatusTag } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate, fmtDateTime, monthLong, nowManila } from "@/lib/format";
import { paymongoEnabled, testPaymentsAllowed } from "@/lib/payments";
import { payBalance, rateWorkOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function My({ searchParams }: { searchParams: { paid?: string } }) {
  const u = await requireRole("OWNER");
  const units = await prisma.unit.findMany({ where: { ownerId: u.id } });
  const ids = units.map((x) => x.id);
  const [bills, payments, wos, bookings] = await Promise.all([
    prisma.bill.findMany({ where: { unitId: { in: ids } }, orderBy: { period: "desc" }, take: 6 }),
    prisma.payment.findMany({ where: { bill: { unitId: { in: ids } } }, orderBy: { createdAt: "desc" }, take: 5, include: { bill: true } }),
    prisma.workOrder.findMany({ where: { OR: [{ reporterId: u.id }, { unitId: { in: ids } }] }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.booking.findMany({ where: { userId: u.id }, orderBy: { slot: "desc" }, take: 5, include: { service: true } }),
  ]);
  const unpaid = bills.filter((b) => b.status !== "PAID");
  const due = unpaid.reduce((s, b) => s + Number(b.amount) - Number(b.paid), 0);
  const overdue = unpaid.some((b) => b.dueDate < nowManila());
  const canPay = paymongoEnabled() || testPaymentsAllowed();
  if (!units.length) return (<><PageHead title="My unit" /><main className="view"><div className="card">No unit is linked to your account yet. Please contact the admin office.</div></main></>);
  return (
    <>
      <PageHead title={`Unit ${units.map((x) => x.code).join(", ")}`} sub={`Hi ${u.name.split(" ")[0]}! ${Number(units[0].sqm)} sqm · Skyland Tower`} />
      <main className="view">
        {searchParams.paid && <div className="okmsg">Payment received. Thank you! Your receipt is in Payments below.</div>}
        <div className="grid g3">
          <div className="card kpi"><div className="k">Amount due</div><div className={"v " + (overdue ? "amber" : "")}>{peso(due)}</div>
            <div className="d hint">{unpaid.length ? `${unpaid.map((b) => monthLong(b.period)).join(", ")} · due ${fmtDate(unpaid[unpaid.length - 1].dueDate)}` : "You're all paid up. Salamat!"}</div>
            {due > 0 && canPay && <form action={payBalance} className="inline-form" style={{ marginTop: 10 }}>
              <input type="hidden" name="unitId" value={units[0].id} />
              {!paymongoEnabled() && <select name="method" aria-label="Payment method"><option>GCash</option><option>Maya</option><option>Card</option></select>}
              <SubmitButton label={`Pay ${peso(due)}`} busy="Processing…" small />
              {!paymongoEnabled() && <span className="hint" style={{ fontSize: 11.5 }}>Test mode, no money moves</span>}
            </form>}
            {due > 0 && !canPay && <div className="hint" style={{ marginTop: 8 }}>Pay by bank transfer and send the slip to the admin office.</div>}
          </div>
          <Kpi k="Open repair tickets" v={wos.filter((w) => w.status !== "DONE").length} d={<Link href="/chat" style={{ color: "var(--accent)" }}>Report a problem in chat →</Link>} />
          <Kpi k="Upcoming services" v={bookings.filter((b) => b.slot > nowManila()).length} d={<Link href="/services" style={{ color: "var(--accent)" }}>Book a service →</Link>} />
        </div>
        <div className="grid g2">
          <div className="card"><h3>My repair tickets</h3>
            <div className="list" style={{ marginTop: 6 }}>{wos.length ? wos.map((w) => (
              <div className="li" key={w.id}><StatusTag s={w.status} /><div style={{ flex: 1 }}><b>WO-{w.number}</b> · {w.title}<div className="hint">{fmtDateTime(w.createdAt)}{w.assignee ? ` · ${w.assignee}` : ""}</div>
                {w.status === "DONE" && w.reporterId === u.id && !w.rating && <form action={rateWorkOrder} className="inline-form" style={{ marginTop: 6 }}><input type="hidden" name="id" value={w.id} /><span className="hint">Rate this repair:</span>{[5, 4, 3, 2, 1].map((r) => <button key={r} name="rating" value={r} className="chip">{r}★</button>)}</form>}
                {w.rating && <div className="hint">You rated {w.rating}★</div>}
              </div></div>)) : <div className="hint">No tickets yet.</div>}</div></div>
          <div className="card"><h3>Statements and payments</h3>
            <div className="tablewrap"><table><thead><tr><th>Month</th><th className="r">Amount</th><th>Status</th></tr></thead>
              <tbody>{bills.map((b) => <tr key={b.id}><td>{monthLong(b.period)}</td><td className="r num">{peso(b.amount)}</td><td><StatusTag s={b.status} /></td></tr>)}</tbody></table></div>
            <div className="hint" style={{ marginTop: 10 }}>Recent payments</div>
            <div className="list">{payments.map((p) => <div className="li" key={p.id}><div style={{ flex: 1 }}>{peso(p.amount)} for {monthLong(p.bill.period)} via {p.method}<div className="hint mono">{p.reference} · {fmtDate(p.createdAt)}</div></div></div>)}</div>
          </div>
        </div>
        {bookings.length > 0 && <div className="card"><h3>My bookings</h3><div className="list">{bookings.map((b) => <div className="li" key={b.id}><StatusTag s={b.status} /><div>{b.service.name}{b.qty > 1 ? ` × ${b.qty}` : ""} · {fmtDateTime(b.slot)} · {peso(b.total)} ({b.payMethod})</div></div>)}</div></div>}
      </main>
    </>
  );
}
