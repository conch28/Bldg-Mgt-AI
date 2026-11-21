import { requireRole } from "@/lib/auth";
import { PageHead, Kpi } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { equipmentHealth, LIMITS } from "@/lib/equipment";
import { bookService } from "./actions";

export const dynamic = "force-dynamic";
const COL = { ok: "#009E73", warn: "#E69F00", alarm: "#D55E00" } as const;
const WORD = { ok: "Healthy", warn: "Watch", alarm: "Service now" } as const;

function Spark({ ys, warn, alarm, down }: { ys: number[]; warn: number; alarm: number; down?: boolean }) {
  if (ys.length < 2) return null;
  const lo = Math.min(...ys, down ? alarm : Infinity), hi = Math.max(...ys, down ? -Infinity : Math.min(alarm, Math.max(...ys) * 1.3));
  const W = 120, H = 30, y = (v: number) => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
  const pts = ys.map((v, i) => `${(i / (ys.length - 1)) * W},${y(v)}`).join(" ");
  const wy = y(warn);
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{wy > 0 && wy < H && <line x1="0" x2={W} y1={wy} y2={wy} stroke="#E69F00" strokeDasharray="3 3" strokeWidth="1" />}<polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

export default async function Equipment({ searchParams }: { searchParams: { ok?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const mgr = u.role !== "BOARD";
  const list = await equipmentHealth();
  const n = (s: string) => list.filter((a) => a.state === s).length;
  return (
    <>
      <PageHead title="Lifts & generator health" sub="Sensors on the elevators, the generator and the water pumps report every hour. AI watches the trend and books service before something breaks, not after." />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <div className="grid g4">
          <Kpi k="Monitored" v={list.length} d="lifts, genset, pumps" />
          <Kpi k="Healthy" v={n("ok")} cls="up" /><Kpi k="Watch" v={n("warn")} cls={n("warn") ? "amber" : ""} /><Kpi k="Service now" v={n("alarm")} cls={n("alarm") ? "down" : ""} />
        </div>
        {!list.length && <div className="card empty">No sensors connected yet.</div>}
        <div className="grid g2">{list.map((a) => (
          <div className="card eq" key={a.id}>
            <div className="row" style={{ gap: 12 }}>
              <div className="eq-ring" style={{ ["--p" as any]: a.score, ["--c" as any]: COL[a.state] }}><b>{a.score}</b></div>
              <div style={{ flex: 1, minWidth: 0 }}><span className="tag" style={{ background: COL[a.state], color: "#fff" }}>{WORD[a.state]}</span><h3 style={{ marginTop: 4 }}>{a.name}</h3><div className="hint">{a.location} · {a.tag}</div></div>
            </div>
            <div className={"twin-warn " + (a.state === "alarm" ? "bad" : "watch")} style={{ marginTop: 10, display: a.state === "ok" && !a.metrics.some((m) => m.daysToAlarm) ? "none" : undefined }}><b>AI forecast:</b> {a.forecast}</div>
            {a.state === "ok" && !a.metrics.some((m) => m.daysToAlarm) && <div className="hint" style={{ marginTop: 8 }}>{a.forecast}</div>}
            <div className="eq-metrics">{a.metrics.map((m) => (
              <div key={m.metric} className="eq-m" style={{ color: COL[m.state] }}>
                <div><span className="hint">{m.label}</span><b className="num">{m.last} {m.unit}</b>{m.daysToAlarm != null && <span className="hint"> · alarm in ~{m.daysToAlarm}d</span>}</div>
                <Spark ys={m.series} warn={LIMITS[m.metric].warn} alarm={LIMITS[m.metric].alarm} down={LIMITS[m.metric].down} />
              </div>))}</div>
            {mgr && (a.state !== "ok" || a.metrics.some((m) => m.daysToAlarm != null)) ? (a.openWo ? <div className="hint">Service booked: WO-{a.openWo}</div> :
              <form action={bookService}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="why" value={a.forecast} /><SubmitButton label="Book preventive service" busy="Booking…" small /></form>) : null}
          </div>))}</div>
      </main>
    </>
  );
}
