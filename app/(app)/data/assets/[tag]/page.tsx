import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, StatusTag } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { peso, fmtDate, nowManila } from "@/lib/format";
import { verifyAsset, savePm, attachManual, reportFault, saveAsset } from "../../actions";
import AssetFields from "../AssetFields";

export const dynamic = "force-dynamic";
const SRC_LABEL: Record<string, string> = { MANUFACTURER: "Manufacturer's manual", STATUTORY: "Statutory rule", ENGINEER: "Engineer's recommendation", CONTRACT: "Service contract", UNVERIFIED: "Not verified" };
const SPEC_LABEL: Record<string, string> = { NAMEPLATE: "nameplate photo", MANUAL: "manual or datasheet", INVOICE: "invoice", CONTRACTOR: "contractor report", UNKNOWN: "unknown source" };

export default async function AssetPage({ params, searchParams: sp }: { params: { tag: string }; searchParams: { ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN", "GUARD");
  const tag = decodeURIComponent(params.tag);
  const a = await prisma.asset.findUnique({ where: { tag }, include: { replacements: { orderBy: { doneAt: "desc" }, take: 10 } } });
  if (!a) notFound();
  const now = nowManila();
  const staff = u.role === "MANAGER" || u.role === "ADMIN";
  const [pm, allPm, wos, manual, sensors] = await Promise.all([
    prisma.pMTask.findMany({ where: { assetTag: a.tag }, orderBy: { nextDue: "asc" } }),
    staff ? prisma.pMTask.findMany({ where: { assetTag: null }, orderBy: { asset: "asc" } }) : [],
    prisma.workOrder.findMany({ where: { OR: [{ location: a.location }, { title: { contains: a.tag } }] }, orderBy: { createdAt: "desc" }, take: 8, select: { number: true, title: true, status: true, createdAt: true } }),
    a.manualDocId ? prisma.document.findUnique({ where: { id: a.manualDocId }, select: { id: true, title: true } }) : null,
    prisma.sensorReading.findMany({ where: { assetId: a.id }, orderBy: { at: "desc" }, take: 6 }),
  ]);
  const h = headers();
  const url = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/data/assets/${encodeURIComponent(a.tag)}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  const lifeEnd = new Date(a.installedAt.getTime() + a.lifeMonths * 30.44 * 86400000);
  const ageYears = (now.getTime() - a.installedAt.getTime()) / (365.25 * 86400000);
  const missing = [!a.manufacturer && "manufacturer", !a.model && "model", !a.serial && "serial"].filter(Boolean) as string[];
  const facts: [string, React.ReactNode][] = [
    ["Manufacturer", a.manufacturer ?? <span className="t-bad tag">missing</span>], ["Model", a.model ?? <span className="t-bad tag">missing</span>], ["Serial", a.serial ?? <span className="t-bad tag">missing</span>],
    ["Location", a.location], ["Installed", `${fmtDate(a.installedAt)} (${ageYears.toFixed(1)} years ago)`],
    ["Expected life", <>{Math.round(a.lifeMonths / 12)} years, until {fmtDate(lifeEnd)} {lifeEnd < now && <span className="tag t-warn">past life</span>}</>],
    ["Warranty", a.warrantyUntil ? <>{fmtDate(a.warrantyUntil)} {a.warrantyUntil > now ? <span className="tag t-ok">active</span> : <span className="tag t-mut">ended</span>}</> : "None on record"],
    ["Acquisition cost", peso(a.cost)], ["Replacement cost", a.replacementCost != null ? peso(a.replacementCost) : <span className="hint">not estimated yet</span>],
    ["Responsible", a.ownerName ?? <span className="hint">not assigned</span>], ["Service contractor", a.vendor ?? "—"],
  ];
  return (
    <>
      <PageHead title={a.name} sub={`${a.tag} · ${a.category} · ${a.location}`} back="/data/assets" />
      <main className="view">
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span className={"tag " + (a.criticality === "SAFETY" ? "t-bad" : a.criticality === "HIGH" ? "t-warn" : "t-mut")}>{a.criticality === "SAFETY" ? "Safety-critical" : a.criticality === "HIGH" ? "High criticality" : "Normal"}</span>
          <span className={"tag " + (a.status === "FAULTY" ? "t-bad" : "t-ok")}>{a.status === "FAULTY" ? "Faulty" : a.status === "RETIRED" ? "Retired" : "Working"}</span>
          {a.verifiedAt ? <span className="tag t-ok" style={{ whiteSpace: "normal" }}>Specs verified by {a.verifiedBy}, {fmtDate(a.verifiedAt)}, from {SPEC_LABEL[a.specSource ?? "UNKNOWN"]}</span> : <span className="tag t-warn">Specs not verified</span>}
        </div>

        {u.role === "GUARD" && <FaultForm id={a.id} />}
        <div className="grid g-7-5">
          <section className="card" aria-labelledby="facts">
            <h3 id="facts">Details</h3>
            <table><tbody>{facts.map(([k, v]) => <tr key={k}><td className="hint" style={{ width: 160 }}>{k}</td><td>{v}</td></tr>)}</tbody></table>
            {staff && !a.verifiedAt && (
              <form action={verifyAsset} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={a.id} />
                <p className="hint" style={{ margin: "0 0 6px" }}>{missing.length ? `Fill in ${missing.join(", ")} first.` : "Check the nameplate or manual against these details. The person who last edited the record cannot verify it."}</p>
                <SubmitButton label="I checked it: verify specs" cls="btn" />
              </form>
            )}
            <div style={{ marginTop: 12 }}>
              <b>Manual / datasheet: </b>{manual ? <a href={`/api/documents/${manual.id}`}>{manual.title}</a> : <span className="hint">none attached</span>}
              {staff && <form action={attachManual} className="inline-form" style={{ marginTop: 6 }}><input type="hidden" name="id" value={a.id} /><input name="file" type="file" accept=".pdf,image/*" aria-label="Manual file" required /><SubmitButton label={manual ? "Replace" : "Attach"} small cls="btn" /></form>}
            </div>
          </section>
          <section className="card" style={{ textAlign: "center" }} aria-labelledby="qr">
            <h3 id="qr">QR label</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${a.tag}`} width={180} height={180} style={{ background: "#fff", padding: 6, borderRadius: 8 }} />
            <div className="mono" style={{ fontWeight: 700 }}>{a.tag}</div>
            <p className="hint" style={{ fontSize: 12 }}>Staff scan this to open this page. Sign-in is required, so the label shows nothing to outsiders.</p>
            {staff && <FaultForm id={a.id} plain />}
          </section>
        </div>

        <section className="card" style={{ marginTop: 16 }} aria-labelledby="pm">
          <h3 id="pm">Preventive maintenance</h3>
          {!pm.length && <p className={a.criticality === "SAFETY" ? "err" : "hint"}>No schedule linked{a.criticality === "SAFETY" ? ". This is safety-critical equipment: link or add one." : "."}</p>}
          {pm.length > 0 && <div className="tablewrap"><table><thead><tr><th>Task</th><th>Every</th><th>Interval source</th><th>Next due</th><th>By</th></tr></thead>
            <tbody>{pm.map((p) => <tr key={p.id}><td>{p.task}{p.compliance && <span className="tag t-acc" style={{ marginLeft: 6 }}>statutory</span>}</td><td>{p.frequencyDays} days</td>
              <td><span className={"tag " + (p.intervalSource === "UNVERIFIED" ? "t-bad" : "t-ok")}>{SRC_LABEL[p.intervalSource]}</span></td>
              <td><span className={"tag " + (p.nextDue < now ? "t-bad" : "t-mut")}>{fmtDate(p.nextDue)}{p.nextDue < now ? " · overdue" : ""}</span></td><td>{p.vendor ?? p.assignee ?? "—"}</td></tr>)}</tbody></table></div>}
          {staff && (
            <details style={{ marginTop: 10 }}><summary className="hint" style={{ cursor: "pointer" }}>Link or add a schedule</summary>
              <form action={savePm} style={{ marginTop: 8 }}>
                <input type="hidden" name="assetTag" value={a.tag} />
                <div className="formgrid">
                  <div className="field"><label htmlFor="pmid">Existing schedule</label><select id="pmid" name="pmId" defaultValue=""><option value="">New schedule (fill in below)</option>{pm.concat(allPm).map((p) => <option key={p.id} value={p.id}>{p.asset}: {p.task} (every {p.frequencyDays}d)</option>)}</select></div>
                  <div className="field"><label htmlFor="pmsrc">Interval comes from</label><select id="pmsrc" name="intervalSource" defaultValue="MANUFACTURER">{Object.entries(SRC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  <div className="field"><label htmlFor="pmt">New task</label><input id="pmt" name="task" placeholder="Monthly preventive maintenance" /></div>
                  <div className="field"><label htmlFor="pmf">Every (days)</label><input id="pmf" name="frequencyDays" type="number" min="1" /></div>
                  <div className="field"><label htmlFor="pmn">First due</label><input id="pmn" name="nextDue" type="date" /></div>
                  <div className="field"><label htmlFor="pmv">Contractor</label><input id="pmv" name="vendor" defaultValue={a.vendor ?? ""} /></div>
                </div>
                <p className="hint" style={{ fontSize: 12 }}>For safety-critical equipment, take the interval from the manual, a regulation or an engineer. We never make it up.</p>
                <SubmitButton label="Save schedule" cls="btn" />
              </form>
            </details>
          )}
        </section>

        <div className="grid g2" style={{ marginTop: 16 }}>
          <section className="card" aria-labelledby="wo">
            <h3 id="wo">Work orders here</h3>
            {!wos.length && <p className="hint">None on record.</p>}
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{wos.map((w) => <li key={w.number} className="row" style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid var(--line)" }}><span>#{w.number} {w.title}<div className="hint">{fmtDate(w.createdAt)}</div></span><StatusTag s={w.status} /></li>)}</ul>
          </section>
          <section className="card" aria-labelledby="rep">
            <h3 id="rep">Repairs and replacements</h3>
            {!a.replacements.length && <p className="hint">None logged.</p>}
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{a.replacements.map((r) => <li key={r.id} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>{fmtDate(r.doneAt)}: {r.note ?? "Replaced"} <span className="hint">by {r.doneBy}, {r.warrantyClaim ? "free under warranty" : peso(r.cost)}</span></li>)}</ul>
            {sensors.length > 0 && <p className="hint" style={{ marginTop: 10 }}>Live sensors: {[...new Set(sensors.map((s) => s.metric))].join(", ").toLowerCase()}. <Link href="/equipment">See health and forecast →</Link></p>}
          </section>
        </div>

        {staff && (
          <details className="card" style={{ marginTop: 16 }}><summary><b>Edit details</b></summary>
            <p className="hint">Changing make, model, serial, criticality or life clears the verification, so a second person checks again.</p>
            <form action={saveAsset}><AssetFields a={a} /><SubmitButton label="Save changes" /></form>
          </details>
        )}
      </main>
    </>
  );
}

function FaultForm({ id, plain }: { id: string; plain?: boolean }) {
  return (
    <form action={reportFault} className={plain ? "" : "card"} style={{ textAlign: "left", marginTop: plain ? 10 : 0, marginBottom: plain ? 0 : 16 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field"><label htmlFor="fault">Something wrong with it?</label><input id="fault" name="note" placeholder="What did you see or hear?" /></div>
      <SubmitButton label="Report a fault" cls="btn pri" />
    </form>
  );
}
