import { prisma } from "./db";
import { LIBRARY, searchLibrary, type LegalEntry, type LegalKind } from "./legallibrary";
import { RULE_TEMPLATES } from "./houserules";

/** A house rule as the app uses it: the board's edited text from the database, or the template. */
export type Rule = { id: string; section: string; chapter: string; title: string; text: string; topics: string[]; basis: string | null; status: string };

/** Legal library from the database (kept in sync on deploy), or the built-in copy if the table is empty or unreachable. */
export async function loadLibrary(): Promise<LegalEntry[]> {
  try {
    const rows = await prisma.legalSource.findMany();
    if (rows.length) return rows.map((r) => ({ id: r.id, kind: r.kind as LegalKind, citation: r.citation, title: r.title, agency: r.agency, date: r.date ?? undefined, topics: r.topics, summary: r.summary, plain: r.plain, who: r.who as LegalEntry["who"], url: r.url ?? undefined, verified: r.verified }));
  } catch {}
  return LIBRARY;
}

const bySection = (a: Rule, b: Rule) => { const [a1, a2] = a.section.split(".").map(Number), [b1, b2] = b.section.split(".").map(Number); return a1 - b1 || a2 - b2; };

/** Active house rules, board edits first, falling back to the template. */
export async function loadRules(): Promise<Rule[]> {
  try {
    const rows = await prisma.houseRule.findMany({ where: { active: true } });
    if (rows.length) return rows.map((r) => ({ id: r.id, section: r.section, chapter: r.chapter, title: r.title, text: r.text, topics: r.topics, basis: r.basis, status: r.status })).sort(bySection);
  } catch {}
  return RULE_TEMPLATES.map((r) => ({ ...r, basis: r.basis ?? null, status: "TEMPLATE" }));
}

const norm = (s: string) => " " + s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ") + " ";

/** Keyword match on rule topics (strong) and title/text words (weak). */
export function searchRules(rules: Rule[], q: string, limit = 3, min = 2): Rule[] {
  const t = norm(q);
  const words = t.split(" ").filter((w) => w.length > 3);
  const scored = rules.map((r) => {
    let s = 0;
    for (const k of r.topics) if (t.includes(` ${k} `) || (k.length > 4 && t.includes(` ${k}`))) s += 2 + k.split(" ").length;
    const hay = norm(`${r.title} ${r.text}`);
    for (const w of words) if (hay.includes(` ${w}`)) s += 0.4;
    return { r, s };
  }).filter((x) => x.s >= min).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  return scored.filter((x) => x.s >= scored[0].s * 0.4).slice(0, limit).map((x) => x.r);
}

export const rulesForPrompt = (rules: Rule[]) => rules.map((r) => `[#${r.id}] §${r.section} ${r.title}${r.status === "APPROVED" ? "" : " (template, pending board approval)"}: ${r.text}`).join("\n");

export { searchLibrary };
