import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { loadRules } from "@/lib/knowledge";
import { CHAPTERS, RULES_VERSION, ruleById } from "@/lib/houserules";
import { approveRule, resetRule, saveRule } from "./actions";

export const dynamic = "force-dynamic";

/** Skyland house rules. Starts as a best-practice template; the board edits and approves each rule. Ask AI quotes this page. */
export default async function Rules({ searchParams }: { searchParams: { ok?: string; error?: string; edit?: string } }) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const rules = await loadRules();
  const canEdit = u.role !== "OWNER";
  const canApprove = u.role === "BOARD" || u.role === "ADMIN";
  const approved = rules.filter((r) => r.status === "APPROVED").length;
  return (
    <>
      <PageHead title="House rules" sub={canEdit ? `${approved} of ${rules.length} rules approved by the board. The rest are a best-practice template (${RULES_VERSION}); edit and approve each one. Ask AI quotes whatever is here.` : "How we live together at Skyland Plaza. Short version: be kind, be quiet after 10 PM, and register your guests. 🙂"} />
      <main className="view">
        {searchParams.ok && <div className="ok">{searchParams.ok}</div>}
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {approved < rules.length && <div className="card" style={{ marginBottom: 12 }}><span className="tag t-warn">Template</span> <span className="hint">Rules marked “template” are best-practice wording used until the Skyland board approves its own. If anything here differs from the rules you signed, your signed rules apply. Questions? <Link href="/ask">Ask AI</Link>.</span></div>}
        <nav className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }} aria-label="Chapters">
          {CHAPTERS.map((c) => <a key={c} href={`#ch-${c.split(".")[0]}`} className="chip">{c}</a>)}
        </nav>
        {CHAPTERS.map((c) => {
          const n = c.split(".")[0];
          const rs = rules.filter((r) => r.section.split(".")[0] === n);
          if (!rs.length) return null;
          return (
            <section className="card" key={c} id={`ch-${n}`} style={{ marginBottom: 12 }}>
              <h3>{c}</h3>
              <div className="list">
                {rs.map((r) => {
                  const t = ruleById(r.id);
                  const changed = t && (t.text !== r.text || t.title !== r.title);
                  return (
                    <div className="li" key={r.id} id={r.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <b>§{r.section} {r.title}</b>
                        {r.status === "APPROVED" ? <span className="tag t-ok">Board approved</span> : <span className="tag t-warn">Template</span>}
                        {canEdit && changed && <span className="tag t-mut">Edited</span>}
                      </div>
                      {canEdit && searchParams.edit === r.id ? (
                        <form action={saveRule} className="formgrid" style={{ marginTop: 4 }}>
                          <input type="hidden" name="id" value={r.id} />
                          <div className="field full"><label htmlFor={`t-${r.id}`}>Title</label><input id={`t-${r.id}`} name="title" defaultValue={r.title} required maxLength={120} /></div>
                          <div className="field full"><label htmlFor={`x-${r.id}`}>Rule</label><textarea id={`x-${r.id}`} name="text" defaultValue={r.text} rows={4} required maxLength={2000} /></div>
                          <div className="row full" style={{ gap: 6 }}><button className="btn sm pri">Save</button><Link href={`/rules#${r.id}`} className="btn sm">Cancel</Link></div>
                        </form>
                      ) : <div style={{ lineHeight: 1.55 }}>{r.text}</div>}
                      {r.basis && <div className="hint">Basis: {r.basis}</div>}
                      {canEdit && searchParams.edit !== r.id && (
                        <div className="row" style={{ gap: 6, marginTop: 2 }}>
                          <Link href={`/rules?edit=${r.id}#${r.id}`} className="btn sm">Edit</Link>
                          {canApprove && <form action={approveRule}><input type="hidden" name="id" value={r.id} /><button className="btn sm">{r.status === "APPROVED" ? "Withdraw approval" : "Approve"}</button></form>}
                          {changed && <form action={resetRule}><input type="hidden" name="id" value={r.id} /><button className="btn sm">Reset to template</button></form>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
