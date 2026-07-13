---
id: SPEC-020-review
subject: SPEC-020
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-020 (Invitations)

## Verdict
`approved`

## Findings
1. (verified, A2) RED: 3/3, 404s on all invitation routes. Recorded. Honest §9 catch during authoring: black-box tests cannot age tokens, so expiry is covered by the replacement path + a delegated unit predicate test — better than sneaking DB access into a locked file.
2. (major, resolved in draft) R4 email-binding: a forwarded invite link grants nothing — the token is an invitation, not a bearer credential. Combined with accepted/expired/invalid all being one 404 (R3), the token surface is unprobeable.
3. (minor) Email delivery honestly out of scope; the copyable link matches how demo-scale orgs actually onboard.
4. (minor) Re-invite-replaces avoids a revocation UI now; explicit revoke stays backlog.

## Checklist results
- [x] Red verified, recorded; helper fixtures; delegation noted (expiry predicate)
- [x] No invariant surfaces; escalation-by-forward closed
