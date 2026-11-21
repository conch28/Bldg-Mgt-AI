"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CHECKPOINTS, ISSUES, METERS } from "@/lib/rounds";
import { shrinkImage } from "@/lib/image";
import { logIssue, markOk, saveReadings, startRound, submitRound } from "./actions";

type Logged = { checkpoint: string; title: string; number: number; dup: boolean; where: string };

/** The guard's walk: one row per stop, OK in one tap, or Problem → pick what's wrong → optional photo → logged as a work order. */
export default function RoundWalk({ round, logged: initialLogged, shift }: { round: { id: string; checked: string[] } | null; logged: Logged[]; shift: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [logged, setLogged] = useState<Logged[]>(initialLogged);
  const [toast, setToast] = useState<string>("");
  const [err, setErr] = useState("");
  const [meters, setMeters] = useState<Record<string, string>>({});
  const [meterMsg, setMeterMsg] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<void>) => start(async () => { setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message || "Something went wrong. Please try again."); } });
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 3500); };

  if (!round) return (
    <div className="card round-start">
      <h3>Start your {shift === "DAY" ? "day" : "night"} round</h3>
      <p className="hint">{CHECKPOINTS.length} stops, about 40 minutes. Tap OK at each stop, or Problem if something is wrong. Problems go straight to the engineers as work orders.</p>
      {err && <div className="err">{err}</div>}
      <button className="btn pri big-btn" disabled={pending} onClick={() => run(async () => { await startRound(); router.refresh(); })}>{pending ? "Starting…" : "Start round"}</button>
    </div>
  );

  const done = new Set(round.checked);
  const issuesAt = (k: string) => logged.filter((l) => l.checkpoint === k);
  const reset = () => { setOpen(null); setKind(null); setWhere(""); setNote(""); setPhoto(null); };

  return (
    <>
      {toast && <div className="toast" role="status">{toast}</div>}
      <div className="round-progress" aria-label="Round progress">
        <div className="bar2"><i style={{ width: `${(done.size / CHECKPOINTS.length) * 100}%` }} /></div>
        <span><b>{done.size}</b> of {CHECKPOINTS.length} stops · <b>{logged.length}</b> problem{logged.length === 1 ? "" : "s"} logged</span>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="card" style={{ padding: 0 }}>
        {CHECKPOINTS.map((c) => {
          const isOpen = open === c.key, issues = issuesAt(c.key), ok = done.has(c.key);
          return (
            <div key={c.key} className={"stop" + (ok ? " done" : "") + (issues.length ? " bad" : "")}>
              <div className="stop-row">
                <span className="stop-dot" aria-hidden="true">{issues.length ? "!" : ok ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{c.label}</b>
                  <div className="hint">{issues.length ? issues.map((i) => `WO-${i.number} ${i.title.toLowerCase()}${i.dup ? " (already reported)" : ""}`).join(" · ") : c.look}</div>
                </div>
                {!isOpen && <div className="stop-btns">
                  {!ok && <button className="btn sm" disabled={pending} onClick={() => run(async () => { await markOk(round.id, c.key); router.refresh(); })}>OK</button>}
                  <button className="btn sm warnbtn" onClick={() => { reset(); setOpen(c.key); }}>Problem</button>
                </div>}
              </div>
              {isOpen && (
                <div className="stop-form">
                  <div className="lbl">What&apos;s wrong?</div>
                  <div className="issue-chips">
                    {ISSUES.map((i) => <button key={i.key} type="button" className={"chip" + (kind === i.key ? " on" : "")} aria-pressed={kind === i.key} onClick={() => setKind(i.key)}>{i.label}</button>)}
                  </div>
                  <div className="field" style={{ marginTop: 10 }}><label htmlFor={`w-${c.key}`}>Where exactly? (optional)</label>
                    <input id={`w-${c.key}`} value={where} onChange={(e) => setWhere(e.target.value)} placeholder={c.key === "hallways" ? "e.g. Tower B 12th floor hallway" : "e.g. near the B2 ramp, or unit 1202B"} maxLength={80} /></div>
                  <div className="field"><label htmlFor={`n-${c.key}`}>Note (optional)</label>
                    <input id={`n-${c.key}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 tubes out, dripping since 10 PM" maxLength={600} /></div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { setPhoto(await shrinkImage(f, 720, 0.65)); } catch (x) { setErr((x as Error).message); } }} />
                    <button type="button" className="btn" onClick={() => file.current?.click()}>{photo ? "Retake photo" : "Add photo (optional)"}</button>
                    {photo && <img src={photo} alt="Your photo" className="stop-thumb" />}
                  </div>
                  <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn pri" disabled={!kind || pending} onClick={() => run(async () => {
                      const r = await logIssue({ roundId: round.id, checkpoint: c.key, issue: kind!, where, note, photo });
                      const t = ISSUES.find((i) => i.key === kind)!.title;
                      setLogged((l) => [...l, { checkpoint: c.key, title: t, number: r.number, dup: r.dup, where }]);
                      flash(r.dup ? `Already reported as WO-${r.number}. Your note was added.` : `Logged as WO-${r.number}. Engineers have it (${r.sla}h deadline).`);
                      reset(); router.refresh();
                    })}>{pending ? "Logging…" : "Log problem"}</button>
                    <button className="btn" onClick={reset}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Meter readings</h3>
        <div className="hint">Read these on every round. Night readings help us catch hidden water leaks.</div>
        <div className="formgrid" style={{ marginTop: 10 }}>
          {METERS.map((m) => (
            <div className="field" key={m.key}><label htmlFor={m.key}>{m.label} ({m.unit})</label>
              <input id={m.key} inputMode="decimal" value={meters[m.key] ?? ""} onChange={(e) => setMeters({ ...meters, [m.key]: e.target.value })} placeholder={m.hint} /></div>
          ))}
        </div>
        {meterMsg.map((w) => <div className="hint" key={w} style={{ color: "var(--warn)" }}>{w}</div>)}
        <button className="btn" disabled={pending || !Object.values(meters).some(Boolean)} onClick={() => run(async () => {
          const r = await saveReadings(round.id, meters);
          setMeterMsg(r.warnings); if (r.saved) { flash(`${r.saved} reading${r.saved > 1 ? "s" : ""} saved.`); setMeters({}); }
        })}>Save readings</button>
      </div>

      <div className="card">
        <h3>Finish the round</h3>
        <div className="field" style={{ marginTop: 8 }}><label htmlFor="rnotes">Anything else to report? (optional)</label>
          <textarea id="rnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Delivery van parked in the fire lane at 11 PM, driver moved it" /></div>
        <button className="btn pri big-btn" disabled={pending} onClick={() => run(async () => { await submitRound(round.id, notes); flash("Round report sent to the manager. Salamat po!"); router.refresh(); })}>
          Submit round report{done.size < CHECKPOINTS.length ? ` (${CHECKPOINTS.length - done.size} stops not checked)` : ""}
        </button>
      </div>
    </>
  );
}
