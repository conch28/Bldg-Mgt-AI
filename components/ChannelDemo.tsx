"use client";
import { useState } from "react";
import { simulate } from "@/app/(app)/channels/actions";

type Msg = { me: boolean; text: string };
const STARTERS = ["Magkano po balance ko?", "May tulo po sa CR namin, 1202B", "Pwede po mag-book ng aircon cleaning sa Sabado?", "What time does the pool open?"];

/** Phone mock-up of the Messenger / Viber chat, wired to the real helpdesk brain (demo only). */
export default function ChannelDemo({ enabled }: { enabled: boolean }) {
  const [ch, setCh] = useState<"MESSENGER" | "VIBER">("MESSENGER");
  const [msgs, setMsgs] = useState<Msg[]>([{ me: false, text: "Hi Ana! Skyland Plaza helpdesk here po. Ask me anything about your unit." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(t: string) {
    if (!t.trim() || busy) return;
    setMsgs((m) => [...m, { me: true, text: t }]); setText(""); setBusy(true);
    const r = await simulate(ch, t).catch(() => ({ error: "Couldn't reach the assistant." }));
    setMsgs((m) => [...m, { me: false, text: "error" in r ? r.error : r.reply }]); setBusy(false);
  }
  return (
    <div className={"phone-chat " + (ch === "VIBER" ? "viber" : "fbm")}>
      <div className="pc-top">
        <div className="seg2" role="tablist">{(["MESSENGER", "VIBER"] as const).map((c) => <button key={c} role="tab" aria-selected={ch === c} className={ch === c ? "on" : ""} onClick={() => setCh(c)}>{c === "MESSENGER" ? "Messenger" : "Viber"}</button>)}</div>
        <b>Skyland Helpdesk</b><span>{ch === "MESSENGER" ? "Typically replies instantly" : "Public account"}</span>
      </div>
      <div className="pc-msgs" aria-live="polite">{msgs.map((m, i) => <div key={i} className={"pc-b " + (m.me ? "me" : "bot")}>{m.text}</div>)}{busy && <div className="pc-b bot">…</div>}</div>
      <div className="pc-chips">{STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={!enabled || busy}>{s}</button>)}</div>
      <form className="pc-in" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={enabled ? "Aa" : "Simulator runs on the demo site only"} disabled={!enabled} aria-label="Message" />
        <button className="btn sm pri" disabled={!enabled || busy}>Send</button>
      </form>
    </div>
  );
}
