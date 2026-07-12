---
id: SPEC-002-H01
spec: SPEC-002
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-002-H01: Migrations + db layer + idempotent runner

## Objective
Migrations + db layer + idempotent runner implemented per SPEC-002 contracts.

## Context
SPEC-002 §2, §4, §5, §6. Standards: docs/ENGINEERING.md (server, A1 amendment).

## Task / Implementation record
001_identity.sql (5 tables per §4.3, citext, checks), src/db.ts pool factory, src/migrate.ts transactional runner tracking _migrations. Verified: applied once, second run no-ops (AC6).

## Acceptance criteria
Subset of SPEC-002 AC1–AC6 relevant to this handoff; see test/identity.test.ts.

## Test expectations
Integration tests against real Postgres (wave_test recreated per run).

## Follow-ups (implementer notes)
- Session cookie lacks Secure flag (dev http); add behind env flag pre-production.
- Chain walk is per-hop queries; fine at v1 scale, consider recursive CTE later.
