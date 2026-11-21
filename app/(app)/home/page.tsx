import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Nav";
import { PulseCard } from "@/components/Happiness";
import { InstallApp } from "@/components/Pwa";
import Tip from "@/components/Tip";
import { peso, fmtDate, fmtDateTime, monthLong, nowManila } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTIONS = [
  { href: "/chat", icon: "chat", t: "Report a problem", cls: "primary" },
  { href: "/my", icon: "card", t: "Pay dues" },
  { href: "/passes", icon: "pass", t: "Guest pass" },
  { href: "/amenities", icon: "cal", t: "Book amenity" },
  { href: "/property", icon: "key", t: "Rent or sell" },
  { href: "/moving", icon: "box", t: "Moving" },
  { href: "/community", icon: "store", t: "Marketplace" },
  { href: "/services", icon: "bag", t: "Home services" },
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
  const acts = ACTIONS.map((t) => ({ ...t, badge: t.href === "/property" ? newInq : 0 }));
  type Row = { href: string; icon: string; tone: string; t: string; s: string };
  const needs: Row[] = [
    ...(newInq ? [{ href: "/property", icon: "key", tone: "acc", t: `${newInq} new inquir${newInq === 1 ? "y" : "ies"} on your listing`, s: "AI already replied and offered viewing times" }] : []),
    ...polls.map((p) => ({ href: "/polls", icon: "vote", tone: "warn", t: "Your vote is needed", s: `${p.question} · closes ${fmtDate(p.closesAt)}` })),
    ...openWos.map((w) => ({ href: "/my", icon: "wrench", tone: "", t: w.title, s: `WO-${w.number} · ${w.status.replace("_", " ").toLowerCase()}${w.assignee ? ` · ${w.assignee}` : ""}` })),
    ...(lease && leaseDays <= 60 ? [{ href: "/property", icon: "key", tone: "warn", t: `${lease.unit.code} lease ends in ${leaseDays} days`, s: "Find the next tenant early, no empty months" }] : []),
    ...amen.map((b) => ({ href: "/amenities", icon: "cal", tone: "", t: b.amenity.name, s: fmtDateTime(b.start) })),
    ...passes.map((p) => ({ href: "/passes", icon: "pass", tone: "", t: `${p.name} is expected`, s: `Pass ${p.code} · ${fmtDate(p.validFrom)}` })),
  ];

  return (
    <>
      <PageHead title={`${greet}, ${first}`} sub={units.length ? `Unit ${units.map((x) => x.code).join(" & ")} · Skyland Tower` : "Skyland Tower"} />
      <main className="view">
        {searchParams.thanks && <div className="okmsg">{Number(searchParams.thanks) <= 2 ? "Salamat po for telling us. Your property manager will reach out to you today." : "Salamat po! Your feedback goes straight to the board."}</div>}
        <Tip id="owner-home" title="Need anything? Just tap Help.">Type it like you'd text a friend, in English or Taglish. Repairs become tickets automatically, and you'll get updates by SMS.</Tip>

        <div className={"card status-card" + (due ? "" : " ok")}>
          <div><div className="k">{due ? (overdue ? "Overdue" : "Amount due") : "Dues"}</div><div className="v num">{due ? peso(due) : "All paid ✓"}</div>
            <div className="s">{due ? (overdue ? "Please settle to avoid penalties" : `Due ${fmtDate(bills[bills.length - 1].dueDate)}`) : "Salamat po! Nothing to pay right now."}</div></div>
          {due > 0 && <Link href="/my" className="btn">Pay now</Link>}
        </div>

        <nav className="actions" aria-label="Quick actions">{acts.map((q) => (
          <Link key={q.href} href={q.href} className={"act " + (q.cls ?? "")}><span className="ti"><Icon name={q.icon} /></span><b>{q.t}</b>{q.badge ? <i className="badge">{q.badge}</i> : null}</Link>))}
        </nav>

        {!pulsed && !searchParams.thanks && <PulseCard />}

        {needs.length > 0 && <>
          <div className="section-h"><h2>For you</h2></div>
          <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}><div className="feed">{needs.slice(0, 5).map((r, i) => (
            <Link key={i} href={r.href}><span className={"fi-i " + r.tone}><Icon name={r.icon} /></span><span className="fi-t"><b>{r.t}</b><span>{r.s}</span></span><span className="chev">›</span></Link>))}</div></div>
        </>}

        <div className="section-h"><h2>Building updates</h2><Link href="/updates">See all{unread ? ` (${unread} new)` : ""}</Link></div>
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}><div className="feed">{updates.length ? updates.slice(0, 3).map((d) => (
          <Link href="/updates" key={d.id}><span className={"fi-i " + (d.announcement.kind === "URGENT" ? "bad" : "acc")}><Icon name={d.announcement.kind === "URGENT" ? "alert" : "mega"} /></span>
            <span className="fi-t"><b>{!d.readAt && <span className="dot-new" aria-label="New" />}{d.announcement.title}</b><span>{clip((tl && d.announcement.bodyTl) || d.announcement.bodyEn)}</span></span><span className="chev">›</span></Link>)) : <div className="empty">No updates yet.</div>}</div></div>

        <InstallApp />
      </main>
    </>
  );
}
