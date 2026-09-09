# ETNARA Frontend Backlog

## In Progress

### FPH5-001 — Truthful Family status

- remove hard-coded Family identity and wellbeing claim
- show care/wellbeing information only from the family-safe timeline
- preserve the existing Family Today layout

Status: Implemented on `phase-5/family-real-status`; validation and publication
in progress. No backend change required.

---

### FETN-012 — Real Administration Workers

- remove mock availability and `DemoStore`
- load organization-scoped worker memberships and profiles
- show real credential states and expiration warnings
- preserve the V23 card experience

Status: Implemented on `feature/admin-real-workers`; validation and PR
publication in progress. No backend change required.

---

### FETN-011 — Real Family History

- remove fixed demo recipient and `DemoStore` history data
- load authenticated family recipient
- load completed family-safe shifts and curated timeline
- preserve the existing V23 list/detail experience

Status: Implemented on `feature/family-real-history`; validation and draft PR
publication in progress. No backend change required.

---

### FETN-010 — Incident details and resident profile

- notification click-through for Family and Administration
- family-safe incident detail using only the curated endpoint
- operational Admin incident detail and follow-up timeline
- real Admin resident profile linked from residents and incidents

Status: Implemented on `feature/incident-details-resident-profile`; validation
and draft PR publication in progress. No backend change required.

---

### FVAL-001 — Phase 4.5 live validation corrections

- synchronize Family Today with real assigned caregiver and visit status
- expose real caregiver incident reporting
- show self credential status/expiration to caregiver
- show only verified credential summaries to authorized Family

Status: Implemented and validated locally on `fix/phase-4-5-validation`;
coordinated backend/frontend PR publication pending.

---

### FCONSOL-001 — Phase 4.5 single V23 build source

Goal:
Make the V23 source that CI validates identical to the source Pages builds,
without changing the design or production.

Acceptance criteria:
- safe restore branch points to the Phase 4 main commit
- `frontend-v23/` contains the exact V23 source previously held in the ZIP
- CI and deploy both run typecheck, lint, tests, and build there
- failed tests cannot be ignored
- real/simulated/mixed screens and backend contracts are documented
- historical source/ZIP are inactive and retained for this reversible cut

Status: Implemented on `phase-4-5/consolidate-v23-source`; pending PR checks and review.

---

### FDEPLOY-001 — Restore V23 visual deployment
Goal:
Restore the prior mobile V23 interface after PR #6 changed the GitHub Pages
artifact, while retaining the real-data frontend source for the next migration.

Acceptance criteria:
- GitHub Pages builds `frontend-v23.zip`
- V23 points to the active Railway backend
- `frontend/` real-data work remains preserved
- V23 mock-backed screens are documented and not described as real persistence

Status: Completed for emergency restoration; superseded by FCONSOL-001 for the
active build mechanism. The ZIP is no longer used by CI or deployment.

---

### FETN-001 — Audit Administration real data
Goal:
Identify and replace mock/demo/local data in Administration where real backend endpoints already exist.

Acceptance criteria:
- AgencyResidentProfilePage.tsx audited
- mock dependencies identified
- backend endpoint mapping documented
- no UI redesign
- AGENT_STATE updated

---

## Next

### FETN-002 — Rewrite AgencyResidentProfilePage
- use real backend data
- preserve current layout
- remove mock fallback where backend exists
- handle loading/error states

Status: Implemented in the active V23 source as part of FETN-010; pending PR
review and merge.

### FETN-003 — Messaging across Worker / Family / Admin
- use backend conversations
- verify participants
- refetch/update after sends
- no duplicate local threads
- implementation complete on `fix/v23-real-messaging`
- local TypeScript/build pass
- pending PR merge and live three-role validation

### FETN-004 — Timeline / Care Events
- verify caregiver writes
- verify family-safe read
- verify admin read
- persistent after refresh

### FETN-005 — Shifts / Check-in / Check-out
- worker action
- admin operational visibility
- family-safe visibility
- Admin create/assign and Worker start/finish implemented on
  `fix/v23-real-shifts`; pending PRs, deployment, and live validation.
- Family-safe shift visibility remains pending and is not included in this gate.

### FETN-006 — Notifications
- messages
- care events
- incidents
- correct role recipients

Status: V23 bells and Family notification page now consume `/me/notifications`;
incident notifications are visible to the backend-selected Admin/Supervisor and
authorized Family recipients. Pending live three-role validation after deploy.

### FETN-007 — Family-safe observations / incidents
- use curated endpoints only
- never raw endpoints
- verify 403 behavior for blocked access

Admin incident listing now uses the real organization-scoped incident endpoint.
The separate Family-safe incident history surface remains pending.

### FETN-008 — Remove remaining mocks
Audit:
- dashboard
- residents
- workers
- assignments
- shifts
- messaging
- notifications

### FETN-009 — End-to-end role validation
Test:
- maria@demo.etnara.care
- familia@demo.etnara.care
- admin@demo.etnara.care

Validate same care recipient across all roles.

---

## Completed

### FSETUP-001 — Add frontend AGENTS.md
Status: Complete

### FSETUP-002 — Add frontend AGENT_STATE.md
Status: Complete

---

## Rules

- One task at a time.
- No silent scope expansion.
- Update AGENT_STATE after each task.
- Do not mark complete without validation.
- Preserve exact next step if a session ends early.
