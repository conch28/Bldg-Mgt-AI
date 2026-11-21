import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function Updates({ searchParams }: { searchParams: { f?: string } }) {
  const u = await requireRole("OWNER");
  const me = await prisma.user.findUnique({ where: { id: u.id }, select: { language: true } });
  const tl = me?.language === "TL";
  const f = searchParams.f ?? "all";
  const kind = f === "urgent" ? { kind: "URGENT" } : f === "mine" ? { kind: "TICKET" } : f === "news" ? { kind: { in: ["ROUTINE", "REMINDER"] } } : {};
  const list = await prisma.delivery.findMany({ where: { userId: u.id, channel: "APP", announcement: kind }, orderBy: { createdAt: "desc" }, take: 40, include: { announcement: true } });
  const other = await prisma.delivery.findMany({ where: { userId: u.id, channel: { not: "APP" } }, select: { announcementId: true, channel: true } });
  const via = new Map<string, string[]>();
  for (const o of other) via.set(o.announcementId, [...(via.get(o.announcementId) ?? []), o.channel]);
  const unread = list.filter((d) => !d.readAt).length;
  const tabs = [["all", "All"], ["urgent", "Urgent"], ["news", "News & reminders"], ["mine", "My tickets & receipts"]];
  return (
    <>
      <PageHead title="Building updates" sub={tl ? "Mga anunsyo at abiso mula sa admin office" : "Announcements, advisories and updates about your unit"}
        right={unread > 0 && <form action={markAllRead}><button className="btn sm">Mark all as read</button></form>} />
      <main className="view">
        <div className="tabs">{tabs.map(([k, l]) => <a key={k} href={`/updates?f=${k}`} className={"chip" + (f === k ? " on" : "")}>{l}</a>)}</div>
        <div className="stack">{list.length ? list.map((d) => {
          const a = d.announcement;
          return (
            <article key={d.id} className={"ann" + (a.kind === "URGENT" ? " urgent" : "")} style={!d.readAt ? { borderColor: "var(--accent)" } : undefined}>
              <div className="row">
                <span className={"tag " + (a.kind === "URGENT" ? "t-bad" : a.kind === "TICKET" ? "t-mut" : "t-acc")}>{a.category}</span>
                <span className="hint">{fmtDateTime(d.createdAt)}</span>
                {!d.readAt && <span className="tag t-warn">New</span>}
                <span style={{ marginLeft: "auto" }} className="row">{(via.get(a.id) ?? []).map((c) => <span key={c} className="pill-ch">also by {c.toLowerCase()}</span>)}</span>
              </div>
              <h4>{a.title}</h4>
              <div className="body">{(tl && a.bodyTl) || a.bodyEn}</div>
            </article>);
        }) : <div className="empty">Nothing here yet.</div>}</div>
        <div className="hint">Change how you get updates (SMS, email, Messenger, English or Taglish) in <a href="/account" style={{ color: "var(--accent)" }}>My account</a>.</div>
      </main>
    </>
  );
}
