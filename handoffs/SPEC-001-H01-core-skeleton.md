---
id: SPEC-001-H01
spec: SPEC-001
workstream: core
status: ready
depends_on: []
assignee: implementer
---

# SPEC-001-H01: Rust core skeleton

## Objective
`core/` builds and serves the two endpoints in SPEC-001 §4.2 with tests.

## Context
SPEC-001 §2 R1, §4.2, §6 AC3–AC4. Standards: docs/ENGINEERING.md (core).

## Task
- `cargo init` in `core/`; deps: axum, tokio, serde, serde_json; dev: reqwest or axum-test
- Implement `GET /health`, `GET /v1/ping` per contract; bind `0.0.0.0:8081` (env `CORE_PORT` override)
- `core/README.md`: run/test/lint commands
- Dockerfile (multi-stage, slim runtime)

## Acceptance criteria
1. `cargo test` passes with endpoint tests asserting exact response bodies
2. `cargo clippy -- -D warnings` clean; `cargo fmt --check` clean
3. Container builds and serves both endpoints

## Test expectations
Integration tests for both endpoints: status 200 + exact JSON.

## Follow-ups (implementer notes)
