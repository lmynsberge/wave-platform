---
id: SPEC-002
title: Identity & tenancy
status: done
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-002: Identity & tenancy

## 1. Motivation
PROJECT_BRIEF V1 Layer 1 ("SSO + org chart sync — reporting lines drive the validation chain"). Full SSO deferred; this spec delivers first-party auth, multi-tenant orgs, RBAC at the edge, and reporting-line storage + chain query that SPEC-003/005 validation chains will consume. Prototype grounding: wave-preview multi-tenant model per docs/PROTOTYPE_LEARNINGS.md "Keep".

## 2. Requirements
- R1: Email/password signup, login, logout with server-side sessions (opaque token per login, hashed at rest, httpOnly cookie `wave_session`, 7-day expiry)
- R2: Passwords hashed with scrypt (node:crypto), unique salt per user
- R3: Organizations with unique slug; creator becomes `owner`
- R4: Memberships with role ∈ {owner, admin, manager, member}; one membership per (user, org)
- R5: RBAC enforced at the edge; non-members receive 404 (not 403) for org resources to avoid org-existence leakage; members with insufficient role receive 403 `insufficient_role`
- R6: Reporting edges (org-scoped): each user ≤1 manager within an org; no self-management; cycle-free (walk-up check on write)
- R7: Manager-chain query returns the upward chain (bottom-up, excluding self) for a user within an org
- R8: Migrations: plain SQL files in `server/migrations/`, applied by an idempotent node runner (`npm run migrate`) tracking applied files in `_migrations`

## 3. Trust invariant check
Invariants 1–5: N/A (no scoring, chat, or sharing surfaces). R5's 404-for-non-members prevents cross-org information leakage — a precondition for invariants 3–4 in later specs.

## 4. Contracts
### 4.1 API (server)
| Method/Path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| POST /api/auth/signup | none | {email, password≥8, name} | 201 {user} +cookie | 400; 409 email_taken |
| POST /api/auth/login | none | {email, password} | 200 {user} +cookie | 401 bad_credentials |
| POST /api/auth/logout | session | — | 204 +cookie cleared | 401 |
| GET /api/me | session | — | 200 {user, memberships:[{orgId,slug,name,role}]} | 401 |
| POST /api/orgs | session | {name, slug} | 201 {org} creator=owner | 400; 409 slug_taken |
| GET /api/orgs/:orgId/members | member+ | — | 200 {members:[{userId,name,email,role}]} | 401; 404 |
| POST /api/orgs/:orgId/members | owner/admin | {userId, role} | 201 {membership} | 400; 401; 403; 404; 409 |
| PUT /api/orgs/:orgId/reporting | owner/admin | {userId, managerId\|null} | 200 {userId, managerId} | 400 self_edge/cycle_detected/not_member; 401; 403; 404 |
| GET /api/orgs/:orgId/reporting/:userId/chain | member+ | — | 200 {chain:[uuid,...]} | 401; 404 |

user shape: {id, email, name}. Errors: {error: string}. IDs UUIDv4 this spec.
### 4.2 Core interface
None — server-owned domain.
### 4.3 Data model (server-owned)
users(id uuid pk, email citext unique, name text, password_hash text, password_salt text, created_at); sessions(id uuid pk, user_id fk cascade, token_hash text unique, expires_at, created_at); organizations(id uuid pk, name text, slug text unique, created_at); memberships(user_id fk, org_id fk, role check, created_at, pk(user_id,org_id)); reporting_edges(org_id fk, user_id fk, manager_id fk, updated_at, pk(org_id,user_id), check user_id<>manager_id)
### 4.4 Events
None.

## 5. Edge cases & failure modes
Duplicate email/slug → 409 (citext for email). Expired/unknown session → 401, expired rows lazily deleted. Cycle attempt → 400 cycle_detected; walk bounded 100 hops → 400 chain_too_deep. Cross-org probing → 404 (R5). managerId=null clears edge.

## 6. Acceptance criteria
- AC1: signup → me → logout → me(401) → login → me lifecycle passes
- AC2: wrong password 401; duplicate email 409; short password 400
- AC3: creator=owner; owner adds member; member lists members; non-member gets 404
- AC4: member role POSTing members → 403 insufficient_role
- AC5: A→B, B→C ⇒ chain(A)=[B,C]; self-edge 400; cycle 400; null clears
- AC6: `npm run migrate` idempotent; all tests pass against real Postgres

## 7. Out of scope
SSO/OIDC, invitations/email, password reset, org settings, rate limiting, core read-path to identity (SPEC-003+).

## 8. Decomposition sketch
H01 migrations+db+runner; H02 auth+sessions; H03 orgs+memberships+RBAC; H04 reporting+chain.

## Amendments
- A1: ENGINEERING.md "drizzle or knex" amended to also permit plain SQL + node runner (zero-magic, reviewable SQL). Updated in this branch.
