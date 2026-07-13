---
id: SPEC-016-review
subject: SPEC-016
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-016 (GCP deployment)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: app-side suite fails at compile — `webDist`/`secureCookies` absent from AppOptions (missing-contract, the right reason). Recorded. Infra delegation (§9) is honest: validate runs where network exists (CI); conformance via checklist (AC4) reviewed here at H-close.
2. (major, resolved in draft) The env-var-list-as-prod-allowlist (R8) turns gate G5 from a checklist item into structure — the test adapter cannot exist in prod because Terraform is the only way env reaches the service.
3. (major) Core as `internal` ingress makes the server-only-core rule network topology, not convention. Good invariant translation.
4. (minor) SPA fallback must not shadow `/api` JSON 404s — AC1 asserts it; the classic footgun is pre-caught.
5. (minor) One public service (static from server) avoids the $18/mo load balancer and CORS entirely; right call at demo scale, revisit for CDN needs later.
6. (nit) db-f1-micro non-HA named as first design-partner upgrade.

## Checklist results
- [x] Red verified with reasons recorded (A2); infra delegation explicit
- [x] Gates G3/G5 addressed; G1 explicitly still open
- [x] Cost target substantiated (~$10–12/mo)
