import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import { NetBars } from "@/components/charts";
import { happinessNow, scoreWord } from "@/lib/happiness";
import { collectionTrend, spendTrend, slaStats, overdueAccounts } from "@/lib/metrics";
import { savingsThisYear } from "@/lib/procurement";
import { peso, pesoK, monthLabel, nowManila, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Read-only view for the owner of the whole building: occupancy, income vs spending, asset health and resident happiness. */
export default async function BuildingOwner() {
  await requireRole("LANDLORD", "BOARD", "ADMIN");
  const now = nowManila();
  const yearOut = new Date(now.getTime() + 365 * 86400000);
  const [units, leases, trend, spend, sla, overdue, hNow, saved, assets] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, occupancy: true } }),
    prisma.lease.findMany({ where: { start: { lte: now }, end: { gte: now } }, select: { unitId: true, rent: true } }),
    collectionTrend(12), spendTrend(12), slaStats(30), overdueAccounts(), happinessNow(), savingsThisYear(),
    prisma.asset.findMany({ where: { status: { not: "RETIRED" } }, select: { name: true, location: true, installedAt: true, lifeMonths: true, cost: true, status: true } }),
  ]);

  const leased = new Set(leases.map((l) => l.unitId));
  const occ = { leased: leased.size, owner: 0, vacant: 0, unknown: 0 };
  for (const u of units) if (!leased.has(u.id)) { if (u.occupancy === "OWNER") occ.owner++; else if (u.occupancy === "VACANT") occ.vacant++; else occ.unknown++; }
  const occupiedPct = units.length ? ((units.length - occ.vacant) / units.length) * 100 : 0;
  const avgRent = leases.length ? leases.reduce((s, l) => s + Number(l.rent), 0) / leases.length : 0;

  // Income vs operating spend for closed months that have both.
  const spendBy = new Map(spend.map((s) => [s.period, s.actual]));
  const months = trend.filter((t) => spendBy.has(t.period));
  const net = months.map((t) => t.collected - (spendBy.get(t.period) ?? 0));
  const collected = months.reduce((s, t) => s + t.collected, 0), spent = months.reduce((s, t) => s + (spendBy.get(t.period) ?? 0), 0);
  const overdueTotal = overdue.reduce((s, o) => s + o.amount, 0);

  const endOfLife = (a: { installedAt: Date; lifeMonths: number }) => new Date(a.installedAt.getTime() + a.lifeMonths * 30.44 * 86400000);
  const dueSoon = assets.filter((a) => endOfLife(a) <= yearOut).sort((a, b) => endOfLife(a).getTime() - endOfLife(b).getTime());
  const capex = dueSoon.reduce((s, a) => s + Number(a.cost), 0);
  const faulty = assets.filter((a) => a.status === "FAULTY").length;
  // Group like items (e.g. 40 light fittings) so the biggest bills show first.
  const groups = [...dueSoon.reduce((m, a) => {
    const g = m.get(a.name) ?? { name: a.name, n: 0, cost: 0, past: 0, first: endOfLife(a) };
    g.n++; g.cost += Number(a.cost); if (endOfLife(a) <= now) g.past++; if (endOfLife(a) < g.first) g.first = endOfLife(a);
    return m.set(a.name, g);
  }, new Map<string, { name: string; n: number; cost: number; past: number; first: Date }>()).values()].sort((a, b) => b.cost - a.cost);

  return (
    <>
      <PageHead title="Owner overview" sub="Skyland Plaza · read-only view for the building owner" />
      <main className="view">
        <div className="grid g4">
          <Kpi k="Occupied units" v={`${occupiedPct.toFixed(0)}%`} d={<span className="hint">{units.length - occ.vacant} of {units.length} units · {occ.vacant} vacant</span>} />
          <Kpi k={`Income, last ${months.length} months`} v={pesoK(collected)} d={<span className="hint">dues collected</span>} />
          <Kpi k="Operating surplus" v={pesoK(collected - spent)} cls={collected >= spent ? "up" : "down"} d={<span className="hint">after {pesoK(spent)} operating spend</span>} />
          <Kpi k="Resident happiness" v={`${Math.round(hNow.score)}/100`} d={<span className="hint">{scoreWord(hNow.score)} · repairs {sla.pct.toFixed(0)}% on time</span>} />
        </div>
        <div className="grid g-7-5">
          <div className="card">
            <h3>Monthly surplus</h3>
            <div className="hint">Dues collected minus operating spend, per month</div>
            <NetBars vals={net} labels={months.map((t) => monthLabel(t.period))} fmt={(v) => pesoK(v)} />
          </div>
          <div className="card">
            <h3>Who lives here</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className="dot" style={{ background: "var(--accent)" }} /><div><b>{occ.owner} owner-occupied</b></div></div>
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>{occ.leased} leased to tenants</b>{leases.length ? <div className="hint">Average rent {peso(Math.round(avgRent))} a month</div> : null}</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--warn)" }} /><div><b>{occ.vacant} vacant</b><div className="hint">Our AI leasing service lists these for owners who want tenants</div></div></div>
              {occ.unknown > 0 && <div className="li"><span className="dot" style={{ background: "var(--muted, #999)" }} /><div><b>{occ.unknown} not yet recorded</b></div></div>}
            </div>
          </div>
        </div>
        <div className="grid g2">
          <div className="card">
            <h3>Replacements due in the next 12 months</h3>
            <div className="hint">{dueSoon.length} assets reach the end of their expected life · about {peso(capex)} to replace{faulty ? ` · ${faulty} faulty now` : ""}</div>
            <div className="list" style={{ marginTop: 6 }}>
              {groups.slice(0, 6).map((g) => (
                <div className="li" key={g.name}><span className="dot" style={{ background: g.past ? "var(--bad)" : "var(--warn)" }} /><div style={{ flex: 1 }}><b>{g.n > 1 ? `${g.n} × ${g.name}` : g.name}</b><div className="hint">{peso(g.cost)} · {g.past ? `${g.past} already past expected life` : `first one due ${fmtDate(g.first)}`}</div></div></div>
              ))}
              {!dueSoon.length && <div className="hint">Nothing major is due for replacement this year.</div>}
            </div>
          </div>
          <div className="card">
            <h3>Money matters</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className="dot" style={{ background: "var(--warn)" }} /><div><b>{peso(overdueTotal)} overdue</b> across {overdue.length} units. Friendly AI reminders go out automatically.</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--ok)" }} /><div><b>{peso(saved.total)} saved this year</b> by comparing quotes and claiming warranties.</div></div>
              <div className="li"><span className="dot" style={{ background: "var(--accent)" }} /><div><b>Every peso is on record.</b> Purchases need quotes and approval, and every change is logged.</div></div>
            </div>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 14 }}>Sample data for the demo. This view is read-only. To see the app from a resident&apos;s or manager&apos;s seat, sign out and pick another demo login.</p>
      </main>
    </>
  );
}
