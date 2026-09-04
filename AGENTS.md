# ETNARA Frontend Agent Rules

## Project
ETNARA Care frontend for:
- Caregiver / Worker
- Family
- Administration / Agency

This repository is ETNARAMVP.

## Primary Goal
Provide a real-data MVP where each portal reflects authorized backend data for the same care recipient.

## Non-Negotiable Rules
- Do not replace real backend data with mocks.
- Do not redesign UI unless explicitly requested.
- Do not weaken authorization assumptions.
- Do not expose raw/internal data to Family.
- Preserve current visual identity unless a design task is approved.
- Prefer small, reversible changes.
- Do not silently change API contracts.

## Required Workflow
For every task:

1. Read:
   - `AGENTS.md`
   - `docs/AGENT_STATE.md`
   - `docs/ETNARA_BACKLOG.md`
   - `docs/PRODUCT_RULES.md`

2. Inspect current frontend code before changing anything.

3. Identify:
   - what already uses the backend
   - what still uses mock/demo/local state
   - which API endpoints are expected
   - which role is affected

4. State the implementation plan before large changes.

5. Implement only approved scope.

6. Validate:
   - TypeScript
   - build
   - available tests
   - role-specific behavior
   - no accidental mock fallback

7. Review git diff before commit.

8. Update:
   - `docs/AGENT_STATE.md`
   - `docs/ETNARA_BACKLOG.md`

9. If the session ends early, save an exact checkpoint.

## Role Expectations

### Family
Family sees only family-safe authorized information for care recipients with an active family relationship.

Never expose:
- raw internal observations
- raw incidents
- internal admin notes
- unrestricted worker data
- organization-wide operational data

Use curated backend endpoints where provided.

### Caregiver / Worker
Workers should see and act only on assigned or authorized care recipients.

Core flows include:
- messaging
- care events
- observations
- incidents
- shifts
- check-in / check-out
- care documentation

### Administration
Administration should consume real organization-scoped backend data.

Priority surfaces:
- dashboard
- residents
- workers
- assignments
- shifts
- care events
- incidents
- observations
- messaging
- notifications

## Mock Data Rules
Mock/demo/local data may remain only when:
- the backend capability truly does not exist yet, and
- the screen is clearly isolated from real production flow.

When a real backend endpoint exists:
- use it
- remove fake data dependency
- do not keep mocks as silent fallback

## Messaging
- conversations must come from the backend
- authorized participants should appear automatically
- Family/Worker/Admin should not need to initialize the same thread independently
- refresh state after sends where needed
- do not create duplicate local threads

## Real-Time / Refresh Behavior
After a mutation:
- update local state from the server response, or
- refetch the authoritative backend resource

Do not assume another portal changed unless backend data confirms it.

## API Rules
- Use the shared API client.
- Respect `VITE_API_URL`.
- Do not hardcode staging URLs inside feature components.
- Keep backend route contracts centralized where practical.
- Handle 401/403/404/500 distinctly when useful.

## Validation Flow
When relevant, test:

1. Maria performs an action for Carmen.
2. Family portal shows the family-safe result.
3. Admin portal shows the authorized operational result.
4. Admin performs an allowed response/update.
5. Other portals reflect the backend state.
6. Reload the page and confirm data persists.
7. Confirm no duplicate UI records appear.

## Commit Rules
- One logical task per commit when possible.
- No unrelated design cleanup during connection fixes.
- Never commit secrets.
- Never knowingly push a broken build.

## Session Handoff
Before ending incomplete work, update `docs/AGENT_STATE.md` with:
- completed work
- files changed
- tests run
- failures
- mock dependencies still remaining
- uncommitted changes
- exact next task
