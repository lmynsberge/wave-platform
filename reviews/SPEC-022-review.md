---
id: SPEC-022-review
subject: SPEC-022
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-022 (Org access requests)

## Verdict
`approved`

## Findings
1. minor — Directory-lists-all-orgs is a deliberate exposure of org names/slugs to every authenticated user. Acceptable "at this time" per the Orchestrator directive quoted in §1; §7 records the revisit hook (visibility controls). No action required now.
2. minor — R5's approve-races-invite path (409 + mark approved) is unusual but correct: the request's intent is satisfied by the existing membership; marking it approved keeps the requester's list truthful. Covered implicitly by AC4's decided-request-404 discipline.
3. nit — No rate limiting on request creation; a hostile user can spam N orgs once each (pending-unique blocks repeats). Logged in §7 out-of-scope. Anti-abuse rides with the future visibility work.
4. blocking→resolved in draft — Original draft let approve return the request row only; changed to return the membership so the itest can assert role without a second call. Contract table reflects this.

## Checklist results
- [x] Every requirement grounded (Orchestrator directive 2026-07-19 + PROJECT_BRIEF GTM sequencing)
- [x] Trust invariants checked (§3): 1,2,5 N/A; 3–4 upheld via R7 privacy of requests; SPEC-002 R5 404 semantics reused
- [x] Cross-workstream contracts fully in spec (API table §4.1; no core involvement; data model §4.3)
- [x] ACs testable black-box; AC5 web-render delegated with explicit pointer (SPEC-QA-001 A2)
- [x] Itest design present (§9), file `itest/tests/spec-022.itest.ts` written pre-implementation
- [x] Red verified for the right reason: all six routes 404 `not_found` (fastify unknown route) / 401 only where auth precedes routing — missing-contract failures, not harness defects (recorded at review time)
- [x] Handoffs small enough (3, single-workstream each)
- [x] Edge cases: duplicate-pending race handled structurally (partial unique index), approve/invite race defined
