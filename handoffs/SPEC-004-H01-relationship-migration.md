---
id: SPEC-004-H01
spec: SPEC-004
workstream: core
status: merged
depends_on: []
assignee: implementer
---

# SPEC-004-H01: Migration 002 + relationship-aware validation writes

## Objective
Migration 002 + relationship-aware validation writes per SPEC-004.

## Task / Implementation record
validator_relationship column (default peer for legacy rows), write path stores it; invalid_relationship 400.

## Acceptance criteria
Relevant subset of AC1–AC6; asserted in core/tests/domain.rs + server/test/feedback.test.ts.

## Follow-ups (implementer notes)
- Thresholds are compile-time consts; env override + per-org policy deferred.
- Read-time aggregation fine at v1 scale; materialize signal state when profiles get hot paths (SPEC-006).
