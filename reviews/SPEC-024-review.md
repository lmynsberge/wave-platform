---
id: SPEC-024-review
subject: SPEC-024
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-024 (Demo mode)

## Verdict
`approved`

## Findings
1. blocking→resolved in draft — Invariant 3 tension: demo exposes the persona's private companion thread. Resolved by making the synthetic-persona constraint EXPLICIT in §3 (config must never name a real account; ops rule to be recorded in DEPLOY notes at H03) and by R4 removing all write capability. With those, the exposure is of authored demo content, not anyone's private context.
2. major→resolved — Early draft guarded mutations per-route; moved to a single app-level hook (R4) so a future route cannot forget the guard. Escape-hatch allowlist is enumerated in the spec, not left to implementation.
3. minor — R6 fallback (persona unresolvable → act as real user) chosen over 500/logout; keeps a stale flag harmless. Covered by contract, not separately tested (would need DB surgery — black-box cannot delete a user; acceptable, logic is a two-line fallback reviewed in code).
4. nit — `GET /api/demo` is unauthenticated; leaks only feature availability. Fine.

## Checklist results
- [x] Requirements grounded (Orchestrator directive 2026-07-19; SPEC-016-H03 seeded env)
- [x] Trust invariants (§3): 1 via R4 write-block; 3 via synthetic-persona constraint; 2/4 untouched; 5 N/A
- [x] Contracts complete (§4.1 incl. /api/me amendment; migration §4.3 with numbering note vs SPEC-023)
- [x] ACs black-box testable; AC6 delegated with pointer (SPEC-QA-001 A2); harness env addition is config, not a locked-file change
- [x] Red verified for the right reason: GET /api/demo → 404 (missing route), recorded at review time
- [x] Edge cases §5 include the bearer-route bypass analysis and logout-during-demo
