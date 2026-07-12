---
id: ISS-004
severity: blocking
raised_by: implementer
relates_to: SPEC-004-H03
status: resolved
---

# ISS-004: Server cannot compute validator relationship without evidence subject

## Problem
SPEC-004 R5 requires the server to compute isManagerOf(validator, subject) at validation time, but §4.2 provides no core endpoint to read an evidence record's subject. Client-supplied subjectUserId would be spoofable (validator could claim "peer" by lying about the subject).

## Impact
SPEC-004-H03 blocked at implementation.

## Proposed options
A) Add GET /v1/evidence/:id to core contract (server-internal read). Simple, one round-trip, keeps trust computation server-side. ✅
B) Client supplies subjectUserId — REJECTED: spoofable, undermines invariant 1.
C) Move relationship computation into core — REJECTED: core has no reporting data (SPEC-003 R5 split).

## Resolution
Option A. SPEC-004 amended (A1): core gains GET /v1/evidence/:id → 200 {id, orgId, subjectUserId, authorUserId, kind} | 404. Spec Reviewer fast-track re-reviewed the delta: approved (read-only, org-scoped data already server-visible, no invariant impact). Implemented in core + consumed by server; fake core updated to match.
