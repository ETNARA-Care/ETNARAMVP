# ETNARA Frontend Backlog

## In Progress

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

### FETN-003 — Messaging across Worker / Family / Admin
- use backend conversations
- verify participants
- refetch/update after sends
- no duplicate local threads

### FETN-004 — Timeline / Care Events
- verify caregiver writes
- verify family-safe read
- verify admin read
- persistent after refresh

### FETN-005 — Shifts / Check-in / Check-out
- worker action
- admin operational visibility
- family-safe visibility

### FETN-006 — Notifications
- messages
- care events
- incidents
- correct role recipients

### FETN-007 — Family-safe observations / incidents
- use curated endpoints only
- never raw endpoints
- verify 403 behavior for blocked access

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
