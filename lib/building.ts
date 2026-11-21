/**
 * Live building model ("digital twin") for the 3D view, plus early-warning checks
 * and the time-to-fix leaderboard. Everything here is computed from our own data,
 * so it works with or without an Anthropic key.
 */
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { nowManila } from "./format";

export type TwinState = "red" | "amber" | "green" | "watch" | null;
export type TwinTicket = {
  n: number; title: string; status: string; priority: string; category: string; source: string;
  createdAt: number; deadline: number; closedAt: number | null; assignee: string | null; photo: string | null; aiNote: string | null; rating: number | null;
};
export type TwinUnit = {
  code: string; floor: number; letter: string; state: TwinState;
  tickets: TwinTicket[]; owner: string | null; tenant: string | null; phone: string | null;
  happy: number | null; happyN: number; lastComment: string | null; sos: { kind: string; at: number } | null; watch: string | null;
};
export type TwinZone = { id: "lobby" | "parking" | "amenity" | "core"; label: string; state: TwinState; tickets: TwinTicket[]; locations: string[]; watch: string | null };
export type TwinData = {
  building: string; floors: [number, number]; letters: string[]; units: TwinUnit[]; zones: TwinZone[];
  counts: { red: number; amber: number; green: number; watch: number }; happyAvg: number | null; now: number;
};

const RECENT_MS = 48 * 3600000;
const toScore = (stars: number) => ((stars - 1) / 4) * 100;

export const zoneFor = (loc: string): TwinZone["id"] | null =>
  /lobby|gate|guard|entrance|ground/i.test(loc) ? "lobby"
    : /park|b1|b2|basement|driveway/i.test(loc) ? "parking"
      : /amenit|pool|gym|deck|function|karaoke|court/i.test(loc) ? "amenity"
        : /elev|lift|stair|core|riser|roof|pump|genset|chiller|fire/i.test(loc) ? "core" : null;

function stateOf(tickets: TwinTicket[], now: number): TwinState {
  const open = tickets.filter((t) => t.status !== "DONE");
  if (open.some((t) => t.status === "NEW" || t.status === "ESCALATED" || now > t.deadline)) return "red";
  if (open.length) return "amber";
  if (tickets.some((t) => t.closedAt && now - t.closedAt < RECENT_MS)) return "green";
  return null;
}

export async function buildingTwin(role: Role): Promise<TwinData> {
  const now = nowManila().getTime();
  const [building, units, wos, pulses, sos, leases, warnings] = await Promise.all([
    prisma.building.findFirst({ select: { name: true } }),
    prisma.unit.findMany({ select: { code: true, floor: true, ownerName: true, owner: { select: { name: true, phone: true } } } }),
    prisma.workOrder.findMany({
      where: { OR: [{ status: { not: "DONE" } }, { closedAt: { gte: new Date(now - RECENT_MS) } }] },
      orderBy: { createdAt: "desc" }, take: 400,
    }),
    prisma.pulse.findMany({ where: { createdAt: { gte: new Date(now - 90 * 86400000) }, unitCode: { not: null } }, select: { unitCode: true, score: true, comment: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.sosAlert.findMany({ where: { status: { not: "RESOLVED" } }, select: { unitCode: true, kind: true, createdAt: true } }),
    prisma.lease.findMany({ where: { end: { gte: new Date(now) }, start: { lte: new Date(now) } }, select: { tenantName: true, unit: { select: { code: true } } } }),
    earlyWarnings(),
  ]);
  const staff = role === "MANAGER" || role === "ADMIN";
  const toTicket = (w: (typeof wos)[number]): TwinTicket => ({
    n: w.number, title: w.title, status: w.status, priority: w.priority, category: w.category, source: w.source,
    createdAt: w.createdAt.getTime(), deadline: w.createdAt.getTime() + w.slaHours * 3600000, closedAt: w.closedAt?.getTime() ?? null,
    assignee: w.assignee, photo: w.photo, aiNote: w.aiNote, rating: w.rating,
  });
  const byLoc = new Map<string, TwinTicket[]>();
  for (const w of wos) { const k = w.location.trim().toUpperCase(); byLoc.set(k, [...(byLoc.get(k) ?? []), toTicket(w)]); }
  const happy = new Map<string, { sum: number; n: number; last: string | null }>();
  for (const p of pulses) { const e = happy.get(p.unitCode!) ?? { sum: 0, n: 0, last: null }; e.sum += toScore(p.score); e.n++; if (p.comment) e.last = p.comment; happy.set(p.unitCode!, e); }
  const sosBy = new Map(sos.filter((s) => s.unitCode).map((s) => [s.unitCode!, { kind: s.kind, at: s.createdAt.getTime() }]));
  const tenantBy = new Map(leases.map((l) => [l.unit.code, l.tenantName]));
  const watchBy = new Map<string, string>();
  for (const w of warnings) for (const c of w.units) if (!watchBy.has(c)) watchBy.set(c, w.title);

  const codes = new Set(units.map((u) => u.code.toUpperCase()));
  const twinUnits: TwinUnit[] = units.map((u) => {
    const tickets = byLoc.get(u.code.toUpperCase()) ?? [];
    const h = happy.get(u.code);
    const s = sosBy.get(u.code) ?? null;
    let state = s ? "red" as TwinState : stateOf(tickets, now);
    const watch = watchBy.get(u.code) ?? null;
    if (!state && watch) state = "watch";
    return {
      code: u.code, floor: u.floor, letter: u.code.replace(/^\d+/, ""), state, tickets,
      owner: u.owner?.name ?? u.ownerName ?? null, tenant: tenantBy.get(u.code) ?? null, phone: staff ? u.owner?.phone ?? null : null,
      happy: h ? Math.round(h.sum / h.n) : null, happyN: h?.n ?? 0, lastComment: staff ? h?.last ?? null : null, sos: s, watch,
    };
  });

  const ZONES: { id: TwinZone["id"]; label: string }[] = [
    { id: "lobby", label: "Lobby and entrance" }, { id: "parking", label: "Parking (B1-B2)" },
    { id: "amenity", label: "Amenity deck" }, { id: "core", label: "Elevators and building systems" },
  ];
  const zones: TwinZone[] = ZONES.map((z) => {
    const locs = [...byLoc.keys()].filter((k) => !codes.has(k) && (zoneFor(k) ?? "core") === z.id);
    const tickets = locs.flatMap((k) => byLoc.get(k)!).sort((a, b) => b.createdAt - a.createdAt);
    const watch = warnings.find((w) => w.zone === z.id)?.title ?? null;
    return { ...z, tickets, locations: locs, state: stateOf(tickets, now) ?? (watch ? "watch" : null), watch };
  });

  const all = [...twinUnits.map((u) => u.state), ...zones.map((z) => z.state)];
  const scored = twinUnits.filter((u) => u.happy != null);
  const floors = units.map((u) => u.floor);
  const letters = [...new Set(units.map((u) => u.code.replace(/^\d+/, "")))].sort();
  return {
    building: building?.name ?? "Skyland Tower",
    floors: [Math.min(...floors, 2), Math.max(...floors, 2)], letters, units: twinUnits, zones,
    counts: { red: all.filter((s) => s === "red").length, amber: all.filter((s) => s === "amber").length, green: all.filter((s) => s === "green").length, watch: all.filter((s) => s === "watch").length },
    happyAvg: scored.length ? Math.round(scored.reduce((s, u) => s + u.happy!, 0) / scored.length) : null,
    now,
  };
}

/* ------------------------------------------------------------------ */
/* Early warnings: patterns in repair history that predict the next problem */
/* ------------------------------------------------------------------ */

export type Warning = { key: string; level: "high" | "medium"; title: string; why: string; action: string; units: string[]; zone: TwinZone["id"] | null; location: string; category: string };

const WET = /leak|water|drip|damp|stain|seep|wet|moist|flood|tulo/i;

export async function earlyWarnings(): Promise<Warning[]> {
  const now = nowManila().getTime();
  const wos = await prisma.workOrder.findMany({
    where: { createdAt: { gte: new Date(now - 60 * 86400000) } },
    select: { location: true, title: true, category: true, createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  const out: Warning[] = [];
  const unitRe = /^(\d{1,2})([A-Z])$/i;

  // 1. Water problems climbing the same vertical stack usually mean a failing riser or shared pipe.
  const wet = wos.filter((w) => unitRe.test(w.location.trim()) && WET.test(w.title) && now - w.createdAt.getTime() < 45 * 86400000);
  const byStack = new Map<string, typeof wet>();
  for (const w of wet) { const L = w.location.trim().toUpperCase().match(unitRe)![2]; byStack.set(L, [...(byStack.get(L) ?? []), w]); }
  for (const [L, list] of byStack) {
    const floors = [...new Set(list.map((w) => Number(w.location.match(unitRe)![1])))].sort((a, b) => a - b);
    // find the tightest cluster of 3+ floors within 6 floors of each other
    for (let i = 0; i + 2 < floors.length; i++) {
      const span = floors.slice(i).filter((f) => f - floors[i] <= 6);
      if (span.length >= 3) {
        const lo = span[0], hi = span[span.length - 1];
        const affected = Array.from({ length: hi - lo + 3 }, (_, k) => `${lo - 1 + k}${L}`);
        out.push({
          key: `stack-${L}-${lo}`, level: "high", category: "Plumbing", zone: null, location: `Stack ${L}, floors ${lo}-${hi}`,
          title: `Likely riser leak in the ${L} stack, floors ${lo} to ${hi}`,
          why: `${span.length} water-related tickets on floors ${span.join(", ")} in the last 45 days. Leaks moving between floors of the same stack usually come from the shared riser, not the units.`,
          action: `Inspect the ${L}-stack riser and shaft before it floods a unit. Tell owners of ${lo - 1}${L} to ${hi + 1}${L} ahead of time.`,
          units: affected,
        });
        break;
      }
    }
  }

  // 2. The same equipment failing twice within 30 days.
  const equip = wos.filter((w) => /elevator|lift|pump|genset|chiller|reader|gate/i.test(w.location + " " + w.category) && !unitRe.test(w.location.trim()) && now - w.createdAt.getTime() < 30 * 86400000);
  const byAsset = new Map<string, typeof equip>();
  for (const w of equip) byAsset.set(w.location.trim(), [...(byAsset.get(w.location.trim()) ?? []), w]);
  for (const [asset, list] of byAsset) if (list.length >= 2) {
    out.push({
      key: `asset-${asset}`, level: "high", category: list[0].category, zone: zoneFor(asset) ?? "core", location: asset,
      title: `${asset} may fail again soon`,
      why: `${list.length} breakdowns in 30 days: ${list.map((w) => w.title.toLowerCase()).join("; ")}. Repeat faults this close together usually point to a worn part, not bad luck.`,
      action: `Ask the vendor for a root-cause check and replace the worn part, not another reset.`,
      units: [],
    });
  }

  // 3. A unit with a repeat problem in the same category: fix the cause, not the symptom.
  const unitCat = new Map<string, typeof wos>();
  for (const w of wos.filter((w) => unitRe.test(w.location.trim()))) { const k = `${w.location.trim().toUpperCase()}|${w.category}`; unitCat.set(k, [...(unitCat.get(k) ?? []), w]); }
  for (const [k, list] of unitCat) if (list.length >= 2 && list.some((w) => w.status !== "DONE")) {
    const [code, cat] = k.split("|");
    if (out.some((o) => o.units.includes(code))) continue;
    out.push({
      key: `repeat-${k}`, level: "medium", category: cat, zone: null, location: code,
      title: `Unit ${code}: ${cat.toLowerCase()} problem keeps coming back`,
      why: `${list.length} ${cat.toLowerCase()} tickets in 60 days (${list.map((w) => w.title.toLowerCase()).join("; ")}).`,
      action: `Send a senior technician for a full check of the ${cat.toLowerCase()} system in ${code} instead of another quick fix.`,
      units: [code],
    });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "high" ? -1 : 1)).slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* Time-to-fix leaderboard                                              */
/* ------------------------------------------------------------------ */

export async function fixLeaderboard(days = 30) {
  const since = new Date(nowManila().getTime() - days * 86400000);
  const done = await prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { gte: since }, assignee: { not: null } }, select: { assignee: true, createdAt: true, closedAt: true, slaHours: true, rating: true } });
  const m = new Map<string, { hrs: number[]; onTime: number; ratings: number[] }>();
  for (const w of done) {
    const e = m.get(w.assignee!) ?? { hrs: [], onTime: 0, ratings: [] };
    const h = (w.closedAt!.getTime() - w.createdAt.getTime()) / 3600000;
    e.hrs.push(h); if (h <= w.slaHours) e.onTime++; if (w.rating) e.ratings.push(w.rating);
    m.set(w.assignee!, e);
  }
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
  return [...m.entries()].filter(([, e]) => e.hrs.length >= 3).map(([who, e]) => ({
    who, jobs: e.hrs.length, medianHrs: median(e.hrs), onTimePct: (e.onTime / e.hrs.length) * 100,
    rating: e.ratings.length ? e.ratings.reduce((s, r) => s + r, 0) / e.ratings.length : null,
  })).sort((a, b) => b.onTimePct - a.onTimePct || a.medianHrs - b.medianHrs);
}
