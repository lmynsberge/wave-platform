---
id: SPEC-021-review
subject: SPEC-021
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-021 (Injectable email provider)

## Verdict
`approved`

## Findings
1. (verified, A2) RED two tiers: itest AC1 fails (no email captured — the feature); unit suite fails `Cannot find module ../src/email.js`. itest AC2 is green pre-implementation BY DESIGN and recorded as the never-break guard (SPEC-017 AC1 precedent). All recorded.
2. (major, resolved in draft) R3's ordering — durable invite first, send after, failure never surfaces — means email is an accelerant, not a dependency: noop-in-prod is a valid configuration, which is exactly the "no-op for now" ask made safe.
3. (minor) Fail-SOFT on unknown provider (R1) is deliberately opposite the bridge's fail-closed: misconfigured email should degrade to silence, not block onboarding. The asymmetry is correct and now written down.
4. (minor) The test provider doubles as the shape of any future HTTP vendor adapter — the injection seam is proven, not just declared.
5. (nit) Metrics exposure deferred honestly; counters + structured logs are queryable in Cloud Run logs today.

## Checklist results
- [x] Red both tiers, reasons + designed-guard recorded (A2)
- [x] Locked SPEC-020 named as contract regression guard (AC5)
- [x] No new data surfaces
