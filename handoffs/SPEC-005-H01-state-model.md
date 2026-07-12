---
id: SPEC-005-H01
spec: SPEC-005
workstream: core
status: merged
depends_on: []
assignee: implementer
---

# SPEC-005-H01: Migration 003 + state-aware evidence

## Objective
Migration 003 + state-aware evidence per SPEC-005.

## Task / Implementation record
state column (active/pending_upward/dropped), create accepts state (server-only pending_upward), summary filters state='active' (invariants 2/5).

## Follow-ups (implementer notes)
- Upward-queue does per-item manager lookups for root-author check; batch when orgs grow.
- Inbox read-state + anonymity preferences deferred per spec §7.
