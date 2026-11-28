"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./ui";
import { CARDS, DISCLAIMER, ESCALATE_TEXT, GROUPS, STARTERS, cardById, type Escalate, type Group } from "@/lib/askkb";
import { askPerson, confirmAction } from "@/app/(app)/ask/actions";
import type { Action, ActionResult, AmenityOption } from "@/lib/assist";
import type { LibRef, RuleRef } from "@/lib/ai";

type Msg = {
  role: "user" | "assistant"; content: string; cards?: string[]; library?: LibRef[]; rules?: RuleRef[]; escalate?: Escalate | null; q?: string; ticket?: string;
  action?: Action; amenities?: AmenityOption[]; done?: ActionResult;
};
const KEY = "ask-ai-v2";

/** Quick actions owners can start with one tap. */
const DO_STARTERS = ["Report a repair", "Guest pass for today", "Guest parking pass", "Book the function room"];

type Src = { label: string; href?: string; ext?: boolean; tag?: string };
function sourcesOf(m: Msg): Src[] {
  const out: Src[] = [];
  for (const r of m.rules ?? []) out.push({ label: `Skyland House Rules §${r.section} ${r.title}`, href: `/rules#${r.id}`, tag: r.status === "APPROVED" ? undefined : "template" });
  for (const e of m.library ?? []) out.push({ label: e.citation + (e.date ? ` (${e.date.slice(0, 4)})` : ""), href: e.url ?? `/ask/library#${e.id}`, ext: !!e.url, tag: e.verified ? undefined : "check with counsel" });
  for (const s of (m.cards ?? []).flatMap((id) => cardById(id)?.sources ?? [])) out.push({ label: s.label, href: s.url, ext: true });
  return out.filter((s, k, a) => a.findIndex((x) => x.label === s.label) === k);
}

export default function AskAI({ audience, name, ai, canAct = false, compact = false }: { audience: "owner" | "board"; name: string; ai: boolean; canAct?: boolean; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The conversation lives in this tab only; nothing about it is saved on the server.
  // The page and the top-right helper share it, so a chat started in one continues in the other.
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
      setMsgs((m) => [...m, j.reply ? { role: "assistant", content: j.reply, cards: j.cards, library: j.library, rules: j.rules, escalate: j.escalate, q: t, action: j.action, amenities: j.amenities } : { role: "assistant", content: j.error ?? "Something went wrong." }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please check your connection." }]); }
    setBusy(false);
  }

  async function person(i: number) {
    const m = msgs[i]; if (!m.q || m.ticket) return;
    const topic = m.cards?.[0] ? cardById(m.cards[0])?.q : undefined;
    const r = await askPerson({ question: m.q, topic });
    setMsgs((all) => all.map((x, k) => (k === i ? { ...x, ticket: r.ok ? r.ticket : "error" } : x)));
  }

  const setDone = (i: number, done: ActionResult) => setMsgs((all) => all.map((x, k) => (k === i ? { ...x, done } : x)));
  const starters = canAct ? DO_STARTERS.concat(STARTERS[audience].slice(0, 2)) : STARTERS[audience];
  const inGroup = group ? CARDS.filter((c) => c.group === group).sort((a, b) => Number(b.who === audience) - Number(a.who === audience)) : [];

  return (
    <div className={"phone ask" + (compact ? " compact" : "")}>
      <div className="phone-top"><div className="avatar ask-face" aria-hidden="true">😊</div><div><b>Ask AI</b><small>● {ai ? "Sourced answers · powered by Claude" : "Sourced answers (basic mode)"}</small></div>
        {msgs.length > 0 && <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => { setMsgs([]); setGroup(null); }}>New</button>}
      </div>
      <div className="msgs" ref={box}>
        <div className="msg ai">
          Hi {name}! 👋 I&apos;m your Skyland helper. Ask me anything about living here{audience === "board" ? " or running the corporation" : ""}: dues, repairs, neighbours, pets, renting, your rights, meetings. I&apos;ll show the rule or law behind each answer.{canAct ? " I can also book things for you: repairs, guest and parking passes, amenities. You just tap Confirm." : ""} Pwede po in English or Tagalog. 🙂
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
        {msgs.map((m, i) => {
          if (m.role === "user") return <div key={i} className="msg me" style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>;
          const src = sourcesOf(m);
          return (
            <div key={i} className="msg ai">
              <Markdown text={m.content} />
              {m.action && <ActionCard action={m.action} amenities={m.amenities ?? []} done={m.done} onDone={(d) => setDone(i, d)} />}
              {m.escalate && <div className={"ask-esc" + (m.escalate === "emergency" ? " bad" : "")}>{ESCALATE_TEXT[m.escalate]}</div>}
              {src.length > 0 && (
                <div className="ask-src">
                  <button type="button" className="ask-src-t" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>📖 Sources ({src.length})</button>
                  {open === i && <ul>{src.map((s) => <li key={s.label}>{s.href ? (s.ext ? <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a> : <Link href={s.href}>{s.label}</Link>) : s.label}{s.tag && <span className="ask-tag">{s.tag}</span>}</li>)}</ul>}
                </div>
              )}
              {m.q && !m.action && (
                <div className="acts">
                  {m.cards?.map((id) => cardById(id)?.link).filter((l, k, a) => l && a.findIndex((x) => x?.href === l.href) === k).slice(0, 2).map((l) => <Link key={l!.href} href={l!.href} className="btn sm">{l!.label}</Link>)}
                  {m.escalate === "emergency" && <Link href="/sos" className="btn sm" style={{ color: "var(--bad)" }}>SOS</Link>}
                  {m.ticket ? <span className="meta">{m.ticket === "error" ? "Couldn't send. Please try again later." : `Sent to the property manager as ${m.ticket}.`}</span>
                    : <button type="button" className="btn sm pri" onClick={() => person(i)}>Talk to a person</button>}
                </div>
              )}
            </div>
          );
        })}
        {busy && <div className="msg ai typing"><i /><i /><i /></div>}
      </div>
      <div className="sugg">{starters.map((s) => <button key={s} className="chip" type="button" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder={canAct ? "Ask, or say “book a guest pass for Sat”…" : "Ask about dues, rules, your rights…"} aria-label="Your question" maxLength={2000} />
        <button aria-label="Ask" disabled={busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
    </div>
  );
}

const PASS_LABEL = { GUEST: "Guest pass", PARKING: "Guest parking pass", DELIVERY: "Delivery pass", CONTRACTOR: "Contractor pass" } as const;
const CATS = ["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"] as const;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** A draft from the AI, shown as a small form. Nothing happens until the owner taps Confirm. */
function ActionCard({ action, amenities, done, onDone }: { action: Action; amenities: AmenityOption[]; done?: ActionResult; onDone: (d: ActionResult) => void }) {
  const [a, setA] = useState<Action>(action);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch: Record<string, unknown>) => setA((x) => ({ ...x, ...patch }) as Action);

  if (done?.ok) return (
    <div className="ask-act done" role="status">
      <Markdown text={"✅ " + done.message} />
      <Link href={done.href} className="btn sm" style={{ marginTop: 6 }}>Open</Link>
    </div>
  );
  if (done && !done.ok) return <div className="ask-act"><div className="ask-esc bad">{done.error}</div></div>;

  async function go() {
    setBusy(true); setErr("");
    try { const r = await confirmAction(a); if (r.ok) onDone(r); else setErr(r.error); }
    catch { setErr("Couldn't send that. Please try again."); }
    setBusy(false);
  }
  const am = a.type === "amenity" ? amenities.find((x) => x.id === a.amenityId) : undefined;
  const hours = am ? Array.from({ length: Math.max(0, am.closeHour - am.slotHours - am.openHour + 1) }, (_, k) => am.openHour + k) : Array.from({ length: 24 }, (_, k) => k);
  const title = a.type === "repair" ? "🔧 Repair request" : a.type === "pass" ? `🎫 ${PASS_LABEL[a.kind]}` : "📅 Amenity booking";

  return (
    <form className="ask-act" onSubmit={(e) => { e.preventDefault(); go(); }}>
      <b>{title}</b>
      <div className="ask-act-grid">
        {a.type === "repair" && <>
          <label className="full">What&apos;s wrong<input value={a.title} onChange={(e) => set({ title: e.target.value })} required minLength={3} maxLength={120} /></label>
          <label>Type<select value={a.category} onChange={(e) => set({ category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Urgency<select value={a.priority} onChange={(e) => set({ priority: e.target.value })}><option value="HIGH">Urgent (4h)</option><option value="MEDIUM">Normal (24h)</option><option value="LOW">Can wait (72h)</option></select></label>
          <label className="full">Where<input value={a.location} onChange={(e) => set({ location: e.target.value })} placeholder="My unit" maxLength={60} /></label>
          <label className="full">Details<textarea rows={2} value={a.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} /></label>
        </>}
        {a.type === "pass" && <>
          <label>Type<select value={a.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.entries(PASS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>{a.kind === "DELIVERY" ? "Courier" : a.kind === "CONTRACTOR" ? "Worker or company" : "Guest's name"}<input value={a.name} onChange={(e) => set({ name: e.target.value })} required minLength={2} maxLength={80} placeholder="Juan dela Cruz" /></label>
          <label>Date<input type="date" value={a.date} min={today()} onChange={(e) => set({ date: e.target.value })} required /></label>
          <label>Days<select value={a.days} onChange={(e) => set({ days: Number(e.target.value) })}>{[1, 2, 3, 5, 7, 14, 30].map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
          {(a.kind === "PARKING" || a.kind === "GUEST") && <label>Plate{a.kind === "PARKING" ? "" : " (optional)"}<input value={a.plate} onChange={(e) => set({ plate: e.target.value })} required={a.kind === "PARKING"} maxLength={12} placeholder="ABC 1234" /></label>}
          <label className={a.kind === "PARKING" || a.kind === "GUEST" ? "" : "full"}>Note for the guard<input value={a.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} placeholder="Optional" /></label>
        </>}
        {a.type === "amenity" && <>
          <label className="full">Amenity<select value={a.amenityId} onChange={(e) => set({ amenityId: e.target.value })} required><option value="">Pick one</option>{amenities.map((x) => <option key={x.id} value={x.id}>{x.name}{x.fee ? ` · ₱${x.fee.toLocaleString()}` : ""}</option>)}</select></label>
          <label>Date<input type="date" value={a.date} min={today()} onChange={(e) => set({ date: e.target.value })} required /></label>
          <label>Start<select value={a.hour} onChange={(e) => set({ hour: Number(e.target.value) })}>{(hours.includes(a.hour) ? hours : [a.hour, ...hours]).map((h) => <option key={h} value={h}>{h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}</option>)}</select></label>
          <label>Guests<input type="number" min={0} max={am ? am.capacity - 1 : 80} value={a.guests} onChange={(e) => set({ guests: Number(e.target.value) || 0 })} /></label>
        </>}
      </div>
      {err && <div className="ask-esc bad">{err}</div>}
      <div className="acts"><button className="btn sm pri" disabled={busy}>{busy ? "Sending…" : "Confirm"}</button><span className="meta">Nothing is sent until you confirm.</span></div>
    </form>
  );
}
