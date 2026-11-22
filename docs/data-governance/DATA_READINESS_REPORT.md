# Data readiness report

Audit date: 22 November 2026. Scope: the Building Mgt AI app (Next.js, Prisma/Postgres, `conch28/Bldg-Mgt-AI`), including the unmerged accountability work (PR #8) this builds on. Live demo: Skyland Plaza sample data. **The figures below about Skyland describe sample data, not a real building.**

## 1. Summary

The app already captures most *operational* data well, because earlier work made the person doing the job enter it with proof: work orders with after photos and verification, guard rounds with meter readings, procurement with quotes, approval limits, delivery photos and "no receipt, no payment", and an accountability matrix with escalation.

What was missing was a layer that answers **"can we trust the master data?"**: which equipment exists and how critical it is, whether its specifications were checked, whether every safety system has a schedule from a real source, whether permits and contractor credentials are current, and who owns each dataset. That layer is what this change adds.

## 2. What exists today (before this change)

| Area | In the app | Strength | Gap |
|---|---|---|---|
| Building and units | `Building`, `Unit` (code, floor, sqm, owner), CSV import | Idempotent import with validation | No building profile fields (address, GFA, year); no plans |
| Owners and occupancy | `User` (OWNER), `Unit.occupancy`, `Lease` | One-time-code sign-in proves contacts | Lease overlaps not checked |
| Assets | `Asset` (tag, category, location, install date, life, cost, warranty), replacements, sensors | Replacement log, warranty claims, lift/genset health | No make/model/serial, criticality, verification, manuals, QR |
| Preventive maintenance | `PMTask` (free-text asset, interval, next due, compliance flag) | Calendar and auto work orders | Not linked to assets; interval source unknown |
| Work orders | `WorkOrder` with ack, assignee, after photo, verification | Strong evidence and SLA tracking | — |
| Contractors | `Vendor` (contract, insurance expiry, rating) | Renewal and insurance alerts | No registration, permit, licence checks; rating not evidenced |
| Procurement | `PurchaseRequest`, `Quote`, approvals, receipts | Fraud flags, maker-checker | Duplicate payment check missing |
| Utilities | `MeterReading` (guard rounds), `UtilityReading` per unit | Leak and spike checks | Utility bills not captured |
| Money | Bills, payments, budget lines, reports | PayMongo, collections | Bank reconciliation not tracked |
| Compliance | `lib/regulations.ts` (curated rules feed) | Reviewed summaries with links | No register of the building's own permits and expiries |
| Documents | `Document` (file in DB, owner/board visibility) | Access-checked downloads | No categories for plans, manuals, compliance |
| AI | Helpdesk tools (account, tickets, services, escalate) | Tool-limited, no-key fallback | No readiness context; fine as is for phase 1 |
| Tenancy | `buildingId` on `User`, `Unit` | Session carries buildingId | Most other tables are single-building |

## 3. Prioritized gap analysis

| # | Gap | Risk | Priority | Status |
|---|---|---|---|---|
| 1 | Safety equipment without a linked maintenance schedule | Breakdown, injury, failed BFP inspection | P0 | **Built**: asset ↔ schedule link, P0 check |
| 2 | Maintenance intervals with no source | Wrong intervals on fire pumps, lifts, genset | P0 | **Built**: interval source required for safety assets |
| 3 | No register of the building's permits and certificates | Expired FSIC or permits, fines, closure | P0 | **Built**: compliance register, reminders, maker-checker |
| 4 | Asset specs (make/model/serial) missing and unverified | Wrong parts, voided warranties, duplicate assets | P1 | **Built**: registry fields, verify step, duplicate serial check |
| 5 | Contractor credentials never checked | Unlicensed or uninsured work on site | P1 | **Built**: credential register and vetting score |
| 6 | No single view of data quality | Problems found only when something breaks | P1 | **Built**: Data Center, daily checks P0–P3 |
| 7 | No owner per dataset | Nobody fixes what everybody owns | P1 | **Built**: register with client sign-off |
| 8 | Asset bulk import | Slow onboarding | P2 | **Built**: CSV import with check, preview, undo |
| 9 | Onboarding templates and document request | Inconsistent client data | P2 | **Built**: 17 templates, request checklist |
| 10 | Duplicate payment and paid-without-receipt checks | Overpayment | P1 | **Built** as daily checks |
| 11 | Lease consistency | Wrong occupancy and access | P2 | **Built** as a daily check |
| 12 | Building profile fields, plans | Onboarding gaps | P2 | Partly: plans counted from Documents; profile fields next phase |
| 13 | Utility bill capture and matching | Billing errors undetected | P2 | Next phase |
| 14 | AI document extraction | Manual encoding | P2 | Next phase (decided with Marc, 22 Nov 2026) |
| 15 | Onboarding assistant, Data Steward agent | Scale beyond one building | P3 | Next phase |
| 16 | Full multi-company tenancy | Needed at building #2 | P2 | Next phase. New tables already carry `buildingId` |
| 17 | MFA for privileged users | Account takeover | P1 | One-time codes exist; enforce for admin in production next phase |

## 4. What this change adds

- **Data Center** (`/data`): readiness score weighted by criticality, a separate safety gate, issues P0–P3 with owners, expiring items, go-live targets, template downloads.
- **Readiness register** (`/data/register`): 31 requirements with source, owner, frequency, verification method and live status; client confirms owners.
- **Assets & QR** (`/data/assets`): registry fields, criticality, spec source, verification by a second person, manuals, linked schedules with interval source, fault reporting, printable QR labels, CSV import with undo.
- **Permits & insurance** (`/data/compliance`): register with files, expiries, renewal notes, maker-checker verification, and "rule confirmed by a qualified person".
- **Contractor vetting** (`/data/contractors`): required credentials by trade, second-person verification, transparent score with evidence share.
- **Daily checks** in the cron, with notifications for new P0/P1.

## 5. Roadmap

| Phase | What | When |
|---|---|---|
| 1 (this change) | Core readiness center, registers, checks, templates, docs | Now |
| 2 | Skyland data collection using the templates; walk-down of plant rooms with QR labels; confirm compliance rules with counsel and safety officer | Before go-live (see handover plan) |
| 3 | AI document extraction with human approval (manuals, permits, quotes, utility bills) | After go-live |
| 4 | Onboarding assistant, weekly data quality report, Data Steward agent | With building #2 |
| 5 | Multi-company tenancy (management company → buildings), MFA for admins, utility bill matching, capex plan | With building #2–3 |

## 6. How to read the score

The score is a weighted average of measured rows (critical ×4, high ×3, medium ×2, low ×1). It never hides safety gaps: if any safety row is below 100% the Data Center shows "Not ready for safety-critical use" with the list, whatever the score. Rows the app cannot measure yet are shown as "Not tracked yet" and left out of the score instead of being guessed.
