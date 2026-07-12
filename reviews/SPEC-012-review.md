---
id: SPEC-012-review
subject: SPEC-012
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-012 (Messaging bridge)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 5/5, `expected 404 to be 200/401` — bridge routes absent. Recorded. Restart of harness picks up BRIDGE_TEST_SECRET.
2. (major, resolved in draft) The binding-as-authorization principle (§3) is the load-bearing wall: acting user comes from the VERIFIED platform identity, never from message content — no impersonation-by-text. Test adapter gated on an env secret that production config must never set; deployment checklist follow-up noted.
3. (major, resolved) "One companion, two doors" (AC3) prevents segment fragmentation — a Slack check-in and web session are one continuous private space, which is what makes invariant 3 coherent across channels.
4. (minor) Share-confirm parity in chat (R4) carries SPEC-011's two-step boundary into a medium where mis-sends are easier. Good.
5. (minor) Teams shared-secret v1 is honestly labeled interim; AAD JWT tracked as follow-up. Slack v0 HMAC with replay tolerance is the real thing, delegated to unit scope (AC6) with pointer.
6. (nit) Unknown-command-defaults-to-companion (§4.3) makes conversation the default verb — right for a companion product.

## Checklist results
- [x] Red verified with reasons recorded (A2)
- [x] Contract-only assertions; helpers (A2); delegation pointers (AC6)
- [x] Invariants 1/3/4/5 across the bridge addressed explicitly
