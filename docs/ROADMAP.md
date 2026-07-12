# Roadmap (v1: first-org deployment)

Ordering follows the v1 scope layers in PROJECT_BRIEF.md. Each item becomes one or more specs.

1. **SPEC-001 — Foundation & walking skeleton**: DONE (see reviews/SPEC-001-*). Delivered via ISS-001 workaround.
2. **SPEC-002 — Identity & tenancy**: DONE (auth, orgs, RBAC edge, reporting chain; reviews/SPEC-002-*).
3. **SPEC-003 — Attribute taxonomy & evidence model**: DONE — attributes/evidence/validations in core, structural rules, invariant-1 manager gate in server (reviews/SPEC-003-*)
4. **SPEC-004 — Significance engine**: DONE — signal states, diversity-gated thresholds, drop-not-negative manager semantics, policy endpoint (reviews/SPEC-004-*)
5. **SPEC-005 — Feedback capture & validation flows**: DONE — validation queue, inbox, manager assessments with pending_upward state + upward decisions (reviews/SPEC-005-*)
6. **SPEC-006 — Individual profile**: DONE — auth+shell, attribute cards with policy-driven signal meter, inbox panel, invariant render tests (reviews/SPEC-006-*; trajectory deferred, needs longitudinal storage)
7. **SPEC-007 — Segmented chat companion (API)**: DONE, first TDD spec — red itest at review, green untouched at done; guided interview, owner-only segments, copy-semantics shares with chain visibility (reviews/SPEC-007-*; UI + LLM provider are follow-up specs)
8. **SPEC-008 — Hard-metric ingestion**: DONE, TDD — batch gateway with partial success + metric-identity upserts + within-org established-cohort percentiles (reviews/SPEC-008-*; source adapters are follow-ups)
9. **SPEC-009 — Nudges**: DONE, TDD — self-only gap feed, invariant-aware suggestions, behavioral fulfillment (reviews/SPEC-009-*)
10. **SPEC-010 — Org view (thin)**: DONE, TDD — team-signal with closed-schema negative-space contract (reviews/SPEC-010-*)

**V1 ROADMAP STRUCTURALLY COMPLETE.** Remaining for design-partner readiness: companion + flows UI, LLM provider, SSO, deployment. See open follow-ups in handoffs.

Cross-cutting: **SPEC-QA-001 — spec-locked integration harness**: DONE — itest/ with per-spec black-box files (16 tests, real stack), TDD-from-spec rule active from SPEC-007, lock rule enforced in review.

Out of v1: cross-org normalization, arbitration, automated collusion detection, premium tier.
