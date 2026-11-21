import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi, StatusTag } from "@/components/ui";
import SlaTimer from "@/components/SlaTimer";
import SubmitButton from "@/components/SubmitButton";
import { slaStats } from "@/lib/metrics";
import { fmtDateTime } from "@/lib/format";
import { updateWorkOrder, createWorkOrder } from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const FILTERS: Record<string, Prisma.WorkOrderWhereInput> = { open: { status: { not: "DONE" } }, high: { priority: "HIGH", status: { not: "DONE" } }, escalated: { status: "ESCALATED" }, done: { status: "DONE" } };
const STRIPE = { HIGH: "var(--bad)", MEDIUM: "var(--warn)", LOW: "var(--line)" };
const TECHS = ["Rudy M.", "Jun P.", "Vendor: LiftCare", "Vendor: AccessPro", "CleanPro", "Property manager"];

export default async function WorkOrders({ searchParams }: { searchParams: { f?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const f = searchParams.f && FILTERS[searchParams.f] ? searchParams.f : "open";
  const [list, open, sla] = await Promise.all([
    prisma.workOrder.findMany({ where: FILTERS[f], orderBy: [{ createdAt: "desc" }], take: f === "done" ? 50 : 200, include: { events: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.workOrder.count({ where: FILTERS.open }), slaStats(30),
  ]);
  const canEdit = u.role !== "BOARD";
  return (
    <>
      <PageHead title="Work orders" sub="Every request gets a ticket, an owner and a deadline" />
      <main className="view">
        <div className="grid g4">
          <Kpi k="Open tickets" v={open} />
          <Kpi k="Closed within SLA (30 days)" v={`${sla.pct.toFixed(0)}%`} d={<span className="hint">{sla.onTime} of {sla.closed}</span>} />
          <Kpi k="Owner rating" v={`${sla.rating.toFixed(1)} / 5`} d={<span className="hint">{sla.ratedCount} ratings</span>} />
          <Kpi k="Deadlines" v="4h · 24h · 72h" d={<span className="hint">high · medium · low priority</span>} />
        </div>
        <div className="card">
          <div className="cardhead"><div><h3>Tickets</h3><div className="hint">{canEdit ? "Change status or assignee and press Save. Every change is logged." : "Read-only for board members."}</div></div>
            <div className="r">{Object.keys(FILTERS).map((k) => <Link key={k} href={`?f=${k}`} className={"chip" + (k === f ? " on" : "")}>{k[0].toUpperCase() + k.slice(1)}</Link>)}</div></div>
          <div className="tablewrap"><table>
            <thead><tr><th>Ticket</th><th>Location</th><th>Issue</th><th>Priority</th><th>Source</th><th>Status / assignee</th><th className="r">SLA</th></tr></thead>
            <tbody>{list.map((w) => (
              <tr key={w.id} className="wo-row" style={{ ["--stripe" as any]: w.status === "DONE" ? "var(--ok)" : STRIPE[w.priority] }}>
                <td className="mono">WO-{w.number}</td><td>{w.location}</td>
                <td style={{ minWidth: 220 }}>{w.title}<div className="hint">{w.category} · opened {fmtDateTime(w.createdAt)}{w.events[0] ? ` · ${w.events[0].note}` : ""}</div></td>
                <td>{w.priority.toLowerCase()}</td><td className="hint">{w.source}</td>
                <td>{canEdit ? (
                  <form action={updateWorkOrder} className="inline-form">
                    <input type="hidden" name="id" value={w.id} />
                    <select name="status" defaultValue={w.status} aria-label="Status">{["NEW", "ASSIGNED", "IN_PROGRESS", "ESCALATED", "DONE"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</select>
                    <input name="assignee" list="techs" defaultValue={w.assignee ?? ""} placeholder="Assign to" aria-label="Assignee" style={{ width: 120 }} />
                    <SubmitButton label="Save" small cls="btn" />
                  </form>) : <><StatusTag s={w.status} /> <span className="hint">{w.assignee}</span></>}
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
            <SubmitButton label="Open ticket" small />
          </form></div>}
      </main>
    </>
  );
}
