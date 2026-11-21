/* Sample data for v3: resale & leasing (market comps, listings, inquiries), Ana's leased second unit and
 * rental income, utilities, moves, pets & vehicles, marketplace, lost & found and past SOS alerts. */
import type { PrismaClient, Unit, User } from "@prisma/client";

type Ctx = { prisma: PrismaClient; rnd: () => number; units: Unit[]; owner: User; manager: User; NOW: Date };
const DAY = 86400000;
const per = (period: string) => period;

export async function seedV3({ prisma, rnd, units, owner, NOW }: Ctx) {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const ago = (d: number) => new Date(NOW.getTime() - d * DAY);
  const beds = (sqm: number) => (sqm < 35 ? 0 : sqm < 60 ? 1 : 2);
  const round = (v: number, r: number) => Math.round(v / r) * r;

  console.log("Creating market comparables…");
  const NEARBY = [["Linden Place", 0.3], ["Calla Tower", 0.5], ["Harbor Point Residences", 0.7], ["Mabini Heights", 0.9], ["Orchid Court", 1.4]] as const;
  const SIZES = [28, 38, 45, 52, 62, 85];
  const comps: any[] = [];
  for (const kind of ["LEASE", "SALE"] as const) {
    const base = kind === "LEASE" ? 720 : 168000, r = kind === "LEASE" ? 500 : 10000;
    for (let i = 0; i < 16; i++) { const sqm = pick(SIZES), floor = 5 + Math.floor(rnd() * 35); comps.push({ kind, source: "SKYLAND_DEAL", building: "Skyland Tower", distanceKm: 0, sqm, beds: beds(sqm), floor, price: round(sqm * base * (0.93 + rnd() * 0.12) * (1 + (floor - 15) * 0.002), r), date: ago(20 + rnd() * 480) }); }
    for (let i = 0; i < 6; i++) { const sqm = pick(SIZES), floor = 5 + Math.floor(rnd() * 35); comps.push({ kind, source: "SKYLAND_LISTING", building: "Skyland Tower", distanceKm: 0, sqm, beds: beds(sqm), floor, price: round(sqm * base * (1.0 + rnd() * 0.1), r), date: ago(rnd() * 40) }); }
    for (const [b, km] of NEARBY) for (let i = 0; i < 5; i++) { const sqm = pick(SIZES); comps.push({ kind, source: "NEARBY", building: b, distanceKm: km, sqm, beds: beds(sqm), price: round(sqm * base * (0.88 + rnd() * 0.2), r), date: ago(rnd() * 60) }); }
  }
  await prisma.marketComp.createMany({ data: comps });

  console.log("Creating Ana's leased unit, leases and utilities…");
  const leasedUnit = units.find((u) => u.floor === 21 && ["D", "B", "H"].includes(u.code.slice(-1)) && !u.ownerId) ?? units.find((u) => !u.ownerId && Number(u.sqm) === 45)!;
  await prisma.unit.update({ where: { id: leasedUnit.id }, data: { ownerId: owner.id, ownerName: owner.name } });
  await prisma.bill.updateMany({ where: { unitId: leasedUnit.id }, data: { status: "PAID" } });
  const bills = await prisma.bill.findMany({ where: { unitId: leasedUnit.id } });
  for (const b of bills) await prisma.bill.update({ where: { id: b.id }, data: { paid: b.amount } });
  const leaseStart = new Date(ago(300).toISOString().slice(0, 8) + "01T00:00:00+08:00");
  await prisma.lease.create({ data: { unitId: leasedUnit.id, tenantName: "Kenji Watanabe", rent: 32000, deposit: 64000, start: leaseStart, end: new Date(NOW.getTime() + 40 * DAY) } });
  await prisma.lease.create({ data: { unitId: leasedUnit.id, tenantName: "Liza Romero", rent: 30000, deposit: 60000, start: new Date(leaseStart.getTime() - 425 * DAY), end: new Date(leaseStart.getTime() - 62 * DAY) } });
  // a few more leased units in the building for the board's view
  const others = units.filter((u) => u.ownerId && u.ownerId !== owner.id && u.id !== leasedUnit.id).slice(0, 30);
  await prisma.lease.createMany({ data: others.map((u) => ({ unitId: u.id, tenantName: `${pick(["J.", "M.", "R.", "A.", "C."])} ${pick(["Lim", "Cruz", "Tan", "Reyes", "Garcia", "Sy"])}`, rent: round(Number(u.sqm) * 720, 500), deposit: round(Number(u.sqm) * 1440, 500), start: ago(30 + rnd() * 300), end: new Date(NOW.getTime() + (30 + rnd() * 300) * DAY) })) });

  const code12B = units.find((u) => u.code === "12B")!;
  const periods = Array.from({ length: 6 }, (_, i) => { const d = new Date(NOW.getTime()); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - 6 + i); return per(d.toISOString().slice(0, 7)); });
  const util: any[] = [];
  for (const [u, kwh, m3] of [[code12B, 260, 11], [leasedUnit, 310, 14]] as const) periods.forEach((p, i) => {
    const e = kwh * (0.9 + rnd() * 0.2) * (i >= 4 ? 1.05 : 1), w = m3 * (0.92 + rnd() * 0.12) * (u === code12B && i === 5 ? 1.42 : 1);
    util.push({ unitId: u.id, period: p, kind: "ELECTRIC", usage: Math.round(e), amount: Math.round(e * 12.4) }, { unitId: u.id, period: p, kind: "WATER", usage: Math.round(w * 10) / 10, amount: Math.round(w * 78) });
  });
  await prisma.utilityReading.createMany({ data: util });

  console.log("Creating listings and inquiries…");
  const live = await prisma.listing.create({ data: {
    unitId: leasedUnit.id, userId: owner.id, kind: "LEASE", status: "LIVE", price: 33500, suggestedLow: 31500, suggestedHigh: 35000, beds: 1, furnished: "FULL",
    title: `1BR for lease at Skyland Tower, 21st floor, fully furnished`,
    body: `1BR for LEASE · Skyland Tower\n₱33,500/month\n\n• 45 sqm, 21st floor, city view\n• Fully furnished, new inverter aircon\n• Pool, gym, 24/7 security\n• Walk to malls and offices\n\nAvailable ${new Date(NOW.getTime() + 41 * DAY).toLocaleDateString("en-PH", { month: "long", day: "numeric" })}. 1 month advance, 2 months deposit, minimum 1 year.\nMessage us to book a viewing. Our assistant replies in minutes.`,
    bodyTl: `1BR for rent sa Skyland Tower!\n₱33,500/month, fully furnished, 21st floor na may city view. May pool, gym at 24/7 security. Available na next month. PM lang po para sa viewing!`,
    highlights: ["45 sqm, 21st floor", "Fully furnished", "New inverter aircon", "Pool, gym, 24/7 security"],
    rationale: "Based on 31 comparable rentals in the last 18 months: 9 closed Skyland deals, 4 current Skyland listings and 18 listings within 1 km. Adjusted for floor 21 and fully furnished.",
    channels: ["FB_PAGE", "FB_MARKETPLACE", "FB_GROUPS"], posts: ["FB_PAGE", "FB_MARKETPLACE", "FB_GROUPS"].map((c) => ({ channel: c, status: "POSTED", info: c === "FB_GROUPS" ? "Posted to 4 condo groups" : "Posted", at: ago(3).toISOString() })),
    views: 412, publishedAt: ago(3), broker: "Carla Mendoza, PRC-licensed real estate broker", ai: true, createdAt: ago(3.2),
  } });
  const slot = (d: number, h: number) => new Date(new Date(NOW.getTime() + d * DAY).toISOString().slice(0, 10) + `T${String(h).padStart(2, "0")}:00:00+08:00`);
  await prisma.inquiry.createMany({ data: [
    { listingId: live.id, name: "Joanna Lim", channel: "MARKETPLACE", message: "Hi, is this still available? I work in the area and need a place by January.", aiReply: "Hi Joanna, thanks for your interest! Yes, it's available from early January at ₱33,500 a month (1 month advance, 2 months deposit). I can book you a viewing on Saturday at 10 AM. Reply \"OK\" and I'll send a guest pass for the lobby.", status: "VIEWING", viewingAt: slot(1, 10), passCode: "VJL4QM", createdAt: ago(2.6) },
    { listingId: live.id, name: "Mark Villanueva", channel: "MESSENGER", message: "Magkano po move-in? Pwede po ba pets?", aiReply: "Hi Mark! Ang move-in po ay ₱100,500 (1 month advance + 2 months deposit). Small pets are allowed in Skyland basta registered sa admin office, pero ico-confirm pa po ng broker namin with the owner. Gusto niyo po ba mag-viewing sa Saturday, 2 PM?", status: "ANSWERED", createdAt: ago(2.1) },
    { listingId: live.id, name: "Priya Nair", channel: "GROUP", message: "Is parking included? And is the price negotiable for a 2-year lease?", aiReply: "Hi Priya! Parking isn't included in this listing, but slots in Skyland can sometimes be rented separately; our broker can check for you. For a 2-year lease, our broker Carla will discuss terms with the owner. Would Monday at 4 PM work for a viewing?", status: "ANSWERED", createdAt: ago(1.4) },
    { listingId: live.id, name: "Daniel Ong", channel: "MESSENGER", message: "Can I see it this weekend? Me and my wife, no kids, no pets.", aiReply: "Hi Daniel, thanks! You're welcome to view it. I've got Saturday at 2 PM open. Reply \"OK\" and I'll book it and send a guest pass for the lobby.", status: "NEW", createdAt: ago(0.1) },
  ] });
  // other owners' listings
  const others2 = units.filter((u) => u.ownerId && u.ownerId !== owner.id).sort(() => rnd() - 0.5);
  const ls: any[] = [];
  others2.slice(0, 22).forEach((u, i) => {
    const kind = i % 3 === 0 ? "SALE" : "LEASE", sqm = Number(u.sqm), b = beds(sqm);
    const price = kind === "LEASE" ? round(sqm * 735, 500) : round(sqm * 170000, 50000);
    const closed = i >= 8, pub = ago(closed ? 30 + rnd() * 320 : rnd() * 25);
    ls.push({ unitId: u.id, userId: u.ownerId!, kind, status: closed ? "CLOSED" : i === 7 ? "DRAFT" : "LIVE", price, suggestedLow: round(price * 0.95, 500), suggestedHigh: round(price * 1.05, 500), beds: b, furnished: pick(["BARE", "SEMI", "FULL"]),
      title: `${b ? b + "BR" : "Studio"} for ${kind === "LEASE" ? "lease" : "sale"} at Skyland Tower`, body: "Listing text", highlights: [], rationale: "Priced from Skyland and nearby comparables.", channels: ["FB_PAGE", "FB_MARKETPLACE", "FB_GROUPS"],
      views: Math.round(80 + rnd() * 500), publishedAt: pub, closedAt: closed ? new Date(pub.getTime() + (kind === "LEASE" ? 12 + rnd() * 18 : 45 + rnd() * 60) * DAY) : null, closedPrice: closed ? price : null, ai: true, createdAt: pub });
  });
  await prisma.listing.createMany({ data: ls });
  const liveOthers = await prisma.listing.findMany({ where: { status: "LIVE", userId: { not: owner.id } } });
  await prisma.inquiry.createMany({ data: liveOthers.flatMap((l) => Array.from({ length: 2 + Math.floor(rnd() * 6) }, (_, k) => ({ listingId: l.id, name: pick(["A. Cruz", "B. Tan", "C. Lim", "D. Reyes", "E. Sy"]), channel: pick(["MESSENGER", "MARKETPLACE", "GROUP"]), message: "Is this still available?", aiReply: "Yes, it's available! Would you like to book a viewing?", status: k === 0 ? "VIEWING" : "ANSWERED", viewingAt: k === 0 ? slot(1 + Math.floor(rnd() * 5), 14) : null, createdAt: ago(rnd() * 10) }))) });

  console.log("Creating moves, registrations, marketplace, lost & found and SOS history…");
  const mgrUnits = units.filter((u) => u.ownerId && u.ownerId !== owner.id).slice(40, 46);
  const today8 = slot(0, 8);
  await prisma.moveRequest.createMany({ data: [
    { unitId: leasedUnit.id, userId: owner.id, kind: "MOVE_OUT", date: new Date(NOW.getTime() + 40 * DAY), done: ["request"], status: "PENDING", note: "Tenant Kenji Watanabe moving out at lease end" },
    { unitId: mgrUnits[0].id, userId: mgrUnits[0].ownerId!, kind: "MOVE_IN", date: today8, done: ["request", "ids", "bond", "approve", "pass"], status: "APPROVED", passCode: "MV7K2P", note: "Lalamove truck, 3 movers" },
    { unitId: mgrUnits[1].id, userId: mgrUnits[1].ownerId!, kind: "MOVE_IN", date: slot(2, 8), done: ["request", "ids"], status: "PENDING", note: "New tenant" },
    { unitId: mgrUnits[2].id, userId: mgrUnits[2].ownerId!, kind: "RENOVATION", date: slot(-1, 8), done: ["request", "plans", "bond", "approve", "pass"], status: "APPROVED", passCode: "RN3XQT", note: "Kitchen cabinets and repainting, 2 weeks" },
  ] });
  const regs: any[] = [
    { unitId: code12B.id, userId: owner.id, kind: "PET", name: "Mochi", details: "Dog, Shih Tzu, anti-rabies until Mar 2027", status: "APPROVED", sticker: "P-1001", createdAt: ago(120) },
    { unitId: code12B.id, userId: owner.id, kind: "VEHICLE", name: "NCX 4821", details: "White Toyota Vios · slot B2-118", status: "APPROVED", sticker: "V-1001", createdAt: ago(200) },
  ];
  units.filter((u) => u.ownerId && u.ownerId !== owner.id).slice(0, 34).forEach((u, i) => {
    const pet = i % 3 === 0;
    regs.push({ unitId: u.id, userId: u.ownerId!, kind: pet ? "PET" : "VEHICLE", name: pet ? pick(["Bruno", "Coco", "Luna", "Max", "Kitkat", "Choco"]) : `${pick(["NBC", "DAE", "NXT", "CAR", "PQR"])} ${1000 + Math.floor(rnd() * 8999)}`,
      details: pet ? pick(["Cat, Puspin", "Dog, Poodle", "Dog, Pomeranian", "Cat, Persian"]) : pick(["Grey Honda City", "Black Mitsubishi Montero", "White Toyota Innova", "Red Suzuki Swift"]) + ` · slot B${1 + (i % 3)}-${100 + i}`,
      status: i < 31 ? "APPROVED" : "PENDING", sticker: i < 31 ? `${pet ? "P" : "V"}-${1002 + i}` : null, createdAt: ago(5 + rnd() * 300) });
  });
  await prisma.registration.createMany({ data: regs });
  const sellers = await prisma.user.findMany({ where: { role: "OWNER", id: { not: owner.id } }, take: 8 });
  await prisma.marketItem.createMany({ data: [
    ["Ikea sofa bed, grey", "Furniture", 6500, "Good condition, pick up at the lobby"], ["Ube cheese pandesal, 12 pcs", "Food", 180, "Fresh every Saturday, order by Friday"], ["Baby crib with mattress", "Kids", 3500, "Used for 1 year"],
    ["Inverter window aircon 1HP", "Appliances", 9000, "Moving out, works perfectly"], ["Moving boxes, 15 pcs", "Free", 0, "Free, just pick up"], ["Home-cooked lunch, weekdays", "Services", 150, "Ulam + rice, delivered to your unit"],
    ["Study table and chair", "Furniture", 2500, ""], ["Air fryer 5L", "Appliances", 1800, "Barely used"],
  ].map(([title, category, price, description], i) => ({ userId: sellers[i % sellers.length].id, title: String(title), category: String(category), price: Number(price), description: String(description), createdAt: ago(i * 1.7 + 0.2) })) });
  await prisma.lostFound.createMany({ data: [
    { kind: "FOUND", title: "Car keys with Toyota fob", place: "Basement 2 parking", status: "OPEN", createdAt: ago(0.4) },
    { kind: "LOST", title: "Kid's blue water bottle", place: "Pool area", status: "OPEN", userId: sellers[0].id, createdAt: ago(1.2) },
    { kind: "FOUND", title: "Black umbrella", place: "Lobby lounge", status: "OPEN", createdAt: ago(2) },
    { kind: "FOUND", title: "AirPods case", place: "Gym", status: "RETURNED", createdAt: ago(6) },
    { kind: "LOST", title: "Grey cat (Kitkat), 21st floor", place: "Fire exit, 21st floor", status: "RETURNED", userId: sellers[1].id, createdAt: ago(12) },
  ] });
  const sosU = await prisma.user.findMany({ where: { role: "OWNER" }, include: { units: true }, take: 6, skip: 3 });
  await prisma.sosAlert.createMany({ data: sosU.map((u, i) => { const t = ago(4 + i * 11); return { userId: u.id, unitCode: u.units[0]?.code, kind: ["MEDICAL", "ELEVATOR", "SECURITY", "MEDICAL", "OTHER", "FIRE"][i], note: ["Lola fainted", "Stuck between 14 and 15", "Stranger knocking on doors", "Kid with high fever", "Strong gas smell", "Smoke from neighbour's kitchen"][i], status: "RESOLVED", ackBy: "Mang Ernie (Lobby guard)", ackAt: new Date(t.getTime() + (90 + i * 25) * 1000), resolvedAt: new Date(t.getTime() + 25 * 60000), createdAt: t }; }) });
}
