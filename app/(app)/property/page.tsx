import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { Icon } from "@/components/Nav";
import { NetBars } from "@/components/charts";
import { peso, pesoK, fmtDate, monthLabel, currentPeriod, addMonths, nowManila } from "@/lib/format";
import { priceCheck, BROKER, FEES } from "@/lib/property";

export const dynamic = "force-dynamic";
const STATUS: Record<string, [string, string]> = { DRAFT: ["Waiting for your OK", "t-warn"], LIVE: ["Live on Facebook", "t-ok"], RESERVED: ["Reserved", "t-acc"], CLOSED: ["Closed", "t-mut"], WITHDRAWN: ["Withdrawn", "t-mut"] };

export default async function Property() {
  const u = await requireRole("OWNER");
  const now = nowManila();
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" }, include: { leases: { orderBy: { start: "desc" } }, listings: { where: { status: { in: ["DRAFT", "LIVE", "RESERVED"] } }, include: { inquiries: true }, orderBy: { createdAt: "desc" } }, bills: true } });
  const leased = units.filter((x) => x.leases.length);

  // Rental income: last 12 months of rent received minus association dues, per leased unit.
  const cur = currentPeriod(now);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(cur, i - 11));
  const income = await Promise.all(leased.map(async (x) => {
    const rentFor = (p: string) => { const d = new Date(`${p}-15T00:00:00+08:00`); return Number(x.leases.find((l) => l.start <= d && l.end >= d)?.rent ?? 0); };
    const duesFor = (p: string) => Number(x.bills.find((b) => b.period === p)?.amount ?? 0);
    const net = months.map((p) => rentFor(p) - duesFor(p));
    const rent = months.reduce((s, p) => s + rentFor(p), 0), dues = months.reduce((s, p) => s + duesFor(p), 0);
    const vacant = months.filter((p) => !rentFor(p)).length;
    const active = x.leases.find((l) => l.end >= now);
    const value = (await priceCheck("SALE", { sqm: Number(x.sqm), floor: x.floor }, Number(x.sqm) > 40 ? 1 : 0)).mid;
    return { x, net, rent, dues, vacant, active, value, yieldPct: value ? ((rent - dues) / value) * 100 : 0, lost: vacant * Number(active?.rent ?? x.leases[0].rent) };
  }));

  return (
    <>
      <PageHead title="My unit" sub="Rent it out, sell it, or see how much it earns. We do the work, you approve with one tap." />
      <main className="view">
        <div className="stack">{units.map((x) => {
          const lease = x.leases.find((l) => l.end >= now); const days = lease ? Math.ceil((lease.end.getTime() - now.getTime()) / 86400000) : 0;
          return (
            <div className="card" key={x.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}><h3 style={{ fontSize: 18 }}>Unit {x.code}</h3><div className="hint">{Number(x.sqm)} sqm · {x.floor}th floor</div></div>
                {lease ? <span className={"tag " + (days <= 60 ? "t-warn" : "t-ok")}>Leased · {days} days left</span> : <span className="tag t-acc">You live here</span>}
              </div>
              {lease && <div className="hint" style={{ marginTop: 6 }}>Tenant: <b style={{ color: "var(--fg)" }}>{lease.tenantName}</b> · {peso(lease.rent)}/month · until {fmtDate(lease.end)}</div>}
              {x.listings.map((l) => (
                <Link key={l.id} href={`/property/${l.id}`} className="li" style={{ textDecoration: "none", marginTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span className={"tag " + STATUS[l.status][1]}>{STATUS[l.status][0]}</span>
                  <div style={{ flex: 1 }}><b>For {l.kind === "LEASE" ? "lease" : "sale"} · {peso(l.price)}{l.kind === "LEASE" ? "/mo" : ""}</b>
                    <div className="hint">{l.views} views · {l.inquiries.length} inquiries · {l.inquiries.filter((i) => i.viewingAt).length} viewings{l.inquiries.some((i) => i.status === "NEW") ? " · new messages" : ""}</div></div>
                  <span className="hint">›</span>
                </Link>
              ))}
              {!x.listings.length && (
                <div className="row" style={{ marginTop: 12 }}>
                  <Link href={`/property/new?unit=${x.id}&kind=LEASE`} className={"btn" + (lease && days <= 60 ? " pri" : "")} style={{ flex: 1 }}><Icon name="key" /> {lease ? "Find the next tenant" : "Rent it out"}</Link>
                  <Link href={`/property/new?unit=${x.id}&kind=SALE`} className="btn" style={{ flex: 1 }}><Icon name="tag" /> Sell it</Link>
                </div>
              )}
              {lease && days <= 60 && !x.listings.length && <div className="aibox" style={{ marginTop: 10 }}><span className="ai-badge">AI tip</span> The lease ends {fmtDate(lease.end)}. Listing now usually avoids an empty month (about {peso(lease.rent)} lost).</div>}
            </div>
          );
        })}</div>

        {income.map(({ x, net, rent, dues, vacant, value, yieldPct, lost }) => (
          <div className="card" key={x.id}>
            <div className="cardhead"><div><h3>Rental income · {x.code}</h3><div className="hint">Last 12 months, rent received minus association dues</div></div></div>
            <div className="mini-row">
              <div className="mini" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>Net income</span><b className="n num">{pesoK(rent - dues)}</b></div>
              <div className="mini" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>Yield</span><b className="n num">{yieldPct.toFixed(1)}%</b><span>of {pesoK(value)} value</span></div>
              <div className="mini" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>Empty months</span><b className={"n num" + (vacant ? " amber" : "")}>{vacant}</b>{vacant > 0 && <span>{pesoK(lost)} missed</span>}</div>
            </div>
            <div style={{ marginTop: 10 }}><NetBars vals={net} labels={months.map((p) => monthLabel(p).slice(0, 3))} fmt={(v) => (Math.abs(v) >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${Math.round(v)}`)} /></div>
          </div>
        ))}

        <div className="card">
          <h3>How renting out or selling works</h3>
          <div className="list" style={{ marginTop: 6 }}>
            {[["spark", "AI checks the price", "We compare your unit with listings in Skyland and within 1 km, and with past Skyland deals."],
              ["doc", "AI writes the listing", "In English and Taglish. You approve it with one tap."],
              ["mega", "We post it on Facebook", "Our Page, Marketplace and four condo groups, all at once."],
              ["chat", "AI answers inquiries", "Day and night, in minutes, and books viewings. The guard gets a pass for each viewer."],
              ["users", "A licensed broker closes", `${BROKER.name}, our ${BROKER.license} partner, handles offers, contracts and closing.`]].map(([i, t, s]) => (
              <div className="li" key={t}><span className="tile" style={{ minHeight: 0, padding: 0, border: 0, background: "none" }}><span className="ti" style={{ width: 38, height: 38 }}><Icon name={i} /></span></span><div><b>{t}</b><div className="hint">{s}</div></div></div>))}
          </div>
          <div className="hint" style={{ marginTop: 10 }}>Fees, only when it closes. Lease: {FEES.LEASE}. Sale: {FEES.SALE}.</div>
        </div>
      </main>
    </>
  );
}
