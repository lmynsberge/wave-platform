---
id: SPEC-024-H02
spec: SPEC-024
workstream: web
status: merged
depends_on: [SPEC-024-H01]
assignee: implementer
---

# SPEC-024-H02: Explore button + demo banner

## Objective
Zero-org users can enter demo mode from the join panel; demo state is unmistakable and exitable (SPEC-024 R7, AC6).

## Context
`web/src/JoinOrgs.tsx` (SPEC-022-H02) hosts the explore button; `web/src/App.tsx` shell hosts the banner; `web/src/api.ts` Me type gains `demo?`.

## Task
- JoinOrgs: query `/api/demo`; when available render "Explore demo mode" → POST enter → invalidate `me`
- App: when `me.demo`, render a persistent banner (read-only + seeded-data copy) with Exit → POST exit → invalidate `me`
- `web/test/demo.test.tsx` (AC6)

## Acceptance criteria
1. AC6 both halves green; lint + suite green

## Test expectations
Mocked-fetch component tests per repo convention.

## Follow-ups (implementer notes)
Banner renders inside the shell (demo persona has orgs, so the shell always shows).
