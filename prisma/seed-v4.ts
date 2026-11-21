/* Sample data for guard rounds, meter readings (with a hidden leak in the last 4 nights), the asset register,
 * storeroom stock, replacements and purchase requests. The data deliberately contains the patterns the
 * controls should catch: a split purchase, a price above benchmark, a light replaced too often, a part paid for
 * while under warranty, old parts not returned, stock out with no job, a count shortage and an invoice above PO. */
import type { PrismaClient, User } from "@prisma/client";

type Ctx = { prisma: PrismaClient; rnd: () => number; hash: string; buildingId: string; manager: User; NOW: Date };
const DAY = 86400000, HOUR = 3600000;

export async function seedV4({ prisma, rnd, hash, buildingId, manager, NOW }: Ctx) {
  const ago = (d: number) => new Date(NOW.getTime() - d * DAY);
  const at = (daysAgo: number, hour: number, min = 0) => {
    const ymd = new Date(NOW.getTime() - daysAgo * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    return new Date(`${ymd}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+08:00`);
  };
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const treasurer = await prisma.user.findFirstOrThrow({ where: { email: "treasurer@skyland.test" } });
  const dayGuard = await prisma.user.findFirstOrThrow({ where: { role: "GUARD" } });
  const nightGuard = await prisma.user.create({ data: { email: "guard2@skyland.test", name: "Jessa Ramos (Night guard)", role: "GUARD", passwordHash: hash, buildingId } });

  console.log("Creating guard rounds and meter readings…");
  const ALL = ["lobby-a", "lobby-b", "gate", "parking-b1", "parking-b2", "pump-room", "genset", "elevators", "hallways", "pool", "amenity", "garbage", "roof"];
  const rounds: { id: string; d: number; shift: string }[] = [];
  for (let d = 6; d >= 0; d--) {
    for (const shift of ["NIGHT", "DAY"] as const) {
      const g = shift === "DAY" ? dayGuard : nightGuard;
      const start = shift === "DAY" ? at(d, 9, 5) : at(d, 1, 40);
      const skip = rnd() < 0.3 ? 1 : 0;
      const r = await prisma.guardRound.create({ data: { guardId: g.id, shift, startedAt: start, submittedAt: new Date(start.getTime() + (38 + rnd() * 20) * 60000), checked: ALL.slice(0, ALL.length - skip), notes: d === 1 && shift === "NIGHT" ? "Delivery van parked in the fire lane at 1 AM. Driver moved it." : d === 0 && shift === "NIGHT" ? "Hissing sound in the pump room, could be a leak. Logged it." : null } });
      rounds.push({ id: r.id, d, shift });
    }
  }
  const roundOf = (d: number, shift: string) => rounds.find((r) => r.d === d && r.shift === shift)!.id;
  const ISSUES = [
    { d: 0, shift: "NIGHT", loc: "Pump room", title: "Water leak", cat: "Plumbing", pri: "HIGH", status: "NEW", note: "Hissing near booster pump 2, floor wet", hours: 2 },
    { d: 0, shift: "DAY", loc: "Parking B1", title: "Light out", cat: "Electrical", pri: "LOW", status: "NEW", note: "3 tubes out near the ramp, slots B1-20 to B1-26", hours: 5 },
    { d: 1, shift: "DAY", loc: "5th-floor gym and function rooms", title: "Aircon not working", cat: "Mechanical", pri: "MEDIUM", status: "ASSIGNED", who: "CoolCare PH", note: "Gym aircon blowing warm air", hours: 27 },
    { d: 2, shift: "NIGHT", loc: "Tower A 18th floor hallway", title: "Fire safety item missing or broken", cat: "Security", pri: "HIGH", status: "IN_PROGRESS", who: "Jun P.", note: "Fire extinguisher tag expired last month", hours: 60 },
    { d: 2, shift: "DAY", loc: "Pool deck", title: "Light out", cat: "Electrical", pri: "LOW", status: "DONE", who: "Jun P.", note: "Underwater light 3 out", hours: 54, fixedAfter: 20 },
    { d: 3, shift: "NIGHT", loc: "Tower B 12th floor hallway", title: "Light out", cat: "Electrical", pri: "LOW", status: "DONE", who: "Rodel T.", note: "Downlight beside the lift out again", hours: 83, fixedAfter: 6 },
    { d: 3, shift: "DAY", loc: "Garbage room", title: "Pests seen", cat: "Housekeeping", pri: "LOW", status: "DONE", who: "GreenShield", note: "Rats near the bins", hours: 77, fixedAfter: 30 },
    { d: 4, shift: "NIGHT", loc: "Roof deck", title: "Door or lock problem", cat: "Security", pri: "MEDIUM", status: "DONE", who: "Rudy M.", note: "Roof door doesn't latch", hours: 107, fixedAfter: 9 },
    { d: 5, shift: "DAY", loc: "Garbage room", title: "Needs cleaning", cat: "Housekeeping", pri: "LOW", status: "DONE", who: "CleanPro", note: "Overflowing bins after collection was missed", hours: 125, fixedAfter: 4 },
    { d: 5, shift: "NIGHT", loc: "Main gate and driveway", title: "Light out", cat: "Electrical", pri: "LOW", status: "DONE", who: "Jun P.", note: "Driveway post light", hours: 130, fixedAfter: 22 },
    { d: 6, shift: "DAY", loc: "Tower B lobby", title: "Safety hazard", cat: "Civil", pri: "MEDIUM", status: "DONE", who: "Rudy M.", note: "Loose floor tile at the entrance", hours: 149, fixedAfter: 11 },
  ] as const;
  for (const i of ISSUES) {
    const created = new Date(NOW.getTime() - i.hours * HOUR);
    const sla = i.pri === "HIGH" ? 4 : i.pri === "MEDIUM" ? 24 : 72;
    const g = i.shift === "DAY" ? dayGuard : nightGuard;
    await prisma.workOrder.create({ data: {
      location: i.loc, title: i.title, description: i.note, category: i.cat, priority: i.pri, status: i.status, slaHours: sla, assignee: "who" in i ? i.who : null,
      source: "Guard round", reporterId: g.id, roundId: roundOf(i.d, i.shift), createdAt: created,
      closedAt: "fixedAfter" in i ? new Date(created.getTime() + i.fixedAfter * HOUR) : null, rating: null,
      events: { create: [{ note: `Logged by ${g.name} at ${i.loc.includes("hallway") ? "Hallways and fire exits" : i.loc} on the ${i.shift.toLowerCase()} round. Priority ${i.pri.toLowerCase()}, ${sla}h deadline.`, author: g.name, createdAt: created }] },
    } });
  }

  // Water main: ~130 m³ a day. Night flow ~0.9 m³/h, rising to ~2.2 m³/h in the last 4 nights (the pump-room leak).
  const readings: any[] = [];
  let water = 482_310, elec = 1_204_880;
  for (let d = 30; d >= 0; d--) {
    const leak = d <= 3 ? 0.6 : 0;
    const night = 0.8 + rnd() * 0.25 + leak;
    // 04:00 reading closes the night that started 23:00 the day before
    if (d < 30) { water += night * 5; readings.push({ meter: "WATER_MAIN", value: Math.round(water * 10) / 10, takenAt: at(d, 4, 10 + Math.floor(rnd() * 20)), takenBy: nightGuard.name }); }
    water += 26 + rnd() * 6 + leak * 5; readings.push({ meter: "WATER_MAIN", value: Math.round(water * 10) / 10, takenAt: at(d, 9, 15), takenBy: dayGuard.name });
    elec += 300 + rnd() * 40; readings.push({ meter: "ELECTRIC_MAIN", value: Math.round(elec), takenAt: at(d, 9, 16), takenBy: dayGuard.name });
    if (d === 0) break; // today's late reading hasn't happened yet
    water += 92 + rnd() * 14 + leak * 14; readings.push({ meter: "WATER_MAIN", value: Math.round(water * 10) / 10, takenAt: at(d, 23, 5), takenBy: nightGuard.name });
    elec += 420 + rnd() * 50;
    if (d % 2 === 0) readings.push({ meter: "GENSET_FUEL", value: Math.round(92 - (30 - d) * 0.8), takenAt: at(d, 9, 18), takenBy: dayGuard.name });
    if (d % 2 === 0) readings.push({ meter: "CISTERN", value: Math.round(78 + rnd() * 15), takenAt: at(d, 9, 19), takenBy: dayGuard.name });
  }
  await prisma.meterReading.createMany({ data: readings });

  console.log("Creating the asset register, stock and replacements…");
  const mkItem = (sku: string, name: string, category: string, onHand: number, rp: number, rq: number, bench: number, last: number | null, uom = "pc") =>
    prisma.stockItem.create({ data: { sku, name, category, onHand, reorderPoint: rp, reorderQty: rq, benchmark: bench, lastPrice: last, uom } });
  const it = {
    tube: await mkItem("EL-LT8-18", "LED tube T8 18W", "Lighting", 14, 20, 50, 180, 180),
    bulb: await mkItem("EL-LB-9", "LED bulb 9W", "Lighting", 46, 20, 60, 85, 82),
    down: await mkItem("EL-DL-12", "LED downlight 12W", "Lighting", 6, 8, 20, 320, 395),
    ballast: await mkItem("EL-BAL-36", "Fluorescent ballast 36W", "Lighting", 9, 4, 10, 250, 240),
    breaker: await mkItem("EL-BRK-20", "Circuit breaker 20A", "Electrical", 7, 4, 10, 450, 445),
    exitbat: await mkItem("SF-EXB-6V", "Exit sign battery 6V", "Safety", 3, 6, 24, 275, 275),
    filter: await mkItem("AC-FLT-24", "Aircon filter 24in", "Aircon", 12, 6, 12, 350, 340),
    seal: await mkItem("PM-SEAL-B2", "Pump mechanical seal", "Pump", 1, 1, 2, 6500, 6400),
    fill: await mkItem("PL-FV-01", "Toilet fill valve", "Plumbing", 10, 5, 12, 480, 470),
    faucet: await mkItem("PL-FCT-01", "Lavatory faucet", "Plumbing", 4, 3, 6, 650, 640),
    tape: await mkItem("PL-TFL-01", "Teflon tape", "Plumbing", 40, 15, 50, 25, 24, "roll"),
    ext: await mkItem("SF-EXT-RF", "Fire extinguisher refill (10 lb)", "Safety", 0, 4, 20, 880, 880),
  };

  const A = (tag: string, name: string, category: string, location: string, installedDaysAgo: number, lifeMonths: number, cost: number, vendor: string | null, warrantyDays?: number) =>
    prisma.asset.create({ data: { tag, name, category, location, installedAt: ago(installedDaysAgo), lifeMonths, cost, vendor, warrantyUntil: warrantyDays != null ? new Date(ago(installedDaysAgo).getTime() + warrantyDays * DAY) : null } });
  const assets: Record<string, Awaited<ReturnType<typeof A>>> = {};
  // old fluorescent lights still in parking and stairs: the LED retrofit idea counts these
  for (let i = 1; i <= 8; i++) assets[`fb1-${i}`] = await A(`LT-B1-${String(i).padStart(2, "0")}`, "Fluorescent T8 twin fixture", "Lighting", "Parking B1", 2900, 36, 950, "Lumina Electrical");
  for (let i = 1; i <= 6; i++) assets[`fb2-${i}`] = await A(`LT-B2-${String(i).padStart(2, "0")}`, "Fluorescent T8 twin fixture", "Lighting", "Parking B2", 2900, 36, 950, "Lumina Electrical");
  for (const t of ["A", "B"]) for (const f of [3, 9, 15, 21]) assets[`stair-${t}${f}`] = await A(`LT-${t}${f}-STR`, "Fluorescent stair light", "Lighting", `Tower ${t} stairwell ${f}F`, 2600, 36, 650, null);
  assets.hallB12 = await A("LT-B12-HALL-2", "Hallway LED downlight", "Lighting", "Tower B 12th floor hallway", 40, 36, 395, "BrightLite Trading", 365);
  assets.hallA18 = await A("LT-A18-HALL-1", "Hallway LED downlight", "Lighting", "Tower A 18th floor hallway", 420, 36, 320, "Lumina Electrical", 365);
  assets.pool3 = await A("LT-POOL-3", "Underwater pool light", "Lighting", "Pool deck", 2, 48, 4800, "AquaLux", 730);
  assets.drive = await A("LT-GATE-2", "Driveway post light", "Lighting", "Main gate and driveway", 5, 36, 1800, "Lumina Electrical", 365);
  assets.gymAc = await A("AC-GYM-1", "Split aircon 2.5HP", "Aircon", "5th-floor gym and function rooms", 700, 120, 46000, "CoolCare PH", 1095);
  assets.lobbyAc = await A("AC-LOBA-1", "Ceiling cassette aircon 3HP", "Aircon", "Tower A lobby", 1500, 120, 62000, "CoolCare PH", 730);
  assets.pump1 = await A("PM-BOOST-1", "Booster pump 1", "Pump", "Pump room", 1800, 120, 185000, "AquaTech Pumps", 730);
  assets.pump2 = await A("PM-BOOST-2", "Booster pump 2", "Pump", "Pump room", 300, 120, 185000, "AquaTech Pumps", 730);
  assets.sump = await A("PM-SUMP-B2", "Sump pump", "Pump", "Parking B2", 900, 84, 42000, "AquaTech Pumps", 730);
  assets.float = await A("PL-ROOF-FV", "Roof tank float valve", "Plumbing", "Roof deck", 2100, 60, 3800, null);
  assets.reader = await A("EL-ACC-LOBA", "Access card reader", "Electrical", "Tower A lobby", 1200, 72, 18500, "AccessPro", 365);
  assets.lift3 = await A("EV-3-DOOR", "Elevator 3 door sensor", "Elevator", "Elevator 3 (Tower B)", 60, 60, 38500, "LiftCare", 365);
  assets.extA18 = await A("SF-EXT-A18", "Fire extinguisher 10 lb", "Safety", "Tower A 18th floor hallway", 400, 12, 2400, "FireSafe PH");
  assets.exitB = await A("SF-EXIT-B1", "Exit sign, B1 stairs", "Safety", "Parking B1", 1100, 60, 1500, null);
  assets.genBat = await A("EL-GEN-BAT", "Genset starter battery", "Electrical", "Genset room", 160, 24, 12500, "PowerMax", 730);

  type R = { a: string; item?: keyof typeof it; d: number; by: string; cost: number; warranty?: boolean; months?: number; ret?: boolean; wo?: number; note?: string };
  const REPS: R[] = [
    // the hallway light that keeps "failing": 4 times in 12 months, mostly by the same person, two without the old part
    { a: "hallB12", item: "down", d: 330, by: "Rodel T.", cost: 395, months: 12, ret: true, note: "Downlight dead" },
    { a: "hallB12", item: "down", d: 205, by: "Rodel T.", cost: 395, months: 12, ret: false, note: "Downlight dead again" },
    { a: "hallB12", item: "down", d: 98, by: "Rodel T.", cost: 395, months: 12, ret: false, note: "Replaced" },
    { a: "hallB12", item: "down", d: 40, by: "Rodel T.", cost: 395, months: 12, ret: true, note: "Replaced after guard report" },
    // booster pump 2: seal paid for while the pump was still under its 2-year warranty
    { a: "pump2", item: "seal", d: 75, by: "AquaTech Pumps", cost: 8500, months: 6, ret: true, note: "Mechanical seal leaking" },
    // warranty claims done right
    { a: "gymAc", d: 120, by: "CoolCare PH", cost: 0, warranty: true, ret: true, note: "Compressor replaced free under warranty" },
    { a: "sump", item: "seal", d: 210, by: "AquaTech Pumps", cost: 0, warranty: true, ret: true, note: "Seal replaced under warranty" },
    { a: "reader", d: 160, by: "AccessPro", cost: 0, warranty: true, ret: true, note: "Board swapped under service warranty" },
    { a: "lift3", d: 60, by: "LiftCare", cost: 38500, months: 12, ret: true, wo: 0, note: "Door sensor replaced after repeat faults" },
    { a: "pool3", d: 2, by: "Jun P.", cost: 4800, months: 24, ret: true, note: "Underwater light replaced" },
    { a: "drive", d: 5, by: "Jun P.", cost: 1800, months: 12, ret: true, note: "LED post light" },
    { a: "hallA18", item: "down", d: 420, by: "Jun P.", cost: 320, months: 12, ret: true },
    { a: "genBat", d: 160, by: "PowerMax", cost: 12500, months: 24, ret: true, note: "New starter battery" },
    { a: "fb1-3", item: "tube", d: 45, by: "Rodel T.", cost: 360, ret: false, note: "2 tubes" },
    { a: "fb2-2", item: "ballast", d: 30, by: "Jun P.", cost: 240, ret: true },
    { a: "stair-B15", item: "tube", d: 18, by: "Jun P.", cost: 180, ret: true },
    { a: "float", item: "fill", d: 300, by: "Rudy M.", cost: 470, ret: true },
    { a: "extA18", item: "ext", d: 400, by: "FireSafe PH", cost: 880, months: 12, ret: true, note: "Annual refill" },
  ];
  for (const r of REPS) {
    const asset = assets[r.a];
    await prisma.replacement.create({ data: {
      assetId: asset.id, itemId: r.item ? it[r.item].id : null, doneAt: ago(r.d), doneBy: r.by, loggedBy: manager.name, cost: r.cost, warrantyClaim: !!r.warranty,
      newWarrantyTil: r.months ? new Date(ago(r.d).getTime() + r.months * 30.4 * DAY) : null, oldPartReturned: !!r.ret, note: r.note ?? null, workOrder: null,
    } });
    if (r.item) await prisma.stockMove.create({ data: { itemId: it[r.item].id, qty: -1, kind: "ISSUE", ref: asset.tag, byName: r.by, createdAt: ago(r.d), note: `Replacement at ${asset.location}` } });
  }
  // stock out with no job named, and a count that came up short
  await prisma.stockMove.createMany({ data: [
    { itemId: it.bulb.id, qty: -12, kind: "ISSUE", ref: null, byName: "Rodel T.", note: null, createdAt: ago(16) },
    { itemId: it.tube.id, qty: -6, kind: "ISSUE", ref: null, byName: "Rodel T.", note: "for stock room", createdAt: ago(9) },
    { itemId: it.tube.id, qty: -6, kind: "ADJUST", ref: "Count", byName: manager.name, note: "Counted 14, system had 20", createdAt: ago(3) },
    { itemId: it.ext.id, qty: -1, kind: "ISSUE", ref: "SF-EXT-A18", byName: "Jun P.", note: "Swap for expired unit", createdAt: ago(2) },
  ] });

  console.log("Creating purchase requests and quotes…");
  const mgrApproval = (d: number) => ({ id: admin.id, name: admin.name, role: "ADMIN", at: ago(d).toISOString() });
  const boardApproval = (u: User, d: number) => ({ id: u.id, name: u.name, role: "BOARD", at: ago(d).toISOString() });
  type Q = [string, number];
  const PR = async (o: { title: string; cat: string; item?: keyof typeof it; qty: number; reason: string; d: number; status: string; quotes: Q[]; chosen?: number; note?: string; approvals?: any[]; po?: boolean; recv?: { by: string; qty?: number; inv?: number; d: number; note?: string }; requester?: User | string; reject?: string }) => {
    const req = typeof o.requester === "string" ? { id: "legacy", name: o.requester } : o.requester ?? manager;
    const pr = await prisma.purchaseRequest.create({ data: {
      title: o.title, category: o.cat, itemId: o.item ? it[o.item].id : null, qty: o.qty, reason: o.reason, status: o.status, requestedBy: req.id, requester: req.name,
      approvals: o.approvals ?? [], chooseNote: o.note ?? null, createdAt: ago(o.d), rejectNote: o.reject ?? null,
      quotes: { create: o.quotes.map(([vendor, total], i) => ({ vendor, total, addedBy: req.name, createdAt: new Date(ago(o.d).getTime() + i * HOUR) })) },
    }, include: { quotes: true } });
    const sorted = [...pr.quotes].sort((a, b) => Number(a.total) - Number(b.total));
    const chosen = o.chosen != null ? pr.quotes.find((q) => q.vendor === o.quotes[o.chosen!][0]) : sorted[0];
    const orderedAt = o.po ? new Date(ago(o.d).getTime() + 2 * DAY) : null;
    await prisma.purchaseRequest.update({ where: { id: pr.id }, data: {
      chosenQuote: chosen?.id, poNumber: o.po ? `PO-${ago(o.d).getFullYear()}-${String(pr.number).padStart(4, "0")}` : null, orderedAt,
      ...(o.recv ? { receivedAt: ago(o.recv.d), receivedBy: o.recv.by, receivedQty: o.recv.qty ?? o.qty, invoiceTotal: o.recv.inv ?? Number(chosen?.total ?? 0), receivedNote: o.recv.note ?? null } : {}),
    } });
    if (o.recv && o.item) await prisma.stockMove.create({ data: { itemId: it[o.item].id, qty: o.recv.qty ?? o.qty, kind: "RECEIVE", ref: `PO-${pr.number}`, byName: o.recv.by, createdAt: ago(o.recv.d) } });
    return pr;
  };

  await PR({ title: "LED tubes for parking B1 and B2", cat: "Lighting", item: "tube", qty: 50, reason: "Stock below reorder point; parking lights failing.", d: 70, status: "RECEIVED", quotes: [["Lumina Electrical", 9000], ["BrightLite Trading", 10750], ["Meralco Industrial Supply", 11500]], approvals: [mgrApproval(69)], po: true, recv: { by: dayGuard.name, d: 64 } });
  await PR({ title: "Elevator 3 door sensor", cat: "Elevator", qty: 1, reason: "Door kept re-opening; 2 breakdowns in 30 days.", d: 66, status: "RECEIVED", quotes: [["LiftCare", 38500], ["Elevate PH", 44000], ["Vertical Systems", 47500]], approvals: [mgrApproval(65), boardApproval(treasurer, 64)], po: true, recv: { by: dayGuard.name, d: 61 } });
  await PR({ title: "Fire extinguisher refills (20 units)", cat: "Safety", item: "ext", qty: 20, reason: "Annual refill for BFP inspection.", d: 50, status: "RECEIVED", quotes: [["FireSafe PH", 17600], ["Red Shield Fire", 19500], ["Blaze Guard", 21000]], approvals: [mgrApproval(49), boardApproval(treasurer, 48)], po: true, recv: { by: dayGuard.name, d: 44, inv: 18900, note: "Invoice includes delivery fee" } });
  // split purchase: three lighting orders just under ₱10,000 within 10 days, same vendor, one quote each
  await PR({ title: "LED downlights, Tower B hallways", cat: "Lighting", item: "down", qty: 24, reason: "Hallway downlights failing.", d: 34, status: "RECEIVED", quotes: [["BrightLite Trading", 9480]], approvals: [mgrApproval(34)], po: true, recv: { by: dayGuard.name, d: 31 } });
  await PR({ title: "LED downlights, Tower A hallways", cat: "Lighting", item: "down", qty: 24, reason: "More hallway downlights.", d: 29, status: "RECEIVED", quotes: [["BrightLite Trading", 9600]], approvals: [mgrApproval(29)], po: true, recv: { by: dayGuard.name, d: 26 } });
  await PR({ title: "LED bulbs and downlights, stairwells", cat: "Lighting", item: "bulb", qty: 60, reason: "Stairwell lights.", d: 25, status: "ORDERED", quotes: [["BrightLite Trading", 9750]], approvals: [mgrApproval(25)], po: true });
  // price above benchmark, waiting for a board signature
  await PR({ title: "Mechanical seals for booster pumps (2)", cat: "Pump", item: "seal", qty: 2, reason: "Booster pump 2 leaking in the pump room (WO from guard round). Keep a spare.", d: 1, status: "PENDING", quotes: [["AquaTech Pumps", 19800], ["PumpPro Services", 14200], ["Hydro Parts Manila", 15600]], chosen: 0, note: "Original supplier of the pumps; can install tomorrow.", approvals: [mgrApproval(1)] });
  await PR({ title: "Roof water tank cleaning and repainting", cat: "Plumbing", qty: 1, reason: "Twice-yearly tank cleaning (Code on Sanitation) and rust treatment.", d: 3, status: "PENDING", quotes: [["AquaClean Services", 68000], ["TankCare PH", 74500], ["Pure Reservoir Co.", 79000]], approvals: [boardApproval(treasurer, 2)] });
  await PR({ title: "Aircon filters, amenity floor", cat: "Aircon", item: "filter", qty: 12, reason: "Quarterly change.", d: 4, status: "APPROVED", quotes: [["CoolCare PH", 4080]], approvals: [mgrApproval(3)] });
  await PR({ title: "CCTV recorder hard drive 4TB", cat: "Electrical", qty: 1, reason: "Recorder drive full; footage only kept 9 days.", d: 6, status: "ORDERED", quotes: [["SecureCam Trading", 7800]], approvals: [mgrApproval(6)], po: true });
  await PR({ title: "Exit sign batteries", cat: "Safety", item: "exitbat", qty: 24, reason: "Exit signs failing the monthly test.", d: 5, status: "ORDERED", quotes: [["FireSafe PH", 6600]], approvals: [mgrApproval(5)], po: true });
  await PR({ title: "Genset starter battery", cat: "Electrical", qty: 1, reason: "Battery weak on the monthly test.", d: 12, status: "REJECTED", quotes: [["PowerMax", 12500], ["Motolite Express", 11900], ["Amaron PH", 13200]], reject: "The battery was replaced in June with a 2-year warranty. Claim it from PowerMax instead. (Board Treasurer)" });
  await PR({ title: "Hallway touch-up paint", cat: "Civil", qty: 12, reason: "Imported from the old paper system.", d: 150, status: "RECEIVED", quotes: [["Boysen Depot Makati", 8400]], requester: "Rodel T.", po: true, recv: { by: "Rodel T.", d: 146 } });
}
