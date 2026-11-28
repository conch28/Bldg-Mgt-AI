"use client";
// Extra demo features for the 3D city map: talk to the city, storm simulator, A to F report cards,
// the 2030 view, client branding, the live impact counter and the phone remote. All numbers are sample data.
import { useEffect, useRef, useState } from "react";
import { TARIFF, EF, type Kind } from "@/lib/nccCity";
import { ASK_PRESETS, type ClientKey } from "@/lib/remote";

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const peso = (v: number) => (v >= 1e9 ? `₱${n1(v / 1e9)}B` : v >= 1e6 ? `₱${n1(v / 1e6)}M` : v >= 1e4 ? `₱${n0(v / 1e3)}k` : `₱${n0(v)}`);
const mw = (kw: number) => (kw >= 1000 ? `${n1(kw / 1000)} MW` : `${n0(kw)} kW`);

// ---------- client branding ----------
export type { ClientKey };
export const CLIENTS: Record<ClientKey, { name: string; full: string; accent: string; hello: string; close: string }> = {
  bcda: { name: "BCDA", full: "New Clark City and Clark", accent: "#19a974",
    hello: "Good day, BCDA. This is New Clark City, all the way down to Clark Freeport, as it could run with AI.",
    close: "For BCDA: lower bills, cleaner air, steady water, and happier residents across New Clark City and Clark." },
  pax: { name: "Pax Silica", full: "the Pax Silica AI hub", accent: "#00c2b2",
    hello: "Good day, Pax Silica team. This is your AI hub inside New Clark City, and the city around it, as it could run with AI.",
    close: "For Pax Silica: a greener AI hub, lower power and water per server, and a city that runs smarter around it." },
};

export function BrandSplash({ c, onDone }: { c: ClientKey; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3600); return () => clearTimeout(t); }, [onDone]);
  const b = CLIENTS[c];
  const date = new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="cm-splash" onClick={onDone}>
      <small>Prepared for</small>
      <b style={{ color: b.accent }}>{b.name}</b>
      <span>{b.full} · {date}</span>
      <em>Building Management AI · sample data on a real map</em>
    </div>
  );
}

// ---------- live impact counter ----------
/** Pesos, CO₂, trees and homes, all counting up live from midnight in Manila at the sample daily rate. */
export function Impact({ day, className }: { day: { peso: number; kwh: number; co2: number }; className?: string }) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const f = (((now.getUTCHours() + 8) % 24) * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000) / 86400;
      const el = r.current;
      if (el) {
        const set = (k: string, v: string) => { const x = el.querySelector(`[data-k="${k}"]`); if (x) x.textContent = v; };
        set("p", "₱" + (day.peso * f).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        set("c", n0(day.co2 * 1000 * f) + " kg");
        set("t", n0((day.co2 * f) / 0.022 * 30 / 365 * 12)); // trees: a tree takes up about 22 kg of CO₂ a year
        set("h", n0((day.kwh * f) / (200 / 30))); // a Filipino home uses about 200 kWh a month
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [day.peso, day.co2, day.kwh]);
  return (
    <div className={"cm-impact " + (className ?? "")} ref={r} aria-live="off">
      <div><b data-k="p">₱0</b><small>saved today</small></div>
      <div><b data-k="c">0 kg</b><small>CO₂ avoided</small></div>
      <div><b data-k="t">0</b><small>🌳 trees' worth</small></div>
      <div><b data-k="h">0</b><small>🏠 homes powered for a day</small></div>
    </div>
  );
}

// ---------- A to F report cards ----------
export const GRADE = ["A", "B", "C", "D", "F"] as const;
export const GRADE_COLOR = ["#1a9850", "#91cf60", "#f4d35e", "#fc8d59", "#d73027"];
/** Grade cut-offs by percentile of energy use per m² among buildings of the same type. */
export const gradeOf = (pct: number) => (pct < 0.12 ? 0 : pct < 0.37 ? 1 : pct < 0.67 ? 2 : pct < 0.87 ? 3 : 4);
export type Fix = { t: string; how: string; month: number; cost: number; payback: number };
const COOLED: Kind[] = ["civic", "school", "retail", "hotel", "datahall", "sports", "transport", "apartment"];
export function fixesFor(o: { kind: Kind; kwhDay: number; m3Day: number; floor: number; roofKwp: number; solarKwp: number }): Fix[] {
  const k = o.kind, fl = Math.max(50, o.floor), list: Omit<Fix, "payback">[] = [];
  const kwhM = (f: number) => o.kwhDay * f * 30 * TARIFF;
  if (COOLED.includes(k)) {
    list.push({ t: "Smart cooling schedule", how: "AI pre-cools on cheap power and raises the setpoint by 1°C in common areas.", month: kwhM(0.09), cost: fl * 35 });
    list.push({ t: "LED lights with motion sensors", how: "Hallways, car parks and stairs light up only when someone is there.", month: kwhM(0.05), cost: fl * 140 });
  } else if (k === "industrial") {
    list.push({ t: "Fix compressed-air leaks", how: "An ultrasonic sweep finds the hissing joints; most fixes are a new fitting.", month: kwhM(0.07), cost: fl * 18 });
    list.push({ t: "Variable-speed drives on pumps and fans", how: "Motors slow down when demand drops instead of running flat out.", month: kwhM(0.1), cost: fl * 85 });
  } else {
    list.push({ t: "Inverter aircon swap", how: "Replaces the oldest window units; the AI picks the ones running hottest.", month: kwhM(0.18), cost: 38000 * Math.max(1, Math.round(fl / 120)) });
    list.push({ t: "LED lights", how: "Swap the remaining old bulbs and tubes.", month: kwhM(0.04), cost: fl * 25 });
  }
  const kwp = Math.max(0, Math.min(o.roofKwp, o.kwhDay / 4) * 0.8 - o.solarKwp);
  if (kwp >= 2) list.push({ t: `Rooftop solar, ${n0(kwp)} kWp`, how: "Panels on the free roof space, sized to what the building uses by day.", month: kwp * 3.8 * 30 * TARIFF, cost: kwp * 42000 });
  if (o.m3Day > 0.5) list.push({ t: "Leak sensors and low-flow fixtures", how: "Night-flow alerts plus aerators and dual-flush valves.", month: o.m3Day * 0.15 * 30 * 55, cost: fl * 22 });
  return list.filter((x) => x.month > 50).map((x) => ({ ...x, payback: x.cost / x.month })).sort((a, b) => a.payback - b.payback).slice(0, 3);
}
const payWord = (m: number) => (m < 1.5 ? "about a month" : m < 24 ? `${Math.round(m)} months` : `${n1(m / 12)} years`);
export function ReportCard({ name, kindLabel, district, grade, rank, of, eui, fixes, onClose }: { name: string; kindLabel: string; district: string; grade: number; rank: number; of: number; eui: number; fixes: Fix[]; onClose: () => void }) {
  const tot = fixes.reduce((s, f) => s + f.month, 0);
  return (
    <div className="cm-report" role="dialog" aria-label="Green report card">
      <button className="cm-x" onClick={onClose} aria-label="Close">✕</button>
      <div className="cm-rep-h">
        <div className="cm-grade" style={{ background: GRADE_COLOR[grade] }}>{GRADE[grade]}</div>
        <div><small>Green report card · sample</small><b>{name}</b><span>{kindLabel} · {district}</span></div>
      </div>
      <div className="cm-rep-k">
        <div><b>{n0(eui)}</b><small>kWh per m² a year</small></div>
        <div><b>#{rank}</b><small>of {n0(of)} of this type in the area</small></div>
        <div><b>{peso(tot * 12)}</b><small>a year from 3 fixes</small></div>
      </div>
      <ol className="cm-fixes">
        {fixes.map((f, k) => <li key={f.t}><span>{k + 1}</span><div><b>{f.t}</b><small>{f.how}</small><em>Saves {peso(f.month)} a month · costs {peso(f.cost)} · pays back in {payWord(f.payback)}</em></div></li>)}
      </ol>
      <div className="cm-scale">{GRADE.map((g, k) => <i key={g} className={k === grade ? "on" : ""} style={{ background: GRADE_COLOR[k] }}>{g}</i>)}</div>
    </div>
  );
}

// ---------- 2030 ----------
export const YEAR0 = 2026, YEAR1 = 2030;
export const futureShare = (year: number) => 0.02 + ((year - YEAR0) / (YEAR1 - YEAR0)) * 0.43;
export const EV_2030 = 1500, TREES_2030 = 25000;
export function FuturePanel({ year, setYear, playing, onPlay, solarMw, co2Cut }: { year: number; setYear: (y: number) => void; playing: boolean; onPlay: () => void; solarMw: number; co2Cut: number }) {
  const t = (year - YEAR0) / (YEAR1 - YEAR0);
  return (
    <div className="cm-side cm-future">
      <small className="cm-kick">The city in {Math.floor(year)} · sample plan</small>
      <div className="cm-year">{Math.floor(year)}</div>
      <input type="range" min={YEAR0} max={YEAR1} step={0.05} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year" />
      <div className="cm-yrs">{[2026, 2027, 2028, 2029, 2030].map((y) => <span key={y}>{y}</span>)}</div>
      <button className="cm-btn cm-cta" onClick={onPlay}>{playing ? "❚❚ Pause" : year >= YEAR1 ? "⟲ Play again" : "▶ Play to 2030"}</button>
      <div className="cm-fstats">
        <div><b style={{ color: "#ffd60a" }}>{Math.round(futureShare(year) * 100)}%</b><small>☀️ roofs with solar</small></div>
        <div><b style={{ color: "#ffd60a" }}>{n1(solarMw)} MW</b><small>rooftop solar</small></div>
        <div><b style={{ color: "#3ff2ff" }}>{n0(EV_2030 * t)}</b><small>⚡ EV chargers</small></div>
        <div><b style={{ color: "#51cf66" }}>{n0(TREES_2030 * t)}</b><small>🌳 new trees</small></div>
        <div className="wide"><b>{n0(co2Cut)} t</b><small>CO₂ cut a year versus 2026</small></div>
      </div>
    </div>
  );
}

// ---------- storm simulator ----------
export type StormKind = "typhoon" | "heat";
export type StormStep = { at: number; clock: string; title: string; act: string; icon: string };
export const STORM_STEPS: Record<StormKind, StormStep[]> = {
  typhoon: [
    { at: 0, clock: "48 hours before", icon: "📡", title: "Signal No. 3 forecast", act: "PAGASA track crosses Tarlac and Pampanga. The AI switches every building to typhoon mode." },
    { at: 0.14, clock: "36 hours before", icon: "⛽", title: "Generators fuelled to 100%", act: "Diesel ordered for 14 sites, tested under load. Lifts get a parking floor above flood level." },
    { at: 0.28, clock: "12 hours before", icon: "🚗", title: "Basements cleared, sandbags up", act: "Residents told by Messenger and Viber to move cars up. Sandbags at 6 low entrances." },
    { at: 0.45, clock: "Landfall", icon: "🌀", title: "Grid drops at Clark", act: "23 buildings switch to generator in 4 seconds. Water pumps on standby power." },
    { at: 0.62, clock: "6 hours after", icon: "🌊", title: "Flood peaks in the lowlands", act: "Red buildings sit below the water line. Sump pumps run, and guards check every basement with photos." },
    { at: 0.8, clock: "24 hours after", icon: "✅", title: "All clear", act: "96% of residents checked in safe by app. Damage tickets already sorted by urgency for the contractors." },
  ],
  heat: [
    { at: 0, clock: "5:00 AM", icon: "🌡️", title: "Heat index 46°C forecast", act: "The AI plans the day around a 2 PM peak and a grid warning from the operator." },
    { at: 0.18, clock: "5:30 AM", icon: "❄️", title: "Pre-cool while power is cheap", act: "Offices, malls and schools chill down early, storing cool in the building itself." },
    { at: 0.38, clock: "10:00 AM", icon: "🔌", title: "Shift what can wait", act: "EV charging, pool pumps and laundry move to the night. Common areas go up by 1°C." },
    { at: 0.58, clock: "2:00 PM", icon: "🔥", title: "The peak, flattened", act: "Rooftop solar covers the top of the curve. No brownout, and no one sweating in a lobby." },
    { at: 0.8, clock: "4:00 PM", icon: "💧", title: "Water and people checked", act: "Pressure checks on the top floors. Cooling stations open in lobbies, and seniors get a call." },
  ],
};
export function StormPanel({ kind, t, running, onRun, onPick, hud }: { kind: StormKind | null; t: number; running: boolean; onRun: () => void; onPick: (k: StormKind) => void; hud: { k: string; v: string; hot?: boolean }[] }) {
  const steps = kind ? STORM_STEPS[kind] : [];
  const cur = steps.reduce((a, s, i) => (t >= s.at ? i : a), -1);
  return (
    <div className={"cm-side cm-storm" + (kind === "heat" ? " heat" : "")}>
      <small className="cm-kick">Disaster drill · simulation with sample data</small>
      <div className="cm-storm-pick">
        <button className={"cm-btn" + (kind === "typhoon" ? " on" : "")} onClick={() => onPick("typhoon")}>🌀 Typhoon</button>
        <button className={"cm-btn" + (kind === "heat" ? " on" : "")} onClick={() => onPick("heat")}>🔥 Heatwave</button>
      </div>
      {kind && <>
        <button className="cm-btn cm-cta cm-run" onClick={onRun}>{running ? "❚❚ Pause" : t > 0 && t < 1 ? "▶ Resume" : "▶ Run the drill"}</button>
        <div className="cm-storm-hud">{hud.map((h) => <div key={h.k} className={h.hot ? "hot" : ""}><b>{h.v}</b><small>{h.k}</small></div>)}</div>
        <ol className="cm-storm-steps">
          {steps.map((s, i) => <li key={s.title} className={i < cur ? "done" : i === cur ? "on" : ""}><span>{s.icon}</span><div><small>{s.clock}</small><b>{s.title}</b>{i <= cur && <p>{s.act}</p>}</div></li>)}
        </ol>
        <div className="cm-prog"><i style={{ width: `${Math.round(t * 100)}%`, animation: "none" }} /></div>
      </>}
    </div>
  );
}

// ---------- talk to the city ----------
export { ASK_PRESETS };
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function AskCity({ onAsk, answer, busy, onClose }: { onAsk: (q: string) => void; answer: { q: string; a: string } | null; busy: boolean; onClose: () => void }) {
  const [q, setQ] = useState(""); const [heard, setHeard] = useState(""); const [listening, setListening] = useState(false); const [err, setErr] = useState("");
  const rec = useRef<SR | null>(null);
  const can = typeof window !== "undefined" && !!getSR();
  function listen() {
    const C = getSR(); if (!C) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new C(); rec.current = r; r.lang = "en-PH"; r.interimResults = true; r.continuous = false; setErr(""); setHeard("");
    r.onresult = (e) => { let txt = "", fin = false; for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) fin = true; } setHeard(txt); if (fin) { onAsk(txt); setHeard(""); } };
    r.onend = () => setListening(false);
    r.onerror = (e) => { setListening(false); setErr(e.error === "not-allowed" ? "Microphone blocked. Allow it in the browser, or tap a question below." : "Didn't catch that. Try again, or tap a question below."); };
    try { r.start(); setListening(true); } catch { setListening(false); }
  }
  return (
    <div className="cm-ask" role="dialog" aria-label="Ask the city">
      <div className="cm-ask-h"><b>🎙️ Ask the city</b><small>Built-in answers from the map's sample data</small><button className="cm-x" onClick={onClose} aria-label="Close">✕</button></div>
      {answer && <div className="cm-ask-a" key={answer.q}><small>“{answer.q}”</small><p>{answer.a}</p></div>}
      <form className="cm-ask-f" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onAsk(q.trim()); setQ(""); } }}>
        {can && <button type="button" className={"cm-mic" + (listening ? " on" : "")} onClick={listen} aria-label={listening ? "Stop listening" : "Speak a question"}>{listening ? "■" : "🎙️"}</button>}
        <input value={listening ? heard || "Listening…" : q} onChange={(e) => setQ(e.target.value)} placeholder={can ? "Tap the mic and ask, or type…" : "Type a question…"} aria-label="Your question" readOnly={listening} />
        <button className="cm-btn cm-cta" disabled={busy || listening}>Ask</button>
      </form>
      {err && <small className="cm-ask-err">{err}</small>}
      <div className="cm-ask-chips">{ASK_PRESETS.map((p) => <button key={p} className="chip" onClick={() => onAsk(p)}>{p}</button>)}</div>
    </div>
  );
}

// ---------- phone remote ----------
export function RemotePanel({ code, onClose }: { code: string; onClose: () => void }) {
  const [img, setImg] = useState("");
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";
  useEffect(() => { let ok = true; import("qrcode").then((Q) => Q.toDataURL(url, { margin: 1, width: 360 })).then((d) => { if (ok) setImg(d); }).catch(() => {}); return () => { ok = false; }; }, [url]);
  return (
    <div className="cm-remote" role="dialog" aria-label="Phone remote">
      <button className="cm-x" onClick={onClose} aria-label="Close">✕</button>
      <b>📱 Use your phone as the remote</b>
      <p>Scan with your phone camera. Then start the story, change chapters and run the drills from your hand while the map plays on the big screen.</p>
      {img ? <img src={img} alt="QR code for the phone remote" width={180} height={180} /> : <div className="cm-qr-wait" />}
      <code>{url.replace(/^https?:\/\//, "")}</code>
      <small>Works for 3 hours. Anyone with this code can control this screen, so only show it in the room.</small>
    </div>
  );
}

export { peso as pesoShort, mw as mwShort, EF as EF_T };
