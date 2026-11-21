import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import { overdueAccounts, slaStats } from "@/lib/metrics";
import { sendDueScheduled } from "@/lib/comms";
import { peso, fmtDate, fmtTime, nowManila } from "@/lib/format";

export const dynamic = "force-dynamic";

const dayRange = (now: Date) => {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const start = new Date(ymd + "T00:00:00+08:00");
  return { start, end: new Date(start.getTime() + 86400000) };
};

export default async function Today() {
  const u = await requireRole("MANAGER", "ADMIN");
  await sendDueScheduled();
  const now = nowManila();
  const { start, end } = dayRange(now);
  const in7 = new Date(now.getTime() + 7 * 86400000), in30 = new Date(now.getTime() + 30 * 86400000);
  const [open, pending, pm, vendors, amen, passes, paidToday, overdue, sla] = await Promise.all([
    prisma.workOrder.findMany({ where: { status: { not: "DONE" } }, orderBy: { createdAt: "asc" } }),
    prisma.announcement.findMany({ where: { status: "PENDING_APPROVAL" } }),
    prisma.pMTask.findMany({ where: { nextDue: { lte: in7 } }, orderBy: { nextDue: "asc" } }),
    prisma.vendor.findMany({ where: { active: true, OR: [{ contractEnd: { lte: in30 } }, { insuranceExpiry: { lte: in30 } }] } }),
    prisma.amenityBooking.findMany({ where: { status: "CONFIRMED", start: { gte: start, lt: end } }, include: { amenity: true, unit: true }, orderBy: { start: "asc" } }),
    prisma.pass.findMany({ where: { validFrom: { lt: end }, validTo: { gte: start } }, include: { unit: true } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: true }),
    overdueAccounts(),
    slaStats(30),
  ]);
  const breached = open.filter((w) => now.getTime() - w.createdAt.getTime() > w.slaHours * 3600000);
  const escalated = open.filter((w) => w.status === "ESCALATED");
  const fresh = open.filter((w) => w.status === "NEW");
  const over60 = overdue.filter((o) => o.days > 60);
  const todos = [
    { n: escalated.length, cls: "bad", t: "Escalated tickets", d: escalated.map((w) => `WO-${w.number} ${w.title}`).slice(0, 2).join(" · ") || "None", href: "/work-orders", cta: "Handle" },
    { n: breached.length, cls: breached.length ? "bad" : "ok", t: "Tickets past their SLA", d: breached.length ? `Oldest: WO-${breached[0].number}, ${breached[0].location}` : "Everything is on time", href: "/work-orders", cta: "Review" },
    { n: fresh.length, cls: fresh.length ? "warn" : "ok", t: "New tickets to assign", d: fresh.slice(0, 2).map((w) => w.title).join(" · ") || "All assigned", href: "/work-orders", cta: "Assign" },
    { n: pending.length, cls: pending.length ? "warn" : "ok", t: "Resident updates to approve", d: pending.map((a) => a.title).slice(0, 2).join(" · ") || "Nothing waiting", href: "/comms", cta: "Approve" },
    { n: pm.length, cls: pm.some((t) => t.nextDue < now) ? "bad" : pm.length ? "warn" : "ok", t: "Maintenance due this week", d: pm.slice(0, 2).map((t) => `${t.asset}: ${t.task}`).join(" · ") || "Nothing due", href: "/maintenance", cta: "Open" },
    { n: over60.length, cls: over60.length ? "warn" : "ok", t: "Accounts over 60 days late", d: over60.length ? `${peso(over60.reduce((s, o) => s + o.amount, 0))} outstanding` : "None", href: "/collections", cta: "Follow up" },
    { n: vendors.length, cls: vendors.length ? "warn" : "ok", t: "Vendor contracts or insurance expiring", d: vendors.map((v) => v.name).slice(0, 2).join(" · ") || "All current", href: "/vendors", cta: "Renew" },
  ].sort((a, b) => (a.n === 0 ? 1 : 0) - (b.n === 0 ? 1 : 0));
  const done = todos.filter((t) => t.n === 0).length;

  return (
    <>
      <PageHead title={`Today, ${now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" })}`}
        sub={`Hi ${u.name.split(" ").slice(-2, -1)[0] ?? u.name}. ${done} of ${todos.length} areas are clear. Start at the top.`} />
      <main className="view">
        <div className="grid g-7-5">
          <div className="card"><h3>Your list</h3>
            {todos.map((t) => (
              <div className="todo" key={t.t}><div className={"n " + t.cls}>{t.n}</div>
                <div style={{ minWidth: 0 }}><b>{t.t}</b><div className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.d}</div></div>
                {t.n > 0 ? <Link href={t.href} className="btn sm pri">{t.cta}</Link> : <span className="tag t-ok" style={{ marginLeft: "auto" }}>Clear</span>}</div>))}
          </div>
          <div className="stack">
            <div className="card"><h3>Pulse</h3>
              <div className="list" style={{ marginTop: 6 }}>
                <div className="li"><span className="tag t-acc">Tickets</span><div>{open.length} open · {sla.pct.toFixed(0)}% closed on time (30 days)</div></div>
                <div className="li"><span className="tag t-ok">Payments</span><div>{paidToday._count} today · {peso(Number(paidToday._sum.amount ?? 0))}</div></div>
                <div className="li"><span className="tag t-mut">Satisfaction</span><div>{sla.rating ? sla.rating.toFixed(1) + "★ from " + sla.ratedCount + " ratings" : "No ratings yet"}</div></div>
              </div>
            </div>
            <div className="card"><h3>In the building today</h3>
              <div className="list" style={{ marginTop: 6 }}>
                {amen.map((b) => <div className="li" key={b.id}><span className="tag t-acc">{fmtTime(b.start)}</span><div>{b.amenity.name} · Unit {b.unit.code}{b.guests ? ` · ${b.guests} guests` : ""}</div></div>)}
                {passes.map((p) => <div className="li" key={p.id}><span className="tag t-mut">{p.kind.toLowerCase()}</span><div>{p.name} → {p.unit.code}{p.checkedIn ? " · arrived" : ""}</div></div>)}
                {!amen.length && !passes.length && <div className="hint">No bookings or expected visitors today.</div>}
              </div>
            </div>
            <div className="card"><h3>Oldest open tickets</h3>
              <div className="list" style={{ marginTop: 6 }}>{open.slice(0, 4).map((w) => <div className="li" key={w.id}><StatusTag s={w.status} /><div>WO-{w.number} · {w.title}<div className="hint">{w.location} · since {fmtDate(w.createdAt)}</div></div></div>)}</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
