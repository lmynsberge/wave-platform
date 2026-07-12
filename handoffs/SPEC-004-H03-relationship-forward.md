---
id: SPEC-004-H03
spec: SPEC-004
workstream: server
status: merged
depends_on: [SPEC-004-H01]
assignee: implementer
---

# SPEC-004-H03: Server relationship computation + forward

## Objective
Server relationship computation + forward per SPEC-004.

## Task / Implementation record
Server fetches evidence subject via GET /v1/evidence/:id (A1/ISS-004), computes isManagerOf, forwards peer|manager_chain. Never client-supplied.

## Acceptance criteria
Relevant subset of AC1–AC6; asserted in core/tests/domain.rs + server/test/feedback.test.ts.

## Follow-ups (implementer notes)
- Thresholds are compile-time consts; env override + per-org policy deferred.
- Read-time aggregation fine at v1 scale; materialize signal state when profiles get hot paths (SPEC-006).
