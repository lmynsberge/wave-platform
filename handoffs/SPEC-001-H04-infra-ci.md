---
id: SPEC-001-H04
spec: SPEC-001
workstream: server
status: ready
depends_on: [SPEC-001-H01, SPEC-001-H02, SPEC-001-H03]
assignee: implementer
---

# SPEC-001-H04: docker-compose + CI

## Objective
One-command local stack; CI running all three workstreams on PR.

## Context
SPEC-001 §2 R5–R6, §6 AC1, AC3.

## Task
- `docker-compose.yml`: postgres:16 (volume, healthcheck), core, server (CORE_URL wired), web; ports documented in root README
- `.github/workflows/ci.yml`: three jobs (core: fmt+clippy+test; server: tsc+lint+vitest; web: tsc+lint+vitest), path-filtered triggers plus a full run on main
- `.env.example` at root

## Acceptance criteria
1. `docker compose up` from clean clone → web shows ok state (AC1)
2. Stopping core container → web shows degraded (AC2)
3. CI green from clean clone (AC3)

## Test expectations
CI itself is the test; include a compose smoke script `scripts/smoke.sh` curling server /api/ping.

## Follow-ups (implementer notes)
