import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, nowManila } from "@/lib/format";
import { book } from "./actions";

export const dynamic = "force-dynamic";

export default async function Services({ searchParams }: { searchParams: { booked?: string; error?: string } }) {
  await requireRole("OWNER");
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { price: "asc" } });
  // first bookable day: tomorrow, skipping Sunday
  let d = new Date(nowManila().getTime() + 86400000);
  if (new Date(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) + "T12:00:00+08:00").getUTCDay() === 0) d = new Date(d.getTime() + 86400000);
  const tomorrow = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <>
      <PageHead title="In-unit services" sub="Vetted vendors at board-approved rates. Charged to your monthly statement." />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.booked && <div className="okmsg">Booked: {searchParams.booked}. The vendor&apos;s gate pass has been sent to the lobby. See it under My unit.</div>}
        <div className="grid g3">{services.map((s) => (
          <div className="card svc" key={s.id}>
            <h3>{s.name}</h3><div className="hint">{s.detail}</div>
            <div><span className="price num">{peso(s.price)}</span> <span className="hint">{s.unitLabel}</span></div>
            <div className="hint" style={{ fontSize: 12 }}>{s.vendor} · Mon–Sat</div>
            <form action={book} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              <input type="hidden" name="serviceId" value={s.id} />
              <div className="inline-form">
                <input type="date" name="date" required min={tomorrow} defaultValue={tomorrow} aria-label="Date" />
                <select name="time" aria-label="Time"><option value="09:00">9:00 AM</option><option value="11:00">11:00 AM</option><option value="13:00">1:00 PM</option><option value="15:00">3:00 PM</option></select>
                <select name="qty" aria-label="Quantity">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>× {n}</option>)}</select>
              </div>
              <div><SubmitButton label="Book" busy="Booking…" small /></div>
            </form>
          </div>))}
        </div>
      </main>
    </>
  );
}
