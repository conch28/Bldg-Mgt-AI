import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate } from "@/lib/format";
import { priceCheck, CHANNEL_LABEL, FURNISH } from "@/lib/property";
import { createListing } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewListing({ searchParams }: { searchParams: { unit?: string; kind?: string; beds?: string; furnished?: string; error?: string } }) {
  const u = await requireRole("OWNER");
  const units = await prisma.unit.findMany({ where: { ownerId: u.id }, orderBy: { code: "asc" } });
  if (!units.length) redirect("/property");
  const unit = units.find((x) => x.id === searchParams.unit) ?? units[0];
  const kind = searchParams.kind === "SALE" ? "SALE" : "LEASE";
  const beds = searchParams.beds != null ? Math.max(0, Math.min(4, Number(searchParams.beds) || 0)) : Number(unit.sqm) > 40 ? 1 : 0;
  const furnished = ["BARE", "SEMI", "FULL"].includes(searchParams.furnished ?? "") ? searchParams.furnished! : "SEMI";
  const pc = await priceCheck(kind, { sqm: Number(unit.sqm), floor: unit.floor }, beds, furnished);
  const per = kind === "LEASE" ? "/mo" : "";
  const pos = (v: number) => `${Math.max(4, Math.min(96, ((v - pc.low * 0.9) / (pc.high * 1.1 - pc.low * 0.9)) * 100))}%`;
  const q = (o: Record<string, string | number>) => "?" + new URLSearchParams({ unit: unit.id, kind, beds: String(beds), furnished, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <>
      <PageHead title={kind === "LEASE" ? "Rent out your unit" : "Sell your unit"} sub="Step 1 of 2 · AI price check" right={<Link href="/property" className="btn sm">Cancel</Link>} />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className="card stack">
          {units.length > 1 && <div className="tabs">{units.map((x) => <Link key={x.id} href={`?unit=${x.id}&kind=${kind}`} className={"chip" + (x.id === unit.id ? " on" : "")}>Unit {x.code}</Link>)}</div>}
          <div className="tabs"><Link href={q({ kind: "LEASE" })} className={"chip" + (kind === "LEASE" ? " on" : "")}>Rent out</Link><Link href={q({ kind: "SALE" })} className={"chip" + (kind === "SALE" ? " on" : "")}>Sell</Link></div>
          <div className="tabs">{[0, 1, 2].map((b) => <Link key={b} href={q({ beds: b })} className={"chip" + (beds === b ? " on" : "")}>{b === 0 ? "Studio" : `${b} bedroom${b > 1 ? "s" : ""}`}</Link>)}</div>
          <div className="tabs">{Object.entries(FURNISH).map(([k, l]) => <Link key={k} href={q({ furnished: k })} className={"chip" + (furnished === k ? " on" : "")}>{l}</Link>)}</div>
        </div>

        <div className="card">
          <span className="ai-badge">AI price check · Unit {unit.code}</span>
          <div className="hint" style={{ marginTop: 6 }}>Suggested {kind === "LEASE" ? "monthly rent" : "asking price"}</div>
          <div className="price-big num">{peso(pc.low)} – {peso(pc.high)}{per}</div>
          <div className="price-band" aria-hidden="true">
            <span className="mk" style={{ left: pos(pc.mid) }}>Best price {peso(pc.mid)}</span>
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>{pc.note} Units priced in this range usually {kind === "LEASE" ? "lease" : "sell"} in about {pc.daysEstimate} days.</p>
          <div className="mini-row" style={{ marginTop: 12 }}>
            <div className="mini"><b className="n">{pc.counts.deals}</b><span>closed Skyland<br />deals</span></div>
            <div className="mini"><b className="n">{pc.counts.same}</b><span>listed now in<br />Skyland</span></div>
            <div className="mini"><b className="n">{pc.counts.nearby}</b><span>listed within<br />1 km</span></div>
          </div>
        </div>

        <div className="card"><h3>Similar units we compared</h3>
          <div className="list" style={{ marginTop: 4 }}>{pc.comps.map((c) => (
            <div className="li" key={c.id}><span className={"tag " + (c.source === "SKYLAND_DEAL" ? "t-ok" : c.source === "SKYLAND_LISTING" ? "t-acc" : "t-mut")}>{c.label}</span>
              <div style={{ flex: 1 }}><b className="num">{peso(c.price)}{per}</b><div className="hint">{c.building} · {c.beds === 0 ? "Studio" : `${c.beds}BR`} · {c.sqm} sqm · {peso(c.perSqm)}/sqm · {fmtDate(c.date)}</div></div></div>))}
          </div>
        </div>

        <form action={createListing} className="card stack">
          <h3>Step 2 · Your price and where to post</h3>
          <input type="hidden" name="unitId" value={unit.id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="beds" value={beds} /><input type="hidden" name="furnished" value={furnished} />
          <div className="field"><label htmlFor="price">{kind === "LEASE" ? "Monthly rent (₱)" : "Asking price (₱)"}</label><input id="price" name="price" type="number" inputMode="numeric" defaultValue={pc.mid} min={1} required /></div>
          <div className="field"><label htmlFor="notes">Anything special? (optional)</label><textarea id="notes" name="notes" rows={3} placeholder="e.g. new aircon, city view, with parking slot, available Jan 1" /></div>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}><legend className="hint" style={{ marginBottom: 6 }}>Post to</legend>
            {Object.entries(CHANNEL_LABEL).map(([k, l]) => <label key={k} className="row"><input type="checkbox" name="channels" value={k} defaultChecked /> {l}</label>)}
          </fieldset>
          <SubmitButton label="Let AI write my listing" busy="Writing your listing…" />
          <div className="hint">Nothing is posted yet. You'll see the listing first and approve it with one tap.</div>
        </form>
      </main>
    </>
  );
}
