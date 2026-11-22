/**
 * Entry checks and spot audits: two ways to keep staff data honest without watching people all day.
 *
 * 1. Flags (scanEntries): the app looks for reused or near-identical proof photos, an after photo that
 *    matches the resident's problem photo, copy-pasted notes, and many entries made at once instead of
 *    as the work happened. A flag is a prompt to check, never proof: the manager (not the person flagged)
 *    clears it or confirms it, and the staff member can give their side. Only confirmed flags lower a score.
 * 2. Spot audits (drawSpotAudits): each week the app picks a random sample of finished jobs, rounds and
 *    receipts for the manager to re-check in person. The app picks, so no one chooses which work is looked at.
 */
import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { fmtDateTime, fmtTime, nowManila } from "./format";
import { photoSig, photoDistance, sigParts } from "./photosig";
import { comparePhotos, explainFlag } from "./ai";
import { CHECKPOINTS } from "./rounds";

const MIN = 60000, H = 3600000, D = 24 * H;
export const SCAN_DAYS = 30;

export const FLAG_KIND: Record<string, { label: string; check: string }> = {
  SAME_PHOTO: { label: "Same photo used twice", check: "Open both jobs. If they were really two separate repairs, ask for a fresh photo of each." },
  SIMILAR_PHOTO: { label: "Nearly identical photos", check: "Compare both photos. Same fixture fixed twice is fine; the same shot re-used for different jobs is not." },
  AFTER_LIKE_BEFORE: { label: "After photo looks like the problem photo", check: "The proof photo may be the resident's own photo. Look at the unit or ask the technician for a real after photo." },
  COPIED_NOTE: { label: "Copy-pasted notes", check: "Identical notes on different jobs often mean the note was not written for the job. Ask what was actually done." },
  BATCHED: { label: "Entered all at once", check: "Several jobs in different places were marked done within minutes. Ask whether they were entered at the end of the shift, and coach to enter as you go." },
  FAST_ROUND: { label: "Round entered too fast", check: "A full round cannot be walked this fast. Check CCTV or ask the guard; coach to tap each stop while standing there." },
};

type NewFlag = { key: string; kind: keyof typeof FLAG_KIND; person: string; refs: string[]; href: string; title: string; detail: string; severity: 1 | 2; ai?: () => Promise<string | null> };

/* ---------- text similarity (copy-paste notes) ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
function grams(s: string) { const g = new Set<string>(); for (let i = 0; i < s.length - 2; i++) g.add(s.slice(i, i + 3)); return g; }
export function similarity(a: string, b: string) {
  const A = grams(norm(a)), B = grams(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Fill in missing photo fingerprints for recent work orders (done once per photo). */
async function ensureSigs(since: Date) {
  const missing = await prisma.workOrder.findMany({
    where: { closedAt: { gte: since }, OR: [{ donePhoto: { not: null }, donePhotoSig: null }, { photo: { not: null }, photoSig: null }] },
    select: { id: true, photo: true, donePhoto: true, photoSig: true, donePhotoSig: true }, take: 400,
  });
  for (const w of missing) {
    await prisma.workOrder.update({ where: { id: w.id }, data: {
      ...(w.donePhoto && !w.donePhotoSig ? { donePhotoSig: photoSig(w.donePhoto) ?? "none:" } : {}),
      ...(w.photo && !w.photoSig ? { photoSig: photoSig(w.photo) ?? "none:" } : {}),
    } });
  }
}

/** Finds entries worth a second look. Pure detection: returns candidate flags, writes nothing but fingerprints. */
export async function detectFlags(now = nowManila()): Promise<NewFlag[]> {
  const since = new Date(now.getTime() - SCAN_DAYS * D);
  await ensureSigs(since);
  const [wos, rounds, desk] = await Promise.all([
    prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { gte: since } }, select: { id: true, number: true, title: true, location: true, category: true, doneBy: true, doneNote: true, closedAt: true, photoSig: true, donePhotoSig: true, photo: true, donePhoto: true }, orderBy: { closedAt: "asc" } }),
    prisma.guardRound.findMany({ where: { startedAt: { gte: since }, submittedAt: { not: null } }, select: { id: true, startedAt: true, submittedAt: true, notes: true, checked: true, guard: { select: { name: true } }, _count: { select: { readings: true } } }, orderBy: { startedAt: "asc" } }),
    prisma.workOrder.findMany({ where: { createdAt: { gte: since }, source: { in: ["Walk-in", "Phone"] }, reporter: { role: { in: ["GUARD", "MANAGER", "ADMIN"] } } }, select: { number: true, title: true, location: true, createdAt: true, reporter: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const out: NewFlag[] = [];
  const woRef = (w: { number: number }) => `WO-${w.number}`;
  const woHref = (w: { number: number }) => `/work-orders?wo=${w.number}`;

  // 1) Proof photos: exact copies and near-identical pictures across different jobs.
  const withPhoto = wos.filter((w) => w.donePhotoSig && !w.donePhotoSig.startsWith("none"));
  for (let i = 0; i < withPhoto.length; i++) for (let j = i + 1; j < withPhoto.length; j++) {
    const a = withPhoto[i], b = withPhoto[j];
    const d = photoDistance(a.donePhotoSig!, b.donePhotoSig!);
    if (d == null || d > 6) continue;
    const who = a.doneBy === b.doneBy ? (a.doneBy ?? "Unknown") : `${a.doneBy ?? "?"} and ${b.doneBy ?? "?"}`;
    const same = sigParts(a.donePhotoSig!).sha === sigParts(b.donePhotoSig!).sha; // identical file, not just a similar picture
    const where = a.location === b.location ? `both at ${a.location}` : `${a.location} and ${b.location}`;
    out.push({
      key: `${same ? "same" : "similar"}-photo:${a.number}:${b.number}`, kind: same ? "SAME_PHOTO" : "SIMILAR_PHOTO", person: who, refs: [woRef(a), woRef(b)], href: woHref(b), severity: same ? 2 : 1,
      title: `${same ? "The same after photo" : "Nearly identical after photos"} on ${woRef(a)} and ${woRef(b)}`,
      detail: `${a.title} and ${b.title} (${where}), marked done ${fmtDateTime(a.closedAt!)} and ${fmtDateTime(b.closedAt!)}.${same ? " The image files are identical." : ` The pictures differ by only ${d} of 64 points.`}`,
      ai: same ? undefined : async () => {
        const r = await comparePhotos(a.donePhoto!, b.donePhoto!, `Job 1: ${a.title} at ${a.location}. Job 2: ${b.title} at ${b.location}.`);
        return r ? `${r.same_shot ? "AI check: looks like the same photograph." : r.same_spot ? "AI check: same spot, but a different photo." : "AI check: these look like different photos."} ${r.why}` : null;
      },
    });
  }
  // 2) After photo matching the resident's problem photo.
  for (const w of wos) {
    if (!w.photoSig || !w.donePhotoSig || w.photoSig.startsWith("none") || w.donePhotoSig.startsWith("none")) continue;
    const d = photoDistance(w.photoSig, w.donePhotoSig);
    if (d == null || d > 6) continue;
    out.push({ key: `after-like-before:${w.number}`, kind: "AFTER_LIKE_BEFORE", person: w.doneBy ?? "Unknown", refs: [woRef(w)], href: woHref(w), severity: 2,
      title: `${woRef(w)}: the after photo looks like the resident's problem photo`,
      detail: `${w.title} (${w.location}), marked done ${fmtDateTime(w.closedAt!)}. ${sigParts(w.photoSig).sha === sigParts(w.donePhotoSig).sha ? "It is the same image file." : `The two pictures differ by only ${d} of 64 points.`}` });
  }
  // 3) Copy-pasted notes: the same person pasting one note (85%+ alike, 25+ characters) on jobs of different kinds,
  //    where it can't describe them all. Standard notes for the same kind of fix ("Replaced faucet cartridge") are fine.
  const notes = [
    ...wos.filter((w) => w.doneNote && norm(w.doneNote).length >= 25).map((w) => ({ ref: woRef(w), href: woHref(w), person: w.doneBy ?? "Unknown", text: w.doneNote!, kind: w.category, round: false })),
    ...rounds.filter((r) => r.notes && norm(r.notes).length >= 25).map((r) => ({ ref: `Round ${fmtDateTime(r.startedAt)}`, href: "/rounds", person: r.guard.name, text: r.notes!, kind: "round", round: true })),
  ];
  const used = new Set<number>();
  for (let i = 0; i < notes.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < notes.length; j++) if (!used.has(j) && notes[j].person === notes[i].person && notes[j].round === notes[i].round && similarity(notes[i].text, notes[j].text) >= 0.85) group.push(j);
    const g = group.map((k) => notes[k]);
    const suspicious = g[0].round ? g.length >= 4 : g.length >= 3 && new Set(g.map((x) => x.kind)).size >= 2;
    if (!suspicious) continue;
    group.forEach((k) => used.add(k));
    out.push({ key: `copied-note:${g[0].ref}:${g[1].ref}`, kind: "COPIED_NOTE", person: g[0].person, refs: g.map((x) => x.ref), href: g[g.length - 1].href, severity: 1,
      title: `The same note on ${g.length} ${g[0].round ? "rounds" : `different kinds of jobs`}`,
      detail: `“${g[0].text.slice(0, 120)}” was used on ${g.map((x) => x.ref).join(", ")}${g[0].round ? "" : ` (${[...new Set(g.map((x) => x.kind.toLowerCase()))].join(", ")})`}.` });
  }
  // 4) Batched job completions: 3+ jobs in 2+ places marked done within 15 minutes by the same person.
  const byPerson = new Map<string, typeof wos>();
  for (const w of wos) if (w.doneBy) byPerson.set(w.doneBy, [...(byPerson.get(w.doneBy) ?? []), w]);
  for (const [person, list] of byPerson) {
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j + 1 < list.length && list[j + 1].closedAt!.getTime() - list[i].closedAt!.getTime() <= 15 * MIN) j++;
      const g = list.slice(i, j + 1);
      if (g.length >= 3 && new Set(g.map((w) => w.location)).size >= 2) {
        const mins = Math.max(1, Math.round((g[g.length - 1].closedAt!.getTime() - g[0].closedAt!.getTime()) / MIN));
        out.push({ key: `batched:${person}:${g[0].number}`, kind: "BATCHED", person, refs: g.map(woRef), href: woHref(g[0]), severity: 1,
          title: `${g.length} jobs in ${new Set(g.map((w) => w.location)).size} places marked done within ${mins} minutes`,
          detail: `${g.map((w) => `${woRef(w)} ${w.location}`).join(", ")}, between ${fmtTime(g[0].closedAt!)} and ${fmtTime(g[g.length - 1].closedAt!)}. Jobs in different places can't usually be finished this close together, so they were probably entered later.` });
        i = j + 1;
      } else i++;
    }
  }
  // 5) Front desk: 4+ walk-in or phone complaints logged within 10 minutes by the same person.
  const deskBy = new Map<string, typeof desk>();
  for (const w of desk) if (w.reporter) deskBy.set(w.reporter.name, [...(deskBy.get(w.reporter.name) ?? []), w]);
  for (const [person, list] of deskBy) {
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j + 1 < list.length && list[j + 1].createdAt.getTime() - list[i].createdAt.getTime() <= 10 * MIN) j++;
      const g = list.slice(i, j + 1);
      if (g.length >= 4) {
        out.push({ key: `batched-desk:${person}:${g[0].number}`, kind: "BATCHED", person, refs: g.map(woRef), href: woHref(g[0]), severity: 1,
          title: `${g.length} walk-in or phone complaints logged within 10 minutes`,
          detail: `${g.map((w) => `${woRef(w)} ${w.title}`).join("; ")}. Complaints should be logged within 15 minutes of each call or visit, not saved up.` });
        i = j + 1;
      } else i++;
    }
  }
  // 6) Rounds entered too fast: 13 stops plus meter readings in under 15 minutes.
  const typical = new Map<string, number[]>();
  for (const r of rounds) typical.set(r.guard.name, [...(typical.get(r.guard.name) ?? []), (r.submittedAt!.getTime() - r.startedAt.getTime()) / MIN]);
  for (const r of rounds) {
    const mins = (r.submittedAt!.getTime() - r.startedAt.getTime()) / MIN;
    if (mins >= 15) continue;
    const others = (typical.get(r.guard.name) ?? []).filter((m) => m >= 15).sort((a, b) => a - b);
    const usual = others.length ? Math.round(others[Math.floor(others.length / 2)]) : null;
    const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(r.submittedAt!));
    const m = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", minute: "numeric" }).format(r.submittedAt!));
    const toEnd = ((h < 6 ? 6 : h < 18 ? 18 : 30) - h) * 60 - m; // minutes left in the shift (6 AM / 6 PM changeover)
    out.push({ key: `fast-round:${r.id}`, kind: "FAST_ROUND", person: r.guard.name, refs: [`Round ${fmtDateTime(r.startedAt)}`], href: "/rounds", severity: mins < 8 ? 2 : 1,
      title: `Round of ${r.checked.length} stops entered in ${Math.max(1, Math.round(mins))} minutes`,
      detail: `Started ${fmtTime(r.startedAt)}, submitted ${fmtTime(r.submittedAt!)}${toEnd >= 0 && toEnd <= 45 ? `, ${toEnd} minutes before the shift ended` : ""}, with ${r._count.readings} meter readings. The full walk (${CHECKPOINTS.length} stops) usually takes ${usual ? `this guard about ${usual} minutes` : "35 to 50 minutes"}.` });
  }
  return out;
}

/** Saves new flags (never re-opens one a manager already cleared or confirmed) and refreshes open ones. */
export async function scanEntries(now = nowManila(), opts: { aiLimit?: number } = {}) {
  const found = await detectFlags(now);
  const existing = await prisma.entryFlag.findMany({ where: { key: { in: found.map((f) => f.key) } }, select: { key: true, status: true } });
  const have = new Map(existing.map((e) => [e.key, e.status]));
  let created = 0, aiBudget = opts.aiLimit ?? 4;
  for (const f of found) {
    const st = have.get(f.key);
    if (st && st !== "OPEN") continue;
    if (st === "OPEN") { await prisma.entryFlag.update({ where: { key: f.key }, data: { refs: f.refs, title: f.title, detail: f.detail } }); continue; }
    let aiNote: string | null = null;
    if (aiBudget > 0) {
      aiBudget--;
      const seen = f.ai ? await f.ai().catch(() => null) : null;
      const why = await explainFlag(`${FLAG_KIND[f.kind].label}. ${f.title}. ${f.detail}${seen ? ` ${seen}` : ""}`, FLAG_KIND[f.kind].check);
      aiNote = [seen, why.ai ? why.text : null].filter(Boolean).join(" ") || null;
      if (seen && /same photograph/.test(seen)) f.severity = 2;
    }
    await prisma.entryFlag.create({ data: { key: f.key, kind: f.kind, person: f.person, refs: f.refs, href: f.href, title: f.title, detail: f.detail, severity: f.severity, aiNote } });
    created++;
  }
  return { found: found.length, created };
}

/* ------------------------------------------------------------------ */
/* Spot audits                                                         */
/* ------------------------------------------------------------------ */

/** How big the weekly sample is. 10% of finished jobs (3 to 6), 2 guard rounds and 1 paid receipt. */
export const AUDIT_RULES = { woShare: 0.1, woMin: 3, woMax: 6, rounds: 2, receipts: 1, dueDays: 7 };

/** Monday 00:00 Manila of the week containing `d`, and its date key. */
export function weekOf(d: Date) {
  const m = new Date(d.getTime() + 8 * H);
  const back = (m.getUTCDay() + 6) % 7; // days since Monday
  const start = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() - back) - 8 * H);
  return { key: new Date(start.getTime() + 8 * H).toISOString().slice(0, 10), start };
}

function sample<T>(list: T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.max(0, n));
}

/** Draws this week's random sample once. Safe to call often. */
export async function drawSpotAudits(now = nowManila()) {
  const wk = weekOf(now);
  if (await prisma.spotAudit.count({ where: { weekOf: wk.key } })) return { drawn: 0, week: wk.key };
  const since = new Date(now.getTime() - 7 * D);
  const done = await prisma.spotAudit.findMany({ where: { pickedAt: { gte: new Date(now.getTime() - 60 * D) } }, select: { kind: true, refId: true } });
  const seen = new Set(done.map((a) => `${a.kind}:${a.refId}`));
  const [wos, rounds, prs] = await Promise.all([
    prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { gte: since }, donePhoto: { not: null } }, select: { id: true, number: true, title: true, location: true, doneBy: true } }),
    prisma.guardRound.findMany({ where: { submittedAt: { gte: since } }, select: { id: true, startedAt: true, shift: true, guard: { select: { name: true } } } }),
    prisma.purchaseRequest.findMany({ where: { receiptPic: { not: null }, receivedAt: { gte: new Date(now.getTime() - 30 * D) } }, select: { id: true, number: true, title: true, poNumber: true, requester: true } }),
  ]);
  const nWo = Math.min(AUDIT_RULES.woMax, Math.max(AUDIT_RULES.woMin, Math.round(wos.length * AUDIT_RULES.woShare)));
  const dueAt = new Date(wk.start.getTime() + AUDIT_RULES.dueDays * D - MIN);
  const rows = [
    ...sample(wos.filter((w) => !seen.has(`WO:${w.id}`)), nWo).map((w) => ({ kind: "WO", refId: w.id, label: `WO-${w.number} ${w.title} (${w.location})`, href: `/work-orders?wo=${w.number}`, person: w.doneBy ?? "Unknown" })),
    ...sample(rounds.filter((r) => !seen.has(`ROUND:${r.id}`)), AUDIT_RULES.rounds).map((r) => ({ kind: "ROUND", refId: r.id, label: `${r.shift === "NIGHT" ? "Night" : "Day"} round, ${fmtDateTime(r.startedAt)}`, href: "/rounds", person: r.guard.name })),
    ...sample(prs.filter((p) => !seen.has(`RECEIPT:${p.id}`)), AUDIT_RULES.receipts).map((p) => ({ kind: "RECEIPT", refId: p.id, label: `Receipt for ${p.poNumber ?? `PR-${p.number}`} ${p.title}`, href: `/procurement?pr=${p.number}`, person: p.requester })),
  ];
  if (rows.length) await prisma.spotAudit.createMany({ data: rows.map((r) => ({ ...r, weekOf: wk.key, dueAt })), skipDuplicates: true });
  return { drawn: rows.length, week: wk.key };
}

/** What the checker should look at for each kind of entry. */
export const AUDIT_HOW: Record<string, string> = {
  WO: "Go to the location (or call the resident). Is the repair really done and working, and does the after photo match?",
  ROUND: "Check CCTV or the logbook for 2 or 3 stops on the round. Was the guard there when the stop was tapped? Do the meter readings look right?",
  RECEIPT: "Compare the receipt photo with the delivered items and the amount paid. Is it an official receipt from the right vendor?",
};

/** Daily job: draw the week's sample and look for entries worth a second look. */
export async function runIntegrity(now = nowManila()) {
  const audits = await drawSpotAudits(now);
  const flags = await scanEntries(now);
  return { audits, flags };
}
