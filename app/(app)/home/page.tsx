import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Nav";
import { PulseCard } from "@/components/Happiness";
import { peso, fmtDate, fmtDateTime, monthLong, nowManila } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK = [
  { href: "/chat", icon: "chat", t: "Report a problem", s: "Leak, aircon, noise… in English or Taglish" },
  { href: "/my", icon: "card", t: "Pay dues", s: "GCash, Maya or card" },
  { href: "/amenities", icon: "cal", t: "Book an amenity", s: "Pool, function room, gym" },
  { href: "/passes", icon: "pass", t: "Guest or delivery pass", s: "Send a code to your visitor" },
  { href: "/services", icon: "bag", t: "In-unit services", s: "Cleaning, aircon, pest control" },
  { href: "/polls", icon: "vote", t: "Vote", s: "Open polls and resolutions" },
];

const clip = (t: string) => (t.length > 170 ? t.slice(0, 170) + "…" : t);

export default async function Home({ searchParams }: { searchParams: { thanks?: string } }) {
  const u = await requireRole("OWNER");
  const now = nowManila();
  const units = await prisma.unit.findMany({ where: { ownerId: u.id } });
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

  return (
    <>
      <PageHead title={`${greet}, ${first}`} sub={units.length ? `Unit ${units.map((x) => x.code).join(", ")} · Skyland Tower` : "Skyland Tower"} />
      <main className="view">
        {searchParams.thanks && <div className="okmsg">{Number(searchParams.thanks) <= 2 ? "Salamat po for telling us. Your property manager will reach out to you today." : "Salamat po! Your feedback goes straight to the board."}</div>}
        {!pulsed && !searchParams.thanks && <PulseCard />}
        <div className="grid g3">
          <div className="card kpi"><div className="k">Amount due</div><div className={"v " + (overdue ? "amber" : due ? "" : "up")}>{peso(due)}</div>
            <div className="d hint">{due ? `${bills.map((b) => monthLong(b.period)).join(", ")}${overdue ? " · overdue" : ` · due ${fmtDate(bills[bills.length - 1].dueDate)}`}` : "You're all paid up. Salamat po!"}</div>
            {due > 0 && <Link href="/my" className="btn pri sm" style={{ marginTop: 10 }}>Pay now</Link>}
          </div>
          <div className="card kpi"><div className="k">Open repair tickets</div><div className="v">{openWos.length}</div>
            <div className="d hint">{openWos[0] ? `WO-${openWos[0].number} · ${openWos[0].title}` : "Nothing open. Need help? Ask the helpdesk."}</div></div>
          <div className="card kpi"><div className="k">Unread updates</div><div className={"v " + (unread ? "amber" : "")}>{unread}</div>
            <div className="d"><Link href="/updates" style={{ color: "var(--accent)" }}>Open building updates →</Link></div></div>
        </div>

        <div className="card"><h3>What do you need today?</h3>
          <div className="quick" style={{ marginTop: 10 }}>{QUICK.map((q) => (
            <Link key={q.href} href={q.href}><span className="qi"><Icon name={q.icon} /></span><b>{q.t}</b><span>{q.s}</span></Link>))}
          </div>
        </div>

        <div className="grid g2">
          <div className="card"><div className="cardhead"><h3>Latest from the building</h3><div className="r"><Link href="/updates" className="btn sm">See all</Link></div></div>
            <div className="stack" style={{ marginTop: 8 }}>{updates.length ? updates.map((d) => (
              <div key={d.id} className={"ann" + (d.announcement.kind === "URGENT" ? " urgent" : "")}>
                <div className="row"><span className={"tag " + (d.announcement.kind === "URGENT" ? "t-bad" : "t-acc")}>{d.announcement.category}</span><span className="hint">{fmtDateTime(d.createdAt)}</span>{!d.readAt && <span className="tag t-warn">New</span>}</div>
                <h4>{d.announcement.title}</h4>
                <div className="body hint">{clip((tl && d.announcement.bodyTl) || d.announcement.bodyEn)}</div>
              </div>)) : <div className="empty">No updates yet.</div>}</div>
          </div>
          <div className="stack">
            <div className="card"><h3>Coming up</h3>
              <div className="list" style={{ marginTop: 6 }}>
                {amen.map((b) => <div className="li" key={b.id}><span className="tag t-acc">Amenity</span><div>{b.amenity.name} · {fmtDateTime(b.start)}</div></div>)}
                {passes.map((p) => <div className="li" key={p.id}><span className="tag t-mut">{p.kind.toLowerCase()}</span><div>{p.name} · code <b className="mono">{p.code}</b> · {fmtDate(p.validFrom)}</div></div>)}
                {openWos.map((w) => <div className="li" key={w.id}><StatusTag s={w.status} /><div>WO-{w.number} · {w.title}{w.assignee ? ` · ${w.assignee}` : ""}</div></div>)}
                {!amen.length && !passes.length && !openWos.length && <div className="hint">Nothing scheduled. Enjoy your week!</div>}
              </div>
            </div>
            {polls.length > 0 && <div className="card"><h3>Your vote is needed</h3>
              <div className="list" style={{ marginTop: 6 }}>{polls.map((p) => <div className="li" key={p.id}><span className="tag t-warn">{p.kind === "RESOLUTION" ? "Resolution" : "Poll"}</span><div style={{ flex: 1 }}>{p.question}<div className="hint">Closes {fmtDate(p.closesAt)}</div></div><Link href="/polls" className="btn sm pri">Vote</Link></div>)}</div>
            </div>}
          </div>
        </div>
      </main>
    </>
  );
}
