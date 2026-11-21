/**
 * AI savings advisor. Every idea is computed from Skyland's own records (meter readings, budgets, assets,
 * vendors, purchases), with the assumptions written next to the number, so the board can check it.
 * Claude only rewrites the summary when a key is set; the numbers never come from the model.
 */
import { prisma } from "./db";
import { nowManila, peso, monthLong } from "./format";
import { controlFlags } from "./procurement";
import { latestClosedPeriod, budgetFor } from "./metrics";

export const RATES = { kwh: 12, water: 95 }; // ₱ per kWh (Meralco commercial, approx.) and ₱ per m³ (water + sewer, approx.)
const DAY = 86400000;

export type Idea = { key: string; title: string; perYear: number; effort: "Quick win" | "Some work" | "Project"; confidence: "High" | "Medium" | "Low"; why: string; action: string; href?: string; urgent?: boolean };

/** Daily use from cumulative meter readings, one value per Manila day (last reading of the day minus the previous day's last). */
export async function dailyUse(meter: "WATER_MAIN" | "ELECTRIC_MAIN", days = 30) {
  const since = new Date(nowManila().getTime() - (days + 1) * DAY);
  const rs = await prisma.meterReading.findMany({ where: { meter, takenAt: { gte: since } }, orderBy: { takenAt: "asc" } });
  const last = new Map<string, number>();
  for (const r of rs) last.set(r.takenAt.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), r.value);
  const dates = [...last.keys()].sort();
  const out: { date: string; use: number }[] = [];
  for (let i = 1; i < dates.length; i++) out.push({ date: dates[i], use: Math.max(0, last.get(dates[i])! - last.get(dates[i - 1])!) });
  return out;
}
/** Water used between the late-night and the early-morning reading: almost nobody uses water then, so a rise means a leak. */
export async function nightFlow(days = 21) {
  const since = new Date(nowManila().getTime() - days * DAY);
  const rs = await prisma.meterReading.findMany({ where: { meter: "WATER_MAIN", takenAt: { gte: since } }, orderBy: { takenAt: "asc" } });
  const hour = (d: Date) => Number(d.toLocaleString("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false })) % 24;
  const out: { date: string; perHour: number }[] = [];
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1], b = rs[i];
    if (hour(a.takenAt) >= 22 || hour(a.takenAt) <= 1) if (hour(b.takenAt) >= 3 && hour(b.takenAt) <= 6) {
      const hrs = (b.takenAt.getTime() - a.takenAt.getTime()) / 3600000;
      if (hrs > 2 && hrs < 9) out.push({ date: b.takenAt.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), perHour: (b.value - a.value) / hrs });
    }
  }
  return out;
}

export async function leakCheck() {
  const nf = await nightFlow(21);
  if (nf.length < 8) return null;
  const recent = nf.slice(-4), base = nf.slice(0, -4);
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const b = med(base.map((x) => x.perHour)), r = recent.reduce((s, x) => s + x.perHour, 0) / recent.length;
  return { baseline: b, recent: r, rise: b > 0 ? r / b - 1 : 0, since: recent[0].date, leak: b > 0 && r > b * 1.35 && r - b > 0.4, series: nf };
}

export async function savingsIdeas(): Promise<Idea[]> {
  const now = nowManila();
  const closed = await latestClosedPeriod();
  const [leak, lights, budget, vendors, flags, receipts] = await Promise.all([
    leakCheck(),
    prisma.asset.findMany({ where: { category: "Lighting", status: { not: "RETIRED" } } }),
    budgetFor(closed),
    prisma.vendor.findMany({ where: { active: true, contractEnd: { lte: new Date(now.getTime() + 90 * DAY), gte: now } } }),
    controlFlags(),
    prisma.stockMove.findMany({ where: { kind: "RECEIVE", createdAt: { gte: new Date(now.getTime() - 180 * DAY) } }, include: { item: true } }),
  ]);
  const ideas: Idea[] = [];

  if (leak?.leak) {
    const extra = (leak.recent - leak.baseline) * 24; // m³ per day lost
    ideas.push({
      key: "leak", urgent: true, title: "Find the hidden water leak", perYear: Math.round(extra * 365 * RATES.water), effort: "Quick win", confidence: "High",
      why: `Night-time water flow (11 PM to 4 AM, when almost nobody uses water) rose from about ${leak.baseline.toFixed(1)} to ${leak.recent.toFixed(1)} m³ an hour since ${new Date(leak.since + "T12:00:00+08:00").toLocaleDateString("en-PH", { day: "numeric", month: "short" })}. That's roughly ${Math.round(extra)} m³ a day going nowhere, at about ₱${RATES.water}/m³.`,
      action: "Close the riser valves one tower at a time at 2 AM and watch the main meter. Check the roof tank float valve and the pool make-up line first; they are the usual suspects.",
      href: "/rounds",
    });
  }

  const old = lights.filter((a) => /fluorescent|t8|cfl|halogen|metal halide|incandescent/i.test(a.name));
  if (old.length) {
    const kwh = old.length * 18 * 24 * 365 / 1000; // ~18 W saved per fixture, common areas lit 24 h
    ideas.push({
      key: "led", title: `Switch the last ${old.length} old lights to LED`, perYear: Math.round(kwh * RATES.kwh), effort: "Some work", confidence: "High",
      why: `${old.length} fixtures in the asset register are still fluorescent or halogen. Each LED replacement saves about 18 W, and hallway, stair and parking lights run 24 hours. At ₱${RATES.kwh}/kWh that is about ${peso(18 * 24 * 365 / 1000 * RATES.kwh)} per fixture a year; LEDs also last 3 to 5 times longer.`,
      action: "Raise one purchase request for all of them (it will need 3 quotes) instead of replacing one at a time.",
      href: "/procurement?new=1&cat=Lighting",
    });
  }

  const elec = budget.lines.find((l) => /electric/i.test(l.category));
  if (elec && Number(elec.actual) > Number(elec.budget)) {
    const over = Number(elec.actual) - Number(elec.budget);
    ideas.push({
      key: "chiller", title: "Tune the chillers and common-area aircon", perYear: Math.round(Number(elec.actual) * 0.08 * 12), effort: "Quick win", confidence: "Medium",
      why: `Common-area electricity was ${peso(over)} over budget in ${monthLong(closed)}${elec.note ? ` (${elec.note})` : ""}. Clean condenser coils and a 25°C setpoint typically cut cooling energy by 8% or more.`,
      action: "Clean condenser coils quarterly, set lobby and gym aircon to 25°C, and put the amenity-floor units on timers.",
      href: "/maintenance",
    });
  }

  for (const v of vendors) {
    const monthly = Number(v.monthlyValue);
    if (monthly < 20000) continue;
    ideas.push({
      key: `rebid-${v.id}`, title: `Re-bid the ${v.service.split("(")[0].trim().toLowerCase()} contract before it renews`, perYear: Math.round(monthly * 12 * 0.07), effort: "Some work", confidence: "Medium",
      why: `${v.name}'s contract (${peso(monthly)} a month) ends ${v.contractEnd!.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" })}. Competitive bids with 3 vendors usually come in 5 to 10% lower, or win better terms from the current one.`,
      action: "Send the scope to 3 accredited vendors this week so the board can decide before the end date.",
      href: "/vendors",
    });
  }

  const recoverable = flags.filter((f) => ["Price above benchmark", "Missed warranty claim", "Possible split purchase", "Invoice above PO"].includes(f.kind));
  if (recoverable.length) ideas.push({
    key: "recover", title: "Recover overpayments (one-time) and close procurement gaps", perYear: Math.round(recoverable.reduce((s, f) => s + f.atStake, 0)), effort: "Quick win", confidence: "High",
    why: `${recoverable.length} red flags in the last 6 months: ${[...new Set(recoverable.map((f) => f.kind.toLowerCase()))].join(", ")}.`,
    action: "Claim the warranty refunds, ask for re-quotes where prices are above benchmark, and combine small orders.",
    href: "/procurement?tab=controls",
  });

  const spend = new Map<string, { name: string; total: number }>();
  for (const m of receipts) { const e = spend.get(m.itemId) ?? { name: m.item.name, total: 0 }; e.total += m.qty * Number(m.item.lastPrice ?? m.item.benchmark); spend.set(m.itemId, e); }
  const top = [...spend.values()].sort((a, b) => b.total - a.total).slice(0, 3);
  const yearly = top.reduce((s, t) => s + t.total * 2, 0);
  if (yearly > 20000) ideas.push({
    key: "bulk", title: "Lock in a yearly supply price for everyday parts", perYear: Math.round(yearly * 0.1), effort: "Quick win", confidence: "Medium",
    why: `Skyland buys the same parts again and again: ${top.map((t) => t.name).join(", ")} (about ${peso(yearly)} a year). Suppliers usually give 8 to 12% off for a fixed yearly price list.`,
    action: "Ask 3 suppliers for a 12-month price list on the top 10 parts; order against it with no new quotes needed.",
    href: "/inventory?tab=stock",
  });

  ideas.push({
    key: "rpt", title: "Pay common-area real property tax early", perYear: 0, effort: "Quick win", confidence: "Medium",
    why: "Makati gives a discount for paying real property tax in advance (the Local Government Code allows up to 20%).",
    action: "Put the common-area RPT in the January cash plan and pay before the city's deadline.",
    href: "/advisor#rules",
  });

  return ideas.sort((a, b) => (a.urgent === b.urgent ? b.perYear - a.perYear : a.urgent ? -1 : 1));
}

export function advisorFallback(ideas: Idea[]) {
  const total = ideas.reduce((s, i) => s + i.perYear, 0);
  const top = ideas.filter((i) => i.perYear > 0).slice(0, 3);
  return `Skyland could save about ${peso(total)} a year. ` + top.map((i, n) => `${n === 0 ? "Start with" : n === 1 ? "Next," : "Then"} ${i.title.toLowerCase()} (${peso(i.perYear)}).`).join(" ");
}
