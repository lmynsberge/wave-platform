---
id: SPEC-003-H03
spec: SPEC-003
workstream: core
status: merged
depends_on: [SPEC-003-H01]
assignee: implementer
---

# SPEC-003-H03: Signal read-model

## Objective
Signal read-model per SPEC-003 contracts.

## Context
SPEC-003 §2–§6; ARCHITECTURE.md boundaries; ENGINEERING.md + A2.

## Task / Implementation record
Aggregated per-attribute counts with FILTERed validation tallies; status hardcoded insufficient_signal (invariant 2); empty user → empty list (invariant 5 shape parity).

## Acceptance criteria
Relevant subset of SPEC-003 AC1–AC6; see core/tests/domain.rs and server/test/feedback.test.ts.

## Test expectations
Core: integration vs real PG (fresh wave_core_test per run). Server: identity vs real PG, core behavior via injected fake conforming to §4.2.

## Follow-ups (implementer notes)
- Core error for pool exhaustion currently 500 internal; consider 503.
- Fake core in server tests must be kept in sync with §4.2 — consider contract tests against the real binary later.
