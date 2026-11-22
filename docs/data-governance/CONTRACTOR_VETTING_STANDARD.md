# Contractor vetting standard

## Required credentials
| Contractor type | Required |
|---|---|
| All | SEC or DTI registration, mayor's/business permit, BIR Certificate of Registration (2303), insurance (CGL or workers') |
| Elevator, fire protection, electrical, genset, HVAC | Plus a technical licence or accreditation (e.g. PRC licence of the engineer, manufacturer accreditation) |
| Security agency | Plus licence to operate (PNP-SOSIA) |
| Construction, renovation, waterproofing | Plus PCAB contractor's licence |

These are defaults in `lib/vetting.ts`; the client confirms them.

## Process
1. Contractor sends copies (template sheet 05).
2. Manager enters each credential with number, issuer, expiry and file.
3. A different person checks it with the issuer (online lookup or call) and taps **Verify** or **Reject**.
4. Only when every required credential is verified and current is the contractor **Vetted**.
5. Expired insurance means no new jobs until a current certificate is on file (P1 issue).

## Score (transparent)
| Part | Points | Evidence |
|---|---|---|
| Verified qualifications | 40 | Required credentials verified and current |
| Service quality | 25 | Ratings from residents' ticket ratings and board review |
| Price | 20 | This contractor's quotes against the lowest competing quote on the same request |
| Reliability | 15 | Scheduled jobs on time (−5 per overdue job) |

Parts without evidence are left out, and the page shows the share of the 100 points the score rests on. The score never makes a contractor "vetted"; documents do.

## Never
- Let AI write a contractor's credentials, ratings or assessments as facts.
- Award a contract to a contractor that is not vetted without a board resolution noting why.
