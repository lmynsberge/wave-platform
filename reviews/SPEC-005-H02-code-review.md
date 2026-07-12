---
id: SPEC-005-H02-code-review
subject: SPEC-005-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-005-H02 (Evidence listing + decide)

## Verdict
`approved`

## Findings
- GET /v1/evidence composable filters (subjects, state, unvalidatedBy, cursor pagination); POST decide: pending→active(yes)/dropped(no,no_signal), 409 non-pending, audit row recorded as manager_chain validation.
- Invariant 1 verified end-to-end: lone manager judgment cannot reach a summary; upward-no indistinguishable from never-submitted (byte-compare test).
- Eligibility computed server-side from reporting data; author self-decision blocked even for admins.

## Checklist results
- [x] ACs met (server 13/13 incl. real-core E2E; core 4/4)
- [x] Contract conformance
- [x] Tests meaningful (true integration, not just mocks)
- [x] Trust invariants asserted
- [x] No scope creep
- [x] Style per ENGINEERING.md
