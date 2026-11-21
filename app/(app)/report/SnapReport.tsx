"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { analyzePhoto, submitPhotoTicket } from "./actions";

type Read = { title: string; category: string; priority: "LOW" | "MEDIUM" | "HIGH"; seen: string; advice: string; confident: boolean; ai: boolean };
const CATS = ["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"];
const COMMON = ["Lobby", "Hallway", "Elevator", "Parking", "Amenity deck", "Garbage room"];
const PRI_WORD = { HIGH: "Urgent · 4 hours", MEDIUM: "Soon · 24 hours", LOW: "When convenient · 3 days" } as const;

/** Shrinks a photo on the phone before upload: long side `max` px, JPEG. */
function shrink(src: File | string, max: number, q: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const revoke = () => { if (typeof src !== "string") URL.revokeObjectURL(url); };
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      revoke();
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { revoke(); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}

export default function SnapReport({ units, ai }: { units: string[]; ai: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<"" | "reading" | "sending">("");
  const [read, setRead] = useState<Read | null>(null);
  const [form, setForm] = useState({ title: "", category: "Other", priority: "MEDIUM" as Read["priority"], location: units[0] ?? "Lobby", note: "" });
  const [done, setDone] = useState<{ number: number; sla: number } | null>(null);
  const [err, setErr] = useState("");

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(""); setRead(null); setDone(null);
    try { setPhoto(await shrink(f, 1024, 0.72)); } catch (e) { setErr((e as Error).message); }
  }
  async function analyze() {
    if (!photo) return;
    setBusy("reading"); setErr("");
    try {
      const r = await analyzePhoto(photo, caption);
      setRead(r);
      setForm((f) => ({ ...f, title: r.title, category: r.category, priority: r.priority, note: caption }));
    } catch (e) { setErr((e as Error).message || "Something went wrong. Please try again."); }
    setBusy("");
  }
  async function send() {
    if (!photo || !read) return;
    setBusy("sending"); setErr("");
    try {
      // keep the stored copy small: 720px is plenty for a technician
      const small = await shrink(photo, 720, 0.65);
      setDone(await submitPhotoTicket({ photo: small, ...form, seen: read.seen, ai: read.ai }));
    } catch (e) { setErr((e as Error).message || "Could not send. Please try again."); }
    setBusy("");
  }
  const reset = () => { setPhoto(null); setRead(null); setDone(null); setCaption(""); setErr(""); if (input.current) input.current.value = ""; };

  if (done) return (
    <div className="card snap" style={{ textAlign: "center", alignItems: "center" }}>
      <div style={{ fontSize: 44 }} aria-hidden="true">✅</div>
      <h3>Ticket WO-{done.number} filed</h3>
      <div className="hint">The team has your photo. Target: within {done.sla < 24 ? `${done.sla} hours` : `${done.sla / 24} day${done.sla > 24 ? "s" : ""}`}. We&apos;ll update you here and by SMS po.</div>
      {read?.advice && <div className="twin-warn watch" style={{ textAlign: "left" }}><b>While you wait:</b> {read.advice}</div>}
      <div className="row" style={{ gap: 8, justifyContent: "center" }}><Link href="/my" className="btn pri">See ticket status</Link><button className="btn" onClick={reset}>Report another</button></div>
    </div>
  );

  return (
    <div className="card snap">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <div className={"snap-drop" + (photo ? " has" : "") + (busy === "reading" ? " scanning" : "")}>
        {photo ? <img src={photo} alt="Your photo" /> : (
          <>
            <div style={{ fontSize: 40 }} aria-hidden="true">📷</div>
            <b style={{ fontSize: 16 }}>Take a photo of the problem</b>
            <div className="hint">A leak, a broken light, a crack, anything. {ai ? "AI reads the photo and fills in the ticket." : "We file the ticket from your photo and a few words."}</div>
            <button className="btn pri" onClick={() => input.current?.click()}>Open camera</button>
          </>
        )}
      </div>

      {photo && !read && (
        <>
          <div className="snap-result"><div className="field">
            <label htmlFor="cap">A few words {ai ? "(optional)" : "(helps us sort it)"}</label>
            <input id="cap" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Tumutulo sa ceiling ng CR" />
          </div></div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn pri" style={{ flex: 1 }} onClick={analyze} disabled={busy !== ""}>{busy === "reading" ? (ai ? "AI is looking at your photo…" : "Reading…") : "Continue"}</button>
            <button className="btn" onClick={() => input.current?.click()} disabled={busy !== ""}>Retake</button>
          </div>
        </>
      )}

      {read && (
        <div className="snap-result">
          <div className="twin-warn watch"><span className="ai-badge">{read.ai ? "AI saw" : "Got it"}</span> {read.seen}{!read.confident && " Please check the details below."}</div>
          {read.priority === "HIGH" && <div className="twin-warn bad"><b>Urgent.</b> {read.advice}</div>}
          <div className="field"><label htmlFor="t">What&apos;s wrong</label><input id="t" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="c">Type</label>
              <select id="c" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="w">Where</label>
              <select id="w" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                {units.map((c) => <option key={c} value={c}>Unit {c}</option>)}
                {COMMON.map((c) => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="field"><label>How urgent</label>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <button key={p} type="button" className={"chip" + (form.priority === p ? " on" : "")} onClick={() => setForm({ ...form, priority: p })}>{PRI_WORD[p]}</button>
            ))}</div></div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn pri" style={{ flex: 1 }} onClick={send} disabled={busy !== "" || form.title.trim().length < 3}>{busy === "sending" ? "Sending…" : "Send to the team"}</button>
            <button className="btn" onClick={reset} disabled={busy !== ""}>Start over</button>
          </div>
        </div>
      )}
      {err && <div className="twin-warn bad" role="alert">{err}</div>}
    </div>
  );
}
