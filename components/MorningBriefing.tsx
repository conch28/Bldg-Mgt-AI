"use client";
import { useEffect, useRef, useState } from "react";
import { getBriefing } from "@/app/(app)/today/actions";

/** AI morning briefing as a voice note: written on the server, spoken by the phone's own voice (free, offline-capable). */
export default function MorningBriefing() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [text, setText] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [idx, setIdx] = useState(-1);
  const [canSpeak, setCanSpeak] = useState(true);
  const queue = useRef<string[]>([]);
  const stopped = useRef(false);

  useEffect(() => {
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { stopped.current = true; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
  }, []);

  const voice = () => {
    const vs = window.speechSynthesis.getVoices();
    return vs.find((v) => v.lang === "en-PH") ?? vs.find((v) => /en-(GB|AU|US)/.test(v.lang) && /natural|google|samantha|daniel|karen/i.test(v.name)) ?? vs.find((v) => v.lang.startsWith("en"));
  };

  function speakFrom(i: number) {
    const s = queue.current;
    if (stopped.current || i >= s.length) { setState("idle"); setIdx(-1); return; }
    const u = new SpeechSynthesisUtterance(s[i]);
    const v = voice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 1.02; u.pitch = 1;
    u.onstart = () => setIdx(i);
    u.onend = () => speakFrom(i + 1);
    u.onerror = () => { setState("idle"); setIdx(-1); };
    window.speechSynthesis.speak(u);
  }

  async function play() {
    if (state === "playing") { window.speechSynthesis.pause(); setState("paused"); return; }
    if (state === "paused") { window.speechSynthesis.resume(); setState("playing"); return; }
    stopped.current = false;
    let t = text;
    if (!t) {
      setState("loading");
      try { const r = await getBriefing(); t = r.text; setText(r.text); setAi(r.ai); }
      catch { setState("idle"); return; }
    }
    // speak sentence by sentence: avoids the long-utterance cut-off in some browsers and lets us highlight
    queue.current = t!.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    if (!canSpeak) { setState("idle"); return; }
    window.speechSynthesis.cancel();
    setState("playing");
    speakFrom(0);
  }
  function stop() { stopped.current = true; window.speechSynthesis.cancel(); setState("idle"); setIdx(-1); }

  const sentences = text ? text.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean) : [];
  return (
    <div className="card brief">
      <div className="brief-top">
        <button className="brief-play" onClick={play} aria-label={state === "playing" ? "Pause briefing" : "Play morning briefing"} disabled={state === "loading"}>
          {state === "playing"
            ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="ai-badge">AI voice note</span>
          <h3 style={{ marginTop: 2 }}>Your morning briefing</h3>
          <div className="hint">{state === "loading" ? "Writing today's briefing…" : state === "playing" ? "Playing. Listen while you walk the building." : text ? (ai ? "Written by AI from today's data" : "Built from today's data") : "One minute, hands-free: what needs you today"}</div>
        </div>
        {state !== "idle" && state !== "loading" && <button className="btn sm" onClick={stop}>Stop</button>}
      </div>
      <div className={"wave" + (state === "playing" ? " on" : "")} aria-hidden="true">
        {Array.from({ length: 64 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 37) % 900}ms`, height: `${20 + ((i * 53) % 60)}%` }} />)}
      </div>
      {text && (
        <details open={state !== "idle" || !canSpeak}>
          <summary className="hint" style={{ cursor: "pointer" }}>Read the transcript</summary>
          <p className="brief-text">{sentences.map((s, i) => <span key={i} style={i === idx ? { background: "var(--accent-soft)", borderRadius: 4 } : undefined}>{s} </span>)}</p>
        </details>
      )}
      {!canSpeak && <div className="hint">This browser can&apos;t read aloud, so here is the text.</div>}
    </div>
  );
}
