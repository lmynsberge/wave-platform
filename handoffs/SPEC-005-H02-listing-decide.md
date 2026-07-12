---
id: SPEC-005-H02
spec: SPEC-005
workstream: core
status: merged
depends_on: [SPEC-005-H01]
assignee: implementer
---

# SPEC-005-H02: Evidence listing + decide

## Objective
Evidence listing + decide per SPEC-005.

## Task / Implementation record
GET /v1/evidence composable filters (subjects, state, unvalidatedBy, cursor pagination); POST decide: pending→active(yes)/dropped(no,no_signal), 409 non-pending, audit row recorded as manager_chain validation.

## Follow-ups (implementer notes)
- Upward-queue does per-item manager lookups for root-author check; batch when orgs grow.
- Inbox read-state + anonymity preferences deferred per spec §7.
