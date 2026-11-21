import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDateTime, fmtTime, nowManila } from "@/lib/format";
import { bookAmenity, cancelAmenity } from "./actions";

export const dynamic = "force-dynamic";
const DOW = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const h12 = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

export default async function Amenities({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN");
  const now = nowManila();
  const owner = u.role === "OWNER";
  const amenities = await prisma.amenity.findMany({ orderBy: { name: "asc" } });
  const week = new Date(now.getTime() + 7 * 86400000);
  const bookings = await prisma.amenityBooking.findMany({
    where: { status: "CONFIRMED", start: { gte: new Date(now.getTime() - 3600000) }, ...(owner ? { userId: u.id } : { start: { gte: new Date(now.getTime() - 3600000), lt: week } }) },
    orderBy: { start: "asc" }, include: { amenity: true, unit: true }, take: 60,
  });
  const tomorrow = ymd(new Date(now.getTime() + 86400000));
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(now.getTime() + i * 86400000)));

  return (
    <>
      <PageHead title={owner ? "Book an amenity" : "Amenity bookings"} sub={owner ? "Reserve the pool, function room, gym and more. Confirmed instantly." : "This week's reservations across all amenities."} />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {owner && <div className="grid g3">{amenities.map((a) => (
          <div className="card svc" key={a.id}>
            <h3>{a.name}</h3><div className="hint">{a.detail}</div>
            <div className="row"><span className="price num">{Number(a.fee) ? peso(a.fee) : "Free"}</span><span className="hint">{Number(a.fee) ? `per ${a.slotHours}-hour slot` : `${a.slotHours}-hour slot`} · up to {a.capacity}</span></div>
            <div className="hint" style={{ fontSize: 12 }}>{h12(a.openHour)} to {h12(a.closeHour)}{a.closedDow != null ? ` · closed ${DOW[a.closedDow]}` : ""}</div>
            {a.rules && <div className="hint" style={{ fontSize: 12 }}>{a.rules}</div>}
            <form action={bookAmenity} className="inline-form" style={{ marginTop: 6 }}>
              <input type="hidden" name="amenityId" value={a.id} />
              <input type="date" name="date" required min={ymd(now)} defaultValue={tomorrow} aria-label="Date" />
              <select name="hour" aria-label="Start time">{Array.from({ length: Math.max(0, (a.closeHour - a.openHour) / a.slotHours) }, (_, i) => a.openHour + i * a.slotHours).map((h) => <option key={h} value={h}>{h12(h)}</option>)}</select>
              <select name="guests" aria-label="Guests">{[0, 1, 2, 3, 4, 6, 10, 20, 30, 50].filter((g) => g + 1 <= a.capacity).map((g) => <option key={g} value={g}>{g ? `+${g} guests` : "Just me"}</option>)}</select>
              <SubmitButton label="Book" busy="Booking…" small />
            </form>
          </div>))}
        </div>}

        {owner ? (
          <div className="card"><h3>My upcoming bookings</h3>
            <div className="list" style={{ marginTop: 6 }}>{bookings.length ? bookings.map((b) => (
              <div className="li" key={b.id}><span className="tag t-acc">{b.amenity.name}</span><div style={{ flex: 1 }}>{fmtDateTime(b.start)} to {fmtTime(b.end)}{b.guests ? ` · +${b.guests} guests` : ""}</div>
                <form action={cancelAmenity}><input type="hidden" name="id" value={b.id} /><button className="btn sm">Cancel</button></form></div>)) : <div className="empty">No bookings yet. Pick an amenity above.</div>}</div>
          </div>
        ) : (
          <div className="card"><h3>Next 7 days</h3>
            <div className="cal" style={{ marginTop: 10 }}>{days.map((d, i) => {
              const list = bookings.filter((b) => ymd(b.start) === d);
              return <div key={d} className={"d" + (i === 0 ? " today" : "")}><div className="dn">{new Date(d + "T12:00:00+08:00").toLocaleDateString("en-PH", { weekday: "short", day: "numeric" })}</div>
                {list.map((b) => <span key={b.id} className="ev" title={`${b.amenity.name} · ${b.unit.code}`}>{fmtTime(b.start)} {b.amenity.name} · {b.unit.code}</span>)}</div>;
            })}</div>
            <div className="tablewrap" style={{ marginTop: 14 }}><table><thead><tr><th>When</th><th>Amenity</th><th>Unit</th><th className="r">Guests</th><th></th></tr></thead>
              <tbody>{bookings.map((b) => <tr key={b.id}><td>{fmtDateTime(b.start)}</td><td>{b.amenity.name}</td><td>{b.unit.code}</td><td className="r num">{b.guests}</td>
                <td className="r"><form action={cancelAmenity}><input type="hidden" name="id" value={b.id} /><button className="btn sm">Cancel</button></form></td></tr>)}</tbody></table></div>
          </div>
        )}
      </main>
    </>
  );
}
