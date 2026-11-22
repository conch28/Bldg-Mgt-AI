/**
 * Per-person data score: is each staff member's data on time, complete, accurate and verified?
 * Built for coaching first. The person can see exactly which entries lowered it, open flags never
 * count against anyone (only flags a manager confirmed), and the score feeds a bonus, not pay deductions.
 */
import { prisma } from "./db";
import { nowManila } from "./format";
import { ackDue } from "./duties";
import { CHECKPOINTS } from "./rounds";

const H = 3600000, D = 24 * H;
export const SCORE_DAYS = 30;

/** Pay link: monthly data bonus for 90%+ with no confirmed serious flag. No deductions (Labor Code limits them). */
export const SCORE_POLICY = {
  bonusMin: 90,
  minEntries: 3,
  bands: [
    { min: 95, label: "Excellent", cls: "t-ok" },
    { min: 85, label: "Good", cls: "t-ok" },
    { min: 70, label: "Needs coaching", cls: "t-warn" },
    { min: 0, label: "Action plan", cls: "t-bad" },
  ],
};
export const PILLARS = [
  { key: "onTime", label: "On time", what: "Entered by the deadline" },
  { key: "complete", label: "Complete", what: "Photo, readings and required fields all there" },
  { key: "accurate", label: "Accurate", what: "No failed spot checks or confirmed flags" },
  { key: "verified", label: "Verified", what: "Passed the checker the first time" },
] as const;
export type PillarKey = (typeof PILLARS)[number]["key"];
export type Measure = { ok: number; of: number };
export type Miss = { pillar: PillarKey; text: string; href: string };
export type PersonScore = {
  name: string; kind: "TECH" | "GUARD" | "MANAGER"; kindLabel: string; entries: number;
  vendor: boolean; // an outside company: no staff bonus; a high score counts toward contract renewal instead
  pillars: Record<PillarKey, Measure>; score: number | null; band: { label: string; cls: string } | null;
  bonus: boolean; openFlags: number; confirmedFlags: number; misses: Miss[];
};

const pct = (m: Measure) => (m.of ? Math.round((m.ok / m.of) * 100) : null);
export const pillarPct = pct;
export const bandFor = (score: number) => SCORE_POLICY.bands.find((b) => score >= b.min)!;

export async function staffScores(now = nowManila(), days = SCORE_DAYS): Promise<PersonScore[]> {
  const since = new Date(now.getTime() - days * D);
  const [wos, rounds, audits, flags, staff, vendors] = await Promise.all([
    prisma.workOrder.findMany({ where: { OR: [{ closedAt: { gte: since } }, { createdAt: { gte: since } }] }, select: { number: true, title: true, location: true, createdAt: true, closedAt: true, status: true, slaHours: true, doneBy: true, donePhoto: true, verifiedAt: true, verifiedBy: true, ackAt: true, ackBy: true, assignee: true, rating: true, events: { where: { note: { startsWith: "Sent back by" } }, select: { createdAt: true } } } }),
    prisma.guardRound.findMany({ where: { startedAt: { gte: since } }, select: { id: true, startedAt: true, submittedAt: true, checked: true, guard: { select: { name: true } }, _count: { select: { readings: true } } } }),
    prisma.spotAudit.findMany({ where: { pickedAt: { gte: since } } }),
    prisma.entryFlag.findMany({ where: { createdAt: { gte: since } }, select: { person: true, refs: true, status: true, severity: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "ADMIN"] }, active: true }, select: { name: true } }),
    prisma.vendor.findMany({ select: { name: true } }),
  ]);
  const vendorNames = vendors.map((v) => v.name.toLowerCase());
  const isVendor = (n: string) => /^vendor:/i.test(n) || vendorNames.some((v) => v.startsWith(n.toLowerCase()) || n.toLowerCase().includes(v));
  const people = new Map<string, PersonScore>();
  const get = (name: string, kind: PersonScore["kind"]) => {
    const k = `${kind}:${name}`;
    const vendor = kind === "TECH" && isVendor(name);
    if (!people.has(k)) people.set(k, { name, kind, vendor, kindLabel: kind === "TECH" ? (vendor ? "Vendor" : "Technician") : kind === "GUARD" ? "Guard" : "Property manager", entries: 0,
      pillars: { onTime: { ok: 0, of: 0 }, complete: { ok: 0, of: 0 }, accurate: { ok: 0, of: 0 }, verified: { ok: 0, of: 0 } }, score: null, band: null, bonus: false, openFlags: 0, confirmedFlags: 0, misses: [] });
    return people.get(k)!;
  };
  const add = (p: PersonScore, key: PillarKey, ok: boolean, miss?: Omit<Miss, "pillar">) => {
    p.pillars[key].of++; if (ok) p.pillars[key].ok++; else if (miss) p.misses.push({ pillar: key, ...miss });
  };
  // A flag mentioning a person's name counts for them ("Jun P. and Rudy M." counts for both).
  const flagsFor = (name: string) => flags.filter((f) => f.person === name || f.person.split(" and ").includes(name));
  const badRef = (name: string, ref: string) =>
    audits.some((a) => a.person === name && a.result === "ISSUE" && a.label.startsWith(ref + " ")) ||
    flagsFor(name).some((f) => f.status === "CONFIRMED" && f.refs.includes(ref));

  // Technicians and vendors: one entry per finished job.
  for (const w of wos.filter((w) => w.status === "DONE" && w.closedAt && w.closedAt >= since && w.doneBy)) {
    const p = get(w.doneBy!, "TECH"); p.entries++;
    const ref = `WO-${w.number}`, href = `/work-orders?wo=${w.number}`;
    const late = (w.closedAt!.getTime() - w.createdAt.getTime()) / H - w.slaHours;
    add(p, "onTime", late <= 0, { text: `${ref} ${w.title}: finished ${Math.round(late)}h after the deadline`, href });
    add(p, "complete", Boolean(w.donePhoto), { text: `${ref} ${w.title}: closed without an after photo`, href });
    add(p, "accurate", !badRef(p.name, ref), { text: `${ref} ${w.title}: a spot check or confirmed flag found a problem`, href });
    if (w.verifiedAt || w.events.length) add(p, "verified", Boolean(w.verifiedAt) && !w.events.length, { text: `${ref} ${w.title}: sent back by the manager before it passed`, href });
  }
  // Guards: one entry per round.
  for (const r of rounds) {
    const p = get(r.guard.name, "GUARD"); p.entries++;
    const label = `${new Date(r.startedAt.getTime() + 8 * H).toISOString().slice(5, 16).replace("T", " ")} round`;
    const due = r.startedAt.getTime() + 14 * H; // end of the 12-hour shift + 2 hours
    add(p, "onTime", Boolean(r.submittedAt && r.submittedAt.getTime() <= due), { text: `${label}: ${r.submittedAt ? "submitted late" : "never submitted"}`, href: "/rounds" });
    const missingStops = CHECKPOINTS.length - r.checked.length, noReads = r._count.readings === 0;
    add(p, "complete", Boolean(r.submittedAt) && missingStops <= 0 && !noReads, { text: `${label}: ${[missingStops > 0 && `${missingStops} stop${missingStops > 1 ? "s" : ""} skipped`, noReads && "no meter readings"].filter(Boolean).join(", ") || "not submitted"}`, href: "/rounds" });
    const audit = audits.find((a) => a.kind === "ROUND" && a.refId === r.id && a.result);
    // Confirmed flags on rounds are counted once per flag below.
    add(p, "accurate", audit?.result !== "ISSUE", { text: `${label}: a spot check found a problem`, href: "/rounds" });
    if (audit) add(p, "verified", audit.result === "PASS", { text: `${label}: did not pass the spot check`, href: "/rounds" });
  }
  // Property managers: acknowledgements, verifications and their own spot checks.
  const mgrNames = new Set(staff.map((s) => s.name));
  for (const w of wos) {
    if (w.ackAt && w.ackBy && mgrNames.has(w.ackBy) && w.createdAt >= since) {
      const p = get(w.ackBy, "MANAGER"); p.entries++;
      const href = `/work-orders?wo=${w.number}`;
      add(p, "onTime", w.ackAt <= ackDue(w.createdAt), { text: `WO-${w.number}: acknowledged after the 1h/4h window`, href });
      add(p, "complete", Boolean(w.assignee), { text: `WO-${w.number}: acknowledged without assigning anyone`, href });
    }
    if (w.verifiedAt && w.verifiedBy && mgrNames.has(w.verifiedBy) && w.closedAt && w.closedAt >= since) {
      const p = get(w.verifiedBy, "MANAGER"); p.entries++;
      const href = `/work-orders?wo=${w.number}`;
      add(p, "onTime", w.verifiedAt.getTime() - w.closedAt.getTime() <= 24 * H, { text: `WO-${w.number}: verified more than 24h after completion`, href });
      // A check on the checker: repairs they verified should leave the resident happy.
      if (w.rating) add(p, "verified", w.rating >= 3, { text: `WO-${w.number}: verified, but the resident rated it ${w.rating}/5`, href });
    }
  }
  for (const a of audits) {
    if (a.checkedBy && mgrNames.has(a.checkedBy)) { const p = get(a.checkedBy, "MANAGER"); p.entries++; add(p, "onTime", a.checkedAt! <= a.dueAt, { text: `Spot check of ${a.label}: done after the due date`, href: "/integrity?tab=audits" }); add(p, "complete", a.result === "PASS" || Boolean(a.note), { text: `Spot check of ${a.label}: issue logged without a note`, href: "/integrity?tab=audits" }); }
    else if (!a.checkedAt && a.dueAt < now) for (const n of mgrNames) { const p = get(n, "MANAGER"); p.entries++; add(p, "onTime", false, { text: `Spot check of ${a.label}: not done by the due date`, href: "/integrity?tab=audits" }); }
  }

  // Confirmed flags lower accuracy for whoever they name, once per flag, on top of the per-entry checks.
  for (const p of people.values()) {
    const mine = flagsFor(p.name);
    p.openFlags = mine.filter((f) => f.status === "OPEN").length;
    p.confirmedFlags = mine.filter((f) => f.status === "CONFIRMED").length;
    if (p.kind === "GUARD" || p.kind === "MANAGER") {
      for (const f of mine.filter((f) => f.status === "CONFIRMED")) { p.pillars.accurate.of++; p.misses.push({ pillar: "accurate", text: `Confirmed: ${f.refs.join(", ")}`, href: "/integrity?tab=flags" }); }
      if (p.kind === "MANAGER") { p.pillars.accurate.of += p.entries; p.pillars.accurate.ok += p.entries; }
    }
    const parts = PILLARS.map((x) => pct(p.pillars[x.key])).filter((v): v is number => v != null);
    p.score = p.entries >= SCORE_POLICY.minEntries && parts.length ? Math.round(parts.reduce((s, v) => s + v, 0) / parts.length) : null;
    p.band = p.score == null ? null : bandFor(p.score);
    p.bonus = !p.vendor && p.score != null && p.score >= SCORE_POLICY.bonusMin && !mine.some((f) => f.status === "CONFIRMED" && f.severity >= 2);
    p.misses = p.misses.slice(-6).reverse();
  }
  const order = { GUARD: 0, TECH: 1, MANAGER: 2 };
  return [...people.values()].filter((p) => p.entries > 0).sort((a, b) => order[a.kind] - order[b.kind] || (b.score ?? -1) - (a.score ?? -1) || b.entries - a.entries);
}

/** Plain-language coaching line for a person's lowest pillar. */
export function coachingTip(p: PersonScore): string | null {
  const low = PILLARS.map((x) => ({ x, v: pct(p.pillars[x.key]) })).filter((r) => r.v != null && r.v < 95).sort((a, b) => a.v! - b.v!)[0];
  if (!low) return null;
  const tips: Record<PillarKey, string> = {
    onTime: p.kind === "GUARD" ? "Submit the round before the shift changes. Tap each stop as you walk it, so there's nothing left to type at the end." : p.kind === "TECH" ? "Tap Done on the job link as soon as you finish, before going to the next job." : "Acknowledge new tickets within the hour and verify finished jobs the same day.",
    complete: p.kind === "GUARD" ? "Don't skip stops or meter readings. If a stop is locked, tap it with a problem and a note." : p.kind === "TECH" ? "Every job needs an after photo of the finished work." : "Assign a technician when you acknowledge a ticket.",
    accurate: "Write what you actually did on that job, and take a fresh photo every time.",
    verified: p.kind === "MANAGER" ? "Before tapping Verify, look at the photo closely or ask the resident if it's fixed." : "Test the repair before taking the after photo so it passes the first time.",
  };
  return `${low.x.label} is lowest at ${low.v}%. ${tips[low.x.key]}`;
}
