import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { URGENT_TEMPLATES, audienceLabel, CHANNELS, sendDueScheduled } from "@/lib/comms";
import { channelStatus } from "@/lib/notify";
import { aiEnabled } from "@/lib/ai";
import { fmtDateTime, nowManila } from "@/lib/format";
import { sendUrgent, aiDraft, saveAnnouncement, runNow } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Maintenance notice", "Monthly newsletter", "Dues reminder", "Assembly / meeting notice", "Policy reminder", "Event", "Amenity update", "Construction / renovation"];
const CH_LABEL: Record<string, string> = { APP: "In-app", SMS: "SMS", EMAIL: "Email", MESSENGER: "Messenger" };

function Audience({ value = "ALL" }: { value?: string }) {
  const [kind, extra] = value.includes(":") ? value.split(":") : [value, ""];
  return (
    <div className="field"><label>Who gets it</label>
      <div className="inline-form">
        <select name="audience" defaultValue={kind} aria-label="Audience">
          <option value="ALL">All owners</option><option value="FLOORS">Specific floors</option><option value="UNITS">Specific units</option>
          <option value="OVERDUE">Owners with overdue dues</option><option value="BOARD">Board and manager only</option>
        </select>
        <input name="audienceValue" defaultValue={extra} placeholder="e.g. 12,14 or 1202B,903A" aria-label="Floors or units" style={{ flex: 1, minWidth: 120 }} />
      </div>
    </div>
  );
}
function Channels({ value = ["APP", "SMS", "EMAIL"] }: { value?: string[] }) {
  const live = channelStatus() as Record<string, boolean>;
  return (
    <div className="field"><label>Send by</label>
      <div className="row">{CHANNELS.map((c) => (
        <label key={c} className="row" style={{ gap: 5, fontSize: 13 }}><input type="checkbox" name="channels" value={c} defaultChecked={value.includes(c)} />{CH_LABEL[c]}
          {c !== "APP" && !live[c] && <span className="pill-ch" title="Not connected yet: messages are logged, not sent">log only</span>}</label>))}
      </div>
    </div>
  );
}

export default async function Comms({ searchParams }: { searchParams: { edit?: string; ok?: string; error?: string; tab?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const canAct = u.role !== "BOARD";
  await sendDueScheduled();
  const now = nowManila();
  const monthStart = new Date(now.getTime() - 30 * 86400000);
  const [queue, scheduled, sent, editing, stats, owners] = await Promise.all([
    prisma.announcement.findMany({ where: { status: { in: ["PENDING_APPROVAL", "DRAFT"] } }, orderBy: { createdAt: "desc" } }),
    prisma.announcement.findMany({ where: { status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" } }),
    prisma.announcement.findMany({ where: { status: "SENT", kind: { in: ["URGENT", "ROUTINE", "REMINDER"] } }, orderBy: { sentAt: "desc" }, take: 15, include: { deliveries: { select: { channel: true, status: true, readAt: true } } } }),
    searchParams.edit ? prisma.announcement.findUnique({ where: { id: searchParams.edit } }) : null,
    prisma.delivery.groupBy({ by: ["channel"], where: { createdAt: { gte: monthStart } }, _count: true }),
    prisma.user.count({ where: { role: "OWNER", active: true } }),
  ]);
  const autoCount = await prisma.announcement.count({ where: { kind: "TICKET", createdAt: { gte: monthStart } } });
  const total = stats.reduce((s, x) => s + x._count, 0);
  const live = channelStatus();

  return (
    <>
      <PageHead title="Resident updates" sub="Urgent alerts go out instantly from templates. Routine updates are drafted by AI, approved by you, then sent or scheduled."
        right={canAct && <form action={runNow}><SubmitButton label="Run automations now" busy="Running…" cls="btn" small /></form>} />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <div className="grid g4">
          <Kpi k="Waiting for approval" v={queue.length} cls={queue.length ? "amber" : ""} d="AI drafts and automatic reminders" />
          <Kpi k="Scheduled" v={scheduled.length} d={scheduled[0]?.scheduledAt ? `Next: ${fmtDateTime(scheduled[0].scheduledAt)}` : "Nothing scheduled"} />
          <Kpi k="Messages, last 30 days" v={total.toLocaleString()} d={stats.map((s) => `${CH_LABEL[s.channel]} ${s._count}`).join(" · ") || "None yet"} />
          <Kpi k="Automatic ticket updates" v={autoCount} d={`${owners} owners reachable`} />
        </div>

        {editing && canAct && (
          <div className="card" id="review" style={{ borderColor: "var(--accent)" }}>
            <div className="cardhead"><div><h3>Review before sending</h3><div className="hint">{editing.aiDrafted ? "Drafted by AI from your notes. " : ""}Check the facts, then approve. Owners who chose Taglish get the Taglish version.</div></div>
              <div className="r"><span className="tag t-acc">{editing.category}</span>{editing.aiDrafted && <span className="tag t-ok">AI draft</span>}</div></div>
            <form action={saveAnnouncement} className="stack">
              <input type="hidden" name="id" value={editing.id} />
              <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" defaultValue={editing.title} required /></div>
              <div className="grid g2">
                <div className="field"><label htmlFor="bodyEn">Message (English)</label><textarea id="bodyEn" name="bodyEn" rows={9} defaultValue={editing.bodyEn} required /></div>
                <div className="field"><label htmlFor="bodyTl">Message (Taglish)</label><textarea id="bodyTl" name="bodyTl" rows={9} defaultValue={editing.bodyTl ?? ""} /></div>
                <div className="field"><label htmlFor="smsEn">SMS (English, short)</label><textarea id="smsEn" name="smsEn" rows={3} maxLength={450} defaultValue={editing.smsEn ?? ""} /></div>
                <div className="field"><label htmlFor="smsTl">SMS (Taglish, short)</label><textarea id="smsTl" name="smsTl" rows={3} maxLength={450} defaultValue={editing.smsTl ?? ""} /></div>
              </div>
              <div className="grid g2"><Audience value={editing.audience} /><Channels value={editing.channels} /></div>
              <div className="row">
                <button className="btn pri" name="intent" value="send">Approve and send now</button>
                <span className="hint">or</span>
                <input type="datetime-local" name="when" aria-label="Send at" className="inline-input" />
                <button className="btn" name="intent" value="schedule">Approve and schedule</button>
                <button className="btn" name="intent" value="save">Save draft</button>
                <button className="btn" name="intent" value="cancel" style={{ marginLeft: "auto", color: "var(--bad)" }}>Discard</button>
              </div>
            </form>
          </div>
        )}

        {canAct && (
          <div className="grid g2">
            <div className="card" style={{ borderColor: "var(--bad)" }}>
              <h3>Send an urgent alert</h3>
              <div className="hint" style={{ marginBottom: 10 }}>Goes out right away in English and Taglish. You get a copy so you can follow up.</div>
              <form action={sendUrgent}>
                <div className="field"><label htmlFor="template">What happened</label>
                  <select id="template" name="template">{URGENT_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
                <div className="grid g2">
                  <div className="field"><label htmlFor="when">When</label><input id="when" name="when" placeholder="today, 1 PM to 5 PM" /></div>
                  <div className="field"><label htmlFor="reason">Details</label><input id="reason" name="reason" placeholder="tank cleaning / Elevator 2" /></div>
                </div>
                <Audience /><Channels value={["APP", "SMS", "EMAIL", "MESSENGER"]} />
                <label className="row" style={{ fontSize: 13, marginBottom: 10 }}><input type="checkbox" name="confirm" /> I checked the details. Send now.</label>
                <SubmitButton label="Send urgent alert" busy="Sending…" cls="btn pri" />
              </form>
            </div>
            <div className="card">
              <h3>Draft a routine update with AI</h3>
              <div className="hint" style={{ marginBottom: 10 }}>{aiEnabled() ? "Jot down the facts. AI writes the English, Taglish and SMS versions for you to review." : "AI key not set: a simple template is used instead. Add ANTHROPIC_API_KEY to turn on AI drafting."}</div>
              <form action={aiDraft}>
                <div className="field"><label htmlFor="category">Type of update</label>
                  <select id="category" name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div className="field"><label htmlFor="notes">Your notes</label>
                  <textarea id="notes" name="notes" rows={5} required placeholder="Pool closed Dec 2-4 for retiling. Gym stays open. Kids' Christmas party Dec 14, 3 PM, function room, free for residents." /></div>
                <Audience />
                <SubmitButton label="Write the draft" busy="Writing…" />
              </form>
            </div>
          </div>
        )}

        <div className="grid g2">
          <div className="card"><h3>Waiting for approval</h3>
            <div className="list" style={{ marginTop: 6 }}>{queue.length ? queue.map((a) => (
              <div className="li" key={a.id}><span className={"tag " + (a.kind === "REMINDER" ? "t-warn" : "t-acc")}>{a.category}</span>
                <div style={{ flex: 1 }}><b>{a.title}</b><div className="hint">{audienceLabel(a.audience)} · {a.createdBy}{a.aiDrafted ? " · AI draft" : ""} · {fmtDateTime(a.createdAt)}</div></div>
                {canAct && <Link className="btn sm pri" href={`/comms?edit=${a.id}#review`}>Review</Link>}</div>)) : <div className="empty">All caught up.</div>}</div>
          </div>
          <div className="card"><h3>Scheduled</h3>
            <div className="list" style={{ marginTop: 6 }}>{scheduled.length ? scheduled.map((a) => (
              <div className="li" key={a.id}><span className="tag t-mut">{a.scheduledAt ? fmtDateTime(a.scheduledAt) : "—"}</span>
                <div style={{ flex: 1 }}><b>{a.title}</b><div className="hint">{audienceLabel(a.audience)} · {a.channels.map((c) => CH_LABEL[c]).join(", ")} · approved by {a.approvedBy}</div></div>
                {canAct && <Link className="btn sm" href={`/comms?edit=${a.id}#review`}>Edit</Link>}</div>)) : <div className="empty">Nothing scheduled.</div>}</div>
          </div>
        </div>

        <div className="card"><h3>Sent</h3>
          <div className="tablewrap"><table><thead><tr><th>Sent</th><th>Update</th><th>Audience</th><th className="r">Delivered</th><th className="r">Read in app</th><th>Channels</th></tr></thead>
            <tbody>{sent.map((a) => {
              const ok = a.deliveries.filter((d) => d.status !== "FAILED").length;
              const app = a.deliveries.filter((d) => d.channel === "APP");
              const read = app.filter((d) => d.readAt).length;
              const by = CHANNELS.map((c) => [c, a.deliveries.filter((d) => d.channel === c).length] as const).filter(([, n]) => n);
              return <tr key={a.id}><td className="hint">{a.sentAt ? fmtDateTime(a.sentAt) : ""}</td>
                <td><span className={"tag " + (a.kind === "URGENT" ? "t-bad" : "t-acc")} style={{ marginRight: 6 }}>{a.category}</span>{a.title}</td>
                <td className="hint">{audienceLabel(a.audience)}</td><td className="r num">{ok}</td>
                <td className="r num">{app.length ? Math.round((read / app.length) * 100) + "%" : "—"}</td>
                <td>{by.map(([c, n]) => <span key={c} className="pill-ch" style={{ marginRight: 4 }}>{CH_LABEL[c]} {n}</span>)}</td></tr>;
            })}</tbody></table></div>
        </div>

        <div className="grid g2">
          <div className="card"><h3>Automations</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className="tag t-ok">On</span><div>Work-order updates: owners get a message when their ticket is assigned, started and fixed.</div></div>
              <div className="li"><span className="tag t-ok">On</span><div>Payment receipts: sent the moment a payment posts.</div></div>
              <div className="li"><span className="tag t-ok">On</span><div>Monthly dues reminder: drafted on the 25th and waits for your approval.</div></div>
              <div className="li"><span className="tag t-ok">On</span><div>Preventive maintenance: work orders open 3 days before each due date.</div></div>
              <div className="li"><span className="tag t-ok">On</span><div>Scheduled updates go out at their set time (checked daily and whenever this page opens).</div></div>
            </div>
          </div>
          <div className="card"><h3>Channels</h3>
            <div className="list" style={{ marginTop: 6 }}>
              <div className="li"><span className="tag t-ok">Live</span><div>In-app inbox and owner home page</div></div>
              {([["SMS", "SMS via Semaphore", "SEMAPHORE_API_KEY"], ["EMAIL", "Email via Resend", "RESEND_API_KEY + EMAIL_FROM"], ["MESSENGER", "Facebook Messenger via your Page", "MESSENGER_PAGE_TOKEN"]] as const).map(([k, l, env]) => (
                <div className="li" key={k}><span className={"tag " + (live[k] ? "t-ok" : "t-warn")}>{live[k] ? "Live" : "Log only"}</span><div>{l}{!live[k] && <div className="hint">Add {env} in Vercel to start sending. Until then, messages are recorded here.</div>}</div></div>))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
