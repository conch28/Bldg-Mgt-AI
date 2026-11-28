import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { loadLibrary } from "@/lib/knowledge";
import { LIBRARY_REVIEWED, searchLibrary, type LegalKind } from "@/lib/legallibrary";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
const KINDS: LegalKind[] = ["Law", "Court ruling", "Tax", "Privacy", "Housing", "Corporate", "Safety & building", "Labor", "Local"];

/** The legal library Ask AI cites: laws, Supreme Court rulings, BIR, NPC and housing issuances. */
export default async function LegalLibrary({ searchParams }: { searchParams: { q?: string; k?: string } }) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const all = await loadLibrary();
  const q = (searchParams.q ?? "").slice(0, 200).trim();
  const k = KINDS.find((x) => x === searchParams.k);
  let list = q ? searchLibrary(all, q, 40) : all;
  if (q && !list.length) list = all.filter((e) => `${e.citation} ${e.title} ${e.summary}`.toLowerCase().includes(q.toLowerCase()));
  if (k) list = list.filter((e) => e.kind === k);
  const counts = Object.fromEntries(KINDS.map((x) => [x, all.filter((e) => e.kind === x).length]));
  const href = (kk?: string) => `/ask/library?${new URLSearchParams({ ...(q ? { q } : {}), ...(kk ? { k: kk } : {}) })}`;
  return (
    <>
      <PageHead title="Legal library" back="/ask" sub={`${all.length} Philippine laws, court rulings and tax, privacy and housing issuances that Ask AI cites. Reviewed ${fmtDate(new Date(LIBRARY_REVIEWED))}.`} />
      <main className="view">
        <form className="row" style={{ gap: 8, marginBottom: 10 }}>
          <input name="q" defaultValue={q} placeholder="Search: dues VAT, CCTV, eviction, AGM quorum…" aria-label="Search the library" style={{ flex: 1, minWidth: 0 }} />
          {k && <input type="hidden" name="k" value={k} />}
          <button className="btn pri">Search</button>
        </form>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <Link href={href()} className={"chip" + (!k ? " on" : "")}>All</Link>
          {KINDS.filter((x) => counts[x]).map((x) => <Link key={x} href={href(x)} className={"chip" + (k === x ? " on" : "")}>{x} · {counts[x]}</Link>)}
        </div>
        {!list.length && <div className="empty">Nothing matched. Try other words, or ask the question in <Link href="/ask">Ask AI</Link>.</div>}
        <div className="list">
          {list.map((e) => (
            <article className="card" key={e.id} id={e.id} style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="tag t-acc">{e.kind}</span>
                {e.who === "board" && <span className="tag t-mut">For the board</span>}
                {e.verified ? <span className="tag t-ok">Checked against source</span> : <span className="tag t-warn">Check with counsel</span>}
                {e.date && <span className="hint">{e.date}</span>}
              </div>
              <h3 style={{ margin: "6px 0 2px" }}>{e.title}</h3>
              <div className="hint" style={{ marginBottom: 6 }}>{e.citation} · {e.agency}</div>
              <p style={{ margin: "4px 0" }}><b>In plain words:</b> {e.plain}</p>
              <details><summary style={{ cursor: "pointer" }} className="hint">What it says</summary><p className="hint" style={{ lineHeight: 1.6 }}>{e.summary}</p></details>
              {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="hint">Read the source ›</a>}
            </article>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 10 }}>General information, not legal advice. {u.role === "OWNER" ? "For your own case, tap Talk to a person in Ask AI." : "Get counsel before acting on anything marked “check with counsel”."}</div>
      </main>
    </>
  );
}
