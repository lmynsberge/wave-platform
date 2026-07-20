---
id: SPEC-024-H03
spec: SPEC-024
workstream: server
status: merged
depends_on: [SPEC-024-H01, SPEC-024-H02]
assignee: implementer
---

# SPEC-024-H03: Green + artifacts + ops note

## Objective
All suites green; DEPLOY gains the synthetic-persona rule; traceability recorded.

## Task
- Full itest + server/web suites
- DEPLOY.md (or infra README) note: `DEMO_PERSONA_EMAIL` must point at a seeded synthetic account, never a real person (SPEC-024 §3)
- docs/TRACEABILITY.md row

## Acceptance criteria
1. Suites green; ops note present; traceability updated

## Follow-ups (implementer notes)
—
