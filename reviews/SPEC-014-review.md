---
id: SPEC-014-review
subject: SPEC-014
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-014 (LLM companion provider)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 5/5 after one red-quality repair — AC4 initially passed pre-implementation because "not an error" is satisfied by guided behavior; strengthened pre-lock to require a captured LLM attempt. This is exactly the red-for-the-right-reason discipline working. Remaining failures: 404 on llm-config, guided-instead-of-scripted replies.
2. (major, resolved in draft) R4 moves the synthesis marker from provider-coupling (SPEC-007/011 follow-up) to a spec-level contract, AND adds the quote-the-user post-check with deterministic replacement — the LLM cannot silently break sharing detection or produce unquoted syntheses.
3. (major) R5 redaction asserted on CAPTURED WIRE TRAFFIC, not on internal function calls — the strongest form available. Placeholder-restore round-trip covered (AC3).
4. (major, carried) BYO keys plaintext-at-rest is named debt with a pre-launch gate; GET masking prevents casual exposure. Acceptable for now ONLY because orgs are test orgs.
5. (minor) Follow-up state derived from message history (§5) avoids a new state column; provider-coupling reduced not increased.
6. (minor) Fail-closed per-turn (R6) means a flaky self-hosted model degrades to guided per message — the interview is unkillable.

## Delta re-review (cycle 2 — ISS-005/A1)
One setup turn added to AC4; assertions untouched; sequence now R3-legal. `approved`.

## Checklist results
- [x] Red verified with reasons + red-quality repair recorded (A2)
- [x] Contract-only; helper fixtures; delegations pointed (AC7 → SPEC-007 itest)
- [x] Invariant 3 strengthened at the trust boundary (redaction)
- [x] Named follow-ups: envelope encryption, staging vendor verification
