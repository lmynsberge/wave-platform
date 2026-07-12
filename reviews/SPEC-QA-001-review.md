---
id: SPEC-QA-001-review
subject: SPEC-QA-001
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-QA-001 (Spec-locked integration harness)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) Lock rule needed an enforcement point, not just a norm: R3 makes it a reviewer rejection criterion and ties diffs to spec/amendment IDs. Good — auditable via commit messages under WORKFLOW rule 10.
2. (minor) Black-box-only (R1) is the right boundary: tests survive refactors, die only on contract changes — exactly the lock semantics wanted.
3. (minor) Red-first requirement (R4) is calibrated to start at SPEC-007; retrofitting red-ness onto implemented specs is impossible and correctly not claimed. Backfill validity comes from deriving strictly from AC text (AC2's verbatim-ID rule).
4. (nit) Delegated web ACs must name the exact component test (AC5) — prevents silent coverage gaps.

## Checklist results
- [x] Traceable (Orchestrator direction, this conversation)
- [x] Invariants strengthened transitively
- [x] Contracts complete (env, ports, helpers)
- [x] ACs testable
- [x] Failure modes (missing binary, ports, pg)
- [x] Decomposable (4 handoffs)
