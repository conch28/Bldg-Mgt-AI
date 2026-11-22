"""Builds templates/data-collection/Building_Onboarding_Templates.xlsx from templates.json:
an Instructions sheet, then one sheet per template with required columns marked, dropdowns for
allowed values, help text and a greyed EXAMPLE row to delete."""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

d = "templates/data-collection"
T = json.load(open(os.path.join(d, "templates.json")))
wb = Workbook(); ins = wb.active; ins.title = "Instructions"
HEAD = PatternFill("solid", fgColor="0F5F57"); REQ = PatternFill("solid", fgColor="C0392B"); EX = PatternFill("solid", fgColor="EEEEEE")
ins["A1"] = "Building onboarding templates"; ins["A1"].font = Font(size=16, bold=True)
lines = [
  "1. Fill one sheet per topic. Red headers are required; teal headers are optional.",
  "2. Row 3 is a fictional EXAMPLE. Delete it before sending. Never load example rows into a real building.",
  "3. Use the dropdowns where they appear. Dates are YYYY-MM-DD. Pesos without the ₱ sign.",
  "4. Attach scans of every permit, certificate, policy and contractor document named in the sheets.",
  "5. If you don't know a value, leave it blank. Do not guess. Blank is flagged and followed up; a guess is not.",
  "6. Collect only what is listed. Do not add ID numbers, birthdays or other personal data we did not ask for.",
  "",
  "Sheet | Owner | What it is for",
]
for i, l in enumerate(lines, start=3): ins.cell(row=i, column=1, value=l)
r = 3 + len(lines)
for t in T:
  ins.cell(row=r, column=1, value=f"{t['n']:02d} {t['title']}"); ins.cell(row=r, column=2, value=t["owner"]); ins.cell(row=r, column=3, value=t["purpose"]); r += 1
ins.column_dimensions["A"].width = 48; ins.column_dimensions["B"].width = 28; ins.column_dimensions["C"].width = 90
for t in T:
  ws = wb.create_sheet(f"{t['n']:02d} {t['title']}"[:31])
  for j, c in enumerate(t["cols"], start=1):
    h = ws.cell(row=1, column=j, value=c["name"] + (" *" if c.get("required") else ""))
    h.font = Font(bold=True, color="FFFFFF"); h.fill = REQ if c.get("required") else HEAD
    hp = ws.cell(row=2, column=j, value=c.get("help") or ""); hp.font = Font(italic=True, size=9, color="555555"); hp.alignment = Alignment(wrap_text=True, vertical="top")
    ex = ws.cell(row=3, column=j, value=c.get("example")); ex.fill = EX; ex.font = Font(color="777777")
    ws.column_dimensions[get_column_letter(j)].width = max(14, min(36, len(c["name"]) + 6))
    if c.get("allowed"):
      dv = DataValidation(type="list", formula1='"' + ",".join(c["allowed"]) + '"', allow_blank=True)
      dv.error = "Pick a value from the list"; ws.add_data_validation(dv); dv.add(f"{get_column_letter(j)}4:{get_column_letter(j)}2000")
  ws.row_dimensions[2].height = 42; ws.freeze_panes = "A4"
wb.save(os.path.join(d, "Building_Onboarding_Templates.xlsx"))
print("Wrote Building_Onboarding_Templates.xlsx with", len(T), "sheets")
