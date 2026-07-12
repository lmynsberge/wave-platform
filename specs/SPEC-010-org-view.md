---
id: SPEC-010
title: Thin org view — team signal health
status: done
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-010: Thin org view — team signal health

## 1. Motivation
PROJECT_BRIEF V1 Layer 4: "Manager dashboard: team signal health, validation queue. NOT surveillance." Deliberately thin: a manager sees their own reports' signal maturity and their pending validation work — nothing org-wide, nothing about engagement, nothing from chat, no shared/not-shared distinctions.

## 2. Requirements
- R1: GET team-signal returns exactly the caller's direct + transitive reports. Per report: {userId, name, attributesEstablished, attributesEmerging, pendingValidations} — counts derived from data the manager can already access per-member (summaries; their own validation queue). NO insufficient/absence counts: absence is not surfaced as a number to managers (INVARIANT 5)
- R2: A member with no reports receives an empty list (200, not an error) — being a non-manager is normal
- R3: pendingValidations per report = items in the caller's validation queue for that subject; validating decrements on next read
- R4: NEGATIVE SPACE contract (INVARIANTS 3/4/5): the response schema is CLOSED — exactly the five fields in R1 per report and nothing else. No companion/share/chat fields, no gap counts, no last-active timestamps. The itest asserts the exact key set
- R5: Standard edge semantics: anonymous 401, non-member 404

## 3. Trust invariant check
3/4: no chat-derived data can appear (R4 closed schema, asserted). 5: absence never becomes a managerial number (R1 explicitly omits insufficient counts). 1/2: N/A (no origination or score surfaces beyond existing per-member reads).

## 4. Contracts
### 4.1 Server API
GET /api/orgs/:orgId/team-signal — member+ → 200 {team:[{userId,name,attributesEstablished,attributesEmerging,pendingValidations}]} (order: name asc); 401; 404 non-member
### 4.2 Core interface
Unchanged (existing summary + evidence listing reads).
### 4.3 Data model
None.

## 5. Edge cases & failure modes
Transitive reports included (whole subtree). A report with zero attributes → zeros (their row still appears: team membership is not private from their manager; their SIGNAL ABSENCE carries no count beyond the zeros of what exists). Core down → 502.

## 6. Acceptance criteria
- AC1: manager's team lists direct + transitive reports and nobody else; counts match the per-member summaries the manager can read
- AC2: non-manager member → 200 {team: []}
- AC3: pendingValidations matches the caller's validation queue for that subject and decrements after validating
- AC4: closed schema — every team row has EXACTLY the five R1 keys (asserted via Object.keys)
- AC5: anonymous 401; non-member 404

## 7. Out of scope
Org-wide admin rollups, trends/history, exports, per-attribute drilldowns (the manager can open the member's profile), any absence metrics.

## 8. Decomposition sketch
H01 endpoint; H02 green + artifacts.

## 9. Integration test design
itest/tests/spec-010.itest.ts pre-implementation via orgWithChain. Closed-schema assertion is the signature test (R4). Expected red: 404 on route.
