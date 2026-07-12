---
id: SPEC-009-review
subject: SPEC-009
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-009 (Nudges)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 5/5 failing, all `expected 404 to be 200/201/400/401` — routes absent. Right reasons, recorded.
2. (caught in test-design review, pre-lock) Draft test wrongly excluded the org owner from suggestions; R2 excludes only self/chain/authors and the owner is outside this subject's chain. Assertion corrected to expect eligibility BEFORE the lock commit — exactly where such fixes must happen. A stray no-op call was also removed.
3. (major, resolved in draft) R1 self-only gap visibility is the invariant-5 extension that matters: a manager-facing "who has gaps" list would convert absence into a surveillance signal. The routes take no target userId by construction.
4. (minor) R5 behavioral fulfillment avoids request-state bureaucracy and can't be gamed by marking-done — only real evidence fulfills.
5. (minor) §5's suggestion-vs-permission distinction (authors excluded from suggestions but not forbidden as recipients) is sound; diversity is optimized, not mandated per-request.

## Checklist results
- [x] Red verified with reasons recorded (A2)
- [x] Contract-only assertions; helper fixtures (A2)
- [x] Invariants 1 & 5 structurally enforced
- [x] ACs executable
