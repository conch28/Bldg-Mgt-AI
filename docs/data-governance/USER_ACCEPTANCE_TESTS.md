# User acceptance tests

Run on a staging copy with sample data (never on production). ✅ = tested on 22 Nov 2026 against the local demo build in this change; ☐ = to run during onboarding or later phases.

| # | Scenario | Steps | Expected | Status |
|---|---|---|---|---|
| 1 | Readiness overview | Manager opens Data Center | Score, safety gate with list, issues by severity, expiring items, go-live targets | ✅ |
| 2 | Safety gate | Safety asset with no schedule exists | "Not ready for safety-critical use" despite a high score; P0 issue | ✅ |
| 3 | Asset registration | Add an asset with a serial already used | Refused with the clashing tag | ☐ |
| 4 | Asset QR scan | Guard opens an asset page from the QR | Page loads; Data Center itself is blocked for guards | ✅ |
| 5 | Equipment breakdown | Guard taps Report a fault on the generator | High-priority work order, asset marked faulty | ✅ |
| 6 | Spec verification | Admin verifies Tower B lift 4 | Verified with name and date; editor cannot verify own change | ✅ |
| 7 | Missing specs | Try to verify the jockey pump (no serial) | Refused: fill in serial first | ☐ |
| 8 | Safety schedule without source | Add a schedule to a safety asset as "not verified" | Refused | ☐ |
| 9 | Asset import, bad rows | Import a CSV with a bad tag, category, date and life | Every problem listed by row; nothing saved | ✅ |
| 10 | Asset import and undo | Import 2 assets, then Undo last import | Created, then removed | ✅ |
| 11 | Template EXAMPLE row | Import the template unchanged | Refused: delete the EXAMPLE row | ☐ |
| 12 | Compliance verification | Manager enters, admin verifies with the scan | Verified; the person who entered sees no Verify button | ✅ |
| 13 | Compliance rule confirmation | Admin records the safety officer's confirmation | Rule shows "confirmed by" | ✅ |
| 14 | Expired permit | Permit past expiry | P0 issue, red on the register and overview | ✅ |
| 15 | Renewal | Update the expiry and attach the new scan | Back to "needs a second check"; issue closes after verification on the next check run | ☐ |
| 16 | Contractor vetting | Contractor missing BIR 2303 | Not vetted; P1 issue; score shows evidence share | ✅ |
| 17 | Contractor insurance expired | Insurance date in the past | P1 issue; "No new jobs until renewed" | ✅ |
| 18 | Close issue with evidence | Close a P3 issue with a sentence | Closed with name and evidence; empty evidence refused | ✅ |
| 19 | Auto-close | Fix the underlying record, run checks | Issue closes with "Check passed on …" evidence | ☐ |
| 20 | Owner sign-off | Board confirms an owner on a register row | Row shows owner, approver, date | ☐ |
| 21 | Template download | Download each CSV template | Header row and EXAMPLE row; board/manager/admin only | ✅ |
| 22 | Overlapping leases | Two leases on one unit overlap | P1 issue | ☐ |
| 23 | Duplicate payment | Two paid requests, same vendor and amount within 30 days | P1 issue | ☐ |
| 24 | Paid without receipt | Payment with no receipt photo | P0 issue | ☐ |
| 25 | Missing meter readings | No reading for 36h | P2 issue to guards | ☐ |
| 26 | Daily cron | Call `/api/cron` with the secret | Response includes `data` counts; P0/P1 owners notified once | ☐ |
| 27 | Owner access | Owner opens an asset URL | Blocked | ✅ |
| 28 | Purchase request and approval | Existing procurement flow | Unchanged (regression) | ☐ |
| 29 | Tenant complaint to ticket | Existing helpdesk flow | Unchanged (regression) | ☐ |
| 30 | AI with missing data | Ask the helpdesk a policy question with no house rules on file | Escalates instead of inventing | ☐ |

Later phases add: new property onboarding end to end, AI document extraction with approval, utility bill matching, capex planning from asset life, market survey without fabricated comparables.
