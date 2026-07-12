---
id: SPEC-005
title: Feedback capture & validation flows
status: approved
author: spec-architect
signed_off: true
workstreams: [core, server]
---

# SPEC-005: Feedback capture & validation flows

## 1. Motivation
PROJECT_BRIEF V1 Layer 2 ("manager-as-validator flow with the upward chain") and Trust Model ("all feedback goes to individual + manager"). SPEC-003/004 built the primitives; this spec builds the flows around them: who sees what pending work, and how a manager's own attribute judgments enter the system legitimately (via THEIR manager's validation — the upward chain).

## 2. Requirements
- R1: Validation queue: a manager can list subjective evidence about their direct/transitive reports that THEY have not yet validated. Core provides the query; server resolves the report set from reporting_edges
- R2: Feedback inbox: an individual can list evidence about themselves (they are always a recipient — brief: "feedback always goes to them and their manager"), newest first
- R3: Manager assessments (upward chain): a manager MAY record an attribute assessment about a report, but it enters as `manager_assessment` evidence in state `pending_upward` and is INVISIBLE to summaries until the manager's OWN manager validates it (outcome yes → becomes countable subjective evidence authored by the manager; no/no_signal → stays dropped, never counted). INVARIANT 1 preserved: a manager's judgment alone can never create signal
- R4: Core: evidence gains `state` ∈ {active, pending_upward, dropped}; only `active` rows feed summaries (SPEC-004 math unchanged for active rows)
- R5: Upward validation: only a user in the AUTHOR-manager's upward chain may validate a pending_upward evidence; outcome yes → state=active; no/no_signal → state=dropped (drop-not-negative; INVARIANT 1). Exactly one upward validation decides it (v1)
- R6: Top-of-chain case: if the assessing manager has no manager (org root), pending_upward items are validatable by any org `owner`/`admin` who is not the author (server resolves eligibility)
- R7: All listing endpoints paginate (limit ≤ 50 default 20, `before` cursor by created_at) — queues grow

## 3. Trust invariant check
1: R3/R5 — manager assessments cannot self-activate; upward `no` drops silently (never negative). 2: R4 — pending/dropped rows excluded from all summary math. 3–4: N/A. 5: dropped assessments leave NO trace in summaries (identical to never-submitted — absence stays neutral and indistinguishable).

## 4. Contracts
### 4.1 Server API
| Method/Path | Auth | Success |
|---|---|---|
| GET /api/orgs/:orgId/validation-queue?limit&before | member+ | 200 {items:[{evidenceId,subjectUserId,attributeKey,note,createdAt}],nextBefore} — evidence about caller's reports, unvalidated by caller, active subjective only |
| GET /api/orgs/:orgId/inbox?limit&before | member+ | 200 {items:[{evidenceId,attributeKey,note,authorKnown:bool,createdAt,state}]} — caller's own evidence incl. pending_upward (they see what's brewing) but NOT author identity of others' feedback (anonymity default; preference plumbing later) |
| POST /api/orgs/:orgId/assessments | member+ | 201 {evidence} — manager assessment of a DIRECT/transitive report (403 not_manager otherwise); creates pending_upward |
| GET /api/orgs/:orgId/upward-queue?limit&before | member+ | 200 {items} — pending_upward items where caller is the author's manager (or owner/admin for root authors, R6) |
| POST /api/orgs/:orgId/assessments/:evidenceId/decision | member+ | 201 {state} — body {outcome: yes\|no\|no_signal}; caller must be eligible per R5/R6; 403 not_eligible; 409 already_decided |
### 4.2 Core interface (additions)
- POST /v1/evidence accepts optional `state` (default active; server sends pending_upward for assessments)
- GET /v1/evidence?subjectUserIds=&orgId=&state=&unvalidatedBy=&limit=&before= → filtered listing (server composes queues from this)
- POST /v1/evidence/:id/decide {deciderUserId, outcome} → 200 {state} — transitions pending_upward per R5 semantics; 409 if not pending
### 4.3 Data model
ALTER core.evidence ADD state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','pending_upward','dropped')). Migration 003. Summary queries gain `AND e.state = 'active'`.
### 4.4 Events
None.

## 5. Edge cases & failure modes
Manager assesses non-report → 403 not_manager. Decide twice → 409 already_decided. Decide active/dropped evidence → 409. Author decides own assessment → 403 not_eligible (server) even if owner/admin. Pagination: stable ordering created_at DESC, id tiebreak. Inbox shows pending_upward with state so the individual is never surprised by later activation (transparency to subject; brief: feedback always goes to them).

## 6. Acceptance criteria
- AC1: validation queue shows exactly unvalidated-active-subjective evidence of caller's reports; validating removes it
- AC2: inbox lists own evidence newest-first without author identity; includes own pending_upward with state
- AC3: assessment by non-manager 403; by manager → pending_upward, absent from subject's summary
- AC4: upward yes → active, NOW counted in summary; upward no → dropped, summary identical to before assessment ever existed
- AC5: root-author assessment decidable by owner/admin (not by author) per R6
- AC6: double-decide 409; pagination respects limit+before; migrations idempotent; all suites green

## 7. Out of scope
Anonymity preferences UI (default anonymous now), notification delivery (SPEC-009 nudges), inbox read-state, bulk validation, multi-validator upward consensus.

## 8. Decomposition sketch
H01 (core): migration 003 + state in create + summary filter; H02 (core): evidence listing + decide endpoints; H03 (server): four queue/inbox/assessment endpoints; H04: AC test suites.
