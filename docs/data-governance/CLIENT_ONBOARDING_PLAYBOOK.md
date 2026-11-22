# Client onboarding playbook

Goal: a new building is running on complete, verified data within the 75-day handover window, with phased activation: a module goes live only when its critical data is ready.

## Steps
| # | Step | Who | Output |
|---|---|---|---|
| 1 | Kick-off: questionnaire below, confirm property type and modules wanted | Operations head + board | Answers, module list |
| 2 | Send the document request and templates | Operations head | [DATA_COLLECTION_REQUEST.md](DATA_COLLECTION_REQUEST.md), `Building_Onboarding_Templates.xlsx` |
| 3 | Create the production building (separate from the demo; no sample data) | Us | Empty production instance (see DEPLOY.md, production mode) |
| 4 | Import units and owners; owners confirm by signing in | Admin | Units register |
| 5 | Plant-room walk-down: photograph nameplates, stick QR labels, import assets | Manager + technician | Asset registry |
| 6 | Link schedules with interval sources; contractor sends credentials | Manager | Schedules, vetting |
| 7 | Enter permits and insurance with scans; counsel and safety officer confirm rules | Manager + qualified persons | Compliance register |
| 8 | Second-person verification pass on assets, permits, credentials | Operations head / board | Verified records |
| 9 | Board confirms owners in the readiness register | Board | Sign-offs |
| 10 | Readiness review: safety gate green, go-live targets met | Board + us | Go/no-go per module |

## Module activation gates
| Module | Turn on when |
|---|---|
| Billing and collections | Units with floor areas and owners 100%; budget entered |
| Work orders and helpdesk | Staff mobiles on file; house rules uploaded |
| Preventive maintenance | Safety assets verified and scheduled (safety gate green) |
| Procurement | Approval limits confirmed; key contractors vetted |
| Leasing | Active leases complete and consistent |
| Energy and water | Daily meter readings flowing |

## Client questionnaire
Answer with what you know. "We don't know" is a useful answer.

**Property**
1. Property type: condominium, office, mixed-use, residential, warehouse?
2. How many towers, floors, basement levels, units, parking slots?
3. Year completed? Who holds the as-built plans?
4. Is there a condominium corporation? Who are the authorized signatories?

**People**
5. Who manages the building today, and when does their contract end?
6. Who are the in-house staff (engineer, technicians, admin) and who employs them?
7. Who is the security agency and how many guards per shift?

**Equipment**
8. How many lifts, and who maintains them? Any lift older than 20 years?
9. Generator size and service contractor? Fire pump type?
10. Do you have an equipment list from turnover? Manuals?
11. Any equipment failing repeatedly in the last year?

**Compliance**
12. When does the FSIC expire? Last BFP inspection findings?
13. Elevator certificates of operation and electrical inspection: current?
14. DENR permits for the generator and wastewater: current?
15. Who is your Data Protection Officer?
16. What insurance do you carry, with whom, and until when?

**Money**
17. Dues rate per sqm? Collection rate? Total arrears?
18. Who keeps the books? Is there an external auditor?
19. Reserve or sinking fund balance? Planned major works?
20. Approval limits for spending today?

**Residents**
21. How do residents reach management today (Viber group, Facebook, phone)?
22. Top 3 resident complaints in the last year?
23. Share of units leased vs owner-occupied? Short-term rentals allowed?

**Priorities**
24. What would make residents noticeably happier in the first 90 days?
25. What worries the board most right now?

## Never
- Import sample or example rows into a production building.
- Turn on a module whose critical data is not ready; show the gap instead.
