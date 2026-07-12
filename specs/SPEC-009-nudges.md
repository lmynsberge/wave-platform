---
id: SPEC-009
title: Nudges — signal-gap detection & feedback requests
status: done
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-009: Nudges — signal-gap detection & feedback requests

## 1. Motivation
PROJECT_BRIEF Trust Model: "AI proactively requests interactions to fill 'lack of signal' gaps" and "the system notices signal-starvation and routes around a suppressing manager." This spec is the routing mechanism: gap detection + user-initiated feedback requests. Delivery channels (email/push) and AI-composed asks are out of scope — this is the structural layer they'll ride on.

## 2. Requirements
- R1: Gap feed (self-only): GET nudges returns the caller's attributes below `established` with their live counts and status — a growth invitation, never a deficit report. Only the individual can see their own gaps: any other user's access to someone's nudges is 404 (absence stays private; INVARIANT 5 extended: gaps are the individual's information)
- R2: Suggested recipients per gap: org members EXCLUDING (a) the caller, (b) anyone in the caller's upward chain (INVARIANT 1: managers cannot originate, so suggesting them would invite an invalid act), and (c) existing authors of active evidence on that attribute (diversity: new voices only)
- R3: Feedback requests: caller may create a request (recipient + attributeKey). Invalid recipients per R2(a)(b) → 400 `invalid_recipient`; non-member recipient → 400 `not_member`; duplicate OPEN request for the same (recipient, attribute) → 409 `duplicate_request`
- R4: Asks list (recipient-side, self-only): open requests addressed to the caller, with requester identity (asking is a signed act — no anonymity on requests) and attribute
- R5: Fulfillment is behavioral, not bureaucratic: a request is `fulfilled` when the recipient has authored active evidence on that (subject, attribute) AFTER the request's creation — computed at read time; fulfilled requests leave the asks list and show status `fulfilled` in the requester's outgoing list
- R6: Outgoing list (requester-side): caller's requests with status open|fulfilled

## 3. Trust invariant check
1: R2(b)/R3 make manager-origination structurally unrequestable. 2: N/A (no scores emitted beyond existing summary fields). 5: R1 self-only gap visibility — the org never gains a "who has gaps" surface. 3–4: N/A (no chat data anywhere in these contracts).

## 4. Contracts
### 4.1 Server API
| Method/Path | Auth | Success |
|---|---|---|
| GET /api/orgs/:orgId/nudges | member+ (self) | 200 {gaps:[{attributeKey,status,evidenceCount,distinctAuthors,distinctValidators,suggestedRecipients:[{userId,name}]}]} |
| POST /api/orgs/:orgId/feedback-requests | member+ | 201 {request:{id,recipientId,attributeKey,status:"open"}} / 400 invalid_recipient\|not_member / 409 duplicate_request |
| GET /api/orgs/:orgId/asks | member+ (self) | 200 {asks:[{id,requester:{userId,name},attributeKey,createdAt}]} — open only |
| GET /api/orgs/:orgId/feedback-requests | member+ (self) | 200 {requests:[{id,recipientId,attributeKey,status,createdAt}]} |
### 4.2 Core interface
Unchanged (reads existing summary + evidence listing).
### 4.3 Data model (server, migration 003_requests.sql)
feedback_requests(id uuid pk, org_id fk, requester_id fk, recipient_id fk, attribute_key text, created_at; UNIQUE(org_id, requester_id, recipient_id, attribute_key))
### 4.4 Events
None.

## 5. Edge cases & failure modes
Attribute with zero evidence appears in gaps only if the caller has ANY evidence on other attributes? No — gaps derive from the caller's existing summary rows (attributes they have signal history on) — inviting feedback on never-touched attributes is the AI layer's job later. Requesting on an attribute the recipient already authored → still allowed if not in exclusions? R2 excludes existing authors from SUGGESTIONS; R3 does not forbid requesting them (a second piece from the same author is legal evidence, just not diversity-optimal). Fulfilled-then-new-request: unique constraint is on the row; since status is computed, a fulfilled row blocks re-request of the identical pair — acceptable v1 (§7 notes re-request).

## 6. Acceptance criteria
- AC1: user with below-established attributes sees them in gaps with live counts; suggestedRecipients contains an eligible peer and excludes self, upward-chain members, and an existing author
- AC2: created request appears in recipient's asks (with requester name) and requester's outgoing as open
- AC3: request to self → 400 invalid_recipient; to direct or transitive manager → 400 invalid_recipient; to non-member → 400 not_member; exact duplicate → 409 duplicate_request
- AC4: after the recipient submits feedback on that subject+attribute, the ask disappears from their list and the outgoing row shows fulfilled
- AC5: nudges/asks/outgoing are self-scoped — the routes never accept a target userId; responses are the caller's own
- AC6: anonymous 401 on all four routes

## 7. Out of scope
Delivery channels, AI-composed request messages, re-requesting a fulfilled pair, nudges for never-touched attributes, manager-facing gap views (deliberately impossible per R1), rate limits.

## 8. Decomposition sketch
H01 migration + request store; H02 gaps + suggestions; H03 asks/outgoing + fulfillment; H04 green.

## 9. Integration test design
itest/tests/spec-009.itest.ts pre-implementation via orgWithChain. Contract-only: exclusion rules and fulfillment condition are stated in R2/R5. Expected red reason: 404 on all four routes.
