---
id: SPEC-023-H01
spec: SPEC-023
workstream: core
status: merged
depends_on: []
assignee: implementer
---

# SPEC-023-H01: Core merge-users endpoint

## Objective
`POST /v1/admin/merge-users` reassigns evidence/validations with the four R3 repairs, transactionally, idempotently, returning counts.

## Context
SPEC-023 §4.2 (contract), R2/R3. Code home: new `core/src/admin.rs`, merged into `app_with_db` (`core/src/lib.rs`). Patterns: `domain.rs` (ApiResult, err/internal helpers, deadpool).

## Task
Transaction order matters: (a) metric-collision deletes → subject reassign → author reassign → (b) self-evidence drop → (c) duplicate-validation deletes → validator reassign → (d) invalid-validation deletes. Reject same_user 400.

## Acceptance criteria
1. Counts returned per §4.2; re-run returns all zeros (idempotent)
2. Repairs verified through the itest (AC2/AC3) once the script lands

## Test expectations
Unit test for same_user 400 + route presence; behavior covered by locked itest.

## Follow-ups (implementer notes)
Deadpool transaction via `client.transaction()`; all statements on the tx object.
