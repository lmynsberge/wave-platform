---
id: SPEC-QA-001
title: Spec-locked integration test harness
status: done
author: spec-architect
signed_off: true
workstreams: [server, core, process]
---

# SPEC-QA-001: Spec-locked integration test harness

## 1. Motivation
Direction from the Orchestrator (human): integration tests must be first-class, spec-locked artifacts — designed during the spec phase (TDD), one file/directory per spec, immutable without a spec change. Unit tests remain free to evolve with implementation; integration tests are the executable form of a spec's acceptance criteria.

## 2. Requirements
- R1: `itest/` at repo root: one test file per spec (`itest/tests/spec-###.itest.ts`), black-box through the public server API only (no imports from server/core source; HTTP + real processes)
- R2: Harness boots the REAL stack: Postgres (docker service when available; local cluster in the agent environment per ISS-002/ISS-003), the compiled `wave-core` binary, and the server via its real entrypoint — fresh databases per run, migrations executed by the components' own runners
- R3: LOCK RULE: integration test files may only change alongside a spec amendment (reviewed) or a new spec version. Any diff to `itest/tests/` in a commit that does not reference a spec/amendment ID is a process violation; reviewers must reject it
- R4: TDD ordering: from SPEC-007 onward, the spec phase produces the integration test file (compiling, with real assertions, failing red against the unimplemented system) BEFORE decomposition. Spec template gains section 9 "Integration test design"; Spec Reviewer checklist gains a red-test check
- R5: Backfill: SPEC-001 through SPEC-006 each get their integration file derived strictly from their AC lists. ACs that are web-render-level (component-scope) are delegated by explicit reference to the component suites, listed per file header
- R6: CI gains an `itest` job: postgres service, cargo build, run harness; required for merge
- R7: Namespace amendment (A1): cross-cutting process/QA specs use `SPEC-QA-###`; agents/README rule 7 updated

## 3. Trust invariant check
Process spec — invariants apply transitively: backfilled tests re-assert invariant behaviors black-box (manager gate 403, score null below established, dropped assessments traceless), which strengthens rather than changes them.

## 4. Contracts
Harness env: `IT_SERVER_URL`, ports 8180 (server) / 8181 (core), DBs `wave_it_srv` / `wave_it_core`. Helpers: `client()` cookie-jar fetch wrapper; `resetStack()` optional per-file DB reset. Files run sequentially (shared stack).

## 5. Edge cases & failure modes
Core binary missing → harness builds it (cargo build) before boot. Port collisions → fixed test ports, harness kills strays. Postgres absent → harness fails fast with actionable message (start cluster / provide docker).

## 6. Acceptance criteria
- AC1: `npm run itest` from clean clone (with toolchains) boots stack and runs all spec files green
- AC2: each of SPEC-001..006 has `itest/tests/spec-00N.itest.ts` whose describe blocks name the spec's ACs verbatim by ID
- AC3: WORKFLOW/roles/templates updated: lock rule, TDD ordering, section 9, reviewer checks
- AC4: CI has the itest job
- AC5: web-level ACs are explicitly delegated with pointers, never silently skipped

## 7. Out of scope
Web E2E browser automation (Playwright — future QA spec), performance testing, coverage gates.

## 8. Decomposition sketch
H01 harness + process docs; H02 backfill 001–003; H03 backfill 004–006; H04 CI job + traceability.

## 9. Integration test design
This spec's own integration test is the harness booting and the six backfill files passing (AC1/AC2) — self-demonstrating.

## Amendments
- A1: SPEC-QA-### namespace (R7).
