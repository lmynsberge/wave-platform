---
id: SPEC-003-H02-code-review
subject: SPEC-003-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-003-H02 (Evidence + validation endpoints with structural rules)

## Verdict
`approved`

## Findings
- R3/R4 enforced with exact error codes (subjective_requires_author, self_evidence, kind_mismatch, objective_requires_system, objective_requires_value, unknown_attribute, own_evidence, own_subject, invalid_outcome, duplicate_validation 409, 404 unknown evidence). All asserted in tests/domain.rs.
- Invariant check: 1 (gate at server, provenance in core), 2 (insufficient_signal hardcoded), 5 (zero-shape parity) — verified in tests.
- Parameterized queries throughout; no identity data enters core beyond opaque UUIDs.

## Checklist results
- [x] Acceptance criteria met (core 3/3, server 10/10 suites green)
- [x] Contract conformance exact (error codes asserted)
- [x] Tests meaningful, against real Postgres where owned
- [x] Security + trust invariants (above)
- [x] No scope creep
- [x] Style per ENGINEERING.md
