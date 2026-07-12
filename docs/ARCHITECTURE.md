# Architecture

## Services

```
web (React 18 + TS + Vite)
   │  HTTPS/JSON
server (Node + TS, fastify)         ← BFF, auth/session, integrations, AI/chat orchestration
   │  HTTP/JSON (internal)
core (Rust, axum + sqlx)            ← domain engine: signal, validation, scoring, significance
   │
PostgreSQL                           ← single DB, schema ownership split by service
```

## Responsibility split

**core (Rust)** — deterministic domain logic where correctness matters most:
- Attribute taxonomy, evidence records, validation records (yes/no/no-signal)
- Significance engine: thresholds, diversity requirements, "insufficient signal" gating
- Scoring: composite + per-attribute, absence-as-neutral handling
- Validation chain rules (manager-as-validator, upward chaining)
- Owns tables (schema `core`): attributes, evidence (state, source/period metric identity), validations (validator_relationship)
- Engines: structural rules, significance (diversity gates, drop-not-negative, null-below-established), within-org established-cohort percentiles
- Note: signal state and scores are computed at read time; materialization is a scale trigger (BACKLOG)

**server (TS)** — integration and orchestration surface:
- AuthN/session, RBAC enforcement at the edge, org/user management
- Segmented chat orchestration (private vs shared memory contexts; AI-provider-agnostic)
- Ingestion connectors (HRIS, time-tracking), nudge scheduling/delivery
- Owns tables: users, sessions, organizations, memberships, reporting_edges, chat_segments, chat_messages, reflection_shares, feedback_requests, bridge_link_codes, bridge_bindings, bridge_ask_context, bridge_nudge_log, org_llm_config
- Server modules: auth, orgs, feedback (invariant-1 gate), flows (queues/assessments), companion (hybrid engine), nudges, teamview (closed schema), ingest, bridge (binding-as-authorization), outbound (count-only dispatch), llm (redact→provider→restore, fail-closed)

**web (React)** — Profile (attribute cards + signal meter), Companion (hybrid thread, two-step share), Give & Grow (gaps/asks). Manager screens are API-only so far (BACKLOG).

**Doors principle:** web, Slack, and Teams are doors into ONE companion engine (`companionTurn`) and one segment per (user, org) — channels never fork private context.

Diagrams: `docs/diagrams/architecture.mermaid`, `docs/diagrams/trust-boundaries.mermaid`.

## Hard boundaries (trust-enforcing)

- Private chat segments are stored and served ONLY via owner-gated server routes; core never sees chat content; LLM providers receive REDACTED text only ([Pn]/[EMAIL]) with restore on return
- The individual's gaps have no org-visible surface (nudge routes take no target userId; dispatch returns a count only)
- Closed-schema contracts (team-signal) make surveillance-creep a locked-test failure
- Org-facing queries go through core's gated read models — no raw evidence exposure below significance thresholds
- No endpoint may reveal shared-vs-not-shared distinctions

## Cross-cutting

- IDs: UUIDv7. Migrations: sqlx (core-owned tables), drizzle or knex (server-owned) — one migration runner per owner, never cross-write
- Contract-first: OpenAPI schema for core's internal API lives in `core/api/openapi.yaml`, generated TS client in server
