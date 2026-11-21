import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { demoMode } from "@/lib/env";
import { peso, fmtDate, fmtDateTime } from "@/lib/format";
import { BROKER, CHANNEL_LABEL, FEES, type Post } from "@/lib/property";
import { approveListing, bookViewing, simulateInquiry, withdrawListing } from "../actions";

export const dynamic = "force-dynamic";
const CH: Record<string, string> = { MESSENGER: "Messenger", MARKETPLACE: "Marketplace", GROUP: "FB group", PAGE: "Page comment" };
const POST_TAG: Record<string, [string, string]> = { POSTED: ["Posted", "t-ok"], QUEUED: ["Posting", "t-acc"], DEMO: ["Posted (demo)", "t-ok"], FAILED: ["Failed", "t-bad"] };

export default async function ListingPage({ params, searchParams }: { params: { id: string }; searchParams: { published?: string } }) {
  const u = await requireRole("OWNER");
  const l = await prisma.listing.findUnique({ where: { id: params.id }, include: { unit: true, inquiries: { orderBy: { createdAt: "desc" } } } });
  if (!l || l.userId !== u.id) notFound();
  const per = l.kind === "LEASE" ? "/month" : "";
  const steps = ["AI price check", "Listing approved", "Posted on Facebook", "Viewings", l.kind === "LEASE" ? "Lease signed" : "Sold"];
  const stage = l.status === "DRAFT" ? 1 : l.status === "CLOSED" ? 5 : l.inquiries.some((i) => i.viewingAt) ? 3 : 2;
  const posts = (l.posts as Post[] | null) ?? [];
  const viewings = l.inquiries.filter((i) => i.viewingAt);
  return (
    <>
      <PageHead title={`Unit ${l.unit.code} for ${l.kind === "LEASE" ? "lease" : "sale"}`} sub={`${peso(l.price)}${per} · AI suggested ${peso(l.suggestedLow)} – ${peso(l.suggestedHigh)}`} right={<Link href="/property" className="btn sm">Back</Link>} />
      <main className="view">
        {searchParams.published && <div className="okmsg">Done! Your listing is live. The AI assistant will answer inquiries and book viewings for you.</div>}
        <div className="steps" aria-label="Progress">{steps.map((s, i) => <span key={s} className={i < stage ? "done" : i === stage ? "now" : ""}>{s}</span>)}</div>

        {l.status === "DRAFT" && (
          <div className="card stack" style={{ borderColor: "var(--accent)" }}>
            <span className="ai-badge">{l.ai ? "Written by AI" : "Listing draft"} · ready for your OK</span>
            <div className="hint">This goes to: {l.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}.</div>
            <form action={approveListing}><input type="hidden" name="id" value={l.id} /><SubmitButton label="Approve and post" busy="Posting…" cls="btn pri" /></form>
          </div>
        )}

        {l.status !== "DRAFT" && (
          <div className="mini-row">
            <div className="mini"><b className="n">{l.views}</b><span>people<br />viewed</span></div>
            <div className="mini"><b className="n">{l.inquiries.length}</b><span>inquiries,<br />all answered</span></div>
            <div className="mini"><b className="n">{viewings.length}</b><span>viewings<br />booked</span></div>
          </div>
        )}

        <div className="fbpost">
          <div className="fbh"><div className="avatar">S</div><div><b>Skyland Tower Homes</b><div className="hint">{l.publishedAt ? fmtDateTime(l.publishedAt) : "Preview"} · Public</div></div></div>
          <div className="fbimg">{l.title}</div>
          <div className="fbb">{l.body}</div>
          {l.bodyTl && <details className="fbb" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}><summary className="hint">Taglish version for groups</summary><div style={{ marginTop: 6 }}>{l.bodyTl}</div></details>}
        </div>

        {posts.length > 0 && <div className="card"><h3>Where it's posted</h3><div className="list" style={{ marginTop: 4 }}>{posts.map((p) => (
          <div className="li" key={p.channel}><span className={"tag " + POST_TAG[p.status][1]}>{POST_TAG[p.status][0]}</span><div style={{ flex: 1 }}>{CHANNEL_LABEL[p.channel]}<div className="hint">{p.info}</div></div></div>))}</div></div>}

        {l.status !== "DRAFT" && (
          <div className="card" id="inquiries">
            <div className="cardhead"><div><h3>Inquiries</h3><div className="hint">The AI assistant replies within minutes, day and night.</div></div>
              {demoMode() && l.status === "LIVE" && <div className="r"><form action={simulateInquiry}><input type="hidden" name="id" value={l.id} /><SubmitButton label="Simulate a new message" busy="AI is replying…" cls="btn" small /></form></div>}</div>
            <div className="stack">{l.inquiries.length ? l.inquiries.map((i) => (
              <div key={i.id} className="ann">
                <div className="row"><b>{i.name}</b><span className="tag t-mut">{CH[i.channel] ?? i.channel}</span><span className="hint">{fmtDateTime(i.createdAt)}</span>
                  {i.viewingAt ? <span className="tag t-ok">Viewing {fmtDateTime(i.viewingAt)}</span> : i.status === "NEW" ? <span className="tag t-warn">New</span> : null}</div>
                <div style={{ marginTop: 6 }}>{i.message}</div>
                {i.aiReply && <div className="aibox" style={{ marginTop: 8 }}><span className="ai-badge">AI replied</span><div style={{ marginTop: 4 }}>{i.aiReply}</div></div>}
                {!i.viewingAt && l.status === "LIVE" && <form action={bookViewing} style={{ marginTop: 8 }}><input type="hidden" name="inquiryId" value={i.id} /><SubmitButton label="Book their viewing" busy="Booking…" cls="btn" small /></form>}
                {i.passCode && <div className="hint" style={{ marginTop: 6 }}>Guest pass for the lobby: <b className="mono">{i.passCode}</b></div>}
              </div>)) : <div className="empty">No inquiries yet. Most listings get their first message within a day.</div>}</div>
          </div>
        )}

        <div className="card">
          <h3>Your broker</h3>
          <div className="hint" style={{ marginTop: 4 }}><b style={{ color: "var(--fg)" }}>{BROKER.name}</b>, {BROKER.license}. Handles offers, contracts, the tenant's or buyer's papers, and closing.</div>
          <div className="hint" style={{ marginTop: 6 }}>Fee, only when it closes: {l.kind === "LEASE" ? FEES.LEASE : FEES.SALE}.</div>
          <div className="aibox" style={{ marginTop: 10 }}><span className="ai-badge">How we priced it</span><div style={{ marginTop: 4 }}>{l.rationale}</div></div>
          {["DRAFT", "LIVE"].includes(l.status) && <form action={withdrawListing} style={{ marginTop: 12 }}><input type="hidden" name="id" value={l.id} /><button className="btn sm">{l.status === "DRAFT" ? "Discard draft" : "Take it down"}</button></form>}
          <div className="hint" style={{ marginTop: 8 }}>Listed {fmtDate(l.createdAt)}.</div>
        </div>
      </main>
    </>
  );
}
