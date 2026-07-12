---
id: SPEC-010-review
subject: SPEC-010
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-010 (Thin org view)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 4/4, `expected 404 to be 200/401` — route absent. Recorded.
2. (major, resolved in draft) The closed-schema "negative space" contract (R4/AC4) is the strongest guard in the spec: it makes future surveillance-creep a LOCKED-TEST failure, not a review judgment call. Any added field requires a spec amendment in front of a reviewer.
3. (minor) Omitting insufficient/absence counts (R1) correctly extends invariant 5 to the managerial surface; zeros for existing attributes are fine (they describe present signal, not absence).
4. (nit) Name-asc ordering specified so the closed-schema assertion isn't order-fragile.

## Checklist results
- [x] Red verified, reasons recorded (A2)
- [x] Contract-only; helper fixtures (A2)
- [x] Invariants 3/4/5 via closed schema + omissions
- [x] ACs executable
