---
id: SPEC-002-review
subject: SPEC-002
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-002 (Identity & tenancy)

## Verdict
`approved`

## Findings
1. (major, resolved in draft) 403-to-non-members would leak org existence; now 404 (R5), 403 reserved for members with insufficient role. Correct.
2. (minor) Session fixation: fresh token per login required by R1 ("opaque token per login"). Implementers must not reuse tokens.
3. (minor) scrypt acceptable over argon2 (built-in, no native deps); use node defaults (N=16384) or stronger.
4. (nit) A1 standards amendment within architect authority; ENGINEERING.md must change in the same branch.

## Checklist results
- [x] Traceable to brief (V1 Layer 1) + prototype learnings
- [x] Trust invariants N/A justified; R5 framed as precondition
- [x] Contracts complete (method/authz/shape/errors table)
- [x] ACs testable (AC1–AC6)
- [x] Failure modes covered (cycles, expiry, probing, dup keys)
- [x] Decomposable (4 one-session handoffs)
- [x] Migration story (R8, AC6 idempotence)
