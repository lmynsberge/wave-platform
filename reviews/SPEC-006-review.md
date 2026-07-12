---
id: SPEC-006-review
subject: SPEC-006
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-006 (Individual profile)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) Early sketch had the web layer hardcoding thresholds for hints — would drift from core policy and misstate "what it takes." R4 mandates fetching /api/signal-policy; hint math from live policy. Good.
2. (minor) R7 policy endpoint auth-only (no org gate) is correct: policy is platform-wide and transparency is the point; still not anonymous-public.
3. (minor) UI-level invariant tests (AC2/AC4) are the right guard: server nulls the score, but a UI that invents progress-as-score would still violate invariant 2 in effect.
4. (nit) "building signal" language matches invariant-5 framing; keep copy away from deficit terms ("missing", "lacking").

## Checklist results
- [x] Traceable to brief (Layer 3)
- [x] Invariants 2 & 5 enforced at presentation layer with tests; others N/A
- [x] Contracts complete (one additive endpoint)
- [x] ACs testable (AC1–AC6)
- [x] Edge cases (core down, no orgs, expiry)
- [x] Decomposable (4 handoffs)
- [x] No schema changes
