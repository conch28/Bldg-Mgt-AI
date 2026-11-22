/**
 * Data-entry accountability. Every record the building runs on has one owner (who enters it),
 * a deadline, a checker, and an escalation path. DUTIES is the single source of truth: the
 * Accountability page prints it as the matrix, openTasks() turns it into "My tasks due", and
 * runDutyNudges() reminds the doer, then their supervisor, then the board.
 *
 * Deadlines are the "Standard" set agreed with the client. Change them here, not in pages.
 */
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { nowManila, monthLong, addMonths, currentPeriod, fmtDateTime } from "./format";
import { approvalsOf, approvalProgress } from "./procurement";
import { notifyUser } from "./comms";

const H = 3600000, D = 24 * H;
export type Owner = Role | "TECH" | "RESIDENT" | "AI";
export const OWNER_LABEL: Record<Owner, string> = {
  OWNER: "Owner / resident", RESIDENT: "Resident", BOARD: "Board", MANAGER: "Property manager", ADMIN: "Operations head (Building Mgt AI)",
  GUARD: "Guard / front desk", TECH: "Technician or vendor", AI: "AI assistant", INVESTOR: "Investor (view only)", LANDLORD: "Building owner (view only)",
};
/** Who is told when the owner of a step is late: level 2 goes to the supervisor, level 3 to the board. */
export const SUPERVISOR: Partial<Record<Owner, Role>> = { GUARD: "MANAGER", TECH: "MANAGER", MANAGER: "ADMIN", ADMIN: "BOARD", BOARD: "BOARD" };

export type Duty = {
  id: string; area: string; record: string; owner: Owner[]; how: string; deadline: string;
  checker: string; escalate: string; gate?: string; tracked: boolean; // tracked = the app measures it and reminds people
  esc?: [number, number]; // hours past the deadline before the supervisor, then the board, are told
};

export const DUTIES: Duty[] = [
  // Resident requests
  { id: "ticket-log", area: "Resident requests", record: "Complaint or repair request", owner: ["RESIDENT", "AI", "GUARD", "MANAGER"], tracked: false,
    how: "Resident: app (Report a problem, photo optional) or Messenger/Viber chat, which the AI turns into a ticket. Walk-ins and calls: front desk or manager taps Log a complaint.",
    deadline: "Within 15 minutes of the call or walk-in", checker: "Manager (daily review of new tickets)", escalate: "Untagged chats are flagged in Messenger & Viber" },
  { id: "wo-ack", area: "Resident requests", record: "Acknowledge and assign the ticket", owner: ["MANAGER"], tracked: true, esc: [2, 24],
    how: "Work orders: set status to Assigned and pick the technician. One tap; the resident is told automatically.",
    deadline: "1 hour (7 AM to 7 PM), 4 hours at night", checker: "Operations head", escalate: "Reminder, then operations head after 2h, then board after 24h" },
  { id: "wo-fix", area: "Resident requests", record: "Repair done, with after photo", owner: ["TECH"], tracked: true, esc: [0, 48],
    how: "Technician opens the job link sent by SMS/Viber (no login), taps I'm on it, then Done with a photo of the finished work and a short note (or voice-typing).",
    deadline: "4h high, 24h medium, 72h low priority (from when the ticket was opened)", checker: "Manager verifies", escalate: "Manager at the deadline, board after 48h",
    gate: "A ticket cannot be closed without an after photo" },
  { id: "wo-verify", area: "Resident requests", record: "Verify the repair", owner: ["MANAGER"], tracked: true, esc: [24, 72],
    how: "Work orders: look at the after photo (or the unit), tap Verify. The resident then gets the 1-tap rating.",
    deadline: "Within 24 hours of completion", checker: "Resident rating; operations head", escalate: "Operations head after 24h, board after 72h",
    gate: "Vendor invoices tied to the ticket cannot be paid until it is verified" },
  { id: "pulse-follow", area: "Resident requests", record: "Call back an unhappy resident (rating 1-2)", owner: ["MANAGER"], tracked: true, esc: [24, 72],
    how: "Resident happiness: call or message, then log what was done in one line.",
    deadline: "Within 24 hours", checker: "Board (happiness page)", escalate: "Operations head after 24h, board after 72h" },

  // Money
  { id: "pr-raise", area: "Money", record: "Purchase request with quotes", owner: ["MANAGER"], tracked: false,
    how: "Procurement: what, why, quantity, and quotes (1 up to ₱10k, 3 above). Snap a photo of each quote.",
    deadline: "Before anything is bought (except declared emergencies, filed within 24h)", checker: "Approvers per limit", escalate: "Unrequested spend is a red flag on the board page",
    gate: "No purchase order without an approved request" },
  { id: "pr-approve", area: "Money", record: "Approve or reject the purchase", owner: ["MANAGER", "BOARD"], tracked: true, esc: [48, 96],
    how: "Procurement: compare quotes, tap Approve or Reject with a reason. Never your own request.",
    deadline: "Within 48 hours of submission", checker: "Board treasurer", escalate: "Reminder, then operations head after 48h, then all board after 96h" },
  { id: "pr-receive", area: "Money", record: "Delivery received", owner: ["GUARD", "MANAGER"], tracked: false,
    how: "Receive deliveries: count, photo of goods and delivery receipt, confirm. Someone other than the requester or approvers.",
    deadline: "When the delivery arrives (same shift)", checker: "Manager", escalate: "Short deliveries alert the requester at once",
    gate: "Stock is only added when received with a photo" },
  { id: "pr-receipt", area: "Money", record: "Official receipt and payment", owner: ["MANAGER", "ADMIN"], tracked: true, esc: [24, 72],
    how: "Procurement: photo of the official receipt or sales invoice, amount, then Release payment (by someone other than the requester).",
    deadline: "Receipt within 24 hours of delivery; payment on the vendor's terms", checker: "Board treasurer (monthly)", escalate: "Operations head after 24h, board after 72h",
    gate: "No receipt, no payment. Payment above the PO amount is blocked." },
  { id: "petty-cash", area: "Money", record: "Petty cash liquidation", owner: ["MANAGER"], tracked: false,
    how: "Photo of each receipt in Procurement (category Petty cash). Fund is replenished only against liquidated receipts.",
    deadline: "Within 48 hours of spending", checker: "Board treasurer", escalate: "Fund frozen until liquidated", gate: "No replenishment without receipts" },
  { id: "bank-recon", area: "Money", record: "Bank reconciliation and collections report", owner: ["ADMIN"], tracked: false,
    how: "Online payments post automatically. Cash/check payments are recorded the same day; the bank statement is uploaded to Documents and matched.",
    deadline: "Same day for cash/check; reconciliation by the 10th", checker: "Board treasurer", escalate: "Board at the next meeting" },

  // Daily operations
  { id: "round", area: "Daily operations", record: "Guard round and meter readings", owner: ["GUARD"], tracked: true, esc: [2, 24],
    how: "Guard rounds: walk the 13 stops, tap OK or a problem (photo), type the 4 meter readings, submit.",
    deadline: "By the end of each shift (6 AM and 6 PM)", checker: "Manager (next morning)", escalate: "Manager after 2h, board after 24h" },
  { id: "incident", area: "Daily operations", record: "Incident report (injury, theft, damage, SOS)", owner: ["GUARD"], tracked: false,
    how: "SOS alerts / Front desk: what, where, who, photo. The AI drafts the formal report for the manager to sign.",
    deadline: "Logged within 1 hour; formal report within 24 hours", checker: "Manager", escalate: "Board president for serious incidents, at once" },
  { id: "visitor", area: "Daily operations", record: "Visitors, deliveries, move-ins and outs", owner: ["GUARD"], tracked: false,
    how: "Front desk: scan the QR pass or log the visitor; moves are checked against the approved move request.",
    deadline: "At the gate, in real time", checker: "Manager", escalate: "Unlisted moves are stopped at the gate" },
  { id: "pm", area: "Daily operations", record: "Preventive maintenance done", owner: ["MANAGER", "TECH"], tracked: true, esc: [24, 72],
    how: "The PM calendar opens the ticket automatically; the technician closes it with a photo like any repair.",
    deadline: "On the scheduled date (compliance items: no slippage)", checker: "Manager; board for compliance items", escalate: "Operations head after 24h, board after 72h" },

  // Governance and reporting
  { id: "report", area: "Reports and records", record: "Monthly board report", owner: ["MANAGER"], tracked: true, esc: [48, 120],
    how: "Reports: tap Draft report. The AI writes it from the month's data; the manager reviews and publishes.",
    deadline: "By the 5th of the next month", checker: "Board", escalate: "Operations head after 2 days, board after 5 days" },
  { id: "minutes", area: "Reports and records", record: "Board meeting minutes", owner: ["MANAGER"], tracked: true, esc: [48, 120],
    how: "Board meetings: type or dictate notes during the meeting; the AI drafts the minutes for the secretary to approve.",
    deadline: "Within 7 days of the meeting", checker: "Board secretary", escalate: "Operations head, then board president" },
  { id: "vendor-docs", area: "Reports and records", record: "Vendor contract and insurance renewal", owner: ["ADMIN"], tracked: true, esc: [0, 168],
    how: "Vendors & contracts: update the dates and upload the new certificate to Documents.",
    deadline: "Before the old one expires (reminders from 30 days before)", checker: "Board", escalate: "Board after 7 days",
    gate: "A vendor without valid insurance is flagged and should not be scheduled" },
  { id: "docs", area: "Reports and records", record: "Signed contracts, permits, certificates", owner: ["ADMIN", "MANAGER"], tracked: false,
    how: "Documents: upload the PDF or a photo, pick the category. Permits (fire safety, elevator, sanitary) go in Compliance.",
    deadline: "Within 3 days of signing or issue", checker: "Board", escalate: "Missing permits show on the go-live checklist" },
  { id: "spot-audit", area: "Reports and records", record: "Weekly spot check of finished work", owner: ["MANAGER"], tracked: true, esc: [24, 72],
    how: "Staff data scores, Spot checks: the app picks a random sample each Monday (10% of finished jobs, 2 guard rounds, 1 receipt). Go and look, then tap Passed or Found a problem.",
    deadline: "By Sunday of the same week", checker: "Board (results on Staff data scores)", escalate: "Operations head after 24h, board after 72h",
    gate: "The app picks the sample, so no one chooses which work gets checked" },
  { id: "flag-review", area: "Reports and records", record: "Review an entry flag (reused photo, copied note, batched entries)", owner: ["MANAGER", "ADMIN"], tracked: true, esc: [24, 96],
    how: "Staff data scores, Entry flags: open the entries, hear the staff member's side, then tap Looks fine or Confirm and coach. Flags about the manager go to the operations head.",
    deadline: "Within 48 hours of the flag", checker: "Operations head", escalate: "Operations head after 24h, board after 4 days",
    gate: "Only confirmed flags lower a score; open flags never count against anyone" },
  { id: "master-data", area: "Reports and records", record: "Owner, tenant and unit details", owner: ["OWNER", "ADMIN"], tracked: false,
    how: "Owners update their own contact details in Account; tenants are recorded through the lease/move-in flow; admin imports the initial list from CSV.",
    deadline: "Before move-in; owners confirm details every 12 months", checker: "Admin", escalate: "Units with no contact number appear in Admin" },
];
export const dutyById = (id: string) => DUTIES.find((d) => d.id === id)!;

export type Task = {
  key: string; duty: string; title: string; detail: string; href: string;
  owner: Owner; who?: string; // who: a named person (technician, requester) when known
  dueAt: Date; level: 0 | 1 | 2 | 3; // 0 due soon, 1 overdue, 2 supervisor told, 3 board told
};

/* ---------- Manila time helpers (UTC+8, no daylight saving) ---------- */
const mnl = (d: Date) => new Date(d.getTime() + 8 * H);
const manilaHour = (d: Date) => mnl(d).getUTCHours();
/** The given Manila wall-clock time on the Manila day of `d`. */
const atManila = (d: Date, hour: number) => { const m = mnl(d); return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), hour) - 8 * H); };

/** Acknowledgement window: 1 hour from 7 AM to 7 PM Manila, 4 hours at night. */
export const ackHours = (created: Date) => { const h = manilaHour(created); return h >= 7 && h < 19 ? 1 : 4; };
export const ackDue = (created: Date) => new Date(created.getTime() + ackHours(created) * H);

function levelFor(dutyId: string, dueAt: Date, now: Date): Task["level"] {
  if (now < dueAt) return 0;
  const [sup, board] = dutyById(dutyId).esc ?? [24, 72];
  const late = (now.getTime() - dueAt.getTime()) / H;
  return late >= board ? 3 : late >= sup ? 2 : 1;
}

/** Only recent records count, so history from before go-live does not flood the lists. */
const WINDOW_DAYS = 21;

/** Everything due or overdue right now, across the building. */
export async function allTasks(now = nowManila()): Promise<Task[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * D);
  const soon = new Date(now.getTime() + 2 * H);
  const [wos, pulses, prs, rounds, pms, reports, meetings, vendors, audits, flags] = await Promise.all([
    prisma.workOrder.findMany({ where: { createdAt: { gte: since }, OR: [{ status: { not: "DONE" } }, { verifiedAt: null }] }, select: { id: true, number: true, title: true, location: true, status: true, priority: true, slaHours: true, assignee: true, createdAt: true, closedAt: true, ackAt: true, verifiedAt: true, category: true } }),
    prisma.pulse.findMany({ where: { score: { lte: 2 }, followedUp: null, createdAt: { gte: since } }, select: { id: true, unitCode: true, score: true, comment: true, createdAt: true } }),
    prisma.purchaseRequest.findMany({ where: { status: { in: ["PENDING", "RECEIVED"] } }, include: { quotes: true } }),
    prisma.guardRound.findMany({ where: { startedAt: { gte: new Date(now.getTime() - 2 * D) }, submittedAt: { not: null } }, select: { startedAt: true, shift: true } }),
    prisma.pMTask.findMany({ where: { nextDue: { lte: new Date(now.getTime() + 3 * D) } } }),
    prisma.report.findMany({ select: { period: true } }),
    prisma.meeting.findMany({ where: { startsAt: { gte: new Date(now.getTime() - 60 * D), lte: now }, minutes: null } }),
    prisma.vendor.findMany({ where: { active: true, OR: [{ insuranceExpiry: { lte: new Date(now.getTime() + 30 * D) } }, { contractEnd: { lte: new Date(now.getTime() + 30 * D) } }] } }),
    prisma.spotAudit.findMany({ where: { checkedAt: null, pickedAt: { gte: since } }, select: { id: true, label: true, person: true, dueAt: true } }),
    prisma.entryFlag.findMany({ where: { status: "OPEN", createdAt: { gte: since } }, select: { id: true, title: true, person: true, createdAt: true } }),
  ]);
  const t: Task[] = [];
  const push = (x: Omit<Task, "level">) => { if (x.dueAt <= soon || ["vendor-docs", "pm", "report", "round", "spot-audit", "flag-review"].includes(x.duty)) t.push({ ...x, level: levelFor(x.duty, x.dueAt, now) }); };

  for (const w of wos) {
    const ref = `WO-${w.number} ${w.title} (${w.location})`;
    if (!w.ackAt && w.status === "NEW") push({ key: `wo-ack:${w.number}`, duty: "wo-ack", title: `Acknowledge and assign ${ref}`, detail: `Opened ${fmtDateTime(w.createdAt)}`, href: `/work-orders?wo=${w.number}`, owner: "MANAGER", dueAt: ackDue(w.createdAt) });
    if (w.status !== "DONE" && w.status !== "NEW") push({ key: `wo-fix:${w.number}`, duty: "wo-fix", title: `Finish ${ref}`, detail: `${w.priority.toLowerCase()} priority · ${w.assignee ? `assigned to ${w.assignee}` : "no one assigned"}`, href: `/work-orders?wo=${w.number}`, owner: "TECH", who: w.assignee ?? undefined, dueAt: new Date(w.createdAt.getTime() + w.slaHours * H) });
    if (w.status === "DONE" && !w.verifiedAt && w.closedAt) push({ key: `wo-verify:${w.number}`, duty: "wo-verify", title: `Verify the repair on ${ref}`, detail: `Marked done ${fmtDateTime(w.closedAt)}`, href: `/work-orders?wo=${w.number}`, owner: "MANAGER", dueAt: new Date(w.closedAt.getTime() + 24 * H) });
  }
  for (const p of pulses) push({ key: `pulse:${p.id}`, duty: "pulse-follow", title: `Call back the resident in ${p.unitCode ?? "a unit"} (rated ${p.score}/5)`, detail: p.comment ? `“${p.comment.slice(0, 90)}”` : "No comment left", href: "/happiness", owner: "MANAGER", dueAt: new Date(p.createdAt.getTime() + 24 * H) });
  for (const pr of prs) {
    const q = pr.quotes.find((x) => x.id === pr.chosenQuote);
    if (pr.status === "PENDING") {
      const { rule, mgr } = approvalProgress(pr);
      const waitingOn: Owner = mgr < rule.manager ? "MANAGER" : "BOARD";
      push({ key: `pr-approve:${pr.number}`, duty: "pr-approve", title: `Approve or reject PR-${pr.number} ${pr.title}`, detail: `${q ? `${q.vendor}, ₱${Math.round(Number(q.total)).toLocaleString("en-PH")}` : ""} · ${approvalsOf(pr).length} of ${rule.manager + rule.board} signatures`, href: `/procurement?pr=${pr.number}`, owner: waitingOn, dueAt: new Date((pr.submittedAt ?? pr.createdAt).getTime() + 48 * H) });
    }
    if (pr.status === "RECEIVED" && !pr.receiptPic && pr.receivedAt) push({ key: `pr-receipt:${pr.number}`, duty: "pr-receipt", title: `Upload the official receipt for ${pr.poNumber ?? `PR-${pr.number}`} ${pr.title}`, detail: `Delivered ${fmtDateTime(pr.receivedAt)} · vendor can't be paid until then`, href: `/procurement?pr=${pr.number}`, owner: "MANAGER", who: pr.requester, dueAt: new Date(pr.receivedAt.getTime() + 24 * H) });
  }
  // Guard rounds: the shift that just ended must have a submitted round; the current one is due at its end.
  const shiftStart = (d: Date) => { const h = manilaHour(d); return h >= 6 && h < 18 ? atManila(d, 6) : h >= 18 ? atManila(d, 18) : new Date(atManila(d, 18).getTime() - D); };
  const cur = shiftStart(now), prev = new Date(cur.getTime() - 12 * H);
  for (const start of [prev, cur]) {
    const end = new Date(start.getTime() + 12 * H);
    const done = rounds.some((r) => r.startedAt >= new Date(start.getTime() - H) && r.startedAt < end);
    const shift = manilaHour(start) === 6 ? "day" : "night";
    if (!done) push({ key: `round:${start.toISOString()}`, duty: "round", title: `Submit the ${shift} shift round and meter readings`, detail: `${shift === "day" ? "6 AM to 6 PM" : "6 PM to 6 AM"} shift`, href: "/rounds", owner: "GUARD", dueAt: end });
  }
  for (const p of pms) push({ key: `pm:${p.id}:${p.nextDue.toISOString().slice(0, 10)}`, duty: "pm", title: `${p.compliance ? "Compliance: " : ""}${p.task} (${p.asset})`, detail: `${p.vendor ?? p.assignee ?? "No one assigned"}${p.lastWorkOrder ? ` · WO-${p.lastWorkOrder}` : ""}`, href: "/maintenance", owner: "MANAGER", who: p.vendor ?? p.assignee ?? undefined, dueAt: p.nextDue });
  // Monthly report for last month, due on the 5th (show from the 1st).
  const lastMonth = addMonths(currentPeriod(now), -1);
  if (!reports.some((r) => r.period === lastMonth)) {
    const [y, m] = currentPeriod(now).split("-").map(Number);
    push({ key: `report:${lastMonth}`, duty: "report", title: `Publish the ${monthLong(lastMonth)} board report`, detail: "The AI drafts it from the month's data; you review", href: "/reports", owner: "MANAGER", dueAt: new Date(Date.UTC(y, m - 1, 5, 23, 59) - 8 * H) });
  }
  for (const mt of meetings) push({ key: `minutes:${mt.id}`, duty: "minutes", title: `Finish the minutes of ${mt.title}`, detail: `Held ${fmtDateTime(mt.startsAt)}`, href: "/meetings", owner: "MANAGER", dueAt: new Date(mt.startsAt.getTime() + 7 * D) });
  for (const v of vendors) {
    const dates = [v.insuranceExpiry && { what: "insurance", d: v.insuranceExpiry }, v.contractEnd && { what: "contract", d: v.contractEnd }].filter(Boolean) as { what: string; d: Date }[];
    for (const x of dates.filter((x) => x.d.getTime() <= now.getTime() + 30 * D)) push({ key: `vendor:${v.id}:${x.what}:${x.d.toISOString().slice(0, 10)}`, duty: "vendor-docs", title: `Renew ${v.name} ${x.what}`, detail: `${x.d < now ? "Expired" : "Expires"} ${x.d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" })}`, href: "/vendors", owner: "ADMIN", dueAt: x.d });
  }
  for (const a of audits) push({ key: `spot-audit:${a.id}`, duty: "spot-audit", title: `Spot check: ${a.label}`, detail: `Entered by ${a.person} · picked at random by the app`, href: "/integrity?tab=audits", owner: "MANAGER", dueAt: a.dueAt });
  // Flags about a manager are reviewed by the operations head, never by the manager themselves.
  const mgrNames = new Set((await prisma.user.findMany({ where: { role: "MANAGER" }, select: { name: true } })).map((m) => m.name));
  for (const f of flags) push({ key: `flag:${f.id}`, duty: "flag-review", title: `Review flag: ${f.title}`, detail: `About ${f.person}`, href: "/integrity?tab=flags", owner: f.person.split(" and ").some((n) => mgrNames.has(n)) ? "ADMIN" : "MANAGER", dueAt: new Date(f.createdAt.getTime() + 48 * H) });
  // Upcoming items further than 2 days out are noise; keep due-soon and overdue ones.
  return t.filter((x) => x.dueAt.getTime() <= now.getTime() + 7 * D).sort((a, b) => b.level - a.level || a.dueAt.getTime() - b.dueAt.getTime());
}

/** The list a person sees: what they own, plus what has been escalated to them. */
export function tasksFor(all: Task[], role: Role): Task[] {
  return all.filter((t) => {
    if (role === "ADMIN") return true; // operations head sees everything
    if (role === "MANAGER") return t.owner === "MANAGER" || t.owner === "TECH" || (t.owner === "GUARD" && t.level >= 2);
    if (role === "GUARD") return t.owner === "GUARD";
    if (role === "BOARD") return t.owner === "BOARD" || t.level >= 3;
    return false;
  });
}

export const LEVEL_LABEL = ["Due soon", "Overdue", "Supervisor told", "Board told"] as const;
export const LEVEL_CLS = ["t-mut", "t-warn", "t-bad", "t-bad"] as const;
export function dueLabel(t: Task, now = nowManila()) {
  const ms = t.dueAt.getTime() - now.getTime(), a = Math.abs(ms);
  const s = a < H ? `${Math.max(1, Math.round(a / 60000))} min` : a < 2 * D ? `${Math.round(a / H)}h` : `${Math.round(a / D)} days`;
  return ms >= 0 ? `due in ${s}` : `${s} late`;
}

/* ------------------------------------------------------------------ */
/* Reminders and escalation                                           */
/* ------------------------------------------------------------------ */

/**
 * Sends one digest per person for steps that became overdue or crossed an escalation level
 * since the last run. Safe to call often: each (task, level) is sent once.
 */
export async function runDutyNudges(now = nowManila()) {
  const all = (await allTasks(now)).filter((t) => t.level >= 1);
  if (!all.length) return { sent: 0, people: 0 };
  const sentBefore = await prisma.dutyNudge.findMany({ where: { key: { in: all.map((t) => t.key) } }, select: { key: true, level: true } });
  const done = new Set(sentBefore.map((s) => `${s.key}|${s.level}`));
  const staff = await prisma.user.findMany({ where: { active: true, role: { in: ["MANAGER", "ADMIN", "GUARD", "BOARD"] } }, select: { id: true, role: true } });
  const byRole = (r: Role) => staff.filter((s) => s.role === r).map((s) => s.id);
  const inbox = new Map<string, string[]>();
  const rows: { key: string; level: number; sentTo: string }[] = [];
  for (const t of all) {
    for (let lv = 1; lv <= t.level; lv++) {
      if (done.has(`${t.key}|${lv}`)) continue;
      // Level 1 goes to the doer (technicians have no account, so their manager chases them).
      const role: Role = lv === 1 ? (t.owner === "TECH" ? "MANAGER" : (t.owner as Role)) : lv === 2 ? (SUPERVISOR[t.owner] ?? "ADMIN") : "BOARD";
      const ids = byRole(role);
      const line = `${lv === 1 ? "Overdue" : lv === 2 ? "Escalated" : "Escalated to board"}: ${t.title}${t.who ? ` (${t.who})` : ""}, ${dueLabel(t, now)}`;
      for (const id of ids) inbox.set(id, [...(inbox.get(id) ?? []), line]);
      rows.push({ key: t.key, level: lv, sentTo: role });
    }
  }
  for (const [id, lines] of inbox) {
    const body = `${lines.length} record${lines.length > 1 ? "s" : ""} need${lines.length > 1 ? "" : "s"} entering:\n${lines.slice(0, 8).map((l) => "• " + l).join("\n")}${lines.length > 8 ? `\n…and ${lines.length - 8} more` : ""}\nOpen My tasks to fix them.`;
    const urgent = lines.some((l) => l.startsWith("Escalated"));
    await notifyUser(id, "Records overdue", body, urgent ? ["APP", "SMS"] : ["APP"]);
  }
  if (rows.length) await prisma.dutyNudge.createMany({ data: rows, skipDuplicates: true });
  return { sent: rows.length, people: inbox.size };
}

/* ------------------------------------------------------------------ */
/* Scores: on time and complete, per role, last 30 days               */
/* ------------------------------------------------------------------ */

export type Measure = { label: string; ok: number; of: number };
export type RoleScore = { owner: Owner; label: string; measures: Measure[]; pct: number | null };
const pctOf = (ms: Measure[]) => { const of = ms.reduce((s, m) => s + m.of, 0); return of ? Math.round((ms.reduce((s, m) => s + m.ok, 0) / of) * 100) : null; };

export async function roleScores(days = 30, now = nowManila()): Promise<RoleScore[]> {
  const since = new Date(now.getTime() - days * D);
  const [wos, pulses, prs, rounds, readings, reports] = await Promise.all([
    prisma.workOrder.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, ackAt: true, status: true, closedAt: true, slaHours: true, donePhoto: true, verifiedAt: true, verifiedBy: true, doneBy: true } }),
    prisma.pulse.findMany({ where: { score: { lte: 2 }, createdAt: { gte: since, lte: new Date(now.getTime() - 24 * H) } }, select: { createdAt: true, followedUp: true } }),
    prisma.purchaseRequest.findMany({ where: { createdAt: { gte: since } }, select: { status: true, submittedAt: true, createdAt: true, approvals: true, receivedAt: true, receiptPic: true, paidAt: true } }),
    prisma.guardRound.findMany({ where: { startedAt: { gte: since } }, select: { startedAt: true, submittedAt: true } }),
    prisma.meterReading.findMany({ where: { takenAt: { gte: since } }, select: { meter: true, takenAt: true } }),
    prisma.report.findMany({ select: { period: true, createdAt: true } }),
  ]);
  const past = (d: Date) => d.getTime() <= now.getTime();
  // Manager
  const ackable = wos.filter((w) => w.ackAt || past(ackDue(w.createdAt)));
  const ackOk = ackable.filter((w) => w.ackAt && w.ackAt <= ackDue(w.createdAt)).length;
  const done = wos.filter((w) => w.status === "DONE" && w.closedAt);
  const verifiable = done.filter((w) => w.verifiedAt || past(new Date(w.closedAt!.getTime() + 24 * H)));
  const verOk = verifiable.filter((w) => w.verifiedAt && w.verifiedAt.getTime() - w.closedAt!.getTime() <= 24 * H).length;
  const pulseOk = pulses.filter((p) => p.followedUp && p.followedUp.getTime() - p.createdAt.getTime() <= 24 * H).length;
  const received = prs.filter((p) => p.receivedAt && (p.receiptPic || past(new Date(p.receivedAt.getTime() + 24 * H))));
  const receiptOk = received.filter((p) => p.receiptPic).length;
  const months = [1, 2, 3].map((i) => addMonths(currentPeriod(now), -i)).filter((p) => { const [y, m] = addMonths(p, 1).split("-").map(Number); return past(new Date(Date.UTC(y, m - 1, 5, 23, 59) - 8 * H)); });
  const repOk = months.filter((p) => { const r = reports.find((x) => x.period === p); const [y, m] = addMonths(p, 1).split("-").map(Number); return r && r.createdAt.getTime() <= Date.UTC(y, m - 1, 5, 23, 59) - 8 * H; }).length;
  // Technicians
  const fixOk = done.filter((w) => w.closedAt!.getTime() - w.createdAt.getTime() <= w.slaHours * H).length;
  const photoOk = done.filter((w) => w.donePhoto).length;
  // Guards: 2 shifts a day; a round counts when submitted within 2 hours of its shift end.
  // Count shifts from the first round on record (go-live), not before it.
  const first = rounds.reduce((m, r) => Math.min(m, r.startedAt.getTime()), now.getTime());
  const shifts = Math.max(1, Math.floor((now.getTime() - Math.max(since.getTime(), first)) / (12 * H)));
  const subm = rounds.filter((r) => r.submittedAt && r.submittedAt.getTime() - r.startedAt.getTime() <= 14 * H);
  // Meter readings: every day since the first reading should have all 4 meters.
  const dayKey = (d: Date) => mnl(d).toISOString().slice(0, 10);
  const perDay = new Map<string, Set<string>>();
  for (const r of readings) { const k = dayKey(r.takenAt); perDay.set(k, (perDay.get(k) ?? new Set()).add(r.meter)); }
  const firstRead = readings.reduce((m, r) => Math.min(m, r.takenAt.getTime()), now.getTime());
  const readDays = readings.length ? Math.max(1, Math.round((now.getTime() - firstRead) / D)) : 0;
  const fullDays = [...perDay.values()].filter((v) => v.size >= 4).length;
  // Board and approvers
  const decided = prs.filter((p) => p.submittedAt && approvalsOf(p).length);
  const apprOk = decided.filter((p) => approvalsOf(p).every((a) => new Date(a.at).getTime() - p.submittedAt!.getTime() <= 48 * H)).length;
  const sc = (owner: Owner, measures: Measure[]): RoleScore => ({ owner, label: OWNER_LABEL[owner], measures, pct: pctOf(measures) });
  return [
    sc("MANAGER", [
      { label: "Tickets acknowledged on time", ok: ackOk, of: ackable.length },
      { label: "Repairs verified within 24h", ok: verOk, of: verifiable.length },
      { label: "Unhappy residents called back within 24h", ok: pulseOk, of: pulses.length },
      { label: "Receipts uploaded within 24h", ok: receiptOk, of: received.length },
      { label: "Board report by the 5th", ok: repOk, of: months.length },
    ]),
    sc("TECH", [
      { label: "Repairs finished within the deadline", ok: fixOk, of: done.length },
      { label: "Closed with an after photo", ok: photoOk, of: done.length },
    ]),
    sc("GUARD", [
      { label: "Shifts with a submitted round", ok: Math.min(subm.length, shifts), of: shifts },
      { label: "Days with all 4 meter readings", ok: Math.min(fullDays, readDays), of: readDays },
    ]),
    sc("BOARD", [{ label: "Purchase approvals within 48h", ok: apprOk, of: decided.length }]),
  ];
}

