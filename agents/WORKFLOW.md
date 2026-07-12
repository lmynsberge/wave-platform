# Workflow

## 1. Spec phase

1. Orchestrator picks the next roadmap item (see `docs/ROADMAP.md`).
2. Spec Architect writes `specs/SPEC-###-<slug>.md` from the template. Status: `draft`.
3. Spec Reviewer writes `reviews/SPEC-###-review.md`. Verdict:
   - `approved` → spec status becomes `approved`
   - `changes-requested` → architect revises, reviewer re-reviews (max 2 cycles, then escalate to Orchestrator)
4. Orchestrator gives final sign-off on `approved` specs before decomposition.

## 1b. Integration test design (TDD — from SPEC-007 onward)

Before decomposition, the Spec Architect writes `itest/tests/spec-###.itest.ts` implementing the spec's acceptance criteria as black-box tests against the public API (function signatures and helper design count as design work). The file must compile and run RED against the unimplemented system. The Spec Reviewer verifies red-ness and AC coverage as part of spec review.

**LOCK RULE (SPEC-QA-001 R3):** files under `itest/tests/` change ONLY with a reviewed spec amendment or new spec. A commit touching them must reference the spec/amendment ID; reviewers reject violations. Unit/component tests remain free to evolve.

## 2. Decomposition phase

5. The relevant Workstream Lead(s) decompose the spec into handoffs `handoffs/SPEC-###-H##-<slug>.md`.
   - Each handoff targets exactly one workstream (core | server | web).
   - Cross-workstream contracts (API shapes, schemas) are defined IN THE SPEC, not invented in handoffs.
   - Handoffs declare dependencies on other handoffs explicitly.
6. Lead sanity check: can each handoff be completed in one focused session by an implementer with no repo-wide context? If not, split it.

## 3. Implementation phase

7. Implementer takes ONE handoff, works on branch `spec-###/h##-<slug>`.
8. Implementer updates the handoff file's `status` field: `in-progress` → `ready-for-review`.
9. Definition of done for an implementer: acceptance criteria met, tests written and passing, lint clean, handoff status updated.
10. COMMIT CONVENTION (traceability): one commit per handoff minimum, message `SPEC-###-H##: <summary> (R#, ...; AC#, ...)` naming the requirements/ACs satisfied. Spec/review docs commit separately as `SPEC-###: ...`; issue-driven changes as `ISS-###: ...`. Roll-ups recorded in docs/TRACEABILITY.md.

## 4. Review phase

10. Code Reviewer writes `reviews/SPEC-###-H##-code-review.md`. Verdict:
    - `approved` → Lead merges to main
    - `changes-requested` → back to implementer (max 2 cycles, then escalate to Lead)
11. Reviewer checks: conformance to handoff, conformance to spec contracts, tests, security (input validation, authz on every route/query), no scope creep, and NO diffs to itest/tests/ without a spec/amendment reference (lock rule).

## 5. Integration

12. Workstream Lead merges approved work, verifies cross-handoff integration, updates spec status to `done` when all its handoffs are merged.

## Issue & escalation protocol

Any agent that hits a blocker, ambiguity, or spec conflict:

1. STOP. Do not guess or silently deviate.
2. File `issues/ISS-###-<slug>.md` from the template, referencing the spec/handoff.
3. Escalate exactly one tier up (Implementer → Lead, Lead → Spec Architect/Orchestrator, Reviewer disputes → Orchestrator).
4. The resolver writes the resolution INTO the issue file and, if the spec changed, amends the spec and re-triggers spec review (fast-track: reviewer may scope review to the delta).
5. Work resumes only after the issue status is `resolved`.

Severity levels: `blocking` (work stopped), `degraded` (workaround exists, debt logged), `question` (clarification needed, work may continue on unaffected parts).

## Status vocabulary

- Specs: `draft | in-review | approved | in-progress | done | superseded`
- Handoffs: `ready | in-progress | ready-for-review | approved | merged`
- Issues: `open | in-triage | resolved | wont-fix`
