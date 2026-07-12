---
id: SPEC-001
title: Foundation & walking skeleton
status: done
author: spec-architect
signed_off: true
workstreams: [core, server, web]
---

# SPEC-001: Foundation & walking skeleton

## 1. Motivation
PROJECT_BRIEF "V1 Scope": all four layers require a running three-service skeleton with CI before any domain work. A walking skeleton de-risks the Rust↔TS boundary (flagged riskiest integration class) immediately.

## 2. Requirements
- R1: `core` Rust service (axum) exposing `GET /health` and `GET /v1/ping` returning `{ "service": "core", "status": "ok" }`
- R2: `server` TS service (fastify) exposing `GET /health` and `GET /api/ping` which calls core `/v1/ping` and returns `{ server: "ok", core: <core response> }`
- R3: `web` React app with a single page rendering the `/api/ping` result (proves full path)
- R4: Each service: build, test, lint runnable via one documented command
- R5: GitHub Actions CI: per-workstream jobs (build+lint+test) on PR
- R6: docker-compose for local dev: postgres + core + server + web

## 3. Trust invariant check
N/A — no domain data. Invariants attach from SPEC-003 onward.

## 4. Contracts
### 4.1 API (server)
`GET /api/ping` → 200 `{ "server": "ok", "core": { "service": "core", "status": "ok" } }`; 502 if core unreachable `{ "server": "ok", "core": null, "error": "core_unreachable" }`
### 4.2 Core interface
`GET /health` → 200 `{"status":"ok"}`; `GET /v1/ping` → 200 `{ "service": "core", "status": "ok" }`
### 4.3 Data model
None yet. Postgres present in compose but unmigrated.

## 5. Edge cases & failure modes
- core down → server /api/ping returns 502 shape above; web renders degraded state
- CORS: web dev origin allowed by server in dev only

## 6. Acceptance criteria
- AC1: `docker compose up` → visiting web shows core+server ok
- AC2: stopping core → web shows degraded state, server returns 502 shape
- AC3: CI green on all three jobs from a clean clone
- AC4: READMEs in core/, server/, web/ document run/test/lint commands

## 7. Out of scope
Auth, DB schema, any domain endpoint.

## 8. Decomposition sketch
- H01 (core): axum skeleton + endpoints + tests
- H02 (server): fastify skeleton + core client + endpoints + tests
- H03 (web): vite app + ping page + degraded state + tests
- H04 (infra): docker-compose + CI workflows
