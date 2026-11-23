"use client";
// Phone remote for the 3D city map on the big screen. No sign-in: the code in the link is the key, and it expires in 3 hours.
import { useEffect, useState } from "react";
import { ASK_PRESETS } from "@/lib/remote";

const LAYERS: [string, string][] = [["mode:districts", "🏙️ Buildings"], ["mode:energy", "⚡ Energy"], ["mode:water", "💧 Water"], ["mode:alerts", "🚨 Alerts"], ["mode:grades", "🅰️ Report cards"], ["mode:future", "🔮 2030"]];

export default function Remote({ code }: { code: string }) {
  const [state, setState] = useState("Connecting…");
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let dead = false;
    const f = async () => {
      try {
        const r = await fetch(`/api/remote/${code}`, { cache: "no-store" });
        if (r.status === 404) { setGone(true); return; }
        const j = await r.json(); if (!dead) setState(j.state || "Connected");
      } catch { /* retry */ }
    };
    f(); const t = setInterval(f, 2000);
    return () => { dead = true; clearInterval(t); };
  }, [code]);
  async function send(cmd: string) {
    setBusy(cmd); setErr("");
    try {
      const r = await fetch(`/api/remote/${code}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cmd }) });
      if (r.status === 404) setGone(true); else if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Didn't go through. Try again.");
      if (navigator.vibrate) navigator.vibrate(20);
    } catch { setErr("No connection. Try again."); }
    setTimeout(() => setBusy(""), 350);
  }
  if (gone) return <main className="rm"><h1>📱 City map remote</h1><p className="rm-state">This remote code has expired. Tap 📱 on the big screen for a new QR code.</p></main>;
  const b = (cmd: string, label: string, cls = "") => <button key={cmd} className={"rm-b " + cls + (busy === cmd ? " hit" : "")} onClick={() => send(cmd)}>{label}</button>;
  return (
    <main className="rm">
      <h1>📱 City map remote</h1>
      <p className="rm-state"><i />On screen: <b>{state}</b></p>
      {err && <p className="rm-err">{err}</p>}
      <section className="rm-main">
        {b("present", "🎬 Start the story", "rm-cta wide")}
        {b("prev", "‹ Back")}
        {b("next", "Next ›", "rm-cta")}
        {b("mute", "🔊 Sound on / off")}
        {b("end", "✕ Stop")}
      </section>
      <h2>Drills</h2>
      <section>{b("storm:typhoon", "🌀 Typhoon")}{b("storm:heat", "🔥 Heatwave")}</section>
      <h2>Layers</h2>
      <section>{LAYERS.map(([c, l]) => b(c, l))}{b("reset", "⟲ Whole city")}</section>
      <h2>Ask the city</h2>
      <section className="rm-ask">{ASK_PRESETS.map((q, i) => b(`ask:${i}`, q))}</section>
      <p className="rm-note">Sample data on a real map · Building Management AI</p>
    </main>
  );
}
