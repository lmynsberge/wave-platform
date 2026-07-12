---
id: SPEC-002-H03
spec: SPEC-002
workstream: server
status: merged
depends_on: [SPEC-002-H01]
assignee: implementer
---

# SPEC-002-H03: Orgs + memberships + RBAC edge

## Objective
Orgs + memberships + RBAC edge implemented per SPEC-002 contracts.

## Context
SPEC-002 §2, §4, §5, §6. Standards: docs/ENGINEERING.md (server, A1 amendment).

## Task / Implementation record
POST /api/orgs (creator owner), member listing/adding. gate() implements R5: 401 unauth, 404 non-member/unknown org, 403 insufficient_role for members. AC3/AC4 covered.

## Acceptance criteria
Subset of SPEC-002 AC1–AC6 relevant to this handoff; see test/identity.test.ts.

## Test expectations
Integration tests against real Postgres (wave_test recreated per run).

## Follow-ups (implementer notes)
- Session cookie lacks Secure flag (dev http); add behind env flag pre-production.
- Chain walk is per-hop queries; fine at v1 scale, consider recursive CTE later.
