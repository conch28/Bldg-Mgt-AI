"use client";
import { useState, useTransition } from "react";
import { draftAction, sendAction } from "@/app/(app)/collections/actions";

type Row = { unitId: string; code: string; owner: string; amount: number; days: number; lastReminder?: string };
const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const STAGE = (d: number) => (d > 90 ? ["Final notice", "t-bad"] : d > 45 ? ["Firm reminder", "t-warn"] : d > 14 ? ["Friendly reminder", "t-mut"] : ["Courtesy nudge", "t-mut"]);

export default function ReminderPanel({ rows, canSend }: { rows: Row[]; canSend: boolean }) {
  const [sel, setSel] = useState<Row | null>(null);
  const [draft, setDraft] = useState(""); const [tone, setTone] = useState("");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const doDraft = (r: Row, softer = false) => { setSel(r); setDraft(""); start(async () => { try { const d = await draftAction(r.unitId, softer); setDraft(d.text); setTone(d.tone); } catch (e) { setDraft("Could not draft: " + (e as Error).message); } }); };
  const send = () => sel && start(async () => { try { const info = await sendAction(sel.unitId, draft, tone); setStatus({ ...status, [sel.unitId]: info }); } catch (e) { setStatus({ ...status, [sel.unitId]: "Failed: " + (e as Error).message }); } });
  return (
    <div className="grid g-7-5">
      <div className="card">
        <div className="cardhead"><div><h3>Overdue accounts</h3><div className="hint">The AI picks the tone by how late the account is. Nothing is sent until you press Send.</div></div></div>
        <div className="tablewrap"><table className="stack-m">
          <thead><tr><th>Unit</th><th>Owner</th><th className="r">Days late</th><th className="r">Balance</th><th>Stage</th><th /></tr></thead>
          <tbody>{rows.map((r) => { const [st, cls] = STAGE(r.days); return (
            <tr key={r.unitId}><td className="mono">{r.code}</td><td>{r.owner}</td>
              <td className={"r num " + (r.days > 60 ? "down" : r.days > 30 ? "amber" : "")}>{r.days}</td><td className="r num">{peso(r.amount)}</td>
              <td><span className={"tag " + cls}>{st}</span>{r.lastReminder && <div className="hint" style={{ fontSize: 11 }}>last sent {r.lastReminder}</div>}</td>
              <td className="r">{status[r.unitId] ? <span className="tag t-ok">{status[r.unitId]}</span> : canSend && <button className="btn sm" onClick={() => doDraft(r)}>Draft</button>}</td></tr>); })}
            {!rows.length && <tr><td colSpan={6} className="hint">No overdue accounts. 🎉</td></tr>}
          </tbody></table></div>
      </div>
      <div className="card">
        <span className="ai-badge">AI-drafted reminder</span>
        {!sel ? <div className="hint" style={{ marginTop: 10 }}>{canSend ? "Pick an account and press Draft." : "Reminders are sent by the property manager."}</div> : (
          <div style={{ marginTop: 10 }}>
            <b>Unit {sel.code} · {sel.owner}</b> <span className="hint">· {tone} tone</span>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="draft">Message (you can edit it)</label>
              <textarea id="draft" rows={7} value={pending && !draft ? "Drafting…" : draft} onChange={(e) => setDraft(e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn pri" disabled={pending || !draft} onClick={send}>Send</button>
              <button className="btn" disabled={pending} onClick={() => doDraft(sel, true)}>Make it gentler</button>
            </div>
          </div>)}
      </div>
    </div>
  );
}
