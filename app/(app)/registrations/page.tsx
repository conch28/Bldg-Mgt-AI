import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/format";
import { decide, register } from "./actions";

export const dynamic = "force-dynamic";
const TAG: Record<string, string> = { PENDING: "t-warn", APPROVED: "t-ok", REJECTED: "t-bad" };

export default async function Registrations({ searchParams }: { searchParams: { error?: string; sent?: string; q?: string } }) {
  const u = await requireRole("OWNER", "MANAGER", "ADMIN", "GUARD");
  const owner = u.role === "OWNER", mgr = u.role === "MANAGER" || u.role === "ADMIN";
  const q = (searchParams.q ?? "").trim();
  const regs = await prisma.registration.findMany({
    where: owner ? { userId: u.id } : q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sticker: { contains: q, mode: "insensitive" } }, { unit: { code: { equals: q.toUpperCase() } } }] } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 60, include: { unit: true },
  });
  return (
    <>
      <PageHead title="Pets & vehicles" sub={owner ? "Register once. The guard sees it, so no more questions at the gate." : "Registered pets and vehicles. Search by plate, pet name, sticker or unit."} />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.sent && <div className="okmsg">Sent! The admin office reviews it within a day.</div>}
        {!owner && <form className="row"><input className="inline-input" name="q" defaultValue={q} placeholder="Plate, pet name, sticker or unit" style={{ flex: 1 }} /><button className="btn">Search</button></form>}
        <div className="card"><h3>{owner ? "My registrations" : `${regs.length} shown`}</h3>
          <div className="list" style={{ marginTop: 4 }}>{regs.length ? regs.map((r) => (
            <div className="li" key={r.id}><span className="tag t-mut">{r.kind === "PET" ? "Pet" : "Vehicle"}</span>
              <div style={{ flex: 1 }}><b className={r.kind === "VEHICLE" ? "mono" : ""}>{r.name}</b>{!owner && <> · {r.unit.code}</>}<div className="hint">{r.details}{r.sticker ? ` · sticker ${r.sticker}` : ""} · {fmtDate(r.createdAt)}</div></div>
              <span className={"tag " + TAG[r.status]}>{r.status.toLowerCase()}</span>
              {mgr && r.status === "PENDING" && <form action={decide} className="row"><input type="hidden" name="id" value={r.id} /><button name="ok" value="1" className="btn sm pri">Approve</button><button name="ok" value="0" className="btn sm">Reject</button></form>}
            </div>)) : <div className="empty">Nothing registered yet.</div>}</div>
        </div>
        {owner && <div className="grid g2">
          <form action={register} className="card stack"><h3>Register a pet</h3><input type="hidden" name="kind" value="PET" />
            <div className="field"><label htmlFor="pn">Pet's name</label><input id="pn" name="name" required placeholder="Mochi" /></div>
            <div className="field"><label htmlFor="pd">Type, breed and vaccination</label><input id="pd" name="details" required placeholder="Dog, Shih Tzu, anti-rabies until Mar 2027" /></div>
            <div className="hint">House rules: small pets only, leashed in common areas, service elevator only.</div>
            <SubmitButton label="Register pet" busy="Sending…" /></form>
          <form action={register} className="card stack"><h3>Register a vehicle</h3><input type="hidden" name="kind" value="VEHICLE" />
            <div className="field"><label htmlFor="vn">Plate number</label><input id="vn" name="name" required placeholder="NCX 4821" /></div>
            <div className="field"><label htmlFor="vd">Car and parking slot</label><input id="vd" name="details" required placeholder="White Toyota Vios · slot B2-118" /></div>
            <SubmitButton label="Register vehicle" busy="Sending…" /></form>
        </div>}
      </main>
    </>
  );
}
