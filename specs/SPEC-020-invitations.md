---
id: SPEC-020
title: Invitations & org join
status: done
author: spec-architect
signed_off: true
workstreams: [server, web]
---

# SPEC-020: Invitations & org join

## 1. Motivation
Membership currently requires an owner knowing a userId (seed-era ergonomics). A real org needs: admin invites by email → invitee follows a link → signs up or logs in → joins with the intended role. Email DELIVERY is out of scope (no email infra yet); the invite link is copyable from Settings — honest for demo/design-partner scale.

## 2. Requirements
- R1: Owner/admin creates an invitation {email, role: member|admin} → server stores {token (random 32 hex), expires 7 days} and returns it (incl. token → the shareable link `/invite/<token>`). Re-inviting the same email replaces the pending invitation (new token, new expiry)
- R2: Owner/admin lists PENDING invitations (email, role, token, expiresAt); accepted ones drop off. Non-admin member → 403; non-member → 404 (SPEC-002 semantics)
- R3: Public invite inspection: GET /api/invites/:token → {orgName, email, role} for a valid pending unexpired token; 404 for invalid/expired/accepted (indistinguishable — token status is not probeable)
- R4: Accept (authenticated): POST /api/invites/:token/accept → creates the membership with the invite's role and marks accepted. The authenticated user's email MUST equal the invite email (403 email_mismatch — a forwarded link is not a transferable credential). Already a member → 409 already_member (invite marked accepted). Invalid/expired → 404
- R5: Web: Settings gains an admin "Invite teammates" section (email + role → shows the copyable link; pending list). The SPA serves an accept screen at `/invite/<token>`: shows org + role; if unauthenticated, offers login/signup inline; accept joins and lands in the org
- R6: Invitation existence is org-private: only that org's admins see pending invites; the public endpoint reveals nothing without the exact token

## 3. Trust invariant check
No scoring/visibility surfaces. R4 email-binding prevents role-escalation-by-forward. R3/R6: token unguessable (128-bit), statuses indistinguishable.

## 4. Contracts
### Server (migration 008: org_invitations(id, org_id fk, email, role check, token unique, created_by fk, expires_at, accepted_at null))
- POST /api/orgs/:orgId/invitations {email, role} → 201 {invitation:{id,email,role,token,expiresAt}} | 400 | 401 | 403 | 404
- GET /api/orgs/:orgId/invitations → 200 {invitations:[…pending]} | 401 | 403 | 404
- GET /api/invites/:token → 200 {orgName,email,role} | 404
- POST /api/invites/:token/accept (auth) → 201 {orgId, role} | 401 | 403 email_mismatch | 404 | 409 already_member
### Web
SettingsView invite section (admin); InviteAccept screen on pathname /invite/<token>.

## 5. Edge cases & failure modes
Invitee already signed up with the email → login path then accept. Expired-then-reinvited: old token 404s, new works. Case-insensitive email comparison. Accepting twice → first 201, second 404 (accepted = gone from R3's world).

## 6. Acceptance criteria
- AC1 (itest): admin invites → invitee signs up with that email → public GET shows org/role → accept → member (verified via members list + role); pending list empties
- AC2 (itest): member creating invite → 403; outsider → 404; duplicate email re-invite replaces (old token 404)
- AC3 (itest): wrong-email authed user accepts → 403 email_mismatch; expired token → 404; already-member accept → 409
- AC4 (itest): unauthenticated accept → 401; public GET with garbage token → 404
- AC5 (web suite): invite form POSTs {email, role} and renders the /invite/<token> link; accept screen renders org info and fires accept
- AC6: email comparison case-insensitive (itest: invite Mixed@Case, signup lowercase)

## 7. Out of scope
Email delivery (SMTP/SendGrid — backlog), invite revocation UI (re-invite replaces; explicit revoke later), bulk invites, invite-to-multiple-orgs.

## 8. Decomposition sketch
H01 migration + endpoints (itest-red); H02 web invite section + accept screen (suite-red); H03 green + artifacts.

## 9. Integration test design
itest/tests/spec-020.itest.ts pre-implementation via helpers. Expiry tested via a 404 on a token the test ages by direct… NO — black-box: cannot age tokens without DB access; expiry AC covered by the replaced-token path (old token 404 after re-invite) + unit test for the expiry predicate (recorded delegation). Expected red: 404 on all four routes.
