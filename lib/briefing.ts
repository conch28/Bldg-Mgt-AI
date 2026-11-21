/** Facts for the manager's spoken morning briefing, plus a plain template version. */
import { prisma } from "./db";
import { nowManila } from "./format";
import { happinessNow, atRiskResidents } from "./happiness";
import { earlyWarnings } from "./building";

const pesos = (n: number) => `${Math.round(n).toLocaleString("en-PH")} pesos`;
const ago = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} minutes ago` : m < 48 * 60 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export async function briefingFacts(managerName: string) {
  const now = nowManila();
  const t = now.getTime();
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const todayStart = new Date(ymd + "T00:00:00+08:00");
  const yStart = new Date(todayStart.getTime() - 86400000);
  const [open, happy, risk, warnings, paidY, pm, sos, pending] = await Promise.all([
    prisma.workOrder.findMany({ where: { status: { not: "DONE" } }, orderBy: { createdAt: "asc" } }),
    happinessNow(), atRiskResidents(), earlyWarnings(),
    prisma.payment.aggregate({ where: { createdAt: { gte: yStart, lt: todayStart } }, _sum: { amount: true }, _count: true }),
    prisma.pMTask.findMany({ where: { nextDue: { lte: new Date(t + 7 * 86400000) } }, orderBy: { nextDue: "asc" } }),
    prisma.sosAlert.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.announcement.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);
  const late = open.filter((w) => t - w.createdAt.getTime() > w.slaHours * 3600000);
  const fresh = open.filter((w) => w.status === "NEW");
  const esc = open.filter((w) => w.status === "ESCALATED");
  const urgent = [...open].sort((a, b) => (a.priority === "HIGH" ? 0 : 1) - (b.priority === "HIGH" ? 0 : 1) || (a.status === "NEW" ? 0 : 1) - (b.status === "NEW" ? 0 : 1) || b.createdAt.getTime() - a.createdAt.getTime())[0];
  const first = managerName.replace(/^(Engr\.|Arch\.|Atty\.)\s*/, "").split(" ")[0];
  const hour = Number(now.toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const day = now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });
  const delta = happy.score - (happy.lastMonth || happy.score);
  const where = (loc: string) => (/^\d+[A-Z]$/i.test(loc) ? `unit ${loc}` : loc);

  const lines: string[] = [];
  lines.push(`${greet}, ${first}. Here's Skyland for ${day}.`);
  if (sos) lines.push(`First, there ${sos === 1 ? "is 1 open SOS alert" : `are ${sos} open SOS alerts`}. Please check the SOS page now.`);
  lines.push(`Repairs: ${plural(open.length, "open ticket")}. ${late.length ? `${late.length} past the deadline. ` : "Everything is within its deadline. "}${fresh.length ? `${fresh.length} still need a technician. ` : ""}${esc.length ? `${esc.length} escalated. ` : ""}`.trim());
  if (urgent) lines.push(`The most urgent is ${where(urgent.location)}: ${urgent.title.toLowerCase()}, opened ${ago(t - urgent.createdAt.getTime())}${urgent.assignee ? `, with ${urgent.assignee}` : ", not yet assigned"}.`);
  if (warnings[0]) lines.push(`Early warning: ${warnings[0].title.charAt(0).toLowerCase() + warnings[0].title.slice(1)}. ${warnings[0].action}`);
  lines.push(`Residents: happiness is ${Math.round(happy.score)} out of 100, ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)} from last month.${risk.length ? ` ${plural(risk.length, "resident")} rated us low and ${risk.length === 1 ? "is" : "are"} waiting for a call${risk[0].unitCode ? `, starting with unit ${risk[0].unitCode}` : ""}.` : " Nobody is waiting for a call back."}`);
  if (paidY._count) lines.push(`Money: ${plural(paidY._count, "payment")} came in yesterday, ${pesos(Number(paidY._sum.amount ?? 0))}.`);
  if (pm.length) lines.push(`Maintenance: ${plural(pm.length, "task")} due this week, starting with ${pm[0].asset}, ${pm[0].task.toLowerCase()}.`);
  if (pending) lines.push(`${plural(pending, "resident update")} ${pending === 1 ? "is" : "are"} drafted and waiting for your approval.`);
  lines.push("That's it. Have a good day po!");
  const text = lines.join("\n");
  return { text, facts: `Manager's first name: ${first}\nDate: ${day}\n\n${text}` };
}
