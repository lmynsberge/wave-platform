---
id: SPEC-023-H01-code-review
subject: SPEC-023-H01
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-023-H01

## Verdict
`approved`

## Findings
1. major→verified-ok — Statement order matches the spec's repair sequence exactly (collision deletes BEFORE reassignments, invariant repairs after), all on one transaction; the metric-identity partial unique index can therefore never abort a merge mid-flight.
2. minor — Repair (d) deletes any validator==author/subject rows for INTO globally, not only rows touched by this merge. Deliberate: such rows are structurally invalid whenever they exist; the merge is a safe place to sweep them, and untouched accounts have none (write-time rules prevent them).
3. minor — Idempotency verified by inspection: every statement keys on `from`, which owns nothing after commit; re-run returns zeros. Same_user → 400 before any work.
4. nit — Module duplicates the small err/internal helpers from domain.rs rather than sharing; acceptable at this size, candidate for a later cleanup pass.

## Checklist results
- [x] Conforms to §4.2 contract (route, body, count fields, 400 same_user)
- [x] Trust: repairs (b)/(d) enforce invariant 1 post-merge; relationship labels untouched so drop-not-negative math is stable
- [x] cargo fmt/clippy -D warnings/test green
- [x] Behavior proven by locked itest AC2/AC3 through the CLI
