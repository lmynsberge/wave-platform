---
id: SPEC-004-H02-code-review
subject: SPEC-004-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-004-H02 (Significance computation + policy endpoint)

## Verdict
`approved`

## Findings
- compute_status_score implements R2/R3/R4 + §5 guard; SQL gains DISTINCT authors/validators + FILTERed counted_no excluding manager_chain no; GET /v1/signal-policy.
- Invariant math verified: manager 'no' visible in raw counts (transparency) but excluded from score denominator; score null below established everywhere.
- ISS-004 handled per workflow: blocked → issue → amendment A1 → delta re-review → resumed.

## Checklist results
- [x] ACs met (core 4/4 tests incl. significance suite; server 10/10)
- [x] Contract conformance (incl. A1 endpoint)
- [x] Tests meaningful vs real Postgres (core) / captured-forwarding (server)
- [x] Trust invariants 1,2,5 mechanically asserted
- [x] No scope creep
- [x] Style per ENGINEERING.md
