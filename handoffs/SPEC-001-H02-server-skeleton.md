---
id: SPEC-001-H02
spec: SPEC-001
workstream: server
status: ready
depends_on: [SPEC-001-H01]
assignee: implementer
---

# SPEC-001-H02: TS server skeleton + core client

## Objective
`server/` serves `/health` and `/api/ping` per SPEC-001 §4.1, proxying core, with degraded handling.

## Context
SPEC-001 §2 R2, §4.1, §5. Standards: docs/ENGINEERING.md (server). Core base URL via env `CORE_URL`.

## Task
- Scaffold: fastify + strict TS (ESM), zod, vitest; `server/README.md` with commands
- `GET /health` → `{"status":"ok"}`; `GET /api/ping` → calls core `/v1/ping` (timeout 2s) → 200 combined shape; on failure → 502 `{ server: "ok", core: null, error: "core_unreachable" }`
- CORS: allow web dev origin only when `NODE_ENV=development`
- Dockerfile

## Acceptance criteria
1. vitest suite covers 200 path (core mocked) and 502 path
2. `tsc --noEmit` clean; lint clean; no `any`
3. Exact contract shapes asserted in tests

## Test expectations
Unit tests with mocked core client; contract-shape assertions.

## Follow-ups (implementer notes)
