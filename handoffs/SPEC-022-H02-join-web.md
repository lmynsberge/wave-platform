---
id: SPEC-022-H02
spec: SPEC-022
workstream: web
status: merged
depends_on: [SPEC-022-H01]
assignee: implementer
---

# SPEC-022-H02: Zero-org join panel + Settings admin section

## Objective
The zero-org dead end becomes an actionable "Find your organization" flow; admins decide requests in Settings (SPEC-022 R8, AC5).

## Context
Zero-org branch: `web/src/App.tsx` (currently a static "Ask an admin" div). Admin surface: `web/src/SettingsView.tsx` (pattern: invite section, role-gated by `isAdmin`). Contracts in SPEC-022 §4.1.

## Task
- `web/src/JoinOrgs.tsx`: directory list (name/slug), Request access button per org, pending/declined chips, approval-required copy; TanStack Query + invalidation
- Render it in `App.tsx` when `memberships.length === 0` (main pane, not the rail)
- `SettingsView.tsx`: admin "Join requests" section — pending list (name/email), Approve/Decline
- `web/test/join.test.tsx` component suite (AC5)

## Acceptance criteria
1. AC5: panel renders directory, fires POST join-request, renders pending state
2. AC5: Settings section renders pending requests, fires approve/decline
3. Lint + web suite green

## Test expectations
`web/test/join.test.tsx` with mocked fetch per `web/test/settings.test.tsx` conventions.

## Follow-ups (implementer notes)
Rail keeps a one-line hint pointing at the panel. Declined orgs offer "Request again" (R6).
