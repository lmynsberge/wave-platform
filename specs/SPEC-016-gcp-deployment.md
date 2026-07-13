---
id: SPEC-016
title: GCP demo deployment — Cloud Run + Cloud SQL, Terraform
status: done
author: spec-architect
signed_off: true
workstreams: [server, infra]
---

# SPEC-016: GCP demo deployment

## 1. Motivation
Orchestrator decisions (recorded): GCP confirmed; cheapest options with most built-in functionality; portability explicitly not a goal; cold starts acceptable; Terraform in-repo with opinionated organization. Target ≈ $10–12/mo. This spec also closes launch gates G3 (Secure cookies) and structurally closes G5 (test adapter absent from prod env).

## 2. Requirements
### App-side (testable)
- R1: The server serves the built web app when `webDist` is configured: `/` and any non-`/api` GET fall through to the SPA `index.html`; static assets served; `/api/*` and `/health` behavior unchanged. One public service, no CORS, no load balancer
- R2: Session cookies gain `Secure` when `secureCookies` is enabled (buildApp option, env `COOKIE_SECURE=1` in prod). Set AND clear paths both carry it (G3)
- R3: `PORT` env respected (already true — Cloud Run injects it); `DATABASE_URL` supports Cloud SQL unix sockets (node-postgres native — verified by config review, no code change expected)

### Infrastructure (Terraform, verified by fmt/validate + reviewed checklist)
- R4: Layout: `infra/bootstrap` (GCS state bucket; the ONLY local-state apply), `infra/modules/{run-service,database}`, `infra/envs/demo`. One env = one root; no workspaces; plain terraform + Makefile
- R5: `run-service` module ENFORCES conventions: scale-to-zero (min 0), max instances (default 2), typed ingress (`public`|`internal`), secret-env mounting pattern, mandatory labels. Misconfiguration is impossible, not discouraged
- R6: `database` module: Cloud SQL Postgres `db-f1-micro`, two databases (`wave_srv`, `wave_core`), one app user, password generated into Secret Manager
- R7: demo env composes: Artifact Registry, `wave-core` (internal ingress), `wave-server` (public, serves static, Cloud SQL attached), migrate Cloud Run Job (server migrations; core migrates on boot), Cloud Scheduler → nudge-dispatch (weekly), Secret Manager secrets (containers only — values out-of-band, never in state)
- R8: TF never builds images: CI builds/pushes `:git-sha` tags to Artifact Registry (Workload Identity Federation — no key files); image refs are variables. The env-var lists in TF are the production allowlist: `BRIDGE_TEST_SECRET` is structurally absent (G5)
- R9: `DEPLOY.md` runbook: bootstrap → secrets → first apply → migrate job → seed → demo URL, ~15 minutes
- R10: CI: `terraform fmt -check` + `terraform validate` job; image build/push job (manual dispatch + main pushes)

## 3. Trust invariant check
Core gets `internal` ingress — the server-only core boundary becomes network topology. Secret values never in state (BYO LLM keys pathway; full envelope-encryption gate G1 still open, tracked). No new data surfaces.

## 4. Contracts
buildApp options gain `webDist?: string` and `secureCookies?: boolean`. Infra module interfaces documented in module READMEs (variables/outputs).

## 5. Edge cases & failure modes
SPA fallback must NOT shadow `/api/*` 404s (unknown API routes stay JSON 404). Cold start ~5–10s accepted by decision. `db-f1-micro` is shared-core/non-HA — fine for demo, named as the first thing to upgrade for a design partner.

## 6. Acceptance criteria
- AC1: with `webDist` set: GET `/` → index.html (200 text/html); GET `/some/spa/route` → index.html; GET `/assets/<file>` → the file; GET `/api/unknown` → JSON 404 (server unit tests)
- AC2: with `secureCookies`: signup/login set-cookie includes `Secure`; logout clearing cookie includes `Secure`; without the flag, no `Secure` (unit tests)
- AC3: `terraform fmt -check` and `terraform validate` pass in CI for bootstrap + demo env
- AC4: reviewed infra checklist: scale-to-zero on both services, core ingress internal, no plaintext secret values anywhere in HCL/state design, BRIDGE_TEST_SECRET absent from prod env lists, labels present
- AC5: DEPLOY.md dry-read: a fresh GCP project reaches a seeded demo URL following only the runbook

## 7. Out of scope
Custom domain + managed TLS cert (Cloud Run URL is fine for demo), HA database, VPC/private-IP SQL (public IP + connector at demo tier), monitoring/alerting, multi-env promotion, envelope encryption (G1 stays open).

## 8. Decomposition sketch
H01 app-side (R1–R3, red tests first); H02 bootstrap + modules; H03 demo env + scheduler + job; H04 CI + DEPLOY.md + checklist review.

## 9. Integration test design
App-side ACs: server unit tests written FIRST and red (test/static-and-cookies.test.ts). Infra cannot red/green in CI affordably: delegated to `validate` (AC3, CI-enforced) + reviewed conformance checklist (AC4) — recorded honestly as a delegation, and local HCL checking is limited in the agent environment (no registry access), so validate runs in CI where network exists.
