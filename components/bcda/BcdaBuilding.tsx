"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BcdaScene } from "./scene";
import {
  BCDA_NAME, WHY, SCORECARD, SOURCES, ASSUMPTIONS, ZONES, WINGS, BAYS, GFA, TENANTS, SYSTEMS, CONTINUITY, ENERGY, dayCurve, MONTHS, LEAKS, AI_MOVES, SOLAR_KWP,
  CERTS, ASSETS, PM_STATS, RESERVE, BUDGET, SPEND_LINES, BUYS, AUDIT, leaseStats, PIPELINE, PERMITS, DRILLS, SAFETY, tenantSat, healthScore,
  type Zone, type Lens, type Buy,
} from "@/lib/bcda";

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const pS = (v: number) => { const a = Math.abs(v); return a >= 1e9 ? `₱${n1(a / 1e9)}B` : a >= 1e6 ? `₱${n1(a / 1e6)}M` : a >= 1e4 ? `₱${n0(a / 1e3)}k` : `₱${n0(a)}`; };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

type Cat = { k: string; label: string; color: string };
const LENSES: Record<Lens, { name: string; icon: string; hint: string; cats: Cat[]; of: (z: Zone) => string; pulse: (z: Zone) => boolean }> = {
  uptime: { name: "Uptime", icon: "⚡", hint: "Which spaces carry critical loads, and whether any is running on battery or degraded right now.", cats: [
    { k: "CRIT", label: "Critical load, protected", color: "#0072B2" }, { k: "OK", label: "Normal power", color: "#56B4E9" },
    { k: "UPS", label: "On UPS right now", color: "#E69F00" }, { k: "DEGRADED", label: "Degraded", color: "#D55E00" },
  ], of: (z) => (z.power !== "OK" ? z.power : z.tenant === "ops" || z.tenant === "exec" || /Server|Electrical/.test(z.use) ? "CRIT" : "OK"), pulse: (z) => z.power !== "OK" },
  energy: { name: "Energy", icon: "🔌", hint: `Energy use per m² a year, against a typical government office (${ASSUMPTIONS.benchmarkEui} kWh/m²). Pulsing = waste the AI has found.`, cats: [
    { k: "LOW", label: "Efficient (< 130)", color: "#009E73" }, { k: "MID", label: "Normal (130–190)", color: "#56B4E9" },
    { k: "HIGH", label: "High (> 190)", color: "#E69F00" }, { k: "247", label: "24/7 by design", color: "#CC79A7" },
  ], of: (z) => (z.tenant === "ops" || /Server/.test(z.use) ? "247" : z.eui < 130 ? "LOW" : z.eui <= 190 ? "MID" : "HIGH"), pulse: (z) => z.eui > 240 && z.tenant !== "ops" && !/Server|canteen/.test(z.use) },
  assets: { name: "Assets", icon: "🛠️", hint: "Condition of the equipment serving each space, and overdue preventive maintenance (pulsing).", cats: [
    { k: "GOOD", label: "Good (4–5)", color: "#009E73" }, { k: "FAIR", label: "Fair (3)", color: "#E69F00" }, { k: "POOR", label: "Poor (1–2)", color: "#D55E00" },
  ], of: (z) => (z.cond >= 4 ? "GOOD" : z.cond === 3 ? "FAIR" : "POOR"), pulse: (z) => z.pmOverdue > 0 },
  leases: { name: "Leases", icon: "📄", hint: "Who leases each bay, leases ending within 6 months, unpaid rent (pulsing) and vacant space.", cats: [
    { k: "LEASED", label: "Leased, paid up", color: "#0072B2" }, { k: "EXPIRING", label: "Lease ends ≤ 6 months", color: "#E69F00" },
    { k: "ARREARS", label: "Rent unpaid", color: "#D55E00" }, { k: "VACANT", label: "Vacant", color: "#CC79A7" }, { k: "SERVICE", label: "Building services", color: "" },
  ], of: (z) => z.lease, pulse: (z) => z.lease === "ARREARS" },
  safety: { name: "Safety", icon: "🦺", hint: "Open safety findings by space (pulsing). Everything else passed its last check.", cats: [
    { k: "OK", label: "No open findings", color: "#009E73" }, { k: "OPEN", label: "Open finding", color: "#D55E00" },
  ], of: (z) => (z.safety > 0 ? "OPEN" : "OK"), pulse: (z) => z.safety > 0 },
};
const LENS_ORDER: Lens[] = ["uptime", "energy", "assets", "leases", "safety"];

const SECTIONS = [["twin", "3D building"], ["uptime", "Uptime"], ["energy", "Energy & water"], ["green", "Green rating"], ["assets", "Assets"], ["spend", "Spending & COA"], ["leases", "Leases"], ["safety", "Safety"], ["tenants", "Agencies"], ["sources", "Sources"]] as const;

function readDark() {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function canWebGl() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }

export default function BcdaBuilding({ briefing, aiWritten, fromMap }: { briefing: string; aiWritten: boolean; fromMap: boolean }) {
  const ls = useMemo(() => leaseStats(), []);
  const hs = useMemo(() => healthScore(), []);
  const sat = useMemo(() => tenantSat(), []);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3800); return () => clearTimeout(t); }, [toast]);
  const energyCut = 1 - ENERGY.kwhDay / ENERGY.baselineKwhDay;

  return (
    <main className="view green bcda">
      <section className="g-hero g-bcda">
        <div className="g-hero-top">
          <span className="g-pill">🏛️ BCDA · National Government Administrative Center</span>
          <span className="row" style={{ gap: 6 }}>
            <a className="g-pill g-switch" href={fromMap ? "/green/map?focus=ncc-gov" : "/green/map?focus=ncc-gov"}>{fromMap ? "← Back to the 3D city" : "🏙️ See it on the 3D city map"}</a>
          </span>
        </div>
        <div className="bc-hero-grid">
          <div>
            <h2>{BCDA_NAME}<small> · New Clark City, Capas, Tarlac</small></h2>
            <p>The same AI building management we run for condominiums, pointed at what BCDA measures: uptime, energy and water, asset condition, audit-ready spending, lease revenue and safety. Run lean, logged for COA, and ready for the next emergency.</p>
          </div>
          <div className="bc-score" aria-label={`Building health ${hs.score} out of 100`}>
            <Ring v={hs.score} />
            <div><b>Building health</b><span>6 BCDA objectives, weighted</span></div>
          </div>
        </div>
        <div className="g-hero-stats">
          <div><b className="num">100%</b><span>critical power available this quarter (generator in 9.2 s)</span></div>
          <div><b className="num">−{pct(energyCut)}</b><span>power vs baseline · GEMP target −{ASSUMPTIONS.gemp}%</span></div>
          <div><b className="num">{pct(ls.occ)}</b><span>leased · {pS(ls.billedYear)} a year billed</span></div>
          <div><b className="num">{AUDIT.trail}%</b><span>purchases with a complete COA-ready trail · {AUDIT.aomsOpen} open audit findings</span></div>
        </div>
        <div className="g-disc">Demo with sample data. Tenants, readings, contracts and pesos are illustrative; the floor layout is simplified. Building facts and BCDA scorecard figures are from public sources listed at the bottom. Not live BCDA data.</div>
      </section>

      <nav className="g-jump" aria-label="Sections">{SECTIONS.map(([id, l]) => <a key={id} href={`#bc-${id}`} className="chip">{l}</a>)}</nav>

      <Briefing text={briefing} ai={aiWritten} />

      <section className="grid g-7-5">
        <div className="card">
          <h3>Built around BCDA&apos;s own scorecard</h3>
          <div className="hint">Instead of resident happiness, this building is run against the measures BCDA reports to GCG every year. Targets and actuals below are BCDA&apos;s published 2025 figures.</div>
          <div className="bc-sc">{SCORECARD.map((s) => (
            <a key={s.sm} href={`#bc-${s.section}`} className="bc-sc-row">
              <span className="tag t-acc">{s.sm}</span>
              <span style={{ minWidth: 0 }}><b>{s.what}</b><small>Target {s.target} · 2025 actual {s.actual}</small><small className="bc-ours">Here: {s.ours} →</small></span>
            </a>))}
          </div>
        </div>
        <div className="card">
          <h3>Why this building</h3>
          <ul className="bc-why">{WHY.map((w) => <li key={w}>{w}</li>)}</ul>
          <h3 style={{ marginTop: 14 }}>Building health, by objective</h3>
          {hs.parts.map((p) => <Bar key={p.k} label={p.k} v={p.v} />)}
        </div>
      </section>

      <Twin />

      <section id="bc-uptime" className="grid g-7-5">
        <div className="card">
          <h3>Uptime: is everything running?</h3>
          <div className="hint">This is a backup seat of government. Availability is measured every minute from meters, UPS and generator controllers.</div>
          <table className="bc-tbl"><thead><tr><th>System</th><th>Target</th><th>This quarter</th></tr></thead><tbody>
            {SYSTEMS.map((s) => <tr key={s.name}><td><b>{s.name}</b><div className="hint">{s.note}</div></td><td className="num">{s.target}%</td><td><span className={"tag " + (s.actual >= s.target ? "t-ok" : "t-warn")}>{s.actual}%</span></td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h3>Continuity readiness</h3>
          <div className="hint">What BCDA&apos;s Public Service Continuity Plan needs this building to prove.</div>
          <div className="grid g2" style={{ gap: 10, marginTop: 8 }}>{CONTINUITY.map((c) => <Mini key={c.k} k={c.k} v={c.v} d={c.d} warn={!c.ok} />)}</div>
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setToast("Generator test booked for Thursday 6 AM. Agencies notified by SMS and email.")}>📅 Book next generator load test</button>
        </div>
      </section>

      <Energy onToast={setToast} />

      <section id="bc-green" className="card">
        <h3>Green rating and government energy rules</h3>
        <div className="hint">Progress toward a BERDE rating and the DOE rules government buildings must follow. AI writes the monthly reports from meter data.</div>
        <div className="grid g3" style={{ marginTop: 10 }}>{CERTS.map((c) => {
          const done = c.items.filter((i) => i[1]).length;
          return <div key={c.name} className="bc-cert"><div className="row" style={{ justifyContent: "space-between", gap: 8 }}><b>{c.name}</b><span className="tag t-acc">{c.target}</span></div>
            <div className="hint">{c.body}</div>
            <div className="g-meter" style={{ margin: "8px 0" }}><i style={{ width: `${(done / c.items.length) * 100}%` }} /></div>
            <ul className="bc-check">{c.items.map(([t, ok]) => <li key={t} className={ok ? "ok" : ""}>{ok ? "✓" : "○"} {t}</li>)}</ul></div>;
        })}</div>
      </section>

      <section id="bc-assets" className="grid g-7-5">
        <div className="card">
          <h3>Asset condition and preventive maintenance</h3>
          <div className="hint">Every major asset has a QR tag. Technicians scan it, log the work with photos, and the condition score updates.</div>
          <div className="grid g4" style={{ gap: 10, margin: "10px 0" }}>
            <Mini k="PM done on time" v={pct(PM_STATS.done / PM_STATS.scheduled)} d={`${PM_STATS.done} of ${PM_STATS.scheduled} this year`} />
            <Mini k="Backlog" v={`${PM_STATS.backlog}`} d="jobs past due" warn />
            <Mini k="Average fix time" v={`${PM_STATS.avgCloseH} h`} d="from report to done" />
            <Mini k="Unplanned work" v={`${PM_STATS.reactiveShare}%`} d="target under 20%" />
          </div>
          <div className="bc-scroll"><table className="bc-tbl"><thead><tr><th>Asset</th><th>Condition</th><th>Next PM</th><th>Life used</th></tr></thead><tbody>
            {ASSETS.map((a) => <tr key={a.tag}><td><b>{a.name}</b><div className="hint">{a.tag} · {a.note}</div></td>
              <td><Dots n={a.cond} /></td>
              <td>{a.overdue ? <span className="tag t-bad">Overdue {a.pmDue}</span> : <span className="hint">{a.pm} · {a.pmDue}</span>}</td>
              <td><div className="g-meter" style={{ width: 70 }}><i style={{ width: `${Math.min(100, (a.age / a.life) * 100)}%`, background: a.age / a.life > 0.6 ? "var(--warn)" : undefined }} /></div><span className="hint">{a.age} of {a.life} yrs</span></td></tr>)}
          </tbody></table></div>
        </div>
        <div className="card">
          <h3>Replacement reserve, next 10 years</h3>
          <div className="hint">What BCDA should set aside each year so nothing fails by surprise. The 2034 spike is the chillers reaching end of life.</div>
          <Reserve />
          <div className="tip" style={{ marginTop: 10 }}><span className="tip-i">💡</span><span><b>AI suggestion</b>Fixing Chiller 2 now (₱485k) restores about 0.18 kW/TR and saves around ₱1.1M a year in power, and adds an estimated 3 years before replacement.</span></div>
        </div>
      </section>

      <Spend onToast={setToast} />

      <section id="bc-leases" className="grid g-7-5">
        <div className="card">
          <h3>Occupancy and lease revenue</h3>
          <div className="hint">Rent billed to each agency, what has been paid, and when each lease ends. Bills and reminders go out automatically.</div>
          <div className="grid g4" style={{ gap: 10, margin: "10px 0" }}>
            <Mini k="Leased" v={pct(ls.occ)} d={`${n0(ls.leasedM2)} of ${n0(ls.totalM2)} m²`} />
            <Mini k="Rent billed" v={pS(ls.billedMonth)} d="a month" />
            <Mini k="Collected (90 days)" v={pct(ls.collect)} d={`${pS(ls.arrears)} unpaid`} warn={ls.arrears > 0} />
            <Mini k="Vacant space" v={`${n0(ls.vacantM2)} m²`} d={`${pS(ls.vacantRentYear)} a year unbilled`} warn />
          </div>
          <div className="bc-scroll"><table className="bc-tbl"><thead><tr><th>Agency</th><th>Area</th><th>Rent / month</th><th>Paid</th><th>Lease ends</th></tr></thead><tbody>
            {TENANTS.map((t) => <tr key={t.id}><td><b>{t.name}</b><div className="hint">{t.kind}</div></td><td className="num">{n0(t.areaM2)} m²</td><td className="num">{pS(t.areaM2 * t.rent)}</td>
              <td>{t.arrears ? <span className="tag t-bad">{t.paidPct}% · {pS(t.arrears)} due</span> : <span className="tag t-ok">Paid</span>}</td>
              <td><span className={"tag " + (t.end <= "2027-05" ? "t-warn" : "t-mut")}>{t.end}</span></td></tr>)}
          </tbody></table></div>
          <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => setToast("Polite reminders drafted for 2 agencies with unpaid rent. Waiting for your approval in Updates.")}>✉️ Draft polite rent reminders</button>
        </div>
        <div className="card">
          <h3>Filling the vacant space</h3>
          <div className="hint">Agencies that asked about space, matched to the bays that fit them.</div>
          {PIPELINE.map((p) => <div key={p.who} className="bc-pipe"><div><b>{p.who}</b><div className="hint">{n0(p.m2)} m² · fits {p.fit}</div></div><span className="tag t-acc">{p.stage}</span></div>)}
          <Mini k="If all three sign" v={`${pS(PIPELINE.reduce((s, p) => s + p.m2, 0) * 720 * 12)} a year`} d="more lease revenue for BCDA (sample rent ₱720/m²)" />
        </div>
      </section>

      <section id="bc-safety" className="grid g-7-5">
        <div className="card">
          <h3>Permits and certificates</h3>
          <div className="hint">AI reminds the right person 90, 30 and 7 days before anything expires, and files the renewed copy.</div>
          {PERMITS.map((p) => <div key={p.name} className="bc-pipe"><div><b>{p.name}</b><div className="hint">{p.days > 0 ? `Due ${p.due} · ${p.days} days` : p.due}</div></div><span className={"tag " + (p.ok ? "t-ok" : "t-warn")}>{p.ok ? "OK" : "Renew now"}</span></div>)}
        </div>
        <div className="card">
          <h3>Safety</h3>
          <div className="grid g2" style={{ gap: 10, margin: "8px 0 12px" }}>
            <Mini k="Days without lost-time injury" v={n0(SAFETY.daysNoLti)} d="staff and contractors" />
            <Mini k="Open safety findings" v={`${SAFETY.openFindings}`} d="each has an owner and a due date" warn={SAFETY.openFindings > 0} />
            <Mini k="Guard rounds on time" v={`${SAFETY.guardRounds}%`} d="QR checkpoints, with photos" />
            <Mini k="Near misses reported" v={`${SAFETY.nearMiss}`} d="this quarter, all closed" />
          </div>
          {DRILLS.map((d) => <div key={d.k} className="bc-pipe"><div><b>{d.k}</b><div className="hint">Last {d.last} · {d.note}</div></div><span className="tag t-mut">Next {d.next}</span></div>)}
        </div>
      </section>

      <section id="bc-tenants" className="card">
        <h3>Agency satisfaction</h3>
        <div className="hint">For BCDA this replaces resident happiness: after every job the agency&apos;s contact rates it in one tap. It feeds BCDA&apos;s ARTA customer-satisfaction survey (scorecard SM7, target 90%).</div>
        <div className="grid g4" style={{ gap: 10, marginTop: 10 }}>
          <Mini k="Satisfied" v={`${sat.satisfiedPct}%`} d="rated 4 or 5 of 5" />
          <Mini k="Average rating" v={`${sat.avg.toFixed(1)}/5`} d="weighted by space leased" />
          <Mini k="Jobs rated" v={n0(sat.jobs)} d="this year" />
          <Mini k="Median fix time" v={`${sat.medianFixH} h`} d="from request to done" />
        </div>
      </section>

      <section id="bc-sources" className="card">
        <h3>Sources and assumptions</h3>
        <ul className="bc-src">{SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
        <div className="hint" style={{ marginTop: 8 }}>Assumptions: power ₱{ASSUMPTIONS.tariff}/kWh, water ₱{ASSUMPTIONS.water}/m³, grid factor {ASSUMPTIONS.ef} t CO₂/MWh, benchmark {ASSUMPTIONS.benchmarkEui} kWh/m²/yr, gross floor area about {n0(GFA)} m² across two 4-storey buildings, rooftop solar {SOLAR_KWP} kWp, AI programme live since {ASSUMPTIONS.start}. Tenants are named generically; no real agency&apos;s lease or payment is shown.</div>
      </section>

      {toast && <div className="g-toast" role="status">{toast}</div>}
    </main>
  );
}

// ---------- 3D building ----------
function Twin() {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BcdaScene | null>(null);
  const [lens, setLens] = useState<Lens>("uptime");
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "2d" | null>(null);
  const [dark, setDark] = useState(false);
  const L = LENSES[lens];

  useEffect(() => {
    setDark(readDark());
    setView(canWebGl() ? "3d" : "2d");
    const mo = new MutationObserver(() => setDark(readDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    if (view !== "3d" || !host.current) return;
    let alive = true;
    import("./scene").then(({ createBcdaScene }) => {
      if (!alive || !host.current) return;
      try {
        sceneRef.current = createBcdaScene({ host: host.current, zones: ZONES, floors: 4, dark: readDark(), motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, onPick: setSel });
        paint();
      } catch (e) { console.error("3D failed", e); setView("2d"); }
    }).catch(() => setView("2d"));
    return () => { alive = false; sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const colorOf = (z: Zone) => L.cats.find((c) => c.k === L.of(z))?.color || (dark ? "#3a4656" : "#d5dbe2");
  function paint() { sceneRef.current?.paint(ZONES.map((z) => ({ id: z.id, color: colorOf(z), pulse: L.pulse(z) }))); }
  useEffect(() => { paint(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lens, dark]);
  useEffect(() => { sceneRef.current?.select(sel); }, [sel]);
  useEffect(() => { sceneRef.current?.setTheme(dark); }, [dark]);
  const z = sel ? ZONES.find((x) => x.id === sel) : null;
  const t = z?.tenant ? TENANTS.find((x) => x.id === z.tenant) : null;
  const counts = new Map<string, number>(); for (const q of ZONES) counts.set(L.of(q), (counts.get(L.of(q)) ?? 0) + 1);

  return (
    <section id="bc-twin" className="card">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div><h3>Live 3D building</h3><div className="hint">North and South buildings, 4 floors, 32 bays. Pick a lens, then tap a bay.</div></div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className={"chip" + (view === "3d" ? " on" : "")} onClick={() => setView("3d")}>3D</button>
          <button type="button" className={"chip" + (view === "2d" ? " on" : "")} onClick={() => { setView("2d"); }}>Floor plan</button>
        </div>
      </div>
      <div className="bc-lens" role="tablist">{LENS_ORDER.map((k) => <button key={k} type="button" role="tab" aria-selected={lens === k} className={"chip" + (lens === k ? " on" : "")} onClick={() => setLens(k)}>{LENSES[k].icon} {LENSES[k].name}</button>)}</div>
      <div className="hint" style={{ margin: "4px 0 8px" }}>{L.hint}</div>
      <div className="bc-twin">
        <div className="bc-stage">
          {view === "3d" ? <div ref={host} className="bc-canvas" /> : view === "2d" ? <Plan colorOf={colorOf} pulse={L.pulse} sel={sel} onPick={setSel} /> : null}
          {view === "3d" && <button type="button" className="btn sm bc-reset" onClick={() => sceneRef.current?.reset()}>Reset view</button>}
        </div>
        <div className="bc-side">
          <div className="g-legend wrap">{L.cats.filter((c) => c.color).map((c) => <span key={c.k}><i style={{ background: c.color }} />{c.label} <b>{counts.get(c.k) ?? 0}</b></span>)}</div>
          {z ? <div className="bc-zone">
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}><b>{z.label}</b><button type="button" className="btn sm" onClick={() => setSel(null)} aria-label="Close">✕</button></div>
            <div style={{ fontWeight: 600, margin: "4px 0" }}>{z.use}</div>
            <div className="grid g2" style={{ gap: 8 }}>
              <Mini k="Energy" v={`${n0(z.kwhDay)} kWh/day`} d={`${z.eui} kWh/m² a year`} />
              <Mini k="Condition" v={`${z.cond}/5`} d={z.pmOverdue ? `${z.pmOverdue} PM overdue` : "PM up to date"} warn={z.pmOverdue > 0} />
              <Mini k="Power" v={z.power === "OK" ? "Normal" : z.power === "UPS" ? "On UPS" : "Degraded"} d={LENSES.uptime.of(z) === "CRIT" ? "critical load" : "standard"} />
              <Mini k="Lease" v={z.lease === "SERVICE" ? "Services" : z.lease === "VACANT" ? "Vacant" : t ? `${pS(z.areaM2 * t.rent)}/mo` : "—"} d={t ? `ends ${t.end}${t.arrears ? ` · ${pS(t.arrears)} unpaid` : ""}` : `${n0(z.areaM2)} m²`} warn={z.lease === "ARREARS" || z.lease === "VACANT"} />
            </div>
            <div className="tip" style={{ marginTop: 8 }}><span className="tip-i">🤖</span><span>{z.note}</span></div>
          </div> : <div className="hint bc-empty">Tap any bay to see its energy, equipment, power, lease and safety in one place.</div>}
        </div>
      </div>
    </section>
  );
}

function Plan({ colorOf, pulse, sel, onPick }: { colorOf: (z: Zone) => string; pulse: (z: Zone) => boolean; sel: string | null; onPick: (id: string) => void }) {
  return (
    <div className="bc-plan">{(["N", "S"] as const).map((w) => (
      <div key={w}><div className="hint" style={{ fontWeight: 600 }}>{WINGS[w].name}</div>
        {[4, 3, 2, 1].map((f) => <div key={f} className="bc-floor"><span className="hint">F{f}</span>{Array.from({ length: BAYS }, (_, i) => {
          const z = ZONES.find((x) => x.wing === w && x.floor === f && x.bay === i + 1)!;
          return <button key={z.id} type="button" className={"bc-bay" + (pulse(z) ? " pulse" : "") + (sel === z.id ? " sel" : "")} style={{ background: colorOf(z) }} onClick={() => onPick(z.id)} aria-label={`${z.label}: ${z.use}`}>{z.id}</button>;
        })}</div>)}
      </div>))}
    </div>
  );
}

// ---------- Energy and water ----------
function Energy({ onToast }: { onToast: (s: string) => void }) {
  const on = useMemo(() => dayCurve(true), []);
  const off = useMemo(() => dayCurve(false), []);
  const [hour, setHour] = useState(10);
  const [play, setPlay] = useState(true);
  useEffect(() => { if (!play) return; const t = setInterval(() => setHour((h) => (h + 1) % 24), 1000); return () => clearInterval(t); }, [play]);
  const max = Math.max(...off.map((x) => x.load));
  const W = 480, H = 150, bw = W / 24;
  const saveDay = (ENERGY.baselineKwhDay - ENERGY.kwhDay) * ASSUMPTIONS.tariff + (ENERGY.baselineM3Day - ENERGY.m3Day) * ASSUMPTIONS.water;
  const mMax = Math.max(...MONTHS.map((m) => m.base));
  return (
    <>
      <section id="bc-energy" className="grid g-7-5">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div><h3>Energy today, hour by hour</h3><div className="hint">Bars: grid (grey) and rooftop solar (gold). Dashed: the same weekday before AI.</div></div>
            <button type="button" className="btn sm" onClick={() => setPlay(!play)} aria-pressed={play}>{play ? "⏸ Pause" : "▶ Play the day"}</button>
          </div>
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="bc-chart" role="img" aria-label="Hourly power use today">
            {on.map((x) => { const hg = (x.grid / max) * H, hs = (x.solar / max) * H; return <g key={x.h} onClick={() => { setPlay(false); setHour(x.h); }} style={{ cursor: "pointer" }} opacity={x.h === hour ? 1 : 0.75}>
              <rect x={x.h * bw + 2} y={H - hg} width={bw - 4} height={hg} fill="#7b8a87" rx="2" />
              <rect x={x.h * bw + 2} y={H - hg - hs} width={bw - 4} height={hs} fill="#e6a700" rx="2" />
            </g>; })}
            <polyline fill="none" stroke="var(--fg)" strokeDasharray="4 3" strokeWidth="1.4" opacity=".6" points={off.map((x) => `${x.h * bw + bw / 2},${H - (x.load / max) * H}`).join(" ")} />
            <line x1={hour * bw + bw / 2} x2={hour * bw + bw / 2} y1={0} y2={H} stroke="var(--accent)" strokeWidth="1.5" />
            {[0, 6, 12, 18].map((h) => <text key={h} x={h * bw + 2} y={H + 14} fontSize="10" fill="var(--muted)">{hourLabel(h)}</text>)}
          </svg>
          <div className="row hint" style={{ justifyContent: "space-between" }}><span>{hourLabel(hour)}</span><b style={{ color: "var(--fg)" }}>{n0(on[hour].load)} kW now · solar {n0(on[hour].solar)} kW · was {n0(off[hour].load)} kW</b></div>
          <div className="grid g4" style={{ gap: 10, marginTop: 10 }}>
            <Mini k="Power today" v={`${n1(ENERGY.kwhDay / 1000)} MWh`} d={`was ${n1(ENERGY.baselineKwhDay / 1000)} MWh`} />
            <Mini k="Water today" v={`${ENERGY.m3Day} m³`} d={`was ${ENERGY.baselineM3Day} m³`} />
            <Mini k="Saved today" v={pS(saveDay)} d={`${pS(saveDay * 365)} a year`} />
            <Mini k="Energy intensity" v={`${Math.round((ENERGY.kwhDay * 365) / GFA)} kWh/m²`} d={`benchmark ${ASSUMPTIONS.benchmarkEui}`} />
          </div>
        </div>
        <div className="card">
          <h3>Last 12 months vs baseline</h3><div className="hint">Grey: expected without AI (weather-adjusted). Teal: actual. AI went live in {ASSUMPTIONS.start}.</div>
          <svg viewBox="0 0 300 140" className="bc-chart" role="img" aria-label="Monthly power use">
            {MONTHS.map((m, i) => { const x = i * 25 + 3; const hb = (m.base / mMax) * 110, ha = (m.actual / mMax) * 110; return <g key={m.m}>
              <rect x={x} y={115 - hb} width={10} height={hb} fill="var(--line)" rx="2" /><rect x={x + 10} y={115 - ha} width={10} height={ha} fill="#0d8a84" rx="2" />
              <text x={x + 10} y={130} fontSize="9" textAnchor="middle" fill="var(--muted)">{m.m}</text></g>; })}
          </svg>
          <h3 style={{ marginTop: 6 }}>Water leaks</h3>
          {LEAKS.map((l) => <div key={l.where} className="bc-pipe"><div><b>{l.where}</b><div className="hint">{l.what} · since {l.since}{l.m3Day ? ` · ${l.m3Day} m³/day` : ""}</div></div><span className={"tag " + (l.m3Day ? "t-warn" : "t-ok")}>{l.status}</span></div>)}
        </div>
      </section>
      <section className="card">
        <h3>What the AI is doing about it</h3><div className="hint">Each move is logged with its measured saving. Anything that changes an agency&apos;s comfort waits for that agency&apos;s OK.</div>
        <div className="bc-moves">{AI_MOVES.map((m) => <div key={m.title} className="bc-move"><b>{m.title}</b><span className="hint">{m.kind === "Power" ? `${n0(m.saves)} kWh/day · ${pS(m.saves * ASSUMPTIONS.tariff * 365)} a year` : `${m.saves} m³/day · ${pS(m.saves * ASSUMPTIONS.water * 365)} a year`}</span>
          {m.state === "Live" ? <span className="tag t-ok">Live</span> : <button type="button" className="btn sm" onClick={() => onToast(`Sent for approval: ${m.title}.`)}>{m.state} · nudge</button>}</div>)}</div>
      </section>
    </>
  );
}

// ---------- Spending and COA ----------
function Spend({ onToast }: { onToast: (s: string) => void }) {
  const [open, setOpen] = useState<Buy | null>(null);
  const used = BUDGET.ytd / BUDGET.annual;
  function auditPack() {
    const lines = [`COA audit pack · ${BCDA_NAME} · SAMPLE DATA (demo)`, `Generated ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`, "",
      `Budget: ${pS(BUDGET.annual)} approved · ${pS(BUDGET.ytd)} spent year to date (${pct(used)})`, `Audit trail complete: ${AUDIT.trail}% · open audit observations: ${AUDIT.aomsOpen}`, "",
      ...BUYS.flatMap((b) => [`${b.ref} · ${b.what}`, `  Amount ${pS(b.amount)} · ${b.mode} · ${b.philgeps ?? "not posted"} · ${b.quotes} quotes · ${b.status}`, ...b.steps.map(([s, ok]) => `  [${ok ? "x" : " "}] ${s}`), ""])];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "coa-audit-pack-sample.txt"; a.click(); URL.revokeObjectURL(url);
    onToast("Audit pack downloaded: every purchase with its documents checklist.");
  }
  return (
    <section id="bc-spend" className="grid g-7-5">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div><h3>Spending and procurement, COA audit-ready</h3><div className="hint">Every peso follows the government procurement law (RA 12009): planned, posted on PhilGEPS, compared, approved, inspected, then paid. Nothing is paid until every step has its document.</div></div>
          <button type="button" className="btn pri sm" onClick={auditPack}>⬇ COA audit pack</button>
        </div>
        <div className="bc-scroll"><table className="bc-tbl" style={{ marginTop: 8 }}><thead><tr><th>Purchase</th><th>Amount</th><th>Steps</th><th></th></tr></thead><tbody>
          {BUYS.map((b) => { const d = b.steps.filter((s) => s[1]).length; return <tr key={b.ref}><td><b>{b.what}</b><div className="hint">{b.ref} · {b.mode} · {b.quotes} quotes{b.saved ? ` · AI price check saved ${pS(b.saved)}` : ""}</div></td>
            <td className="num">{pS(b.amount)}</td><td><div className="g-meter" style={{ width: 70 }}><i style={{ width: `${(d / b.steps.length) * 100}%` }} /></div><span className="hint">{d}/{b.steps.length} · {b.status}</span></td>
            <td><button type="button" className="btn sm" onClick={() => setOpen(b)}>Trail</button></td></tr>; })}
        </tbody></table></div>
        {open && <div className="bc-trail" role="dialog" aria-label={`Audit trail for ${open.ref}`}>
          <div className="row" style={{ justifyContent: "space-between" }}><b>{open.ref} · {open.what}</b><button type="button" className="btn sm" onClick={() => setOpen(null)}>✕</button></div>
          <ol>{open.steps.map(([s, ok]) => <li key={s} className={ok ? "ok" : ""}>{ok ? "✓" : "○"} {s}{ok ? <span className="hint"> · document on file, timestamped, who approved</span> : <span className="hint"> · waiting</span>}</li>)}</ol>
        </div>}
      </div>
      <div className="card">
        <h3>Budget vs actual</h3>
        <div className="hint">Year to date. BCDA&apos;s scorecard asks for at least 90% budget utilization, spent on plan, not rushed in December.</div>
        <div className="bc-budget"><div><b className="num">{pS(BUDGET.ytd)}</b><span className="hint"> of {pS(BUDGET.annual)} · {pct(used)} used, plan {pct(BUDGET.plannedYtd / BUDGET.annual)}</span></div>
          <div className="g-meter"><i style={{ width: pct(used) }} /></div></div>
        {SPEND_LINES.map((s) => <div key={s.k} className="bc-line"><span>{s.k}</span><span className="num">{pS(s.ytd)}</span>{(() => { const d = Math.round((s.ytd / s.plan - 1) * 100); return <span className={"tag " + (d > 0 ? "t-warn" : "t-ok")}>{d === 0 ? "On plan" : `${d > 0 ? "+" : "−"}${Math.abs(d)}% vs plan`}</span>; })()}</div>)}
        <div className="grid g2" style={{ gap: 10, marginTop: 12 }}>
          <Mini k="Open COA observations" v={`${AUDIT.aomsOpen}`} d={`${AUDIT.aomsClosed} closed this year`} />
          <Mini k="Prices flagged by AI" v={`${AUDIT.priceFlags}`} d="above past buys or market, re-quoted" />
        </div>
      </div>
    </section>
  );
}

// ---------- small parts ----------
function Briefing({ text, ai }: { text: string; ai: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/₱/g, "").replace(/m²/g, "square metres"));
    const v = window.speechSynthesis.getVoices().find((x) => /en-PH/i.test(x.lang)) ?? window.speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v; u.rate = 1.02; u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u); setSpeaking(true);
  }
  return (
    <section className="card g-brief">
      <button type="button" className="g-play" onClick={speak} aria-label={speaking ? "Stop" : "Play the briefing"}>{speaking ? "■" : "▶"}</button>
      <div style={{ minWidth: 0 }}><div className="row" style={{ gap: 8 }}><h3>Today&apos;s building briefing for BCDA</h3><span className="tag t-acc">{ai ? "Written by AI" : "AI template"}</span></div><p>{text}</p></div>
    </section>
  );
}
function Mini({ k, v, d, warn }: { k: string; v: string; d?: string; warn?: boolean }) {
  return <div className={"bc-mini" + (warn ? " warn" : "")}><div className="k">{k}</div><div className="v num">{v}</div>{d && <div className="hint">{d}</div>}</div>;
}
function Bar({ label, v }: { label: string; v: number }) {
  return <div className="bc-bar"><span>{label}</span><div className="g-meter"><i style={{ width: `${v}%`, background: v >= 90 ? "var(--ok)" : v >= 80 ? "var(--accent)" : "var(--warn)" }} /></div><b className="num">{v}</b></div>;
}
function Dots({ n }: { n: number }) {
  return <span className="bc-dots" aria-label={`Condition ${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? (n <= 2 ? "bad" : n === 3 ? "mid" : "on") : ""} />)}</span>;
}
function Ring({ v }: { v: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return <span className="bc-ring"><b>{v}</b><svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true"><circle cx="39" cy="39" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8" />
    <circle cx="39" cy="39" r={r} fill="none" stroke="#ffd166" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 39 39)" />
    </svg></span>;
}
function Reserve() {
  const max = Math.max(...RESERVE.map((r) => r.need));
  return <svg viewBox="0 0 300 140" className="bc-chart" role="img" aria-label="Replacement reserve need by year">
    {RESERVE.map((r, i) => { const h = (r.need / max) * 100; return <g key={r.y}><rect x={i * 30 + 4} y={110 - h} width={22} height={h} rx="3" fill={r.need > 10 ? "#D55E00" : "#0072B2"} />
      <text x={i * 30 + 15} y={124} fontSize="9" textAnchor="middle" fill="var(--muted)">{String(r.y).slice(2)}</text>
      <text x={i * 30 + 15} y={106 - h} fontSize="8.5" textAnchor="middle" fill="var(--fg)">₱{r.need}M</text></g>; })}
  </svg>;
}
