import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Nav";
import { PulseCard } from "@/components/Happiness";
import { InstallApp } from "@/components/Pwa";
import { peso, fmtDate, fmtDateTime, monthLong, nowManila } from "@/lib/format";

export const dynamic = "force-dynamic";

const TILES = [
  { href: "/chat", icon: "chat", t: "Report a problem", s: "Leak, aircon, noise. English or Taglish", cls: "hot" },
  { href: "/my", icon: "card", t: "Pay dues", s: "GCash, Maya or card" },
  { href: "/passes", icon: "pass", t: "Guest pass", s: "Visitors, deliveries, short stays" },
  { href: "/amenities", icon: "cal", t: "Book amenity", s: "Pool, function room, gym" },
  { href: "/property", icon: "key", t: "Rent out or sell", s: "AI prices and posts your unit" },
  { href: "/moving", icon: "box", t: "Moving", s: "Move in, move out, renovation" },
  { href: "/community", icon: "store", t: "Marketplace", s: "Buy, sell, lost and found" },
  { href: "/services", icon: "bag", t: "Home services", s: "Cleaning, aircon, pest control" },
];

const clip = (t: string) => (t.length > 170 ? t.slice(0, 170) + "…" : t);

export default async function Home({ searchParams }: { searchParams: { thanks?: string } }) {
  const u = await requireRole("OWNER");
  const now = nowManila();
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  const ids = units.map((x) => x.id);
  const me = await prisma.user.findUnique({ where: { id: u.id }, select: { language: true } });
  const tl = me?.language === "TL";
  const [bills, openWos, updates, unread, amen, passes, polls] = await Promise.all([
    prisma.bill.findMany({ where: { unitId: { in: ids }, status: { not: "PAID" } }, orderBy: { period: "asc" } }),
    prisma.workOrder.findMany({ where: { OR: [{ reporterId: u.id }, { unitId: { in: ids } }], status: { not: "DONE" } }, orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.delivery.findMany({ where: { userId: u.id, channel: "APP" }, orderBy: { createdAt: "desc" }, take: 4, include: { announcement: true } }),
    prisma.delivery.count({ where: { userId: u.id, channel: "APP", readAt: null } }),
    prisma.amenityBooking.findMany({ where: { userId: u.id, status: "CONFIRMED", start: { gte: now } }, orderBy: { start: "asc" }, take: 3, include: { amenity: true } }),
    prisma.pass.findMany({ where: { userId: u.id, validTo: { gte: now } }, orderBy: { validFrom: "asc" }, take: 3 }),
    prisma.poll.findMany({ where: { closesAt: { gte: now }, votes: { none: { userId: u.id } } }, take: 2 }),
  ]);
  const pulsed = await prisma.pulse.findFirst({ where: { userId: u.id, kind: "MONTHLY", createdAt: { gte: new Date(now.getTime() - 25 * 86400000) } } });
  const due = bills.reduce((s, b) => s + Number(b.amount) - Number(b.paid), 0);
  const overdue = bills.some((b) => b.dueDate < now);
  const first = u.name.split(" ")[0];
  const hour = Number(now.toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const [newInq, lease] = await Promise.all([
    prisma.inquiry.count({ where: { listing: { userId: u.id }, status: "NEW" } }),
    prisma.lease.findFirst({ where: { unitId: { in: ids }, end: { gte: now } }, orderBy: { end: "asc" }, include: { unit: true } }),
  ]);
  const leaseDays = lease ? Math.ceil((lease.end.getTime() - now.getTime()) / 86400000) : 0;
  const tiles = TILES.map((t) => ({ ...t, badge: t.href === "/property" ? newInq : 0 }));

  return (
    <>
      <PageHead title={`${greet}, ${first}`} sub={units.length ? `Unit ${units.map((x) => x.code).join(", ")} · Skyland Tower` : "Skyland Tower"} />
      <main className="view">
        {searchParams.thanks && <div className="okmsg">{Number(searchParams.thanks) <= 2 ? "Salamat po for telling us. Your property manager will reach out to you today." : "Salamat po! Your feedback goes straight to the board."}</div>}

        <div className={"card status-card" + (due ? "" : " ok")}>
          <div><div className="k">{due ? (overdue ? "Overdue" : "Amount due") : "Dues"}</div><div className="v num">{due ? peso(due) : "All paid"}</div>
            <div className="s">{due ? `${bills.map((b) => monthLong(b.period)).join(", ")}${overdue ? "" : ` · due ${fmtDate(bills[bills.length - 1].dueDate)}`}` : "Salamat po! Nothing to pay right now."}</div></div>
          {due > 0 && <Link href="/my" className="btn">Pay now</Link>}
        </div>

        <div className="mini-row">
          <Link href="/my" className="mini"><b className="n">{openWos.length}</b><span>open repair<br />ticket{openWos.length === 1 ? "" : "s"}</span></Link>
          <Link href="/updates" className="mini"><b className={"n" + (unread ? " amber" : "")}>{unread}</b><span>new building<br />update{unread === 1 ? "" : "s"}</span></Link>
          {lease && <Link href="/property" className="mini"><b className={"n" + (leaseDays <= 60 ? " amber" : "")}>{leaseDays}d</b><span>left on {lease.unit.code}<br />lease</span></Link>}
        </div>

        {!pulsed && !searchParams.thanks && <PulseCard />}
        {newInq > 0 && <Link href="/property" className="aibox" style={{ textDecoration: "none", display: "block" }}><span className="ai-badge">AI leasing assistant</span><div style={{ marginTop: 4 }}><b>{newInq} new inquir{newInq === 1 ? "y" : "ies"}</b> on your listing. The assistant already replied and offered viewing times. Tap to see.</div></Link>}

        <div className="tiles">{tiles.map((q) => (
          <Link key={q.href} href={q.href} className={"tile " + (q.cls ?? "")}><span className="ti"><Icon name={q.icon} /></span><b>{q.t}</b><span>{q.s}</span>{q.badge ? <i className="badge">{q.badge}</i> : null}</Link>))}
        </div>

        <InstallApp />

        <div className="section-h"><h2>Latest from the building</h2><Link href="/updates">See all</Link></div>
        <div className="stack">{updates.length ? updates.slice(0, 3).map((d) => (
          <Link href="/updates" key={d.id} className={"ann" + (d.announcement.kind === "URGENT" ? " urgent" : "")} style={{ textDecoration: "none" }}>
            <div className="row"><span className={"tag " + (d.announcement.kind === "URGENT" ? "t-bad" : "t-acc")}>{d.announcement.category}</span><span className="hint">{fmtDateTime(d.createdAt)}</span>{!d.readAt && <span className="tag t-warn">New</span>}</div>
            <h4>{d.announcement.title}</h4>
            <div className="body hint">{clip((tl && d.announcement.bodyTl) || d.announcement.bodyEn)}</div>
          </Link>)) : <div className="empty">No updates yet.</div>}</div>

        {(amen.length > 0 || passes.length > 0 || openWos.length > 0 || polls.length > 0) && <>
          <div className="section-h"><h2>Coming up</h2></div>
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}><div className="list">
            {polls.map((p) => <div className="li" key={p.id}><span className="tag t-warn">Vote</span><div style={{ flex: 1 }}>{p.question}<div className="hint">Closes {fmtDate(p.closesAt)}</div></div><Link href="/polls" className="btn sm pri">Vote</Link></div>)}
            {openWos.map((w) => <div className="li" key={w.id}><StatusTag s={w.status} /><div>WO-{w.number} · {w.title}{w.assignee ? ` · ${w.assignee}` : ""}</div></div>)}
            {amen.map((b) => <div className="li" key={b.id}><span className="tag t-acc">Amenity</span><div>{b.amenity.name} · {fmtDateTime(b.start)}</div></div>)}
            {passes.map((p) => <div className="li" key={p.id}><span className="tag t-mut">{p.kind.toLowerCase()}</span><div>{p.name} · code <b className="mono">{p.code}</b> · {fmtDate(p.validFrom)}</div></div>)}
          </div></div>
        </>}
      </main>
    </>
  );
}
