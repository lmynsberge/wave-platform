---
id: SPEC-007
title: Segmented chat companion (API)
status: approved
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-007: Segmented chat companion (API)

## 1. Motivation
PROJECT_BRIEF V1 Layer 3 ("segmented chatbot: private growth companion + the sharing boundary") and Trust Model ("segmented memory so private context doesn't bleed"; "they can have a conversation on it and choose to share the result"). Prototype grounding: journaling repo's guided interview → synthesis loop (docs/PROTOTYPE_LEARNINGS.md). First spec where INVARIANTS 3 and 4 are actively enforced. API only; companion UI is a later spec.

## 2. Requirements
- R1: Private segments: each (user, org) gets a `growth` segment on first access; messages persist in order. Access is STRICTLY owner-only: any other user — including managers, admins, owners — receives 404 (never 403: existence is private too)
- R2: Guided interview engine (deterministic v1, journaling DNA): companion opens with question 1 of a fixed 7-question reflection sequence; each user message advances to the next question; after the 7th answer the companion produces a SYNTHESIS message weaving the user's answers; the cycle then restarts on the next message
- R3: Share-forward: the user may share any message from their own segment; sharing COPIES content into a share record at share time (later conversation never mutates a share). Shares are visible to exactly: the individual and users in their upward reporting chain
- R4: INVARIANT 4 surface: share listings contain only shared items — no counts, timestamps-of-private-activity, "has unshared content" flags, or any field from which non-shared existence can be inferred. Empty share list is byte-identical for a heavy private user and a never-used user
- R5: Provider abstraction: companion replies come from a `CompanionProvider` interface; v1 ships the deterministic `guided` provider (env `COMPANION_PROVIDER`, default `guided`); LLM providers plug in later without contract change

## 3. Trust invariant check
3 (private isolation): R1 owner-only-404 + no org-facing endpoint touches segment tables. 4 (indistinguishability): R4 — asserted black-box by comparing responses for active-private vs never-used users. 1, 2, 5: N/A (no scoring surfaces; shares are narrative artifacts, not evidence — feeding shares into evidence is explicitly out of scope).

## 4. Contracts
### 4.1 Server API
| Method/Path | Auth | Success | Errors |
|---|---|---|---|
| GET /api/orgs/:orgId/companion | member+ (self only) | 200 {segmentId, messages:[{id,role:"user"\|"companion",content,seq}]} — creates segment + opening question on first call | 401; 404 non-member |
| POST /api/orgs/:orgId/companion/messages | member+ (self only) | 201 {reply:{id,role:"companion",content,seq}} | 400 empty; 401; 404 |
| POST /api/orgs/:orgId/companion/share | member+ (self only) | 201 {share:{id,content,createdAt}} — body {messageId} must be a message in caller's own segment | 400 unknown_message; 401; 404 |
| GET /api/orgs/:orgId/members/:userId/shares | self OR user in :userId's upward chain | 200 {shares:[{id,content,createdAt}]} | 401; 404 all others (incl. admins not in chain) |
### 4.2 Core interface
Unchanged — core never sees chat data (ARCHITECTURE hard boundary).
### 4.3 Data model (server-owned, migration 002_chat.sql)
chat_segments(id uuid pk, user_id fk, org_id fk, kind text default 'growth', created_at, unique(user_id, org_id, kind)); chat_messages(id uuid pk, segment_id fk cascade, role text check(user|companion), content text, seq bigint, unique(segment_id, seq)); reflection_shares(id uuid pk, org_id fk, user_id fk, content text, created_at)
### 4.4 The 7 questions (guided provider, from journaling approach)
1 mood/energy, 2 open reflection, 3 what shipped, 4 what was learned, 5 what was hard, 6 team/people, 7 process change. Synthesis = titled sections quoting the user's own words.

## 5. Edge cases & failure modes
Sharing a companion message: allowed (synthesis is the primary share target). Sharing another user's messageId → 400 unknown_message (not 404 — the request shape is wrong, nothing about existence is revealed beyond "not yours/not real", which are deliberately indistinguishable). Concurrent messages: seq assigned server-side (max+1 per segment in one statement). Admin reading someone's shares while outside their chain → 404.

## 6. Acceptance criteria
- AC1: first GET creates segment with companion opening question; second GET returns same segment; another member (incl. org owner) probing the same routes for the user gets only their OWN segment — segments never cross users
- AC2: 7 user messages receive questions 2..7 then a synthesis containing fragments of the user's answers; message 8 restarts the cycle
- AC3: before sharing, the user's manager sees an empty share list; after sharing a synthesis, the manager sees exactly that content; a transitive manager (chain) also sees it; an admin OUTSIDE the chain gets 404
- AC4: shares are copies — subsequent conversation leaves prior share content unchanged
- AC5: INVARIANT 4 byte-parity — manager's view of a never-used user's shares is byte-identical to their view of a heavy-private-user-who-shared-nothing
- AC6: empty message 400; sharing a foreign/unknown messageId 400; unauthenticated 401 on all routes

## 7. Out of scope
Companion UI, LLM providers, share revocation, shares-as-evidence, segment kinds beyond `growth`, message editing/deletion, pagination (bounded by interview cadence at v1).

## 8. Decomposition sketch
H01: migration + segment/message store + guided provider; H02: companion endpoints; H03: share-forward + chain-visibility; H04: turn itest green + unit tests.

## 9. Integration test design
`itest/tests/spec-007.itest.ts` — written BEFORE implementation (this spec), all ACs directly black-box testable (no web delegation). Design decisions embodied in the tests: cookie-per-user clients, chain built via SPEC-002 reporting, byte-parity via JSON.stringify comparison of full response bodies. MUST run red against current main at spec-review time.
