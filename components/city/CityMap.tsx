"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type { CityScene, Look } from "./cityScene";
import {
  KINDS, KIND_LABEL, KIND_COLOR, DISTRICTS, STATUS_WORD, ALERTS, ALERT_COLOR, ALERT_ICON, toLocal, paxConcept, tourStops, sampleMetrics, kwAt, solarAt,
  EF, TARIFF, PV_KWP_PER_M2, FOCUS_ALIAS, seedAt, monthlyHistory, sumRange, monthName, HIST_MONTHS,
  type Kind, type ChunkData, type TerrainFile, type DistrictShape, type CityAlert,
} from "@/lib/nccCity";
import { solarShape } from "@/lib/green";
import { RankPanel, MonthBars, computeRanking, RANK_DEFAULT, type RankOpts } from "./Rankings";
import { chapters, say, hush, Ticker, LeakHud, BeforeHud, ReplayHud, EndCard, DataHud, type Chapter } from "./Present";
import Help, { type HelpTab } from "./Help";
import { useRouter } from "next/navigation";

type Mode = "districts" | "energy" | "water" | "rank" | "solar" | "carbon" | "alerts";
const MODES: { k: Mode; label: string; icon: string; hint: string }[] = [
  { k: "districts", label: "Buildings", icon: "🏙️", hint: "Every building by type. Tap one, or a district name, for details." },
  { k: "energy", label: "Energy now", icon: "⚡", hint: "Power use per square metre of floor at this hour. Watch homes light up at night and offices by day." },
  { k: "water", label: "Water", icon: "💧", hint: "Water use per square metre of floor per day." },
  { k: "rank", label: "Rankings", icon: "📊", hint: "Who uses the most electricity and water, and who cut the most. Pick the period below, then tap a building to fly there." },
  { k: "solar", label: "Solar", icon: "☀️", hint: "Bright yellow roofs already have panels (sample). Orange shows untapped rooftop potential." },
  { k: "carbon", label: "Carbon", icon: "🌍", hint: "Tonnes of CO₂ a year from each building's grid power, after its own solar." },
  { k: "alerts", label: "Alerts", icon: "🚨", hint: "What the AI caught today. Tap an alert to fly there." },
];
const FOCUS_DIST = 900;
const n0 = (v: number) => Math.round(v).toLocaleString("en-PH");
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-PH");
const mw = (kw: number) => (kw >= 1000 ? `${n1(kw / 1000)} MW` : `${n0(kw)} kW`);
const peso = (v: number) => (v >= 1e6 ? `₱${n1(v / 1e6)}M` : v >= 1e4 ? `₱${n0(v / 1e3)}k` : `₱${n0(v)}`);
const hourLabel = (h: number) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`; };
const NCC_DISTRICTS = new Set(["ngac", "village", "hub", "filinvest", "substation", "pax", "shrine", "solarfarm", "waste"]);
const CLARK_DISTRICTS = new Set(["airport", "ti", "philexcel", "mimosa", "cfz", "gateway", "technopark"]);

function ramp(stops: string[], t: number, out: THREE.Color, C: typeof THREE.Color) {
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1), i = Math.floor(x);
  const a = new C(stops[i]), b = new C(stops[i + 1]);
  return out.copy(a).lerp(b, x - i);
}
const R_ENERGY = ["#1d4f91", "#2a9d8f", "#e9c46a", "#f4a261", "#e63946"];
const R_WATER = ["#e3f1fb", "#9ecae1", "#4292c6", "#08519c", "#08306b"];
const R_CARBON = ["#e8e8e8", "#f2c4a8", "#e07a5f", "#b8323d", "#6b0f1a"];
const R_SOLAR = ["#e9e4d8", "#f6d49a", "#f4a261", "#e76f51"];
const R_WATER_RANK = ["#c6dbef", "#6baed6", "#2171b5", "#08306b"];
const R_CHANGE = ["#1a9850", "#91cf60", "#f2f2f2", "#fc8d59", "#d73027"];

const LOOKS: { k: Look; icon: string; label: string; title: string }[] = [
  { k: "google", icon: "🌐", label: "Google 3D", title: "Google photorealistic 3D buildings and terrain" },
  { k: "satellite", icon: "🛰️", label: "Satellite", title: "Free cloud-free satellite photo (Copernicus Sentinel-2)" },
  { k: "map", icon: "🗺️", label: "Map", title: "Drawn map: roads, land use, rivers" },
];
const LOOK_KEY = "bmai-citymap-look";

/** Share of power (and water) a building saves with the AI running: 4% to 30%, about 13% on average (sample). */
const saveFrac = (seed: number, salt: number) => { const u = ((Math.imul(seed ^ salt, 2654435761) >>> 0) % 10007) / 10007; return 0.04 + 0.26 * u * u; };
const MUTE_KEY = "bmai-citymap-mute";
type Flow = "power" | "water" | null;

export default function CityMap({ focus, alert: alertParam, googleKey, present: presentParam }: { focus?: string; alert?: string; googleKey?: string; present?: "auto" | "manual" }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const threeRef = useRef<typeof THREE | null>(null);
  const [mode, setMode] = useState<Mode>("districts");
  const [hour, setHour] = useState(17.5);
  const [play, setPlay] = useState(true);
  const [load, setLoad] = useState<{ step: string; pct: number; err?: string }>({ step: "Loading terrain", pct: 5 });
  const [districts, setDistricts] = useState<DistrictShape[]>([]);
  const [sel, setSel] = useState<{ type: "b"; i: number } | { type: "d"; id: string } | { type: "a"; a: CityAlert } | null>(null);
  const [caption, setCaption] = useState<{ title: string; text: string; i: number; n: number } | null>(null);
  const [full, setFull] = useState(false);
  const [stats, setStats] = useState({ buildings: 0, roadKm: 0, pvKwp: 0, chunks: 0 });
  const [, bump] = useState(0);
  const metrics = useRef<M>({ kind: [], kwh: new Float32Array(), m3: new Float32Array(), roof: new Float32Array(), solar: new Float32Array(), floor: new Float32Array(), seed: new Int32Array(), save: new Float32Array(), wsave: new Float32Array() });
  const [aiOn, setAiOn] = useState(true);
  // presenter mode
  const [pres, setPres] = useState<{ i: number; run: number } | null>(null);
  const [presFlow, setPresFlow] = useState<Flow>(null);
  const [presPulse, setPresPulse] = useState(false);
  const [hudOn, setHudOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [askStart, setAskStart] = useState(!!presentParam);
  const [help, setHelp] = useState<HelpTab | null>(null);
  const router = useRouter();
  const [rk, setRk] = useState<RankOpts>(RANK_DEFAULT);
  const [look, setLook] = useState<Look>(googleKey ? "google" : "satellite");
  const [lookNote, setLookNote] = useState("");
  const [attr, setAttr] = useState("");
  const distIds = useRef<string[]>([]);
  const touring = useRef(false);

  // ----- set up scene and stream in the data -----
  useEffect(() => {
    let dead = false;
    const mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
    (async () => {
      try {
        const [T, { createCityScene }, tf] = await Promise.all([
          import("three"), import("./cityScene"), fetch("/green/geo/terrain.json").then((r) => { if (!r.ok) throw new Error("terrain " + r.status); return r.json() as Promise<TerrainFile>; }),
        ]);
        if (dead || !host.current) return;
        threeRef.current = T;
        distIds.current = tf.districts.map((d) => d.id);
        setDistricts(tf.districts);
        const sc = createCityScene({ host: host.current, terrain: tf.terrain, mobile, onPick: (i) => {
          if (touring.current) return;
          setSel(i == null ? null : { type: "b", i });
        } });
        sceneRef.current = sc;
        let roadM = 0, pvM2 = 0;
        const chunks = tf.meta.chunks;
        for (const [ci, ch] of chunks.entries()) {
          setLoad({ step: ci === 0 ? "Loading New Clark City" : "Loading Clark Freeport", pct: 15 + ci * 40 });
          const c = (await fetch(`/green/geo/city-${ch}.json`).then((r) => { if (!r.ok) throw new Error(ch + " " + r.status); return r.json(); })) as ChunkData;
          if (dead) return;
          setLoad({ step: ci === 0 ? "Building New Clark City" : "Building Clark Freeport", pct: 35 + ci * 40 });
          await new Promise((r) => setTimeout(r, 30));
          sc.addChunk(c);
          if (ch === "ncc") { const pax = tf.districts.find((d) => d.id === "pax"); if (pax) sc.addConcept(paxConcept(pax), tf.districts.indexOf(pax)); }
          for (const r of c.roads) if (r.c <= 6) for (let k = 2; k < r.p.length; k += 2) roadM += Math.hypot(r.p[k] - r.p[k - 2], r.p[k + 1] - r.p[k - 1]);
          pvM2 += c.pvArea;
          computeMetrics();
          setStats({ buildings: sc.buildings.filter((b) => !b.concept).length, roadKm: roadM / 1000, pvKwp: pvM2 * PV_KWP_PER_M2, chunks: ci + 1 });
          bump((x) => x + 1);
        }
        setLoad({ step: "", pct: 100 });
      } catch (e) {
        setLoad({ step: "", pct: 0, err: "The 3D map could not load. Please check your connection and reload the page." });
        console.error(e);
      }
    })();
    return () => { dead = true; sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);

  function computeMetrics() {
    const sc = sceneRef.current; if (!sc) return;
    const B = sc.buildings, N = B.length;
    const m: M = { kind: [] as Kind[], kwh: new Float32Array(N), m3: new Float32Array(N), roof: new Float32Array(N), solar: new Float32Array(N), floor: new Float32Array(N), seed: new Int32Array(N), save: new Float32Array(N), wsave: new Float32Array(N) };
    B.forEach((b, i) => {
      const k = KINDS[b.kind] ?? "home"; m.kind.push(k);
      const did = distIds.current[b.dist];
      const named = did != null && (NCC_DISTRICTS.has(did) || CLARK_DISTRICTS.has(did));
      m.seed[i] = seedAt(b.x, b.z); // by position, so phones (which skip tiny sheds) get the same numbers
      const s = sampleMetrics(m.seed[i], b.concept && k === "utility" && b.h < 3 ? "utility" : k, b.foot, b.h, named);
      m.save[i] = b.concept ? 0.12 : saveFrac(m.seed[i], 0x9e3779b9); m.wsave[i] = b.concept ? 0.1 : saveFrac(m.seed[i], 0x85ebca6b);
      m.kwh[i] = s.kwhDay; m.m3[i] = s.m3Day; m.roof[i] = s.roofKwp; m.solar[i] = b.concept && b.h < 3 ? 12000 : s.solarKwp; m.floor[i] = s.floor;
    });
    metrics.current = m;
  }

  // ----- rankings -----
  const rank = useMemo(() => {
    const sc = sceneRef.current; if (mode !== "rank" || !sc || !metrics.current.kind.length) return null;
    return computeRanking(sc, metrics.current, districts, rk);
  }, [mode, rk, stats.chunks, districts]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickBuilding = useCallback((i: number) => {
    const sc = sceneRef.current; if (!sc) return;
    const b = sc.buildings[i];
    sc.flyTo(b.x, b.z, Math.max(380, Math.sqrt(b.foot) * 5 + b.h * 3), b.y + b.h * 0.5);
    setSel({ type: "b", i });
    const r = host.current?.getBoundingClientRect(); // bring the map into view when picking from the list below it
    if (r && (r.top < 0 || r.bottom > window.innerHeight)) host.current!.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // ----- ground look -----
  useEffect(() => { try { const v = localStorage.getItem(LOOK_KEY) as Look | null; if (v && (v !== "google" || googleKey)) setLook(v); } catch { /* private mode */ } }, [googleKey]);
  useEffect(() => {
    sceneRef.current?.setLook(look, googleKey ? { key: googleKey, onError: (msg) => { console.warn("Google 3D tiles:", msg); setLook("satellite"); setLookNote("Google 3D could not load, so you're seeing the free satellite view."); } } : undefined);
  }, [look, googleKey, stats.chunks]);
  useEffect(() => {
    if (look !== "google") { setAttr(""); return; }
    const t = setInterval(() => setAttr(sceneRef.current?.attributions() ?? ""), 2000);
    return () => clearInterval(t);
  }, [look]);
  useEffect(() => { if (!lookNote) return; const t = setTimeout(() => setLookNote(""), 7000); return () => clearTimeout(t); }, [lookNote]);
  const chooseLook = (l: Look) => { setLook(l); setLookNote(""); try { localStorage.setItem(LOOK_KEY, l); } catch { /* ignore */ } };

  // ----- colours -----
  const paint = useCallback(() => {
    const sc = sceneRef.current, T = threeRef.current; if (!sc || !T) return;
    const m = metrics.current, B = sc.buildings;
    const h = Math.floor(hour) % 24;
    const alertDist = new Set(ALERTS.map((a) => a.district));
    const base = new T.Color();
    sc.setDataMode(mode !== "districts");
    sc.paint((i, out) => {
      const k = m.kind[i] ?? "home", b = B[i];
      const j = ((i * 2654435761) >>> 0) % 1000 / 1000;
      if (mode === "districts") {
        const did = distIds.current[b.dist];
        const named = did != null && (NCC_DISTRICTS.has(did) || CLARK_DISTRICTS.has(did));
        out.set(k === "home" && !named ? "#d6d0c2" : KIND_COLOR[k]);
        if (b.concept) out.set(KIND_COLOR[k === "utility" ? "utility" : k]).lerp(base.set("#00c2b2"), 0.35);
        out.offsetHSL(0, 0, (j - 0.5) * 0.08);
      } else if (mode === "energy") {
        const w = (kwAt({ floor: m.floor[i], kwhDay: m.kwh[i], m3Day: 0, roofKwp: 0, solarKwp: 0 }, k, h) * 1000 * (aiOn ? 1 - m.save[i] : 1)) / Math.max(1, m.floor[i]);
        ramp(R_ENERGY, Math.log(1 + w) / Math.log(1 + (k === "datahall" ? 2000 : 45)), out, T.Color);
      } else if (mode === "water") {
        ramp(R_WATER, Math.log(1 + (m.m3[i] * 1000 * (aiOn ? 1 - m.wsave[i] : 1)) / Math.max(1, m.floor[i])) / Math.log(1 + 12), out, T.Color);
      } else if (mode === "rank") {
        const v = rank ? rank.score[i] : NaN;
        if (Number.isNaN(v)) out.set(b.concept ? "#9a958c" : "#b9b4aa").offsetHSL(0, 0, (j - 0.5) * 0.05);
        else if (rk.list === "top") ramp(rk.util === "e" ? R_ENERGY : R_WATER_RANK, (v - rank!.lo) / Math.max(1e-6, rank!.hi - rank!.lo), out, T.Color);
        else ramp(R_CHANGE, 0.5 + v / 0.5, out, T.Color);
      } else if (mode === "solar") {
        if (m.solar[i] > 0) out.set("#ffd60a");
        else ramp(R_SOLAR, Math.log(1 + m.roof[i]) / Math.log(1 + 400), out, T.Color);
      } else if (mode === "carbon") {
        const t = (Math.max(0, m.kwh[i] - m.solar[i] * 3.8) * 365 * EF) / 1000;
        ramp(R_CARBON, Math.log(1 + t) / Math.log(1 + 3000), out, T.Color);
      } else {
        const did = distIds.current[b.dist];
        out.set(did && alertDist.has(did) ? "#c9c3b5" : "#8f8a80").offsetHSL(0, 0, (j - 0.5) * 0.05);
      }
    });
  }, [mode, hour, rank, rk, aiOn]); // eslint-disable-line react-hooks/exhaustive-deps
  // repaint when the mode changes, and in energy mode on each new hour
  const paintKey = mode === "energy" ? `${mode}:${Math.floor(hour)}:${aiOn}` : mode === "water" ? `water:${aiOn}` : mode === "rank" ? `rank:${JSON.stringify(rk)}` : mode;
  useEffect(() => { paint(); }, [paintKey, stats.chunks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- time -----
  useEffect(() => { sceneRef.current?.setHour(hour); }, [hour, stats.chunks]);
  useEffect(() => {
    if (!play) return;
    let last = performance.now(), raf = 0;
    const tick = (t: number) => { const dt = (t - last) / 1000; last = t; setHour((h) => (h + dt * 0.42) % 24); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play]);

  // ----- flows and pulsing heat -----
  const flow: Flow = pres ? presFlow : mode === "energy" ? "power" : mode === "water" ? "water" : null;
  const pulse = pres ? presPulse : mode === "energy" && !aiOn;
  useEffect(() => { sceneRef.current?.setFlow(flow); }, [flow, stats.chunks]);
  useEffect(() => { sceneRef.current?.setPulse(pulse); }, [pulse, stats.chunks]);

  // ----- labels, outlines, beacons -----
  const flyToDistrict = useCallback((id: string) => {
    const d = districts.find((x) => x.id === id); const sc = sceneRef.current; if (!d || !sc) return;
    const xs = d.p.filter((_, i) => i % 2 === 0), zs = d.p.filter((_, i) => i % 2 === 1);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    sc.flyTo(d.c[0], d.c[1], Math.max(700, size * 1.25));
    setSel({ type: "d", id });
  }, [districts]);
  const flyToAlert = useCallback((a: CityAlert) => {
    const [x, z] = toLocal(a.lon, a.lat); sceneRef.current?.flyTo(x, z, 700); setSel({ type: "a", a });
  }, []);

  useEffect(() => {
    const sc = sceneRef.current; if (!sc || !districts.length) return;
    const big = new Set(["ngac", "airport", "cfz", "pax", "filinvest", "gateway", "solarfarm", "capas", "angeles", "mabalacat", "technopark", "philexcel", "mimosa", "ti"]);
    sc.setLabels([
      ...districts.map((d) => ({
        id: d.id, x: d.c[0], z: d.c[1], text: (DISTRICTS[d.id]?.status === "concept" ? "◇ " : "") + d.name,
        cls: "cm-d cm-" + (DISTRICTS[d.id]?.status ?? "real"), max: big.has(d.id) ? 40000 : 7000, min: 0, onClick: () => flyToDistrict(d.id),
      })),
      ...(mode === "rank" && rank ? rank.rows.slice(0, 10).map((r, k) => { const b = sc.buildings[r.i]; return { id: "r-" + r.i, x: b.x, z: b.z, y: b.y + b.h + 30, text: `${k + 1}`, cls: "cm-r", max: 26000, onClick: () => pickBuilding(r.i) }; }) : []),
      ...(mode === "alerts" ? ALERTS.map((a) => { const [x, z] = toLocal(a.lon, a.lat); return { id: "a-" + a.id, x, z, y: sc.heightAt(x, z) + 260, text: `${ALERT_ICON[a.kind]} ${a.where}`, cls: "cm-a", max: 30000, onClick: () => flyToAlert(a) }; }) : []),
    ]);
    sc.setBeacons(ALERTS.map((a) => { const [x, z] = toLocal(a.lon, a.lat); return { id: a.id, x, z, color: ALERT_COLOR[a.kind], strong: mode === "alerts" }; }));
    const sd = sel?.type === "d" ? sel.id : null;
    sc.setOutlines(districts.filter((d) => d.id === "pax" || d.id === sd || (mode === "districts" && !["cristorey", "capas", "angeles", "mabalacat", "camp"].includes(d.id)))
      .map((d) => ({ p: d.p, color: d.id === "pax" ? "#00e0c6" : d.id === sd ? "#ff2fd0" : "#ffffff", dashed: d.id === "pax", strong: d.id === sd })));
  }, [districts, mode, sel, flyToDistrict, flyToAlert, stats.chunks, rank, pickBuilding]);

  useEffect(() => { sceneRef.current?.select(sel?.type === "b" ? sel.i : null); }, [sel]);
  useEffect(() => { sceneRef.current?.setWheelFree(full); }, [full]);
  useEffect(() => { if (!full || pres) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [full, !!pres]); // eslint-disable-line react-hooks/exhaustive-deps

  // deep links: ?focus=<district> or ?alert=<id>, once the right chunk is in
  const deep = useRef(false);
  useEffect(() => {
    if (deep.current || !districts.length || stats.chunks < 1) return;
    const a = alertParam ? ALERTS.find((x) => x.id === alertParam) : undefined;
    const f = focus && focus !== "all" ? FOCUS_ALIAS[focus] ?? focus : undefined; // "all" keeps the whole-region view
    const needsClark = (a && CLARK_DISTRICTS.has(a.district)) || (f && (CLARK_DISTRICTS.has(f) || ["angeles", "mabalacat"].includes(f)));
    if (needsClark && stats.chunks < 2) return;
    deep.current = true;
    if (a) { setMode("alerts"); setTimeout(() => flyToAlert(a), 400); }
    else if (f && districts.some((d) => d.id === f)) setTimeout(() => flyToDistrict(f), 400);
  }, [districts, stats.chunks, focus, alertParam, flyToAlert, flyToDistrict]);

  // ----- fly-through -----
  function startTour() {
    const sc = sceneRef.current; if (!sc) return;
    const stops = tourStops(); touring.current = true; setSel(null); setPlay(false);
    sc.tour(stops.map((s) => ({ pos: s.pos, look: s.look })), (i) => {
      setCaption({ ...stops[i], i, n: stops.length });
      setHour(13 + (8 * i) / Math.max(1, stops.length - 1)); // 1 PM to 9 PM: daylight, sunset, then city lights
    }, () => { touring.current = false; setCaption(null); setPlay(true); });
  }
  function stopTour() { sceneRef.current?.stopTour(); touring.current = false; setCaption(null); }

  // ----- live totals (sample) -----
  const totals = useMemo(() => {
    const m = metrics.current; const N = m.kind.length; if (!N) return null;
    let kwBase = 0, kwAi = 0, roofKw = 0, m3 = 0, m3Ai = 0, co2 = 0, kwhSaved = 0, m3Saved = 0;
    for (let i = 0; i < N; i++) {
      const k = kwAt({ floor: m.floor[i], kwhDay: m.kwh[i], m3Day: 0, roofKwp: 0, solarKwp: 0 }, m.kind[i], hour);
      kwBase += k; kwAi += k * (1 - m.save[i]);
      roofKw += solarAt(m.solar[i], hour);
      m3 += m.m3[i]; m3Ai += m.m3[i] * (1 - m.wsave[i]);
      kwhSaved += m.kwh[i] * m.save[i]; m3Saved += m.m3[i] * m.wsave[i];
      co2 += Math.max(0, m.kwh[i] * (aiOn ? 1 - m.save[i] : 1) - m.solar[i] * 3.8);
    }
    const farmKw = stats.pvKwp * solarShape(hour) * 0.82;
    const day = { peso: kwhSaved * TARIFF + m3Saved * 55, kwh: kwhSaved, m3: m3Saved, co2: (kwhSaved * EF) / 1000 };
    return { kw: aiOn ? kwAi : kwBase, kwBase, kwAi, roofKw, farmKw, m3: aiOn ? m3Ai : m3, co2: (co2 * EF) / 1000, aiSave: day.peso, day };
  }, [Math.floor(hour * 4), stats.chunks, aiOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- presenter mode -----
  const steps = useMemo<Chapter[]>(() => chapters({ buildings: stats.buildings, day: totals?.day ?? { peso: 0, kwh: 0, m3: 0, co2: 0 }, leak: ALERTS.find((a) => a.id === "aqua") }), [stats.buildings, totals?.day.peso]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { setMuted(localStorage.getItem(MUTE_KEY) === "1"); } catch { /* ignore */ } }, []);
  const at = useCallback((id: string) => districts.find((d) => d.id === id)?.c ?? [0, 0], [districts]);
  function startPresent() {
    const sc = sceneRef.current; if (!sc || stats.chunks < 2) return;
    sc.stopTour(); setCaption(null); touring.current = true; setSel(null); setAskStart(false);
    if (googleKey) setLook("google");
    setFull(true);
    document.documentElement.requestFullscreen?.().catch(() => { /* not allowed: the in-page full screen still works */ });
    setPres({ i: 0, run: Date.now() });
  }
  function endPresent(explore = false) {
    hush(); setPres(null); touring.current = false; setHudOn(false); setAiOn(true);
    sceneRef.current?.setOrbit(0);
    if (explore) { setMode("districts"); setPlay(true); }
    setFull(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  const go = (d: number) => setPres((p) => (p ? { i: Math.max(0, Math.min(steps.length - 1, p.i + d)), run: Date.now() } : p));
  // run the current chapter
  useEffect(() => {
    const sc = sceneRef.current; if (!pres || !sc) return;
    const c = steps[pres.i]; const timers: ReturnType<typeof setTimeout>[] = []; let iv: ReturnType<typeof setInterval> | undefined;
    const later = (s: number, f: () => void) => timers.push(setTimeout(f, s * 1000));
    setPlay(false); setHudOn(false); sc.setOrbit(0);
    if (!muted) later(0.6, () => say(c.say)); else hush();
    if (c.id === "intro") {
      setMode("districts"); setAiOn(true); setPresFlow(null); setPresPulse(false); setHour(17.2);
      sc.intro(8); later(7.6, () => sc.scan()); later(8, () => sc.setOrbit(0.025));
    } else if (c.id === "power") {
      setMode("energy"); setAiOn(false); setPresFlow("power"); setPresPulse(true); setHour(18.4);
      const [x, z] = at("ngac"); sc.flyTo(x, z, 5200, undefined, 4.5, 0.5); later(4.6, () => sc.setOrbit(0.035));
    } else if (c.id === "water") {
      setMode("water"); setAiOn(false); setPresFlow("water"); setPresPulse(false); setHour(6.8);
      const [x, z] = at("village"); sc.flyTo(x + 400, z - 300, 3000, undefined, 4, 0.45); later(4.1, () => sc.setOrbit(-0.04));
    } else if (c.id === "leak") {
      const a = ALERTS.find((x) => x.id === "aqua")!; const [x, z] = toLocal(a.lon, a.lat);
      setMode("alerts"); setAiOn(true); setPresFlow("water"); setPresPulse(false); setHour(2.2);
      sc.flyTo(x, z, 1900, undefined, 3, 0.55); later(1, () => sc.scan("#ff4d4d"));
      later(3.2, () => { sc.flyTo(x, z, 340, undefined, 3.2, 0.36); setHudOn(true); });
      later(6.5, () => sc.setOrbit(0.09));
    } else if (c.id === "data") {
      setMode("energy"); setAiOn(true); setPresFlow("power"); setPresPulse(false); setHour(10.5); setHudOn(true);
      const [x, z] = at("mimosa"); sc.flyTo(x, z, 4200, undefined, 4.5, 0.5); later(4.6, () => sc.setOrbit(0.03));
      [1.5, 4.5, 7.5, 10.5].forEach((t) => later(t, () => sc.scan()));
    } else if (c.id === "before") {
      setMode("energy"); setAiOn(false); setPresFlow("power"); setPresPulse(true); setHour(18.6); setHudOn(true);
      const [x, z] = at("ngac"); sc.flyTo(x - 600, z + 900, 7000, undefined, 4, 0.52); later(4.1, () => sc.setOrbit(0.03));
      later(5.5, () => { setAiOn(true); setPresPulse(false); });
    } else if (c.id === "replay") {
      setMode("energy"); setAiOn(true); setPresFlow("power"); setPresPulse(false); setHudOn(true);
      sc.reset(); later(2.5, () => sc.setOrbit(0.025));
      let h = 16.8; setHour(h); iv = setInterval(() => { h = Math.min(20.6, h + 0.04); setHour(h); }, 100);
    } else {
      setMode("districts"); setAiOn(true); setPresFlow(null); setPresPulse(false); setHour(19.6); setHudOn(true);
      sc.flyTo(1200, 9000, 30000, 60, 5, 0.55); later(5, () => sc.setOrbit(0.02));
    }
    if (c.dur && presentParam !== "manual") later(c.dur, () => go(1));
    return () => { timers.forEach(clearTimeout); if (iv) clearInterval(iv); };
  }, [pres?.i, pres?.run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pres) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") endPresent(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [!!pres]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hush(), []);
  const toggleMute = () => { const m = !muted; setMuted(m); if (m) hush(); try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* ignore */ } };
  const chap = pres ? steps[pres.i] : null;

  const night = hour < 6 || hour >= 18.3;
  const modeInfo = MODES.find((x) => x.k === mode)!;

  const modesRow = (
    <div className={"cm-modes" + (full ? " cm-modes-in" : "")} role="tablist" aria-label="Map layer">
      {MODES.map((x) => <button key={x.k} role="tab" aria-selected={mode === x.k} title={x.hint} className={"chip" + (mode === x.k ? " on" : "")} onClick={() => setMode(x.k)}>{x.icon} {x.label}</button>)}
      <button className="chip cm-q" onClick={() => setHelp("layers")} aria-label="What do these layers mean?">?</button>
    </div>
  );
  const showTips = () => { setHelp(null); setFull(false); router.replace("/green/map?tips=1", { scroll: false }); };

  return (
    <div className="citymap">
      {!full && modesRow}
      <div className={"cm-wrap" + (full ? " cm-full" : "") + (pres ? " cm-pres" : "")}>
        <div className="cm-stage" ref={host} aria-label="3D map of New Clark City and Clark Freeport">
          {load.pct < 100 && !load.err && <div className="cm-load"><div className="cm-spin" /><b>{load.step}…</b><div className="cm-bar"><i style={{ width: `${load.pct}%` }} /></div><small>Real map data: about 3.5 MB on first visit</small></div>}
          {load.err && <div className="cm-load"><b>{load.err}</b></div>}
          <div className="cm-top">
            <div className="cm-title"><b>New Clark City → Clark</b><span className="demo-tag">Real map · sample data</span>
              {!pres && <Fresh onClick={() => setHelp("data")} />}
              {full && !pres && modesRow}
              {full && !pres && <div className="cm-inhint">{modeInfo.hint}</div>}
              {!pres && (mode === "energy" || mode === "water") && (
                <div className="cm-aisw" role="radiogroup" aria-label="Before and after AI">
                  <button role="radio" aria-checked={!aiOn} className={!aiOn ? "on off" : ""} onClick={() => setAiOn(false)}>Without AI</button>
                  <button role="radio" aria-checked={aiOn} className={aiOn ? "on" : ""} onClick={() => setAiOn(true)}>🤖 With AI</button>
                </div>
              )}
            </div>
            {pres ? (
              <div className="cm-tools">
                <button className="cm-btn" onClick={() => go(-1)} disabled={pres.i === 0} aria-label="Previous chapter">‹</button>
                <button className="cm-btn" onClick={() => go(1)} disabled={pres.i >= steps.length - 1} aria-label="Next chapter">›</button>
                <button className="cm-btn" onClick={toggleMute} aria-label={muted ? "Turn narration on" : "Mute narration"}>{muted ? "🔇" : "🔊"}</button>
                <button className="cm-btn" onClick={() => endPresent()}>✕ End</button>
              </div>
            ) : <div className="cm-tools">
              <button className="cm-btn cm-cta" onClick={startPresent} disabled={stats.chunks < 2} title="One-tap narrated story for client pitches">🎬<span className="cm-lk-t"> Present</span></button>
              <button className="cm-btn" onClick={() => setHelp(help ? null : "layers")} aria-label="How to use this map" title="How to use this map">?</button>
              <div className="cm-looks" role="radiogroup" aria-label="Map look">
                {LOOKS.filter((l) => l.k !== "google" || googleKey).map((l) => <button key={l.k} role="radio" aria-checked={look === l.k} title={l.title} aria-label={l.label} className={"cm-btn" + (look === l.k ? " on" : "")} onClick={() => chooseLook(l.k)}>{l.icon}<span className="cm-lk-t"> {l.label}</span></button>)}
              </div>
              {caption ? <button className="cm-btn on" onClick={stopTour}>■ Stop tour</button> : <button className="cm-btn" onClick={startTour} disabled={stats.chunks < 2}>▶ Fly-through</button>}
              <button className="cm-btn" onClick={() => { sceneRef.current?.reset(); setSel(null); }} aria-label="Reset view">⟲</button>
              <button className="cm-btn" onClick={() => sceneRef.current?.zoom(0.7)} aria-label="Zoom in">＋</button>
              <button className="cm-btn" onClick={() => sceneRef.current?.zoom(1.4)} aria-label="Zoom out">－</button>
              <button className="cm-btn" onClick={() => setFull((f) => !f)} aria-label={full ? "Exit full screen" : "Full screen"}>{full ? "✕" : "⛶"}</button>
            </div>}
          </div>
          {help && !pres && <Help initial={help} onClose={() => setHelp(null)} onPresent={() => { setHelp(null); startPresent(); }} onTips={showTips} />}
          {askStart && !pres && load.pct >= 100 && (
            <div className="cm-start"><button className="cm-btn cm-cta" onClick={startPresent} disabled={stats.chunks < 2}>🎬 Start the 3D story</button><small>{presentParam === "manual" ? "Manual mode: press → or tap › for the next chapter." : "About 90 seconds, with narration. Press → to skip ahead, Esc to stop."}</small></div>
          )}
          {pres && chap && totals && <>
            {chap.id !== "end" && (
              <div className="cm-lower" key={pres.i + ":" + pres.run}>
                <small className="cm-kick">{String(pres.i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} · {chap.kicker}</small>
                <h3>{chap.title}</h3>
                <p>{chap.text}</p>
                <div className="cm-prog"><i style={{ animationDuration: `${chap.dur}s` }} /></div>
              </div>
            )}
            {chap.id === "leak" && <LeakHud a={ALERTS.find((a) => a.id === "aqua")!} show={hudOn} />}
            {chap.id === "data" && hudOn && <DataHud />}
            {chap.id === "before" && hudOn && <BeforeHud aiOn={aiOn} kwBase={totals.kwBase} kwAi={totals.kwAi} perDay={totals.day.peso} />}
            {chap.id === "replay" && hudOn && <ReplayHud key={pres.run} day={totals.day} dur={chap.dur} />}
            {chap.id === "end" && hudOn && <EndCard c={chap} day={totals.day} onReplay={() => setPres({ i: 0, run: Date.now() })} onExplore={() => endPresent(true)} />}
            {chap.id !== "end" && <Ticker perDay={totals.day.peso} className="cm-tick" label="AI savings today · sample" />}
            <div className="cm-dots" aria-hidden="true">{steps.map((c, k) => <i key={c.id} className={k === pres.i ? "on" : k < pres.i ? "done" : ""} />)}</div>
          </>}
          {caption && <div className="cm-caption"><small>{caption.i + 1} / {caption.n}</small><b>{caption.title}</b><span>{caption.text}</span></div>}
          <div className="cm-legend"><Legend mode={mode} rk={rk} /></div>
          {lookNote && <div className="cm-note" role="status">{lookNote}</div>}
          <div className="cm-attr">{look === "google" ? <><b>Google</b> {attr}</> : look === "satellite" ? "Imagery: Copernicus Sentinel-2" : "© OpenStreetMap contributors"}</div>
          <div className="cm-time">
            <button className="cm-btn" onClick={() => setPlay((p) => !p)} aria-label={play ? "Pause time" : "Play time"}>{play ? "❚❚" : "▶"}</button>
            <span className="cm-clock">{night ? "🌙" : "☀️"} {hourLabel(hour)}</span>
            <input type="range" min={0} max={23.75} step={0.25} value={hour} aria-label="Time of day" onChange={(e) => { setPlay(false); setHour(Number(e.target.value)); }} />
          </div>
        </div>
      </div>
      <p className="cm-hint">{modeInfo.hint} <span className="muted">Drag to move, two fingers or right-drag to turn, pinch or Ctrl + scroll to zoom.</span></p>

      {totals && (
        <div className="cm-kpis">
          <div><b>{mw(totals.kw)}</b><span>power use now, all buildings{aiOn ? ", with AI" : ", without AI"}</span></div>
          <div><b>{mw(totals.roofKw + totals.farmKw)}</b><span>solar now: rooftops + mapped solar farms</span></div>
          <div><b>{n0(totals.m3)} m³</b><span>water today</span></div>
          <div><b>{n0(totals.co2)} t</b><span>CO₂ today from grid power</span></div>
          <div className="cm-kpi-live"><Ticker perDay={totals.aiSave} /><span>AI savings so far today, live (sample: {peso(totals.aiSave)} a day)</span></div>
          <div><b>{ALERTS.length}</b><span>alerts the AI is handling</span></div>
        </div>
      )}

      <div className="grid g-7-5 cm-panels">
        <div className="card">
          {sel?.type === "b" ? <BuildingCard i={sel.i} sc={sceneRef.current} m={metrics.current} hour={hour} districts={districts} onDistrict={flyToDistrict} onClose={() => setSel(null)} />
            : sel?.type === "d" ? <DistrictCard id={sel.id} sc={sceneRef.current} m={metrics.current} hour={hour} districts={districts} onClose={() => setSel(null)} />
            : sel?.type === "a" ? <AlertCard a={sel.a} onClose={() => setSel(null)} />
            : <Intro stats={stats} onDistrict={flyToDistrict} districts={districts} />}
        </div>
        {mode === "rank" ? <div className="card cm-rankcard"><RankPanel o={rk} set={setRk} res={rank} districts={districts} onPick={pickBuilding} /></div> : <div className="card">
          <h3>🚨 What the AI caught today</h3>
          <p className="hint">Sample alerts at real places. Tap one to fly there.</p>
          <div className="cm-alerts">
            {ALERTS.map((a) => (
              <button key={a.id} className={"cm-alert sev-" + a.severity} onClick={() => { if (CLARK_DISTRICTS.has(a.district) && stats.chunks < 2) return; flyToAlert(a); }}>
                <span className="cm-ai" style={{ background: ALERT_COLOR[a.kind] }}>{ALERT_ICON[a.kind]}</span>
                <span><b>{a.title}</b><small>{a.where} · saves {a.saving}</small></span>
              </button>
            ))}
          </div>
        </div>}
      </div>
      <p className="cm-src">
        Map data © OpenStreetMap contributors (ODbL), via Overture Maps 2026-11-18, with some building outlines from Google Open Buildings and Microsoft ML Buildings. Terrain from AWS Terrain Tiles. Satellite view contains modified Copernicus Sentinel data 2025 to 2026, made into a cloud-free mosaic.{googleKey ? " Google 3D view © Google and its data providers." : ""}
        Building heights come from OpenStreetMap where mapped and are estimated elsewhere. Energy, water, monthly history, rankings, solar, carbon, savings and alerts are sample data for this demo, not live readings.
        The Pax Silica campus is a concept: its location and buildings are illustrative.
      </p>
    </div>
  );
}

function Legend({ mode, rk }: { mode: Mode; rk: RankOpts }) {
  if (mode === "rank") return rk.list === "top"
    ? <><span className="cm-ramp" style={{ background: `linear-gradient(90deg,${(rk.util === "e" ? R_ENERGY : R_WATER_RANK).join(",")})` }} /><span>Low → high {rk.util === "e" ? "electricity" : "water"}{rk.basis === "m2" ? " per m²" : ""}</span><span><i style={{ background: "#b9b4aa" }} />Not metered</span></>
    : <><span className="cm-ramp" style={{ background: `linear-gradient(90deg,${R_CHANGE.join(",")})` }} /><span>Cut 25% → rose 25%</span><span><i style={{ background: "#b9b4aa" }} />Not metered</span></>;
  if (mode === "districts") return <>{(["civic", "apartment", "retail", "hotel", "industrial", "transport", "sports", "school", "datahall"] as Kind[]).map((k) => <span key={k}><i style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k].replace(" (concept)", "")}</span>)}<span><i style={{ background: "#d6d0c2" }} />Houses</span></>;
  if (mode === "alerts") return <>{(Object.keys(ALERT_COLOR) as (keyof typeof ALERT_COLOR)[]).map((k) => <span key={k}><i style={{ background: ALERT_COLOR[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</>;
  const flowNote = mode === "energy" ? <span><i className="cm-flowdot" style={{ background: "#ffb347" }} />Power flowing along main roads (illustrative)</span> : mode === "water" ? <span><i className="cm-flowdot" style={{ background: "#3fb6ff" }} />Water flowing (illustrative routes)</span> : null;
  const r = mode === "energy" ? R_ENERGY : mode === "water" ? R_WATER : mode === "carbon" ? R_CARBON : R_SOLAR;
  const [lo, hi] = mode === "energy" ? ["Low", "High per m²"] : mode === "water" ? ["Low", "High per m²"] : mode === "carbon" ? ["Low", "High CO₂/yr"] : ["Small roof", "Big roof"];
  return <><span className="cm-ramp" style={{ background: `linear-gradient(90deg,${r.join(",")})` }} /><span>{lo} → {hi}</span>{mode === "solar" && <span><i style={{ background: "#ffd60a" }} />Has panels</span>}{flowNote}</>;
}

type M = { kind: Kind[]; kwh: Float32Array; m3: Float32Array; roof: Float32Array; solar: Float32Array; floor: Float32Array; seed: Int32Array; save: Float32Array; wsave: Float32Array };
const TIPS: Partial<Record<Kind, string>> = {
  home: "Friendly Taglish tips and Green Points nudge households to use aircon smarter at night.",
  apartment: "AI finds running toilets from night water flow and messages the unit owner.",
  civic: "Pre-cool on solar at midday, then coast through the 6 to 10 PM peak.",
  sports: "Lights off 30 minutes after the last booking; pool pumps run on solar hours.",
  retail: "Pre-cool before the afternoon peak and stage escalator and signage lighting.",
  hotel: "Rooms reset to eco mode when guests check out; cooling tower water tuned daily.",
  industrial: "Find compressed-air leaks and fix power factor before the utility bill does.",
  transport: "Cool gates by the flight schedule, not the clock.",
  school: "Fans and lights follow the class timetable; rooftop solar covers the school day.",
  datahall: "AI cooling setpoints and carbon-aware job scheduling. PUE 1.40 → 1.31.",
};

function BuildingCard({ i, sc, m, hour, districts, onDistrict, onClose }: { i: number; sc: CityScene | null; m: M; hour: number; districts: DistrictShape[]; onDistrict: (id: string) => void; onClose: () => void }) {
  if (!sc) return null;
  const b = sc.buildings[i]; const k = m.kind[i] ?? "home"; const d = districts[b.dist];
  const kw = kwAt({ floor: m.floor[i], kwhDay: m.kwh[i], m3Day: 0, roofKwp: 0, solarKwp: 0 }, k, hour);
  const floors = Math.max(1, Math.round(b.h / 3.3));
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><h3>{b.name ?? KIND_LABEL[k]}</h3><p className="hint">{b.concept ? b.concept : `${KIND_LABEL[k]} · real outline from open map data`}{d ? <> · <a href="#" onClick={(e) => { e.preventDefault(); onDistrict(d.id); }}>{d.name}</a></> : null}</p></div>
        <button className="btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="cm-facts">
        <div><b>{n0(b.foot)} m²</b><span>footprint</span></div>
        <div><b>{n0(b.h)} m</b><span>height, about {floors} floor{floors > 1 ? "s" : ""}</span></div>
        <div><b>{mw(kw)}</b><span>power now (sample)</span></div>
        <div><b>{peso(m.kwh[i] * 30 * TARIFF)}</b><span>power bill a month (sample)</span></div>
        <div><b>{n1(m.m3[i])} m³</b><span>water a day (sample)</span></div>
        <div><b>{m.solar[i] > 0 ? `${n0(m.solar[i])} kWp` : `${n0(m.roof[i])} kWp`}</b><span>{m.solar[i] > 0 ? "rooftop solar installed (sample)" : "rooftop solar potential"}</span></div>
        <div><b>{n1((Math.max(0, m.kwh[i] - m.solar[i] * 3.8) * 365 * EF) / 1000)} t</b><span>CO₂ a year</span></div>
      </div>
      {!b.concept && <MonthBars seed={m.seed[i]} kind={k} kwhDay={m.kwh[i]} m3Day={m.m3[i]} />}
      {TIPS[k] && <p className="cm-tip">🤖 <b>What our AI does here:</b> {TIPS[k]}</p>}
    </div>
  );
}

function DistrictCard({ id, sc, m, hour, districts, onClose }: { id: string; sc: CityScene | null; m: M; hour: number; districts: DistrictShape[]; onClose: () => void }) {
  const info = DISTRICTS[id]; const idx = districts.findIndex((d) => d.id === id);
  if (!info || !sc) return null;
  let n = 0, kw = 0, m3 = 0, solar = 0;
  sc.buildings.forEach((b, i) => { if (b.dist !== idx) return; n++; kw += kwAt({ floor: m.floor[i], kwhDay: m.kwh[i], m3Day: 0, roofKwp: 0, solarKwp: 0 }, m.kind[i], hour); m3 += m.m3[i]; solar += m.solar[i]; });
  const alerts = ALERTS.filter((a) => a.district === id);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><span className={"tag " + (info.status === "concept" ? "t-warn" : info.status === "community" ? "t-mut" : "t-acc")}>{STATUS_WORD[info.status]}</span><h3 style={{ marginTop: 6 }}>{info.title}</h3></div>
        <button className="btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p style={{ margin: "6px 0 10px" }}>{info.blurb}</p>
      <div className="cm-facts">
        <div><b>{n0(n)}</b><span>buildings on the map</span></div>
        <div><b>{mw(kw)}</b><span>power now (sample)</span></div>
        <div><b>{n0(m3)} m³</b><span>water a day (sample)</span></div>
        <div><b>{mw(solar)}</b><span>rooftop solar (sample)</span></div>
      </div>
      <ul className="cm-list">{info.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {alerts.length > 0 && <p className="cm-tip">🚨 {alerts.length} alert{alerts.length > 1 ? "s" : ""} here: {alerts.map((a) => a.title).join("; ")}.</p>}
    </div>
  );
}

function AlertCard({ a, onClose }: { a: CityAlert; onClose: () => void }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><span className={"tag " + (a.severity === "high" ? "t-bad" : a.severity === "medium" ? "t-warn" : "t-mut")}>{ALERT_ICON[a.kind]} {a.severity} · sample alert</span><h3 style={{ marginTop: 6 }}>{a.title}</h3><p className="hint">{a.where}</p></div>
        <button className="btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p style={{ margin: "8px 0" }}>{a.detail}</p>
      <p className="cm-tip">🤖 <b>AI action:</b> {a.ai}</p>
      <p className="hint">Estimated saving: <b>{a.saving}</b></p>
    </div>
  );
}

function Intro({ stats, onDistrict, districts }: { stats: { buildings: number; roadKm: number; pvKwp: number; chunks: number }; onDistrict: (id: string) => void; districts: DistrictShape[] }) {
  const pick = ["ngac", "village", "filinvest", "pax", "solarfarm", "airport", "cfz", "gateway", "philexcel", "mimosa", "ti"];
  return (
    <div>
      <h3>🏙️ One live map, New Clark City to Clark</h3>
      <p className="hint">Every building outline, road, river and solar panel row is real open map data. The numbers painted on it are sample data showing what our AI would watch.</p>
      <div className="cm-facts" style={{ marginTop: 10 }}>
        <div><b>{stats.buildings ? n0(stats.buildings) : "…"}</b><span>real buildings mapped</span></div>
        <div><b>{stats.roadKm ? n0(stats.roadKm) + " km" : "…"}</b><span>of roads</span></div>
        <div><b>{stats.pvKwp ? mw(stats.pvKwp) + "p" : "…"}</b><span>solar farm panels, estimated from mapped area</span></div>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>Jump to:</p>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {pick.filter((id) => districts.some((d) => d.id === id)).map((id) => <button key={id} className="chip" onClick={() => onDistrict(id)}>{DISTRICTS[id]?.status === "concept" ? "◇ " : ""}{districts.find((d) => d.id === id)!.name}</button>)}
      </div>
    </div>
  );
}

/** "Live" data badge: sample, shows minutes since the last 15-minute reading. */
function Fresh({ onClick }: { onClick: () => void }) {
  const [m, setM] = useState(0);
  useEffect(() => { const f = () => setM(Math.floor((Date.now() / 60000) % 15)); f(); const t = setInterval(f, 20000); return () => clearInterval(t); }, []);
  return <button className="cm-fresh" onClick={onClick} title="Where the data comes from"><i />Live demo · readings every 15 min · last {m === 0 ? "just now" : `${m} min ago`} <u>how?</u></button>;
}
