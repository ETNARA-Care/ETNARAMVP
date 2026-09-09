# ETNARA Frontend Agent State

## Current Status

Project: ETNARA Care
Repository: ETNARAMVP
Branch: feature/family-real-history

## Last Known Frontend Checkpoint

Backend connectivity is working.

Known product issue:
- Administration Workers still contains mock availability data.
- The active Agency resident profile is backed by real organization data.
- Caregiver / Family / Administration synchronization still requires frontend validation.
- Messaging backend fixes may exist or be pending deployment depending on backend state.
- Family-safe endpoints for observations/incidents/shifts exist and must be used rather than raw endpoints.

## Mandatory Next Step

Before implementing frontend changes:

1. Inspect git status
2. Inspect git diff
3. Locate AgencyResidentProfilePage.tsx
4. Identify mock/demo/local state dependencies
5. Confirm available backend endpoints before changing UI
6. Do not redesign the page

## Current Product Priority

1. Administration real data
2. Messaging across Worker / Family / Admin
3. Timeline / care events
4. Shifts / check-in / check-out
5. Notifications
6. Family-safe observations / incidents
7. Remove remaining mocks from real product flows

## Deployment

Frontend deploys through GitHub Pages.

Verify GitHub Actions deployment before assuming new code is live.

## Session Handoff

### 2026-09-09 — Family History real-data migration

- Removed the fixed Carmen demo identity and all `DemoStore` reads from Family
  History.
- The screen now resolves the authenticated Family recipient, loads completed
  family-safe shifts and uses the curated timeline for each shift detail.
- Existing V23 list/detail layout is preserved with loading, empty and visible
  API error states.
- No backend change is required. Exact next step: validate, commit and create a
  draft frontend PR; do not merge without explicit authorization.

### 2026-09-09 — Incident details and real resident profile

- Family and Agency incident notifications now open role-appropriate detail
  routes instead of only changing read state.
- Family detail uses only the curated `family-incidents` contract and never
  receives internal actions, assignment or resolution fields.
- Agency incident cards open the full operational detail, including reporter,
  immediate actions, status, resolution when present and follow-up timeline.
- Agency incident detail links directly to the associated resident.
- Agency resident rows open a real profile with demographics, care information,
  shift/caregiver, open incidents and recent care events.
- No backend change was required; existing protected contracts cover the scope.
- Production remains unchanged. Exact next step: finish validation, commit and
  create a draft frontend PR without merging.

### 2026-09-08 — Real incidents and notifications correction

- Branch: `fix/v23-real-incidents-notifications` from deployed frontend commit
  `38be84a807e72ec8bbf2fbf730c7c85d4eff62de`.
- Administration Incidents now lists organization-scoped backend incidents and
  resolves recipient names from the real recipient endpoint.
- Notification bells in Family, Caregiver and Agency now load the authenticated
  user's `/me/notifications` inbox, refresh when opened/focused and poll every
  30 seconds.
- Family Notifications now renders real items and supports one/all read actions.
- Removed the fake fixed Admin incident badge and the caregiver success message
  that claimed delivery before another portal had loaded it.
- Backend required no code change: incident creation and recipient notification
  insertion already occur in the same transaction.
- Validation passed: typecheck, 5/5 boundary tests, lint (warnings only),
  production build; backend regression 15/15 passed.
- Production remains unchanged. Exact next step: review diff, commit and create
  a frontend PR; do not merge without explicit authorization.

### 2026-09-08 — Validation findings: shifts, incidents and credentials

- Family Today now uses the curated family shift and timeline contracts; the
  assigned caregiver and check-in/out state no longer come from DemoStore.
- Caregiver shift detail includes a real incident form backed by the existing
  incident endpoint.
- Caregiver Profile loads the authenticated worker's credential summaries and
  highlights pending, expiring and expired items.
- Family Profile and Today show only the assigned caregiver's verified,
  family-safe credential summaries; no documents or internal review fields.
- Requires the coordinated backend branch `feature/shift-incidents-credentials`.
- Frontend typecheck, lint, 4/4 boundary tests and production build pass.
- Production remains unchanged. Exact next step: commit, then
  request authorization to publish coordinated backend/frontend PRs.

### 2026-09-08 — Phase 4.5 first consolidation cut

- Restore point created at `restore/phase4-stable-2026-09-08` from main commit
  `73bc3697391b6cba94cc718995d4cd7ca32417e3`.
- Extracted the exact deployed V23 artifact into tracked source at
  `frontend-v23/`; visual source is unchanged.
- CI and Pages deployment now validate/build that same directory.
- Removed `continue-on-error`; typecheck, lint, boundary tests, and build are
  blocking in both PR validation and deployment.
- Added `docs/FRONTEND_DATA_AUDIT.md` with real/simulated/mixed classification.
- Backend `main` was inspected at `46002664806854defe2576e3633de317fcddfcbb`;
  no backend changes were made.
- Frontend validation passed: typecheck, lint (warnings only), 3/3 boundary
  tests, and production build.
- Backend read-only regression passed: TypeScript build and 11/11 tests.

### Exact next task after this cut

- Review this PR, then migrate Family Today and Family History from DemoStore
  to the family-safe recipient timeline/shift contracts without changing V23.

### 2026-09-07 — Emergency visual restoration

- GitHub Pages had switched from the prior V23 experience to the incomplete
  `frontend/` interface when PR #6 changed the deployment artifact.
- The deployment workflow is being restored to build `frontend-v23.zip`.
- The deployed V23 build now targets the active Railway backend (`d460`).
- The real-data `frontend/` implementation remains in the repository and is
  not deleted or reverted.
- Important: V23 still contains DemoStore-backed feature screens. Restore is
  for visual continuity only; those screens must not be represented as
  backend-persisted data.

### Exact next task after restoration

- Port the verified real API flows from `frontend/` into the V23 visual shell,
  beginning with messaging and the Family care summary, without mock fallback.

### 2026-09-07 — V23 real messaging integration

- Branch: `fix/v23-real-messaging`
- Replaced DemoStore messaging in Caregiver, Family, and Agency with the real
  Railway messaging endpoints.
- Preserved the V23 layouts, routes, navigation, and visual components.
- Messages are loaded from and written to the authenticated user's authorized
  backend conversation; no local/mock fallback remains in messaging.
- Local TypeScript and production build pass.
- Pending: PR review, merge, GitHub Pages deployment, and three-role live test.

### 2026-09-07 — V23 real shifts integration

- Branch: `fix/v23-real-shifts`
- Administration now loads real recipients, workers, shifts, and assignments.
- Administration can create a shift and assign an active worker through the
  existing scheduling and assignment endpoints.
- Caregiver now loads only the authenticated worker's real assignments through
  `GET /organizations/:organizationId/me/shifts`.
- Caregiver shift detail uses real visit verification for start/check-in and
  finish/check-out; no DemoStore fallback remains in these three shift screens.
- Mock care-event entry was removed from the real shift detail rather than
  pretending those records persist. Care events remain a separate task.
- Local TypeScript production build and lint pass (warnings only).
- Pending: backend demo eligibility seed PR, frontend PR, merges, deployment,
  and live Admin → María start/finish validation.

### Completed
- Frontend AGENTS.md created

### Files Changed
- AGENTS.md
- docs/AGENT_STATE.md

### Tests Run
- Phase 4.5 frontend: typecheck, lint, 3 boundary tests, production build
- Backend contract regression: build and 11 tests

### Failures / Risks
- Real/mock data boundaries still need audit

### Uncommitted Work
- To be determined

### Exact Next Step
- Review the coordinated backend eligibility and frontend V23 shifts PRs, merge
  backend first, verify Railway, then merge frontend and validate Admin → María.
