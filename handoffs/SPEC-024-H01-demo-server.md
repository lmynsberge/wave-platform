---
id: SPEC-024-H01
spec: SPEC-024
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-024-H01: Demo session server side

## Objective
Demo routes + persona identity resolution + single-choke-point read-only guard; `itest/tests/spec-024.itest.ts` green.

## Context
SPEC-024 §4.1/§4.3/§5. Identity: `currentUser` in `server/src/auth.ts` (add `s.demo` to the session join; resolve persona by configured email with R6 fallback). Guard: `buildApp` in `server/src/app.ts`.

## Task
- `server/migrations/011_demo_sessions.sql`
- `server/src/demo.ts`: `registerDemoRoutes(app, pool)` + `configureDemo`/`isDemoSession` helpers
- Wire `DEMO_PERSONA_EMAIL` through `AppOptions.demoPersonaEmail` (index.ts env read, itest harness already exports it)
- `app.addHook` preHandler enforcing R4 with the spec's allowlist

## Acceptance criteria
1. Spec AC1–AC5 pass in the itest
2. Guard lives in exactly one place; bearer-authed routes unaffected (no cookie → no lookup)
3. /api/me carries `demo: true` only while flagged

## Test expectations
Locked itest; no unit tests required (thin SQL + one hook).

## Follow-ups (implementer notes)
Guard costs one extra sessions lookup per non-GET /api request carrying a cookie; fine at current scale (noted for BACKLOG if it ever matters).
