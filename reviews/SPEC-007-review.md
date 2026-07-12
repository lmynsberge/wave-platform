---
id: SPEC-007-review
subject: SPEC-007
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-007 (Segmented chat companion)

## Verdict
`approved`

## Findings
1. (verified) RED CHECK (SPEC-QA-001 R4): itest/tests/spec-007.itest.ts compiles and runs 7/7 red against current main. First spec through the TDD gate.
2. (major, resolved in draft) Share visibility for admins: an org admin outside the chain getting 200-empty would leak "this user exists in the share system"; spec chose 404 (AC3) and the never-used-vs-heavy-private byte-parity (AC5) closes the remaining inference channel. Strongest invariant-4 test we have.
3. (minor) Foreign-messageId as 400 unknown_message (not 404) is deliberate: "not yours" and "not real" must be indistinguishable (§5). Good.
4. (minor) Deterministic guided provider makes the interview loop fully testable without an LLM; provider interface keeps the contract stable for LLM swap. Synthesis-quotes-user assertion (AC2) will hold for LLM providers only if the provider contract requires quoting — noted for the future LLM spec.
5. (nit) Shares-as-evidence explicitly out of scope; when it arrives it must route through SPEC-003 evidence rules, not around them.

## Checklist results
- [x] Traceable to brief (Layer 3, Trust Model) + journaling prototype
- [x] Invariants 3 & 4 actively enforced with black-box byte-parity
- [x] Contracts complete
- [x] ACs testable — and ALREADY EXECUTABLE (red)
- [x] Integration test present, AC-complete, red (new checklist item)
- [x] Edge cases (copy semantics, seq assignment, foreign ids)
- [x] Decomposable (4 handoffs)
