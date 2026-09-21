# ETNARA Frontend Backlog

## In Progress

### FPH7-006 — Phase 7.5 staged coverage escalation

- show current wave, queued candidates and automatic progression time
- refresh real campaign status while Administration remains on the shift list
- show caregiver response deadlines without resident or clinical information
- stop escalation visibly on interest and preserve final human assignment
- explain exhausted coverage and allow an explicit retry

Status: Complete — published and merged in frontend PR #40 after backend PR
#37; CI and GitHub Pages deployment passed.

---

### FPH7-004 — Phase 7.3 worker-declared availability

- let the authenticated caregiver configure weekly work windows
- add future vacation, appointment and other unavailable periods
- persist through the real organization-scoped backend API
- show declared-availability explanations in assisted coverage
- retain explicit Administration confirmation for every assignment

Status: Published and merged in frontend PR #36 after backend PR #31 was live.
Pull-request CI, post-merge CI and Pages deployment passed; the public portal
returned HTTP 200 with the new interface in its live bundle.

---

### FPH7-003 — Phase 7.2 assisted coverage intelligence

- request real coverage recommendations from the create/assign shift workflow
- explain eligibility, schedule conflicts, continuity and upcoming workload
- rank selectable candidates and disable blocked options
- preserve explicit Administration confirmation for every assignment

Status: Published and merged in frontend PR #35 after backend PR #30 was live.
Pull-request CI, post-merge CI and Pages deployment passed; the public portal
returned HTTP 200.

---

### FPH7-002 — Actionable Administration Overview

- add direct creation and navigation actions to the operational dashboard
- make summary metrics, today's shifts and recent activity interactive
- reuse the real create-and-assign shift workflow from the dashboard
- preserve the current mobile layout and real organization-scoped data

Status: Published and merged in frontend PR #34. Pull-request CI, post-merge
CI and the GitHub Pages deployment passed; the public portal returned HTTP 200.

---

### FPH7-001 — Phase 7.1 individual care plans

- let Administration create and update a resident's structured care plan
- show the active version, support level, goals, instructions, precautions and
  tasks in the real resident profile
- show the same authorized plan to an assigned caregiver inside the shift
- preserve real backend errors and avoid mock fallback
- do not expose an operational care-plan route to Family

Status: Published and merged in frontend PR #33 after backend PR #29;
post-merge CI and deployment checks passed.

---

### FPH6-001 — Phase 6 end-to-end operational synchronization

- keep Family Today limited to today's real shift
- resolve accepted/pending coverage without using rejected history
- refresh Admin and Family operational state on focus and every 30 seconds
- route shift-started/completed notifications to role-safe destinations

Status: Implemented locally; typecheck, 24/24 tests and production build pass.
Lint retains only existing warnings. Coordinated publication requires explicit
authorization.

---

### FPH5-009 — Phase 5.10 work eligibility enforcement

- distinguish active membership from apt-to-work eligibility
- show exact unmet mandatory requirements in worker and Compliance views
- disable ineligible workers before shift assignment
- preserve backend enforcement as the authoritative gate

Status: Implemented locally; typecheck, 23/23 tests, build and lint pass with
pre-existing warnings only. Publication requires explicit authorization.

---

### FPH5-008 — Safari-safe private credential upload

- send the document through the authenticated ETNARA backend
- avoid direct browser PUTs blocked by Railway bucket CORS
- preserve the existing credential form, history and review interface

Status: Implemented locally; typecheck, 22/22 tests and build pass. Publication authorized.

---

### FPH5-004 — Phase 5.5 real Administration compliance

- replace the empty Compliance placeholder with organization-scoped data
- evaluate each worker through the backend eligibility contract
- summarize fully compliant workers and workers requiring attention
- expand compact worker rows to show unmet requirements and credential alerts
- preserve direct navigation to the full caregiver profile

Status: Implemented locally; final validation and publication pending.

### FPH5-003 — Phase 5.4 actionable Admin workflows

- route notifications to authorized detail screens
- show assignment response identity, time, and reason
- allow safe future-shift cancellation with confirmation
- compact caregiver cards and add real-data caregiver detail
- correct Agency mobile navigation contrast, width, safe area, and labels

Status: Completed, published and validated in production.

---

### FDEPLOY-002 — Align Pages with active Railway backend

- replace obsolete `d460` endpoint with active `2a3a` endpoint
- keep CI and Pages deployment configuration identical
- add a regression test for endpoint drift

Status: Implemented and validated; typecheck, lint, 13/13 tests and production
build pass.

---

### FPH5-002 — Caregiver assignment response

- show pending response in Caregiver and Administration
- accept/reject through the authenticated worker endpoint
- block shift start until acceptance
- preserve Family-safe confirmation behavior

Status: Implemented and validated locally on `phase-5/assignment-responses`;
PR publication in progress.

---

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

### FPH7-008 — Caregiver self-identity correction
- remove fixed María identity from caregiver header and profile
- consume the authenticated tenant-scoped worker profile
- display real initials, name and organization-specific role
- local build, 43/43 tests and lint pass

Status: Complete — published and merged in PR #44 after backend PR #42; CI and
GitHub Pages deployment passed.

### FPH7-007 — Phase 7.6.1 platform credential verification
- exclusive server-authorized platform route
- real current-document review queue with private file access
- auditable verify/reject workflow and automatic eligibility messaging
- rejected-state visibility in Agency compliance and assignment blocking
- local build, 42/42 tests and lint pass

Status: Complete — published and merged in PR #42 after backend PR #40;
frontend CI and GitHub Pages deployment passed.

### FPH7-005 — Phase 7.4 collaborative open-shift offers
- Administration sends a privacy-safe first wave to three ranked caregivers
- caregivers explicitly answer available or unavailable
- Administration sees interested names and retains final assignment
- notifications navigate to the appropriate role workflow
- local typecheck, 36/36 tests, build and lint pass

Status: Complete — published and merged in PR #38 after backend PR #34; CI and
GitHub Pages deployment passed.

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
