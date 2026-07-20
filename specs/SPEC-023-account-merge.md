---
id: SPEC-023
title: Account merge tool (wave-internal)
status: approved
author: spec-architect
signed_off: true
workstreams: [core, server]
---

# SPEC-023: Account merge tool (wave-internal)

## 1. Motivation
Orchestrator directive (2026-07-19): *"A new user might not actually be new and we might want to merge this account with a pre-existing one. This can only be done by admins at wave (not organization admins, internal to our company admins). For now, make a tool that can merge accounts that combines and reprocesses. Any questions on this spec can be deferred to enhancements around this spec as future issues."* Brief grounding: the portable, longitudinal profile (PROJECT_BRIEF "The Org-Agnostic Rating" — built across time) makes duplicate accounts data-destroying; signal split across two identities under-reports both. Form (Orchestrator-selected): an operator CLI script invokable from a GitHub Action — deliberately NOT an HTTP surface with a new platform-admin auth concept.

## 2. Requirements
- R1: A CLI `scripts/merge-accounts.mjs --from <email|uuid> --into <email|uuid> [--dry-run]` (env: `DATABASE_URL`, `CORE_URL`) merges the FROM account into the INTO account. Wave-internal by construction: it requires direct DB + internal-core access, which no product surface has
- R2: Core owns evidence/validation reassignment via internal `POST /v1/admin/merge-users {fromUserId, intoUserId}`. "Reprocess" = reassignment + invariant repair; scores/signal recompute at read time (ARCHITECTURE: read-time computation), so no materialized state needs rebuilding
- R3: Core invariant repair, in-transaction, deterministic:
  (a) metric-identity collisions (same org/attribute/source/period on both accounts) → keep INTO's row, drop FROM's (a system of record reports one truth per person-period);
  (b) evidence that would become self-evidence (author = subject after merge) → state `dropped` (audit-preserving; excluded from every read like any dropped row);
  (c) validation collisions (both accounts validated the same evidence) → keep INTO's row;
  (d) validations that become structurally invalid after merge (validator = evidence author or subject — SPEC-003 R4 own_evidence/own_subject) → deleted.
  Endpoint returns per-repair counts and is idempotent (re-run affects 0 rows)
- R4: Server-side merge (script, single transaction): memberships (collision → keep the HIGHER role, order owner>admin>manager>member); reporting edges (user side: INTO's edge wins on collision; manager side reassigned; would-be self-edges dropped); chat segments (collision per (org, kind): FROM's messages append after INTO's max seq, preserving order, then FROM's segment is deleted); reflection_shares, feedback_requests (collision → keep INTO's; post-merge self-requests dropped), bridge link codes/bindings/ask-context/nudge-log/notification-prefs (keyed collisions → keep INTO's), invitation created_by, join requests if the table exists (SPEC-022 may merge in either order)
- R5: FROM account is tombstoned, never deleted: `users.merged_into` (migration `010_account_merge.sql`) set to INTO's id; email rewritten to `merged-<id>@merged.wave.invalid` (frees the address); all FROM sessions deleted. FROM can no longer log in; INTO's credentials are untouched
- R6: Safety: refuse to merge an account into itself, a nonexistent account, or an already-merged account (either side). `--dry-run` prints would-be counts and changes nothing
- R7: Failure-ordering: core merge runs FIRST, then the server transaction (which ends with the tombstone). Every step is idempotent, so a partial failure is repaired by re-running the script; only the final tombstone flips the R6 already-merged guard
- R8: A `workflow_dispatch` GitHub Action (`merge-accounts.yml`, inputs: from, into, dry_run) runs the script using WIF auth (existing `GCP_WIF_PROVIDER`/`GCP_CI_SA` secrets) + Cloud SQL Auth Proxy for the DB. Core reachability from the runner uses the documented demo-env ingress toggle for now; the production-grade path (Cloud Run Job) is a filed future issue

## 3. Trust invariant check
1: repairs (b)/(d) exist precisely so a merge can never mint self-originated or self-validated signal; a manager's chain-'no' rows keep their relationship label, so drop-not-negative accounting is unchanged. 2: merged evidence feeds the same read-time significance engine; merging can only move an attribute TOWARD thresholds with legitimately-earned rows — collision policy (a) prevents double-counting the same system datapoint. 3: chat merge is a re-parent of the individual's OWN private segments; content never crosses users or leaves owner-gated routes. 4: no org-facing surface changes; shares merge as owned rows. 5: tombstoning (not deleting) keeps absence semantics intact — nothing about the merged person reads as negative.

## 4. Contracts
### 4.1 API (server)
None — no product HTTP surface (R1 rationale). The tool's public interface is the CLI itself.
### 4.2 Core service interface (Rust)
`POST /v1/admin/merge-users` body `{fromUserId: uuid, intoUserId: uuid}` → 200 `{evidenceSubjectsReassigned, evidenceAuthorsReassigned, metricConflictsDropped, selfEvidenceDropped, validationsReassigned, duplicateValidationsDropped, invalidValidationsDropped}` (all ints); 400 `same_user` | `invalid_body`. Internal-only like every core route (never publicly routable, SPEC-016 ingress).
### 4.3 Data model
Server migration `010_account_merge.sql`: `ALTER TABLE users ADD COLUMN merged_into uuid REFERENCES users(id);`. No core schema change. Ownership boundary respected: the script writes ONLY server-owned tables; core-owned tables change ONLY via core's endpoint.
### 4.4 Events
None.

## 5. Edge cases & failure modes
FROM has no data → merge is a cheap tombstone. Both accounts in the same org with different roles → higher role survives. FROM manages someone who is INTO's manager → manager-side reassign could form a cycle: out of scope to detect here (admins fix chains via existing reporting API; noted future issue — the check constraint only blocks self-edges, which ARE dropped). Chat append preserves relative order via seq offset. Script crash mid-server-tx → transaction rolls back; re-run (R7). Core call succeeded but server tx failed → re-run; core statements affect 0 rows. Emails are citext: `--from`/`--into` lookups are case-insensitive.

## 6. Acceptance criteria
- AC1: Merging combines memberships (union; higher role wins on collision) — INTO logs in and sees both orgs; FROM's credentials stop working (session killed + email freed)
- AC2: Evidence combines: an attribute with rows split across both accounts reports the combined evidenceCount on INTO's profile after merge (read-time reprocessing)
- AC3: Invariant repair: a validation FROM made on evidence INTO authored is gone after merge (own_evidence); FROM-authored evidence about INTO is dropped (self-evidence)
- AC4: Companion content merges: FROM's private messages appear in INTO's segment for that org, after INTO's own messages
- AC5: Idempotency + safety: re-running the merge → refused (already-merged guard); `--dry-run` changes nothing; merging a user into itself refused
- AC6: The GitHub Action exists as `workflow_dispatch` with from/into/dry_run inputs and runs the same script (validated by workflow lint-level review; not itest-runnable)

## 7. Out of scope / deferred to future issues (per Orchestrator)
Un-merge/rollback tooling; audit log of merges beyond the tombstone; role-collision policy beyond higher-wins; reporting-chain cycle detection during merge; merging users ACROSS identity providers (no SSO yet); production-grade Action connectivity (Cloud Run Job); UI for requesting merges; notification to the merged user.

## 8. Decomposition sketch
H01 (core): `/v1/admin/merge-users` with repairs + counts. H02 (server): migration 010 + `scripts/merge-accounts.mjs`. H03: GH Action + green + artifacts + future issues filed.

## 9. Integration test design
`itest/tests/spec-023.itest.ts` — the CLI is the public interface: the test builds both accounts' worlds through public APIs (signup/orgs/feedback/validations/companion), then `execSync`s the script with the harness's `DATABASE_URL`/`CORE_URL`, then asserts AC1–AC5 back through public APIs. AC6 delegated to workflow review (H03). Expected red: script file does not exist → spawn failure (right reason: missing tool, not harness defect).
