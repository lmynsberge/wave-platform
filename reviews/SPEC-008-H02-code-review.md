---
id: SPEC-008-H02-code-review
subject: SPEC-008-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-008-H02

## Verdict
`approved`

## Findings
- Established-cohort percentile per R4 formula in summaries; null below established; absent users out of cohort (R4, R5; AC4, AC5)
- System origination preserved: endpoint hardcodes authorUserId null; core's objective_requires_system remains the backstop.
- Lock rule held: no itest edits between red and green commits.

## Checklist results
- [x] Locked itest green unmodified (4/4; suite 27/27)
- [x] Invariants 2 & 5 in normalization semantics
- [x] Per-handoff commits
