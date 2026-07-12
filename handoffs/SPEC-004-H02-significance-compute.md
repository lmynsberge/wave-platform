---
id: SPEC-004-H02
spec: SPEC-004
workstream: core
status: merged
depends_on: [SPEC-004-H01]
assignee: implementer
---

# SPEC-004-H02: Significance computation + policy endpoint

## Objective
Significance computation + policy endpoint per SPEC-004.

## Task / Implementation record
compute_status_score implements R2/R3/R4 + §5 guard; SQL gains DISTINCT authors/validators + FILTERed counted_no excluding manager_chain no; GET /v1/signal-policy.

## Acceptance criteria
Relevant subset of AC1–AC6; asserted in core/tests/domain.rs + server/test/feedback.test.ts.

## Follow-ups (implementer notes)
- Thresholds are compile-time consts; env override + per-org policy deferred.
- Read-time aggregation fine at v1 scale; materialize signal state when profiles get hot paths (SPEC-006).
