import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { Icon } from "@/components/Nav";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/format";
import { uploadDocument, deleteDocument } from "./actions";

export const dynamic = "force-dynamic";
const CATS = ["Governance", "Financial", "Minutes", "Contracts", "Notices", "Forms"];
const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

export default async function Documents({ searchParams }: { searchParams: { c?: string; q?: string; ok?: string; error?: string } }) {
  const u = await requireRole("OWNER", "BOARD", "MANAGER", "ADMIN");
  const staff = u.role !== "OWNER";
  const docs = await prisma.document.findMany({
    where: { ...(staff ? {} : { visibility: "OWNERS" }), ...(searchParams.c ? { category: searchParams.c } : {}), ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" as const } } : {}) },
    select: { id: true, title: true, category: true, visibility: true, fileName: true, size: true, uploadedBy: true, createdAt: true }, orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHead title="Documents" sub={staff ? "Everything the association needs on file. Owners only see documents marked for owners." : "House rules, financial statements, minutes and forms, in one place."} />
      <main className="view">
        {searchParams.error && <div className="err">{searchParams.error}</div>}
        {searchParams.ok && <div className="okmsg">{searchParams.ok}</div>}
        <form className="row">
          <a href="/documents" className={"chip" + (!searchParams.c ? " on" : "")}>All</a>
          {CATS.map((c) => <a key={c} href={`/documents?c=${c}`} className={"chip" + (searchParams.c === c ? " on" : "")}>{c}</a>)}
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search titles" aria-label="Search" className="inline-input" style={{ marginLeft: "auto" }} />
        </form>
        <div className={staff ? "grid g-7-5" : ""}>
          <div className="card">
            <div className="list">{docs.length ? docs.map((d) => (
              <div className="li" key={d.id}><span className="qi" style={{ color: "var(--accent)" }}><Icon name="doc" /></span>
                <div style={{ flex: 1, minWidth: 0 }}><a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>{d.title}</a>
                  <div className="hint">{d.category} · {kb(d.size)} · {fmtDate(d.createdAt)} · {d.uploadedBy}</div></div>
                {d.visibility === "BOARD" && <span className="tag t-warn">Board only</span>}
                <a className="btn sm" href={`/api/documents/${d.id}`} target="_blank" rel="noopener">Open</a>
                {(u.role === "MANAGER" || u.role === "ADMIN") && <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn sm" aria-label={`Delete ${d.title}`}>Delete</button></form>}
              </div>)) : <div className="empty">No documents found.</div>}</div>
          </div>
          {staff && (
            <div className="card"><h3>Upload</h3>
              <form action={uploadDocument} style={{ marginTop: 8 }}>
                <div className="field"><label htmlFor="file">File (PDF, image, Word, Excel; max 4 MB)</label><input id="file" type="file" name="file" required /></div>
                <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" placeholder="October 2026 financial statement" /></div>
                <div className="grid g2">
                  <div className="field"><label htmlFor="category">Category</label><select id="category" name="category">{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
                  <div className="field"><label htmlFor="visibility">Who can see it</label><select id="visibility" name="visibility"><option value="OWNERS">All owners</option><option value="BOARD">Board only</option></select></div>
                </div>
                <SubmitButton label="Upload" busy="Uploading…" />
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
