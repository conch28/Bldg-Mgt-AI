import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead, Kpi } from "@/components/ui";
import Tip from "@/components/Tip";
import SubmitButton from "@/components/SubmitButton";
import { loadCtx, evaluate, score, targets } from "@/lib/readiness";
import { syncIssues, SEV_LABEL, SEV_CLS, SEV_HELP, type Sev } from "@/lib/datachecks";
import { fmtDate } from "@/lib/format";
import { resolveIssue, runChecksNow } from "./actions";
import DataTabs from "@/components/DataTabs";

export const dynamic = "force-dynamic";
const ROLE_LABEL: Record<string, string> = { MANAGER: "Property manager", ADMIN: "Operations head", GUARD: "Guards", BOARD: "Board" };

export default async function DataCenter({ searchParams: sp }: { searchParams: { ok?: string; error?: string; sev?: string } }) {
  const u = await requireRole("BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "BOARD";
  const c = await loadCtx(u.buildingId);
  const { open } = await syncIssues(u.buildingId, { ctx: c });
  const rows = evaluate(c);
  const sc = score(rows);
  const p0 = open.filter((i) => i.severity === "P0").length;
  const tg = targets(c, p0);
  const in60 = new Date(c.now.getTime() + 60 * 86400000);
  const pending = c.compliance.filter((x) => x.status === "PENDING").length + c.creds.filter((x) => x.status === "PENDING").length + c.assets.filter((a) => a.criticality !== "NORMAL" && !a.verifiedAt && a.manufacturer && a.serial).length;
  const expiring = [
    ...c.compliance.filter((x) => x.expiresAt && x.expiresAt <= in60).map((x) => ({ what: x.title, who: x.authority, at: x.expiresAt!, href: `/data/compliance#c-${x.id}` })),
    ...c.vendors.filter((v) => v.insuranceExpiry && v.insuranceExpiry <= in60).map((v) => ({ what: `${v.name} insurance`, who: "Contractor", at: v.insuranceExpiry!, href: `/data/contractors#v-${v.id}` })),
    ...c.creds.filter((x) => x.status === "VERIFIED" && x.expiresAt && x.expiresAt <= in60).map((x) => ({ what: `${c.vendors.find((v) => v.id === x.vendorId)?.name ?? "Contractor"}: ${x.kind.replace("_", " ").toLowerCase()}`, who: x.issuer ?? "", at: x.expiresAt!, href: `/data/contractors#v-${x.vendorId}` })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const sevs: Sev[] = ["P0", "P1", "P2", "P3"];
  const filter = sevs.includes(sp.sev as Sev) ? (sp.sev as Sev) : null;
  const limit = filter || sp.sev === "all" ? 60 : 10;
  const shown = open.filter((i) => !filter || i.severity === filter);
  const recentClosed = await prisma.dataIssue.findMany({ where: { buildingId: u.buildingId, status: "RESOLVED" }, orderBy: { resolvedAt: "desc" }, take: 5 });

  return (
    <>
      <PageHead title="Data Center" sub="Is the information this building runs on complete, verified and current?" right={staff ? <form action={runChecksNow}><SubmitButton label="Run checks now" busy="Checking…" cls="btn" small /></form> : null} />
      <main className="view">
        <DataTabs on="/data" />
        <Tip id="data-center" title="Good data means faster repairs and fewer surprises for residents.">Every record here has an owner, a freshness rule and a way to check it. Nothing counts as verified until a person checked it against a source. Checks run every day and tell the owner what to fix.</Tip>
        {sp.error && <div className="err">{sp.error}</div>}
        {sp.ok && <div className="okmsg">{sp.ok}</div>}

        <div className={sc.ready ? "okmsg" : "err"} role="status" style={{ marginBottom: 16 }}>
          {sc.ready ? <><b>Safety-critical data is complete and verified.</b> The score below covers everything else.</>
            : <><b>Not ready for safety-critical use.</b> {sc.safetyGaps.length} safety item{sc.safetyGaps.length > 1 ? "s are" : " is"} incomplete, whatever the overall score says:
              <ul style={{ margin: "6px 0 0" }}>{sc.safetyGaps.map((r) => <li key={r.id}>{r.data}: <b>{r.pct ?? 0}%</b>. {r.m?.note}</li>)}</ul></>}
        </div>

        <div className="grid g4">
          <Kpi k="Data readiness" v={`${sc.overall}%`} d="Weighted by criticality. Safety gaps are shown separately above." cls={sc.overall >= 90 ? "" : sc.overall >= 70 ? "amber" : "red"} />
          <Kpi k="Open data issues" v={open.length} d={`${p0} critical (P0), ${open.filter((i) => i.severity === "P1").length} high (P1)`} cls={p0 ? "red" : open.length ? "amber" : ""} />
          <Kpi k="Waiting for a second check" v={pending} d="Entered but not yet verified by another person" cls={pending ? "amber" : ""} />
          <Kpi k="Expiring in 60 days" v={expiring.length} d="Permits, certificates, contractor insurance" cls={expiring.some((e) => e.at < c.now) ? "red" : expiring.length ? "amber" : ""} />
        </div>

        <div className="grid g-7-5" style={{ marginTop: 16 }}>
          <section className="card" aria-labelledby="iss">
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h3 id="iss" style={{ margin: 0 }}>Issues to fix</h3>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <Link href="/data" className={"chip" + (!filter ? " on" : "")}>All {open.length}</Link>
                {sevs.map((s) => <Link key={s} href={`/data?sev=${s}`} className={"chip" + (filter === s ? " on" : "")} title={SEV_HELP[s]}>{s} {open.filter((i) => i.severity === s).length}</Link>)}
              </div>
            </div>
            {!shown.length && <p className="hint">Nothing open{filter ? ` at ${filter}` : ""}. 🎉</p>}
            <ul className="plainlist" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {shown.slice(0, limit).map((i) => (
                <li key={i.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                  <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className={"tag " + SEV_CLS[i.severity as Sev]}>{SEV_LABEL[i.severity as Sev]}</span>
                    <b style={{ flex: 1, minWidth: 180 }}>{i.title}</b>
                    {i.href && <Link href={i.href} className="btn sm">Fix</Link>}
                  </div>
                  <div className="hint" style={{ marginTop: 4 }}>{i.detail} Owner: {ROLE_LABEL[i.ownerRole] ?? i.ownerRole}. Open since {fmtDate(i.firstSeen)}.</div>
                  {staff && <details style={{ marginTop: 6 }}><summary className="hint" style={{ cursor: "pointer" }}>Close with evidence</summary>
                    <form action={resolveIssue} className="inline-form" style={{ marginTop: 6 }}>
                      <input type="hidden" name="id" value={i.id} />
                      <input name="evidence" required minLength={10} placeholder="What was done or checked, e.g. 'Nameplate photographed, serial corrected'" aria-label="Evidence" style={{ flex: 1, minWidth: 200 }} />
                      <SubmitButton label="Close" small />
                    </form></details>}
                </li>
              ))}
            </ul>
            {shown.length > limit && <p className="hint">Showing the {limit} most urgent of {shown.length}. <Link href="/data?sev=all">Show all</Link> or filter by severity.</p>}
            {recentClosed.length > 0 && <details style={{ marginTop: 12 }}><summary className="hint" style={{ cursor: "pointer" }}>Recently closed ({recentClosed.length})</summary>
              <ul className="hint" style={{ margin: "6px 0 0" }}>{recentClosed.map((i) => <li key={i.id}><b>{i.title}</b>: {i.evidence} ({i.resolvedBy}, {i.resolvedAt ? fmtDate(i.resolvedAt) : ""})</li>)}</ul></details>}
          </section>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section className="card" aria-labelledby="areas">
              <h3 id="areas">Readiness by area</h3>
              {sc.byCat.map((b) => (
                <div key={b.cat} style={{ margin: "10px 0" }}>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}><span>{b.cat}</span><span className="num">{b.pct == null ? "not tracked" : `${b.pct}%`}{b.gaps ? ` · ${b.gaps} gap${b.gaps > 1 ? "s" : ""}` : ""}</span></div>
                  <div className="meter" role="img" aria-label={`${b.cat} ${b.pct ?? 0}%`}><i style={{ width: `${b.pct ?? 0}%`, background: (b.pct ?? 0) >= 90 ? "var(--ok)" : (b.pct ?? 0) >= 60 ? "var(--warn)" : "var(--bad)" }} /></div>
                </div>
              ))}
              <Link href="/data/register" className="hint">See all {rows.length} requirements, owners and sources →</Link>
            </section>
            <section className="card" aria-labelledby="exp">
              <h3 id="exp">Expiring or expired</h3>
              {!expiring.length && <p className="hint">Nothing in the next 60 days.</p>}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{expiring.slice(0, 8).map((e, n) => (
                <li key={n} className="row" style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: n ? "1px solid var(--line)" : undefined }}>
                  <Link href={e.href} style={{ color: "inherit" }}>{e.what}<div className="hint">{e.who}</div></Link>
                  <span className={"tag " + (e.at < c.now ? "t-bad" : "t-warn")}>{e.at < c.now ? "expired " : ""}{fmtDate(e.at)}</span>
                </li>))}</ul>
            </section>
          </div>
        </div>

        <section className="card" style={{ marginTop: 16 }} aria-labelledby="tg">
          <h3 id="tg">Go-live targets</h3>
          <p className="hint" style={{ marginTop: 0 }}>What must be true before we run a building on this data. Every number is measured from the records, not estimated.</p>
          <div className="tablewrap"><table>
            <thead><tr><th>Measure</th><th className="r">Now</th><th className="r">Target</th><th></th></tr></thead>
            <tbody>{tg.map((t) => { const ok = t.unit === "%" ? t.v >= t.target : t.v <= t.target; return (
              <tr key={t.k}><td>{t.k}</td><td className="r num"><b>{t.v}{t.unit}</b></td><td className="r num">{t.target}{t.unit}</td><td><span className={"tag " + (ok ? "t-ok" : "t-bad")}>{ok ? "Met" : "Not met"}</span></td></tr>); })}</tbody>
          </table></div>
          <p className="hint" style={{ fontSize: 12 }}>Cross-building access: not applicable while one building is on the system. New records already carry a building id so a second building stays separate.</p>
        </section>

        <section className="card" style={{ marginTop: 16 }} aria-labelledby="tpl">
          <h3 id="tpl">Onboarding templates</h3>
          <p className="hint" style={{ marginTop: 0 }}>Send these to a new building. Each has the required columns, allowed values and an example row. Never load sample rows into a real building.</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {[["assets", "Equipment & assets"], ["compliance", "Permits & insurance"], ["contractors", "Contractors"], ["pm", "Maintenance schedules"], ["units", "Units & owners"], ["contacts", "Emergency contacts"]].map(([k, l]) => <a key={k} href={`/data/templates/${k}`} className="btn sm">{l} (CSV)</a>)}
          </div>
          <p className="hint" style={{ fontSize: 12, marginBottom: 0 }}>The full Excel workbook (17 sheets with dropdowns) and the document request checklist are in the onboarding pack.</p>
        </section>
      </main>
    </>
  );
}
