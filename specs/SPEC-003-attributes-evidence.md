---
id: SPEC-003
title: Attribute taxonomy & evidence model
status: approved
author: spec-architect
signed_off: true
workstreams: [core, server]
---

# SPEC-003: Attribute taxonomy & evidence model

## 1. Motivation
PROJECT_BRIEF V1 Layer 2 ("feedback capture tied to defined attributes; yes/no/no-signal validation primitive") and Trust Model ("manager = validator, not rater"). This is the first spec where trust invariants are enforced in code. Core (Rust) becomes the system of record for attributes, evidence, and validations; server gates and proxies.

## 2. Requirements
- R1: Attribute taxonomy: attributes(key unique, name, kind ∈ {objective, subjective}); seedable; core-owned
- R2: Evidence records: org-scoped, subject user, optional author (null = system-originated), attribute ref, kind matching the attribute, numeric value (objective) or note (subjective)
- R3: Structural rules in core: subjective evidence requires an author and author ≠ subject; objective evidence requires numeric value and null author (system-originated only, per brief "hard metrics self-originate")
- R4: Validations: (evidence_id, validator) unique; outcome ∈ {yes, no, no_signal}; validator ≠ author and ≠ subject; subjective evidence only (objective needs no human validation)
- R5: INVARIANT 1 enforcement — managers cannot originate subjective evidence about anyone in their downward chain. Enforcement point: SERVER (owner of reporting data) rejects with 403 `manager_cannot_originate`. Core enforces all structural rules (R3, R4); provenance recorded so the gate is auditable
- R6: Signal read-model: GET per-user-per-attribute summary {evidenceCount, validations{yes,no,noSignal}, status}. status is ALWAYS `insufficient_signal` in this spec — thresholds arrive in SPEC-004 (INVARIANT 2: nothing surfaces as scored signal before significance)
- R7: Core keeps its own schema `core` in the shared Postgres; migrations via sqlx-style plain SQL runner in Rust (idempotent, `core._migrations`)
- R8: Server proxy endpoints (authz at edge per SPEC-002 semantics): submit feedback, validate feedback, read member attribute summary

## 3. Trust invariant check
1 (validator-not-rater): R5 — enforcement split documented; server gate + core provenance. "no" outcomes are STORED but scoring semantics (SPEC-004) must treat manager `no` as drop-not-negative; recorded here as data only.
2 (significance gating): R6 — status hardcoded `insufficient_signal`; no score exists to leak.
3 (private context): N/A — no chat surfaces; evidence notes are shared-by-construction (author submits knowingly).
4 (sharing indistinguishability): N/A — no sharing surfaces yet.
5 (absence neutral): R6 returns empty summaries as zero-counts with `insufficient_signal`, indistinguishable in shape from low-signal attributes. Upheld.

## 4. Contracts
### 4.1 Server API
| Method/Path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| POST /api/orgs/:orgId/feedback | member+ | {subjectUserId, attributeKey, note} | 201 {evidence} | 400 self_feedback/unknown_attribute/not_member; 401; 403 manager_cannot_originate; 404 |
| POST /api/orgs/:orgId/feedback/:evidenceId/validations | member+ | {outcome: yes\|no\|no_signal} | 201 {validation} | 400 own_evidence/own_subject/duplicate/objective_evidence; 401; 404 |
| GET /api/orgs/:orgId/members/:userId/attributes | member+ | — | 200 {attributes:[{key,name,kind,evidenceCount,validations:{yes,no,noSignal},status:"insufficient_signal"}]} | 401; 404 |
### 4.2 Core interface (internal HTTP, server is sole client)
- POST /v1/attributes {key,name,kind} → 201 | 409 key_taken
- GET /v1/attributes → 200 [{id,key,name,kind}]
- POST /v1/evidence {orgId, subjectUserId, authorUserId|null, attributeKey, valueNumeric|null, note|null} → 201 | 400 codes: unknown_attribute, kind_mismatch, self_evidence, subjective_requires_author, objective_requires_value, objective_requires_system
- POST /v1/evidence/:id/validations {validatorUserId, outcome} → 201 | 400 own_evidence, own_subject, objective_evidence, invalid_outcome | 404 | 409 duplicate_validation
- GET /v1/users/:userId/attributes?orgId= → 200 summary per R6 (all attributes with ≥1 evidence for user+org; plus zero rows omitted)
### 4.3 Data model (core-owned, schema `core`)
core.attributes(id uuid pk default, key text unique, name text, kind text check); core.evidence(id uuid pk, org_id uuid, subject_user_id uuid, author_user_id uuid null, attribute_id fk, kind text check, value_numeric double null, note text null, created_at); core.validations(id uuid pk, evidence_id fk cascade, validator_user_id uuid, outcome text check, created_at, unique(evidence_id, validator_user_id))
### 4.4 Events
None.

## 5. Edge cases & failure modes
Core unreachable from server → 502 core_unreachable (same shape family as SPEC-001). Attribute kind vs payload mismatches → 400 kind_mismatch. Validation of nonexistent evidence → 404. Duplicate validation → 409. Manager-gate uses SPEC-002 chain endpoint logic internally (server-side query, not HTTP self-call).

## 6. Acceptance criteria
- AC1 (core): structural rules R3/R4 each rejected with exact error codes; happy paths 201
- AC2 (core): summary aggregates counts correctly; status always insufficient_signal; user with no evidence → empty list
- AC3 (server): member submits subjective feedback on peer → 201; on self → 400; manager on direct or transitive report → 403 manager_cannot_originate
- AC4 (server): peer validates → 201; author validating own evidence → 400; duplicate → 409; subject validating own → 400
- AC5 (server): attribute summary via proxy matches core shape; non-member → 404
- AC6: core migrations idempotent; all core (cargo) + server (vitest) tests green

## 7. Out of scope
Significance thresholds/scoring (SPEC-004), nudges (SPEC-009), objective-metric ingestion (SPEC-008), UI (SPEC-006), manager validation queue UX (SPEC-005 refines flows).

## 8. Decomposition sketch
H01 (core): schema+migrations+db layer; H02 (core): evidence+validation endpoints w/ rules; H03 (core): summary read-model; H04 (server): proxy + manager gate + tests.

## Amendments
- A2: ENGINEERING.md requires sqlx with compile-time checked queries; compile-time checking needs offline prep not yet configured in agent env. This spec permits sqlx runtime-checked queries (no macros) — debt tracked to re-enable macros when CI gains `sqlx prepare`.
