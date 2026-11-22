# Master data register

_Generated from `lib/readiness.ts` and `lib/datachecks.ts` by `npx tsx scripts/export-register.ts`. Edit the code, not this file._

Every piece of information the building runs on, where it comes from, who owns it, how fresh it must be and how it is verified. The **live status** of each row (Complete, Incomplete, Missing, Outdated, Not tracked yet) is shown in the app at **Data Center → Readiness register**, and the client confirms each owner there. That confirmation is the approval to use the data in operations.

Criticality weights in the readiness score: critical 4, high 3, medium 2, low 1. Rows marked **safety** gate readiness on their own: the building is "not ready for safety-critical use" while any of them is below 100%, whatever the overall score.

## Property

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `prop-profile` | Building profile: name, address, towers, floors, units, year built, floor areas | Every page, reports, AI assistant | Master deed, occupancy permit, as-built plans | Property manager | On change | high | Compare with the master deed and occupancy permit | Yes | Enter from the master deed during onboarding |
| `prop-contacts` | Emergency contacts and building staff (manager, engineer, guards, utilities, BFP, hospital) **(safety)** | SOS, typhoon mode, guard rounds | Building administration | Property manager | On change, checked monthly | critical | Call each number once a quarter | Yes | Every staff login needs a mobile number for alerts |

## Plans & documents

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `docs-plans` | As-built, electrical, plumbing, fire protection and structural plans | Maintenance, renovations, AI assistant | Developer turnover, Office of the Building Official | Engineering (property manager for now) | On renovation | high | Engineer confirms plans match the building | Yes | Upload to Documents under Plans |
| `docs-manuals` | Equipment manuals, datasheets and warranties | Asset pages (QR), preventive maintenance | Manufacturer, supplier, turnover documents | Chief engineer | On purchase | medium | Model on the manual matches the nameplate | Yes | Attach the manual on each key asset's page |

## Assets

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `asset-register` | Asset register: every safety and high-criticality asset has make, model, serial, location, install date **(safety)** | Maintenance, budgeting, procurement, QR pages | Nameplate photo, turnover list, invoices | Chief engineer | Every inspection | critical | Nameplate photo matches the record | Yes | Walk the plant rooms with the asset list and photograph each nameplate |
| `asset-verified` | Key asset specifications verified by a person **(safety)** | Maintenance intervals, replacement budget | Nameplate, manual or contractor report | Chief engineer | Every inspection | critical | Second person signs off in the asset page | Yes | Tap Verify specs on each asset page after checking the nameplate |
| `asset-costs` | Replacement cost and expected life | Reserve fund and capex plan | Supplier quotes, manufacturer life data | Chief engineer with finance | Yearly | medium | Based on a dated quote | Yes | Add replacement cost from a current quote |

## Maintenance

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `pm-coverage` | Every safety-critical asset has a preventive maintenance schedule **(safety)** | Maintenance calendar, work orders | Manufacturer manual, statutory rules, engineer | Facilities management | On approved change | critical | Schedule linked to the asset | Yes | Link each safety asset to its maintenance task |
| `pm-source` | Maintenance intervals come from the manufacturer, a statutory rule or an engineer (never guessed) **(safety)** | Maintenance calendar | Manual, regulation, engineer's recommendation | Chief engineer | On approved change | critical | Interval source recorded on the schedule | Yes | Set the interval source on each safety task |
| `pm-current` | Preventive maintenance done on time | Maintenance calendar | Work orders, contractor reports | Facilities management | On completion | high | Completion photo and checklist | Yes | Close overdue tasks or reschedule with a reason |
| `wo-history` | Work orders with assignee, cost and completion photo | Work orders, vendor scoring, reports | App (technician job link) | Property manager | On change | high | Manager verifies the after photo | Yes | Already captured by the accountability workflow |

## Contractors

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `vendor-vetting` | Contractor registration, permits, licences and insurance, verified | Procurement, maintenance, vendor scoring | Contractor submits; we check with the issuer | Procurement (operations head) | Before engagement and on expiry | high | Someone other than who entered it checks each document | Yes | Request missing documents from each active contractor |
| `vendor-insurance` | Contractor insurance current | Procurement, permits-to-work | Insurer certificate | Procurement (operations head) | On change and before expiry | high | Certificate checked with insurer | Yes | Chase expired certificates before any new job |

## Procurement

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `proc-controls` | Purchase requests, quotes, approvals, delivery photos, receipts | Procurement & controls | App | Procurement (operations head) | Every transaction | high | Money gates: no receipt, no payment | Yes | Already enforced in Procurement |

## Units & owners

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `unit-register` | Unit codes, floors and floor areas | Dues billing, voting weights, 3D view | Master deed, condominium certificates of title | Property administration | On change | critical | Floor area matches the master deed | Yes | Import the unit list from the master deed |
| `unit-owner` | Registered owner for each unit with a way to reach them | Billing, resident updates, voting | Title, owner registration form | Property administration | On sale or change | high | Title or deed of sale on file | Yes | Run the owner registration drive |
| `unit-occupancy` | Occupancy: owner-occupied, leased or vacant | Leasing, emergency headcount, typhoon mode | Owner, lease registration | Property administration | On change | medium | Owner confirms in the app | Yes | Ask owners to confirm in the app |

## Leasing

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `lease-register` | Active leases: tenant, rent, deposit, dates (no overlaps) | Leasing, occupancy, access | Signed lease contract | Leasing | On change | high | Matches the signed contract; dates do not overlap | Yes | Upload lease contracts and fix overlaps |
| `market-comps` | Rental and sale comparables with source, date and asking vs actual | AI price check, listings | Listings, broker partner, actual transactions | Leasing | Weekly to monthly | medium | Each comp has a source and date; estimates are labelled | Yes | Already labelled in the price check |

## Utilities

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `meter-readings` | Daily main water and electric meter readings | Energy & water, leak check | Guard rounds (measured) | Engineering and finance | Daily | high | Reading photo or second reading | Yes | Guards enter readings on each round |
| `utility-bills` | Monthly utility bills (Meralco, Maynilad/Manila Water) | Energy & water, billing checks | Utility bills | Finance | Monthly | medium | Matches meter readings within tolerance | Not yet | Phase 2: upload bills and match against readings |

## Money

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `budget` | Approved operating budget by line | Reports, budget vs actual, AI advisor | Board-approved budget | Finance | Monthly review | high | Board resolution approving the budget | Yes | Enter the approved budget |
| `bank-recon` | Bank reconciliation against the accounting system | Collections, reports | Bank statement, accounting system | Finance | Monthly (by the 10th) | critical | Treasurer signs the reconciliation | Yes | Upload the signed reconciliation each month to Documents (Financial) |
| `capex-plan` | Capital expenditure and reserve fund plan | Board reports | Engineer's assessment, board resolution | Finance with chief engineer | Yearly | medium | Board-approved plan | Not yet | Phase 2: generate from asset life and replacement cost |

## Compliance

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `compliance-register` | Mandatory permits, certificates and insurance: verified, on file and not expired **(safety)** | Compliance register, reminders | Issuing agency documents | Compliance officer (operations head) | On change and before expiry | critical | Original seen and file attached; verified by a second person | Yes | Upload each certificate and verify it |
| `compliance-rules` | Which PH rules apply, confirmed by a qualified person | Compliance register | Lawyer, engineer or safety officer | Compliance officer (operations head) | Yearly | high | Name of the person who confirmed | Yes | Have counsel and the safety officer confirm the default checklist |
| `insurance-building` | Building insurance policy (fire, all-risk, CGL) | Compliance register | Insurer | Finance | On renewal | critical | Policy schedule on file | Not yet | Add as a compliance item with the policy file |

## Security

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `security-logs` | Guard rounds, visitor logs, incidents | Front desk, guard rounds, SOS | App (guards) | Security management | Each shift | high | Manager reviews next morning | Yes | Already tracked as a duty with escalation |
| `drills` | Fire and evacuation drill records | Typhoon & safety, compliance | Drill report | Security management | Per drill (at least yearly) | high | Signed drill report | Yes | Upload the last drill report to Documents (Safety) |

## Resident service

| ID | Data requirement | Module | Authoritative source | Data owner (default) | Update frequency | Criticality | Verification method | Measured in app | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| `kb-policies` | House rules, policies and FAQs the AI assistant answers from | Helpdesk, Messenger/Viber AI | Board-approved house rules | Property manager | On change | high | Board-approved version on file | Yes | Upload the approved house rules (Governance) |
| `owner-contacts` | Owner contact details (email or mobile) with consent | Resident updates, billing reminders | Owner registration | Property administration | On change | medium | One-time code proves the number or email works | Yes | Owners confirm by signing in once |

## Daily data quality checks

Run by the daily cron (`/api/cron`) and whenever someone opens the Data Center. New P0 and P1 issues notify the owner role (P0 by app and SMS, P1 in the app).

| Check | Severity | Rule |
|---|---|---|
| `asset-safety-no-pm` | P0 | Safety-critical asset has no preventive maintenance schedule |
| `pm-safety-overdue` | P0 | Safety or statutory maintenance task is overdue |
| `compliance-expired` | P0 | Mandatory permit, certificate or policy has expired |
| `paid-no-receipt` | P0 | Purchase marked paid with no receipt photo |
| `compliance-unverified` | P1 | Mandatory compliance item not verified or no file attached |
| `compliance-expiring` | P1 | Mandatory item expires within 45 days |
| `pm-interval-unverified` | P1 | Safety maintenance interval has no verified source (manufacturer, statute, engineer) |
| `asset-unverified` | P1 | Safety or high-criticality asset specs not verified by a person |
| `vendor-unvetted` | P1 | Active contractor missing verified required credentials |
| `vendor-insurance` | P1 | Active contractor insurance expired or missing |
| `lease-overlap` | P1 | Two leases on the same unit overlap, or a lease ends before it starts |
| `payment-duplicate` | P1 | Two payments to the same vendor for the same amount within 30 days |
| `compliance-rule-unconfirmed` | P2 | Default PH rule not yet confirmed by a qualified person |
| `asset-incomplete` | P2/P3 | Asset missing make, model or serial (P2 for key assets, P3 grouped for others) |
| `asset-duplicate` | P2 | Two assets share a serial number |
| `asset-past-life` | P2/P3 | Asset past its expected life with no replacement planned |
| `meter-missing` | P2 | No main meter reading in 36 hours |
| `unit-incomplete` | P2 | Units with no floor area or no owner on record (grouped) |
