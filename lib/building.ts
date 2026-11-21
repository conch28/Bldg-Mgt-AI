/**
 * Live building model ("digital twin") for the 3D view, plus early-warning checks
 * and the time-to-fix leaderboard. Everything here is computed from our own data,
 * so it works with or without an Anthropic key.
 */
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { nowManila } from "./format";
import { SITE, parseUnit, towerLabel } from "./skyland";

export type TwinState = "red" | "amber" | "green" | "watch" | null;
export type TwinTicket = {
  n: number; title: string; status: string; priority: string; category: string; source: string;
  createdAt: number; deadline: number; closedAt: number | null; assignee: string | null; photo: string | null; aiNote: string | null; rating: number | null;
};
export type TwinUnit = {
  code: string; floor: number; tower: string; stack: string; penthouse: boolean; state: TwinState;
  tickets: TwinTicket[]; owner: string | null; tenant: string | null; phone: string | null;
  happy: number | null; happyN: number; lastComment: string | null; sos: { kind: string; at: number } | null; watch: string | null;
  sqm: number; occ: Occupancy; leaseEnd: number | null; market: Market; price: number | null;
  dues: DuesBucket; balance: number; daysLate: number;
};
export type Occupancy = "OWNER" | "LEASED" | "VACANT" | "UNKNOWN";
export type Market = "SALE" | "LEASE" | "NONE";
export type DuesBucket = "PAID" | "DUE" | "LATE30" | "LATE90" | "LATE90P";
export type ZoneInfo = { head: string; rows: { label: string; sub: string }[] };
export type TwinZone = { id: "lobby" | "parking" | "amenity" | "core"; label: string; about: string; state: TwinState; tickets: TwinTicket[]; locations: string[]; watch: string | null; info: ZoneInfo[] };
export type TwinData = {
  building: string; units: TwinUnit[]; zones: TwinZone[];
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
    prisma.unit.findMany({ select: { id: true, code: true, floor: true, sqm: true, occupancy: true, ownerName: true, owner: { select: { name: true, phone: true } } } }),
    prisma.workOrder.findMany({
      where: { OR: [{ status: { not: "DONE" } }, { closedAt: { gte: new Date(now - RECENT_MS) } }] },
      orderBy: { createdAt: "desc" }, take: 400,
    }),
    prisma.pulse.findMany({ where: { createdAt: { gte: new Date(now - 90 * 86400000) }, unitCode: { not: null } }, select: { unitCode: true, score: true, comment: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.sosAlert.findMany({ where: { status: { not: "RESOLVED" } }, select: { unitCode: true, kind: true, createdAt: true } }),
    prisma.lease.findMany({ where: { end: { gte: new Date(now) }, start: { lte: new Date(now) } }, select: { tenantName: true, end: true, unit: { select: { code: true } } } }),
    earlyWarnings(),
  ]);
  const ymd = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const dayStart = new Date(ymd + "T00:00:00+08:00"), dayEnd = new Date(dayStart.getTime() + 86400000);
  const [listings, unpaid, bookings, vehicles] = await Promise.all([
    prisma.listing.findMany({ where: { status: "LIVE" }, select: { unitId: true, kind: true, price: true } }),
    prisma.bill.findMany({ where: { status: { not: "PAID" } }, select: { unitId: true, amount: true, paid: true, dueDate: true } }),
    prisma.amenityBooking.findMany({ where: { status: "CONFIRMED", start: { gte: dayStart, lt: dayEnd } }, select: { start: true, end: true, guests: true, amenity: { select: { name: true } }, unit: { select: { code: true } } }, orderBy: { start: "asc" } }),
    prisma.registration.findMany({ where: { kind: "VEHICLE", status: "APPROVED" }, select: { name: true, details: true, unit: { select: { code: true } } } }),
  ]);
  const listBy = new Map<string, { kind: string; price: number }>();
  for (const l of listings) { const cur = listBy.get(l.unitId); if (!cur || l.kind === "SALE") listBy.set(l.unitId, { kind: l.kind, price: Number(l.price) }); }
  const owe = new Map<string, { balance: number; oldestLate: number | null; dueNow: boolean }>();
  for (const b of unpaid) {
    const e = owe.get(b.unitId) ?? { balance: 0, oldestLate: null, dueNow: false };
    const left = Number(b.amount) - Number(b.paid);
    if (left <= 0) continue;
    e.balance += left;
    const due = b.dueDate.getTime();
    if (due < now) e.oldestLate = Math.min(e.oldestLate ?? due, due); else e.dueNow = true;
    owe.set(b.unitId, e);
  }
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
  const leaseEndBy = new Map(leases.map((l) => [l.unit.code, l.end.getTime()]));
  const watchBy = new Map<string, string>();
  for (const w of warnings) for (const c of w.units) if (!watchBy.has(c)) watchBy.set(c, w.title);

  const codes = new Set(units.map((u) => u.code.toUpperCase()));
  const twinUnits: TwinUnit[] = units.map((u) => {
    const p = parseUnit(u.code);
    const o = owe.get(u.id);
    const lateDays = o?.oldestLate != null ? Math.floor((now - o.oldestLate) / 86400000) : 0;
    const tickets = byLoc.get(u.code.toUpperCase()) ?? [];
    const h = happy.get(u.code);
    const s = sosBy.get(u.code) ?? null;
    let state = s ? "red" as TwinState : stateOf(tickets, now);
    const watch = watchBy.get(u.code) ?? null;
    if (!state && watch) state = "watch";
    return {
      code: u.code, floor: u.floor, tower: p?.tower ?? "?", stack: p?.stack ?? "", penthouse: !!p?.penthouse, state, tickets,
      owner: u.owner?.name ?? u.ownerName ?? null, tenant: tenantBy.get(u.code) ?? null, phone: staff ? u.owner?.phone ?? null : null,
      happy: h ? Math.round(h.sum / h.n) : null, happyN: h?.n ?? 0, lastComment: staff ? h?.last ?? null : null, sos: s, watch,
      sqm: Number(u.sqm),
      occ: tenantBy.has(u.code) ? "LEASED" : u.occupancy === "OWNER" ? "OWNER" : u.occupancy === "VACANT" ? "VACANT" : "UNKNOWN",
      leaseEnd: leaseEndBy.get(u.code) ?? null,
      market: (listBy.get(u.id)?.kind as Market | undefined) ?? "NONE", price: listBy.get(u.id)?.price ?? null,
      dues: !o ? "PAID" : o.oldestLate == null ? "DUE" : lateDays <= 30 ? "LATE30" : lateDays <= 90 ? "LATE90" : "LATE90P",
      balance: o?.balance ?? 0, daysLate: lateDays,
    };
  });

  const hm = (d: Date) => d.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  const lvl = (d: string) => d.match(/slot\s+(B\d)-/i)?.[1]?.toUpperCase() ?? "Unassigned";
  const levels = ["B1", "B2", "Unassigned"].map((L) => ({ L, list: vehicles.filter((v) => lvl(v.details) === L) })).filter((x) => x.list.length);
  const INFO: Record<TwinZone["id"], ZoneInfo[]> = {
    amenity: [{ head: `Bookings today (${bookings.length})`, rows: bookings.map((b) => ({ label: `${b.amenity.name} · ${hm(b.start)}-${hm(b.end)}`, sub: `Unit ${b.unit.code}${b.guests ? ` · ${b.guests} guest${b.guests === 1 ? "" : "s"}` : ""}` })) }],
    parking: levels.map(({ L, list }) => ({
      head: L === "Unassigned" ? `Registered, no slot yet (${list.length})` : `Level ${L}: ${list.length} registered vehicle${list.length === 1 ? "" : "s"}`,
      rows: list.map((v) => ({ label: `${v.details.match(/slot\s+(B\d-\d+)/i)?.[1] ?? "No slot"} · Unit ${v.unit.code}`, sub: staff ? `${v.name} · ${v.details.split("·")[0].trim()}` : v.details.split("·")[0].trim() })),
    })),
    lobby: [], core: [],
  };
  const ZONES: { id: TwinZone["id"]; label: string; about: string }[] = [
    { id: "lobby", label: "Lobbies and entrance", about: "Ground-floor lobby of each tower, guard desk and entrance." },
    { id: "parking", label: "Parking (B1-B2)", about: "Two basement parking levels under both towers." },
    { id: "amenity", label: `Pool deck and ${SITE.amenityFloor}th-floor amenities`, about: `Pool deck on the podium, gym and function rooms on the ${SITE.amenityFloor}th floor, kids' play area, helipad on Tower A.` },
    { id: "core", label: "Elevators and building systems", about: "Two lifts per tower, stairs, risers, pumps and the roof deck." },
  ];
  const zones: TwinZone[] = ZONES.map((z) => {
    const locs = [...byLoc.keys()].filter((k) => !codes.has(k) && (zoneFor(k) ?? "core") === z.id);
    const tickets = locs.flatMap((k) => byLoc.get(k)!).sort((a, b) => b.createdAt - a.createdAt);
    const watch = warnings.find((w) => w.zone === z.id)?.title ?? null;
    return { ...z, tickets, locations: locs, state: stateOf(tickets, now) ?? (watch ? "watch" : null), watch, info: INFO[z.id] };
  });

  const all = [...twinUnits.map((u) => u.state), ...zones.map((z) => z.state)];
  const scored = twinUnits.filter((u) => u.happy != null);
  return {
    building: building?.name ?? SITE.name,
    units: twinUnits, zones,
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
  const isUnit = (loc: string) => !!parseUnit(loc);

  // 1. Water problems climbing the same vertical stack usually mean a failing riser or shared pipe.
  const wet = wos.filter((w) => isUnit(w.location) && WET.test(w.title) && now - w.createdAt.getTime() < 45 * 86400000);
  const byStack = new Map<string, typeof wet>();
  for (const w of wet) { const u = parseUnit(w.location)!; const k = u.stack + u.tower; byStack.set(k, [...(byStack.get(k) ?? []), w]); }
  for (const [k, list] of byStack) {
    const stack = k.slice(0, 2), tower = k.slice(2), name = `${towerLabel(tower)} stack ${stack}`;
    const code = (f: number) => `${f}${stack}${tower}`;
    const floors = [...new Set(list.map((w) => parseUnit(w.location)!.floor))].sort((a, b) => a - b);
    // find the tightest cluster of 3+ floors within 6 floors of each other
    for (let i = 0; i + 2 < floors.length; i++) {
      const span = floors.slice(i).filter((f) => f - floors[i] <= 6);
      if (span.length >= 3) {
        const lo = span[0], hi = span[span.length - 1];
        const affected = Array.from({ length: hi - lo + 3 }, (_, j) => lo - 1 + j).filter((f) => f !== SITE.amenityFloor && f > 1 && f < SITE.penthouseFloor).map(code);
        out.push({
          key: `stack-${k}-${lo}`, level: "high", category: "Plumbing", zone: null, location: `${name}, floors ${lo}-${hi}`,
          title: `Likely riser leak in ${name}, floors ${lo} to ${hi}`,
          why: `${span.length} water-related tickets on floors ${span.join(", ")} in the last 45 days. Leaks moving between floors of the same stack usually come from the shared riser, not the units.`,
          action: `Inspect the riser and shaft of ${name} before it floods a unit. Tell owners of units ${affected[0]} to ${affected[affected.length - 1]} ahead of time.`,
          units: affected,
        });
        break;
      }
    }
  }

  // 2. The same equipment failing twice within 30 days.
  const equip = wos.filter((w) => /elevator|lift|pump|genset|chiller|reader|gate/i.test(w.location + " " + w.category) && !isUnit(w.location) && now - w.createdAt.getTime() < 30 * 86400000);
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
  for (const w of wos.filter((w) => isUnit(w.location))) { const k = `${w.location.trim().toUpperCase()}|${w.category}`; unitCat.set(k, [...(unitCat.get(k) ?? []), w]); }
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
