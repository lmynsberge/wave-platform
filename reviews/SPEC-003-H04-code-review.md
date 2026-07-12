---
id: SPEC-003-H04-code-review
subject: SPEC-003-H04
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-003-H04 (Server proxy + manager-origination gate)

## Verdict
`approved`

## Findings
- Three endpoints per §4.1; gateMember reuses SPEC-002 R5 semantics; isManagerOf walks subject's upward chain (bounded 100); invariant 1 gate returns 403 manager_cannot_originate for direct AND transitive managers; upward + peer feedback allowed. Core mocked via injected fetch; identity against real PG.
- Invariant check: 1 (gate at server, provenance in core), 2 (insufficient_signal hardcoded), 5 (zero-shape parity) — verified in tests.
- Parameterized queries throughout; no identity data enters core beyond opaque UUIDs.

## Checklist results
- [x] Acceptance criteria met (core 3/3, server 10/10 suites green)
- [x] Contract conformance exact (error codes asserted)
- [x] Tests meaningful, against real Postgres where owned
- [x] Security + trust invariants (above)
- [x] No scope creep
- [x] Style per ENGINEERING.md
