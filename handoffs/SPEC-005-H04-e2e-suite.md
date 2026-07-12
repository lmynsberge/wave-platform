---
id: SPEC-005-H04
spec: SPEC-005
workstream: server
status: merged
depends_on: [SPEC-005-H01]
assignee: implementer
---

# SPEC-005-H04: True end-to-end suite

## Objective
True end-to-end suite per SPEC-005.

## Task / Implementation record
Real wave-core binary spawned against dedicated DB + real server PG. Full story: AC1–AC6 incl. byte-identical-summary assertion for dropped assessments and 409 double-decide.

## Follow-ups (implementer notes)
- Upward-queue does per-item manager lookups for root-author check; batch when orgs grow.
- Inbox read-state + anonymity preferences deferred per spec §7.
