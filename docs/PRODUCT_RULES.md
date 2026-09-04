# ETNARA Frontend Product Rules

## Core Model

ETNARA connects:

- Care Recipients / Residents
- Caregivers / Workers
- Family Members
- Agency / Organization Administrators

All frontend data must reflect authorized backend data for the same organization and care recipient.

## Family

Family may see only family-safe information tied to an active family relationship.

Allowed examples:
- care timeline
- permitted care events
- family-safe shift status
- approved observations
- approved incident information
- authorized messages
- relevant notifications

Family must never display:
- raw internal observations
- raw incidents
- internal admin notes
- unrestricted worker data
- organization-wide operational data

Use curated Family endpoints when available.

## Caregiver / Worker

Workers should see only assigned or authorized care recipients.

Core flows:
- messaging
- care events
- observations
- incidents
- shifts
- check-in / check-out
- care documentation

## Administration

Administration should use real organization-scoped backend data.

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

## Messaging

Threads and messages must come from the backend.

Authorized users should see conversations without needing to initialize the same thread independently.

Do not create fake local conversations when a real backend thread exists.

## Timeline / Care Events

Example expected flow:

Maria creates a care event for Carmen
→ backend stores it
→ Family sees the family-safe version
→ Administration sees the authorized operational version

## Shifts

Caregiver:
- performs check-in / check-out

Administration:
- sees operational shift data

Family:
- sees only the family-safe summary or status

## Observations / Incidents

Caregiver may create authorized records.

Administration may access authorized operational information.

Family must use curated Family-safe responses only.

## Notifications

Frontend notifications should reflect real backend notification data.

Relevant sources may include:
- messages
- care events
- incidents
- meaningful shift/status changes

## Mock Data

Never use mock/demo/local data as a silent replacement for a real backend request.

If a backend capability exists:
- call it
- handle loading
- handle errors
- render the server result

Mock data may remain only for isolated unfinished features that are clearly not part of a real production flow.

## Refresh / Synchronization

After mutations:
- use returned server data, or
- refetch the authoritative resource

Reloading the page must not make successful actions disappear.

## Security

A frontend route or hidden button is not authorization.

Backend permissions remain authoritative.

Never expose data merely because it exists in client state.

## Visual Rule

Do not redesign ETNARA while doing connectivity/data fixes.

Preserve:
- current navigation
- current layout
- current branding
- current component hierarchy where practical

Design changes require a separate approved task.
