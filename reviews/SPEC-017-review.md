---
id: SPEC-017-review
subject: SPEC-017
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-017 (Security & consent gates)

## Verdict
`approved`

## Findings
1. (verified, A2) RED, two tiers as designed: itest 3/4 red for right reasons (prefs 404; delivery ignoring opt-out — `expected true to be false` on the delivered-ids assertion). itest AC1 is green pre-implementation BY DESIGN and is recorded as a regression guard, not a red: G1's red lives in the delegated unit suite, which fails `Cannot find module ../src/crypto.js`. Both recorded; no artificial strengthening needed — the honest split beats a contrived black-box crypto probe.
2. (major, resolved in draft) R2 fail-closed on missing KEK prevents the silent-plaintext regression class entirely; keyless configs staying storable keeps self-hosted friction-free.
3. (major) R5's skip semantics (nothing sent, logged, or counted) plus the existing count-only response means opt-out status never leaks to the org — preference privacy mirrors gap privacy (R4 no-target-userId). Consistent with the invariant-5 extension doctrine.
4. (minor) R6 in-channel `notifications off` puts the control where the interruption happens — the consent surface with the lowest friction.
5. (minor) Legacy plaintext read tolerance (R3) is time-bounded debt: fine now, add "re-encrypt sweep" to backlog at first real org.
6. (nit) KMS-managed keys correctly deferred as the design-partner upgrade; Secret-Manager KEK is a real envelope at this tier.

## Checklist results
- [x] Red verified BOTH tiers with reasons recorded (A2); AC1 regression-guard status explicit
- [x] Contract-only assertions; both harness listener patterns reused per §9
- [x] Invariants 3 & 5 addressed; gates G1/G2 fully specified
