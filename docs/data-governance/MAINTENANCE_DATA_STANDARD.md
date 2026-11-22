# Maintenance data standard

## Schedules
- Every SAFETY asset has at least one preventive maintenance task linked by asset tag (P0 if not).
- Every interval records its source: **Manufacturer** (manual section), **Statutory** (regulation), **Engineer** (signed recommendation), or **Contract** (service contract). Safety schedules cannot be saved as "not verified". We never invent intervals for safety-critical equipment.
- Statutory tasks are flagged `compliance` and appear on the maintenance calendar.

## Work orders (from PR #8)
| Evidence | Required |
|---|---|
| Acknowledged and assigned | Within 1h (7 AM–7 PM) or 4h at night |
| Done | After photo and short note by the technician (job link, no login) |
| Verified | Manager within 24h; vendor invoices tied to the ticket can't be paid before |
| Parts and costs | Replacement log: part, cost, warranty claim, old part returned |

## What we record for analysis
Breakdown history (work orders by asset location and tag), parts replaced, labour and contractor costs (procurement), downtime (open to close), root cause (work order note), repeat failures (replacement log, flagged by the procurement red flags).

## Overdue rules
- Safety or statutory task overdue: P0 issue the same day.
- Other tasks: shown on the maintenance calendar and Today page.
- Rescheduling needs a reason in the work order note.
