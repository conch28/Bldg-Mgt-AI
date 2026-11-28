"use client";
// Presenter mode for the 3D city map: a one-tap, narrated, cinematic story for client pitches.
// Every number shown is sample data from the map's own sample metrics, and each screen says so.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CityAlert } from "@/lib/nccCity";

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const mw = (kw: number) => (kw >= 1000 ? `${n1(kw / 1000)} MW` : `${n0(kw)} kW`);
const pesoBig = (v: number) => (v >= 1e9 ? `₱${n1(v / 1e9)}B` : v >= 1e6 ? `₱${n1(v / 1e6)}M` : `₱${n0(v)}`);

export type DaySavings = { peso: number; kwh: number; m3: number; co2: number };
export type Hud = "intro" | "power" | "water" | "leak" | "data" | "before" | "storm" | "future" | "replay" | "end";
export type Chapter = { id: Hud; kicker: string; title: string; text: string; say: string; dur: number };

export function chapters(o: { buildings: number; day: DaySavings; leak?: CityAlert; client?: { hello: string; close: string } }): Chapter[] {
  const month = o.day.peso * 30;
  return [
    { id: "intro", kicker: "New Clark City → Clark Freeport", title: "One city. Every building. One AI.", dur: 11,
      text: `${o.buildings ? n0(o.buildings) : "Thousands of"} real buildings across 20 km, watched for every kilowatt and every litre.`,
      say: (o.client ? o.client.hello + " " : "This is New Clark City, all the way down to Clark Freeport. ") + "Every building you see is real map data, and our AI watches every kilowatt and every litre." },
    { id: "power", kicker: "Power, live", title: "6:30 PM. The evening peak.", dur: 11,
      text: "Glowing lines show power streaming along the main roads. Buildings pulsing red are using the most for their size.",
      say: "Six thirty in the evening, the peak, when power is dirtiest and most expensive. The glowing lines show power streaming into every district, and the buildings pulsing red are using the most." },
    { id: "water", kicker: "Water, live", title: "Every litre, traced.", dur: 9,
      text: "Blue streams follow supply through the city. The darkest buildings drink the most per square metre.",
      say: "Water tells its own story. Blue streams trace supply through the city, and the darkest buildings drink the most for their size." },
    { id: "leak", kicker: "Found in real time", title: o.leak ? o.leak.title : "A leak, caught at night", dur: 15,
      text: o.leak ? `${o.leak.where}. ${o.leak.detail}` : "Night flow that should be zero is not.",
      say: "Two in the morning. The pool should be still, but the AI sees water flowing all night at the Aquatics Center. It pinpoints the stuck valve and sends the contractor a ticket, before anyone wakes up." },
    { id: "data", kicker: "Always up to date", title: "A fresh reading every 15 minutes.", dur: 12,
      text: "Clip-on meters and LoRaWAN radios report every 15 minutes. Guard photos and bills, read by AI, fill the gaps. Every reading is checked, and urgent alerts land within 5 minutes.",
      say: "How does it stay current? Clip-on meters and low-power radios report every fifteen minutes. Guard photos and bills, read by AI, fill the gaps. Every reading is checked, and urgent alerts land within five minutes." },
    { id: "before", kicker: "Before and after", title: "Now let the AI take over.", dur: 13,
      text: "Pre-cooling on solar, lights off on schedule, chillers tuned. Watch the heat drop away.",
      say: "Now watch what happens when the AI takes over. Pre-cooling on solar, lights off on schedule, chillers tuned. The heat drops away, and so does the bill." },
    { id: "storm", kicker: "Typhoon drill · simulation", title: "Ready before the storm.", dur: 14,
      text: "Rain, lightning and rising water in the lowlands. Red buildings sit below the flood line. The AI fuels generators, parks lifts up high and messages every resident.",
      say: "And when a typhoon comes, the AI gets ready two days early. Generators fuelled, lifts parked above the water, cars moved out of basements, and every resident messaged. The red buildings are the ones that would flood." },
    { id: "future", kicker: "The city in 2030 · sample plan", title: "Then we build the future.", dur: 12,
      text: "Solar on almost half the roofs, EV chargers along every main road, and twenty-five thousand new trees.",
      say: "And then we build the future. By 2030, solar on almost half the roofs, chargers along every main road, and twenty-five thousand new trees." },
    { id: "replay", kicker: "30 days, replayed", title: "Savings that stack up.", dur: 11,
      text: "Day after day, building by building.",
      say: "Thirty days later, the savings have stacked up, day after day, building by building." },
    { id: "end", kicker: "Building Management AI", title: `${pesoBig(month)} a month back to Clark.`, dur: 0,
      text: `${n0(o.day.co2 * 30)} t of CO₂ avoided, ${n0(o.day.m3 * 30)} m³ of water saved, and cooler, happier residents.`,
      say: o.client ? o.client.close + " That's Building Management AI." : "Lower bills, cleaner air, steady water, and happier residents. That's Building Management AI, for New Clark City and Clark." },
  ];
}

// ---------- narration (free, in the browser; no key needed) ----------
let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (voice !== undefined || typeof speechSynthesis === "undefined") return voice ?? null;
  const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  const pref = ["en-PH", "en-GB", "en-AU", "en-US"];
  voice = vs.find((v) => v.lang === "en-PH") ?? vs.find((v) => /Google UK English Female|Samantha|Karen|Moira/i.test(v.name))
    ?? pref.map((l) => vs.find((v) => v.lang === l)).find(Boolean) ?? vs.find((v) => v.lang.startsWith("en")) ?? null;
  return voice;
}
export function say(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
  u.rate = 1.0; u.pitch = 1.0;
  speechSynthesis.speak(u);
}
export function hush() { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }

// ---------- live savings ticker ----------
/** Counts up in real time at the sample daily rate, starting from what was saved since midnight in Manila. */
export function Ticker({ perDay, className, label }: { perDay: number; className?: string; label?: string }) {
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const s = ((now.getUTCHours() + 8) % 24) * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000;
      if (el.current) el.current.textContent = "₱" + (perDay * (s / 86400)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [perDay]);
  return <span className={className}><b ref={el} className="num" />{label && <small>{label}</small>}</span>;
}

/** A number that rolls to its new value. */
function Roll({ v, fmt }: { v: number; fmt: (x: number) => string }) {
  const [shown, setShown] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 3); const x = a + (v - a) * e; setShown(x); from.current = x; if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <>{fmt(shown)}</>;
}

// ---------- HUDs ----------
export function LeakHud({ a, show }: { a: CityAlert; show: boolean }) {
  // Night flow trace from the alert text: normal 0.3 m³/h, then 2.1 m³/h from 2:10 AM.
  const pts = useMemo(() => Array.from({ length: 48 }, (_, i) => { const h = i / 2; const leak = h >= 2.17 && h < 8; return 0.3 + (leak ? 1.8 : 0) + Math.sin(i * 1.7) * 0.06 + (h > 6 && h < 9 ? 0.5 : 0); }), []);
  const max = 3;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / 47) * 220},${60 - (v / max) * 56}`).join(" ");
  return (
    <>
      <div className={"cm-reticle" + (show ? " on" : "")} aria-hidden="true"><i /><i /><i /><i /><b /></div>
      <div className={"cm-hud cm-leak" + (show ? " on" : "")} role="status">
        <div className="cm-hud-k"><span className="cm-blink" />AI detected · 2:10 AM · sample alert</div>
        <b>{a.where}</b>
        <svg viewBox="0 0 220 62" className="cm-spark" aria-label="Night water flow, cubic metres an hour"><path d={d} /><line x1={(2.17 / 24) * 220} x2={(2.17 / 24) * 220} y1="0" y2="62" /></svg>
        <small>Night flow 2.1 m³/h · normal 0.3 m³/h</small>
        <p>🤖 {a.ai}</p>
        <div className="cm-hud-save">Saves <b>{a.saving}</b></div>
      </div>
    </>
  );
}

export function BeforeHud({ aiOn, kwBase, kwAi, perDay }: { aiOn: boolean; kwBase: number; kwAi: number; perDay: number }) {
  return (
    <div className={"cm-hud cm-before on" + (aiOn ? " ai" : "")} role="status">
      <div className="cm-ba"><span className={aiOn ? "" : "on"}>Without AI</span><span className={aiOn ? "on" : ""}>With AI</span></div>
      <b className="num cm-big"><Roll v={aiOn ? kwAi : kwBase} fmt={mw} /></b>
      <small>power use across the map right now (sample)</small>
      <div className={"cm-delta" + (aiOn ? " on" : "")}>−{mw(kwBase - kwAi)} · −{n1((1 - kwAi / Math.max(1, kwBase)) * 100)}% · {pesoBig(perDay)} a day</div>
    </div>
  );
}

export function ReplayHud({ day, dur }: { day: DaySavings; dur: number }) {
  const [t, setT] = useState(0);
  useEffect(() => { const t0 = performance.now(); let raf = 0; const f = (x: number) => { const k = Math.min(1, (x - t0) / (dur * 1000 * 0.85)); setT(k); if (k < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [dur]);
  // Weekdays save more than weekends; a little day-to-day noise. Sums to 30 × the daily figure.
  const shape = useMemo(() => { const w = Array.from({ length: 30 }, (_, i) => (i % 7 === 5 || i % 7 === 6 ? 0.78 : 1.08) * (0.92 + 0.16 * Math.abs(Math.sin(i * 12.9898)))); const s = w.reduce((a, b) => a + b, 0); return w.map((x) => (x * 30) / s); }, []);
  const days = t * 30, full = Math.floor(days);
  let k = 0; for (let i = 0; i < 30; i++) k += shape[i] * Math.max(0, Math.min(1, days - i));
  const mx = Math.max(...shape);
  return (
    <div className="cm-hud cm-replay on" role="status">
      <div className="cm-hud-k">Day {Math.min(30, full + 1)} of 30 · sample data</div>
      <b className="num cm-big">{pesoBig(day.peso * k)}</b>
      <small>saved on power and water bills</small>
      <div className="cm-bars" aria-hidden="true">{shape.map((v, i) => <i key={i} style={{ height: `${(v / mx) * 100 * Math.max(0, Math.min(1, days - i))}%` }} />)}</div>
      <div className="cm-rgrid">
        <div><b className="num">{n0((day.kwh * k) / 1000)}</b><span>MWh saved</span></div>
        <div><b className="num">{n0(day.m3 * k)}</b><span>m³ water</span></div>
        <div><b className="num">{n0(day.co2 * k)}</b><span>t CO₂</span></div>
      </div>
    </div>
  );
}

export function EndCard({ c, day, onReplay, onExplore }: { c: Chapter; day: DaySavings; onReplay: () => void; onExplore: () => void }) {
  return (
    <div className="cm-end" role="dialog" aria-label="Summary">
      <small className="cm-kick">{c.kicker}</small>
      <h2>{c.title}</h2>
      <div className="cm-end-grid">
        <div><b className="num">{pesoBig(day.peso * 30)}</b><span>saved a month</span></div>
        <div><b className="num">{n0((day.kwh * 30) / 1000)} MWh</b><span>less power</span></div>
        <div><b className="num">{n0(day.m3 * 30)} m³</b><span>water saved</span></div>
        <div><b className="num">{n0(day.co2 * 30)} t</b><span>CO₂ avoided</span></div>
      </div>
      <div className="cm-equiv">
        <span>🌳 Like <b>{n0((day.co2 * 30) / 0.022)}</b> trees growing for a year</span>
        <span>🏠 Enough power for <b>{n0((day.kwh * 30) / 200)}</b> Filipino homes for a month</span>
        <span>🚿 <b>{n0((day.m3 * 30 * 1000) / 150 / 30)}</b> people's daily water, every day</span>
      </div>
      <p>Our ultimate goal: happier residents, through innovation and heartfelt service.</p>
      <div className="row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="cm-btn cm-cta" onClick={onReplay}>↻ Play again</button>
        <button className="cm-btn" onClick={onExplore}>Explore the map</button>
      </div>
      <small className="cm-end-note">Real map data. Energy, water, savings and alerts are sample data for this demo.</small>
    </div>
  );
}

// ---------- "every 15 minutes" data path ----------
const PATH: [string, string, string][] = [
  ["📟", "Meters", "Clip-on, pulse and camera readers; guard photos; bills"],
  ["📡", "LoRaWAN", "Low-power radio to zone gateways, every 15 min"],
  ["🧪", "Checks", "Range, spikes, sub-meters vs main, AI read confidence"],
  ["🤖", "AI", "Compares every building with its own normal"],
  ["🔔", "Alert", "Owner notified within 5 minutes"],
];
export function DataHud() {
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((x) => (x + 1) % (PATH.length + 2)), 1100); return () => clearInterval(t); }, []);
  return (
    <div className="cm-hud cm-data on" role="status">
      <div className="cm-hud-k cm-ok"><span className="cm-blink" />Live data path · 96 readings a day per meter</div>
      <ol className="cm-path">{PATH.map(([i, t, d], n) => <li key={t} className={n <= k ? "on" : ""}><span>{i}</span><div><b>{t}</b><small>{d}</small></div></li>)}</ol>
      <div className="cm-hud-save">Data health: <b>98.7%</b> of readings on time today <small>(sample)</small></div>
    </div>
  );
}
