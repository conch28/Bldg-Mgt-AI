"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SlaTimer from "@/components/SlaTimer";
import type { TwinData, TwinState, TwinTicket, TwinUnit, TwinZone } from "@/lib/building";
import type { TwinScene, Paint } from "./scene";
import { SITE, STACKS, TOWERS, towerLabel } from "@/lib/skyland";
import { peso, fmtDate } from "@/lib/format";

type Mode = "tickets" | "happy" | "occ" | "market" | "dues";
type Cat = { k: string; label: string; color: string };
/** Colour-blind-safe palettes: Okabe-Ito for categories, a blue→red ramp for how late dues are. */
const NEUTRAL = { light: "#e3e9ef", dark: "#2b3b52" };
const LENS: Record<"occ" | "market" | "dues", { name: string; hint: string; cats: Cat[]; of: (u: TwinUnit) => string; staffOnly?: boolean }> = {
  occ: { name: "Occupancy", hint: "Who lives in each unit: the owner, a tenant on a current lease, or nobody.", of: (u) => u.occ, cats: [
    { k: "OWNER", label: "Owner lives here", color: "#0072B2" }, { k: "LEASED", label: "Leased", color: "#E69F00" },
    { k: "VACANT", label: "Vacant", color: "#CC79A7" }, { k: "UNKNOWN", label: "Not recorded", color: "" },
  ] },
  market: { name: "Listings", hint: "Units listed for sale or for lease right now.", of: (u) => u.market, cats: [
    { k: "SALE", label: "For sale", color: "#D55E00" }, { k: "LEASE", label: "For lease", color: "#009E73" }, { k: "NONE", label: "Not listed", color: "" },
  ] },
  dues: { name: "Dues", hint: "Association dues by unit. Tap a group to list the units.", of: (u) => u.dues, cats: [
    { k: "PAID", label: "Paid up", color: "#4575b4" }, { k: "DUE", label: "Due this month, not late", color: "#91bfdb" },
    { k: "LATE30", label: "1-30 days late", color: "#fdae61" }, { k: "LATE90", label: "31-90 days late", color: "#f46d43" }, { k: "LATE90P", label: "Over 90 days late", color: "#a50026" },
  ] },
};
const isLens = (m: Mode): m is keyof typeof LENS => m in LENS;
const MODES: { k: Mode; label: string }[] = [{ k: "tickets", label: "Repairs" }, { k: "happy", label: "Happiness" }, { k: "occ", label: "Occupancy" }, { k: "market", label: "Listings" }, { k: "dues", label: "Dues" }];
type View = "3d" | "2d";

const STATE_COLOR: Record<string, string> = { red: "#ef4444", amber: "#f59e0b", green: "#22c55e", watch: "#a78bfa" };
const STATE_WORD: Record<string, string> = { red: "Needs action", amber: "Being fixed", green: "Fixed in last 48h", watch: "Early warning" };
const RANK: Record<string, number> = { red: 0, amber: 1, watch: 2, green: 3 };

/** 0-100 happiness → red…amber…green */
export const happyColor = (s: number) => `hsl(${Math.round(Math.max(0, Math.min(100, s)) * 1.25)}, 72%, ${s < 50 ? 52 : 45}%)`;

const ago = (ms: number) => { const h = Math.round(ms / 3600000); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };
const STATUS_WORD: Record<string, string> = { NEW: "New, not assigned", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", ESCALATED: "Escalated", DONE: "Fixed" };

function readDark() {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function lowEndDevice() {
  const n = navigator as Navigator & { deviceMemory?: number };
  if ((n.deviceMemory ?? 8) <= 2 || (n.hardwareConcurrency ?? 8) <= 2) return true;
  try { const c = document.createElement("canvas"); return !(c.getContext("webgl2") || c.getContext("webgl")); } catch { return true; }
}

export default function BuildingTwin({ data, staff, compact }: { data: TwinData; staff: boolean; compact?: boolean }) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TwinScene | null>(null);
  const [mode, setModeRaw] = useState<Mode>("tickets");
  const [only, setOnly] = useState<string | null>(null); // isolate one legend group
  const setMode = (m: Mode) => { setModeRaw(m); setOnly(null); setSel(null); };
  const [view, setView] = useState<View | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [motion, setMotion] = useState(true);
  const [dark, setDark] = useState(false);
  const [labels, setLabels] = useState(true);
  const labelsRef = useRef(true);
  useEffect(() => { labelsRef.current = labels; sceneRef.current?.setLabels(labels); }, [labels]);

  const unitBy = useMemo(() => new Map(data.units.map((u) => [u.code, u])), [data.units]);
  const zoneBy = useMemo(() => new Map(data.zones.map((z) => [z.id, z])), [data.zones]);

  // choose 3D or the light 2D view once on the client
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotion(!reduce);
    setDark(readDark());
    let saved: string | null = null;
    try { saved = localStorage.getItem("twin-view"); } catch { /* private mode */ }
    setView(saved === "2d" || saved === "3d" ? (saved as View) : lowEndDevice() ? "2d" : "3d");
    const mo = new MutationObserver(() => setDark(readDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => setDark(readDark());
    mq.addEventListener("change", onMq);
    return () => { mo.disconnect(); mq.removeEventListener("change", onMq); };
  }, []);
  const pickView = (v: View) => { setView(v); setFailed(false); try { localStorage.setItem("twin-view", v); } catch { /* ignore */ } };

  // live: refresh the server data every 30 seconds while the page is visible
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, 30000);
    return () => clearInterval(t);
  }, [router]);

  // build the 3D scene
  useEffect(() => {
    if (view !== "3d" || !host.current) return;
    let alive = true;
    import("./scene").then(({ createTwinScene }) => {
      if (!alive || !host.current) return;
      try {
        sceneRef.current = createTwinScene({
          host: host.current, dark: readDark(), motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          units: data.units.map((u) => ({ key: u.code })),
          onPick: (k) => setSel(k),
        });
        setFailed(false);
        repaint();
        sceneRef.current.setLabels(labelsRef.current);
      } catch (e) { console.error("3D view failed", e); setFailed(true); }
    }).catch((e) => { console.error("3D view failed to load", e); setFailed(true); });
    return () => { alive = false; sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data.units.length]);

  const lensCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (isLens(mode)) for (const u of data.units) { const k = LENS[mode].of(u); m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [data.units, mode]);
  const neutral = dark ? NEUTRAL.dark : NEUTRAL.light;
  const lensCat = (u: TwinUnit) => (isLens(mode) ? LENS[mode].cats.find((c) => c.k === LENS[mode].of(u)) : undefined);
  const unitColor = (u: TwinUnit) => {
    if (isLens(mode)) { const c = lensCat(u); return !c || !c.color || (only && c.k !== only) ? neutral : c.color; }
    if (mode === "happy") return u.happy != null ? happyColor(u.happy) : dark ? "#2b3b52" : "#e8eef4";
    return u.state ? STATE_COLOR[u.state] : dark ? "#33465f" : "#eef3f8";
  };
  function repaint() {
    const s = sceneRef.current;
    if (!s) return;
    const list: Paint[] = data.units.map((u) => ({ key: u.code, color: unitColor(u),
      glow: isLens(mode) ? (only && lensCat(u)?.k === only && (lensCounts.get(only) ?? 0) <= 60 ? lensCat(u)!.color : mode === "dues" && !only && u.dues === "LATE90P" ? "red" : null)
        : mode === "tickets" && u.state && u.state !== "green" ? u.state : mode === "happy" && u.happy != null && u.happy < 40 ? "red" : null }));
    if (mode === "tickets") for (const z of data.zones) if (z.state && z.state !== "green") list.push({ key: "zone:" + z.id, color: "", glow: z.state });
    s.paint(list);
  }
  useEffect(() => { repaint(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [data, mode, only, dark, view]);
  useEffect(() => { sceneRef.current?.setTheme(dark); }, [dark]);
  useEffect(() => { if (sel) sceneRef.current?.select(sel); else sceneRef.current?.reset(); }, [sel]);

  const attention = useMemo(() => {
    const items: { key: string; label: string; state: TwinState; sub: string }[] = [];
    for (const u of data.units) if (u.state && u.state !== "green") {
      const t = u.tickets.find((x) => x.status !== "DONE");
      items.push({ key: u.code, label: `Unit ${u.code}`, state: u.state, sub: u.sos ? `SOS: ${u.sos.kind.toLowerCase()}` : t ? t.title : u.watch ?? "" });
    }
    for (const z of data.zones) if (z.state && z.state !== "green") {
      const t = z.tickets.find((x) => x.status !== "DONE");
      items.push({ key: "zone:" + z.id, label: z.label, state: z.state, sub: t ? `${t.title} (${z.locations.map(titleCase).join(", ")})` : z.watch ?? "" });
    }
    return items.sort((a, b) => RANK[a.state!] - RANK[b.state!]);
  }, [data]);

  const lowHappy = useMemo(() => data.units.filter((u) => u.happy != null && u.happy < 50).sort((a, b) => a.happy! - b.happy!), [data.units]);
  const selected = sel ? (sel.startsWith("zone:") ? zoneBy.get(sel.slice(5) as TwinZone["id"]) : unitBy.get(sel)) : null;

  return (
    <div className={"card twin" + (compact ? " compact" : "")}>
      <div className="twin-head">
        <div style={{ minWidth: 0 }}>
          <span className="ai-badge">Live</span>
          <h3 style={{ marginTop: 4 }}>{data.building}, live</h3>
          <div className="hint">{isLens(mode) ? LENS[mode].hint : mode === "tickets" ? "Units flash red until the problem is fixed. Tap any unit." : `Resident happiness by unit, last 90 days${data.happyAvg != null ? ` · average ${data.happyAvg}` : ""}`}</div>
        </div>
        <div className="twin-ctrl">
          <div className="seg2 lens" role="tablist" aria-label="Colour units by">
            {MODES.map((m) => <button key={m.k} role="tab" aria-selected={mode === m.k} className={mode === m.k ? "on" : ""} onClick={() => setMode(m.k)}>{m.label}</button>)}
          </div>
          <div className="seg2" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "3d"} className={view === "3d" ? "on" : ""} onClick={() => pickView("3d")}>3D</button>
            <button role="tab" aria-selected={view === "2d"} className={view === "2d" ? "on" : ""} onClick={() => pickView("2d")}>2D</button>
          </div>
        </div>
      </div>

      <div className="twin-legend">
        {isLens(mode) ? LENS[mode].cats.map((c) => (
          <button key={c.k} className={"lg-btn" + (only === c.k ? " on" : "") + (only && only !== c.k ? " off" : "")} aria-pressed={only === c.k}
            onClick={() => { setOnly(only === c.k ? null : c.k); setSel(null); }} title={only === c.k ? "Show all" : `Show only: ${c.label}`}>
            <i className="lg" style={{ background: c.color || neutral, outline: c.color ? undefined : "1px solid var(--line)" }} />{c.label} <b className="num">{lensCounts.get(c.k) ?? 0}</b>
          </button>
        )) : mode === "tickets" ? (["red", "amber", "green", "watch"] as const).map((k) => (
          <span key={k}><i className={"lg " + k} style={{ background: STATE_COLOR[k] }} />{STATE_WORD[k]} <b className="num">{data.counts[k]}</b></span>
        )) : (
          <span className="happy-scale"><i style={{ background: happyColor(10) }} />Unhappy<i style={{ background: happyColor(55) }} />Mixed<i style={{ background: happyColor(90) }} />Happy<i style={{ background: dark ? "#2b3b52" : "#d3dce6" }} />No rating yet</span>
        )}
      </div>

      <div className="twin-legend twin-areas" aria-label="Building areas">
        <span className="hint">Areas:</span>
        <button className="lg-btn" onClick={() => setSel("zone:lobby")}><i className="lg" style={{ background: dark ? "#2bb3a3" : "#5fd0c2" }} />Shared spaces</button>
        <button className="lg-btn" onClick={() => setSel("zone:parking")}><i className="lg" style={{ background: "#6b7d96", backgroundImage: "repeating-linear-gradient(90deg,transparent 0 3px,#fff 3px 4px)" }} />Parking B1-B2</button>
        <button className="lg-btn" onClick={() => setSel("zone:amenity")}>Pool deck &amp; {SITE.amenityFloor}F amenities</button>
        <button className="lg-btn" onClick={() => setSel("zone:core")}>Lifts &amp; systems</button>
      </div>

      <div className="twin-body">
        <div className="twin-stage">
          {view === "3d" && !failed && (
            <>
              <div ref={host} className="twin-canvas" aria-label={`3D model of ${data.building}. Use the list beside it to open each unit.`} role="img" />
              <div className="twin-nav" role="group" aria-label="Move the view">
                <button className="twin-nb" aria-label="Zoom in" title="Zoom in" onClick={() => sceneRef.current?.zoom(0.75)}>+</button>
                <button className="twin-nb" aria-label="Zoom out" title="Zoom out" onClick={() => sceneRef.current?.zoom(1.33)}>&minus;</button>
                <span className="twin-nsep" />
                <button className="twin-nb" aria-label="Move up the towers" title="Higher floors" onClick={() => sceneRef.current?.pan(5)}>&#9650;</button>
                <button className="twin-nb" aria-label="Move down the towers" title="Lower floors" onClick={() => sceneRef.current?.pan(-5)}>&#9660;</button>
                <span className="twin-nsep" />
                <button className={"twin-nb" + (labels ? " on" : "")} aria-pressed={labels} aria-label="Show area labels" title="Area labels" onClick={() => setLabels(!labels)} style={{ fontSize: 13 }}>Aa</button>
                <button className="twin-nb" aria-label="Reset view" title="Reset view" onClick={() => { if (sel) setSel(null); else sceneRef.current?.reset(); }}>&#8634;</button>
              </div>
              <div className="twin-hint hint">Drag sideways to turn · pinch or Ctrl+scroll to zoom · tap a unit</div>
            </>
          )}
          {(view === "2d" || failed) && <Stack2D data={data} mode={mode} sel={sel} onPick={setSel} color={unitColor} motion={motion} />}
          {view === null && <div className="twin-canvas" />}
          {failed && <div className="hint" style={{ padding: "6px 2px" }}>3D isn&apos;t available on this device, so here is the flat view.</div>}
        </div>

        <aside className="twin-panel" aria-live="polite">
          {selected ? (
            "code" in selected ? <UnitPanel u={selected} staff={staff} onClose={() => setSel(null)} /> : <ZonePanel z={selected} onClose={() => setSel(null)} />
          ) : isLens(mode) ? (
            <LensList lens={mode} units={data.units} only={only} counts={lensCounts} onOnly={setOnly} onPick={setSel} staff={staff} />
          ) : mode === "tickets" ? (
            <>
              <h4>Needs attention <span className="hint">({attention.length})</span></h4>
              {attention.length === 0 && <div className="hint">All clear. No open problems in the building.</div>}
              <div className="twin-list">
                {attention.slice(0, compact ? 6 : 10).map((a) => (
                  <button key={a.key} className="twin-item" onClick={() => setSel(a.key)}>
                    <i className={"dotp " + a.state} style={{ background: STATE_COLOR[a.state!] }} />
                    <span style={{ minWidth: 0 }}><b>{a.label}</b><span className="hint ell">{a.sub}</span></span>
                  </button>
                ))}
                {attention.length > (compact ? 6 : 10) && <Link href="/work-orders" className="hint" style={{ padding: "4px 8px" }}>+{attention.length - (compact ? 6 : 10)} more in Work orders</Link>}
              </div>
            </>
          ) : (
            <>
              <h4>Residents to check on <span className="hint">({lowHappy.length})</span></h4>
              {lowHappy.length === 0 && <div className="hint">No unit is averaging below 50 right now.</div>}
              <div className="twin-list">
                {lowHappy.slice(0, 8).map((u) => (
                  <button key={u.code} className="twin-item" onClick={() => setSel(u.code)}>
                    <i className="dotp" style={{ background: happyColor(u.happy!) }} />
                    <span style={{ minWidth: 0 }}><b>Unit {u.code} · {u.happy}</b><span className="hint ell">{u.lastComment ? `"${u.lastComment}"` : `${u.happyN} rating${u.happyN === 1 ? "" : "s"}`}</span></span>
                  </button>
                ))}
              </div>
              {staff && <Link href="/happiness" className="btn sm" style={{ marginTop: 8 }}>Open happiness</Link>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The list beside the model for the occupancy, listings and dues views (also the accessible fallback). */
function LensList({ lens, units, only, counts, onOnly, onPick, staff }: { lens: keyof typeof LENS; units: TwinUnit[]; only: string | null; counts: Map<string, number>; onOnly: (k: string | null) => void; onPick: (k: string) => void; staff: boolean }) {
  const L = LENS[lens];
  const total = units.length;
  if (!only) return (
    <>
      <h4>{L.name} <span className="hint">({total} units)</span></h4>
      <div className="twin-list">
        {L.cats.map((c) => {
          const n = counts.get(c.k) ?? 0;
          return (
            <button key={c.k} className="twin-item" onClick={() => onOnly(c.k)} disabled={!n}>
              <i className="dotp" style={{ background: c.color || "var(--line)" }} />
              <span style={{ minWidth: 0, flex: 1 }}><b>{c.label}</b><span className="hint ell">{n} unit{n === 1 ? "" : "s"} · {Math.round((n / total) * 100)}%</span></span>
              <span className="lens-bar" aria-hidden="true"><i style={{ width: `${(n / total) * 100}%`, background: c.color || "var(--line)" }} /></span>
            </button>
          );
        })}
      </div>
      {lens === "dues" && staff && <Link href="/collections" className="btn sm" style={{ marginTop: 8 }}>Open collections</Link>}
    </>
  );
  const cat = L.cats.find((c) => c.k === only)!;
  const rows = units.filter((u) => L.of(u) === only).sort((a, b) => lens === "dues" ? b.daysLate - a.daysLate || b.balance - a.balance : lens === "market" ? (b.price ?? 0) - (a.price ?? 0) : a.code.localeCompare(b.code, "en", { numeric: true }));
  const sub = (u: TwinUnit) => lens === "dues" ? (u.dues === "PAID" ? "Paid up" : `${peso(u.balance)}${u.daysLate ? ` · ${u.daysLate} days late` : " due this month"}`)
    : lens === "market" ? (u.price ? `${peso(u.price)}${u.market === "LEASE" ? "/mo" : ""} · ${u.sqm} sqm` : `${u.sqm} sqm`)
      : u.occ === "LEASED" && u.leaseEnd ? `Lease ends ${fmtDate(new Date(u.leaseEnd))}` : `${u.sqm} sqm · ${u.owner ?? "owner not registered"}`;
  return (
    <>
      <div className="twin-ph">
        <h4><i className="dotp" style={{ background: cat.color || "var(--line)", marginRight: 6 }} />{cat.label} <span className="hint">({rows.length})</span></h4>
        <button className="btn sm" onClick={() => onOnly(null)}>Show all</button>
      </div>
      <div className="twin-list">
        {rows.slice(0, 40).map((u) => (
          <button key={u.code} className="twin-item" onClick={() => onPick(u.code)}>
            <span style={{ minWidth: 0 }}><b>Unit {u.code}</b><span className="hint ell">{sub(u)}</span></span>
          </button>
        ))}
        {rows.length > 40 && <div className="hint" style={{ padding: "4px 8px" }}>+{rows.length - 40} more</div>}
      </div>
    </>
  );
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function TicketRow({ t }: { t: TwinTicket }) {
  const open = t.status !== "DONE";
  return (
    <div className="twin-ticket">
      <div className="row1"><b>{t.title}</b></div>
      <div className="hint">WO-{t.n} · {t.category} · {STATUS_WORD[t.status] ?? t.status}{t.assignee ? ` · ${t.assignee}` : ""} · via {t.source}</div>
      <div style={{ marginTop: 4 }}>
        {open ? <><span className="hint">Deadline: </span><SlaTimer deadline={t.deadline} /></> : <span className="tag t-ok">Fixed {t.closedAt ? ago(Date.now() - t.closedAt) : ""}{t.rating ? ` · rated ${t.rating}★` : ""}</span>}
      </div>
      {t.photo && <img src={t.photo} alt={`Photo for WO-${t.n}`} className="twin-photo" />}
      {t.aiNote && <div className="twin-ai"><span className="ai-badge">AI saw</span> {t.aiNote}</div>}
    </div>
  );
}

function UnitPanel({ u, staff, onClose }: { u: TwinUnit; staff: boolean; onClose: () => void }) {
  const open = u.tickets.filter((t) => t.status !== "DONE");
  const done = u.tickets.filter((t) => t.status === "DONE");
  return (
    <div>
      <div className="twin-ph">
        <div><h4>Unit {u.code}</h4><div className="hint">{towerLabel(u.tower)} · {u.penthouse ? `Penthouse, floors ${u.floor}-${u.floor + 1}` : `Floor ${u.floor}`}{u.state ? ` · ${STATE_WORD[u.state]}` : " · No open issues"}</div></div>
        <button className="btn sm" onClick={onClose} aria-label="Close">Close</button>
      </div>
      <div className="twin-people">
        <div><span className="hint">Owner</span><b>{u.owner ?? "Not registered yet"}</b></div>
        {u.tenant && <div><span className="hint">Tenant</span><b>{u.tenant}</b></div>}
        {u.happy != null && <div><span className="hint">Happiness</span><b style={{ color: happyColor(u.happy) }}>{u.happy}/100</b><span className="hint"> · {u.happyN} rating{u.happyN === 1 ? "" : "s"}</span></div>}
      </div>
      <div className="twin-people">
        <div><span className="hint">Lives here</span><b>{u.occ === "LEASED" ? `Tenant${u.leaseEnd ? `, lease until ${fmtDate(new Date(u.leaseEnd))}` : ""}` : u.occ === "OWNER" ? "Owner" : u.occ === "VACANT" ? "Nobody (vacant)" : "Not recorded"}</b></div>
        {u.market !== "NONE" && <div><span className="hint">Listed</span><b>For {u.market === "SALE" ? "sale" : "lease"}{u.price ? ` · ${peso(u.price)}${u.market === "LEASE" ? "/mo" : ""}` : ""}</b></div>}
        <div><span className="hint">Dues</span><b style={{ color: u.dues.startsWith("LATE") ? "#d55e00" : undefined }}>{u.dues === "PAID" ? "Paid up" : u.dues === "DUE" ? `${peso(u.balance)} due this month` : `${peso(u.balance)} unpaid · ${u.daysLate} days late`}</b></div>
        <div><span className="hint">Size</span><b>{u.sqm} sqm</b></div>
      </div>
      {u.lastComment && <div className="twin-quote">&ldquo;{u.lastComment}&rdquo;</div>}
      {u.sos && <div className="twin-warn bad"><b>SOS: {u.sos.kind.toLowerCase()}</b> · {ago(Date.now() - u.sos.at)}. <Link href="/sos">Respond</Link></div>}
      {u.watch && <div className="twin-warn watch"><b>Early warning:</b> {u.watch}</div>}
      {open.map((t) => <TicketRow key={t.n} t={t} />)}
      {done.map((t) => <TicketRow key={t.n} t={t} />)}
      {!u.tickets.length && !u.sos && <div className="hint" style={{ marginTop: 8 }}>No repairs open or fixed in the last 48 hours.</div>}
      {staff && (
        <div className="twin-actions">
          {u.phone && <a className="btn sm" href={`tel:${u.phone.replace(/\s/g, "")}`}>Call owner</a>}
          <Link className="btn sm pri" href="/work-orders">{open.length ? "Open in Work orders" : "New work order"}</Link>
        </div>
      )}
    </div>
  );
}

function ZonePanel({ z, onClose }: { z: TwinZone; onClose: () => void }) {
  return (
    <div>
      <div className="twin-ph">
        <div><h4>{z.label}</h4><div className="hint">{z.state ? STATE_WORD[z.state] : "No open issues"}</div></div>
        <button className="btn sm" onClick={onClose} aria-label="Close">Close</button>
      </div>
      <div className="hint" style={{ margin: "6px 0" }}>{z.about}</div>
      {z.watch && <div className="twin-warn watch"><b>Early warning:</b> {z.watch}</div>}
      {z.tickets.map((t) => <TicketRow key={t.n} t={t} />)}
      {!z.tickets.length && <div className="hint" style={{ marginTop: 8 }}>No repairs open or fixed in the last 48 hours.</div>}
      {z.info.map((g) => (
        <details key={g.head} className="twin-info" open={z.id === "amenity"}>
          <summary><b>{g.head}</b></summary>
          {g.rows.length ? g.rows.slice(0, 60).map((r, i) => <div key={i} className="twin-irow"><span>{r.label}</span><span className="hint">{r.sub}</span></div>) : <div className="hint">None today.</div>}
          {g.rows.length > 60 && <div className="hint">+{g.rows.length - 60} more</div>}
        </details>
      ))}
      {z.id === "amenity" && <Link className="btn sm" href="/amenities" style={{ marginTop: 8 }}>Open bookings</Link>}
    </div>
  );
}

/** Light fallback: both towers side by side, one row per floor. No WebGL, works on any phone. */
function Stack2D({ data, mode, sel, onPick, color, motion }: { data: TwinData; mode: Mode; sel: string | null; onPick: (k: string) => void; color: (u: TwinUnit) => string; motion: boolean }) {
  const by = useMemo(() => new Map(data.units.map((u) => [u.code, u])), [data.units]);
  const floors = Array.from({ length: SITE.penthouseFloor - 1 }, (_, i) => SITE.penthouseFloor - i); // 24 … 2
  const cell = (u: TwinUnit | undefined, span = 1) => u ? (
    <button key={u.code} title={`Unit ${u.code}`} aria-label={`Unit ${u.code}${u.state ? ", " + STATE_WORD[u.state] : ""}`}
      className={"s2-u" + (mode === "tickets" && u.state === "red" ? " pulse" : "") + (sel === u.code ? " sel" : "")}
      style={{ background: color(u), gridColumn: span > 1 ? `span ${span}` : undefined }} onClick={() => onPick(u.code)} />
  ) : <span />;
  return (
    <div className={"stack2d" + (motion ? "" : " still")} style={{ ["--cols" as string]: STACKS.length }}>
      <div className="s2-towers">
        {TOWERS.map((t) => (
          <div key={t.id} className="s2-tower">
            <div className="s2-row s2-head"><span /><b style={{ gridColumn: "span 4" }}>{t.label}</b></div>
            <div className="s2-row s2-head"><span />{STACKS.map((s) => <span key={s}>{s}</span>)}</div>
            {floors.map((f) => (
              <div className="s2-row" key={f}>
                <span className="s2-f">{f === SITE.penthouseFloor ? `PH` : f}</span>
                {f === SITE.amenityFloor ? <span className="s2-amen" style={{ gridColumn: "span 4" }}>Amenities</span>
                  : f === SITE.penthouseFloor ? ["01", "02"].map((s) => cell(by.get(`${f}${s}${t.id}`), 2))
                    : STACKS.map((s) => cell(by.get(`${f}${s}${t.id}`)))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="s2-zones">
        {data.zones.map((z) => (
          <button key={z.id} className={"chip" + (sel === "zone:" + z.id ? " on" : "") + (mode === "tickets" && z.state === "red" ? " pulse" : "")} onClick={() => onPick("zone:" + z.id)}>
            <i className="dotp" style={{ background: mode === "tickets" && z.state ? STATE_COLOR[z.state] : "var(--line)" }} />{z.label}
          </button>
        ))}
      </div>
    </div>
  );
}
