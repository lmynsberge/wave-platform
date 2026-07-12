---
id: SPEC-008-review
subject: SPEC-008
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-008 (Hard-metric ingestion & normalization)

## Verdict
`approved`

## Findings
1. (verified, A2) RED-FOR-THE-RIGHT-REASON: 4/4 failing with `expected 404 to be 403/200` — the /ingest/metrics route does not exist; summaries lack normalizedScore. Failure messages are contract-absences, not harness defects. Recorded.
2. (verified, A2) Fixtures exclusively via orgWithChain helper; assertions rely only on spec-stated details (R4 percentile formula is IN the spec, so rank values are assertable).
3. (major, resolved in draft) Re-ingestion semantics: without R3 upsert, every payroll correction would inflate evidenceCount and distort means + significance. Upsert-on-metric-key is the right identity. Partial unique index keeps human evidence unaffected.
4. (minor) Single-established-user percentile = 0 (§5) is honest ("no peers below") — UI copy should say "first in cohort" rather than showing 0 as bad; noted for the profile spec follow-up.
5. (minor) R6 subjective rejection closes the loophole where an admin could bulk-write judgment as "data."

## Checklist results
- [x] Red itest verified with reasons recorded (A2)
- [x] Contract-only assertions; helper fixtures (A2)
- [x] Invariants 2 & 5 enforced in normalization semantics
- [x] Contracts complete; ACs testable and executable
- [x] Edge cases (duplicate rows, corrections, tiny cohorts)
