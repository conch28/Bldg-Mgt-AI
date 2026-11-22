# Production data checklist

Before a building runs on the system. Each line is checked by a person and dated.

## Environment
- [ ] Production instance is separate from the demo (own Vercel project and database, `DEMO_MODE` unset)
- [ ] No sample data: building and first admin created by `prisma/bootstrap.ts` only
- [ ] Nightly encrypted backup running; a restore tested in the last 30 days
- [ ] `CRON_SECRET` set so daily checks and reminders run
- [ ] Admin and board accounts use one-time codes; shared passwords removed

## Data (from Data Center → Go-live targets)
- [ ] Critical asset registry completeness 100%
- [ ] Critical equipment information verified 100%
- [ ] Safety-critical maintenance schedule coverage 100%
- [ ] Active lease information complete 100% (if leasing is on)
- [ ] Mandatory compliance documents accounted for 100%
- [ ] Unresolved P0 data defects: 0
- [ ] Safety and compliance records not yet verified: 0
- [ ] Safety gate shows "Safety-critical data is complete and verified"

## Approvals
- [ ] Board confirmed an owner for every register row
- [ ] Counsel / safety officer confirmed which compliance rules apply
- [ ] Contractor credential requirements confirmed
- [ ] Approval limits confirmed by board resolution

## Migrations
- [ ] Migrations reviewed; no destructive change without a backup taken the same day
- [ ] Rollback steps written for this release
- [ ] Imports done with Check first; undo snapshots kept

## Sign-off
| Role | Name | Date |
|---|---|---|
| Board president | | |
| Operations head | | |
| Property manager | | |
