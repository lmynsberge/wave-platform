---
id: SPEC-013-review
subject: SPEC-013
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-013 (Outbound nudge delivery)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 3/3, `expected 404 to be 200/403` — dispatch route absent. Recorded. Listener-based capture keeps this genuinely black-box.
2. (major, resolved in draft) The count-only closed response (R3) is the invariant-5 hinge: an admin triggering delivery must not thereby learn WHO has gaps. AC1 asserts the exact key set; the AC6 cross-user sweep over the whole captured set closes the delivery side.
3. (major) Missing from v1 and correctly flagged in §7: per-user opt-out. Proactive messages without a preference surface is acceptable for a design-partner pilot but MUST land before broad rollout — carried as a named follow-up.
4. (minor) Failure-then-retry semantics (§5: uncounted+unlogged on transport failure) prevent silent nudge loss.
5. (minor) Staging-verification delegation for real Slack/Teams transports is honest; interface parity with the test transport is what CI can and does guarantee.

## Checklist results
- [x] Red verified, reasons recorded (A2)
- [x] Contract-only assertions (command words are R2-contracted); helper fixtures
- [x] Invariants 3 & 5 addressed structurally
- [x] Follow-ups named (opt-out, staging verify)
