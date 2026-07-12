---
id: SPEC-005-H01-code-review
subject: SPEC-005-H01
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-005-H01 (Migration 003 + state-aware evidence)

## Verdict
`approved`

## Findings
- state column (active/pending_upward/dropped), create accepts state (server-only pending_upward), summary filters state='active' (invariants 2/5).
- Invariant 1 verified end-to-end: lone manager judgment cannot reach a summary; upward-no indistinguishable from never-submitted (byte-compare test).
- Eligibility computed server-side from reporting data; author self-decision blocked even for admins.

## Checklist results
- [x] ACs met (server 13/13 incl. real-core E2E; core 4/4)
- [x] Contract conformance
- [x] Tests meaningful (true integration, not just mocks)
- [x] Trust invariants asserted
- [x] No scope creep
- [x] Style per ENGINEERING.md
