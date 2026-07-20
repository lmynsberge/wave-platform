---
id: SPEC-022-H01-code-review
subject: SPEC-022-H01
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-022-H01

## Verdict
`approved`

## Findings
1. minor — Duplicate-pending is enforced by the partial unique index and surfaced as 409 from the 23505 catch: no read-then-write race (handoff AC2). Verified in migration 009 + `joinRequests.ts` POST handler.
2. minor — Approve marks the request `approved` BEFORE inserting the membership; on the 23505 (already-member race) the request stays approved per spec §5/R5 — intent satisfied. Correct, though worth noting the two statements are not one transaction; the only intermediate state (approved request, no membership) is spec-conformant.
3. nit — `22P02` (bad uuid) mapped to 404 alongside `23503`: matches SPEC-002's no-existence-leak posture.

## Checklist results
- [x] Conforms to handoff + spec contracts (all six routes, shapes per §4.1)
- [x] Authz on every route: session-gated user routes; `adminGate` reuses 404/403 semantics
- [x] Input validation: no request body accepted anywhere (empty-object POSTs); params via SQL binds only
- [x] Tests: locked itest spec-022 green (5/5); full itest suite 63/63 — no regressions
- [x] No scope creep; no diffs under itest/tests/ beyond the spec's own red-committed file
- [x] Lint clean (tsc --noEmit)
