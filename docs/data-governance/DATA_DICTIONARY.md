# Data dictionary

Master records and the fields that matter for data quality. Full definitions live in `prisma/schema.prisma`. Use relations and identifiers (unit code, asset tag, vendor id) instead of retyping the same facts in several places.

## Single source of truth

| Master dataset | Table(s) | Key | Feeds |
|---|---|---|---|
| Property | `Building` | `id` | Every page; `buildingId` on users, units and new data tables |
| Units | `Unit` | `buildingId + code` | Billing, voting weights, occupancy, 3D view, work orders |
| Owners and residents | `User` (role OWNER), `Unit.ownerId` | `email` | Billing, updates, sign-in, privacy requests |
| Leases | `Lease` | `id`, by `unitId` | Occupancy, leasing, access |
| Assets | `Asset` | `tag` (unique, printed on the QR label) | Maintenance, replacements, sensors, procurement, capex |
| Maintenance schedules | `PMTask` | `id`, linked by `assetTag` | Calendar, auto work orders, readiness |
| Work orders | `WorkOrder`, `WOEvent` | `number` | Resident requests, vendor reliability, reports |
| Contractors | `Vendor`, `VendorCredential` | `id` | Procurement, schedules, vetting |
| Procurement | `PurchaseRequest`, `Quote`, `StockItem`, `StockMove` | `number`, `sku` | Spending controls, price baselines |
| Compliance | `ComplianceItem` | `id`, by `buildingId` | Permits, insurance, reminders |
| Documents | `Document` | `id` | Manuals, permits, credentials, plans, AI knowledge |
| Utilities | `MeterReading`, `UtilityReading` | meter + time | Energy and water, leak checks |
| Data quality | `DataIssue`, `ReadinessSignoff` | `buildingId + checkId + entityKey`, `buildingId + reqId` | Data Center |
| Audit | `AuditLog` | time | Every change to money, tickets, users, reports, assets, compliance |

## Asset (registry fields)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `tag` | text | yes | Unique code printed on the label, e.g. `FP-JOCKEY-1` |
| `name`, `category`, `location` | text | yes | Plain name, type, where it is |
| `criticality` | SAFETY / HIGH / NORMAL | yes | SAFETY = fire, lifts, power, gas; drives checks |
| `manufacturer`, `model`, `serial` | text | yes for SAFETY/HIGH | From the nameplate; serial must be unique |
| `specSource` | NAMEPLATE / MANUAL / INVOICE / CONTRACTOR / UNKNOWN | before verifying | Where the specs came from |
| `verifiedBy`, `verifiedAt` | text, time | — | Set by a second person; cleared when specs change |
| `installedAt`, `lifeMonths` | date, months | yes | Age and expected life |
| `warrantyUntil` | date | — | Drives free warranty repairs |
| `cost`, `replacementCost` | pesos | — | Acquisition and today's replacement cost (from a quote) |
| `ownerName`, `vendor` | text | — | Responsible person, service contractor |
| `manualDocId` | Document id | — | Manual or datasheet |
| `status` | OK / FAULTY / RETIRED | yes | Set FAULTY when a fault is reported from the QR page |

## PMTask (added fields)

| Field | Meaning |
|---|---|
| `assetTag` | The registry asset this schedule covers |
| `intervalSource` | MANUFACTURER / STATUTORY / ENGINEER / CONTRACT / UNVERIFIED. Safety schedules cannot be created as UNVERIFIED |

## ComplianceItem

| Field | Meaning |
|---|---|
| `kind` | PERMIT / CERTIFICATE / INSURANCE / PLAN / PRIVACY / OTHER |
| `title`, `authority`, `docNumber` | What, who issued it, its number |
| `issuedAt`, `expiresAt` | Dates; reminders at 45 days, P0 when expired |
| `renewal` | What renewal needs, in plain words |
| `mandatory` | Counts toward readiness |
| `ruleConfirmedBy/At` | Qualified person who confirmed the rule applies to this building |
| `documentId` | Scan of the original |
| `status`, `verifiedBy/At`, `enteredBy` | PENDING → VERIFIED or REJECTED by someone other than `enteredBy` |

## VendorCredential

| Field | Meaning |
|---|---|
| `kind` | SEC_DTI, MAYORS_PERMIT, BIR_2303, INSURANCE, PCAB, TECH_LICENSE, SAFETY, REFERENCE |
| `number`, `issuer`, `expiresAt` | As on the document |
| `documentId` | Copy of the document (required to verify, except phone references) |
| `status`, `enteredBy`, `verifiedBy/At` | Maker-checker |

## DataIssue

| Field | Meaning |
|---|---|
| `checkId`, `entityKey` | Which rule, which record (e.g. `asset-safety-no-pm`, `asset:FP-JOCKEY-1`) |
| `severity` | P0 critical, P1 high, P2 medium, P3 low |
| `ownerRole`, `href` | Who fixes it and where |
| `status`, `resolvedBy`, `evidence` | Closed by a person with evidence, or by the check ("Data checks") when the condition is gone |
| `firstSeen`, `lastSeen`, `notifiedAt` | Timeline |

## Time fields

Where it matters we keep three times apart: when information was **entered** (`createdAt`/audit log), when it is **effective** (`issuedAt`, `installedAt`, `start`), and when it was last **verified** (`verifiedAt`). Display is in Asia/Manila.
