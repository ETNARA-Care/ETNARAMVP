# ETNARA Frontend Agent State

## Current Status

Project: ETNARA Care
Repository: ETNARAMVP
Branch: main

## Last Known Frontend Checkpoint

Backend connectivity is working.

Known product issue:
- Administration still contains mock/fake data in at least some resident surfaces.
- AgencyResidentProfilePage.tsx needs conversion to real backend data.
- Caregiver / Family / Administration synchronization still requires frontend validation.
- Messaging backend fixes may exist or be pending deployment depending on backend state.
- Family-safe endpoints for observations/incidents/shifts may exist in backend and must be used rather than raw endpoints.

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

### Completed
- Frontend AGENTS.md created

### Files Changed
- AGENTS.md
- docs/AGENT_STATE.md

### Tests Run
- None yet

### Failures / Risks
- Real/mock data boundaries still need audit

### Uncommitted Work
- To be determined

### Exact Next Step
- Audit AgencyResidentProfilePage and related API connections
