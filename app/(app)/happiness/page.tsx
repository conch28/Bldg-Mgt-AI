import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { HappinessHero } from "@/components/Happiness";
import SubmitButton from "@/components/SubmitButton";
import { happinessDrivers, atRiskResidents, aiSavings } from "@/lib/happiness";
import { fmtDateTime, nowManila } from "@/lib/format";
import { followUp } from "./actions";

export const dynamic = "force-dynamic";
const FACE = ["", "😞", "🙁", "😐", "🙂", "😄"];
const color = (s: number) => (s >= 80 ? "var(--ok)" : s >= 65 ? "var(--warn)" : "var(--bad)");

export default async function Happiness({ searchParams }: { searchParams: { ok?: string; error?: string; t?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const canAct = u.role !== "BOARD";
  const since = new Date(nowManila().getTime() - 45 * 86400000);
  const [drivers, risk, ai, comments, followed] = await Promise.all([
    happinessDrivers(90), atRiskResidents(), aiSavings(30),
    prisma.pulse.findMany({ where: { comment: { not: null }, createdAt: { gte: since }, ...(searchParams.t ? { topic: searchParams.t } : {}) }, orderBy: { createdAt: "desc" }, take: 24, include: { user: true } }),
    prisma.pulse.findMany({ where: { followedUp: { not: null } }, orderBy: { followedUp: "desc" }, take: 5 }),
  ]);
  const worst = drivers.filter((d) => d.n >= 3).slice(0, 2), best = [...drivers].filter((d) => d.n >= 3).reverse().slice(0, 2);
  return (
    <>
      <PageHead title="Resident happiness" sub="Our main goal. Every rating, comment and follow-up in one place. AI sorts comments by topic and flags anyone who's unhappy." />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <HappinessHero compact />
        <div className="grid g-7-5">
          <div className="card">
            <div className="cardhead"><div><span className="ai-badge">AI insight</span><h3 style={{ marginTop: 6 }}>What&apos;s driving happiness (last 90 days)</h3></div></div>
            {(worst.length > 0 || best.length > 0) && <div className="aibox" style={{ marginBottom: 12 }}>
              {best.length > 0 && <>Residents are happiest with <b>{best.map((d) => d.topic.toLowerCase()).join(" and ")}</b>. </>}
              {worst.length > 0 && <>The biggest drag is <b>{worst.map((d) => d.topic.toLowerCase()).join(" and ")}</b> ({worst.reduce((s, d) => s + d.neg, 0)} unhappy ratings). Fixing these moves the score the most.</>}
            </div>}
            {drivers.map((d) => (
              <a key={d.topic} href={`/happiness?t=${d.topic}#comments`} className="driver" style={{ color: "inherit", textDecoration: "none" }}>
                <span>{d.topic}<div className="hint" style={{ fontSize: 11 }}>{d.n} ratings</div></span>
                <div className="track"><i style={{ width: `${d.score}%`, background: color(d.score) }} /></div>
                <b className="num" style={{ textAlign: "right", color: color(d.score) }}>{Math.round(d.score)}</b>
              </a>))}
          </div>
          <div className="card">
            <h3>Needs a personal call</h3>
            <div className="hint" style={{ marginBottom: 8 }}>Residents who rated 1 or 2 stars and haven&apos;t heard back yet. The manager is alerted by SMS the moment it happens.</div>
            <div className="stack">{risk.length ? risk.map((p) => (
              <div key={p.id} className="ann urgent">
                <div className="row"><span style={{ fontSize: 20 }}>{FACE[p.score]}</span><b>Unit {p.unitCode}</b><span className="hint">{p.user.name} · {fmtDateTime(p.createdAt)}</span>{p.topic && <span className="tag t-mut">{p.topic}</span>}</div>
                {p.comment && <div className="body" style={{ margin: "6px 0" }}>&ldquo;{p.comment}&rdquo;</div>}
                {canAct && <form action={followUp} className="inline-form"><input type="hidden" name="id" value={p.id} /><input name="note" placeholder="What we'll do, e.g. Technician visits tomorrow 9 AM, no charge." aria-label="Follow-up note" style={{ flex: 1, minWidth: 180 }} /><SubmitButton label="Send follow-up" busy="Sending…" small /></form>}
              </div>)) : <div className="empty">No unhappy residents waiting. 🎉</div>}</div>
            {followed.length > 0 && <><div className="hint" style={{ margin: "12px 0 4px" }}>Recently resolved</div>
              <div className="list">{followed.map((p) => <div className="li" key={p.id}><span className="tag t-ok">Unit {p.unitCode}</span><div className="hint">{p.followNote}</div></div>)}</div></>}
          </div>
        </div>
        <div className="grid g-7-5">
          <div className="card" id="comments">
            <div className="cardhead"><h3>What residents are saying{searchParams.t ? `: ${searchParams.t}` : ""}</h3>{searchParams.t && <div className="r"><a href="/happiness#comments" className="btn sm">Show all</a></div>}</div>
            <div className="list">{comments.map((p) => (
              <div className="li" key={p.id}><span style={{ fontSize: 20 }} aria-label={`${p.score} of 5`}>{FACE[p.score]}</span>
                <div style={{ flex: 1 }}>{p.comment}<div className="hint">Unit {p.unitCode} · {p.kind === "TICKET" ? (p.workOrder ? `after WO-${p.workOrder}` : "after a repair") : "monthly check-in"} · {fmtDateTime(p.createdAt)}</div></div>
                {p.topic && <span className="tag t-mut">{p.topic}</span>}</div>))}</div>
          </div>
          <div className="card"><span className="ai-badge">Efficiency</span><h3 style={{ margin: "6px 0 4px" }}>Where AI saved time (30 days)</h3>
            <div className="hint" style={{ marginBottom: 8 }}>Time the team spends with residents instead of on paperwork.</div>
            <div className="list">{ai.items.map((i) => <div className="li" key={i.k}><div style={{ flex: 1 }}>{i.k}<div className="hint">{i.n.toLocaleString()} × ~{i.m} min</div></div><b className="num">{((i.n * i.m) / 60).toFixed(0)} h</b></div>)}
              <div className="li" style={{ fontWeight: 700 }}><div style={{ flex: 1 }}>Total</div><b className="num">{ai.hours.toFixed(0)} h</b></div></div>
          </div>
        </div>
      </main>
    </>
  );
}
