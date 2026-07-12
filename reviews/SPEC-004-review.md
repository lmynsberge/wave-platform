---
id: SPEC-004-review
subject: SPEC-004
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-004 (Significance engine)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) Established-with-no-countable-validations division hazard: resolved in §5 — established additionally requires (yes+counted_no) ≥ 1, else remains emerging. Score never NaN, invariant 2 preserved.
2. (major, resolved) Manager `no` semantics: R5 correctly drops manager-chain `no` from the denominator rather than inverting or penalizing — satisfies SPEC-003 review finding 3 and invariant 1 mechanically. Manager `yes` counting normally is consistent with "managers validate."
3. (minor) distinctValidators counting managers whose `no` was dropped: acceptable (participation ≠ score influence) and documented in §5. Watch for gaming (manager spam-no to push established without score effect) — harmless: no score impact, and drop is symmetric.
4. (minor) Read-time computation is fine at v1 scale; materialization is correctly out of scope.
5. (nit) Policy endpoint aids invariant transparency; good.

## Re-review (cycle 2, delta only — ISS-004/A1)
GET /v1/evidence/:id: read-only, exposes only fields the server already handles, no invariant impact. `approved`.

## Checklist results
- [x] Traceable to brief (significance-as-gatekeeper; drop-not-negative)
- [x] Trust invariants 1,2,5 mechanically enforced; 3,4 N/A
- [x] Contracts complete (additive, backward-compatible)
- [x] ACs testable (AC1–AC6) incl. the subtle drop-not-negative math (AC3)
- [x] Edge cases (division guard, all-dropped) addressed
- [x] Decomposable (4 handoffs)
- [x] Migration 002 with safe default for existing rows
