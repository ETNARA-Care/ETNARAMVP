# Phase 4.5 Frontend Source and Data Audit

Audit date: 2026-09-09

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
| Admin Residents | Real | recipients, shifts, assignments, care events, incidents | Rows open a real operational resident profile; no demo fallback |
| Admin Shifts | Real | shifts, recipients, workers, assignments | Create and assign persist in backend |
| Admin Messages | Real | conversations and messages | No demo fallback |
| Admin Workers | Real | organization workers + worker profile credential summaries | Membership, credentials and expiration warnings come from the organization-scoped API; unsupported availability was removed |
| Admin Incidents | Real | incidents, incident timeline, recipients, workers | Cards and notifications open the operational detail and link to the resident profile |
| Admin Compliance | Real | organization workers + worker profile credential summaries + eligibility evaluation | Compact per-worker status expands to show unmet requirements and credential alerts; no mock fallback |
| Admin Settings | Mixed | real session + placeholder organization settings | No fake persistence |
| Caregiver Shifts | Real | `/organizations/:id/me/shifts` | Authenticated worker scope |
| Caregiver Shift Detail | Real | shift, visit verification, care events, incidents | Check-in, activity, incident and check-out persist |
| Caregiver Messages | Real | conversations and messages | No demo fallback |
| Caregiver Profile | Real/Mixed | real session + `/me/credentials`; hard-coded display name | Credentials and expiration status are real; display identity remains pending |
| Family Today | Real | family-safe shifts + timeline | Assigned caregiver and check-in/out status come from backend |
| Family Activity | Real | `/me/care-recipients` + family-safe timeline | Curated family response |
| Family History | Real | family-safe shifts + timeline | Completed shifts and their authorized summaries persist and reload from the backend |
| Family Messages | Real | conversations and messages | No demo fallback |
| Family Profile | Real/Mixed | family-safe caregiver credentials + real session; hard-coded family identity | Never exposes credential documents or internal review data |
| Family Notifications | Real | `/me/notifications` + curated `family-incidents` | Incident alerts open a family-safe detail; internal actions, assignments and resolution are excluded |
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
- Notification bells in Family, Caregiver and Agency use the real authenticated
  inbox, refresh on focus/open and poll every 30 seconds; no participant ID or
  DemoStore notification fallback remains.
- Incident notification navigation is role-aware. Family resolves an incident
  only through the curated family contract; Administration uses the staff
  incident detail and can continue to the resident's real operational profile.
- Family History no longer has a fixed demo recipient or operational
  `DemoStore` dependency. It resolves the authenticated family relationship,
  loads completed family-safe shifts and associates curated timeline events by
  the real shift window.
- Admin Workers no longer imports `DemoStore`; no operational page uses the
  demo store as a fallback. Remaining mixed identity labels are documented
  above and should be migrated independently.
