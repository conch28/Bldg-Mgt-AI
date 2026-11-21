export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <header className="top">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <div className="right">{right}</div>
    </header>
  );
}
export function Kpi({ k, v, d, cls }: { k: string; v: React.ReactNode; d?: React.ReactNode; cls?: string }) {
  return <div className="card kpi"><div className="k">{k}</div><div className={"v " + (cls ?? "")}>{v}</div>{d && <div className="d">{d}</div>}</div>;
}
const STATUS_CLS: Record<string, string> = { NEW: "t-acc", ASSIGNED: "t-mut", IN_PROGRESS: "t-warn", ESCALATED: "t-bad", DONE: "t-ok", PAID: "t-ok", UNPAID: "t-warn", PARTIAL: "t-warn", CONFIRMED: "t-acc" };
export function StatusTag({ s }: { s: string }) {
  return <span className={"tag " + (STATUS_CLS[s] ?? "t-mut")}>{s.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>;
}
/** Minimal, safe Markdown: headings, bullets, bold, paragraphs. Escapes HTML first. */
export function Markdown({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out: string[] = []; let list = false;
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (/^[-*] |^\d+\. /.test(l)) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(l.replace(/^[-*] |^\d+\. /, ""))}</li>`); continue; }
    if (list) { out.push("</ul>"); list = false; }
    if (/^#{1,4} /.test(l)) out.push(`<h2>${inline(l.replace(/^#+ /, ""))}</h2>`);
    else if (l) out.push(`<p>${inline(l)}</p>`);
  }
  if (list) out.push("</ul>");
  return <div className="md report" dangerouslySetInnerHTML={{ __html: out.join("") }} />;
}
