---
id: SPEC-005-review
subject: SPEC-005
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-005 (Feedback capture & validation flows)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) Original sketch had manager assessments entering summaries immediately with a retro-drop; violates invariant 1 (transient signal from a lone manager). Resolved: pending_upward state, invisible until upward yes. Correct-by-construction.
2. (major, resolved) Dropped assessments must be indistinguishable from never-submitted in ALL org-visible surfaces (invariant 5 + sharing-indistinguishability instinct). §3 and AC4 pin this: summary identical to pre-assessment. Subject's own inbox MAY show it (their data about themselves) — acceptable and transparent.
3. (minor) R6 root-case: owner/admin as fallback deciders is pragmatic; author-exclusion explicitly required (§5). Watch for tiny orgs where owner IS the only manager — then assessments effectively need a second admin; acceptable friction, aligns with "signal is hard to earn."
4. (minor) Single-decider (R5 v1) trades robustness for simplicity; multi-validator consensus noted out of scope. Fine.
5. (nit) Inbox hides author identity by default — matches Trust Model default-anonymous direction pending preferences.

## Checklist results
- [x] Traceable to brief (Layer 2 flows, upward chain, feedback-to-individual)
- [x] Invariants: 1 & 5 actively enforced; 2 via state filter; 3–4 N/A
- [x] Contracts complete (pagination, error codes, eligibility)
- [x] ACs testable (AC1–AC6)
- [x] Edge cases (double-decide, root author, self-decide) covered
- [x] Decomposable (4 handoffs)
- [x] Migration 003 with safe default
