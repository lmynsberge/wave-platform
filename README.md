# Wave Platform

Individual-first professional growth platform with an org-agnostic, evidence-gated performance signal.

Two-sided value proposition:
1. **Individual**: an emotionally intelligent growth companion, honest enough to say "wrong fit."
2. **Organization**: performance intelligence built on validated, normalized, portable signal.

Core trust primitives: manager-as-validator (never rater), statistical-significance gating on subjective attributes, cross-org normalization, segmented private/shared memory.

## Repo layout

| Path | Purpose |
|---|---|
| `docs/` | Project brief, prototype learnings, architecture, ADRs |
| `agents/` | **First-class citizen.** Agent team structure, roles, workflow, coordination rules |
| `specs/` | Spec-based programming requirements (the unit of work) |
| `handoffs/` | Decomposed task handoffs from workstream leads to implementers |
| `reviews/` | Spec reviews and code review records |
| `itest/` | **Spec-locked integration tests** — one black-box file per spec, designed in the spec phase, immutable without a spec change (SPEC-QA-001) |
| `core/` | Rust — domain core: scoring, normalization, signal/validation engine |
| `server/` | TypeScript Node — API/BFF, integrations, chat orchestration |
| `web/` | React — frontend |

Issues, blockers, and escalations are tracked in [GitHub Issues](https://github.com/lmynsberge/wave-platform/issues) (titles carry the `ISS-###` IDs referenced throughout the repo).

## Stack

- **core**: Rust (axum, sqlx, PostgreSQL)
- **server**: Node.js + TypeScript (fastify), talks to `core` over HTTP/gRPC
- **web**: React 18 + TypeScript + Vite

## How work happens here

All work flows through the agent process defined in `agents/WORKFLOW.md`:
spec → spec review → decomposition → implementation → code review → integration.
Nothing merges without a written spec and a written review. See `agents/README.md`.
