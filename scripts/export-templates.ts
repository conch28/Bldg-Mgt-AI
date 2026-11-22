/**
 * Writes the onboarding templates from lib/templates.ts:
 *   templates/data-collection/NN-key.csv   (header + one EXAMPLE row)
 *   templates/data-collection/templates.json (input for build-templates-xlsx.py)
 * Run: npx tsx scripts/export-templates.ts && python3 scripts/build-templates-xlsx.py
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { TEMPLATES } from "../lib/templates";
import { csvCell } from "../lib/csv";

const dir = "templates/data-collection";
mkdirSync(dir, { recursive: true });
for (const t of TEMPLATES) {
  const body = [t.cols.map((c) => c.name).join(","), t.cols.map((c) => csvCell(c.example)).join(",")].join("\r\n") + "\r\n";
  writeFileSync(`${dir}/${String(t.n).padStart(2, "0")}-${t.key}.csv`, "﻿" + body);
}
writeFileSync(`${dir}/templates.json`, JSON.stringify(TEMPLATES, null, 1));
console.log(`Wrote ${TEMPLATES.length} CSV templates to ${dir}`);
