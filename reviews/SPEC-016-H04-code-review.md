---
id: SPEC-016-H04-code-review
subject: SPEC-016-H02..H04 (infra)
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-016 infra (incl. AC4 conformance checklist)

## Verdict
`approved`

## AC4 conformance checklist (spec-required)
- [x] Scale-to-zero: min_instance_count hardcoded 0 in the module — not a variable, cannot drift
- [x] Core ingress: INGRESS_TRAFFIC_INTERNAL_ONLY; public invoker IAM granted only when ingress == public
- [x] No human/vendor secret values in HCL; generated credentials (DB password, dispatch token) state-resident per amended rule 4
- [x] BRIDGE_TEST_SECRET absent from every env list; the list is exhaustive by construction (G5)
- [x] Labels on every labelable resource
- [x] TF builds no images; refs are variables; CI publishes :git-sha
- [x] COOKIE_SECURE=1 in server env (G3)

## Findings
- Local parse (OpenTofu binary) caught 4 real syntax errors before CI — validates the two-tier check strategy (parse locally, full validate in CI where the registry is reachable).
- Scheduler ships paused with a placeholder org id: honest, since dispatch is per-org and the org exists only post-seed.
- resources limits 1cpu/512Mi: right for demo; core Rust binary will be comfortable.

## Checklist results
- [x] Per-handoff commits; no scope creep; runbook dry-read coherent (AC5)
