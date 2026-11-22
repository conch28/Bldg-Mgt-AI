# Data ownership matrix

Defaults the client confirms in **Data Center → Readiness register** (one sign-off per row). Until the building has its own engineering, finance or compliance staff, the property manager and our operations head cover those roles. Day-to-day records (tickets, rounds, receipts) follow the accountability matrix from PR #8 (`lib/duties.ts`, page **Accountability**).

| Data category | Owner (default) | Enters | Checks (second person) | Freshness | Escalation when late or wrong |
|---|---|---|---|---|---|
| Property profile and units | Property manager | Property administration | Operations head | On change | Operations head, then board |
| Building plans | Engineering (manager for now) | Manager | Engineer of record | On renovation | Operations head |
| Equipment registry | Chief engineer (manager for now) | Manager or technician | Operations head | Every inspection | P1 issue to manager; board if safety asset unverified 30 days |
| Maintenance schedules | Facilities management | Manager | Operations head | On approved change | P0 for safety gaps, same day |
| Maintenance records | Facilities management | Technician (job link with photo) | Manager within 24h | On completion | Manager, operations head, board |
| Contractor records | Procurement (operations head) | Manager | Operations head or board | Before engagement and on expiry | P1 issue; no new jobs while insurance expired |
| Procurement | Procurement (operations head) | Manager | Approvers per limit | Every transaction | Accountability matrix |
| Financial records | Finance (treasurer + freelance CPA) | Operations head | Treasurer | Daily postings, monthly reconciliation | Board |
| Leases | Leasing | Manager | Operations head | On change | P1 issue for overlaps |
| Tenant and owner records | Property administration | Owner (self-service) or manager | Owner confirms by sign-in | On change | Manager |
| Security records | Security management | Guards | Manager next morning | Each shift | Accountability matrix |
| Compliance documents | Compliance officer (operations head) | Manager | Operations head or board, against the original | On change and before expiry | P1 at 45 days, P0 when expired, board told |
| Utility information | Engineering and finance | Guards (readings) | Manager | Daily | P2 after 36h without a reading |

## Escalation path

1. The check opens an issue and tells the owner role (P0 by app and SMS, P1 in the app).
2. Overdue duties follow the accountability ladder: owner → supervisor → board.
3. The board sees open P0 issues as a red badge on **Data Center** in the menu.

## Rules

- Every critical dataset has a named owner and an escalation path.
- Nobody verifies their own entry (enforced in the app for assets, compliance items and contractor documents).
- Owners can delegate entry, not accountability.
