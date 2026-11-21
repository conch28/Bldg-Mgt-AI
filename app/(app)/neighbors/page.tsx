import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDateTime, nowManila } from "@/lib/format";
import { createPost, likePost, moderatePost, deletePost, createEvent, rsvp } from "./actions";
import { GROUPS } from "@/lib/community";

export const dynamic = "force-dynamic";
const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const GROUP_ICON: Record<string, string> = { General: "💬", Pets: "🐾", Sports: "🏀", Parents: "🧸", Kudos: "🙏" };

export default async function Neighbors({ searchParams }: { searchParams: { tab?: string; g?: string; ok?: string; error?: string } }) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const mod = u.role === "MANAGER" || u.role === "ADMIN";
  const tab = searchParams.tab === "events" ? "events" : searchParams.tab === "kudos" ? "kudos" : "feed";
  const g = GROUPS.includes(searchParams.g as any) ? searchParams.g : null;
  const now = nowManila();
  const monthStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 8) + "01T00:00:00+08:00");
  const [posts, events, kudosTop, staff, held] = await Promise.all([
    prisma.post.findMany({ where: { hidden: false, ...(tab === "kudos" ? { group: "Kudos" } : g ? { group: g } : {}) }, orderBy: { createdAt: "desc" }, take: 40, include: { likes: { select: { userId: true } } } }),
    prisma.event.findMany({ where: { startsAt: { gte: new Date(now.getTime() - 3 * 3600000) } }, orderBy: { startsAt: "asc" }, take: 20, include: { rsvps: { select: { userId: true, name: true } } } }),
    prisma.post.groupBy({ by: ["staffName"], where: { group: "Kudos", hidden: false, createdAt: { gte: monthStart } }, _count: true, orderBy: { _count: { staffName: "desc" } }, take: 5 }),
    prisma.workOrder.findMany({ where: { assignee: { not: null } }, distinct: ["assignee"], select: { assignee: true }, take: 30 }),
    mod ? prisma.post.findMany({ where: { hidden: true }, orderBy: { createdAt: "desc" }, take: 10 }) : [],
  ]);
  const staffNames = [...new Set(staff.map((s) => s.assignee!).filter((n) => !/manager|vendor|contractor/i.test(n)))].sort();
  const tomorrow = new Date(now.getTime() + 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <>
      <PageHead title="Neighbours" sub="Say hi, find a running buddy, ask the pet owners' group, thank the staff, and see what's happening this week. Only Skyland residents can see this." />
      <main className="view">
        <div className="tabs">
          <Link href="/neighbors" className={"chip" + (tab === "feed" ? " on" : "")}>Feed</Link>
          <Link href="/neighbors?tab=events" className={"chip" + (tab === "events" ? " on" : "")}>Events{events.length ? ` (${events.length})` : ""}</Link>
          <Link href="/neighbors?tab=kudos" className={"chip" + (tab === "kudos" ? " on" : "")}>Thank the staff</Link>
        </div>
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {mod && held.length > 0 && <div className="card" style={{ borderColor: "var(--warn)" }}><h3>Waiting for review ({held.length})</h3>
          <div className="list">{held.map((p) => <div className="li" key={p.id}><div style={{ flex: 1 }}><b>{p.authorName}</b> · {p.group}<div className="hint">{p.body}</div></div>
            <form action={moderatePost}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="hide" value="0" /><button className="btn sm">Approve</button></form>
            <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn sm">Delete</button></form></div>)}</div></div>}

        {tab !== "events" ? (
          <div className="grid g-7-5">
            <div className="stack">
              <form action={createPost} className="card stack">
                <input type="hidden" name="group" value={tab === "kudos" ? "Kudos" : g ?? "General"} />
                {tab === "kudos" ? <>
                  <h3>Thank someone who helped you</h3>
                  <div className="field"><label htmlFor="staffName">Who</label><select id="staffName" name="staffName" required>{staffNames.map((n) => <option key={n}>{n}</option>)}<option>Lobby guard on duty</option><option>Housekeeping team</option></select></div>
                </> : !g && <div className="tabs">{GROUPS.filter((x) => x !== "Kudos").map((x) => <Link key={x} href={`/neighbors?g=${x}`} className="chip">{GROUP_ICON[x]} {x}</Link>)}</div>}
                <div className="field"><label htmlFor="body">{tab === "kudos" ? "What did they do?" : `Post to ${g ?? "everyone"}`}</label><textarea id="body" name="body" rows={3} required maxLength={800} placeholder={tab === "kudos" ? "Kuya Jun fixed our sink in 20 minutes on a Sunday. Salamat po!" : "Anyone up for a 6 AM run around Legazpi Park on Saturday?"} /></div>
                <div><SubmitButton label={tab === "kudos" ? "Send thanks" : "Post"} busy="Posting…" /></div>
              </form>
              {g && <div className="row"><span className="tag t-acc">{GROUP_ICON[g]} {g}</span><Link href="/neighbors" className="hint">Show all groups</Link></div>}
              {posts.length ? posts.map((p) => {
                const liked = p.likes.some((l) => l.userId === u.id);
                return (
                  <div className="card post" key={p.id}>
                    <div className="row" style={{ gap: 10 }}><span className="avatar">{p.authorName.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                      <div style={{ flex: 1, minWidth: 0 }}><b>{p.authorName.split(" ")[0]}</b>{p.unitCode ? <span className="hint"> · Tower {p.unitCode.slice(-1)}</span> : null}<div className="hint">{ago(p.createdAt)} · {GROUP_ICON[p.group]} {p.group}</div></div>
                      {(p.userId === u.id || mod) && <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn sm" aria-label="Delete post">Delete</button></form>}
                    </div>
                    {p.staffName && <div className="kudos-to">🙏 Thanks to <b>{p.staffName}</b></div>}
                    <p style={{ margin: "8px 0" }}>{p.body}</p>
                    <form action={likePost}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="tab" value={tab} /><button className={"like" + (liked ? " on" : "")} aria-pressed={liked}>{liked ? "♥" : "♡"} {p.likes.length || ""}</button></form>
                  </div>);
              }) : <div className="card empty">No posts yet. Be the first po!</div>}
            </div>
            <div className="stack">
              <div className="card"><h3>Most thanked this month</h3>
                <div className="list" style={{ marginTop: 6 }}>{kudosTop.length ? kudosTop.map((k, i) => <div className="li" key={k.staffName}><span className="tag t-ok">{i === 0 ? "🏆" : `#${i + 1}`}</span><div style={{ flex: 1 }}><b>{k.staffName}</b></div><span className="num">{k._count} thanks</span></div>) : <div className="hint">No thanks yet this month.</div>}</div>
                <div className="hint" style={{ marginTop: 8 }}>Kudos count toward the staff leaderboard and the monthly staff award.</div>
              </div>
              <div className="card"><h3>Coming up</h3>
                <div className="list" style={{ marginTop: 6 }}>{events.slice(0, 4).map((e) => <Link key={e.id} href="/neighbors?tab=events" className="li" style={{ textDecoration: "none", color: "inherit" }}><span className="tag t-acc">{GROUP_ICON[e.group]}</span><div style={{ flex: 1 }}><b>{e.title}</b><div className="hint">{fmtDateTime(e.startsAt)} · {e.rsvps.length} going</div></div></Link>)}{!events.length && <div className="hint">No events yet.</div>}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid g-7-5">
            <div className="stack">{events.length ? events.map((e) => {
              const going = e.rsvps.some((r) => r.userId === u.id);
              return (
                <div className="card" key={e.id}>
                  <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                    <div className="evdate"><b>{e.startsAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" })}</b><span>{e.startsAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" })}</span></div>
                    <div style={{ flex: 1, minWidth: 0 }}><span className="tag t-acc">{GROUP_ICON[e.group]} {e.group}</span><h3 style={{ marginTop: 4 }}>{e.title}</h3>
                      <div className="hint">{fmtDateTime(e.startsAt)} · {e.place} · hosted by {e.hostName.split(" ")[0]}</div>
                      {e.detail && <p style={{ margin: "6px 0" }}>{e.detail}</p>}
                      <div className="hint">{e.rsvps.length} going{e.rsvps.length ? `: ${e.rsvps.slice(0, 5).map((r) => r.name.split(" ")[0]).join(", ")}${e.rsvps.length > 5 ? "…" : ""}` : ""}</div>
                    </div>
                    <form action={rsvp}><input type="hidden" name="id" value={e.id} /><button className={"btn sm" + (going ? "" : " pri")}>{going ? "Going ✓" : "I'm going"}</button></form>
                  </div>
                </div>);
            }) : <div className="card empty">No events yet. Start one: a pool party, a pet meetup, a basketball game.</div>}</div>
            <form action={createEvent} className="card stack"><h3>Start an event</h3>
              <div className="field"><label htmlFor="et">What</label><input id="et" name="title" required placeholder="Saturday pickup basketball" /></div>
              <div className="formgrid">
                <div className="field"><label htmlFor="eg">Group</label><select id="eg" name="group">{GROUPS.filter((x) => x !== "Kudos").map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="field"><label htmlFor="ep">Where</label><input id="ep" name="place" required defaultValue="Pool deck" /></div>
                <div className="field"><label htmlFor="ed">Date</label><input id="ed" name="date" type="date" required defaultValue={tomorrow} /></div>
                <div className="field"><label htmlFor="eti">Time</label><input id="eti" name="time" type="time" required defaultValue="17:00" /></div>
              </div>
              <div className="field"><label htmlFor="edt">Details (optional)</label><textarea id="edt" name="detail" rows={2} /></div>
              <SubmitButton label="Post event" busy="Posting…" />
            </form>
          </div>
        )}
      </main>
    </>
  );
}
