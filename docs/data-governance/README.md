# Data governance pack

Why this exists: residents feel bad data first. A lift with no maintenance schedule breaks down, an expired permit closes the pool, a wrong floor area puts the wrong amount on a dues bill. Our goal is **happier residents, through innovation and heartfelt service**, and that only works when the information the building runs on is complete, verified and current. Lower operating cost and a healthier net operating income (NOI) follow from the same discipline, and we show them as proof, not as the headline.

| File | What it is |
|---|---|
| [DATA_READINESS_REPORT.md](DATA_READINESS_REPORT.md) | Audit of the app, prioritized gap analysis, roadmap |
| [MASTER_DATA_REGISTER.md](MASTER_DATA_REGISTER.md) | Every data requirement and daily check (generated from code) |
| [DATA_DICTIONARY.md](DATA_DICTIONARY.md) | Master records and their key fields |
| [DATA_OWNERSHIP_MATRIX.md](DATA_OWNERSHIP_MATRIX.md) | Who owns, enters, checks and escalates each data category |
| [DATA_COLLECTION_REQUEST.md](DATA_COLLECTION_REQUEST.md) | Document request checklist to send to every new client |
| [DATA_VALIDATION_RULES.md](DATA_VALIDATION_RULES.md) | Input validation, maker-checker approvals, quality checks |
| [DATA_FRESHNESS_STANDARDS.md](DATA_FRESHNESS_STANDARDS.md) | How fresh each kind of information must be |
| [DOCUMENT_REGISTER.md](DOCUMENT_REGISTER.md) | Document categories, who sees them, retention |
| [ASSET_REGISTRY_STANDARD.md](ASSET_REGISTRY_STANDARD.md) | Asset tags, QR labels, required fields, verification |
| [MAINTENANCE_DATA_STANDARD.md](MAINTENANCE_DATA_STANDARD.md) | Schedules, interval sources, work order evidence |
| [CONTRACTOR_VETTING_STANDARD.md](CONTRACTOR_VETTING_STANDARD.md) | Required credentials and the transparent score |
| [AI_DATA_SAFEGUARDS.md](AI_DATA_SAFEGUARDS.md) | What AI may and may not do with building data |
| [CLIENT_ONBOARDING_PLAYBOOK.md](CLIENT_ONBOARDING_PLAYBOOK.md) | Step-by-step onboarding and the client questionnaire |
| [PRODUCTION_DATA_CHECKLIST.md](PRODUCTION_DATA_CHECKLIST.md) | What must be true before a building goes live |
| [DATA_GOVERNANCE_SOP.md](DATA_GOVERNANCE_SOP.md) | Daily, weekly, monthly and yearly routines |
| [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md) | End-to-end scenarios to test before go-live |
| [DECISION_LOG.md](DECISION_LOG.md) | Permanent record of data decisions, approvals and open issues |

Templates: [`templates/data-collection/`](../../templates/data-collection/) has one CSV per topic and `Building_Onboarding_Templates.xlsx` (17 sheets with dropdowns). They are generated from `lib/templates.ts`:

```bash
npx tsx scripts/export-templates.ts && python3 scripts/build-templates-xlsx.py
npx tsx scripts/export-register.ts   # refresh MASTER_DATA_REGISTER.md
```

In the app: **Board → Data Center** (`/data`) for board, manager and operations head. Guards reach asset pages through the QR labels.

Nothing in this pack is legal advice. Philippine regulatory items are a starting checklist that a qualified person confirms per building before the app treats them as mandatory.
