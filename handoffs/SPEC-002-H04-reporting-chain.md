---
id: SPEC-002-H04
spec: SPEC-002
workstream: server
status: merged
depends_on: [SPEC-002-H01]
assignee: implementer
---

# SPEC-002-H04: Reporting edges + chain query

## Objective
Reporting edges + chain query implemented per SPEC-002 contracts.

## Context
SPEC-002 §2, §4, §5, §6. Standards: docs/ENGINEERING.md (server, A1 amendment).

## Task / Implementation record
PUT reporting (upsert, null clears, self_edge/cycle_detected/not_member 400s, 100-hop bound), GET chain bottom-up excl. self. AC5 covered.

## Acceptance criteria
Subset of SPEC-002 AC1–AC6 relevant to this handoff; see test/identity.test.ts.

## Test expectations
Integration tests against real Postgres (wave_test recreated per run).

## Follow-ups (implementer notes)
- Session cookie lacks Secure flag (dev http); add behind env flag pre-production.
- Chain walk is per-hop queries; fine at v1 scale, consider recursive CTE later.
