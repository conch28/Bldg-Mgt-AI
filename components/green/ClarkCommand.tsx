"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ASSUMPTIONS, ALERTS, BUILDINGS, CITY_KPIS, DISTRICTS, MEASURES, MONTHS, MONTHLY_TARGET, PHASES, STAGES,
  type Alert, type DistrictKey, type Measure, type Metering, type Stage,
  cityDay, districtTotals, liveOf, manilaClock, paybackMonths, pesoYr, ranked,
} from "@/lib/clark";

const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const peso = (v: number) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; return a >= 1e9 ? `${s}₱${n1(a / 1e9)}B` : a >= 1e6 ? `${s}₱${n1(a / 1e6)}M` : a >= 1e4 ? `${s}₱${n0(a / 1e3)}k` : `${s}₱${n0(a)}`; };
const pw = (kw: number) => (kw >= 1000 ? `${n1(kw / 1000)} MW` : `${n0(kw)} kW`);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const SEV_CLS: Record<Alert["sev"], string> = { Critical: "t-bad", High: "t-warn", Medium: "t-acc" };
const STAGE_CLS: Record<Stage, string> = { Found: "t-mut", Approved: "t-acc", Installing: "t-warn", Live: "t-ok", Verified: "t-ok" };
const METER_COST: Record<Metering, string> = {
  "Modbus gateway": "₱15–30k per site", "CT clamp + LoRaWAN": "₱8–15k per panel", "Pulse reader + LoRaWAN": "₱3.5–7k per meter",
  "Camera OCR reader": "₱4–8k per meter", "AI photo reads": "₱0 (guard's phone)", "Bills only": "₱0, not yet metered",
};
const tone = (vs: number) => (vs <= -8 ? "#2f8a4e" : vs <= -5 ? "#0d8a84" : vs <= -2 ? "#c07a12" : "#c2412d");
const mapHref = (focus: string, alert?: string) => `/green/map?focus=${focus}${alert ? `&alert=${alert}` : ""}`;
const SECTIONS = [["live", "Live"], ["goals", "City goals"], ["alerts", "Alerts"], ["buildings", "Buildings"], ["pipeline", "Savings pipeline"], ["savings", "Savings to date"], ["rollout", "Monitoring rollout"]] as const;

export default function ClarkCommand({ now0, briefing, aiWritten }: { now0: number; briefing: string; aiWritten: boolean }) {
  const [now, setNow] = useState(now0);
  const [dist, setDist] = useState<DistrictKey | null>(null);
  const [wall, setWall] = useState(false);
  const [stages, setStages] = useState<Record<string, Stage>>(() => Object.fromEntries(MEASURES.map((m) => [m.id, m.stage])));
  const [assigned, setAssigned] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<"kw" | "vs" | "m3">("kw");
  const [toast, setToast] = useState("");

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 3000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (new URLSearchParams(location.search).get("wall") === "1") setWall(true); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("cc-wall", wall);
    const off = () => { if (!document.fullscreenElement) setWall(false); };
    document.addEventListener("fullscreenchange", off);
    return () => { document.removeEventListener("fullscreenchange", off); document.documentElement.classList.remove("cc-wall"); };
  }, [wall]);
  // Wall screens cycle through districts so the room sees every part of Clark.
  useEffect(() => {
    if (!wall) return;
    const keys: (DistrictKey | null)[] = [null, ...DISTRICTS.map((d) => d.key)];
    const t = setInterval(() => setDist((d) => keys[(keys.indexOf(d) + 1) % keys.length]), 12000);
    return () => clearInterval(t);
  }, [wall]);

  const toggleWall = () => {
    const next = !wall;
    setWall(next);
    if (next) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };

  const live = useMemo(() => BUILDINGS.map((bd) => ({ bd, ...liveOf(bd, now) })), [now]);
  const scope = dist ? live.filter((x) => x.bd.district === dist) : live;
  const kwNow = scope.reduce((s, x) => s + x.kw, 0);
  const m3hNow = scope.reduce((s, x) => s + x.m3h, 0);
  const tot = districtTotals(dist ?? undefined);
  const city = districtTotals();
  const day = useMemo(() => cityDay(dist ? BUILDINGS.filter((x) => x.district === dist) : BUILDINGS), [dist]);
  const clock = manilaClock(now);
  const measures = MEASURES.map((m) => ({ ...m, stage: stages[m.id] }));
  const liveM = measures.filter((m) => m.stage === "Live" || m.stage === "Verified");
  const pipeM = measures.filter((m) => m.stage !== "Live" && m.stage !== "Verified");
  const toDate = MONTHS.reduce((s, x) => s + x.peso, 0);
  const kwhToDate = MONTHS.reduce((s, x) => s + x.kwh, 0);
  const m3ToDate = MONTHS.reduce((s, x) => s + x.m3, 0);
  const alerts = [...ALERTS].filter((a) => !dist || BUILDINGS.find((b) => b.id === a.bldg)?.district === dist)
    .sort((a, c) => ["Critical", "High", "Medium"].indexOf(a.sev) - ["Critical", "High", "Medium"].indexOf(c.sev) || c.costDay - a.costDay);
  const dName = dist ? DISTRICTS.find((d) => d.key === dist)!.name : "All of Clark";

  const advance = (m: Measure) => {
    const i = STAGES.indexOf(stages[m.id]);
    if (i >= STAGES.length - 1) return;
    const next = STAGES[i + 1];
    setStages({ ...stages, [m.id]: next });
    setToast(`${m.title.split(":")[0]} moved to ${next}. Demo only, not saved.`);
  };

  return (
    <main className="view green cc">
      <section className="cc-hero">
        <div className="g-hero-top">
          <span className="g-pill">🛰️ Clark City · water and power command center</span>
          <span className="row" style={{ gap: 6 }}>
            <span className="g-pill cc-live"><i />LIVE · {hourLabel(clock.h).replace(" ", `:${String(clock.m).padStart(2, "0")} `)} Manila</span>
            <button type="button" className="g-pill cc-btn" onClick={toggleWall} aria-pressed={wall}>{wall ? "Exit wall screen" : "⛶ Wall screen"}</button>
          </span>
        </div>
        <h2>{dName}<small> · {dist ? DISTRICTS.find((d) => d.key === dist)!.blurb : `${city.count} buildings from New Clark City to Clark Freeport`}</small></h2>
        <p>Every meter in one place, AI watching it around the clock, and the fastest savings deployed first, so the people who live and work in Clark get cooler rooms, steady water and lower bills.</p>
        <div className="g-hero-stats cc-stats">
          <div><b className="num">{pw(kwNow)}</b><span>power being used right now</span></div>
          <div><b className="num">{n0(m3hNow)} m³/h</b><span>water flowing right now</span></div>
          <div><b className="num">−{n1((1 - tot.kwh / tot.kwhBase) * 100)}%</b><span>power vs baseline · water −{n1((1 - tot.m3 / tot.m3Base) * 100)}%</span></div>
          <div><b className="num">{peso(toDate)}</b><span>verified savings since {ASSUMPTIONS.start}</span></div>
          <div><b className="num">{alerts.length}</b><span>open alerts · {peso(alerts.reduce((s, a) => s + a.costDay, 0))}/day at stake</span></div>
          <div><b className="num">{tot.comfort.toFixed(1)}/5</b><span>comfort score from {n0(tot.people)} people</span></div>
        </div>
        <a className="cc-3d" href={mapHref(dist ?? "all")}><span aria-hidden="true">🌐</span><span><b>Open the 3D city</b><small>Fly over every building from New Clark City to Clark Freeport{dist ? `, starting at ${dName}` : ""}</small></span><span aria-hidden="true">→</span></a>
        <div className="g-disc">Illustrative sample data for a demo. Building names are generic and no real tenant&apos;s usage is shown. Rates assumed: ₱{ASSUMPTIONS.tariff}/kWh, ₱{ASSUMPTIONS.water}/m³.</div>
      </section>

      <nav className="g-jump" aria-label="Sections">{SECTIONS.map(([id, l]) => <a key={id} href={`#cc-${id}`} className="chip">{l}</a>)}<a href="/green" className="chip">← Sustainability demos</a></nav>

      <section className="card g-brief">
        <span className="g-play" aria-hidden="true" style={{ display: "grid", placeItems: "center" }}>🎙️</span>
        <div><b>AI briefing</b> <span className="tag t-mut">{aiWritten ? "written by AI from today's data" : "auto summary"}</span><p>{briefing}</p></div>
      </section>

      <section id="cc-live" className="grid cc-live-grid">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div><h3>Clark at a glance</h3><div className="hint">Circle size is power use; colour is the saving vs baseline. Tap a district.</div></div>
            <a className="btn sm" href={mapHref(dist ?? "all")}>🗺️ Open 3D map</a>
          </div>
          <CityMap sel={dist} onSel={setDist} now={now} />
          <div className="g-legend wrap"><i style={{ background: "#2f8a4e" }} />8%+ saved <i style={{ background: "#0d8a84" }} />5–8% <i style={{ background: "#c07a12" }} />2–5% <i style={{ background: "#c2412d" }} />under 2% <i style={{ background: "#c2412d", borderRadius: 99 }} />pulsing = open alert</div>
        </div>
        <div className="card">
          <h3>Power today · {dName}</h3>
          <div className="hint">Bars: this typical day. Dashed: the same day before the programme. Highlighted bar is now.</div>
          <DayBars day={day} hour={clock.h} />
          <table className="cc-dt">
            <thead><tr><th>District</th><th className="r">Now</th><th className="r">vs base</th><th className="r">Alerts</th></tr></thead>
            <tbody>
              {DISTRICTS.map((d) => {
                const t = districtTotals(d.key);
                const k = live.filter((x) => x.bd.district === d.key).reduce((s, x) => s + x.kw, 0);
                const al = ALERTS.filter((a) => BUILDINGS.find((b) => b.id === a.bldg)?.district === d.key).length;
                const vs = (t.kwh / t.kwhBase - 1) * 100;
                return (
                  <tr key={d.key} className={dist === d.key ? "on" : ""} onClick={() => setDist(dist === d.key ? null : d.key)} style={{ cursor: "pointer" }}>
                    <td><b>{d.name}</b><div className="hint">{d.zone} · {t.online}/{t.count} live</div></td>
                    <td className="r num">{pw(k)}</td>
                    <td className="r num" style={{ color: tone(vs) }}>{n1(vs)}%</td>
                    <td className="r">{al ? <span className="tag t-warn">{al}</span> : <span className="hint">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cc-goals" className="card">
        <div className="cardhead"><div><h3>City goals scorecard</h3><div className="hint">Water and power come first. These are the other KPIs we recommend BCDA tracks here, all fed by the same meters, sensors and pulse surveys. Figures with a source are public; the rest are sample data.</div></div></div>
        <div className="cc-kpis">
          {CITY_KPIS.map((k) => (
            <div key={k.k} className="cc-kpi">
              <div className="row" style={{ gap: 8 }}><span className="g-ico" style={{ width: 34, height: 34, fontSize: 17 }} aria-hidden="true">{k.icon}</span><div style={{ minWidth: 0 }}><span className="hint">{k.group}</span><b style={{ display: "block", lineHeight: 1.25 }}>{k.k}</b></div></div>
              <div className="cc-kv num">{k.v}</div>
              <div className="g-meter"><i style={{ width: `${Math.min(100, k.pct)}%` }} /></div>
              <div className="row hint" style={{ justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}><span>Target {k.target}</span><span>{k.trend}</span></div>
              <div className="hint">{k.why}</div>
              {k.src ? <a className="hint" href={k.src.url} target="_blank" rel="noreferrer">Source: {k.src.label}</a> : <span className="tag t-mut" style={{ alignSelf: "flex-start" }}>sample</span>}
            </div>
          ))}
        </div>
      </section>

      <section id="cc-alerts" className="card">
        <div className="cardhead"><div><h3>Alerts AI raised · {dName}</h3><div className="hint">Ranked by severity, then by pesos lost per day. Each one names the fix and who owns it.</div></div></div>
        <div className="cc-alerts">
          {alerts.length === 0 && <div className="hint">No open alerts here. 🎉</div>}
          {alerts.map((a) => {
            const bd = BUILDINGS.find((x) => x.id === a.bldg)!;
            const on = assigned[a.id] || a.status !== "New";
            return (
              <div key={a.id} className={"cc-alert s-" + a.sev.toLowerCase()}>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className={"tag " + SEV_CLS[a.sev]}>{a.sev}</span><span className="tag t-mut">{a.kind}</span><span className="hint">{a.since}</span></div>
                <b className="cc-at">{a.title}</b>
                <div className="hint">{bd.name} · {DISTRICTS.find((d) => d.key === bd.district)!.name}</div>
                <div className="cc-ad">{a.detail}</div>
                <div className="cc-afix"><b>Fix:</b> {a.action} <span className="hint">({a.owner})</span></div>
                <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                  <b className="num" style={{ color: a.costDay ? "var(--bad)" : "var(--muted)" }}>{a.costDay ? `${peso(a.costDay)}/day` : "Data gap"}</b>
                  <span className="row" style={{ gap: 6 }}>
                    <a className="btn sm" href={mapHref(bd.district, a.id)}>3D</a>
                    <button type="button" className={"btn sm" + (on ? "" : " pri")} disabled={on} onClick={() => { setAssigned({ ...assigned, [a.id]: true }); setToast(`Sent to ${a.owner}. Demo only, not saved.`); }}>{on ? (a.status === "New" ? "Assigned" : a.status) : "Assign"}</button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="cc-buildings" className="card">
        <div className="cardhead">
          <div><h3>Buildings · {dName}</h3><div className="hint">Live readings every few seconds. Green dot: meter reporting. Grey: not yet metered or offline.</div></div>
          <div className="r">{([["kw", "Power"], ["vs", "Saving"], ["m3", "Water"]] as const).map(([k, l]) => <button key={k} type="button" className={"chip" + (sort === k ? " on" : "")} onClick={() => setSort(k)}>{l}</button>)}</div>
        </div>
        <div className="cc-scroll">
          <table>
            <thead><tr><th>Building</th><th className="r">Power now</th><th className="r">Water now</th><th className="r">vs base</th><th>How it&apos;s metered</th><th className="r">Comfort</th></tr></thead>
            <tbody>
              {[...scope].sort((a, c) => (sort === "kw" ? c.kw - a.kw : sort === "m3" ? c.m3h - a.m3h : a.bd.vsBase - c.bd.vsBase)).map(({ bd, kw, m3h }) => (
                <tr key={bd.id}>
                  <td><span className={"cc-dot" + (bd.online ? " on" : "")} aria-label={bd.online ? "Reporting" : "Not reporting"} /> <b>{bd.name}</b><div className="hint">{bd.type} · {DISTRICTS.find((d) => d.key === bd.district)!.name} · <a href={mapHref(bd.district)}>see in 3D</a></div></td>
                  <td className="r num">{bd.online ? pw(kw) : "—"}</td>
                  <td className="r num">{bd.online ? `${n1(m3h)} m³/h` : "—"}</td>
                  <td className="r num" style={{ color: tone(bd.vsBase) }}>{bd.vsBase === 0 ? "no data" : `${bd.vsBase}%`}</td>
                  <td><span className="tag t-mut">{bd.meter}</span></td>
                  <td className="r num">{bd.comfort.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cc-pipeline" className="card">
        <div className="cardhead">
          <div><h3>Savings pipeline, fastest payback first</h3><div className="hint">Every idea goes Found → Approved → Installing → Live → Verified against the meters. Tap a stage to move it on (demo).</div></div>
        </div>
        <div className="grid g4" style={{ gap: 10 }}>
          <Mini k="Live now" v={`${peso(liveM.reduce((s, m) => s + pesoYr(m), 0))}/yr`} d={`${liveM.length} measures running`} good />
          <Mini k="In the pipeline" v={`${peso(pipeM.reduce((s, m) => s + pesoYr(m), 0))}/yr`} d={`${pipeM.length} measures`} />
          <Mini k="Upfront cost still needed" v={peso(pipeM.filter((m) => m.funding === "Own capex").reduce((s, m) => s + m.capex, 0))} d={`plus ${peso(pipeM.filter((m) => m.funding === "ESCO shared savings").reduce((s, m) => s + m.capex, 0))} paid by ESCO partners`} />
          <Mini k="Full programme" v={`${n0(measures.reduce((s, m) => s + pesoYr(m), 0) / (city.kwh * ASSUMPTIONS.tariff * 365 + city.m3 * ASSUMPTIONS.water * 365) * 100)}%`} d="of today's power and water spend" />
        </div>
        <div className="cc-funnel">
          {STAGES.map((s) => { const xs = measures.filter((m) => m.stage === s); return (
            <div key={s}><b>{s}</b><span className="num">{xs.length}</span><small>{peso(xs.reduce((a, m) => a + pesoYr(m), 0))}/yr</small></div>
          ); })}
        </div>
        <div className="cc-scroll">
          <table>
            <thead><tr><th>#</th><th>Measure</th><th className="r">Saves / yr</th><th className="r">Upfront</th><th className="r">Payback</th><th>Paid by</th><th>Stage</th></tr></thead>
            <tbody>
              {ranked(measures).map((m, i) => (
                <tr key={m.id}>
                  <td className="g-rank">{i + 1}</td>
                  <td><b>{m.title}</b><div className="hint">{m.what}</div><div className="hint">👥 {m.resident} · {m.sites} sites · ~{m.weeks} weeks</div></td>
                  <td className="r num"><b>{peso(pesoYr(m))}</b><div className="hint">{m.kwhYr ? `${n0(m.kwhYr / 1000)} MWh` : ""}{m.kwhYr && m.m3Yr ? " · " : ""}{m.m3Yr ? `${n0(m.m3Yr)} m³` : ""}{!m.kwhYr && !m.m3Yr ? (m.area === "Tariff" ? "lower price" : m.funding === "Solar PPA" ? "cheaper solar power" : "demand charges") : ""}</div></td>
                  <td className="r num">{m.capex ? peso(m.capex) : "₱0"}</td>
                  <td className="r num">{paybackMonths(m) === 0 ? "Day one" : paybackMonths(m) < 1 ? "< 1 mo" : `${n1(paybackMonths(m))} mo`}</td>
                  <td><span className="tag t-mut">{m.funding}</span></td>
                  <td><button type="button" className={"tag cc-stage " + STAGE_CLS[m.stage]} onClick={() => advance(m)} disabled={m.stage === "Verified"} title={m.stage === "Verified" ? "Verified against the meters" : "Move to the next stage (demo)"}>{m.stage === "Verified" ? "✓ " : ""}{m.stage}{m.stage !== "Verified" ? " →" : ""}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cc-savings" className="grid g-7-5">
        <div className="card">
          <h3>Savings to date</h3>
          <div className="hint">Verified each month against the metered baseline, adjusted for weather and occupancy (IPMVP).</div>
          <MonthBars />
          <div className="grid g3" style={{ gap: 10, marginTop: 10 }}>
            <Mini k="Pesos saved" v={peso(toDate)} d={`since ${ASSUMPTIONS.start}`} good />
            <Mini k="Power saved" v={`${n1(kwhToDate / 1e6)} GWh`} d={`${n0((kwhToDate / 1000) * ASSUMPTIONS.ef)} t CO₂ avoided`} />
            <Mini k="Water saved" v={`${n0(m3ToDate)} m³`} d={`≈ ${n0(m3ToDate / 0.2 / 365)} homes for a year`} />
          </div>
        </div>
        <div className="card">
          <h3>What people feel</h3>
          <div className="hint">Savings only count if comfort holds. Weekly one-tap pulse from residents, workers and guests.</div>
          <ul className="cc-feel">
            <li><b>🌡️ Fewer &quot;too hot&quot; and &quot;too cold&quot; complaints</b><span>−41% since setpoints were tuned. Offices no longer freeze at 20°C.</span></li>
            <li><b>💧 Water problems fixed faster</b><span>Leaks found by AI at night, fixed in 31 hours on average (was 9 days).</span></li>
            <li><b>💡 Brighter parking and stairs</b><span>LED with sensors: always lit where people walk.</span></li>
            <li><b>🧾 Lower dues and bills</b><span>Building savings passed through to dues, rents and service charges.</span></li>
          </ul>
        </div>
      </section>

      <section id="cc-rollout" className="grid g-7-5">
        <div className="card">
          <h3>How we monitor Clark cheaply and fast</h3>
          <div className="hint">Start with the meters already on the wall. Add hardware only where the money is.</div>
          <div className="cc-phases">
            {PHASES.map((p) => (
              <div key={p.title} className={"cc-phase" + (p.done ? " done" : "")}>
                <span className="cc-pdot" aria-hidden="true">{p.done ? "✓" : ""}</span>
                <div><div className="row" style={{ gap: 8, flexWrap: "wrap" }}><b>{p.title}</b><span className="tag t-mut">{p.when}</span><span className="tag t-acc">{p.cost}</span></div><div className="hint" style={{ marginTop: 3 }}>{p.body}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Metering coverage</h3>
          <div className="hint">{city.online} of {city.count} buildings reporting live.</div>
          <div className="g-meter" style={{ height: 10 }}><i style={{ width: `${(city.online / city.count) * 100}%` }} /></div>
          <table style={{ marginTop: 10 }}>
            <tbody>
              {(Object.keys(METER_COST) as Metering[]).map((k) => { const c = BUILDINGS.filter((x) => x.meter === k).length; return (
                <tr key={k}><td><b>{k}</b><div className="hint">{METER_COST[k]}</div></td><td className="r num">{c}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="hint" style={{ textAlign: "center" }}>Sample data for a demo. Full plan with costs, timeline and payback: docs/clark-command-center/plan.md.</div>
      {toast && <div className="toasts" role="status"><div className="toast">{toast}</div></div>}
    </main>
  );
}

function Mini({ k, v, d, good }: { k: string; v: string; d?: string; good?: boolean }) {
  return <div className="g-mini"><div className="k">{k}</div><div className="v num" style={good ? { color: "var(--ok)" } : undefined}>{v}</div>{d && <div className="d">{d}</div>}</div>;
}

function CityMap({ sel, onSel, now }: { sel: DistrictKey | null; onSel: (k: DistrictKey | null) => void; now: number }) {
  const max = Math.max(...DISTRICTS.map((d) => districtTotals(d.key).kwh));
  return (
    <svg viewBox="0 0 400 560" className="cc-map" role="img" aria-label="Schematic map of Clark districts">
      <path d="M200 10 C 210 120, 180 240, 205 300 S 230 470, 215 560" className="cc-road" />
      <rect x="10" y="10" width="380" height="225" rx="16" className="cc-zone" />
      <rect x="10" y="300" width="380" height="250" rx="16" className="cc-zone" />
      <text x="24" y="32" className="cc-zl">NEW CLARK CITY · Capas, Tarlac</text>
      <text x="24" y="322" className="cc-zl">CLARK FREEPORT · Angeles and Mabalacat</text>
      <text x="212" y="272" className="cc-zl">Expressway, ~20 km</text>
      {DISTRICTS.map((d) => {
        const t = districtTotals(d.key);
        const vs = (t.kwh / t.kwhBase - 1) * 100;
        const r = 14 + 30 * Math.sqrt(t.kwh / max);
        const al = ALERTS.some((a) => BUILDINGS.find((b) => b.id === a.bldg)?.district === d.key && a.sev !== "Medium");
        const kwNow = BUILDINGS.filter((b) => b.district === d.key).reduce((s, b) => s + liveOf(b, now).kw, 0);
        return (
          <g key={d.key} className={"cc-node" + (sel === d.key ? " on" : "")} onClick={() => onSel(sel === d.key ? null : d.key)} role="button" tabIndex={0} aria-label={`${d.name}: ${pw(kwNow)}`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSel(sel === d.key ? null : d.key); }}>
            {al && <circle cx={d.x} cy={d.y} r={r + 4} className="cc-pulse" />}
            <circle cx={d.x} cy={d.y} r={r} fill={tone(vs)} fillOpacity={0.85} stroke={sel === d.key ? "var(--fg)" : "#fff"} strokeWidth={sel === d.key ? 3 : 1.5} />
            <text x={d.x} y={d.y + 4} textAnchor="middle" className="cc-nv">{pw(kwNow)}</text>
            <text x={d.x} y={d.y + r + 14} textAnchor="middle" className="cc-nl">{d.name.replace(" (concept)", "*")}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DayBars({ day, hour }: { day: { h: number; now: number; base: number }[]; hour: number }) {
  const W = 720, H = 170, max = Math.max(...day.map((d) => d.base)) * 1.05, bw = W / 24;
  const y = (v: number) => H - (v / max) * H;
  const line = day.map((d, i) => `${i ? "L" : "M"}${i * bw + bw / 2},${y(d.base)}`).join(" ");
  return (
    <svg viewBox={`0 -6 ${W} ${H + 24}`} style={{ width: "100%", marginTop: 8 }} role="img" aria-label="Power by hour today versus baseline">
      {day.map((d, i) => <rect key={i} x={i * bw + 2} y={y(d.now)} width={bw - 4} height={H - y(d.now)} rx={2} fill={i === hour ? "var(--accent)" : "var(--accent-soft)"} />)}
      <path d={line} fill="none" stroke="var(--fg)" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={1.5} />
      {[0, 6, 12, 18, 23].map((h) => <text key={h} x={h * bw + bw / 2} y={H + 16} textAnchor="middle">{hourLabel(h)}</text>)}
      <text x={W} y={8} textAnchor="end">peak {pw(Math.max(...day.map((d) => d.now)))}</text>
    </svg>
  );
}

function MonthBars() {
  const W = 640, H = 170, max = Math.max(MONTHLY_TARGET, ...MONTHS.map((m) => m.peso)) * 1.1, bw = W / MONTHS.length;
  const y = (v: number) => H - (v / max) * H;
  let cum = 0;
  return (
    <svg viewBox={`0 -6 ${W} ${H + 26}`} style={{ width: "100%", marginTop: 8 }} role="img" aria-label="Verified savings by month">
      <line x1={0} x2={W} y1={y(MONTHLY_TARGET)} y2={y(MONTHLY_TARGET)} stroke="var(--warn)" strokeDasharray="5 4" />
      <text x={W} y={y(MONTHLY_TARGET) - 4} textAnchor="end">monthly target {peso(MONTHLY_TARGET)}</text>
      {MONTHS.map((m, i) => { cum += m.peso; return (
        <g key={m.m}>
          <rect x={i * bw + 10} y={y(m.peso)} width={bw - 20} height={H - y(m.peso)} rx={4} fill="var(--ok)" />
          <text x={i * bw + bw / 2} y={y(m.peso) - 5} textAnchor="middle">{peso(m.peso)}</text>
          <text x={i * bw + bw / 2} y={H + 15} textAnchor="middle">{m.m} · Σ {peso(cum)}</text>
        </g>
      ); })}
    </svg>
  );
}

