// Copies the legal library (lib/legallibrary.ts) into LegalSource, and adds any template house rule
// (lib/houserules.ts) that isn't in HouseRule yet. Board edits to house rules are never overwritten.
// Runs on every deploy (scripts/vercel-build.mjs). Safe to run many times.
import { PrismaClient } from "@prisma/client";
import { LIBRARY, LIBRARY_REVIEWED } from "../lib/legallibrary";
import { RULE_TEMPLATES } from "../lib/houserules";

const prisma = new PrismaClient();

async function main() {
  for (const e of LIBRARY) {
    const data = { kind: e.kind, citation: e.citation, title: e.title, agency: e.agency, date: e.date ?? null, topics: e.topics, summary: e.summary, plain: e.plain, who: e.who, url: e.url ?? null, verified: e.verified, reviewedAt: LIBRARY_REVIEWED };
    await prisma.legalSource.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
  }
  const gone = await prisma.legalSource.deleteMany({ where: { id: { notIn: LIBRARY.map((e) => e.id) } } });
  const added = await prisma.houseRule.createMany({ data: RULE_TEMPLATES.map((r) => ({ id: r.id, section: r.section, chapter: r.chapter, title: r.title, text: r.text, topics: r.topics, basis: r.basis ?? null })), skipDuplicates: true });
  console.log(`Legal library: ${LIBRARY.length} entries synced, ${gone.count} removed. House rules: ${added.count} template rules added.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
