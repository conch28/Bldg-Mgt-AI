import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate, fmtDateTime, nowManila } from "@/lib/format";
import { createPass, revokePass } from "./actions";

export const dynamic = "force-dynamic";
const KIND: Record<string, string> = { GUEST: "Guest", DELIVERY: "Delivery", CONTRACTOR: "Contractor / worker", MOVE: "Move in / move out", STAY: "Short-stay guest (Airbnb)" };

export default async function Passes({ searchParams }: { searchParams: { new?: string; error?: string } }) {
  const u = await requireRole("OWNER");
  const now = nowManila();
  const passes = await prisma.pass.findMany({ where: { userId: u.id }, orderBy: { validFrom: "desc" }, take: 20, include: { unit: true } });
  const fresh = passes.find((p) => p.id === searchParams.new);
  const qr = fresh ? await QRCode.toString(`SKYLAND-PASS:${fresh.code}`, { type: "svg", margin: 0 }) : "";
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <>
      <PageHead title="Guest & stay passes" sub="Create a pass, then send the code to your visitor. The guard checks it at the lobby, no more calls to your unit." />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {fresh && (
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <div className="row" style={{ gap: 24, alignItems: "center" }}>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="stack" style={{ gap: 6 }}>
                <span className="tag t-ok" style={{ alignSelf: "flex-start" }}>Pass ready</span>
                <div className="pass-code">{fresh.code}</div>
                <div>{KIND[fresh.kind]} · <b>{fresh.name}</b>{fresh.plate ? ` · ${fresh.plate}` : ""} → Unit {fresh.unit.code}</div>
                <div className="hint">Valid {fmtDate(fresh.validFrom)}{fresh.validTo.getTime() - fresh.validFrom.getTime() > 86400000 ? ` to ${fmtDate(fresh.validTo)}` : ""}. Send your visitor this code or a screenshot of the QR.</div>
              </div>
            </div>
          </div>
        )}
        <details className="card">
          <summary style={{ cursor: "pointer" }}><b>Short-term rental (Airbnb) house rules</b> <span className="hint">· tap to read</span></summary>
          <ol className="hint" style={{ margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Register every short-stay guest here at least 24 hours before check-in, with the number of guests.</li>
            <li>Maximum 2 guests per studio and 4 per 1-bedroom. Minimum stay of 2 nights.</li>
            <li>Guests show the pass code and a valid ID at the lobby; no key handovers at the guard house.</li>
            <li>Pool and gym are for registered guests only, with the same hours as residents.</li>
            <li>Quiet hours 10 PM to 7 AM. The owner is responsible for guests' conduct and any damage.</li>
            <li>Unregistered guests: ₱5,000 fine per stay; three violations suspend short-stay hosting for 6 months.</li>
          </ol>
        </details>
        <div className="grid g-7-5">
          <div className="card"><h3>New pass</h3>
            <form action={createPass} style={{ marginTop: 8 }}>
              <div className="formgrid">
                <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind">{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div className="field"><label htmlFor="name">Visitor or courier name</label><input id="name" name="name" required placeholder="Juan dela Cruz / Lalamove" /></div>
                <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" name="date" min={today} defaultValue={today} required /></div>
                <div className="field"><label htmlFor="days">Valid for</label><select id="days" name="days">{[1, 2, 3, 5, 7, 14, 30].map((d) => <option key={d} value={d}>{d === 1 ? "1 day" : `${d} days`}</option>)}</select></div>
                <div className="field"><label htmlFor="plate">Plate number (optional)</label><input id="plate" name="plate" placeholder="ABC 1234" /></div>
                <div className="field"><label htmlFor="note">Note for the guard (optional)</label><input id="note" name="note" placeholder="Leave parcel at lobby" /></div>
              </div>
              <SubmitButton label="Create pass" busy="Creating…" />
            </form>
          </div>
          <div className="card"><h3>My passes</h3>
            <div className="list" style={{ marginTop: 6 }}>{passes.length ? passes.map((p) => {
              const active = p.validTo > now;
              return <div className="li" key={p.id}><span className={"tag " + (p.checkedIn ? "t-ok" : active ? "t-acc" : "t-mut")}>{p.checkedIn ? (p.checkedOut ? "Left" : "Arrived") : active ? "Active" : "Expired"}</span>
                <div style={{ flex: 1 }}><b className="mono">{p.code}</b> · {p.name}<div className="hint">{KIND[p.kind]} · {fmtDate(p.validFrom)}{p.checkedIn ? ` · in ${fmtDateTime(p.checkedIn)}` : ""}</div></div>
                {active && !p.checkedIn && <form action={revokePass}><input type="hidden" name="id" value={p.id} /><button className="btn sm">Revoke</button></form>}</div>;
            }) : <div className="empty">No passes yet.</div>}</div>
          </div>
        </div>
      </main>
    </>
  );
}
