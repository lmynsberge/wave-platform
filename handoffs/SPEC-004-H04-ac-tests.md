---
id: SPEC-004-H04
spec: SPEC-004
workstream: core, server
status: merged
depends_on: [SPEC-004-H01]
assignee: implementer
---

# SPEC-004-H04: Cross-suite AC tests

## Objective
Cross-suite AC tests per SPEC-004.

## Task / Implementation record
Core: AC1 transitions, AC2 diversity gate (6 evidence/2 authors stays insufficient), AC3 drop-not-negative (mgr-no → 100, +peer-no → 75), AC4 objective mean, AC5 policy. Server: AC6 relationship capture (direct mgr, transitive ceo, non-chain peer).

## Acceptance criteria
Relevant subset of AC1–AC6; asserted in core/tests/domain.rs + server/test/feedback.test.ts.

## Follow-ups (implementer notes)
- Thresholds are compile-time consts; env override + per-org policy deferred.
- Read-time aggregation fine at v1 scale; materialize signal state when profiles get hot paths (SPEC-006).
