---
id: SPEC-004-H04-code-review
subject: SPEC-004-H04
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-004-H04 (Cross-suite AC tests)

## Verdict
`approved`

## Findings
- Core: AC1 transitions, AC2 diversity gate (6 evidence/2 authors stays insufficient), AC3 drop-not-negative (mgr-no → 100, +peer-no → 75), AC4 objective mean, AC5 policy. Server: AC6 relationship capture (direct mgr, transitive ceo, non-chain peer).
- Invariant math verified: manager 'no' visible in raw counts (transparency) but excluded from score denominator; score null below established everywhere.
- ISS-004 handled per workflow: blocked → issue → amendment A1 → delta re-review → resumed.

## Checklist results
- [x] ACs met (core 4/4 tests incl. significance suite; server 10/10)
- [x] Contract conformance (incl. A1 endpoint)
- [x] Tests meaningful vs real Postgres (core) / captured-forwarding (server)
- [x] Trust invariants 1,2,5 mechanically asserted
- [x] No scope creep
- [x] Style per ENGINEERING.md
