# Document register

All files live in **Documents** (stored in the database, served only to signed-in users with access, every view audit-logged).

| Category | Examples | Visible to | Linked from | Keep |
|---|---|---|---|---|
| Governance | Master deed, by-laws, house rules | Owners | AI knowledge (house rules) | Permanent |
| Financial | Statements, reconciliations, budgets | Owners or board | Register `bank-recon` | 10 years |
| Minutes | Board and AGM minutes | Owners | Meetings | Permanent |
| Contracts | Service contracts, contractor credentials | Board | Contractor vetting | Contract term + 5 years |
| Notices | Public notices | Owners | Updates | 2 years |
| Forms | Proxy, permits to work | Owners | — | Current version |
| Plans | As-built and system plans | Board | Register `docs-plans` | Permanent |
| Manuals | Equipment manuals, datasheets, warranties | Board | Asset page | Life of the asset |
| Compliance | Permits, certificates, insurance policies | Board | Compliance register | Validity + 5 years |
| Safety | Drill reports, incident reports | Board | Register `drills` | 5 years |
| Imports | Asset import undo snapshots | Board | Asset import | 1 year |

Rules:
- A permit, certificate or credential counts as verified only when a second person checked the scan against the original.
- Uploaded documents are data, not instructions. When AI extraction comes (phase 3), text inside a document can never change system rules or approve anything.
- Retention periods are defaults for the client and counsel to confirm against the privacy notice.
