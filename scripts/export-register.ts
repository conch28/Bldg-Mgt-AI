/**
 * Regenerates docs/data-governance/MASTER_DATA_REGISTER.md from lib/readiness.ts (requirements)
 * and lib/datachecks.ts (checks), so the docs never drift from what the app measures.
 * Run: npx tsx scripts/export-register.ts
 */
import { writeFileSync } from "node:fs";
import { REQUIREMENTS } from "../lib/readiness";
import { CHECKS } from "../lib/datachecks";

const esc = (s: string) => s.replace(/\|/g, "\\|");
const out: string[] = [
  "# Master data register", "",
  "_Generated from `lib/readiness.ts` and `lib/datachecks.ts` by `npx tsx scripts/export-register.ts`. Edit the code, not this file._", "",
  "Every piece of information the building runs on, where it comes from, who owns it, how fresh it must be and how it is verified. The **live status** of each row (Complete, Incomplete, Missing, Outdated, Not tracked yet) is shown in the app at **Data Center → Readiness register**, and the client confirms each owner there. That confirmation is the approval to use the data in operations.", "",
  "Criticality weights in the readiness score: critical 4, high 3, medium 2, low 1. Rows marked **safety** gate readiness on their own: the building is \"not ready for safety-critical use\" while any of them is below 100%, whatever the overall score.", "",
];
for (const cat of [...new Set(REQUIREMENTS.map((r) => r.category))]) {
  out.push(`## ${cat}`, "", "| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const r of REQUIREMENTS.filter((x) => x.category === cat))
    out.push(`| \`${r.id}\` | ${esc(r.data)}${r.safety ? " **(safety)**" : ""} | ${esc(r.module)} | ${esc(r.source)} | ${esc(r.owner)} | ${esc(r.frequency)} | ${r.criticality.toLowerCase()} | ${esc(r.verify)} | ${r.measure ? "Yes" : "Not yet"} | ${esc(r.action)} |`);
  out.push("");
}
out.push("## Daily data quality checks", "", "Run by the daily cron (`/api/cron`) and whenever someone opens the Data Center. New P0 and P1 issues notify the owner role (P0 by app and SMS, P1 in the app).", "", "| Check | Severity | Rule |", "|---|---|---|");
for (const c of CHECKS) out.push(`| \`${c.id}\` | ${c.severity} | ${esc(c.rule)} |`);
out.push("");
writeFileSync("docs/data-governance/MASTER_DATA_REGISTER.md", out.join("\n"));
console.log(`Wrote ${REQUIREMENTS.length} requirements and ${CHECKS.length} checks`);
