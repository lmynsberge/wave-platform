---
id: SPEC-022-H01
spec: SPEC-022
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-022-H01: Join-request migration + endpoints

## Objective
All six SPEC-022 §4.1 routes live; `itest/tests/spec-022.itest.ts` green.

## Context
SPEC-022 §4.1 (contract table), §4.3 (migration 009), §5 (races). Follow `server/src/orgs.ts` patterns: `gate()` for admin routes (404 non-member / 403 insufficient_role), `currentUser` for session routes, 23505 → 409 mapping.

## Task
- `server/migrations/009_join_requests.sql` per §4.3
- `server/src/joinRequests.ts` with `registerJoinRequestRoutes(app, pool)`; register in `app.ts`
- Directory query LEFT JOINs caller membership + latest request (pending precedence)

## Acceptance criteria
1. Spec AC1–AC4, AC6 pass in the itest
2. Duplicate-pending returns 409 from the unique index (no read-then-write)
3. Approve maps membership 23505 → 409 already_member AND marks the request approved

## Test expectations
Itest covers the ACs; server unit tests optional (logic is thin SQL).

## Follow-ups (implementer notes)
Directory `requestStatus` uses `ORDER BY status='pending' DESC, created_at DESC LIMIT 1` per org — revisit if requests grow unbounded.
