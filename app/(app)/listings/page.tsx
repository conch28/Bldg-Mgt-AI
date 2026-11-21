import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import { peso, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
const ST: Record<string, string> = { DRAFT: "t-warn", LIVE: "t-ok", RESERVED: "t-acc", CLOSED: "t-mut", WITHDRAWN: "t-mut" };

export default async function Listings() {
  await requireRole("BOARD", "MANAGER", "ADMIN");
  const yearAgo = new Date(Date.now() - 365 * 86400000);
  const [listings, closed] = await Promise.all([
    prisma.listing.findMany({ where: { status: { in: ["DRAFT", "LIVE", "RESERVED"] } }, include: { unit: true, inquiries: true }, orderBy: { createdAt: "desc" } }),
    prisma.listing.findMany({ where: { status: "CLOSED", closedAt: { gte: yearAgo } }, include: { unit: true } }),
  ]);
  const days = closed.filter((c) => c.publishedAt && c.closedAt).map((c) => (c.closedAt!.getTime() - c.publishedAt!.getTime()) / 86400000);
  const avgDays = days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0;
  const inq = listings.reduce((s, l) => s + l.inquiries.length, 0);
  return (
    <>
      <PageHead title="Units for sale & lease" sub="Owners list through the app. AI prices, posts and answers; a licensed broker partner closes. Fewer strangers wandering the lobby, every viewer has a pass." />
      <main className="view">
        <div className="grid g4">
          <Kpi k="Listed now" v={listings.filter((l) => l.status === "LIVE").length} />
          <Kpi k="Inquiries answered by AI" v={inq} d={<span className="hint">median reply under 2 minutes</span>} />
          <Kpi k="Closed in 12 months" v={closed.length} d={<span className="hint">{closed.filter((c) => c.kind === "LEASE").length} leases · {closed.filter((c) => c.kind === "SALE").length} sales</span>} />
          <Kpi k="Average days to close" v={avgDays} d={<span className="hint">since posting</span>} />
        </div>
        <div className="card"><h3>Active listings</h3>
          <div className="tablewrap"><table className="stack-m"><thead><tr><th>Unit</th><th>Type</th><th className="r">Price</th><th>Status</th><th className="r">Inquiries</th><th className="hide-m">Viewings</th><th className="hide-m">Listed</th></tr></thead>
            <tbody>{listings.map((l) => <tr key={l.id}><td><b>{l.unit.code}</b></td><td>{l.kind === "LEASE" ? "Lease" : "Sale"}</td><td className="r num">{peso(l.price)}{l.kind === "LEASE" ? "/mo" : ""}</td>
              <td><span className={"tag " + ST[l.status]}>{l.status.toLowerCase()}</span></td><td className="r">{l.inquiries.length}</td><td className="hide-m">{l.inquiries.filter((i) => i.viewingAt).length}</td><td className="hide-m">{fmtDate(l.createdAt)}</td></tr>)}</tbody></table></div>
        </div>
      </main>
    </>
  );
}
