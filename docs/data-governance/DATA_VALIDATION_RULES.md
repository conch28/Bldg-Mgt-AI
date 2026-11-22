# Data validation rules

Three layers: the database refuses impossible data, forms refuse bad input with a clear message, and daily checks find what slipped through. Sensitive changes need a second person and are written to the audit log.

## 1. Database constraints

| Rule | Where |
|---|---|
| Unit codes unique per building | `Unit @@unique([buildingId, code])` |
| Asset tags unique | `Asset.tag @unique` |
| One issue per check per record | `DataIssue @@unique([buildingId, checkId, entityKey])` |
| One owner sign-off per requirement | `ReadinessSignoff @@unique([buildingId, reqId])` |
| Money as Decimal, never float | all peso fields |

## 2. Form and import validation

| Data | Rule | Message style |
|---|---|---|
| Asset tag | 3–30 letters, numbers, dashes; unique | "Tag should be letters, numbers and dashes, e.g. EL-GEN-1." |
| Asset serial | Unique across the registry (case-insensitive) | "Serial X is already on TAG. Check for a duplicate before saving." |
| Asset life | 1–1,199 months | |
| Safety asset in CSV | Needs manufacturer, model and serial | |
| Template EXAMPLE rows | Rejected on import | "This is the template's EXAMPLE row; delete it." |
| Safety maintenance schedule | Interval source cannot be UNVERIFIED | "We never guess it." |
| Compliance dates | Expiry after issue date | |
| Contractor credential | Expiry required for permits, insurance, licences | |
| Units CSV | Code format, floor, sqm 5–2,000, PH mobile, email, balance | Existing Admin → Import |
| Files | PDF, image, Word, Excel, CSV, text; under 4 MB | |

Imports are two-step: **Check** (lists every problem by row, saves nothing), then **Import**. Asset imports store an undo snapshot (Documents → Imports) and can be undone while the new assets have no repairs or sensor data.

## 3. Maker-checker (approval) rules

| Change | Who can verify | Rule |
|---|---|---|
| Asset specs | Manager or operations head | Not the person who last edited; needs make, model, serial and a spec source. Any change to specs clears verification. |
| Compliance item | Manager, operations head or board | Not the person who entered it; needs the scanned original. Any edit sends it back to "needs a second check". |
| Compliance rule applies | Operations head or board, naming the qualified person | Counsel, engineer or safety officer |
| Contractor credential | Manager, operations head or board | Not who entered it; needs a copy (except phone references) |
| Register owner | Board or operations head | One sign-off per requirement |
| Purchases and payments | Per approval limits | Existing procurement rules; nobody approves or receives their own request |

## 4. Daily quality checks

The full list with severities is in [MASTER_DATA_REGISTER.md](MASTER_DATA_REGISTER.md#daily-data-quality-checks). Summary of what they detect:

- Missing records: safety assets without schedules, compliance items without files, contractors without credentials, units without floor area or owner.
- Incomplete records: key assets without make, model or serial.
- Duplicates: assets sharing a serial; payments to the same vendor for the same amount within 30 days.
- Inconsistent records: overlapping leases, leases ending before they start.
- Outdated information: expired permits and insurance, overdue safety maintenance, no meter reading in 36 hours.
- Unverified information: key assets, compliance items, intervals with no source.
- Financial: purchases marked paid without a receipt.

## 5. Closing an issue

- A person closes an issue only with written evidence (at least a sentence). It stays closed for 30 days; if the records still show the problem after that, the check reopens it.
- The check closes an issue itself when the condition is gone, and records "Check passed on <date>" as the evidence.
- Nothing is marked resolved without evidence.
