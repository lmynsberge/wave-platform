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

**V1 ROADMAP STRUCTURALLY COMPLETE.**

Post-v1 delivered:
- **SPEC-011 — Companion, nudges & asks UI**: DONE, TDD (red component suites) — thread + two-step share, Give & Grow view
- **SPEC-012 — Messaging bridge (Slack/Teams)**: DONE, TDD — binding-as-authorization gateway, one-companion-two-doors, Slack v0 HMAC + Teams shared-secret adapters

- **SPEC-013 — Outbound nudge delivery**: DONE, TDD — proactive gap check-ins + asks reminders via bridge transports, 7-day dedup, count-only dispatch response

- **SPEC-014 — LLM companion provider**: DONE, TDD — hybrid guided-skeleton + LLM follow-ups, multi-provider (anthropic / openai_compatible incl. self-hosted) with org BYO, wire-level redaction, fail-closed everywhere

- **SPEC-015 — Manager UI**: DONE, TDD — team signal, validation queue, upward decisions, invariants made legible in copy

- **SPEC-016 — GCP demo deployment**: DONE — Cloud Run scale-to-zero + Cloud SQL (~$10-12/mo), opinionated TF (policy modules, env allowlists), gates G3+G5 closed, DEPLOY.md runbook (apply requires GCP creds — user-side)

- **SPEC-017 — Security & consent gates**: DONE, TDD both tiers — G1 (AES-256-GCM at rest, fail-closed) + G2 (opt-out: API, in-channel command, invariant-safe dispatch skip)

- **SPEC-018 — Slack raw-body hardening (G4)**: DONE, TDD — exact-bytes verification, fail-open fallback removed

Remaining for design-partner readiness: BYO-key envelope encryption (REQUIRED, SPEC-014 gate), notification opt-out (REQUIRED, SPEC-013 gate), staging verification of vendor adapters + Slack/Teams transports, Teams AAD JWT, link-code UI in web settings, SSO, deployment, cron for dispatch.

Cross-cutting: **SPEC-QA-001 — spec-locked integration harness**: DONE — itest/ with per-spec black-box files (16 tests, real stack), TDD-from-spec rule active from SPEC-007, lock rule enforced in review.

Out of v1: cross-org normalization, arbitration, automated collusion detection, premium tier.
