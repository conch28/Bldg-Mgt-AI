/**
 * Board meeting autopilot: agenda from live building data, minutes from the secretary's notes,
 * action items tracked to done, and AGM quorum (units present + proxies, by floor area).
 */
import { prisma } from "./db";
import { peso, fmtDate, nowManila, currentPeriod, monthLong, addMonths } from "./format";
import { collectionTrend, overdueAccounts, slaStats } from "./metrics";
import { earlyWarnings } from "./building";
import { writeDoc } from "./ai";

export async function agendaFacts() {
  const now = nowManila();
  const [trend, overdue, sla, warn, openActions, escalated, polls, flagged] = await Promise.all([
    collectionTrend(3), overdueAccounts(), slaStats(30), earlyWarnings(),
    prisma.actionItem.findMany({ where: { status: "OPEN" }, orderBy: { due: "asc" } }),
    prisma.workOrder.findMany({ where: { status: "ESCALATED" }, select: { number: true, title: true } }),
    prisma.poll.findMany({ where: { closesAt: { gte: now } }, select: { question: true, closesAt: true } }),
    prisma.workOrder.count({ where: { source: "Meter AI", status: { not: "DONE" } } }),
  ]);
  const last = trend[trend.length - 2] ?? trend[trend.length - 1];
  return {
    collection: last ? { month: monthLong(last.period), rate: Math.round(last.rate), billed: peso(last.billed), collected: peso(last.collected) } : null,
    overdue: { units: overdue.length, amount: peso(overdue.reduce((s, o) => s + o.amount, 0)), over90: overdue.filter((o) => o.days > 90).map((o) => `${o.code} (${o.days} days, ${peso(o.amount)})`) },
    repairs: { closed30d: sla.closed, onTimePct: Math.round(sla.pct), rating: sla.rating.toFixed(1), escalated: escalated.map((w) => `WO-${w.number} ${w.title}`) },
    earlyWarnings: warn.map((w) => w.title), meterChecksOpen: flagged,
    openActions: openActions.map((a) => `${a.text} (${a.owner}${a.due ? `, due ${fmtDate(a.due)}` : ""})`),
    openVotes: polls.map((p) => `${p.question} (closes ${fmtDate(p.closesAt)})`),
  };
}

export function agendaTemplate(kind: string, f: Awaited<ReturnType<typeof agendaFacts>>) {
  const L: string[] = [];
  const n = (x: number) => x;
  let i = 0; const h = (t: string) => L.push(`## ${++i}. ${t}`);
  h("Call to order, quorum and approval of the last minutes");
  if (kind === "AGM") { h("President's report on the year"); }
  h("Matters arising: open action items");
  L.push(...(f.openActions.length ? f.openActions.map((a) => `- ${a}`) : ["- None open."]));
  h("Treasurer's report and collections");
  if (f.collection) L.push(`- ${f.collection.month}: ${f.collection.rate}% collected on time (${f.collection.collected} of ${f.collection.billed}).`);
  L.push(`- ${n(f.overdue.units)} units overdue, ${f.overdue.amount} in total.`);
  if (f.overdue.over90.length) L.push(`- Over 90 days: ${f.overdue.over90.join("; ")}. Decide on demand letters or amenity suspension (House Rules §7.3).`);
  h("Property manager's report");
  L.push(`- ${f.repairs.closed30d} repairs closed in 30 days, ${f.repairs.onTimePct}% on time, average rating ${f.repairs.rating}/5.`);
  if (f.repairs.escalated.length) L.push(`- Escalated: ${f.repairs.escalated.join("; ")}.`);
  if (f.earlyWarnings.length) L.push(`- Early warnings: ${f.earlyWarnings.join("; ")}.`);
  if (f.meterChecksOpen) L.push(`- ${f.meterChecksOpen} meter leak checks open.`);
  if (f.openVotes.length) { h("Owner votes in progress"); L.push(...f.openVotes.map((v) => `- ${v}`)); }
  if (kind === "AGM") { h("Election of the board"); h("Approval of next year's budget and dues"); }
  h("Other matters");
  h("Adjournment");
  return L.join("\n");
}

export async function draftAgenda(kind: string, title: string, when: Date) {
  const f = await agendaFacts();
  const fallback = agendaTemplate(kind, f);
  return writeDoc(
    "You are the corporate secretary's assistant for a Philippine condominium corporation. Write a clear, numbered meeting agenda in Markdown (## headings for items, short bullets under each). Order items the way Philippine condo boards run meetings (call to order and quorum first, adjournment last). Under each item, add the 1-3 facts the board needs and the decision being asked for. Keep it under 300 words.",
    `Meeting: ${title} (${kind === "AGM" ? "Annual general meeting of unit owners" : "Board meeting"}) on ${fmtDate(when)}.\nFacts: ${JSON.stringify(f)}\n\nTemplate to improve on:\n${fallback}`,
    fallback,
  );
}

/** Lines like "Action: Paolo - get 3 quotes for the genset battery - Dec 5" become action items. */
export function parseActions(notes: string) {
  const out: { text: string; owner: string; due: Date | null }[] = [];
  for (const raw of notes.split("\n")) {
    const m = raw.trim().match(/^(?:[-*]\s*)?(?:action|todo|to do|gagawin)\s*[:\-]\s*(.+)$/i);
    if (!m) continue;
    const parts = m[1].split(/\s+[-–]\s+/);
    const owner = parts.length > 1 ? parts[0].trim() : "Board";
    const text = (parts.length > 1 ? parts[1] : parts[0]).trim();
    const dueRaw = parts[2]?.trim();
    let due: Date | null = null;
    if (dueRaw) { const d = new Date(`${dueRaw} ${nowManila().getFullYear()} 17:00 GMT+0800`); if (!isNaN(d.getTime())) { if (d < nowManila()) d.setFullYear(d.getFullYear() + 1); due = d; } }
    if (text) out.push({ text: text.slice(0, 300), owner: owner.slice(0, 80), due });
  }
  return out;
}

export async function draftMinutes(meeting: { title: string; kind: string; startsAt: Date; agenda: string | null }, notes: string, present: string) {
  const actions = parseActions(notes);
  const fallback = [
    `# Minutes: ${meeting.title}`, `${fmtDate(meeting.startsAt)} · ${present}`, "",
    "## Discussion", ...notes.split("\n").filter((l) => l.trim() && !/^(?:[-*]\s*)?(action|todo|to do|gagawin)\s*[:\-]/i.test(l.trim())).map((l) => `- ${l.replace(/^[-*]\s*/, "")}`),
    "", "## Action items", ...(actions.length ? actions.map((a) => `- **${a.owner}:** ${a.text}${a.due ? ` (by ${fmtDate(a.due)})` : ""}`) : ["- None recorded."]),
    "", "Draft for the corporate secretary to review before circulation.",
  ].join("\n");
  const r = await writeDoc(
    "You are the corporate secretary's assistant for a Philippine condominium corporation. Turn rough meeting notes (English, Tagalog or Taglish) into formal minutes in English Markdown: title, date and attendance line, then one ## section per agenda item with what was discussed and any motion, who moved and seconded, and the result if the notes say so. End with an '## Action items' list (owner, task, due date). Mark anything unclear as [to confirm]. End with: Draft for the corporate secretary to review before circulation.",
    `Meeting: ${meeting.title}, ${fmtDate(meeting.startsAt)}. Attendance: ${present}.\nAgenda:\n${meeting.agenda ?? "(none)"}\n\nNotes:\n${notes}`,
    fallback,
  );
  return { ...r, actions };
}

/** AGM quorum: units present in person or online plus units represented by a live proxy, by floor area. Need over 50%. */
export async function quorum(meetingId: string) {
  const [units, att, prox] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, sqm: true } }),
    prisma.attendance.findMany({ where: { meetingId } }),
    prisma.proxy.findMany({ where: { meetingId, revokedAt: null } }),
  ]);
  const sqm = new Map(units.map((u) => [u.id, Number(u.sqm)]));
  const total = units.reduce((s, u) => s + Number(u.sqm), 0);
  const present = new Set(att.map((a) => a.unitId));
  const byProxy = new Set(prox.filter((p) => !present.has(p.unitId)).map((p) => p.unitId));
  const area = (ids: Set<string>) => [...ids].reduce((s, id) => s + (sqm.get(id) ?? 0), 0);
  const presentPct = (area(present) / total) * 100, proxyPct = (area(byProxy) / total) * 100;
  return { units: units.length, present: present.size, proxies: byProxy.size, presentPct, proxyPct, pct: presentPct + proxyPct, met: presentPct + proxyPct > 50 };
}

export const nextMonthPeriod = () => addMonths(currentPeriod(), 1);
