---
id: SPEC-003-review
subject: SPEC-003
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-003 (Attribute taxonomy & evidence model)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) Invariant-1 enforcement point ambiguity: core lacks reporting data, server lacks evidence authority. Resolved: split enforcement (R5) — server gates manager-origination (it owns the chain), core enforces structural rules and records provenance. Documented, auditable. Acceptable for v1; revisit when core gains an identity read-path.
2. (major, resolved) Objective evidence author-ность: draft allowed human-authored objective evidence; brief says hard metrics self-originate. Now R3: objective requires null author (`objective_requires_system`). Correct.
3. (minor) Storing `no` outcomes while deferring drop-not-negative semantics to SPEC-004 is sound (data ≠ score) but SPEC-004 MUST cite invariant 1 when defining manager-`no` handling. Flagged forward.
4. (minor) R6 empty-vs-low-signal shape parity is a good invariant-5 touch.
5. (nit) A2 debt acceptable; track in ENGINEERING.md.

## Checklist results
- [x] Traceable to brief (Layer 2, Trust Model)
- [x] Trust invariants: 1,2,5 actively enforced; 3,4 N/A justified
- [x] Contracts complete incl. exact error codes
- [x] ACs testable (AC1–AC6)
- [x] Failure modes covered
- [x] Decomposable (4 handoffs)
- [x] Migration story (R7 idempotent)
