"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SITES, type SiteKey, type Site, type Hour, type Leak, simulateDay, summarize, actionValue, defaultOn, history, plan, SOLAR_YIELD, CAPEX, TREE_KG_YEAR, tou,
} from "@/lib/green";

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const pShort = (v: number) => { const a = Math.abs(v); const s = v < 0 ? "-" : ""; return a >= 1e9 ? `${s}₱${n1(a / 1e9)}B` : a >= 1e6 ? `${s}₱${n1(a / 1e6)}M` : a >= 1e4 ? `${s}₱${n0(a / 1e3)}k` : `${s}₱${n0(a)}`; };
const kw = (v: number) => (v >= 1000 ? `${n1(v / 1000)} MW` : `${n0(v)} kW`);
const kwh = (v: number) => (v >= 10000 ? `${n1(v / 1000)} MWh` : `${n0(v)} kWh`);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const C = { solar: "#e6a700", batt: "#8a63d2", grid: "#7b8a87", load: "var(--accent)", water: "#3f7fd1", ok: "var(--ok)" };

const SECTIONS = [["live", "Live"], ["ai", "AI actions"], ["water", "Water"], ["carbon", "Carbon"], ["people", "People"], ["certs", "Green ratings"], ["plan", "Planner"]] as const;

export default function GreenDashboard({ siteKey, briefing, aiWritten, canSwitch }: { siteKey: SiteKey; briefing: string; aiWritten: boolean; canSwitch: boolean }) {
  const site = SITES[siteKey];
  const [on, setOn] = useState<Set<string>>(() => defaultOn(site));
  const [hour, setHour] = useState(13);
  const [play, setPlay] = useState(true);
  const [toast, setToast] = useState("");
  useEffect(() => { setOn(defaultOn(site)); }, [site]);
  useEffect(() => { if (!play) return; const t = setInterval(() => setHour((h) => (h + 1) % 24), 1100); return () => clearInterval(t); }, [play]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3800); return () => clearTimeout(t); }, [toast]);

  const day = useMemo(() => simulateDay(site, { on }), [site, on]);
  const before = useMemo(() => simulateDay(site, { on: new Set() }), [site]);
  const sum = useMemo(() => summarize(site, { on }), [site, on]);
  const hist = useMemo(() => history(site), [site]);
  const savedDay = sum.costBase - sum.cost;
  const gridPct = Math.round((1 - sum.grid / sum.gridBase) * 100);
  const costPct = Math.round((1 - sum.cost / sum.costBase) * 100);
  const co2Year = hist.reduce((s, m) => s + (m.co2b - m.co2), 0);
  const comfort = site.buildings.reduce((s, b) => s + b.comfort * b.occupants, 0) / site.buildings.reduce((s, b) => s + b.occupants, 0);

  return (
    <main className="view green">
      <section className={"g-hero g-" + site.key}>
        <div className="g-hero-top">
          <span className="g-pill">🌿 {site.kind}</span>
          {canSwitch && <span className="row" style={{ gap: 6 }}>{Object.values(SITES).map((s) => <a key={s.key} href={`/green?site=${s.key}`} className={"g-pill g-switch" + (s.key === site.key ? " on" : "")}>{s.name}</a>)}</span>}
        </div>
        <h2>{site.name}<small> · {site.place}</small></h2>
        <p>{site.tagline}</p>
        <div className="g-hero-stats">
          <div><b className="num">{pShort(savedDay)}</b><span>saved today on power and water</span></div>
          <div><b className="num">−{costPct}%</b><span>power and water bill vs before AI ({gridPct}% less grid power)</span></div>
          <div><b className="num">{n0(co2Year)} t</b><span>CO₂ avoided since AI went live</span></div>
          <div><b className="num">{comfort.toFixed(1)}/5</b><span>{site.residentWord} comfort score</span></div>
        </div>
        <div className="g-disc">{site.disclaimer}</div>
      </section>

      <nav className="g-jump" aria-label="Sections">{SECTIONS.map(([id, l]) => <a key={id} href={`#g-${id}`} className="chip">{l}</a>)}</nav>

      <Briefing text={briefing} ai={aiWritten} />

      <section id="g-live" className="grid g-7-5">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div><h3>Live energy flow</h3><div className="hint">A typical day at {site.name}, hour by hour. Watch the sun charge the battery.</div></div>
            <button type="button" className="btn sm" onClick={() => setPlay(!play)} aria-pressed={play}>{play ? "⏸ Pause" : "▶ Play the day"}</button>
          </div>
          <FlowDiagram h={day[hour]} />
          <input type="range" min={0} max={23} value={hour} onChange={(e) => { setPlay(false); setHour(+e.target.value); }} className="g-range" aria-label="Hour of day" />
          <div className="row hint" style={{ justifyContent: "space-between" }}><span>12 AM</span><b style={{ color: "var(--fg)" }}>{hourLabel(hour)} · {tou(hour) > 1 ? "peak price" : tou(hour) < 1 ? "night price" : "day price"}</b><span>11 PM</span></div>
        </div>
        <div className="card">
          <h3>Where today&apos;s power comes from</h3>
          <div className="hint">Bars: solar, battery and grid. Dashed line: the same day before AI.</div>
          <DayChart day={day} before={before} hour={hour} onPick={(h) => { setPlay(false); setHour(h); }} />
          <div className="g-legend"><i style={{ background: C.solar }} />Solar <i style={{ background: C.batt }} />Battery <i style={{ background: C.grid }} />Grid <i className="dash" />Before AI</div>
          <div className="grid g2" style={{ gap: 10, marginTop: 10 }}>
            <Mini k="Grid power today" v={kwh(sum.grid)} d={`was ${kwh(sum.gridBase)}`} />
            <Mini k="Solar + battery share" v={`${Math.round(sum.solarShare * 100)}%`} d={`${n0(site.solarKwp)} kWp · ${kwh(site.batteryKwh)} battery`} />
            <Mini k="Evening peak (5–10 PM)" v={kw(Math.max(...day.slice(17, 22).map((x) => x.grid)))} d={`was ${kw(Math.max(...before.slice(17, 22).map((x) => x.grid)))}`} />
            <Mini k="CO₂ today" v={`${n1(sum.co2)} t`} d={`−${n1(sum.co2Base - sum.co2)} t vs before AI`} />
          </div>
        </div>
      </section>

      <section className="grid g4">{site.specials.map((s) => (
        <div key={s.k} className="card kpi g-special"><div className="k">{s.k}</div><div className="v">{s.v}</div><div className="d">{s.d}</div>{s.pct != null && <div className="g-meter"><i style={{ width: `${s.pct}%` }} /></div>}</div>
      ))}</section>

      <section className="card">
        <h3>Buildings</h3><div className="hint">Energy and water today, the change vs last month, and how comfortable people say they are.</div>
        <div className="g-bldgs">{site.buildings.map((b) => {
          const share = b.kwhDay / sum.base;
          return <div key={b.name} className="g-bldg">
            <div className="row" style={{ gap: 10 }}><span className="g-ico" aria-hidden="true">{b.icon}</span><div style={{ minWidth: 0 }}><b>{b.name}</b><div className="hint">{b.detail}</div></div></div>
            <div className="g-bstats"><span><b className="num">{kwh(sum.load * share)}</b> today</span><span><b className="num">{n0(b.m3Day)} m³</b> water</span></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="tag t-ok">{b.vsLastMonth}% vs last month</span><span className="hint">😊 {b.comfort.toFixed(1)}/5</span></div>
          </div>;
        })}</div>
      </section>

      <section id="g-ai" className="card">
        <AiActions site={site} on={on} setOn={setOn} savedDay={savedDay} m3Saved={sum.m3Base - sum.m3} onToast={setToast} />
      </section>

      <section id="g-water" className="grid g-7-5">
        <Leaks site={site} onToast={setToast} />
        <div className="card">
          <h3>Rainwater tank</h3><div className="hint">Filled from roofs and bioswales, used first for irrigation and flushing.</div>
          <RainTank fill={site.rainFill} cap={site.rainTankM3} />
          <div className="tip" style={{ marginTop: 10 }}>🌧️ Rain forecast Thursday (about 30 mm). The AI paused watering and will top the tank up to 100%.</div>
        </div>
      </section>
      <section className="card">
        <h3>Water balance, per day</h3><div className="hint">Where water comes from and where it goes. Every reused cubic metre is one less to buy.</div>
        <WaterBars title="Sources" rows={site.sourcesWater} />
        <WaterBars title="Uses" rows={site.usesWater} />
        <div className="row" style={{ gap: 18, flexWrap: "wrap", marginTop: 10 }}>
          <Mini k="Reused or harvested" v={`${Math.round((1 - site.sourcesWater[0].m3Day / site.sourcesWater.reduce((s, x) => s + x.m3Day, 0)) * 100)}%`} d="of all water used" />
          <Mini k="Saved by AI actions" v={`${n0(sum.m3Base - sum.m3)} m³/day`} d={`${pShort((sum.m3Base - sum.m3) * site.waterRate * 365)} a year`} />
        </div>
      </section>

      <section id="g-carbon" className="grid g-7-5">
        <div className="card">
          <h3>Grid power, last 12 months</h3><div className="hint">Grey: expected without AI (weather-adjusted). Green: actual. AI went live in {site.aiLive}.</div>
          <MonthBars rows={hist} />
        </div>
        <div className="card">
          <h3>Carbon this year</h3>
          <div className="g-big num">{n0(co2Year)} t CO₂</div>
          <div className="hint">avoided since {site.aiLive}, using an assumed grid factor of {site.ef} t CO₂ per MWh.</div>
          <div className="g-trees" aria-hidden="true">{"🌳".repeat(12)}</div>
          <div><b>≈ {n0((co2Year * 1000) / TREE_KG_YEAR)} trees</b> <span className="hint">absorbing CO₂ for a whole year</span></div>
          <h3 style={{ marginTop: 16 }}>Path to net zero by {site.netZeroYear}</h3>
          <Pathway site={site} />
        </div>
      </section>

      <section id="g-people" className="grid g-7-5">
        <div className="card">
          <h3>Green Points leaderboard</h3><div className="hint">Friendly floor-vs-floor challenge. Points are redeemed at local shops and the canteen.</div>
          <div className="list" style={{ marginTop: 8 }}>{site.teams.map((t, i) => (
            <div className="li" key={t.name}><span className="g-rank">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span><b style={{ flex: 1 }}>{t.name}</b><span className="tag t-ok">{t.pct}%</span><span className="num hint" style={{ width: 70, textAlign: "right" }}>{n0(t.points)} pts</span></div>
          ))}</div>
          <div className="okmsg" style={{ marginTop: 12 }}>💚 {site.comfortNote}</div>
        </div>
        <Phone site={site} />
      </section>

      <section id="g-certs" className="card">
        <h3>Green rating readiness</h3><div className="hint">AI collects the evidence from meters and tickets, so audits take days, not months.</div>
        <div className="g-certs">{site.certs.map((c) => {
          const done = c.items.filter(([, d]) => d).length, pct = Math.round((done / c.items.length) * 100);
          return <div key={c.name} className="g-cert">
            <div className="row" style={{ gap: 12 }}><Ring pct={pct} /><div><b>{c.name}</b><div className="hint">{c.body} · target: {c.target}</div></div></div>
            <ul>{c.items.map(([t, d]) => <li key={t} className={d ? "done" : ""}>{d ? "✓" : "○"} {t}</li>)}</ul>
          </div>;
        })}</div>
      </section>

      <section id="g-plan" className="card"><Planner site={site} on={on} /></section>

      <section className="card g-src">
        <h3>Sources and assumptions</h3>
        <ul>
          {site.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
          <li>Assumed rates: power ₱{site.tariff}/kWh (×1.35 from 5 to 10 PM, ×0.75 overnight), water ₱{site.waterRate}/m³. Solar yield {SOLAR_YIELD} kWh per kWp per day. Grid factor {site.ef} t CO₂/MWh.</li>
          <li>All building, meter and resident figures are sample data for this demo. Toggles and sliders run a simulation; nothing is saved.</li>
        </ul>
      </section>
      {toast && <div className="g-toast" role="status">{toast}</div>}
    </main>
  );
}

function Mini({ k, v, d }: { k: string; v: string; d?: string }) {
  return <div className="g-mini"><div className="k">{k}</div><div className="v num">{v}</div>{d && <div className="d">{d}</div>}</div>;
}

function Briefing({ text, ai }: { text: string; ai: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/₱/g, "").replace(/m³/g, "cubic metres"));
    const v = window.speechSynthesis.getVoices().find((x) => /en-PH/i.test(x.lang)) ?? window.speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v; u.rate = 1.02; u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u); setSpeaking(true);
  }
  return (
    <section className="card g-brief">
      <button type="button" className="g-play" onClick={speak} aria-label={speaking ? "Stop" : "Play the briefing"}>{speaking ? "■" : "▶"}</button>
      <div style={{ minWidth: 0 }}><div className="row" style={{ gap: 8 }}><h3>Today&apos;s green briefing</h3><span className="tag t-acc">{ai ? "Written by AI" : "AI template"}</span></div><p>{text}</p></div>
    </section>
  );
}

// ---------- Animated energy flow ----------
function FlowDiagram({ h }: { h: Hour }) {
  const night = h.solar < 1;
  const solarUse = Math.max(0, h.solar), charge = Math.max(0, -h.batt), discharge = Math.max(0, h.batt);
  const max = Math.max(h.load, h.solar, h.grid, 1);
  const w = (v: number) => (v <= 0.5 ? 0 : 2 + (v / max) * 9);
  const dur = (v: number) => `${Math.max(0.35, 2.4 - (v / max) * 2)}s`;
  const line = (d: string, v: number, color: string, rev?: boolean) => (
    <g><path d={d} stroke="var(--line)" strokeWidth={3} fill="none" />{v > 0.5 && <path d={d} stroke={color} strokeWidth={w(v)} fill="none" strokeLinecap="round" className="g-flow" style={{ animationDuration: dur(v), animationDirection: rev ? "reverse" : "normal" }} />}</g>
  );
  const node = (x: number, y: number, icon: string, label: string, v: string, color: string) => (
    <g><circle cx={x} cy={y} r={27} fill="var(--panel)" stroke={color} strokeWidth={2.5} /><text x={x} y={y + 7} textAnchor="middle" fontSize="21">{icon}</text>
      <text x={x} y={y + 45} textAnchor="middle" className="g-nl">{label}</text><text x={x} y={y + 60} textAnchor="middle" className="g-nv">{v}</text></g>
  );
  return (
    <svg viewBox="0 0 360 270" width="100%" role="img" aria-label={`At ${hourLabel(h.h)}: load ${kw(h.load)}, solar ${kw(h.solar)}, grid ${kw(h.grid)}`} className={"g-flowsvg" + (night ? " night" : "")}>
      <defs><radialGradient id="gsky" cx="0.2" cy="0.1" r="0.9"><stop offset="0" stopColor={night ? "#1a2a4a" : "#fff3c4"} stopOpacity=".55" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      <rect x="0" y="0" width="360" height="270" rx="12" fill="url(#gsky)" />
      {line("M68 58 C140 58 160 120 180 128", solarUse - charge, C.solar)}
      {line("M68 58 C 70 160 230 210 292 210", charge, C.solar)}
      {line("M68 210 C140 210 160 136 180 132", h.grid, C.grid)}
      {line("M292 210 C 230 200 200 150 182 134", discharge, C.batt)}
      {line("M182 128 C210 110 240 58 292 58", h.load, "#0d8a84")}
      <circle cx={181} cy={130} r={7} fill="var(--accent)" />
      {node(40, 44, night ? "🌙" : "☀️", "Solar", kw(h.solar), C.solar)}
      {node(40, 196, "🔌", "Grid", kw(h.grid), C.grid)}
      {node(320, 196, "🔋", `Battery ${Math.round(h.soc * 100)}%`, charge > 0.5 ? `+${kw(charge)}` : discharge > 0.5 ? `−${kw(discharge)}` : "idle", C.batt)}
      {node(320, 44, "🏙️", "Buildings", kw(h.load), "#0d8a84")}
    </svg>
  );
}

function DayChart({ day, before, hour, onPick }: { day: Hour[]; before: Hour[]; hour: number; onPick: (h: number) => void }) {
  const W = 560, H = 200, pl = 40, pb = 22, pt = 8, iw = W - pl - 8, ih = H - pt - pb;
  const max = Math.max(...before.map((x) => x.grid), ...day.map((x) => x.load), 1) * 1.08;
  const y = (v: number) => pt + ih - (v / max) * ih, bw = iw / 24;
  const line = before.map((x, i) => `${pl + i * bw + bw / 2},${y(x.grid)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Hourly power by source">
      {[0, 0.5, 1].map((f) => <g key={f}><line className="grid-l" x1={pl} x2={W - 8} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 5} y={y(max * f) + 4} textAnchor="end">{kw(max * f).replace(" ", "")}</text></g>)}
      {day.map((x, i) => {
        const sol = Math.min(x.solar, x.load), bat = Math.max(0, x.batt), gr = Math.max(0, x.load - sol - bat);
        const x0 = pl + i * bw + 1.5, ww = bw - 3; let top = pt + ih;
        const seg = (v: number, c: string) => { const hh = (v / max) * ih; top -= hh; return <rect x={x0} y={top} width={ww} height={Math.max(0, hh)} fill={c} rx={1} />; };
        return <g key={i} onClick={() => onPick(i)} style={{ cursor: "pointer" }} opacity={i === hour ? 1 : 0.78}>
          <rect x={pl + i * bw} y={pt} width={bw} height={ih} fill={i === hour ? "var(--accent-soft)" : "transparent"} />
          {seg(sol, C.solar)}{seg(bat, C.batt)}{seg(gr, C.grid)}
          {i % 3 === 0 && <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">{i === 0 ? "12a" : i === 12 ? "12p" : i < 12 ? `${i}a` : `${i - 12}p`}</text>}
        </g>;
      })}
      <polyline points={line} fill="none" stroke="var(--fg)" strokeWidth={1.6} strokeDasharray="4 4" opacity={0.65} />
    </svg>
  );
}

// ---------- AI actions ----------
function AiActions({ site, on, setOn, savedDay, m3Saved, onToast }: { site: Site; on: Set<string>; setOn: (s: Set<string>) => void; savedDay: number; m3Saved: number; onToast: (s: string) => void }) {
  const vals = useMemo(() => Object.fromEntries(site.actions.map((a) => [a.id, actionValue(site, on, a.id)])), [site, on]);
  const waiting = site.actions.filter((a) => !on.has(a.id));
  const flip = (id: string) => { const s = new Set(on); if (s.has(id)) s.delete(id); else s.add(id); setOn(s); };
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div><h3>AI actions</h3><div className="hint">The AI finds savings, then acts on its own or asks the right person first. Flip any switch to see the effect.</div></div>
        <div className="g-savebar"><b className="num">{pShort(savedDay * 365)}</b><span>a year at this setting · {n0(m3Saved)} m³ water a day</span></div>
      </div>
      <div className="g-actions">{site.actions.map((a) => {
        const v = vals[a.id], active = on.has(a.id);
        return <label key={a.id} className={"g-act" + (active ? " on" : "")}>
          <input type="checkbox" role="switch" checked={active} onChange={() => flip(a.id)} />
          <span className="g-sw" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className="tag t-mut">{a.area}</span><span className={"tag " + (a.approval === "Auto" ? "t-acc" : "t-warn")}>{a.approval === "Auto" ? "AI does it" : `${a.approval} approves`}</span></span>
            <b className="g-act-t">{a.title}</b>
            <span className="hint">{a.detail}</span>
            <span className="g-act-f"><b className="num">{v.pesoYear > 0 ? `${pShort(v.pesoYear)}/yr` : "Backup and peak cover"}</b>{v.co2Year > 0.5 && <> · {n0(v.co2Year)} t CO₂/yr</>}{(a.m3Day ?? 0) > 0 && <> · {a.m3Day} m³ water/day</>} · <i>{a.comfort}</i></span>
          </span>
        </label>;
      })}</div>
      {waiting.length > 0 && <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn pri" onClick={() => { setOn(new Set(site.actions.map((a) => a.id))); onToast(`Approved ${waiting.length} action${waiting.length > 1 ? "s" : ""}. In the live service the AI starts them tonight and reports back tomorrow (demo only).`); }}>Approve all {waiting.length} waiting</button>
        <span className="hint">Worth {pShort(waiting.reduce((s, a) => s + Math.max(0, vals[a.id].pesoYear), 0))} more a year.</span>
      </div>}
    </>
  );
}

// ---------- Water ----------
function Leaks({ site, onToast }: { site: Site; onToast: (s: string) => void }) {
  const [rows, setRows] = useState<Leak[]>(site.leaks);
  useEffect(() => setRows(site.leaks), [site]);
  const lost = rows.filter((l) => l.status !== "Fixed").reduce((s, l) => s + l.m3Day, 0);
  return (
    <div className="card">
      <h3>Leak watch</h3>
      <div className="hint">Every meter is checked between 1 and 4 AM, when water should be still. Flow that never stops is a leak.</div>
      <div className="g-leakhead"><b className="num">{n0(lost)} m³/day</b> at risk · {pShort(lost * site.waterRate * 30)} a month if left alone</div>
      <div className="list">{rows.map((l, i) => (
        <div className="li" key={l.where} style={{ alignItems: "flex-start", gap: 10 }}>
          <NightFlow night={l.night} normal={l.normal} fixed={l.status === "Fixed"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{l.where}</b>
            <div className="hint">{l.status === "Fixed" ? l.cause : `Night flow ${l.night} m³/h (normal ${l.normal}) since ${l.since}. ${l.cause}.`}</div>
            {l.m3Day > 0 && <div className="hint">≈ {l.m3Day} m³ lost a day</div>}
          </div>
          {l.status === "New" ? <button type="button" className="btn sm pri" onClick={() => { setRows(rows.map((r, j) => (j === i ? { ...r, status: "Crew on the way" } : r))); onToast(`Ticket created for ${l.where}. Plumber notified with the exact location (demo only).`); }}>Send crew</button>
            : <span className={"tag " + (l.status === "Fixed" ? "t-ok" : "t-warn")}>{l.status}</span>}
        </div>
      ))}</div>
    </div>
  );
}

function NightFlow({ night, normal, fixed }: { night: number; normal: number; fixed: boolean }) {
  // Tiny sparkline of flow from midnight to 6 AM: a leak never drops to the normal floor.
  const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; const base = normal + (1 - Math.sin(t * Math.PI)) * normal * 1.5; return fixed ? base : Math.max(base, night * (0.9 + 0.1 * Math.cos(i))); });
  const max = Math.max(...pts, night) * 1.1;
  return <svg viewBox="0 0 60 28" width="60" height="28" aria-hidden="true" className="g-spark"><polyline points={pts.map((v, i) => `${i * 5},${26 - (v / max) * 24}`).join(" ")} fill="none" stroke={fixed ? "var(--ok)" : "var(--bad)"} strokeWidth="2" /></svg>;
}

function RainTank({ fill, cap }: { fill: number; cap: number }) {
  const y = 20 + (1 - fill / 100) * 140;
  return (
    <div className="row" style={{ gap: 16, alignItems: "center", marginTop: 10 }}>
      <svg viewBox="0 0 120 180" width="110" aria-label={`Rainwater tank ${fill}% full`} role="img">
        <defs><clipPath id="gtank"><rect x="14" y="20" width="92" height="140" rx="14" /></clipPath></defs>
        <rect x="14" y="20" width="92" height="140" rx="14" fill="var(--panel-2)" stroke="var(--line)" strokeWidth="2" />
        <g clipPath="url(#gtank)"><path className="g-wave" d={`M0 ${y} q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V180 H0Z`} fill="#36a3c9" opacity=".85" /></g>
        <text x="60" y="100" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--fg)">{fill}%</text>
      </svg>
      <div><div className="g-big num">{n0((cap * fill) / 100)} m³</div><div className="hint">of {n0(cap)} m³ stored · about {Math.round((cap * fill) / 100 / 95)} days of irrigation</div></div>
    </div>
  );
}

function WaterBars({ title, rows }: { title: string; rows: { label: string; m3Day: number; color: string }[] }) {
  const total = rows.reduce((s, r) => s + r.m3Day, 0);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><b>{title}</b><span className="hint num">{n0(total)} m³/day</span></div>
      <div className="g-stack">{rows.map((r) => <i key={r.label} style={{ width: `${(r.m3Day / total) * 100}%`, background: r.color }} title={`${r.label}: ${r.m3Day} m³`} />)}</div>
      <div className="g-legend wrap">{rows.map((r) => <span key={r.label}><i style={{ background: r.color }} />{r.label} <b className="num">{n0(r.m3Day)}</b></span>)}</div>
    </div>
  );
}

// ---------- Carbon ----------
function MonthBars({ rows }: { rows: ReturnType<typeof history> }) {
  const W = 560, H = 210, pl = 44, pb = 24, pt = 10, iw = W - pl - 8, ih = H - pt - pb;
  const max = Math.max(...rows.map((r) => r.base)) * 1.05, bw = iw / rows.length, y = (v: number) => pt + ih - (v / max) * ih;
  const liveAt = rows.findIndex((r) => r.live);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monthly grid power before and after AI">
      {[0, 0.5, 1].map((f) => <g key={f}><line className="grid-l" x1={pl} x2={W - 8} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 5} y={y(max * f) + 4} textAnchor="end">{n0((max * f) / 1000)}</text></g>)}
      <text x={pl - 5} y={pt - 1} textAnchor="end" style={{ fontSize: 9 }}>MWh</text>
      {liveAt >= 0 && <g><line x1={pl + liveAt * bw} x2={pl + liveAt * bw} y1={pt} y2={pt + ih} stroke="var(--ok)" strokeDasharray="3 3" /><text x={pl + liveAt * bw + 4} y={pt + 10} style={{ fill: "var(--ok)", fontWeight: 700 }}>AI live</text></g>}
      {rows.map((r, i) => { const x0 = pl + i * bw + bw * 0.14, ww = bw * 0.34; return <g key={r.m}>
        <rect x={x0} y={y(r.base)} width={ww} height={pt + ih - y(r.base)} rx={2} fill="var(--line)" />
        <rect x={x0 + ww + 1} y={y(r.kwh)} width={ww} height={pt + ih - y(r.kwh)} rx={2} fill={r.live ? "var(--ok)" : C.grid} />
        <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">{r.m}</text></g>; })}
    </svg>
  );
}

function Pathway({ site }: { site: Site }) {
  const s = summarize(site, { on: new Set(site.actions.map((a) => a.id)) });
  const now = s.co2Base * 365, ai = s.co2 * 365;
  const p = plan(site, new Set(site.actions.map((a) => a.id)), site.solarKwp, site.batteryKwh, 10);
  const solar = Math.max(0, ai - p.co2);
  const steps = [
    { l: "Before AI", v: now, c: "var(--line)" }, { l: "AI operations (now)", v: ai, c: "var(--accent)" },
    { l: "Double solar + battery + retrofits", v: solar, c: C.solar }, { l: "Clean energy supply contract", v: solar * 0.35, c: "var(--ok)" }, { l: `Offsets for the rest, ${site.netZeroYear}`, v: 0, c: "var(--ok)" },
  ];
  return <div className="stack" style={{ gap: 6, marginTop: 6 }}>{steps.map((x) => (
    <div key={x.l} className="row" style={{ fontSize: 12.5, gap: 8 }}><span style={{ width: 150, flex: "none" }}>{x.l}</span>
      <span style={{ flex: 1, height: 9, background: "var(--panel-2)", borderRadius: 5, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${(x.v / now) * 100}%`, background: x.c }} /></span>
      <span className="num" style={{ width: 72, textAlign: "right" }}>{n0(x.v)} t</span></div>
  ))}<div className="hint">Tonnes of CO₂ a year from grid power.</div></div>;
}

// ---------- People ----------
function Phone({ site }: { site: Site }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % site.nudges.length), 4200); return () => clearInterval(t); }, [site]);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h3 style={{ alignSelf: "flex-start" }}>What {site.residentWord} see</h3>
      <div className="hint" style={{ alignSelf: "flex-start" }}>Friendly nudges in the app, Messenger or Viber. In English or Taglish, never shaming.</div>
      <div className="g-phone" aria-live="polite">
        <div className="g-notch" />
        <div className="g-ptop">9:41 · {site.short} Home</div>
        <div className="g-pts"><span>Green Points</span><b className="num">1,480</b><small>#1 on your floor 🎉</small></div>
        {site.nudges.map((x, j) => <div key={x.title} className={"g-bubble" + (j === i ? " on" : "")}><b>{x.title}</b><span>{x.body}</span></div>)}
        <div className="g-dots">{site.nudges.map((x, j) => <button type="button" key={x.title} className={j === i ? "on" : ""} onClick={() => setI(j)} aria-label={`Message ${j + 1}`} />)}</div>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return <svg viewBox="0 0 50 50" width="50" height="50" aria-label={`${pct}% ready`} role="img"><circle cx="25" cy="25" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="6" /><circle cx="25" cy="25" r={r} fill="none" stroke="var(--ok)" strokeWidth="6" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 25 25)" strokeLinecap="round" /><text x="25" y="29" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--fg)">{pct}%</text></svg>;
}

// ---------- Planner ----------
function Planner({ site, on }: { site: Site; on: Set<string> }) {
  const [kwp, setKwp] = useState(Math.round(site.solarKwp / 2));
  const [batt, setBatt] = useState(Math.round(site.batteryKwh / 2));
  const [retro, setRetro] = useState(8);
  const ref = useRef(site.key);
  useEffect(() => { if (ref.current !== site.key) { ref.current = site.key; setKwp(Math.round(site.solarKwp / 2)); setBatt(Math.round(site.batteryKwh / 2)); } }, [site]);
  const p = useMemo(() => plan(site, on, kwp, batt, retro), [site, on, kwp, batt, retro]);
  return (
    <>
      <h3>What-if planner</h3><div className="hint">Try more solar, a bigger battery or efficiency upgrades (LED, inverter aircon, better glazing). The AI shows cost, savings and payback.</div>
      <div className="grid g2" style={{ marginTop: 12, alignItems: "start" }}>
        <div className="stack" style={{ gap: 14 }}>
          <Slider label="Add rooftop and carport solar" v={kwp} set={setKwp} max={site.solarKwp * 2} step={site.solarKwp / 20} fmt={(x) => `${n0(x)} kWp`} />
          <Slider label="Add battery storage" v={batt} set={setBatt} max={site.batteryKwh * 2} step={site.batteryKwh / 20} fmt={kwh} />
          <Slider label="Efficiency upgrades (energy cut)" v={retro} set={setRetro} max={25} step={1} fmt={(x) => `${x}%`} />
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Mini k="Investment" v={pShort(p.capex)} d={`₱${n0(CAPEX.solarPerKwp)}/kWp · ₱${n0(CAPEX.batteryPerKwh)}/kWh (assumed)`} />
          <Mini k="Savings a year" v={pShort(p.save)} />
          <Mini k="Payback" v={Number.isFinite(p.payback) ? `${n1(p.payback)} years` : "—"} />
          <Mini k="CO₂ cut a year" v={`${n0(p.co2)} t`} d={`solar + battery share ${Math.round(p.solarShare * 100)}%`} />
        </div>
      </div>
    </>
  );
}

function Slider({ label, v, set, max, step, fmt }: { label: string; v: number; set: (n: number) => void; max: number; step: number; fmt: (n: number) => string }) {
  return <label className="g-slider"><span className="row" style={{ justifyContent: "space-between" }}><span>{label}</span><b className="num">{fmt(v)}</b></span><input type="range" min={0} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} className="g-range" /></label>;
}
