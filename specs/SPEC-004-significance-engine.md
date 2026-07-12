---
id: SPEC-004
title: Significance engine
status: done
author: spec-architect
signed_off: true
workstreams: [core, server]
---

# SPEC-004: Significance engine

## 1. Motivation
PROJECT_BRIEF "Statistical significance as gatekeeper": subjective attributes require a significant volume of DIVERSE feedback before becoming signal; high threshold is intentional. Also Trust Model "manager non-validation = drop, never a negative" — SPEC-003 review finding 3 requires this spec to define manager-`no` handling citing invariant 1.

## 2. Requirements
- R1: Signal states per (user, org, attribute): `insufficient_signal` → `emerging` → `established`, computed at read time from evidence + validations (no materialization yet)
- R2: Subjective thresholds (defaults, env-overridable later): emerging at evidenceCount ≥ 5 AND distinctAuthors ≥ 3; established additionally requires distinctValidators ≥ 5. Diversity of originators is REQUIRED, not just volume (anti-farming per brief)
- R3: Objective thresholds: emerging at ≥1 datapoint; established at ≥3 datapoints (systems are trusted originators; diversity N/A)
- R4: Scores surface ONLY at `established` (INVARIANT 2); otherwise score is null. Subjective score = yes / (yes + counted_no), scaled 0–100. Objective score = mean(value_numeric) (normalization is SPEC-008+)
- R5: INVARIANT 1 — drop-not-negative: validations carry `validator_relationship` ∈ {peer, manager_chain}, recorded by SERVER at validation time (it owns reporting data). Manager-chain `no` outcomes are EXCLUDED from counted_no (dropped); manager-chain `yes` counts normally (managers validate, never negate). Peer `no` counts (disagreement between peers is data)
- R6: Migration 002 adds validations.validator_relationship (not null, default 'peer' for pre-existing rows); server computes isManagerOf(validator, subject) at validation write
- R7: Summary endpoint (SPEC-003 §4.2) gains: status per R1–R3, score per R4, distinctAuthors, distinctValidators. Shape parity preserved: zero-evidence attributes simply absent (INVARIANT 5: absence neutral — no negative marker exists)
- R8: GET /v1/signal-policy returns the active thresholds (transparency; UI will show "what it takes")

## 3. Trust invariant check
1: R5 drop-not-negative implemented mechanically; manager `no` cannot lower a score. 2: R4 null-below-established. 3–4: N/A (no new sharing/chat surfaces). 5: R7 absence handling — no row is not a penalty; states never go below insufficient_signal.

## 4. Contracts
### 4.1 Server API
Validation POST (SPEC-003) unchanged externally; server now computes and forwards validatorRelationship. Summary response gains fields per R7 (backward-compatible additive).
### 4.2 Core interface
- POST /v1/evidence/:id/validations body gains required `validatorRelationship`: "peer"|"manager_chain" → 400 `invalid_relationship` otherwise
- GET /v1/users/:userId/attributes?orgId= → attributes[]: {key,name,kind,evidenceCount,distinctAuthors,validations{yes,no,noSignal},distinctValidators,status,score:number|null}
- GET /v1/evidence/:id → 200 {id, orgId, subjectUserId, authorUserId, kind} | 404 (ISS-004 / A1: server-internal read to compute validator relationship)
- GET /v1/signal-policy → 200 {subjective:{emerging:{minEvidence:5,minAuthors:3},established:{minValidators:5}},objective:{emerging:{minDatapoints:1},established:{minDatapoints:3}}}
### 4.3 Data model
ALTER core.validations ADD validator_relationship text NOT NULL DEFAULT 'peer' CHECK IN ('peer','manager_chain'). Migration 002.
### 4.4 Events
None.

## 5. Edge cases & failure modes
established with yes=0 and counted_no=0 (all validations no_signal or dropped manager-no) → score null even at established (division guard; status still established? NO — redefine: established ALSO requires (yes+counted_no) ≥ 1; else remains emerging). All-manager-no attribute: their `no`s dropped → does not count toward distinctValidators? They DO count toward distinctValidators (participation) but not toward score. Objective mean with 1–2 points → emerging, score null.

## 6. Acceptance criteria
- AC1: threshold transitions: 4 evidence/3 authors → insufficient; 5/3 → emerging; +5 distinct validators with ≥1 yes/no → established with score
- AC2: diversity gate: 6 evidence from 2 authors → insufficient_signal (volume without diversity fails)
- AC3: drop-not-negative: peer yes=3, manager_chain no=2 → counted_no=0, score=100; peer no=1 added → score=75
- AC4: objective: 1 datapoint emerging/null; 3 datapoints established with mean score
- AC5: signal-policy endpoint returns active thresholds
- AC6: server forwards validatorRelationship=manager_chain when validator is in subject's upward chain (asserted via fake core capture); migrations idempotent; all suites green

## 7. Out of scope
Cross-org normalization, cohort normalization, materialized signal state, threshold admin UI, collusion detection (roadmap: post-v1), scoring weights/composites.

## 8. Decomposition sketch
H01 (core): migration 002 + relationship in validation write; H02 (core): significance computation in summary + policy endpoint; H03 (server): relationship computation + forward; H04: cross-suite AC tests.

## Amendments
- A1 (via ISS-004): added GET /v1/evidence/:id to core contract so the server can compute validator relationship without spoofable client input. Fast-track re-reviewed: approved.
