---
id: SPEC-003-H01
spec: SPEC-003
workstream: core
status: merged
depends_on: []
assignee: implementer
---

# SPEC-003-H01: Core schema + migrations + db layer

## Objective
Core schema + migrations + db layer per SPEC-003 contracts.

## Context
SPEC-003 §2–§6; ARCHITECTURE.md boundaries; ENGINEERING.md + A2.

## Task / Implementation record
core schema (attributes/evidence/validations per §4.3), deadpool pool, idempotent transactional runner tracking core._migrations. Idempotence asserted in test setup (double-run).

## Acceptance criteria
Relevant subset of SPEC-003 AC1–AC6; see core/tests/domain.rs and server/test/feedback.test.ts.

## Test expectations
Core: integration vs real PG (fresh wave_core_test per run). Server: identity vs real PG, core behavior via injected fake conforming to §4.2.

## Follow-ups (implementer notes)
- Core error for pool exhaustion currently 500 internal; consider 503.
- Fake core in server tests must be kept in sync with §4.2 — consider contract tests against the real binary later.
