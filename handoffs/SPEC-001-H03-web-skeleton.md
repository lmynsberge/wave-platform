---
id: SPEC-001-H03
spec: SPEC-001
workstream: web
status: ready
depends_on: [SPEC-001-H02]
assignee: implementer
---

# SPEC-001-H03: React web skeleton + ping page

## Objective
`web/` renders the `/api/ping` result, including degraded state.

## Context
SPEC-001 §2 R3, §5, §6 AC1–AC2. Standards: docs/ENGINEERING.md (web).

## Task
- Vite + React 18 + strict TS scaffold; TanStack Query
- Single page: fetch `/api/ping`; render ok state (core+server ok) and degraded state (core null) as plain text/status blocks
- `web/README.md` with commands; Dockerfile (static build behind nginx or vite preview for dev)

## Acceptance criteria
1. Component test: ok state and degraded state render from mocked responses
2. `tsc --noEmit` clean; lint clean

## Test expectations
vitest + testing-library, msw or fetch mock for the two states.

## Follow-ups (implementer notes)
