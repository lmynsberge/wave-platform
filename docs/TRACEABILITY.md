# Traceability: Specs → Handoffs → Requirements → Commits

Every spec must be traceable to the commit(s) that implemented it, at handoff granularity, with the requirements each commit satisfies. This file is the retroactive map for SPEC-001–005 (implemented before the per-handoff commit convention existed); from SPEC-006 onward, traceability lives primarily in commit messages themselves (see convention below) and this file records the roll-up.

## Commit convention (mandatory from SPEC-006)

One commit per handoff, minimum. Message format:

```
SPEC-###-H##: <summary> (R1, R3; AC2)
```

- First line names the handoff ID, then the requirement IDs (R#) and acceptance criteria (AC#) it satisfies or advances.
- Spec/review/handoff documents are committed separately: `SPEC-###: spec approved + review`.
- Issue-driven changes reference the issue: `ISS-###: ...`.
- Multi-handoff commits are not permitted except for mechanical cross-cutting fixes (formatting, CI), which use `chore:`.

## Retroactive map

### SPEC-001 — Foundation & walking skeleton
| Commit | Scope | Requirements |
|---|---|---|
| `a30a6c8` | Scaffold: agent system, docs, spec, review, 4 handoffs; ISS-001 filed | process artifacts |
| `4250793` | H01 core skeleton (R1), H02 server+degraded contract (R2), H03 web ok/degraded page (R3), H04 compose+CI+smoke (R4–R6); ISS-002 | R1–R6; AC1–AC4 (AC1/AC2 via ISS-002 native-smoke workaround) |
| `a1365b4` | Code-review findings repair | process artifacts |

### SPEC-002 — Identity & tenancy
| Commit | Scope | Requirements |
|---|---|---|
| `ed2714f` | Spec + review; ENGINEERING A1 amendment | process artifacts |
| `947d254` | H01 migrations/runner (R8), H02 auth+sessions (R1, R2), H03 orgs+memberships+RBAC edge (R3–R5), H04 reporting edges+chain (R6, R7); CI pg service | R1–R8; AC1–AC6 |

### SPEC-003 — Attribute taxonomy & evidence model
| Commit | Scope | Requirements |
|---|---|---|
| `018f385` | Spec + review (invariant enforcement split) | process artifacts |
| `ef9af67` | H01 core schema/migrations (R1, R2, R7), H02 structural rules (R3, R4), H03 summary read-model (R6), H04 server proxy + manager gate (R5, R8); A2 amendment | R1–R8; AC1–AC6 |

### SPEC-004 — Significance engine
| Commit | Scope | Requirements |
|---|---|---|
| `9c9602b` | Spec + review (drop-not-negative defined) | process artifacts |
| `e77ba17` | H01 migration 002 + relationship writes (R5, R6), H02 significance compute + policy endpoint (R1–R4, R7, R8), H03 server relationship forward (R5, A1/ISS-004), H04 AC suites | R1–R8; AC1–AC6; ISS-004 resolution |

### SPEC-005 — Feedback capture & validation flows
| Commit | Scope | Requirements |
|---|---|---|
| `b2feceb` | Spec + review (pending_upward model) | process artifacts |
| `65dee0b` | H01 migration 003 + state model (R4), H02 listing+decide (R5, R7 core-side), H03 queue/inbox/assessments/decisions (R1–R3, R6), H04 real-binary E2E suite | R1–R7; AC1–AC6 |

### Issues
| Commit | Issue |
|---|---|
| `a30a6c8` | ISS-001 filed (GitHub write access) |
| `4250793` | ISS-002 filed (no docker in agent env) |
| `65543ef` | ISS-003 filed (env volatility + bundle protocol) |
| `e77ba17` | ISS-004 filed + resolved (evidence subject lookup, spec A1) |

### SPEC-006 — Individual profile (per-handoff convention active)
Commits self-describe; roll-up: spec+review commit, then SPEC-006-H01 (R7; AC6), SPEC-006-H02+H03 (R1–R5; AC1, AC2, AC4 — H02/H03 landed together after a container reset forced a node_modules reinstall mid-commit; split preserved in message), SPEC-006-H04 (R8; AC2–AC4).

### SPEC-QA-001 — Spec-locked integration harness
Per-handoff commits: process docs (R3, R4, R7; AC3), H01 harness (R1, R2; AC1), H02 backfill 001–003 (R5; AC2, AC5), H03+H04 backfill 004–006 + CI (R5, R6; AC2, AC4).

### SPEC-007 — Segmented chat companion (TDD)
Red commit: spec + failing itest (7/7 red, verified in review). Implementation: SPEC-007-H01+H02+H03 single commit (R1–R5; container-session pragmatics), H04 artifacts. Locked test file untouched between red and green — the diff-free window is the TDD proof.

### SPEC-008 — Hard-metric ingestion (TDD)
Red commit (4/4 right-reason 404s recorded in review per A2) → SPEC-008-H01+H02 core commit (R3, R4) → SPEC-008-H03 server commit (R1, R2, R6) → H04 artifacts. Locked file untouched red→green.

### SPEC-009 — Nudges (TDD)
Red commit (5/5, two test-design fixes made PRE-lock and noted in review) → H01+H02+H03 implementation commit (R1–R6) → artifacts. Locked file untouched red→green.

### SPEC-010 — Thin org view (TDD)
Red commit (4/4) → SPEC-010-H01 (R1–R5, closed schema) → artifacts. Locked file untouched red→green.

### SPEC-011 — Companion UI (TDD, web-equivalence)
Red commit (missing-module suite failures recorded) → H01+H02+H03 implementation commit → artifacts. One timing assertion fixed in unit suite (unlocked tier) post-red; noted.

### SPEC-012 — Messaging bridge (TDD)
Red commit (5/5) → H01+H02+H03 implementation commit (incl. companionTurn extraction) → AC6 Slack crypto unit suite → artifacts. Locked file untouched red→green.

### SPEC-013 — Outbound nudge delivery (TDD)
Red commit (3/3, listener-capture) → H01+H02 implementation commit (R1-R5) → artifacts. Locked file untouched red→green.

### SPEC-014 — LLM companion provider (TDD)
Red commit (5/5 after AC4 red-quality repair pre-lock) → H01+H02+H03 implementation commit (R1-R7) → ISS-005/A1 locked-test amendment (delta-reviewed) → artifacts. First exercise of the amendment path for a locked-test defect.

### Retrospective (this pass)
Docs refresh commit: PROJECT_BRIEF (status/learnings/revised questions), ARCHITECTURE (current modules/tables/boundaries + diagrams), WORKFLOW (locked-test defect path, durability protocol, listener pattern), BACKLOG.md (full harvest), diagrams/.
