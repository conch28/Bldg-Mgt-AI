import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import Tip from "@/components/Tip";
import { WeatherStrip } from "@/components/Weather";
import { CHECKPOINTS, ISSUES, METERS, shiftOf } from "@/lib/rounds";
import { fmtDateTime, fmtTime, nowManila } from "@/lib/format";
import { leakCheck } from "@/lib/advisor";
import { getWeather } from "@/lib/weather";
import RoundWalk from "./RoundWalk";

export const dynamic = "force-dynamic";

export default async function Rounds() {
  const u = await requireRole("GUARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const since = new Date(now.getTime() - 14 * 3600000);
  const isGuard = u.role === "GUARD";
  const mine = await prisma.guardRound.findFirst({ where: { guardId: u.id, submittedAt: null, startedAt: { gte: since } }, orderBy: { startedAt: "desc" }, include: { issues: { select: { number: true, title: true, location: true, events: { select: { note: true }, take: 1, orderBy: { createdAt: "asc" } } } } } });
  const weather = await getWeather();

  const [rounds, roundIssues, latest, leak] = await Promise.all([
    prisma.guardRound.findMany({ where: { startedAt: { gte: new Date(now.getTime() - 7 * 86400000) } }, include: { guard: { select: { name: true } }, _count: { select: { issues: true, readings: true } } }, orderBy: { startedAt: "desc" }, take: 14 }),
    prisma.workOrder.findMany({ where: { source: "Guard round", createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } }, orderBy: { createdAt: "desc" }, take: 30 }),
    Promise.all(METERS.map((m) => prisma.meterReading.findFirst({ where: { meter: m.key }, orderBy: { takenAt: "desc" } }))),
    leakCheck(),
  ]);

  // which stop each logged issue came from (the first event names it)
  const logged = (mine?.issues ?? []).map((w) => {
    const cp = CHECKPOINTS.find((c) => w.events[0]?.note.includes(`at ${c.label}`));
    return { checkpoint: cp?.key ?? "", title: w.title, number: w.number, dup: false, where: w.location };
  });
  const open = roundIssues.filter((w) => w.status !== "DONE");
  const fixed = roundIssues.filter((w) => w.status === "DONE");

  return (
    <>
      <PageHead title={isGuard ? "My round" : "Guard rounds"} sub={isGuard ? `${shiftOf(now) === "DAY" ? "Day" : "Night"} shift · ${now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" })}` : "Daily patrol reports, problems found and meter readings"} />
      <main className="view">
        <Tip id="rounds" title={isGuard ? "Check every stop, every shift." : "Guards are your eyes on the building."}>
          {isGuard ? "Tap OK when a stop is fine. Tap Problem when you see a broken light, a leak, an aircon or power problem. You can add a photo. The engineers get it right away." : "Every problem a guard logs becomes a work order with a deadline and shows on the 3D building. Night water readings feed the hidden-leak check in the AI advisor."}
        </Tip>
        {weather.risk !== "ok" && <WeatherStrip w={weather} />}

        {(isGuard || mine) && <RoundWalk round={mine ? { id: mine.id, checked: mine.checked } : null} logged={logged} shift={shiftOf(now)} />}

        {!isGuard && (
          <>
            <div className="grid g4">
              <div className="card kpi"><div className="k">Rounds, last 7 days</div><div className="v">{rounds.filter((r) => r.submittedAt).length}</div><div className="d hint">{rounds.filter((r) => !r.submittedAt).length} in progress</div></div>
              <div className="card kpi"><div className="k">Problems found</div><div className="v">{roundIssues.length}</div><div className="d hint">{fixed.length} already fixed</div></div>
              <div className="card kpi"><div className="k">Still open</div><div className={"v " + (open.length ? "amber" : "")}>{open.length}</div><div className="d hint">{open.filter((w) => w.priority === "HIGH").length} urgent</div></div>
              <div className="card kpi"><div className="k">Stops covered</div><div className="v">{rounds.length ? Math.round((rounds.reduce((s, r) => s + r.checked.length, 0) / (rounds.length * CHECKPOINTS.length)) * 100) : 0}%</div><div className="d hint">of {CHECKPOINTS.length} per round</div></div>
            </div>
            {leak?.leak && (
              <Link href="/advisor" className="card alert-card">
                <b>💧 Possible hidden water leak</b>
                <div>Night water flow is up {Math.round(leak.rise * 100)}% since {new Date(leak.since + "T12:00:00+08:00").toLocaleDateString("en-PH", { day: "numeric", month: "short" })}, from guard meter readings. See the AI advisor for what to check.</div>
              </Link>
            )}
            <div className="grid g-7-5">
              <div className="card"><h3>Problems found on rounds</h3><div className="hint">Last 7 days. Tap a ticket in Work orders to assign it.</div>
                <div className="list" style={{ marginTop: 6 }}>
                  {roundIssues.length ? roundIssues.map((w) => (
                    <div className="li" key={w.id}><StatusTag s={w.status} />
                      <div style={{ flex: 1, minWidth: 0 }}><b>WO-{w.number} · {w.title}</b><div className="hint">{w.location} · {fmtDateTime(w.createdAt)}{w.photo ? " · photo" : ""}</div></div>
                      {w.priority === "HIGH" && <span className="tag t-bad">Urgent</span>}
                    </div>
                  )) : <div className="empty">No problems logged this week.</div>}
                </div>
                <Link href="/work-orders" className="btn" style={{ marginTop: 10 }}>Open work orders</Link>
              </div>
              <div className="stack">
                <div className="card"><h3>Rounds this week</h3>
                  <div className="list" style={{ marginTop: 6 }}>
                    {rounds.length ? rounds.map((r) => (
                      <div className="li" key={r.id}><span className={"tag " + (r.submittedAt ? "t-ok" : "t-warn")}>{r.shift === "DAY" ? "Day" : "Night"}</span>
                        <div style={{ flex: 1 }}><b>{r.guard.name}</b><div className="hint">{fmtDateTime(r.startedAt)}{r.submittedAt ? ` to ${fmtTime(r.submittedAt)}` : " · in progress"} · {r.checked.length}/{CHECKPOINTS.length} stops · {r._count.issues} problem{r._count.issues === 1 ? "" : "s"}</div>{r.notes && <div className="hint">“{r.notes}”</div>}</div>
                      </div>
                    )) : <div className="empty">No rounds yet.</div>}
                  </div>
                </div>
                <div className="card"><h3>Latest meter readings</h3>
                  <div className="list" style={{ marginTop: 6 }}>
                    {METERS.map((m, i) => <div className="li" key={m.key}><div style={{ flex: 1 }}>{m.label}</div><b className="num">{latest[i] ? `${latest[i]!.value.toLocaleString("en-PH")} ${m.unit}` : "–"}</b><span className="hint">{latest[i] ? fmtDateTime(latest[i]!.takenAt) : ""}</span></div>)}
                  </div>
                </div>
                {!mine && <RoundWalk round={null} logged={[]} shift={shiftOf(now)} />}
              </div>
            </div>
            <div className="hint">Problems guards can log in one tap: {ISSUES.map((i) => i.label.toLowerCase()).join(", ")}.</div>
          </>
        )}
      </main>
    </>
  );
}
