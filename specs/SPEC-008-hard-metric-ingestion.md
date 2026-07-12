---
id: SPEC-008
title: Hard-metric ingestion & within-org normalization
status: done
author: spec-architect
signed_off: true
workstreams: [core, server]
---

# SPEC-008: Hard-metric ingestion & within-org normalization

## 1. Motivation
PROJECT_BRIEF V1 Layer 1 ("hard-metric ingestion from at least one system of record — the objective-data spine") and the brief's origination logic ("hard metrics self-originate from systems"). Also begins normalization: "rating an employee as 100/500 for billable hours is objective and lets us normalize" — WITHIN-org percentile first; cross-org is post-v1. Prototype grounding: wave-preview's Culture Amp bulk import (PROTOTYPE_LEARNINGS "Keep": HRIS ingestion path).

## 2. Requirements
- R1: Batch ingestion endpoint (server, owner/admin only): submit `{source, period, metrics:[{email, attributeKey, value}]}`. Server resolves emails to org members and writes objective evidence to core with `authorUserId: null` (system origination, SPEC-003 R3)
- R2: Partial success: unknown emails and non-member emails are SKIPPED and reported back `{ingested: n, skipped: [{email, reason}]}` — one bad row never fails a batch
- R3: Idempotent re-ingestion: evidence gains `source` + `period` metadata (core migration 004); re-submitting the same (org, subject, attribute, source, period) UPDATES the value in place — evidenceCount is stable across re-runs (corrections are normal in payroll/billing exports)
- R4: Within-org normalization: attribute summaries gain `normalizedScore` — the user's percentile rank (0–100) among org members whose status on that attribute is `established`, computed from mean values. Null below established (INVARIANT 2). Percentile = share of established peers with a strictly lower mean, ×100, rounded
- R5: Absence stays neutral (INVARIANT 5): members without the metric are simply absent from the cohort — never ranked, never penalized, and their own summaries carry no marker
- R6: Subjective attributes are rejected by ingestion with per-row skip reason `subjective_attribute` (systems cannot originate judgment)

## 3. Trust invariant check
1: system origination preserved (null author enforced by core R3 rules; ingestion never writes subjective — R6). 2: normalizedScore null below established (R4). 5: R5 cohort-absence semantics. 3–4: N/A (no chat/share surfaces).

## 4. Contracts
### 4.1 Server API
POST /api/orgs/:orgId/ingest/metrics — owner/admin; body {source: string, period: string, metrics:[{email, attributeKey, value:number}]} → 200 {ingested:number, skipped:[{email, reason:"unknown_user"|"subjective_attribute"|"unknown_attribute"}]}; 400 invalid_body; 401; 403 insufficient_role; 404 non-member
### 4.2 Core interface (additions)
- POST /v1/evidence accepts optional `source`, `period` (both or neither); with them, write is an UPSERT on (org, subject, attribute, source, period)
- Summary response gains `normalizedScore: number|null`
### 4.3 Data model
Migration 004: ALTER core.evidence ADD source text, ADD period text; UNIQUE INDEX evidence_metric_key ON (org_id, subject_user_id, attribute_id, source, period) WHERE source IS NOT NULL
### 4.4 Events
None.

## 5. Edge cases & failure modes
Duplicate email rows within one batch: last row wins (upsert). Value updates change the mean → normalization reflects it on next read. Single established user → their percentile is 0 (no peers below; document, don't special-case). Mixed valid/invalid rows → R2 partial semantics.

## 6. Acceptance criteria
- AC1: admin ingests a batch → objective evidence lands (summary reflects values); member → 403; non-member → 404; anonymous → 401
- AC2: batch with unknown email + subjective attributeKey → those rows in `skipped` with reasons, valid rows ingested
- AC3: re-ingesting the same source+period with corrected values → evidenceCount unchanged, mean/score updated
- AC4: three users established on one metric → normalizedScore ordering matches value ordering (0/33/67-style ranks per R4 formula); a user still `emerging` has normalizedScore null
- AC5: a member with no metric rows has no entry for the attribute and other users' ranks are computed over the established cohort only
- AC6: ingestion rejects non-numeric values per-row via body validation (400 invalid_body for malformed batch shape)

## 7. Out of scope
Cross-org normalization, cohort segmentation (role/seniority), CSV/file upload UI, scheduled connector pulls, source adapters (Culture Amp etc. — this is the generic gateway they'll feed).

## 8. Decomposition sketch
H01 (core): migration 004 + upsert path; H02 (core): percentile in summary; H03 (server): ingestion endpoint; H04: green.

## 9. Integration test design
itest/tests/spec-008.itest.ts, pre-implementation. Fixtures via orgWithChain helper (A2). Contract-only: percentile formula stated in R4 so ranks are assertable. Red-for-the-right-reason expected: 404 on /ingest/metrics route, normalizedScore absent from summaries.
