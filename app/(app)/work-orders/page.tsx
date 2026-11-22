import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi, StatusTag } from "@/components/ui";
import SlaTimer from "@/components/SlaTimer";
import SubmitButton from "@/components/SubmitButton";
import { slaStats } from "@/lib/metrics";
import { fmtDateTime } from "@/lib/format";
import { updateWorkOrder, createWorkOrder, closeWithPhoto, verifyWorkOrder, makeJobLink } from "./actions";
import PhotoField from "@/components/PhotoField";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const FILTERS: Record<string, Prisma.WorkOrderWhereInput> = { open: { status: { not: "DONE" } }, high: { priority: "HIGH", status: { not: "DONE" } }, escalated: { status: "ESCALATED" }, done: { status: "DONE" } };
const STRIPE = { HIGH: "var(--bad)", MEDIUM: "var(--warn)", LOW: "var(--line)" };
const TECHS = ["Rudy M.", "Jun P.", "Vendor: LiftCare", "Vendor: AccessPro", "CleanPro", "Property manager"];

export default async function WorkOrders({ searchParams }: { searchParams: { f?: string; wo?: string; ok?: string; error?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const one = Number(searchParams.wo) || 0;
  const f = one ? "one" : searchParams.f && FILTERS[searchParams.f] ? searchParams.f : "open";
  const h = headers(); const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const backTo = one ? `/work-orders?wo=${one}` : `/work-orders?f=${f}`;
  const [list, open, sla] = await Promise.all([
    prisma.workOrder.findMany({ where: one ? { number: one } : FILTERS[f], orderBy: [{ createdAt: "desc" }], take: f === "done" ? 50 : 200, include: { events: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.workOrder.count({ where: FILTERS.open }), slaStats(30),
  ]);
  const canEdit = u.role !== "BOARD";
  return (
    <>
      <PageHead title="Work orders" sub="Every request gets a ticket, a person and a deadline." />
      <main className="view">
        <div className="grid g4">
          <Kpi k="Open tickets" v={open} />
          <Kpi k="Closed within SLA (30 days)" v={`${sla.pct.toFixed(0)}%`} d={<span className="hint">{sla.onTime} of {sla.closed}</span>} />
          <Kpi k="Owner rating" v={`${sla.rating.toFixed(1)} / 5`} d={<span className="hint">{sla.ratedCount} ratings</span>} />
          <div className="hide-m" style={{ display: "contents" }}><Kpi k="Deadlines" v="4h · 24h · 72h" d={<span className="hint">high · medium · low priority</span>} /></div>
        </div>
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        <div className="card">
          <div className="cardhead"><div><h3>{one ? `WO-${one}` : "Tickets"}</h3><div className="hint">{canEdit ? "Assign a person, send the job link. The technician closes it with an after photo; you verify within 24h." : "Read-only for board members."}</div></div>
            <div className="r">{Object.keys(FILTERS).map((k) => <Link key={k} href={`?f=${k}`} className={"chip" + (k === f ? " on" : "")}>{k[0].toUpperCase() + k.slice(1)}</Link>)}</div></div>
          <div className="tablewrap"><table className="stack-m">
            <thead><tr><th>Ticket</th><th>Location</th><th>Issue</th><th>Priority</th><th>Source</th><th>Status / assignee</th><th className="r">SLA</th></tr></thead>
            <tbody>{list.map((w) => (
              <tr key={w.id} className="wo-row" style={{ ["--stripe" as any]: w.status === "DONE" ? "var(--ok)" : STRIPE[w.priority] }}>
                <td className="mono">WO-{w.number}</td><td>{w.location}</td>
                <td className="grow" style={{ minWidth: 220 }}><b>{w.title}</b><div className="hint">{w.category} · opened {fmtDateTime(w.createdAt)}{w.events[0] ? ` · ${w.events[0].note}` : ""}</div>
                  {w.photo && <details style={{ marginTop: 4 }}><summary className="hint" style={{ cursor: "pointer" }}>📷 Resident photo{w.aiNote ? ` · ${w.aiNote}` : ""}</summary><img src={w.photo} alt={`Photo for WO-${w.number}`} style={{ maxWidth: 260, borderRadius: 8, marginTop: 6 }} /></details>}</td>
                <td><span className={"tag " + (w.priority === "HIGH" ? "t-bad" : w.priority === "MEDIUM" ? "t-warn" : "t-mut")}>{w.priority.toLowerCase()}</span></td><td className="hint hide-m">{w.source}</td>
                <td className="grow">{canEdit ? (
                  <form action={updateWorkOrder} className="inline-form">
                    <input type="hidden" name="id" value={w.id} />
                    <select name="status" defaultValue={w.status} aria-label="Status">{["NEW", "ASSIGNED", "IN_PROGRESS", "ESCALATED", "DONE"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</select>
                    <input name="assignee" list="techs" defaultValue={w.assignee ?? ""} placeholder="Assign to" aria-label="Assignee" style={{ width: 120 }} />
                    <input type="hidden" name="back" value={backTo} />
                    <SubmitButton label="Save" small cls="btn" />
                  </form>) : <><StatusTag s={w.status} /> <span className="hint">{w.assignee}</span></>}
                  <Proof w={w} canEdit={canEdit} origin={origin} backTo={backTo} />
                </td>
                <td className="r">{w.status === "DONE" && w.closedAt ? <span className="tag t-ok">Closed in {Math.round((w.closedAt.getTime() - w.createdAt.getTime()) / 36e5 * 10) / 10}h</span> : <SlaTimer deadline={w.createdAt.getTime() + w.slaHours * 3600000} />}</td>
              </tr>))}
              {!list.length && <tr><td colSpan={7} className="hint">No tickets in this view.</td></tr>}
            </tbody></table></div>
          <datalist id="techs">{TECHS.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        {canEdit && <div className="card"><h3>Open a ticket</h3><div className="hint">For walk-ins, phone calls and inspections. Owners can also file tickets from the helpdesk chat.</div>
          <form action={createWorkOrder} className="inline-form" style={{ marginTop: 12 }}>
            <input name="title" required placeholder="What's wrong?" aria-label="Title" style={{ minWidth: 220, flex: 1 }} />
            <input name="location" required placeholder="Unit or area" aria-label="Location" style={{ width: 120 }} />
            <select name="category" aria-label="Category">{["Plumbing", "Electrical", "Civil", "Mechanical", "Elevator", "Security", "Housekeeping", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
            <select name="priority" defaultValue="MEDIUM" aria-label="Priority"><option value="HIGH">High (4h)</option><option value="MEDIUM">Medium (24h)</option><option value="LOW">Low (72h)</option></select>
            <input name="assignee" list="techs" placeholder="Assign to" aria-label="Assign to" style={{ width: 130 }} />
            <select name="source" aria-label="Source"><option>Walk-in</option><option>Phone</option><option>Inspection</option><option>Guard report</option></select>
            <input type="hidden" name="back" value="/work-orders" />
            <SubmitButton label="Open ticket" small />
          </form></div>}
      </main>
    </>
  );
}

type WO = Awaited<ReturnType<typeof prisma.workOrder.findMany>>[number];
/** Completion proof, the job link for the technician, and the manager's verify step. */
function Proof({ w, canEdit, origin, backTo }: { w: WO; canEdit: boolean; origin: string; backTo: string }) {
  const hid = <><input type="hidden" name="id" value={w.id} /><input type="hidden" name="back" value={backTo} /></>;
  if (w.status === "DONE") return (
    <div className="wo-proof">
      {w.donePhoto ? <a href={w.donePhoto} target="_blank" rel="noreferrer"><img src={w.donePhoto} alt={`After photo for WO-${w.number}`} /></a> : <span className="tag t-warn">No after photo</span>}
      <div className="hint" style={{ flex: 1, minWidth: 140 }}>{w.doneBy ? <>Done by <b>{w.doneBy}</b>. </> : null}{w.doneNote}
        {w.verifiedAt ? <div><span className="tag t-ok">Verified by {w.verifiedBy}</span></div> : null}</div>
      {!w.verifiedAt && canEdit && <div className="row">
        <form action={verifyWorkOrder}>{hid}<SubmitButton label="Verify" small /></form>
        <details><summary className="btn sm">Send back</summary><form action={verifyWorkOrder} className="inline-form" style={{ marginTop: 6 }}>{hid}<input type="hidden" name="decision" value="reject" /><input name="note" placeholder="What still needs fixing?" aria-label="What still needs fixing" required /><SubmitButton label="Send back" small cls="btn" /></form></details>
      </div>}
    </div>);
  if (!canEdit) return null;
  const link = w.jobToken ? `${origin}/j/${w.jobToken}` : "";
  const msg = `Skyland job WO-${w.number}: ${w.title} at ${w.location}. Open, tap I'm on it, then Done with a photo: ${link}`;
  return (
    <div className="wo-proof">
      {w.assignee && (link ? <><a className="btn sm" href={`sms:?&body=${encodeURIComponent(msg)}`}>Text job link</a><a className="btn sm" href={`viber://forward?text=${encodeURIComponent(msg)}`}>Viber</a><a className="hint" href={link} target="_blank" rel="noreferrer">Open link</a></>
        : <form action={makeJobLink}>{hid}<SubmitButton label="Create job link" small cls="btn" /></form>)}
      <details><summary className="btn sm">Close with photo</summary>
        <form action={closeWithPhoto} className="stack" style={{ marginTop: 6 }}>{hid}
          <PhotoField label="After photo" required />
          <input name="doneBy" defaultValue={w.assignee ?? ""} placeholder="Who did the work?" aria-label="Who did the work" />
          <input name="note" placeholder="What was done (optional)" aria-label="What was done" maxLength={600} />
          <SubmitButton label="Mark done" small />
        </form></details>
    </div>);
}
