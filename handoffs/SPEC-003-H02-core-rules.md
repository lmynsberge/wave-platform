---
id: SPEC-003-H02
spec: SPEC-003
workstream: core
status: merged
depends_on: [SPEC-003-H01]
assignee: implementer
---

# SPEC-003-H02: Evidence + validation endpoints with structural rules

## Objective
Evidence + validation endpoints with structural rules per SPEC-003 contracts.

## Context
SPEC-003 §2–§6; ARCHITECTURE.md boundaries; ENGINEERING.md + A2.

## Task / Implementation record
R3/R4 enforced with exact error codes (subjective_requires_author, self_evidence, kind_mismatch, objective_requires_system, objective_requires_value, unknown_attribute, own_evidence, own_subject, invalid_outcome, duplicate_validation 409, 404 unknown evidence). All asserted in tests/domain.rs.

## Acceptance criteria
Relevant subset of SPEC-003 AC1–AC6; see core/tests/domain.rs and server/test/feedback.test.ts.

## Test expectations
Core: integration vs real PG (fresh wave_core_test per run). Server: identity vs real PG, core behavior via injected fake conforming to §4.2.

## Follow-ups (implementer notes)
- Core error for pool exhaustion currently 500 internal; consider 503.
- Fake core in server tests must be kept in sync with §4.2 — consider contract tests against the real binary later.
