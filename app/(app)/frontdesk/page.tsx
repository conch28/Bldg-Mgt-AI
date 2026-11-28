import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Tip from "@/components/Tip";
import { PageHead, Kpi } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, fmtTime, nowManila } from "@/lib/format";
import { checkPass } from "./actions";
import QrScan from "@/components/QrScan";

export const dynamic = "force-dynamic";
const KIND: Record<string, string> = { GUEST: "Guest", PARKING: "Guest parking", DELIVERY: "Delivery", CONTRACTOR: "Contractor", MOVE: "Move in/out", STAY: "Short stay" };

export default async function FrontDesk({ searchParams }: { searchParams: { code?: string; error?: string; ok?: string } }) {
  await requireRole("GUARD", "MANAGER", "ADMIN");
  const now = nowManila();
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const start = new Date(ymd + "T00:00:00+08:00"), end = new Date(start.getTime() + 86400000);
  const [found, expected, inside, amen] = await Promise.all([
    searchParams.code ? prisma.pass.findUnique({ where: { code: searchParams.code }, include: { unit: true, user: true } }) : null,
    prisma.pass.findMany({ where: { validFrom: { lt: end }, validTo: { gte: now }, checkedIn: null }, include: { unit: true }, orderBy: { validFrom: "asc" } }),
    prisma.pass.findMany({ where: { checkedIn: { gte: start }, checkedOut: null }, include: { unit: true }, orderBy: { checkedIn: "desc" } }),
    prisma.amenityBooking.findMany({ where: { status: "CONFIRMED", start: { gte: start, lt: end } }, include: { amenity: true, unit: true }, orderBy: { start: "asc" } }),
  ]);
  const valid = found && found.validFrom <= now && found.validTo >= now;
  return (
    <>
      <PageHead title="Front desk" sub="Scan the visitor's QR or type the 6-letter code. The owner gets a text when they arrive." />
      <main className="view">
        <Tip id="guard-desk" title="Every visitor has a code.">Type it in the box, then tap Check in. No code? Call the unit owner before letting anyone up. SOS alerts show in red at the top.</Tip>
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok === "in" ? "Checked in. The owner has been notified." : "Checked out."}</div>}
        <div className="grid g-7-5">
          <div className="card" data-tour="check">
            <h3>Check a pass</h3>
            <form action={checkPass} className="codebox" style={{ marginTop: 10 }}>
              <input name="code" defaultValue={searchParams.code ?? ""} placeholder="K7Q2MX" autoComplete="off" autoCapitalize="characters" inputMode="text" maxLength={6} aria-label="Pass code" className="pass-code" />
              <input type="hidden" name="action" value="lookup" />
              <SubmitButton label="Look up" busy="Checking…" />
            </form>
            <QrScan />
            {found && (
              <div className={"ann" + (valid ? "" : " urgent")} style={{ marginTop: 14 }}>
                <div className="row"><span className={"tag " + (valid ? "t-ok" : "t-bad")}>{valid ? "Valid" : "Not valid now"}</span><span className="tag t-mut">{KIND[found.kind]}</span>{found.checkedIn && <span className="tag t-acc">In {fmtTime(found.checkedIn)}</span>}</div>
                <div className="row" style={{ gap: 12, alignItems: "center" }}>
                  {found.photo && <img src={found.photo} alt={`Photo of ${found.name}`} className="guest-face" />}
                  <div><h4 style={{ fontSize: 20 }}>{found.name}{found.plate ? ` · ${found.plate}` : ""}</h4>{found.photo && <div className="hint">Check the face matches before letting them up.</div>}</div>
                </div>
                <div>Unit <b>{found.unit.code}</b> · host {found.user.name} · {fmtDate(found.validFrom)}{found.validTo.getTime() - found.validFrom.getTime() > 86400000 ? ` to ${fmtDate(found.validTo)}` : ""}</div>
                {found.note && <div className="hint">Note: {found.note}</div>}
                <div className="row" style={{ marginTop: 10 }}>
                  {valid && !found.checkedIn && <form action={checkPass}><input type="hidden" name="code" value={found.code} /><input type="hidden" name="action" value="in" /><SubmitButton label="Check in" busy="…" /></form>}
                  {found.checkedIn && !found.checkedOut && <form action={checkPass}><input type="hidden" name="code" value={found.code} /><input type="hidden" name="action" value="out" /><SubmitButton label="Check out" busy="…" cls="btn" /></form>}
                </div>
              </div>
            )}
          </div>
          <div className="stack">
            <div className="mini-row"><div className="mini"><b className="n">{expected.length}</b><span>expected<br />today</span></div><div className="mini"><b className="n">{inside.length}</b><span>inside<br />now</span></div></div>
            <div className="card"><h3>Amenities today</h3>
              <div className="list" style={{ marginTop: 6 }}>{amen.length ? amen.map((b) => <div className="li" key={b.id}><span className="tag t-acc">{fmtTime(b.start)}</span><div>{b.amenity.name} · Unit {b.unit.code}{b.guests ? ` · +${b.guests}` : ""}</div></div>) : <div className="hint">None.</div>}</div>
            </div>
          </div>
        </div>
        <div className="grid g2">
          <div className="card" data-tour="expected"><h3>Expected visitors</h3>
            <div className="list" style={{ marginTop: 6 }}>{expected.length ? expected.map((p) => <div className="li" key={p.id}><span className="tag t-mut">{KIND[p.kind]}</span><div style={{ flex: 1 }}>{p.name} → <b>{p.unit.code}</b>{p.plate ? ` · ${p.plate}` : ""}</div><a className="btn sm" href={`/frontdesk?code=${p.code}`}>{p.code}</a></div>) : <div className="empty">No one expected.</div>}</div>
          </div>
          <div className="card"><h3>Inside the building</h3>
            <div className="list" style={{ marginTop: 6 }}>{inside.length ? inside.map((p) => <div className="li" key={p.id}><span className="tag t-ok">{p.checkedIn ? fmtTime(p.checkedIn) : ""}</span><div style={{ flex: 1 }}>{p.name} → <b>{p.unit.code}</b></div><a className="btn sm" href={`/frontdesk?code=${p.code}`}>Check out</a></div>) : <div className="empty">No visitors inside.</div>}</div>
          </div>
        </div>
      </main>
    </>
  );
}
