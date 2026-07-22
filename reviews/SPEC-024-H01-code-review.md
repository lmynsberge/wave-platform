---
id: SPEC-024-H01-code-review
subject: SPEC-024-H01
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-024-H01

## Verdict
`approved`

## Findings
1. major→verified-ok — Guard placement: `registerDemoGuard` is registered BEFORE all route registrations in `buildApp`, and fastify preHandler hooks run before every handler regardless — a future route cannot bypass it (R4's structural intent holds). Allowlist matches the spec's four escape hatches exactly; querystrings stripped before compare.
2. minor — `currentUser` refactored onto `currentSession` (one query for session, one for user) instead of the previous single join; +1 query per authed request. Acceptable; it buys the persona swap and the R6 fallback in one obvious place.
3. minor — Bearer-authed routes (bridge/outbound/dispatch) carry no cookie → `currentSession` returns null → guard is a no-op, as analyzed in spec §5.
4. nit — `/api/me` strips the demo marker from the user object and hoists it top-level, matching the amended contract.

## Checklist results
- [x] Conforms to handoff + spec §4.1 (three routes, me amendment, migration 011)
- [x] Authz: enter/exit session-gated; availability probe intentionally public (R2)
- [x] Trust: R4 verified against the full route table — no non-GET /api route escapes except the enumerated four
- [x] Locked itest spec-024 green; full suite 64/64; server units 29/29
- [x] Lint clean; no scope creep; no locked-file diffs
