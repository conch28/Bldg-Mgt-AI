/* Sample data for the v2 modules: more owner logins, resident updates, amenities, passes, documents,
 * voting, vendors and the preventive maintenance calendar. Called from seed.ts. */
import type { PrismaClient, Unit, User } from "@prisma/client";

type Ctx = { prisma: PrismaClient; rnd: () => number; hash: string; buildingId: string; units: Unit[]; owner: User; manager: User; NOW: Date };
const DAY = 86400000;

/** Minimal one-page PDF with text lines (Helvetica). Enough for a demo document vault. */
function pdf(title: string, lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7E]/g, "-");
  const body = [`BT /F1 18 Tf 56 780 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 11 Tf 56 ${748 - i * 18} Td (${esc(l)}) Tj ET`)].join("\n");
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${body.length} >>\nstream\n${body}\nendstream`];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

export async function seedV2({ prisma, rnd, hash, buildingId, units, owner, manager, NOW }: Ctx) {
  const at = (days: number, hour = 9) => { const d = new Date(NOW.getTime() + days * DAY); const ymd = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); return new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+08:00`); };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  console.log("Creating guard and owner logins…");
  await prisma.user.create({ data: { email: "guard@skyland.test", name: "Mang Ernie (Lobby guard)", role: "GUARD", passwordHash: hash, buildingId } });
  await prisma.user.update({ where: { id: owner.id }, data: { language: "EN", notifyMessenger: true, messengerPsid: "demo-psid-1202B" } });
  // 140 more owners with portal logins (the rest of the 400 units have not registered yet)
  const candidates = units.filter((u) => u.code !== "1202B").sort(() => rnd() - 0.5).slice(0, 115);
  for (const [i, u] of candidates.entries()) {
    const first = pick(["Maria", "Jose", "Carmela", "Miguel", "Liza", "Ramon", "Bea", "Paolo", "Grace", "Mark", "Joy", "Rico", "Celia", "Andrew", "Patricia", "Kevin"]);
    const name = `${first} ${(u.ownerName ?? "Owner").split(". ").pop()}`;
    const user = await prisma.user.create({ data: { email: `owner${i + 1}@skyland.test`, name, role: "OWNER", phone: `+63 9${17 + (i % 3)} 555 ${String(1000 + i).slice(-4)}`, passwordHash: hash, buildingId, language: rnd() < 0.42 ? "TL" : "EN", notifySms: rnd() < 0.85, notifyEmail: rnd() < 0.8, notifyMessenger: rnd() < 0.35, messengerPsid: `demo-psid-${u.code}` } });
    await prisma.unit.update({ where: { id: u.id }, data: { ownerId: user.id, ownerName: name } });
  }
  const owners = await prisma.user.findMany({ where: { role: "OWNER" }, include: { units: true } });

  console.log("Creating resident updates…");
  const ANN = [
    { kind: "URGENT", category: "Water interruption", title: "Water interruption today, 1 PM to 4 PM", days: -6, ch: ["APP", "SMS", "EMAIL", "MESSENGER"],
      en: "Water supply will be interrupted today, 1 PM to 4 PM, for emergency repair of the riser valve on floors 12 to 20. Please store enough water beforehand. We'll send an update once supply is back.",
      tl: "Magkakaroon po ng water interruption ngayong araw, 1 PM hanggang 4 PM, dahil sa emergency repair ng riser valve sa floors 12 hanggang 20. Mag-ipon po muna ng tubig. Mag-a-update kami pag may tubig na ulit." },
    { kind: "URGENT", category: "Typhoon advisory", title: "Typhoon advisory: Signal No. 2 over Metro Manila", days: -17, ch: ["APP", "SMS", "MESSENGER"],
      en: "PAGASA has raised Signal No. 2 over Metro Manila. Please bring in plants and items from balconies, close windows, and charge your devices. The lobby and P1 parking stay open; avoid the basement levels if flooding starts. Guard house: local 100.",
      tl: "Itinaas ng PAGASA ang Signal No. 2 sa Metro Manila. Paki-pasok po ang mga halaman at gamit sa balcony, isara ang bintana, at mag-charge ng gadgets. Bukas ang lobby at P1; iwasan ang basement kung bumaha. Guard house: local 100." },
    { kind: "ROUTINE", category: "Monthly newsletter", title: "Skyland Monthly: November 2026", days: -3, ch: ["APP", "EMAIL"], ai: true,
      en: "Good news first: 91.7% of October dues were paid on time, our best month this year. Thank you!\n\nWhat's new\n- Online amenity booking is live. Reserve the pool, function room and gym from the owner portal.\n- Guest and delivery passes: create a code for your visitor so the guard no longer needs to call your unit.\n- Elevator 2 got its annual load test and passed.\n\nComing up\n- Kids' Christmas party, Dec 14, 3 PM, function room.\n- Annual general assembly, Jan 24, 2027. Notice and proxy forms will follow.\n\nQuestions? Message the helpdesk in the owner portal or visit the admin office, Mon-Sat, 8 AM-6 PM.",
      tl: "Good news muna: 91.7% ng October dues ay nabayaran on time, pinakamataas ngayong taon. Salamat po!\n\nAno'ng bago\n- Live na ang online amenity booking. Pwede nang mag-reserve ng pool, function room at gym sa owner portal.\n- Guest at delivery passes: gumawa ng code para sa bisita para hindi na tumawag ang guard sa unit ninyo.\n- Pumasa ang Elevator 2 sa annual load test.\n\nAbangan\n- Kids' Christmas party, Dec 14, 3 PM, function room.\n- Annual general assembly, Jan 24, 2027. Susunod ang notice at proxy forms.\n\nMay tanong? Mag-message sa helpdesk sa owner portal o pumunta sa admin office, Mon-Sat, 8 AM-6 PM." },
    { kind: "ROUTINE", category: "Maintenance notice", title: "Pool closed Dec 2 to 4 for retiling", days: -1, ch: ["APP", "SMS", "EMAIL"], ai: true,
      en: "The swimming pool will be closed from Tuesday, Dec 2 to Thursday, Dec 4 while we replace cracked tiles and re-grout the deep end. The gym and function room stay open. Thank you for your patience!",
      tl: "Sarado po ang swimming pool mula Martes, Dec 2 hanggang Huwebes, Dec 4 dahil papalitan ang mga basag na tiles sa deep end. Bukas pa rin ang gym at function room. Salamat po sa pag-unawa!" },
    { kind: "REMINDER", category: "Dues reminder", title: "October dues are due on the last day of the month", days: -27, ch: ["APP", "SMS", "EMAIL"],
      en: "Hi! A friendly reminder that October 2026 association dues are due on the last day of the month. Pay in seconds from the owner portal with GCash, Maya or card. If you've already paid, thank you!",
      tl: "Hi po! Paalala lang na ang October 2026 dues ay due sa huling araw ng buwan. Pwede po kayong magbayad sa owner portal gamit ang GCash, Maya o card. Kung nakabayad na kayo, salamat po!" },
  ];
  for (const a of ANN) {
    const sentAt = at(a.days, 10);
    const rec = await prisma.announcement.create({ data: { kind: a.kind, category: a.category, title: a.title, bodyEn: a.en, bodyTl: a.tl, smsEn: a.en.slice(0, 300), smsTl: a.tl.slice(0, 300), audience: "ALL", channels: a.ch, status: "SENT", sentAt, aiDrafted: Boolean(a.ai), createdBy: manager.name, approvedBy: manager.name, createdAt: sentAt } });
    const rows: any[] = [];
    for (const o of owners) {
      for (const ch of a.ch) {
        if ((ch === "SMS" && !o.notifySms) || (ch === "EMAIL" && !o.notifyEmail) || (ch === "MESSENGER" && !o.notifyMessenger)) continue;
        const read = ch === "APP" && (o.id !== owner.id || a.days < -2) && rnd() < (a.kind === "URGENT" ? 0.86 : 0.64);
        rows.push({ announcementId: rec.id, userId: o.id, unitCode: o.units[0]?.code, channel: ch, to: ch === "SMS" ? o.phone : ch === "EMAIL" ? o.email : ch === "MESSENGER" ? o.messengerPsid : null, status: ch === "APP" ? "SENT" : rnd() < 0.985 ? "SENT" : "FAILED", info: ch === "APP" ? "In-app" : "Delivered", createdAt: sentAt, readAt: read ? new Date(sentAt.getTime() + rnd() * 2 * DAY) : null });
      }
    }
    await prisma.delivery.createMany({ data: rows });
  }
  // ticket updates for Ana
  for (const [t, b, d] of [["WO update: technician assigned", "Rudy M. is assigned to your ticket (aircon not cooling) and will visit today between 2 and 4 PM.", -0.2], ["Payment received", "We received ₱4,410 for October 2026 dues via GCash. Salamat po! Reference GC-8821-4410.", -24]] as const) {
    const a = await prisma.announcement.create({ data: { kind: "TICKET", category: "Automatic update", title: t, bodyEn: b, smsEn: b, audience: "UNITS:1202B", channels: ["APP", "SMS"], status: "SENT", sentAt: at(d, 11), createdBy: "Automation", createdAt: at(d, 11) } });
    await prisma.delivery.createMany({ data: [{ announcementId: a.id, userId: owner.id, unitCode: "1202B", channel: "APP", status: "SENT", info: "In-app", createdAt: at(d, 11) }, { announcementId: a.id, userId: owner.id, unitCode: "1202B", channel: "SMS", to: owner.phone, status: "SENT", info: "Delivered", createdAt: at(d, 11) }] });
  }
  // waiting for approval + scheduled
  await prisma.announcement.create({ data: { kind: "ROUTINE", category: "Assembly / meeting notice", title: "Notice of Annual General Assembly, January 24, 2027", aiDrafted: true, createdBy: manager.name, status: "PENDING_APPROVAL", audience: "ALL", channels: ["APP", "EMAIL", "SMS"],
    bodyEn: "The Annual General Assembly of Skyland Plaza Condominium Corporation will be held on Saturday, January 24, 2027, 2:00 PM, at the 5th floor function room.\n\nAgenda\n1. Call to order and proof of quorum\n2. Approval of the 2026 minutes\n3. President's report and 2026 audited financials\n4. 2027 budget and dues\n5. Election of three (3) board members\n6. Other matters\n\nCan't attend? Submit a proxy form from the Documents page by [ADD: proxy deadline]. Only owners in good standing may vote.",
    bodyTl: "Gaganapin po ang Annual General Assembly ng Skyland Plaza Condominium Corporation sa Sabado, January 24, 2027, 2:00 PM, sa 5th floor function room.\n\nAgenda\n1. Call to order at quorum\n2. Approval ng 2026 minutes\n3. President's report at 2026 audited financials\n4. 2027 budget at dues\n5. Election ng tatlong (3) board members\n6. Iba pang usapin\n\nHindi makakadalo? Mag-submit ng proxy form mula sa Documents page bago ang [ADD: proxy deadline]. Ang mga owner na updated sa dues lang ang pwedeng bumoto.",
    smsEn: "Skyland AGA: Sat, Jan 24, 2027, 2 PM, 5F function room. Proxy forms in the owner portal. Details by email.", smsTl: "Skyland AGA: Sab, Jan 24, 2027, 2 PM, 5F function room. Proxy forms nasa owner portal. Details sa email." } });
  await prisma.announcement.create({ data: { kind: "ROUTINE", category: "Event", title: "Kids' Christmas party, Dec 14", createdBy: manager.name, approvedBy: manager.name, status: "SCHEDULED", scheduledAt: at(5, 9), audience: "ALL", channels: ["APP", "EMAIL", "MESSENGER"], aiDrafted: true,
    bodyEn: "Our Kids' Christmas party is on Sunday, Dec 14, 3 PM to 6 PM at the function room. Games, a magic show and loot bags for kids 12 and under. Free for residents. Please register your kids at the admin office by Dec 10.",
    bodyTl: "Ang Kids' Christmas party ay sa Linggo, Dec 14, 3 PM hanggang 6 PM sa function room. May games, magic show at loot bags para sa mga batang 12 pababa. Libre para sa residents. Paki-register po ang mga bata sa admin office bago mag-Dec 10." } });

  console.log("Creating resident pulses and helpdesk history…");
  const C: Record<string, [number, string][]> = {
    Repairs: [[5, "Aircon fixed the same day. Ang bilis!"], [5, "Technician was polite and cleaned up after."], [4, "Leak fixed, took two visits though."], [2, "Still waiting for my bathroom exhaust fan. Third follow-up na."], [5, "Love that I can report problems in chat at 11 PM."]],
    Elevators: [[2, "Elevator 2 down again during rush hour. Hassle for seniors."], [3, "Long wait for elevators 7-9 AM."], [4, "Elevators better since the maintenance last month."], [1, "Stuck in Elevator 3 (Tower B) for 10 minutes. Scary."]],
    Cleanliness: [[5, "Lobby and hallways are spotless lately."], [4, "Garbage room much better now."], [2, "Hallway on 23F smells, basura not collected on time."], [5, "Malinis na ang pool area, salamat!"]],
    Security: [[5, "Visitor passes are great, guards don't call me anymore."], [4, "Guards are friendly and alert."], [3, "Delivery riders sometimes go straight up without checking."]],
    Water: [[2, "Low water pressure in the morning on high floors."], [4, "Thanks for the advance notice on the water interruption."], [3, "Water was off longer than announced."]],
    Communication: [[5, "Updates by SMS in Taglish are so helpful, kahit si Lola naiintindihan."], [5, "Finally I know what's happening in the building."], [4, "Newsletter is nice, short and clear."], [3, "Too many emails some weeks."]],
    Amenities: [[5, "Booking the function room online took one minute."], [4, "Gym is good, needs one more treadmill."], [3, "Pool closed too often for maintenance."], [2, "Karaoke room noise until late on weekends."]],
    Noise: [[2, "Renovation noise next door even on Sunday."], [3, "Neighbors' videoke until 11 PM."]],
    Staff: [[5, "Admin office very accommodating, ang bait ni Ate sa front desk."], [4, "Manager replies quickly now."], [2, "Admin did not return my call about parking."]],
    Dues: [[5, "Paying dues by GCash in the app is so easy."], [4, "Clear statement, I know where our money goes."], [3, "Wish there was a discount for paying early."]],
  };
  const topics = Object.keys(C);
  const pulses: any[] = [];
  const reg = owners.filter((o) => o.id !== owner.id && o.units[0]);
  for (let m = 5; m >= 0; m--) {
    const mean = 3.45 + (5 - m) * 0.19; // trend up: ~61 → ~84
    const count = 60 + (5 - m) * 9;
    for (let i = 0; i < count; i++) {
      const o = pick(reg);
      let score = Math.max(1, Math.min(5, Math.round(mean + (rnd() + rnd() + rnd() - 1.5) * 1.6)));
      let comment: string | null = null, topic: string | null = null;
      if (rnd() < 0.45) {
        topic = pick(topics);
        const opts = C[topic].filter(([s]) => s === score);
        if (opts.length) { const [s2, t] = pick(opts); comment = t; score = s2; } else topic = null;
      }
      const daysAgo = m * 30 + Math.floor(rnd() * 28) + 1;
      const createdAt = new Date(NOW.getTime() - daysAgo * DAY + Math.floor(rnd() * 10) * 3600000);
      const late = daysAgo < 40 && score <= 2;
      pulses.push({ userId: o.id, unitCode: o.units[0].code, kind: rnd() < 0.3 ? "TICKET" : "MONTHLY", score, comment, topic, sentiment: score >= 4 ? "POSITIVE" : score === 3 ? "NEUTRAL" : "NEGATIVE", createdAt,
        workOrder: null, followedUp: late && daysAgo > 6 ? new Date(createdAt.getTime() + 5 * 3600000) : score <= 2 ? createdAt : null, followNote: late && daysAgo > 6 ? "We called and scheduled a fix. Thank you for flagging it." : score <= 2 ? "Followed up by phone." : null });
    }
  }
  // three fresh unhappy ratings still waiting for a call
  const fresh: [string, number, string, string][] = [["Elevators", 1, "Stuck in Elevator 3 (Tower B) for 10 minutes. Scary.", "2026-11-20T19:10:00+08:00"], ["Repairs", 2, "Still waiting for my bathroom exhaust fan. Third follow-up na.", "2026-11-21T08:40:00+08:00"], ["Noise", 2, "Renovation noise next door even on Sunday.", "2026-11-19T16:05:00+08:00"]];
  for (const [topic, score, comment, when] of fresh) { const o = pick(reg); pulses.push({ userId: o.id, unitCode: o.units[0].code, kind: "MONTHLY", score, comment, topic, sentiment: "NEGATIVE", createdAt: new Date(when) }); }
  await prisma.pulse.createMany({ data: pulses });
  // helpdesk chat history (AI answers questions 24/7)
  const QA: [string, string][] = [["Anong oras bukas ang pool?", "Bukas po ang pool 6 AM hanggang 9 PM, sarado tuwing Lunes. Pwede kayong mag-book sa Book an amenity."], ["How much are my dues this month?", "Your November dues are ₱4,410, due Nov 30. You can pay with GCash, Maya or card under Dues & statements."], ["May tulo sa kisame ng banyo ko", "Pasensya na po! Nag-file na ako ng ticket at may technician na pupunta ngayong araw. Makakatanggap kayo ng update sa SMS."], ["Can I have a sofa delivered Saturday?", "Yes! Create a delivery pass under Guest & delivery passes and send the code to the courier. Deliveries are allowed 8 AM to 6 PM."]];
  const chats: any[] = [];
  for (let i = 0; i < 320; i++) { const o = pick(reg); const [q, a] = pick(QA); const t = new Date(NOW.getTime() - Math.floor(rnd() * 29 * DAY)); chats.push({ userId: o.id, role: "user", content: q, createdAt: t }, { userId: o.id, role: "assistant", content: a, createdAt: new Date(t.getTime() + 2000) }); }
  await prisma.chatMessage.createMany({ data: chats });

  const ago = (h: number) => new Date(NOW.getTime() - h * 3600000);
  const someone = () => pick(reg);
  await prisma.auditLog.createMany({ data: [
    { userId: someone().id, action: "payment", detail: "Unit 18C paid ₱3,724 via GCash", createdAt: ago(0.4) },
    { userId: manager.id, action: "resident follow-up", detail: "Unit 27F: technician scheduled tomorrow 9 AM, no charge", createdAt: ago(1.2) },
    { userId: someone().id, action: "work_order", detail: "WO filed by AI helpdesk: water dripping from aircon, Unit 9A", createdAt: ago(2) },
    { userId: someone().id, action: "booking", detail: "Unit 31B booked Function room, Sat 4 PM", createdAt: ago(3.5) },
    { userId: manager.id, action: "announcement sent", detail: "Pool closed Dec 2 to 4 → 141 owners", createdAt: ago(20) },
    { userId: someone().id, action: "payment", detail: "Unit 6K paid ₱8,330 via Maya", createdAt: ago(22) },
  ] });

  console.log("Creating amenities, bookings and passes…");
  const AM = [
    { name: "Swimming pool", detail: "Lap pool and kiddie pool, podium deck (5th level)", capacity: 30, fee: 0, openHour: 6, closeHour: 21, slotHours: 2, closedDow: 1, rules: "Proper swimwear. Kids under 12 with an adult." },
    { name: "Function room", detail: "Air-conditioned, 60 seats, pantry, sound system", capacity: 60, fee: 3500, openHour: 9, closeHour: 22, slotHours: 4, closedDow: null, rules: "Book 3 days ahead. Clean-up by 10 PM." },
    { name: "Gym", detail: "Cardio and free weights, 5th floor", capacity: 12, fee: 0, openHour: 5, closeHour: 23, slotHours: 1, closedDow: null, rules: "Wipe equipment after use." },
    { name: "Basketball court", detail: "Half court, roof deck", capacity: 14, fee: 300, openHour: 6, closeHour: 21, slotHours: 2, closedDow: null, rules: "Rubber shoes only." },
    { name: "Roof deck grill area", detail: "Two grill stations, 20 seats, city view", capacity: 20, fee: 1500, openHour: 16, closeHour: 22, slotHours: 3, closedDow: null, rules: "Charcoal provided by the admin office only." },
    { name: "Karaoke room", detail: "Soundproof, 10 seats, 5th floor", capacity: 10, fee: 500, openHour: 10, closeHour: 22, slotHours: 2, closedDow: null, rules: "Until 10 PM only, please." },
  ];
  const amen = [];
  for (const a of AM) amen.push(await prisma.amenity.create({ data: a }));
  const someOwners = owners.filter((o) => o.units[0]);
  const bookings: any[] = [];
  for (let i = 0; i < 26; i++) {
    const a = pick(amen); const o = i < 2 ? owners.find((x) => x.id === owner.id)! : pick(someOwners);
    const day = Math.floor(rnd() * 8) - (i % 7 === 0 ? 3 : 0);
    const slots = Math.floor((a.closeHour - a.openHour) / a.slotHours);
    const start = at(day, a.openHour + Math.floor(rnd() * slots) * a.slotHours);
    if (bookings.some((b) => b.amenityId === a.id && +b.start === +start)) continue;
    bookings.push({ amenityId: a.id, unitId: o.units[0].id, userId: o.id, start, end: new Date(start.getTime() + a.slotHours * 3600000), guests: Math.min(a.capacity - 1, Math.floor(rnd() * 8)) });
  }
  await prisma.amenityBooking.createMany({ data: bookings });
  const passes: any[] = []; const CODES = new Set<string>();
  const code = () => { let c; do c = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rnd() * 32)]).join(""); while (CODES.has(c)); CODES.add(c); return c; };
  const ana = owners.find((x) => x.id === owner.id)!;
  passes.push({ code: "K7Q2MX", kind: "GUEST", name: "Tita Lorna Reyes", unitId: ana.units[0].id, userId: ana.id, validFrom: at(0, 0), validTo: new Date(at(1, 0).getTime() - 1), note: "Visiting for dinner" });
  passes.push({ code: "LZ4DRV", kind: "DELIVERY", name: "Lalamove (furniture)", unitId: ana.units[0].id, userId: ana.id, validFrom: at(1, 0), validTo: new Date(at(2, 0).getTime() - 1), plate: "NBC 4821" });
  const names = ["Grab Food", "Lalamove", "J&T Express", "Shopee Xpress", "Mr. & Mrs. Lim", "Aircon tech (CoolCare)", "Carlo Mendoza", "LBC", "Yumi Tan", "Movers: Lipat Express"];
  for (let i = 0; i < 12; i++) {
    const o = pick(someOwners); const n = pick(names);
    const kind = /Grab|Lalamove|J&T|Shopee|LBC/.test(n) ? "DELIVERY" : /tech|Movers/.test(n) ? (n.startsWith("Movers") ? "MOVE" : "CONTRACTOR") : "GUEST";
    const day = i < 8 ? 0 : -1; const checked = i % 3 !== 0 || day < 0;
    passes.push({ code: code(), kind, name: n, unitId: o.units[0].id, userId: o.id, validFrom: at(day, 0), validTo: new Date(at(day + 1, 0).getTime() - 1), checkedIn: checked ? at(day, 9 + i) : null, checkedOut: checked && i % 2 === 0 ? at(day, 10 + i) : null });
  }
  await prisma.pass.createMany({ data: passes });

  console.log("Creating documents, polls, vendors and maintenance…");
  const DOCS: [string, string, string, string[]][] = [
    ["House Rules and Regulations (2025 edition)", "Governance", "OWNERS", ["1. Quiet hours are 10 PM to 7 AM.", "2. Renovations: Mon-Sat, 8 AM-5 PM, with an approved work permit.", "3. Pets must be leashed in common areas.", "4. Move-ins need a 3-day advance gate pass."]],
    ["October 2026 Financial Statement", "Financial", "OWNERS", ["Dues billed: PHP 1,763,412", "Collected on time: 91.7%", "Operating expenses: PHP 1,551,300 (+3.1% vs budget)", "Sinking fund balance: PHP 8,240,000"]],
    ["Minutes of the Board Meeting, October 18, 2026", "Minutes", "OWNERS", ["Present: 5 of 7 directors. Quorum declared.", "Approved: elevator modernization study.", "Approved: online amenity booking and visitor passes."]],
    ["2027 Proposed Budget (draft)", "Financial", "BOARD", ["Draft for board review only.", "Proposed dues: PHP 105/sqm (+7.1%).", "Drivers: power rates, security contract renewal, sinking fund."]],
    ["Security Agency Contract 2026-2027", "Contracts", "BOARD", ["Agency: Guardian Shield Security", "Term: Jan 1, 2026 to Dec 31, 2026", "Monthly: PHP 362,000 for 14 guards"]],
    ["Proxy Form, Annual General Assembly 2027", "Forms", "OWNERS", ["I, ____________, owner of Unit ____, appoint ____________", "as my proxy at the AGA on January 24, 2027.", "Signature: ____________  Date: ________"]],
    ["Renovation Work Permit Application", "Forms", "OWNERS", ["Unit: ____  Owner: ____________", "Contractor: ____________  Workers: ____", "Scope of work: ____________", "Start / end dates: ________"]],
    ["Fire Safety Inspection Certificate 2026", "Notices", "OWNERS", ["Issued by the Bureau of Fire Protection.", "Valid until December 31, 2026."]],
  ];
  for (const [i, [title, category, visibility, lines]] of DOCS.entries()) {
    const data = pdf(title, lines);
    await prisma.document.create({ data: { title, category, visibility, fileName: title.replace(/[^\w]+/g, "-").toLowerCase() + ".pdf", mime: "application/pdf", size: data.length, data, uploadedBy: manager.name, createdAt: at(-4 - i * 6) } });
  }

  const unitsNow = await prisma.unit.findMany({ include: { owner: true } });
  const withOwner = unitsNow.filter((u) => u.ownerId);
  const poll = async (q: string, detail: string, kind: string, closes: number, opts: [string, number][], turnout: number) => {
    const p = await prisma.poll.create({ data: { question: q, detail, kind, closesAt: at(closes, 23), createdBy: "Board President", createdAt: at(closes - 14), options: { create: opts.map(([label]) => ({ label })) } }, include: { options: true } });
    const voters = withOwner.filter((u) => u.code !== "1202B").sort(() => rnd() - 0.5).slice(0, Math.round(withOwner.length * turnout));
    const total = opts.reduce((s, [, w]) => s + w, 0);
    await prisma.vote.createMany({ data: voters.map((u) => { let r = rnd() * total, idx = 0; while (r > opts[idx][1]) { r -= opts[idx][1]; idx++; } return { pollId: p.id, optionId: p.options[idx].id, unitId: u.id, userId: u.ownerId!, weight: kind === "RESOLUTION" ? u.sqm : 1, createdAt: at(closes - 10 + Math.floor(rnd() * 9)) }; }) });
  };
  await poll("Approve the elevator modernization study (₱180,000 from the sinking fund)?", "A licensed engineer will assess all 4 elevators and recommend a 3-year modernization plan. Weighted by floor area per the master deed.", "RESOLUTION", 9, [["Approve", 72], ["Reject", 18], ["Abstain", 10]], 0.78);
  await poll("Which pool hours work best for your household?", "Help us set the 2027 pool schedule.", "POLL", 5, [["6 AM to 9 PM (current)", 46], ["6 AM to 10 PM", 38], ["7 AM to 8 PM", 16]], 0.55);
  await poll("Should we allow Airbnb-style short stays?", "Advisory poll ahead of the AGA. Not binding.", "POLL", -12, [["No", 61], ["Yes, with a 30-day minimum", 27], ["Yes", 12]], 0.71);

  await prisma.vendor.createMany({ data: [
    { name: "Guardian Shield Security", service: "Security (14 guards)", contact: "Ret. Col. B. Ramos", phone: "+63 2 8555 0141", monthlyValue: 362000, contractStart: at(-325), contractEnd: at(40), insuranceExpiry: at(120), rating: 4.3, notes: "Renewal proposal requested" },
    { name: "CleanPro Facility Services", service: "Janitorial (12 staff)", contact: "Liza Ong", phone: "+63 917 555 0177", monthlyValue: 214500, contractStart: at(-200), contractEnd: at(165), insuranceExpiry: at(22), rating: 4.5 },
    { name: "LiftCare Elevators", service: "Elevator maintenance (4 cars)", contact: "Engr. D. Uy", phone: "+63 2 8555 0190", monthlyValue: 98000, contractStart: at(-500), contractEnd: at(230), insuranceExpiry: at(230), rating: 4.0 },
    { name: "GreenShield Pest Control", service: "Pest control & landscaping", contact: "Mon Garcia", phone: "+63 918 555 0123", monthlyValue: 17200, contractStart: at(-90), contractEnd: at(275), insuranceExpiry: at(-5), rating: 4.6, notes: "Insurance certificate overdue" },
    { name: "AquaSafe Water Systems", service: "Water tank cleaning & treatment", contact: "Rey Santos", phone: "+63 919 555 0156", monthlyValue: 14800, contractStart: at(-150), contractEnd: at(215), insuranceExpiry: at(215), rating: 4.2 },
    { name: "PowerGen Services", service: "Genset & electrical PMS", contact: "Engr. A. Lim", phone: "+63 917 555 0199", monthlyValue: 26500, contractStart: at(-40), contractEnd: at(325), insuranceExpiry: at(325), rating: 4.4 },
    { name: "FireTech Philippines", service: "Fire protection systems", contact: "Ana Cruz", phone: "+63 2 8555 0133", monthlyValue: 12000, contractStart: at(-300), contractEnd: at(55), insuranceExpiry: at(140), rating: 4.1 },
  ] });
  await prisma.pMTask.createMany({ data: [
    { asset: "Fire pump", task: "Weekly churn test", frequencyDays: 7, lastDone: at(-6), nextDue: at(1), assignee: "Rudy M.", compliance: true },
    { asset: "Genset", task: "No-load run and battery check", frequencyDays: 7, lastDone: at(-8), nextDue: at(-1), vendor: "PowerGen Services" },
    { asset: "Elevators 1-4 (2 per tower)", task: "Monthly preventive maintenance", frequencyDays: 30, lastDone: at(-26), nextDue: at(4), vendor: "LiftCare Elevators" },
    { asset: "Water tanks", task: "Cleaning and disinfection", frequencyDays: 180, lastDone: at(-172), nextDue: at(8), vendor: "AquaSafe Water Systems", compliance: true },
    { asset: "Fire alarm & sprinklers", task: "Quarterly inspection", frequencyDays: 90, lastDone: at(-60), nextDue: at(30), vendor: "FireTech Philippines", compliance: true },
    { asset: "Fire extinguishers", task: "Monthly pressure check", frequencyDays: 30, lastDone: at(-18), nextDue: at(12), assignee: "Jun P.", compliance: true },
    { asset: "Aircon (common areas)", task: "Filter cleaning", frequencyDays: 30, lastDone: at(-24), nextDue: at(6), assignee: "Jun P." },
    { asset: "Pest control", task: "Common-area treatment", frequencyDays: 30, lastDone: at(-15), nextDue: at(15), vendor: "GreenShield Pest Control" },
    { asset: "Transformer", task: "Thermal scan and oil test", frequencyDays: 365, lastDone: at(-350), nextDue: at(15), vendor: "PowerGen Services" },
    { asset: "Roof deck", task: "Drain and waterproofing check", frequencyDays: 90, lastDone: at(-95), nextDue: at(-5), assignee: "Rudy M." },
    { asset: "Elevators 1-4 (2 per tower)", task: "Annual DOLE load test and permit", frequencyDays: 365, lastDone: at(-340), nextDue: at(25), vendor: "LiftCare Elevators", compliance: true },
    { asset: "CCTV", task: "Camera and recorder check", frequencyDays: 30, lastDone: at(-10), nextDue: at(20), assignee: "Security" },
  ] });
}
