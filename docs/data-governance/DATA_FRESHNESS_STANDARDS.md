# Data freshness standards

We track three times separately: **entered** (audit log / created), **effective** (issue, install or start date) and **last verified**.

| Information | Required freshness | How the app enforces it |
|---|---|---|
| Emergency incidents (SOS) | Immediately | SOS alerts to staff; incident duty (log within 1h) |
| Equipment breakdowns | Immediately | Report a fault from the QR page opens a work order (safety assets: high priority, 4h) |
| Work order status | On change | Accountability: acknowledge 1h day / 4h night; verify within 24h |
| Resident service requests | On change | Same as work orders; front desk logs walk-ins within 15 min |
| Occupancy | On change | Register row `unit-occupancy` |
| Main meter readings | Daily | Guard rounds; P2 issue after 36h without a reading |
| Financial transactions | Daily | Online payments post automatically; cash same day |
| Bank reconciliation | Monthly, by the 10th | Register row `bank-recon` (outdated after 40 days) |
| Contractor qualifications | Before engagement and on expiry | Vetting page; P1 when a required credential is missing or expired |
| Procurement prices | Every transaction | Quotes on each purchase request |
| Maintenance schedules | On approved change | Interval source recorded; P0 when a safety task is overdue |
| Equipment condition | Every inspection | Specs re-verified after changes; sensors for lifts and genset |
| Compliance documents | On change and before expiry | Reminder at 45 days (P1), P0 when expired |
| Insurance | On change and before expiry | Contractor insurance P1 when expired; building policies in the compliance register |
| Rental market comps | Weekly to monthly | Comps carry source and date |
| Budget | Monthly review | Reports page budget vs actual |
| Emergency contacts | Checked quarterly | Staff logins need a mobile; quarterly call check in the SOP |
