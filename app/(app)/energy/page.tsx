import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { unitEnergy, type EnergyFlag } from "@/lib/energy";
import { monthLabel, peso } from "@/lib/format";
import { openLeakCheck } from "./actions";

export const dynamic = "force-dynamic";
const FLAG: Record<EnergyFlag, { label: string; cls: string }> = {
  LEAK: { label: "Likely leak", cls: "t-bad" }, VACANT_USE: { label: "Use while vacant", cls: "t-bad" }, HIGH: { label: "High use", cls: "t-warn" },
  NORMAL: { label: "Normal", cls: "t-mut" }, LOW: { label: "Efficient", cls: "t-ok" }, NODATA: { label: "No reading", cls: "t-mut" },
};

export default async function Energy({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const [units, leases, totals] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, code: true, sqm: true, occupancy: true } }),
    prisma.lease.findMany({ where: { end: { gte: new Date() }, start: { lte: new Date() } }, select: { unitId: true } }),
    prisma.utilityReading.groupBy({ by: ["period", "kind"], _sum: { usage: true, amount: true }, orderBy: { period: "asc" } }),
  ]);
  const leased = new Set(leases.map((l) => l.unitId));
  const e = await unitEnergy(units.map((x) => ({ id: x.id, code: x.code, sqm: Number(x.sqm), vacant: x.occupancy === "VACANT" && !leased.has(x.id) })));
  const rows = [...e.entries()].map(([code, v]) => ({ code, ...v }));
  const flagged = rows.filter((r) => r.flag === "LEAK" || r.flag === "VACANT_USE" || r.flag === "HIGH").sort((a, b) => (a.flag === "HIGH" ? 1 : 0) - (b.flag === "HIGH" ? 1 : 0) || (b.m3Jump ?? 0) - (a.m3Jump ?? 0));
  const periods = [...new Set(totals.map((t) => t.period))].slice(-6);
  const sum = (p: string, k: string) => totals.find((t) => t.period === p && t.kind === k)?._sum;
  const last = periods[periods.length - 1];
  const leakM3 = rows.filter((r) => r.flag === "LEAK" || r.flag === "VACANT_USE").reduce((s, r) => s + Math.max(0, (r.m3 ?? 0) * (r.m3Jump != null ? r.m3Jump / (1 + r.m3Jump) : 0.5)), 0);
  const maxE = Math.max(1, ...periods.map((p) => sum(p, "ELECTRIC")?.usage ?? 0));
  return (
    <>
      <PageHead title="Energy & water" sub="Every unit's sub-meter, read monthly. AI compares each unit with similar-size units and with its own past months, then flags likely leaks and waste." right={<Link href="/board" className="btn sm">See it on the 3D towers</Link>} />
      <main className="view">
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className="grid g4">
          <Kpi k={`Electricity, ${last ? monthLabel(last) : "-"}`} v={`${Math.round((sum(last, "ELECTRIC")?.usage ?? 0) / 1000).toLocaleString()} MWh`} d={peso(Number(sum(last, "ELECTRIC")?.amount ?? 0))} />
          <Kpi k="Water" v={`${Math.round(sum(last, "WATER")?.usage ?? 0).toLocaleString()} m³`} d={peso(Number(sum(last, "WATER")?.amount ?? 0))} />
          <Kpi k="Units flagged" v={flagged.length} d={`${rows.filter((r) => r.flag === "LEAK" || r.flag === "VACANT_USE").length} likely leaks`} cls={flagged.length ? "amber" : ""} />
          <Kpi k="Water lost to leaks (est.)" v={`${Math.round(leakM3)} m³/mo`} d={`about ${peso(Math.round(leakM3 * 78))} a month`} />
        </div>
        <div className="grid g-7-5">
          <div className="card"><h3>Flagged units</h3>
            <div className="list" style={{ marginTop: 6 }}>{flagged.length ? flagged.map((r) => (
              <div className="li" key={r.code} style={{ alignItems: "flex-start" }}>
                <span className={"tag " + FLAG[r.flag].cls}>{FLAG[r.flag].label}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b>Unit {r.code}</b> · {r.kwh} kWh · {r.m3} m³<div className="hint">{r.note}</div></div>
                {staff && r.flag !== "HIGH" && <form action={openLeakCheck}><input type="hidden" name="code" value={r.code} /><input type="hidden" name="note" value={r.note ?? ""} /><SubmitButton label="Send plumber" busy="…" small cls="btn" /></form>}
              </div>
            )) : <div className="empty">Nothing unusual this month.</div>}</div>
          </div>
          <div className="card"><h3>Building total, last 6 months</h3>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>{periods.map((p) => {
              const el = sum(p, "ELECTRIC")?.usage ?? 0, w = sum(p, "WATER")?.usage ?? 0;
              return <div key={p} className="row" style={{ fontSize: 13 }}><span style={{ width: 44 }}>{monthLabel(p)}</span>
                <span style={{ flex: 1, height: 10, background: "var(--panel-2)", borderRadius: 5, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${(el / maxE) * 100}%`, background: "#E69F00" }} /></span>
                <span className="num" style={{ width: 150, textAlign: "right" }}>{Math.round(el).toLocaleString()} kWh · {Math.round(w).toLocaleString()} m³</span></div>;
            })}</div>
            <div className="hint" style={{ marginTop: 10 }}>Common-area meters (main water, genset fuel, cistern) are read by guards on rounds and checked overnight for leaks.</div>
          </div>
        </div>
      </main>
    </>
  );
}
