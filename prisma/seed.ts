/*
 * Seeds a realistic 400-unit tower ("Skyland Tower") with 12 months of billing,
 * payments, budgets, work orders and services, plus one login per role.
 * Safe to re-run: it wipes and recreates all data. Refuses to run when
 * NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1 is set.
 */
import { PrismaClient, Priority, WOStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedV2 } from "./seed-v2";
import { seedV3 } from "./seed-v3";

const prisma = new PrismaClient();

// deterministic PRNG so every seed produces the same building
let s = 20261121;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const SURNAMES = ["Dela Cruz","Santos","Reyes","Garcia","Mendoza","Villanueva","Tan","Lim","Bautista","Aquino","Ramos","Cruz","Navarro","Torres","Castillo","Flores","Gonzales","Lopez","Morales","Rivera","Sy","Go","Chua","Uy","Domingo","Pascual","Salazar","Valdez","Yap","Ocampo"];
const INITIALS = "ABCDEFGHJKLMNPRSTV".split("");
const LETTER_SQM: Record<string, number> = { A: 62, B: 45, C: 38, D: 45, E: 28, F: 52, G: 38, H: 45, J: 28, K: 85 };
const LETTERS = Object.keys(LETTER_SQM);
const DUES_RATE = 98;

// 12 billing months Dec 2025 .. Nov 2026, with on-time payment probability rising after reminders launched (May)
const MONTHS = ["2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11"];
const ONTIME = [0.83,0.825,0.84,0.835,0.85,0.865,0.88,0.89,0.9,0.905,0.915,0.63]; // Nov is still open (due 30 Nov)
const NOW = new Date(process.env.SEED_NOW ?? "2026-11-21T14:30:00+08:00");

function dueDate(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 15, 59)); // last day of month, 11:59 PM Manila
}
function dayIn(period: string, day: number) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 2 + Math.floor(rnd() * 10), Math.floor(rnd() * 60)));
}
const METHODS = ["GCash","GCash","GCash","Maya","Bank transfer","Card","Cash"];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
    throw new Error("Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=1 to override.");
  }
  // Demo deploys re-seed only when the sample data is missing or from an older version of the app.
  const SEED_VERSION = "skyland-demo-v4";
  if (process.env.SEED_IF_EMPTY === "1" && (await prisma.building.count()) > 0) {
    const current = await prisma.auditLog.findFirst({ where: { action: "seed", detail: { contains: SEED_VERSION } } });
    if (current) { console.log("Demo data is up to date. Skipping the seed."); return; }
    console.log("Demo data is from an older version. Re-seeding…");
  }
  console.log("Clearing data…");
  await prisma.$transaction([
    prisma.inquiry.deleteMany(), prisma.listing.deleteMany(), prisma.marketComp.deleteMany(), prisma.lease.deleteMany(), prisma.moveRequest.deleteMany(),
    prisma.utilityReading.deleteMany(), prisma.registration.deleteMany(), prisma.marketItem.deleteMany(), prisma.lostFound.deleteMany(), prisma.sosAlert.deleteMany(),
    prisma.pulse.deleteMany(), prisma.delivery.deleteMany(), prisma.announcement.deleteMany(), prisma.amenityBooking.deleteMany(), prisma.amenity.deleteMany(),
    prisma.pass.deleteMany(), prisma.document.deleteMany(), prisma.vote.deleteMany(), prisma.pollOption.deleteMany(), prisma.poll.deleteMany(),
    prisma.vendor.deleteMany(), prisma.pMTask.deleteMany(),
    prisma.auditLog.deleteMany(), prisma.chatMessage.deleteMany(), prisma.booking.deleteMany(),
    prisma.service.deleteMany(), prisma.report.deleteMany(), prisma.budgetLine.deleteMany(),
    prisma.reminder.deleteMany(), prisma.payment.deleteMany(), prisma.bill.deleteMany(),
    prisma.wOEvent.deleteMany(), prisma.workOrder.deleteMany(), prisma.unit.deleteMany(),
    prisma.user.deleteMany(), prisma.building.deleteMany(),
  ]);

  const building = await prisma.building.create({ data: { name: "Skyland Tower", city: "Metro Manila", duesRate: DUES_RATE } });

  const password = process.env.SEED_PASSWORD ?? "Skyland2026!";
  const hash = await bcrypt.hash(password, 10);
  const mk = (email: string, name: string, role: Role, phone?: string) =>
    prisma.user.create({ data: { email, name, role, phone, passwordHash: hash, buildingId: building.id } });
  const admin = await mk("admin@skyland.test", "Building Mgt AI Admin", "ADMIN");
  const manager = await mk("manager@skyland.test", "Engr. Paolo Santos", "MANAGER", "+63 917 555 0101");
  const president = await mk("president@skyland.test", "Board President", "BOARD");
  const treasurer = await mk("treasurer@skyland.test", "Board Treasurer", "BOARD");
  const owner = await mk("owner@skyland.test", "Ana Reyes", "OWNER", "+63 917 555 0112");

  console.log("Creating 400 units…");
  const unitRows: { code: string; floor: number; sqm: number; ownerName: string }[] = [];
  for (let floor = 2; floor <= 41; floor++) {
    for (const L of LETTERS) {
      unitRows.push({ code: `${floor}${L}`, floor, sqm: LETTER_SQM[L], ownerName: `${pick(INITIALS)}. ${pick(SURNAMES)}` });
    }
  }
  await prisma.unit.createMany({ data: unitRows.map((u) => ({ ...u, buildingId: building.id })) });
  await prisma.unit.update({ where: { buildingId_code: { buildingId: building.id, code: "12B" } }, data: { ownerId: owner.id, ownerName: owner.name } });
  const units = await prisma.unit.findMany({ orderBy: [{ floor: "asc" }, { code: "asc" }] });

  // chronic late payers: 2 units 90+ days, 4 units 60-90, 11 units 30-60
  const shuffled = [...units].filter((u) => u.code !== "12B").sort(() => rnd() - 0.5);
  const lateMonths = new Map<string, number>();
  shuffled.slice(0, 2).forEach((u) => lateMonths.set(u.id, 4));
  shuffled.slice(2, 5).forEach((u) => lateMonths.set(u.id, 3));
  shuffled.slice(5, 11).forEach((u) => lateMonths.set(u.id, 2));
  shuffled.slice(11, 23).forEach((u) => lateMonths.set(u.id, 1));
  // units with an unpaid tail drag down the on-time rate for those months, so raise everyone else's odds to hit the target
  const tailCount = MONTHS.map((_, mi) => [...lateMonths.values()].filter((n) => mi >= MONTHS.length - 1 - n && mi < MONTHS.length - 1).length);
  const pOnTime = (mi: number) => Math.min(0.99, ONTIME[mi] / ((units.length - tailCount[mi]) / units.length));

  console.log("Creating 12 months of bills and payments…");
  const bills: any[] = []; const payments: any[] = [];
  units.forEach((u) => {
    const sqm = Number(u.sqm); const amount = Math.round(sqm * DUES_RATE);
    const unpaidTail = lateMonths.get(u.id) ?? 0;
    MONTHS.forEach((period, mi) => {
      const id = `bill_${u.code}_${period}`;
      const isTail = mi >= MONTHS.length - 1 - unpaidTail && mi < MONTHS.length - 1; // unpaid older months
      const isNov = mi === MONTHS.length - 1;
      let paid = 0; let payDate: Date | null = null;
      if (u.code === "12B") { if (!isNov) { paid = amount; payDate = dayIn(period, 20); } }
      else if (isTail) { paid = 0; }
      else if (isNov) { if (rnd() < ONTIME[mi] && !unpaidTail) { paid = amount; payDate = dayIn(period, 1 + Math.floor(rnd() * 20)); } }
      else if (rnd() < pOnTime(mi) || unpaidTail) { paid = amount; payDate = dayIn(period, 3 + Math.floor(rnd() * 26)); }
      else { paid = amount; const [y, m] = period.split("-").map(Number); payDate = new Date(Date.UTC(y, m, 5 + Math.floor(rnd() * 20), 4)); } // paid late, next month
      if (payDate && payDate > NOW) payDate = new Date(NOW.getTime() - 3600_000 * (1 + rnd() * 48));
      bills.push({ id, unitId: u.id, period, amount, paid, dueDate: dueDate(period), status: paid >= amount ? "PAID" : "UNPAID", createdAt: dayIn(period, 1) });
      if (paid) payments.push({ billId: id, amount: paid, method: pick(METHODS), reference: `SKY-${period.replace("-", "")}-${String(payments.length).padStart(5, "0")}`, createdAt: payDate! });
    });
  });
  for (let i = 0; i < bills.length; i += 1000) await prisma.bill.createMany({ data: bills.slice(i, i + 1000) });
  for (let i = 0; i < payments.length; i += 1000) await prisma.payment.createMany({ data: payments.slice(i, i + 1000) });

  console.log("Creating budgets…");
  const LINES: [string, string, number][] = [
    ["Security agency", "SecureGuard Agency · 22 guards, 3 shifts", 480000],
    ["Common-area electricity", "Meralco", 265000],
    ["Building staff payroll", "Admin, engineers, technicians (at cost)", 238000],
    ["Janitorial", "CleanPro · 14 staff", 210000],
    ["Sinking fund contribution", "Transfer to reserve account", 171000],
    ["Repairs & maintenance", "Various, 3 quotes over ₱10k", 116000],
    ["Management fee", "Building Mgt AI", 95000],
    ["Elevator maintenance", "LiftCare · 4 cars", 68000],
    ["Water (common areas)", "Maynilad", 62000],
    ["Insurance", "Property & CGL, amortised", 41000],
    ["Pest control & landscaping", "GreenShield", 18000],
  ];
  const NOTES: Record<string, string> = {
    "Common-area electricity": "Chiller 2 ran ~30% longer than normal; condenser cleaning booked 25 Nov.",
    "Janitorial": "2 days of typhoon clean-up overtime.",
    "Repairs & maintenance": "Pool pump overhaul moved to November.",
    "Water (common areas)": "Leak fixed in September, usage down 6%.",
  };
  const OCT: Record<string, number> = { "Common-area electricity": 291300, "Janitorial": 214500, "Repairs & maintenance": 96400, "Water (common areas)": 58900, "Pest control & landscaping": 17200 };
  const budget: any[] = [];
  MONTHS.slice(0, 11).forEach((period) => {
    LINES.forEach(([category, vendor, b]) => {
      const fixed = ["Security agency","Building staff payroll","Sinking fund contribution","Management fee","Elevator maintenance","Insurance"].includes(category);
      const actual = period === "2026-10" ? (OCT[category] ?? b) : fixed ? b : Math.round(b * (0.9 + rnd() * 0.18) / 100) * 100;
      budget.push({ period, category, vendor, budget: b, actual, note: period === "2026-10" ? NOTES[category] ?? null : null });
    });
  });
  await prisma.budgetLine.createMany({ data: budget });

  console.log("Creating work orders…");
  const unitBy = (c: string) => units.find((u) => u.code === c)?.id;
  const ago = (min: number) => new Date(NOW.getTime() - min * 60000);
  const WOS: { loc: string; title: string; cat: string; pri: Priority; min: number; sla: number; status: WOStatus; who?: string; src: string; closedMin?: number; rating?: number }[] = [
    { loc: "12B", title: "Aircon not cooling (bedroom)", cat: "Mechanical", pri: "MEDIUM", min: 240, sla: 24, status: "ASSIGNED", who: "Rudy M.", src: "Chat" },
    { loc: "12B", title: "Kitchen faucet dripping", cat: "Plumbing", pri: "LOW", min: 4300, sla: 72, status: "DONE", who: "Rudy M.", src: "Chat", closedMin: 3100 },
    { loc: "27F", title: "No water pressure in kitchen", cat: "Plumbing", pri: "HIGH", min: 170, sla: 4, status: "IN_PROGRESS", who: "Rudy M.", src: "Chat" },
    { loc: "Lobby", title: "Main door access reader intermittent", cat: "Security", pri: "HIGH", min: 290, sla: 4, status: "ESCALATED", who: "Vendor: AccessPro", src: "Guard report" },
    { loc: "9C", title: "Breaker trips when aircon runs", cat: "Electrical", pri: "MEDIUM", min: 420, sla: 24, status: "ASSIGNED", who: "Jun P.", src: "Viber" },
    { loc: "Amenity deck", title: "Pool filter pump noisy", cat: "Mechanical", pri: "MEDIUM", min: 900, sla: 48, status: "IN_PROGRESS", who: "Jun P.", src: "Inspection" },
    { loc: "33A", title: "Hallway light out, 33rd floor", cat: "Electrical", pri: "LOW", min: 95, sla: 72, status: "NEW", src: "Chat" },
    { loc: "Parking B2", title: "Ceiling drip above slot B2-114", cat: "Civil", pri: "MEDIUM", min: 60, sla: 24, status: "ASSIGNED", who: "Rudy M.", src: "Chat" },
    { loc: "18D", title: "Intercom not ringing", cat: "Electrical", pri: "LOW", min: 35, sla: 72, status: "NEW", src: "Email" },
    { loc: "5H", title: "Clogged balcony floor drain", cat: "Plumbing", pri: "MEDIUM", min: 1500, sla: 24, status: "DONE", who: "Rudy M.", src: "Chat", closedMin: 1160, rating: 5 },
    { loc: "Elevator 3", title: "Door keeps re-opening", cat: "Elevator", pri: "HIGH", min: 1320, sla: 4, status: "DONE", who: "Vendor: LiftCare", src: "Inspection", closedMin: 1145, rating: 5 },
  ];
  for (const w of WOS) {
    const created = ago(w.min);
    const wo = await prisma.workOrder.create({ data: {
      unitId: unitBy(w.loc) ?? null, location: w.loc, title: w.title, category: w.cat, priority: w.pri, status: w.status,
      slaHours: w.sla, assignee: w.who ?? null, source: w.src, createdAt: created, closedAt: w.closedMin ? ago(w.closedMin) : null, rating: w.rating ?? null,
      reporterId: w.src === "Chat" && w.loc === "12B" ? owner.id : null,
    } });
    await prisma.wOEvent.create({ data: { workOrderId: wo.id, note: `Ticket opened via ${w.src}. AI set priority ${w.pri.toLowerCase()} and a ${w.sla}h deadline.`, author: "AI triage", createdAt: created } });
  }
  // 30 days of closed history for SLA metrics (226 tickets, 94% on time)
  const hist: any[] = [];
  const cats = ["Plumbing","Electrical","Civil","Mechanical","Elevator","Housekeeping","Security"];
  for (let i = 0; i < 226; i++) {
    const sla = pick([4, 24, 24, 72]); const createdMin = 60 * 24 * 2 + Math.floor(rnd() * 60 * 24 * 28);
    const onTime = i % 16 !== 0; const durMin = onTime ? Math.floor(sla * 60 * (0.15 + rnd() * 0.75)) : Math.floor(sla * 60 * (1.1 + rnd() * 0.6));
    hist.push({ location: units[Math.floor(rnd() * units.length)].code, title: `${pick(cats)} request`, category: pick(cats), priority: sla === 4 ? "HIGH" : sla === 24 ? "MEDIUM" : "LOW",
      status: "DONE", slaHours: sla, assignee: pick(["Rudy M.","Jun P.","Vendor: LiftCare","CleanPro"]), source: pick(["Chat","Chat","Viber","Email","Inspection"]),
      createdAt: ago(createdMin), closedAt: ago(createdMin - durMin), rating: rnd() < 0.72 ? (rnd() < 0.8 ? 5 : rnd() < 0.7 ? 4 : 3) : null });
  }
  await prisma.workOrder.createMany({ data: hist });

  console.log("Creating services…");
  await prisma.service.createMany({ data: [
    { name: "Aircon cleaning", detail: "Split-type chemical wash", price: 1200, unitLabel: "per aircon", vendor: "CoolCare PH" },
    { name: "Plumbing check", detail: "Leak test, faucets, drains", price: 650, unitLabel: "per visit", vendor: "In-house technician" },
    { name: "Deep cleaning", detail: "2 cleaners, 4 hours", price: 2800, unitLabel: "up to 50 sqm", vendor: "SparkleHome" },
    { name: "Pest control", detail: "Cockroach and ant treatment", price: 1500, unitLabel: "per unit", vendor: "GreenShield (DOH-accredited)" },
    { name: "Electrical check", detail: "Outlets, breaker, lighting", price: 750, unitLabel: "per visit", vendor: "Licensed electrician" },
    { name: "Move-in / move-out", detail: "Elevator booking, gate pass, crew", price: 3500, unitLabel: "half day", vendor: "Lipat Express" },
  ] });

  await seedV2({ prisma, rnd, hash, buildingId: building.id, units, owner, manager, NOW });
  await seedV3({ prisma, rnd, units: await prisma.unit.findMany({ orderBy: [{ floor: "asc" }, { code: "asc" }] }), owner, manager, NOW });

  await prisma.auditLog.create({ data: { userId: admin.id, action: "seed", detail: "Database seeded with Skyland sample data (skyland-demo-v4)" } });
  console.log(`Done. ${units.length} units, ${bills.length} bills, ${payments.length} payments.`);
  console.log(`Logins (password: ${password}): admin@ manager@ president@ treasurer@ owner@ guard@ skyland.test`);
  void manager; void president; void treasurer;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
