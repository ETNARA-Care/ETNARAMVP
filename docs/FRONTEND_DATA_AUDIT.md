# Phase 4.5 Frontend Source and Data Audit

Audit date: 2026-09-08

## Stable baseline and restore point

- Audited `main`: `73bc3697391b6cba94cc718995d4cd7ca32417e3`
- Restore branch: `restore/phase4-stable-2026-09-08`
- Backend contract reference (read-only): `ETNARA-Care/ETNARA-Backend@46002664806854defe2576e3633de317fcddfcbb`

## Source-of-truth mismatch found

Before this cut, GitHub Pages extracted and built `frontend-v23.zip`, while
frontend CI installed and tested `frontend/`. The test step in CI also used
`continue-on-error: true`. A green CI result therefore did not prove that the
deployed V23 source passed tests.

## First safe consolidation cut

`frontend-v23/` is now the only active build source for V23. Both pull-request
CI and the Pages deployment run from that directory with Node 22 and execute:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run build`

The ZIP remains temporarily as a historical artifact, but no active workflow
extracts or builds it. The older `frontend/` and `frontend-v2/` directories are
also retained for comparison in this first reversible cut; neither is built or
published by the active workflows.

## Screen-by-screen data classification

| Experience / screen | Classification | Current authority | Notes |
|---|---|---|---|
| Login, session, organization selection | Real | `/auth/*`, `/me`, `/me/active-organization` | No demo fallback |
| Admin Overview | Real | recipients, workers, shifts, assignments, care events | Organization-scoped API |
| Admin Residents | Real | recipients, shifts, assignments | Organization-scoped API |
| Admin Shifts | Real | shifts, recipients, workers, assignments | Create and assign persist in backend |
| Admin Messages | Real | conversations and messages | No demo fallback |
| Admin Workers | Simulated | `DemoStore` | Availability and credential status are mock |
| Admin Incidents | Simulated | `DemoStore` | Must move to incident endpoints |
| Admin Compliance | Placeholder | none | Explicitly says no data yet |
| Admin Settings | Mixed | real session + placeholder organization settings | No fake persistence |
| Caregiver Shifts | Real | `/organizations/:id/me/shifts` | Authenticated worker scope |
| Caregiver Shift Detail | Real | shift, visit verification, care events, incidents | Check-in, activity, incident and check-out persist |
| Caregiver Messages | Real | conversations and messages | No demo fallback |
| Caregiver Profile | Real/Mixed | real session + `/me/credentials`; hard-coded display name | Credentials and expiration status are real; display identity remains pending |
| Family Today | Real | family-safe shifts + timeline | Assigned caregiver and check-in/out status come from backend |
| Family Activity | Real | `/me/care-recipients` + family-safe timeline | Curated family response |
| Family History | Simulated | `DemoStore` | Fixed demo recipient and completed shifts |
| Family Messages | Real | conversations and messages | No demo fallback |
| Family Profile | Real/Mixed | family-safe caregiver credentials + real session; hard-coded family identity | Never exposes credential documents or internal review data |
| Family Notifications | Placeholder | none | Bell still uses `DemoStore` notifications |
| `/demo` landing | Explicit demo | static demo identities | Isolated, not an operational fallback |

## Backend contracts verified

No backend files were modified. The frontend routes used in the real surfaces
were checked against backend `main`, including authentication, organization
context, organization shifts, worker shifts, assignments, check-in/check-out,
care events, family-safe timeline, conversations and messages.

## Risks and exact next cut

- The first cut aligns source, CI and deployment but does not yet remove the
  retained historical directories or ZIP.
- Mock-backed operational screens remain visible and are listed above; they
  must not be represented as persistent data.
- Live three-role validation needs deployed branch credentials and a shared
  recipient/shift; this PR intentionally does not deploy or merge.
- Local contract regression passed against backend `main`: TypeScript build and
  11/11 tests. The V23 cut passed typecheck, lint (warnings only), 3/3 boundary
  tests, and a production build using the active `d460` Railway URL.
- Next: migrate Family History to family-safe endpoints, then
  Admin Workers/Incidents and notifications, one reversible surface at a time.
