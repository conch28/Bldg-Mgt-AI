/**
 * Demo data for round-2 features: per-unit meters, board meetings and the AGM with proxies,
 * the neighbours feed and events, lift and genset sensors, and Messenger/Viber links.
 * Runs after the occupancy step in seed.ts, so vacant units can show "use while vacant".
 */
import type { PrismaClient, User } from "@prisma/client";

type Ctx = { prisma: PrismaClient; rnd: () => number; owner: User; manager: User; president: User; treasurer: User; NOW: Date };

export async function seedV5({ prisma, rnd, owner, manager, president, treasurer, NOW }: Ctx) {
  const day = 86400000;
  const ago = (d: number, h = 0) => new Date(NOW.getTime() - d * day + h * 3600000);
  const ahead = (d: number, hh = 19) => { const x = new Date(NOW.getTime() + d * day); const ymd = x.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); return new Date(`${ymd}T${String(hh).padStart(2, "0")}:00:00+08:00`); };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const units = await prisma.unit.findMany({ orderBy: { code: "asc" }, include: { owner: true } });
  const leased = new Set((await prisma.lease.findMany({ where: { end: { gte: NOW }, start: { lte: NOW } }, select: { unitId: true } })).map((l) => l.unitId));

  console.log("Metering every unit…");
  const have = new Set((await prisma.utilityReading.findMany({ select: { unitId: true }, distinct: ["unitId"] })).map((r) => r.unitId));
  const periods = (await prisma.utilityReading.findMany({ select: { period: true }, distinct: ["period"], orderBy: { period: "asc" } })).map((r) => r.period).slice(-6);
  const vacant = units.filter((u) => u.occupancy === "VACANT" && !leased.has(u.id) && !have.has(u.id));
  const occupied = units.filter((u) => !have.has(u.id) && !vacant.includes(u));
  const leaks = new Set(occupied.filter((_, i) => i % 37 === 11).slice(0, 4).map((u) => u.id));
  const hogs = new Set(occupied.filter((_, i) => i % 29 === 7).slice(0, 6).map((u) => u.id));
  const ghost = new Set(vacant.slice(0, 2).map((u) => u.id));
  const util: any[] = [];
  for (const u of [...occupied, ...vacant]) {
    const sqm = Number(u.sqm), isVac = vacant.includes(u);
    const eBase = isVac ? 18 + rnd() * 20 : sqm * 2.0 * (0.75 + rnd() * 0.5) * (hogs.has(u.id) ? 1.75 : 1);
    const wBase = isVac ? 0.3 + rnd() * 0.5 : sqm * 0.09 * (0.75 + rnd() * 0.45);
    periods.forEach((p, i) => {
      const last = i === periods.length - 1;
      const e = eBase * (0.92 + rnd() * 0.16) * (i >= 4 ? 1.06 : 1);
      const w = wBase * (0.93 + rnd() * 0.14) * (last && leaks.has(u.id) ? 1.7 : 1) + (last && ghost.has(u.id) ? 3.2 : 0);
      util.push({ unitId: u.id, period: p, kind: "ELECTRIC", usage: Math.round(e), amount: Math.round(e * 12.4) }, { unitId: u.id, period: p, kind: "WATER", usage: Math.round(w * 10) / 10, amount: Math.round(w * 78) });
    });
  }
  await prisma.utilityReading.createMany({ data: util });

  console.log("Board meetings, AGM and proxies…");
  const past = await prisma.meeting.create({ data: {
    title: "October board meeting", kind: "BOARD", startsAt: ago(21, 11), place: "Function room, 5th floor", status: "HELD", createdBy: president.name,
    agenda: "## 1. Call to order, quorum and approval of the last minutes\n## 2. Treasurer's report and collections\n- September: 91% collected on time.\n- 11 units overdue; 2 over 90 days.\n## 3. Property manager's report\n- 38 repairs closed in 30 days, 87% on time, rating 4.6/5.\n- Early warning: likely riser leak in Tower B stack 02.\n## 4. Typhoon season readiness\n## 5. Other matters\n## 6. Adjournment",
    notes: "Collections 91%. Demand letters sa 2 units >90 days.\nRiser Tower B stack 02 - inspect all floors 14-17.\nGenset battery weak sa monthly test.\nAction: Engr. Santos - inspect Tower B stack 02 riser floors 14-17 - Nov 5\nAction: Treasurer - send demand letters to units over 90 days - Nov 1\nAction: Engr. Santos - get 3 quotes for the genset battery - Nov 20\nAction: President - draft AGM notice and proxy form - Nov 25",
    minutes: "# Minutes: October board meeting\nPresent: Board President, Board Treasurer, 3 directors; Property manager Engr. Paolo Santos. Quorum present.\n## Treasurer's report\n- September collections were 91% on time. Two units are over 90 days late. **Motion** to send demand letters, moved by the Treasurer, seconded, carried.\n## Property manager's report\n- Repeat leaks on Tower B stack 02 (floors 14-17) point to a riser problem. The board asked for a full-stack inspection.\n- The genset starter battery was weak on the monthly test.\n## Typhoon season\n- The board asked for the typhoon prep list to run on the first storm signal.\n## Action items\n- **Engr. Santos:** inspect Tower B stack 02 riser, floors 14-17 (by Nov 5)\n- **Treasurer:** send demand letters (by Nov 1)\n- **Engr. Santos:** 3 quotes for the genset battery (by Nov 20)\n- **President:** AGM notice and proxy form (by Nov 25)\n\nDraft for the corporate secretary to review before circulation.",
  } });
  await prisma.actionItem.createMany({ data: [
    { meetingId: past.id, text: "Inspect Tower B stack 02 riser, floors 14-17", owner: "Engr. Santos", due: ago(16), status: "DONE", doneAt: ago(17) },
    { meetingId: past.id, text: "Send demand letters to units over 90 days", owner: "Treasurer", due: ago(20), status: "DONE", doneAt: ago(19) },
    { meetingId: past.id, text: "Get 3 quotes for the genset battery", owner: "Engr. Santos", due: ago(1), status: "OPEN" },
    { meetingId: past.id, text: "Draft the AGM notice and proxy form", owner: "President", due: ahead(4), status: "OPEN" },
    { text: "Renew the elevator maintenance contract (expires Jan 31)", owner: "Property manager", due: ahead(30), status: "OPEN" },
  ] });
  await prisma.meeting.create({ data: { title: "November board meeting", kind: "BOARD", startsAt: ahead(9), place: "Function room, 5th floor", createdBy: president.name,
    agenda: "## 1. Call to order, quorum and approval of the October minutes\n## 2. Matters arising\n- Genset battery quotes (Engr. Santos, overdue).\n- AGM notice and proxy form (President).\n## 3. Treasurer's report\n- October: 89% collected on time. Decide on amenity suspension for units over 90 days (House Rules §7.3).\n## 4. Property manager's report\n- Lift 2 (Tower A) vibration trending up; AI forecasts the alarm limit within about 3 weeks. Approve preventive service.\n- 4 units flagged for likely water leaks by the sub-meters.\n## 5. AGM preparation: venue, quorum, proxies\n## 6. Other matters\n## 7. Adjournment" } });
  const agm = await prisma.meeting.create({ data: { title: "2026 Annual General Meeting of Unit Owners", kind: "AGM", startsAt: ahead(16, 14), place: "Function room, 5th floor (and Zoom)", createdBy: president.name,
    agenda: "## 1. Call to order and certification of quorum\n- Quorum is a majority of floor area, present or by proxy.\n## 2. Approval of the 2025 AGM minutes\n## 3. President's report on 2026\n## 4. Treasurer's report and audited financials\n## 5. Approval of the 2027 budget and dues of ₱105/sqm\n## 6. Election of the 2027 board (5 seats)\n## 7. Other matters\n## 8. Adjournment" } });
  const registered = units.filter((u) => u.owner && u.owner.id !== owner.id && u.owner.role === "OWNER");
  const proxyUnits = registered.filter(() => rnd() < 0.36);
  const holders = [president, treasurer];
  for (const u of proxyUnits) {
    const h = pick(holders);
    await prisma.proxy.create({ data: { meetingId: agm.id, unitId: u.id, unitCode: u.code, grantorId: u.owner!.id, holderUserId: h.id, holderName: h.name, createdAt: ago(Math.floor(rnd() * 6), Math.floor(rnd() * 12)) } });
  }
  const budget = await prisma.poll.create({ data: { question: "Approve the 2027 budget and dues of ₱105/sqm per month", detail: "Up from ₱98 (+7.1%). Drivers: Meralco rates, the security contract renewal, and topping up the sinking fund for the lift modernisation. Full budget in Documents.", kind: "RESOLUTION", meetingId: agm.id, closesAt: ahead(16, 17), createdBy: president.name, options: { create: [{ label: "Approve" }, { label: "Reject" }, { label: "Abstain" }] } }, include: { options: true } });
  const [yes, no, abst] = budget.options;
  for (const u of registered.slice(0, 70)) {
    const viaProxy = proxyUnits.find((p) => p.id === u.id);
    const r = rnd();
    await prisma.vote.create({ data: { pollId: budget.id, optionId: r < 0.68 ? yes.id : r < 0.88 ? no.id : abst.id, unitId: u.id, userId: viaProxy ? pick(holders).id : u.owner!.id, weight: u.sqm, byProxy: Boolean(viaProxy), createdAt: ago(Math.floor(rnd() * 5)) } });
  }

  console.log("Neighbours feed and events…");
  const people = registered.slice(5, 60);
  const who = (i: number) => people[i % people.length];
  const posts: [number, string, string, string | null, number][] = [
    [0, "Sports", "Anyone up for a 6 AM run around Legazpi Park this Saturday? Easy pace po, 5K.", null, 7],
    [1, "Pets", "Lost-and-found success! Thank you to everyone who shared about Mochi. He was hiding in the B1 stairwell 🐶", null, 23],
    [2, "Parents", "Planning a kids' Christmas party at the function room on Dec 20. Who's in? Potluck style.", null, 15],
    [3, "Kudos", "Kuya Jun fixed our kitchen sink in 20 minutes on a Sunday morning. Super bait and malinis mag-trabaho. Salamat po!", "Jun P.", 18],
    [4, "General", "Reminder po: the pool is closed Mondays for cleaning. Saw a few kids waiting by the gate earlier.", null, 4],
    [5, "Kudos", "The lobby guard helped my lola carry groceries all the way up to the 19th floor when the lift was busy. Thank you!", "Lobby guard on duty", 31],
    [6, "Pets", "Pet owners: let's keep the pool deck paw-free and use the side path to the dog area. Salamat sa lahat!", null, 9],
    [7, "Sports", "Pickup basketball at the court, Thursdays 7 PM. Need 3 more players.", null, 6],
    [8, "Kudos", "Rudy came up at 10 PM for a tripped breaker and explained what happened. Very professional.", "Rudy M.", 12],
    [9, "General", "Does anyone have a ladder I can borrow for an hour? Will return right away po.", null, 2],
    [10, "Kudos", "Housekeeping got the hallway spotless after the moving crew left a mess. Ang galing!", "Housekeeping team", 8],
  ];
  for (const [i, group, body, staff, likes] of posts) {
    const u = who(i * 3);
    const p = await prisma.post.create({ data: { userId: u.owner!.id, authorName: u.owner!.name, unitCode: u.code, group, body, staffName: staff, createdAt: ago(i * 0.6 + rnd() * 0.4) } });
    const likers = people.slice(0, likes).map((x) => x.owner!.id);
    if (likers.length) await prisma.postLike.createMany({ data: [...new Set(likers)].map((userId) => ({ postId: p.id, userId })), skipDuplicates: true });
  }
  const events: [string, string, string, number, number, string, number][] = [
    ["Saturday fun run, Legazpi Park", "Sports", "Lobby, Tower A", 1, 6, "Easy 5K, all paces welcome. Coffee after at the corner café.", 9],
    ["Pet meetup and photo booth", "Pets", "Pool deck side lawn", 3, 16, "Bring your fur babies! Free pet photos courtesy of a resident photographer.", 14],
    ["Kids' Christmas party (potluck)", "Parents", "Function room, 5th floor", 12, 15, "Games, Santa, and a gift exchange (₱300 limit).", 22],
    ["Pickup basketball", "Sports", "Basketball court", 5, 19, null as any, 6],
  ];
  for (const [title, group, place, d, h, detail, n] of events) {
    const host = who(n);
    const e = await prisma.event.create({ data: { title, group, place, startsAt: ahead(d, h), detail, createdBy: host.owner!.id, hostName: host.owner!.name } });
    await prisma.eventRsvp.createMany({ data: people.slice(n % 7, (n % 7) + n).map((x) => ({ eventId: e.id, userId: x.owner!.id, name: x.owner!.name })), skipDuplicates: true });
  }

  console.log("Lift and genset sensors…");
  const A = (tag: string, name: string, category: string, location: string, years: number, life: number, cost: number, vendor: string) =>
    prisma.asset.create({ data: { tag, name, category, location, installedAt: ago(years * 365), lifeMonths: life, cost, vendor, warrantyUntil: null } });
  const lifts = {
    a1: await A("EV-A1-DRIVE", "Tower A lift 1", "Elevator", "Elevator 1 (Tower A)", 9, 300, 4200000, "LiftCare"),
    a2: await A("EV-A2-DRIVE", "Tower A lift 2", "Elevator", "Elevator 2 (Tower A)", 9, 300, 4200000, "LiftCare"),
    b3: await A("EV-B3-DRIVE", "Tower B lift 3", "Elevator", "Elevator 3 (Tower B)", 9, 300, 4200000, "LiftCare"),
    b4: await A("EV-B4-DRIVE", "Tower B lift 4", "Elevator", "Elevator 4 (Tower B)", 9, 300, 4200000, "LiftCare"),
  };
  const gen = await A("EL-GEN-1", "Standby generator 750 kVA", "Electrical", "Genset room", 12, 300, 6800000, "PowerMax");
  const pump = (await prisma.asset.findUnique({ where: { tag: "PM-BOOST-1" } })) ?? await A("PM-BOOST-1", "Booster pump 1", "Pump", "Pump room", 5, 120, 185000, "AquaTech Pumps");
  const rows: { assetId: string; metric: string; value: number; at: Date }[] = [];
  const series = (assetId: string, metric: string, f: (d: number) => number, perDay = 4, noise = 0.05) => {
    for (let d = 13; d >= 0; d--) for (let k = 0; k < perDay; k++) { const v = f(13 - d); rows.push({ assetId, metric, value: Math.round(v * (1 + (rnd() - 0.5) * 2 * noise) * 100) / 100, at: ago(d, -k * (24 / perDay)) }); }
  };
  series(lifts.a1.id, "VIBRATION", () => 2.1); series(lifts.a1.id, "DOOR_FAULTS", () => 1.2, 1, 0.4); series(lifts.a1.id, "TRIPS", () => 410, 1, 0.1);
  series(lifts.a2.id, "VIBRATION", (t) => 3.0 + t * 0.14, 4, 0.03); series(lifts.a2.id, "DOOR_FAULTS", () => 1.5, 1, 0.4); series(lifts.a2.id, "TRIPS", () => 395, 1, 0.1);
  series(lifts.b3.id, "VIBRATION", () => 2.4); series(lifts.b3.id, "DOOR_FAULTS", (t) => 2.2 + t * 0.33, 1, 0.06); series(lifts.b3.id, "TRIPS", () => 430, 1, 0.1);
  series(lifts.b4.id, "VIBRATION", () => 1.9); series(lifts.b4.id, "DOOR_FAULTS", () => 0.8, 1, 0.4); series(lifts.b4.id, "TRIPS", () => 380, 1, 0.1);
  series(gen.id, "BATTERY_V", (t) => 12.62 - t * 0.028, 1, 0.002); series(gen.id, "COOLANT_C", () => 86, 1, 0.02);
  series(pump.id, "PRESSURE_BAR", () => 4.9, 4, 0.02); series(pump.id, "VIBRATION", () => 2.6, 4, 0.05);
  await prisma.sensorReading.createMany({ data: rows });

  console.log("Messenger and Viber links, guest photo…");
  await prisma.user.update({ where: { id: owner.id }, data: { messengerPsid: "demo-psid-ana", notifyMessenger: true } });
  for (const u of registered.slice(0, 24)) await prisma.user.update({ where: { id: u.owner!.id }, data: { messengerPsid: `demo-psid-${u.code}`, notifyMessenger: true } });
  for (const u of registered.slice(24, 35)) await prisma.user.update({ where: { id: u.owner!.id }, data: { viberId: `demo-viber-${u.code}` } });
  const chats: [User | null, string, string, string][] = [
    [owner, "MESSENGER", "Magkano po balance ko?", "Wala po kayong balance, salamat! Your last payment was received this month."],
    [owner, "MESSENGER", "Pool open ba bukas?", "Yes po, the pool is open 6 AM-9 PM tomorrow (closed Mondays only)."],
  ];
  for (const [u, ch, q, a] of chats) { const t = ago(2 + rnd()); await prisma.chatMessage.createMany({ data: [{ userId: u!.id, role: "user", content: q, channel: ch, createdAt: t }, { userId: u!.id, role: "assistant", content: a, channel: ch, createdAt: new Date(t.getTime() + 1) }] }); }
  for (const u of registered.slice(0, 30)) { const ch = rnd() < 0.7 ? "MESSENGER" : "VIBER"; const t = ago(rnd() * 20); await prisma.chatMessage.createMany({ data: [{ userId: u.owner!.id, role: "user", content: pick(["Pa-check po ng balance", "May tulo po sa CR", "Book po aircon cleaning", "Anong oras po ang gym?"]), channel: ch, createdAt: t }, { userId: u.owner!.id, role: "assistant", content: "Noted po!", channel: ch, createdAt: new Date(t.getTime() + 1) }] }); }
  const ana = await prisma.unit.findFirst({ where: { ownerId: owner.id }, orderBy: { code: "asc" } });
  if (ana) {
    const face = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" fill="#f1d9c4"/><circle cx="44" cy="36" r="17" fill="#8a5a3c"/><circle cx="44" cy="38" r="13" fill="#e8b98f"/><path d="M14 88c4-18 16-26 30-26s26 8 30 26z" fill="#0072B2"/><circle cx="39" cy="37" r="1.6"/><circle cx="49" cy="37" r="1.6"/><path d="M39 44q5 4 10 0" stroke="#7a3d26" stroke-width="1.6" fill="none"/></svg>`).toString("base64");
    const from = new Date(NOW.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) + "T00:00:00+08:00");
    await prisma.pass.create({ data: { code: "YLND26", kind: "GUEST", name: "Linda Santos (yaya)", unitId: ana.id, userId: owner.id, validFrom: from, validTo: new Date(from.getTime() + 30 * day - 1), note: "Comes Mon-Fri, 7 AM", photo: face } });
  }
  void manager;
}
