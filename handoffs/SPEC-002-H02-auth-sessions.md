---
id: SPEC-002-H02
spec: SPEC-002
workstream: server
status: merged
depends_on: [SPEC-002-H01]
assignee: implementer
---

# SPEC-002-H02: Auth + sessions

## Objective
Auth + sessions implemented per SPEC-002 contracts.

## Context
SPEC-002 §2, §4, §5, §6. Standards: docs/ENGINEERING.md (server, A1 amendment).

## Task / Implementation record
signup/login/logout/me per §4.1. scrypt(N=16384 default)+per-user salt; opaque 32B token per login, sha256 at rest; httpOnly SameSite=Lax cookie, 7d; lazy expiry deletion; timingSafeEqual compare. AC1/AC2 in test/identity.test.ts.

## Acceptance criteria
Subset of SPEC-002 AC1–AC6 relevant to this handoff; see test/identity.test.ts.

## Test expectations
Integration tests against real Postgres (wave_test recreated per run).

## Follow-ups (implementer notes)
- Session cookie lacks Secure flag (dev http); add behind env flag pre-production.
- Chain walk is per-hop queries; fine at v1 scale, consider recursive CTE later.
