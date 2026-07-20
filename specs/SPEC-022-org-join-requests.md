---
id: SPEC-022
title: Org access requests (new-user join flow)
status: approved
author: spec-architect
signed_off: true
workstreams: [server, web]
---

# SPEC-022: Org access requests (new-user join flow)

## 1. Motivation
A freshly signed-up user with zero memberships hits a dead end: the shell says "Ask an admin to add you" (SPEC-006 auth shell) and nothing is actionable. SPEC-020 invitations solve admin-initiated joining; this spec adds the user-initiated direction, per Orchestrator directive (2026-07-19): *"A new user should be able to request access to a list of organizations. All organizations are eligible (at this time), and a user may request to be added to more than one. This action is a request and an organization admin must approve the request."* Brief grounding: PROJECT_BRIEF "GTM sequencing — individual-first through an aligned org"; the individual signs up first and needs a path to their org.

## 2. Requirements
- R1: An authenticated user can list the org directory — ALL organizations (explicit product decision, revisit at scale), each `{id, name, slug}` plus the caller's relationship: `membership` (their role or null) and `requestStatus` (`pending` | `declined` | null, latest request)
- R2: An authenticated non-member can create a join request for an org. Multiple orgs may be requested concurrently. One PENDING request per (org, user) — duplicate → 409 `already_requested`; existing member → 409 `already_member`; unknown org → 404
- R3: The requester can list their own requests with status ∈ {pending, approved, declined} (org name/slug included)
- R4: Org owner/admin can list that org's PENDING requests (requester id, name, email, createdAt). SPEC-002 R5 semantics: non-admin member → 403 `insufficient_role`, non-member → 404
- R5: Owner/admin approves a pending request → membership created with role `member` (lowest), request marked `approved` (audit: decided_by, decided_at). If the user became a member in the meantime (e.g. via invite): 409 `already_member`, request still marked approved (it is satisfied)
- R6: Owner/admin declines a pending request → status `declined`. The user may request again afterwards (new pending row; declined history retained). Approve/decline on a non-pending or unknown request → 404 `request_not_found`
- R7: Request existence is private to the requester and that org's admins. The directory exposes only org name/slug (+ the caller's OWN relationship) — never member lists, counts, or other requesters
- R8: Web — the zero-org empty state becomes a "Find your organization" panel: directory list, per-org "Request access" action, pending/declined state rendered, copy explaining an admin must approve. Settings gains an admin "Join requests" section (pending list, Approve/Decline)

## 3. Trust invariant check
1–2, 5: N/A (no scoring/signal surfaces). 3–4: no chat or sharing surfaces touched; R7 keeps social graph exposure at zero — a join request is visible only to its two parties (precondition discipline inherited from SPEC-002 R5's 404 semantics, upheld by R4). Directory-for-all is an explicit, documented product decision scoped "at this time" (see §7 for the revisit hook).

## 4. Contracts
### 4.1 API (server)
| Method/Path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| GET /api/orgs/directory | session | — | 200 {orgs:[{id,name,slug,membership:role\|null,requestStatus:'pending'\|'declined'\|null}]} | 401 |
| POST /api/orgs/:orgId/join-requests | session | {} | 201 {request:{id,orgId,status:'pending',createdAt}} | 401; 404 not_found; 409 already_member\|already_requested |
| GET /api/me/join-requests | session | — | 200 {requests:[{id,orgId,orgName,slug,status,createdAt}]} | 401 |
| GET /api/orgs/:orgId/join-requests | owner/admin | — | 200 {requests:[{id,userId,name,email,createdAt}]} (pending only) | 401; 403; 404 |
| POST /api/orgs/:orgId/join-requests/:requestId/approve | owner/admin | — | 200 {membership:{userId,orgId,role:'member'}} | 401; 403; 404 request_not_found; 409 already_member |
| POST /api/orgs/:orgId/join-requests/:requestId/decline | owner/admin | — | 200 {request:{id,status:'declined'}} | 401; 403; 404 request_not_found |

Errors: `{error: string}` as elsewhere. `requestStatus` in the directory reflects the caller's LATEST request for that org (a pending row wins; else most recent).
### 4.2 Core interface
None — server-owned domain.
### 4.3 Data model (server-owned, migration 009_join_requests.sql)
`org_join_requests(id uuid pk default gen_random_uuid(), org_id uuid fk→organizations cascade, user_id uuid fk→users cascade, status text check in ('pending','approved','declined') default 'pending', created_at timestamptz default now(), decided_at timestamptz null, decided_by uuid fk→users null)`; partial unique index on `(org_id, user_id) where status='pending'`.
### 4.4 Events
None.

## 5. Edge cases & failure modes
Duplicate pending request → 409 via partial unique index (no read-then-write race). Approve racing an invitation-acceptance → membership insert hits 23505 → 409 `already_member`, request marked approved. Decline-then-re-request allowed (index only constrains pending). Approve and decline are admin-idempotence-hostile by design: second call → 404 `request_not_found` (row no longer pending). Empty directory (fresh install) → 200 with empty list. Requesting as a member of a DIFFERENT org is fine (multi-org future).

## 6. Acceptance criteria
- AC1: Zero-org user lists the directory (sees name/slug, membership:null), requests access to TWO orgs → both 201; duplicate request → 409 already_requested; own list shows both pending; directory shows requestStatus pending
- AC2: Org admin lists pending requests (sees requester name/email); approve → 200 membership role=member; requester's /api/me now shows the org; admin pending list empties; request visible as approved in requester's own list
- AC3: Decline → requester's list shows declined; re-request afterwards → 201 new pending
- AC4: Authz: non-admin member listing/approving → 403; outsider admin-listing → 404; unauthenticated directory → 401; member requesting own org → 409 already_member; approve on already-decided request → 404
- AC5 (delegated → web suite `web/test/join.test.tsx`): zero-org panel renders directory and fires POST join-request; pending state renders; Settings admin section renders pending list and fires approve/decline
- AC6: Existing member of org A can request org B; approval yields membership in both (multi-org)

## 7. Out of scope
Org-side notification of new requests (rides on future email infra — see SPEC-021 backlog), request messages/notes, rate limiting/anti-spam on requests, directory search/pagination and visibility controls (revisit when org count makes "all orgs" untenable), role selection at approval (always `member`; admins can promote via existing means), auto-approval domains (e.g. matching email domain — natural future enhancement).

## 8. Decomposition sketch
H01 (server): migration 009 + `server/src/joinRequests.ts` + registration; itest AC1–AC4, AC6 green. H02 (web): `web/src/JoinOrgs.tsx` zero-org panel + SettingsView section + `web/test/join.test.tsx` (AC5). H03: integration green + artifacts.

## 9. Integration test design
`itest/tests/spec-022.itest.ts` — black-box via `itest/src/client.ts` helpers (`signupUser`, `orgWithChain`). Covers AC1–AC4, AC6 directly; AC5 delegated by pointer to `web/test/join.test.tsx`. Expected red pre-implementation: 404 on all six routes.
