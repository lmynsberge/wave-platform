---
id: SPEC-023-review
subject: SPEC-023
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-023 (Account merge tool)

## Verdict
`approved`

## Findings
1. blocking→resolved in draft — Ownership boundary: an early sketch had the script writing core tables directly. Resolved: R2/R4 split — script touches ONLY server-owned tables; core-owned rows move only through core's own transactional endpoint. ARCHITECTURE's one-owner rule holds for data writes, not just migrations.
2. major→resolved — Partial-failure story: R7 fixes the order (idempotent core call first, server tx second, tombstone last) so a crash at any point is repaired by re-running. The tombstone is deliberately the LAST write because it powers the R6 guard.
3. minor — Invariant-1 subtlety verified: repair (d) deletes validations that became validator==author/subject; manager-chain 'no' rows keep `validator_relationship`, so drop-not-negative scoring is unaffected by reassignment. Merging cannot mint self-signal (repairs b/d) nor double-count metrics (repair a).
4. minor — Reporting-chain cycles across merged identities are NOT detected (spec §5) — deferred as a future issue; the DB check only blocks self-edges, which the script drops. Acceptable: admins can repair chains via the existing reporting API.
5. minor — Red-quality: the AC5 test initially passed vacuously pre-implementation (any spawn failure satisfied `toThrow`); hardened PRE-LOCK to assert refusal text from stderr. Re-verified red: both tests now fail on the missing script (right reason).
6. nit — AC6 (workflow) is not machine-testable in the harness; delegated to reviewer inspection at H03. Recorded.

## Checklist results
- [x] Requirements grounded (Orchestrator directive 2026-07-19; PROJECT_BRIEF longitudinal profile)
- [x] Trust invariants §3: all five addressed explicitly, incl. why chat re-parenting stays inside invariant 3
- [x] Contracts: core endpoint fully typed (§4.2); migration §4.3; no product HTTP surface by design (§4.1 rationale)
- [x] Deferred questions enumerated (§7) as future issues per Orchestrator instruction
- [x] Itest design: CLI-as-public-interface justified; red verified for the right reason (missing tool, 2/2)
- [x] Decomposition small (core / script / action+green)
