# Data decision log

Permanent record of data-related decisions, approvals and open issues. Add new entries at the top.

| Date | Decision | By | Notes |
|---|---|---|---|
| 2026-11-22 | Phase 1 scope: core readiness center (register, Data Center, asset QR registry, compliance register, contractor vetting, daily checks, docs, templates). AI document extraction, onboarding assistant, Data Steward agent and full multi-company tenancy come later. | Marc | Chosen on a decision card |
| 2026-11-22 | One building now, multi-ready: new tables carry `buildingId`; full management-company tenancy when building #2 signs. | Marc | |
| 2026-11-22 | Positioning: happier residents first; NOI and cost savings as measurable proof, not the headline. | Marc | Vision line unchanged |
| 2026-11-22 | Built on top of the accountability work (PR #8): same owners, deadlines and escalation ladder. | Marc | Merge PR #8 first |
| 2026-11-22 | Data quality checks are deterministic rules, not AI. | Proposed in the build, for Marc to confirm | Cheaper and more reliable |
| 2026-11-22 | PH compliance list is a default checklist; each item counts as mandatory only after a qualified person confirms it. | Proposed in the build, for Marc to confirm | Needs counsel and safety officer per building |
| 2026-11-22 | Maker-checker on asset specs, compliance items and contractor credentials. | Proposed in the build, for Marc to confirm | Consistent with procurement rules |

## Open issues
| Issue | Owner | Next step |
|---|---|---|
| Confirm contractor credential requirements per trade | Operations head + counsel | Review `lib/vetting.ts` defaults |
| Confirm the compliance checklist for Skyland | Counsel, safety officer | During handover |
| MFA enforcement for admin and board in production | Us | Next phase |
| Tables without `buildingId` (assets, vendors, documents, schedules, work orders) | Us | Add with multi-company phase |
