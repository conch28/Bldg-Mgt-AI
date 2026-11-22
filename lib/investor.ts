/**
 * Unit economics shown on the investor snapshot. Copied from the P&L model's Assumptions sheet
 * (one mature 400-unit tower, monthly, PHP). They are estimates, labelled as such on the page.
 * Update these when the model changes.
 */
export const STREAMS: { k: string; rev: number; costPct: number }[] = [
  { k: "Management fee", rev: 90000, costPct: 0 },
  { k: "Common-area supplies & minor repairs (cost + 12%)", rev: 56000, costPct: 50000 / 56000 },
  { k: "Common-area aircon maintenance", rev: 12500, costPct: 0.6 },
  { k: "In-unit services to owners", rev: 96000, costPct: 62000 / 96000 },
  { k: "Project management on improvements (6%)", rev: 15000, costPct: 0.2 },
  { k: "AI leasing for owners", rev: 20000, costPct: 0.3 },
  { k: "AI resale for owners", rev: 36000, costPct: 0.5 },
  { k: "Disclosed partner referrals", rev: 5000, costPct: 0 },
];
/** Outsourced building-level costs: manager bonus (70k × 20% × 70%), CPA, AI stack, insurance, transport, contingency. */
export const BUILDING_COSTS = 70000 * 0.2 * 0.7 + 20000 + 8000 + 10000 + 10000 + 7000;
/** Year-1 corporate overhead per month, excluding one-time setup. */
export const YEAR1_OVERHEAD = 0 + 25000 + 15000 + 10000 + 10000 + 5000;
export const PIPELINE = [{ k: "Year 1", n: 3 }, { k: "Year 2", n: 12 }, { k: "Year 3", n: 30 }];

export function unitEconomics() {
  const revenue = STREAMS.reduce((s, x) => s + x.rev, 0);
  const direct = STREAMS.reduce((s, x) => s + x.rev * x.costPct, 0);
  const gross = revenue - direct;
  const contribution = gross - BUILDING_COSTS;
  return { revenue, direct, gross, contribution, margin: contribution / revenue, oneBuildingProfit: contribution - YEAR1_OVERHEAD };
}
