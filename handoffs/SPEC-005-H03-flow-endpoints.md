---
id: SPEC-005-H03
spec: SPEC-005
workstream: server
status: merged
depends_on: [SPEC-005-H01]
assignee: implementer
---

# SPEC-005-H03: Queues, inbox, assessments, decisions

## Objective
Queues, inbox, assessments, decisions per SPEC-005.

## Task / Implementation record
validation-queue via recursive reports CTE + unvalidatedBy; inbox strips author identity (authorKnown bool only); assessments gated by isManagerOf → pending_upward; upward-queue eligibility (author-in-my-reports OR root-author+admin); decision endpoint re-verifies eligibility server-side, author excluded.

## Follow-ups (implementer notes)
- Upward-queue does per-item manager lookups for root-author check; batch when orgs grow.
- Inbox read-state + anonymity preferences deferred per spec §7.
