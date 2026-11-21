"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const SUGG = ["May tulo sa ceiling ng CR ko", "Magkano balance ko?", "Status ng repair ko?", "Book aircon cleaning", "Elevator 2 is making a weird noise", "Can I renovate my kitchen?"];

export default function Chat({ initial, name, ai }: { initial: Msg[]; name: string; ai: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial.length ? initial : [{ role: "assistant", content: `Hi ${name}! 👋 I'm the Skyland helpdesk assistant. Pwede po kayong mag-message in English or Tagalog. I can check your balance, file a repair, book services, or connect you to the property manager.` }]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, busy]);
  async function send(t: string) {
    if (!t.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", content: t }]); setText(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.reply ?? j.error ?? "Something went wrong." }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please check your connection." }]); }
    setBusy(false);
  }
  return (
    <div className="phone">
      <div className="phone-top"><div className="avatar">S</div><div><b>Skyland Helpdesk</b><small>● {ai ? "AI assistant · powered by Claude" : "Assistant (basic mode)"}</small></div></div>
      <div className="msgs" ref={box}>
        {msgs.map((m, i) => <div key={i} className={"msg " + (m.role === "user" ? "me" : "ai")} style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>)}
        {busy && <div className="msg ai typing"><i /><i /><i /></div>}
      </div>
      <div className="sugg">{SUGG.map((s) => <button key={s} className="chip" type="button" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input id="chatIn" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Type in English or Tagalog…" aria-label="Message" maxLength={2000} />
        <button aria-label="Send" disabled={busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
    </div>
  );
}
