/**
 * Per-unit electricity and water use, with simple leak and waste flags.
 * Reads the monthly sub-meter readings (UtilityReading). The rules are deterministic,
 * so the flags work without an Anthropic key; AI only words the advice.
 */
import { prisma } from "./db";

export type EnergyFlag = "LEAK" | "VACANT_USE" | "HIGH" | "NORMAL" | "LOW" | "NODATA";
export type UnitEnergy = { kwh: number | null; m3: number | null; kwhVsSimilar: number | null; m3VsSimilar: number | null; m3Jump: number | null; flag: EnergyFlag; note: string | null; period: string | null };

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (x: number) => `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`;

/** Use per unit for the latest month, compared with similar-size units and with the unit's own past months. */
export async function unitEnergy(units: { id: string; code: string; sqm: number; vacant: boolean }[]): Promise<Map<string, UnitEnergy>> {
  const rows = await prisma.utilityReading.findMany({ select: { unitId: true, period: true, kind: true, usage: true }, orderBy: { period: "asc" } });
  const out = new Map<string, UnitEnergy>();
  const latest = rows.reduce((p, r) => (r.period > p ? r.period : p), "");
  const by = new Map<string, { E: Map<string, number>; W: Map<string, number> }>();
  for (const r of rows) { const e = by.get(r.unitId) ?? { E: new Map(), W: new Map() }; (r.kind === "ELECTRIC" ? e.E : e.W).set(r.period, r.usage); by.set(r.unitId, e); }
  // Similar units = same size band; compare per sqm so a 187 sqm corner isn't flagged for being big.
  const band = (sqm: number) => (sqm >= 250 ? "PH" : sqm >= 150 ? "L" : sqm >= 110 ? "M" : "S");
  const perSqm = new Map<string, { e: number[]; w: number[] }>();
  for (const u of units) {
    const r = by.get(u.id); if (!r || u.vacant) continue;
    const b = perSqm.get(band(u.sqm)) ?? { e: [], w: [] };
    const e = r.E.get(latest), w = r.W.get(latest);
    if (e != null) b.e.push(e / u.sqm); if (w != null) b.w.push(w / u.sqm);
    perSqm.set(band(u.sqm), b);
  }
  for (const u of units) {
    const r = by.get(u.id);
    const kwh = r?.E.get(latest) ?? null, m3 = r?.W.get(latest) ?? null;
    if (!r || (kwh == null && m3 == null)) { out.set(u.code, { kwh: null, m3: null, kwhVsSimilar: null, m3VsSimilar: null, m3Jump: null, flag: "NODATA", note: null, period: null }); continue; }
    const b = perSqm.get(band(u.sqm));
    const eMed = b ? median(b.e) * u.sqm : 0, wMed = b ? median(b.w) * u.sqm : 0;
    const kv = kwh != null && eMed ? kwh / eMed - 1 : null, wv = m3 != null && wMed ? m3 / wMed - 1 : null;
    const past = [...r.W.entries()].filter(([p]) => p < latest).map(([, v]) => v).slice(-3);
    const jump = m3 != null && past.length >= 2 ? m3 / (past.reduce((s, v) => s + v, 0) / past.length) - 1 : null;
    let flag: EnergyFlag = "NORMAL", note: string | null = null;
    if (u.vacant && ((m3 ?? 0) > 1.5 || (kwh ?? 0) > 60)) { flag = "VACANT_USE"; note = `Marked vacant but used ${m3 ?? 0} m³ water and ${kwh ?? 0} kWh last month. Possible running toilet, leak or unregistered occupant.`; }
    else if (jump != null && jump > 0.35 && (wv ?? 0) > 0.2) { flag = "LEAK"; note = `Water use jumped ${pct(jump)} versus the last 3 months and is ${pct(wv!)} above similar units. Likely a leaking flush valve or pipe; schedule a check.`; }
    else if ((kv ?? 0) > 0.45 || (wv ?? 0) > 0.6) { flag = "HIGH"; note = (kv ?? 0) > 0.45 ? `Electricity is ${pct(kv!)} above similar units. Often an old aircon or a water heater left on.` : `Water is ${pct(wv!)} above similar units.`; }
    else if ((kv ?? 0) < -0.3 && (wv ?? 0) < -0.3) { flag = "LOW"; note = "Well below similar units. Efficient household."; }
    out.set(u.code, { kwh, m3, kwhVsSimilar: kv, m3VsSimilar: wv, m3Jump: jump, flag, note, period: latest || null });
  }
  return out;
}

/** Saving tips for an owner's own unit, worded for residents. Deterministic. */
export function savingTips(e: UnitEnergy): string[] {
  const t: string[] = [];
  if (e.flag === "LEAK") t.push("Put a few drops of food colouring in the toilet tank. If colour shows in the bowl after 15 minutes without flushing, the flapper is leaking. We can send a plumber po.");
  if ((e.kwhVsSimilar ?? 0) > 0.2) t.push("Set the aircon to 25°C and clean the filters monthly; each degree cooler adds about 7% to the bill.", "An inverter aircon uses 30-50% less power than an old window type.");
  if ((e.m3VsSimilar ?? 0) > 0.2) t.push("A 5-minute shower uses about 40 litres; a pail bath uses about 15.");
  if (!t.length) t.push("You're doing well. Unplug the water heater when you travel and keep the ref door seal clean.");
  return t;
}
