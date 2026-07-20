---
id: SPEC-023-H02
spec: SPEC-023
workstream: server
status: merged
depends_on: [SPEC-023-H01]
assignee: implementer
---

# SPEC-023-H02: Migration 010 + merge-accounts CLI

## Objective
`scripts/merge-accounts.mjs` performs the full merge per SPEC-023 R1/R4-R7; locked itest green.

## Context
SPEC-023 §2, §5. Server-owned tables and their collision policies are enumerated in R4. `pg` resolved from `server/node_modules` via createRequire (scripts/ has no deps of its own — same pattern as the seed script's zero-dep style, but the merge needs a transaction, hence pg over HTTP).

## Task
- `server/migrations/010_account_merge.sql` (users.merged_into)
- Script: arg parsing (email|uuid, citext-tolerant), R6 guards, --dry-run counts, core call first (R7), single server tx with R4 policies, tombstone last, summary output; errors to stderr, non-zero exit

## Acceptance criteria
1. Spec AC1-AC5 green in the itest
2. R6 refusals carry stderr text matching the locked assertions (not found / already merged / itself)

## Test expectations
Locked itest drives everything through public APIs + the CLI.

## Follow-ups (implementer notes)
org_join_requests handled conditionally via to_regclass (SPEC-022 merge-order independence).
