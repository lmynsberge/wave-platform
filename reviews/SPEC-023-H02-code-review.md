---
id: SPEC-023-H02-code-review
subject: SPEC-023-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-023-H02

## Verdict
`approved`

## Findings
1. major→fixed pre-merge — Two statements passed unused bind params (Postgres rejects the count mismatch): feedback self-request drop and join-request mooting. Caught before the first run; params tightened.
2. minor — R7 ordering implemented as specified: core HTTP call precedes the server transaction; tombstone is the final write inside it. The failure message on rollback explicitly says core already merged and to re-run — good operator ergonomics.
3. minor — Chat append shifts seq by INTO's max inside one UPDATE; unique (segment_id, seq) holds row-by-row since all new seqs exceed the existing max. Order preserved.
4. minor — `org_join_requests` handled via to_regclass so the script works on databases with or without SPEC-022 (merge-order independence), including mooting now-satisfied pending requests.
5. nit — pg is resolved from server/node_modules via createRequire; documented in the header. The Action's `npm ci` in server/ satisfies it.

## Checklist results
- [x] Conforms to handoff/spec R1, R4–R7; ownership boundary held (server tables only; core via endpoint)
- [x] R6 guards: not-found / already-merged / same-user all die() with matching stderr text (locked AC5 asserts them)
- [x] Dry-run is read-only and skips core (stated in output)
- [x] Locked itest 2/2 green; full itest 60/60; server 29/29; no locked-file diffs post-red commit
