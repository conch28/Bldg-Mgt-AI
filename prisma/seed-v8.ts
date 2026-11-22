/**
 * Demo data for staff data scores: job notes, a few suspicious entries for the checks to find
 * (a reused photo, near-identical photos, an after photo copied from the resident's photo, copy-pasted
 * notes, jobs marked done all at once, a round entered in minutes), plus four weeks of random spot checks.
 * Most people are on time and honest; the point is to show the tools, not to make anyone look bad.
 */
import type { PrismaClient, User } from "@prisma/client";
import jpeg from "jpeg-js";
import { scanEntries, drawSpotAudits, weekOf } from "../lib/integrity";
import { photoSig } from "../lib/photosig";
import { CHECKPOINTS } from "../lib/rounds";

type Ctx = { prisma: PrismaClient; rnd: () => number; manager: User; admin: User; NOW: Date };
const MIN = 60000, H = 3600000, D = 24 * H;

/** A small drawn JPEG "photo" (wall, fixtures, floor) so the photo fingerprint check has real pixels to compare. */
export function scene(seed: number, opts: { bright?: number; shift?: number; quality?: number } = {}) {
  let st = seed * 2654435761 % 4294967296;
  const r = () => ((st = (st * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const w = 320, h = 240, data = Buffer.alloc(w * h * 4);
  const b = opts.bright ?? 0, sx = opts.shift ?? 0;
  const base = [120 + r() * 120, 110 + r() * 120, 100 + r() * 120], gx = (r() - 0.5) * 0.8, gy = (r() - 0.5) * 0.8;
  const shapes = Array.from({ length: 7 }, () => ({ x: r() * w, y: r() * h, rw: 20 + r() * 110, rh: 20 + r() * 110, c: [r() * 255, r() * 255, r() * 255], round: r() < 0.4 }));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x - sx, i = (y * w + x) * 4;
    let c = [base[0] + X * gx, base[1] + y * gy, base[2] + (X + y) * gx * 0.5];
    for (const s of shapes) {
      const inside = s.round ? ((X - s.x) / (s.rw / 2)) ** 2 + ((y - s.y) / (s.rh / 2)) ** 2 < 1 : X > s.x && X < s.x + s.rw && y > s.y && y < s.y + s.rh;
      if (inside) c = s.c;
    }
    for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, c[k] + b));
    data[i + 3] = 255;
  }
  return "data:image/jpeg;base64," + Buffer.from(jpeg.encode({ data, width: w, height: h }, opts.quality ?? 70).data).toString("base64");
}

const NOTES: Record<string, string[]> = {
  Plumbing: ["Replaced faucet cartridge, no more drip after 10 min test.", "Cleared clog in kitchen drain with auger, water flows normally.", "Changed flexible hose under sink and tightened coupling.", "Replaced fill valve in toilet tank, no more running water."],
  Electrical: ["Replaced tripped 20A breaker, tested outlets in the kitchen.", "Changed busted LED tube and starter in hallway fixture.", "Tightened loose neutral at outlet, no more sparking.", "Replaced faulty light switch in bedroom."],
  Mechanical: ["Cleaned aircon filter and coil, checked freon pressure.", "Replaced exhaust fan capacitor, fan running quiet now.", "Unclogged condensate drain line of the split type aircon."],
  Civil: ["Regrouted 6 bathroom tiles, cured 24h.", "Patched ceiling crack and repainted the area.", "Adjusted door hinge and planed the bottom edge."],
  Housekeeping: ["Deep-cleaned the area and disinfected.", "Applied gel bait in kitchen cabinets and sealed gaps."],
  Elevator: ["Adjusted door sensor and lubricated door track.", "Reset controller fault and test-ran all floors."],
};
const COPIED = "Checked and serviced, all working normally. Tested OK, no issues found.";

export async function seedV8({ prisma, rnd, manager, admin, NOW }: Ctx) {
  console.log("Staff data scores: notes, photos, spot checks, entry flags…");
  const since = new Date(NOW.getTime() - 30 * D);
  const done = await prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { gte: since } }, orderBy: { closedAt: "desc" } });

  // Most finished jobs get a short, specific note.
  for (const w of done) {
    if (rnd() < 0.3) continue;
    const list = NOTES[w.category] ?? [`Fixed: ${w.title.toLowerCase()}. Checked with the resident.`];
    const note = list[Math.floor(rnd() * list.length)];
    await prisma.workOrder.update({ where: { id: w.id }, data: { doneNote: rnd() < 0.5 ? note : `${note.replace(/\.$/, "")} (${w.location}).` } });
  }
  // Fresh JPEG after photos for the people involved in the demo cases, so fingerprints are real.
  const by = (n: string) => done.filter((w) => w.doneBy === n);
  const jun = by("Jun P."), rudy = by("Rudy M."), lift = by("Vendor: LiftCare"), clean = by("CleanPro");
  for (const [i, w] of [...jun.slice(0, 8), ...rudy.slice(0, 10), ...clean.slice(0, 4)].entries()) {
    await prisma.workOrder.update({ where: { id: w.id }, data: { donePhoto: scene(i * 13 + 5) } });
  }
  // 1) Jun P. used the same after photo on two different jobs.
  if (jun.length >= 4) {
    const src = await prisma.workOrder.findUniqueOrThrow({ where: { id: jun[3].id } });
    await prisma.workOrder.update({ where: { id: jun[1].id }, data: { donePhoto: src.donePhoto } });
  }
  // 2) Rudy M.: a near-identical photo (same shot, brightened and nudged) on another job.
  const rudyBase = Math.min(8, jun.length); // rudy[k] got scene((rudyBase + k) * 13 + 5) above
  if (rudy.length >= 7) await prisma.workOrder.update({ where: { id: rudy[6].id }, data: { donePhoto: scene((rudyBase + 5) * 13 + 5, { bright: 14, shift: 3, quality: 62 }) } });
  // 3) CleanPro: the "after" photo is the resident's own problem photo, re-saved.
  if (clean.length >= 3) {
    const before = scene(901);
    await prisma.workOrder.update({ where: { id: clean[2].id }, data: { photo: before, donePhoto: scene(901, { quality: 55 }) } });
  }
  // 4) LiftCare pasted the same note on four jobs.
  const liftMixed = [...new Map(lift.map((w) => [w.category, w])).values()].slice(0, 4); // four different kinds of job
  for (const w of liftMixed) await prisma.workOrder.update({ where: { id: w.id }, data: { doneNote: COPIED } });
  // 5) Rudy M. marked three jobs on different floors done within 9 minutes at the end of the day.
  const end = new Date(NOW.getTime() - 26 * H); // about 12:30 PM the day before
  const trio = rudy.filter((w) => w.createdAt.getTime() < end.getTime() - 6 * H).slice(1, 4);
  for (const [i, w] of trio.entries()) {
    const closedAt = new Date(end.getTime() + [0, 4, 9][i] * MIN);
    await prisma.workOrder.update({ where: { id: w.id }, data: { closedAt, ...(w.verifiedAt ? { verifiedAt: new Date(closedAt.getTime() + 3 * H) } : {}) } });
  }
  // 6) Jessa's last night round was tapped through in 6 minutes, just before the 6 AM changeover.
  const jessa = await prisma.user.findFirst({ where: { role: "GUARD", name: { startsWith: "Jessa" } } });
  if (jessa) {
    const last = await prisma.guardRound.findFirst({ where: { guardId: jessa.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" } });
    if (last) {
      const m = new Date(last.startedAt.getTime() + 8 * H);
      const sixAm = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + (m.getUTCHours() >= 6 ? 1 : 0), 6) - 8 * H);
      await prisma.guardRound.update({ where: { id: last.id }, data: { startedAt: new Date(sixAm.getTime() - 13 * MIN), submittedAt: new Date(sixAm.getTime() - 7 * MIN) } });
      await prisma.meterReading.updateMany({ where: { roundId: last.id }, data: { takenAt: new Date(sixAm.getTime() - 8 * MIN) } });
    }
  }
  // Link each round's meter readings to it, and complete most rounds (two keep a skipped stop).
  const allRounds = await prisma.guardRound.findMany({ include: { guard: true }, orderBy: { startedAt: "desc" } });
  let skipped = 0;
  for (const r of allRounds) {
    await prisma.meterReading.updateMany({ where: { roundId: null, takenBy: r.guard.name, takenAt: { gte: r.startedAt, lte: new Date(r.startedAt.getTime() + 12 * H) } }, data: { roundId: r.id } });
    if (r.checked.length < CHECKPOINTS.length && skipped++ >= 2) await prisma.guardRound.update({ where: { id: r.id }, data: { checked: CHECKPOINTS.map((c) => c.key) } });
  }
  // Fingerprints for everything we just changed.
  for (const w of await prisma.workOrder.findMany({ where: { closedAt: { gte: since } }, select: { id: true, photo: true, donePhoto: true } })) {
    await prisma.workOrder.update({ where: { id: w.id }, data: { photoSig: w.photo ? photoSig(w.photo) ?? "none:" : null, donePhotoSig: w.donePhoto ? photoSig(w.donePhoto) ?? "none:" : null } });
  }

  // Four weeks of spot checks: three past weeks done (one problem found), this week drawn and partly done.
  const wk = weekOf(NOW);
  const rounds = await prisma.guardRound.findMany({ where: { submittedAt: { not: null } }, include: { guard: true }, orderBy: { startedAt: "desc" } });
  const prs = await prisma.purchaseRequest.findMany({ where: { receiptPic: { not: null } }, orderBy: { receivedAt: "desc" } });
  const all = await prisma.workOrder.findMany({ where: { status: "DONE", closedAt: { not: null }, donePhoto: { not: null } }, orderBy: { closedAt: "desc" } });
  for (let k = 3; k >= 1; k--) {
    const start = new Date(wk.start.getTime() - k * 7 * D), key = weekOf(start).key;
    const pool = all.filter((w) => w.closedAt! < start && w.closedAt! >= new Date(start.getTime() - 7 * D));
    const picks = [...pool].sort(() => rnd() - 0.5).slice(0, 4);
    const rs = rounds.filter((r) => r.startedAt < start && r.startedAt >= new Date(start.getTime() - 7 * D)).slice(0, 2);
    const checked = (i: number) => new Date(start.getTime() + (2 + i) * D + (10 + i) * H);
    const rows = [
      ...picks.map((w, i) => ({ kind: "WO", refId: w.id, label: `WO-${w.number} ${w.title} (${w.location})`, href: `/work-orders?wo=${w.number}`, person: w.doneBy ?? "Unknown", i })),
      ...rs.map((r, i) => ({ kind: "ROUND", refId: r.id, label: `${r.shift === "NIGHT" ? "Night" : "Day"} round, ${r.startedAt.toLocaleString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`, href: "/rounds", person: r.guard.name, i: i + 4 })),
      ...(prs[k] ? [{ kind: "RECEIPT", refId: prs[k].id, label: `Receipt for ${prs[k].poNumber ?? `PR-${prs[k].number}`} ${prs[k].title}`, href: `/procurement?pr=${prs[k].number}`, person: prs[k].requester, i: 6 }] : []),
    ];
    for (const r of rows) {
      const issue = k === 2 && r.kind === "WO" && r.i === 0;
      await prisma.spotAudit.create({ data: { kind: r.kind, refId: r.refId, label: r.label, href: r.href, person: r.person, weekOf: key, pickedAt: start, dueAt: new Date(start.getTime() + 7 * D - MIN),
        checkedAt: checked(r.i % 4), checkedBy: r.person === manager.name ? admin.name : manager.name, // no one checks their own entry result: issue ? "ISSUE" : "PASS",
        note: issue ? "Still dripping slightly when I visited. After photo was taken before the water was turned back on. Sent back; fixed the next day." : r.kind === "ROUND" ? (rnd() < 0.5 ? "CCTV shows the guard at the pump room and roof deck at the logged times." : "Logbook and meter readings match.") : r.kind === "RECEIPT" ? "Official receipt matches the delivery and the amount paid." : rnd() < 0.5 ? "Visited, working fine. Resident happy." : "Called the resident, confirmed fixed." } });
      if (r.kind === "WO") await prisma.wOEvent.create({ data: { workOrderId: r.refId, author: manager.name, note: issue ? "Spot check found a problem: still dripping slightly." : "Spot check passed.", createdAt: checked(r.i % 4) } });
    }
  }
  await drawSpotAudits(NOW);
  const cur = await prisma.spotAudit.findMany({ where: { weekOf: wk.key }, orderBy: { kind: "asc" } });
  for (const [i, a] of cur.filter((a) => a.person !== manager.name).slice(0, 2).entries()) {
    await prisma.spotAudit.update({ where: { id: a.id }, data: { checkedAt: new Date(NOW.getTime() - (20 - i * 6) * H), checkedBy: manager.name, result: "PASS", note: i === 0 ? "Visited the unit, repair holding up. Resident confirmed." : "Matches CCTV and the logbook." } });
  }

  // Run the checks as the daily job would, then show what review looks like.
  await scanEntries(NOW, { aiLimit: 0 });
  const flags = await prisma.entryFlag.findMany();
  const f = (kind: string) => flags.find((x) => x.kind === kind);
  const same = f("SAME_PHOTO");
  if (same) await prisma.entryFlag.update({ where: { id: same.id }, data: { status: "CONFIRMED", reviewedBy: manager.name, reviewedAt: new Date(NOW.getTime() - 5 * H), explanation: "Phone battery died so I used the photo from the earlier job. Sorry po.", reviewNote: "Talked to Jun. Fresh photo every job, even if it's the same kind of fix. Went back and took the real photo." } });
  const batched = f("BATCHED");
  if (batched) await prisma.entryFlag.update({ where: { id: batched.id }, data: { explanation: "No signal on the upper floors so I tapped Done when I got back to the admin office." } });
  // An older flag the manager looked at and cleared: the same fixture repaired twice.
  const pair = done.flatMap((a, i) => done.slice(i + 1).filter((b) => b.location === a.location && b.doneBy === a.doneBy).map((b) => [a, b] as const))[0];
  if (pair) {
    const [a, b] = pair;
    await prisma.entryFlag.create({ data: { key: `demo-cleared:${a.number}:${b.number}`, kind: "SIMILAR_PHOTO", person: a.doneBy ?? "Unknown", refs: [`WO-${b.number}`, `WO-${a.number}`], href: `/work-orders?wo=${a.number}`, severity: 1, status: "CLEARED",
      title: `Nearly identical after photos on WO-${b.number} and WO-${a.number}`, detail: `Both at ${a.location}.`, reviewedBy: manager.name, reviewedAt: new Date(NOW.getTime() - 3 * D),
      reviewNote: "Same fixture failed twice, so the photos look alike. Fine. Asked the vendor to check the cause.", createdAt: new Date(NOW.getTime() - 4 * D) } });
  }
}
