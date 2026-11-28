"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./ui";
import { CARDS, DISCLAIMER, ESCALATE_TEXT, GROUPS, STARTERS, cardById, type Escalate, type Group } from "@/lib/askkb";
import { askPerson } from "@/app/(app)/ask/actions";

type Msg = { role: "user" | "assistant"; content: string; cards?: string[]; escalate?: Escalate | null; q?: string; ticket?: string };
const KEY = "ask-ai-v1";

export default function AskAI({ audience, name, ai }: { audience: "owner" | "board"; name: string; ai: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The conversation lives in this tab only; nothing about it is saved on the server.
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setMsgs(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch {} }, [msgs]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, busy, group]);

  async function send(t: string) {
    if (!t.trim() || busy) return;
    const history = msgs.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: t }]); setText(""); setGroup(null); setBusy(true);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, history }) });
      const j = await r.json();
      setMsgs((m) => [...m, j.reply ? { role: "assistant", content: j.reply, cards: j.cards, escalate: j.escalate, q: t } : { role: "assistant", content: j.error ?? "Something went wrong." }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please check your connection." }]); }
    setBusy(false);
  }

  async function person(i: number) {
    const m = msgs[i]; if (!m.q || m.ticket) return;
    const topic = m.cards?.[0] ? cardById(m.cards[0])?.q : undefined;
    const r = await askPerson({ question: m.q, topic });
    setMsgs((all) => all.map((x, k) => (k === i ? { ...x, ticket: r.ok ? r.ticket : "error" } : x)));
  }

  const starters = STARTERS[audience];
  const inGroup = group ? CARDS.filter((c) => c.group === group).sort((a, b) => Number(b.who === audience) - Number(a.who === audience)) : [];

  return (
    <div className="phone ask">
      <div className="phone-top"><div className="avatar">AI</div><div><b>Ask AI</b><small>● {ai ? "Sourced answers · powered by Claude" : "Sourced answers (basic mode)"}</small></div>
        {msgs.length > 0 && <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => { setMsgs([]); setGroup(null); }}>New</button>}
      </div>
      <div className="msgs" ref={box}>
        <div className="msg ai">
          Hi {name}! 👋 Ask me anything about living at Skyland{audience === "board" ? " or running the corporation" : ""}: dues, repairs, neighbours, renting, your rights, meetings. I&apos;ll show the law or rule behind each answer. Pwede po in English or Tagalog.
          <div className="meta">{DISCLAIMER}</div>
        </div>
        {msgs.length === 0 && (
          <div className="ask-topics" aria-label="Topics">
            {GROUPS.map((g) => <button key={g} type="button" className={"chip" + (group === g ? " on" : "")} onClick={() => setGroup(group === g ? null : g)} aria-expanded={group === g}>{g}</button>)}
          </div>
        )}
        {group && (
          <div className="ask-qs">
            {inGroup.map((c) => <button key={c.id} type="button" onClick={() => send(c.q)}>{c.q}<span aria-hidden="true">›</span></button>)}
          </div>
        )}
        {msgs.map((m, i) => m.role === "user"
          ? <div key={i} className="msg me" style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          : (
            <div key={i} className="msg ai">
              <Markdown text={m.content} />
              {m.escalate && <div className={"ask-esc" + (m.escalate === "emergency" ? " bad" : "")}>{ESCALATE_TEXT[m.escalate]}</div>}
              {m.cards && m.cards.length > 0 && (
                <div className="ask-src">
                  <button type="button" className="ask-src-t" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>📖 Sources ({m.cards.reduce((n, id) => n + (cardById(id)?.sources.length ?? 0), 0)})</button>
                  {open === i && <ul>{m.cards.flatMap((id) => cardById(id)?.sources ?? []).filter((s, k, a) => a.findIndex((x) => x.label === s.label) === k).map((s) => <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>)}</ul>}
                </div>
              )}
              {m.q && (
                <div className="acts">
                  {m.cards?.map((id) => cardById(id)?.link).filter((l, k, a) => l && a.findIndex((x) => x?.href === l.href) === k).slice(0, 2).map((l) => <Link key={l!.href} href={l!.href} className="btn sm">{l!.label}</Link>)}
                  {m.escalate === "emergency" && <Link href="/sos" className="btn sm" style={{ color: "var(--bad)" }}>SOS</Link>}
                  {m.ticket ? <span className="meta">{m.ticket === "error" ? "Couldn't send. Please try again later." : `Sent to the property manager as ${m.ticket}.`}</span>
                    : <button type="button" className="btn sm pri" onClick={() => person(i)}>Talk to a person</button>}
                </div>
              )}
            </div>
          ))}
        {busy && <div className="msg ai typing"><i /><i /><i /></div>}
      </div>
      <div className="sugg">{starters.map((s) => <button key={s} className="chip" type="button" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Ask about dues, rules, your rights…" aria-label="Your question" maxLength={2000} />
        <button aria-label="Ask" disabled={busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
    </div>
  );
}
