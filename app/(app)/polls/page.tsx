import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, nowManila } from "@/lib/format";
import { vote, createPoll } from "./actions";

export const dynamic = "force-dynamic";
const COLORS = ["var(--accent)", "var(--warn)", "var(--bad)", "var(--ok)", "var(--muted)"];

export default async function Polls({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const owner = u.role === "OWNER";
  const now = nowManila();
  const [polls, totals] = await Promise.all([
    prisma.poll.findMany({ orderBy: { closesAt: "desc" }, include: { options: true, votes: { select: { optionId: true, weight: true, userId: true } } } }),
    prisma.unit.aggregate({ _sum: { sqm: true }, _count: true }),
  ]);
  const totalSqm = Number(totals._sum.sqm ?? 0);
  const in2w = new Date(now.getTime() + 14 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <>
      <PageHead title={owner ? "Voting" : "Voting & polls"} sub="Polls count one vote per unit. Resolutions are weighted by floor area, like the master deed, and need a majority of all units' area to pass." />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <div className="grid g2">{polls.map((p) => {
          const open = p.closesAt > now;
          const weighted = p.kind === "RESOLUTION";
          const tally = p.options.map((o) => ({ ...o, w: p.votes.filter((v) => v.optionId === o.id).reduce((s, v) => s + Number(v.weight), 0), n: p.votes.filter((v) => v.optionId === o.id).length }));
          const sum = tally.reduce((s, t) => s + t.w, 0) || 1;
          const mine = p.votes.find((v) => v.userId === u.id)?.optionId;
          const turnout = weighted ? (sum / totalSqm) * 100 : (p.votes.length / totals._count) * 100;
          const leader = [...tally].sort((a, b) => b.w - a.w)[0];
          const passes = weighted && leader && leader.w > totalSqm / 2;
          return (
            <div className="card" key={p.id}>
              <div className="row"><span className={"tag " + (weighted ? "t-warn" : "t-acc")}>{weighted ? "Resolution" : "Poll"}</span><span className={"tag " + (open ? "t-ok" : "t-mut")}>{open ? `Open until ${fmtDate(p.closesAt)}` : `Closed ${fmtDate(p.closesAt)}`}</span></div>
              <h3 style={{ marginTop: 8 }}>{p.question}</h3>
              {p.detail && <div className="hint" style={{ marginBottom: 8 }}>{p.detail}</div>}
              {owner && open ? (
                <form action={vote} className="stack" style={{ marginTop: 8 }}>
                  <input type="hidden" name="pollId" value={p.id} />
                  {p.options.map((o) => <label key={o.id} className="row" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}><input type="radio" name="optionId" value={o.id} defaultChecked={mine === o.id} required />{o.label}</label>)}
                  <div><SubmitButton label={mine ? "Change my vote" : "Submit vote"} busy="Saving…" small /></div>
                </form>
              ) : null}
              {(!owner || !open || mine) && (
                <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                  <div className="bar2">{tally.map((t, i) => <span key={t.id} style={{ width: `${(t.w / sum) * 100}%`, background: COLORS[i % COLORS.length] }} title={t.label} />)}</div>
                  {tally.map((t, i) => <div key={t.id} className="row" style={{ fontSize: 13 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length] }} />{t.label}{mine === t.id && <span className="tag t-acc">your vote</span>}<span className="num" style={{ marginLeft: "auto" }}>{((t.w / sum) * 100).toFixed(0)}% · {t.n} units</span></div>)}
                  <div className="hint">Turnout {turnout.toFixed(0)}% {weighted ? "of total floor area" : "of units"}{weighted ? ` · ${passes ? "has a majority of all area" : "no majority of all area yet"}` : ""}</div>
                </div>
              )}
            </div>);
        })}</div>
        {!owner && (
          <div className="card"><h3>New poll or resolution</h3>
            <form action={createPoll} style={{ marginTop: 8 }}>
              <div className="formgrid">
                <div className="field full"><label htmlFor="question">Question</label><input id="question" name="question" required placeholder="Approve the 2027 budget and dues of ₱105/sqm?" /></div>
                <div className="field full"><label htmlFor="detail">Background (optional)</label><textarea id="detail" name="detail" rows={2} /></div>
                <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind"><option value="POLL">Poll (one vote per unit)</option><option value="RESOLUTION">Resolution (weighted by sqm)</option></select></div>
                <div className="field"><label htmlFor="closes">Closes</label><input id="closes" type="date" name="closes" defaultValue={in2w} required /></div>
                <div className="field full"><label htmlFor="options">Options, one per line</label><textarea id="options" name="options" rows={3} defaultValue={"Yes\nNo\nAbstain"} /></div>
              </div>
              <SubmitButton label="Publish" busy="Publishing…" />
            </form>
          </div>
        )}
      </main>
    </>
  );
}
