---
id: SPEC-015
title: Manager UI — team signal, validation queue, upward decisions
status: approved
author: spec-architect
signed_off: true
workstreams: [web]
---

# SPEC-015: Manager UI

## 1. Motivation
BACKLOG headline gap: SPEC-005/010 shipped the manager APIs with no screens. Managers currently cannot do their core validator job in the product. Required before any demo.

## 2. Requirements
- R1: Shell gains a "Team" view. It renders for every member; non-managers see the honest empty state ("no reports") — being a non-manager is normal (SPEC-010 R2 parity)
- R2: Team signal section: rows from /team-signal exactly as contracted (name, established, emerging, pending) — the UI adds NOTHING the closed schema doesn't provide (no derived absence framing, no red styling on zeros)
- R3: Validation queue section: items from /validation-queue with note + attribute; three actions per item — Validate (yes), No signal, and Disagree (no) — wired to the SPEC-003 validation endpoint; item leaves the list on success (refetch). Action language matters: "no" is labeled Disagree, and helper copy states plainly that a manager's Disagree never lowers a score (drop-not-negative made legible)
- R4: Upward queue section: pending assessments from /upward-queue with Approve / Drop (no) / No signal actions to the decision endpoint; helper copy: "Dropping leaves no trace — identical to never submitted"
- R5: Counts in the team rows visibly reconcile with the queue (pending badge per member); after validating, both refetch

## 3. Trust invariant check
1: R3/R4 copy makes drop-not-negative and traceless-drop LEGIBLE, not just true. 5: R2 no-absence-framing; zeros styled neutrally. 3/4: no new data surfaces — strictly the closed contracts.

## 4. Contracts
No new server API. Web: rail nav gains {team}.

## 5. Edge cases & failure modes
Empty queues → invitation-neutral empty states. Action failure → inline error, item stays. Both queues empty but team non-empty → celebratory "all caught up".

## 6. Acceptance criteria (component suites; SPEC-QA-001 AC5 delegation — no new server contracts)
- AC1: team rows render the five fields; zero counts carry no negative styling class → web/test/team.test.tsx
- AC2: validation item's Validate fires POST {outcome:"yes"} to the validations endpoint; Disagree fires {outcome:"no"}; item removed on success
- AC3: drop-not-negative helper copy present alongside the Disagree action
- AC4: upward item's Approve fires {outcome:"yes"} to the decision endpoint; Drop fires {outcome:"no"}; traceless helper copy present
- AC5: non-manager (empty team) renders the honest empty state; caught-up state renders when queues are empty

## 7. Out of scope
Per-member profile drill-in link polish, bulk validation, filters/sorting, notifications.

## 8. Decomposition sketch
H01 team section; H02 queues + actions; H03 nav + green.

## 9. Integration test design
No new itest (no new contracts); ALL ACs in web/test/team.test.tsx, written FIRST and red (missing module), recorded.
