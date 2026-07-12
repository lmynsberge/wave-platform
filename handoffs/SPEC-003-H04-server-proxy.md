---
id: SPEC-003-H04
spec: SPEC-003
workstream: server
status: merged
depends_on: [SPEC-003-H01]
assignee: implementer
---

# SPEC-003-H04: Server proxy + manager-origination gate

## Objective
Server proxy + manager-origination gate per SPEC-003 contracts.

## Context
SPEC-003 §2–§6; ARCHITECTURE.md boundaries; ENGINEERING.md + A2.

## Task / Implementation record
Three endpoints per §4.1; gateMember reuses SPEC-002 R5 semantics; isManagerOf walks subject's upward chain (bounded 100); invariant 1 gate returns 403 manager_cannot_originate for direct AND transitive managers; upward + peer feedback allowed. Core mocked via injected fetch; identity against real PG.

## Acceptance criteria
Relevant subset of SPEC-003 AC1–AC6; see core/tests/domain.rs and server/test/feedback.test.ts.

## Test expectations
Core: integration vs real PG (fresh wave_core_test per run). Server: identity vs real PG, core behavior via injected fake conforming to §4.2.

## Follow-ups (implementer notes)
- Core error for pool exhaustion currently 500 internal; consider 503.
- Fake core in server tests must be kept in sync with §4.2 — consider contract tests against the real binary later.
