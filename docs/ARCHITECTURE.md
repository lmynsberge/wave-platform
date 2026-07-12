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
- Owns tables: attributes, evidence, validations, scores, signal_state

**server (TS)** — integration and orchestration surface:
- AuthN/session, RBAC enforcement at the edge, org/user management
- Segmented chat orchestration (private vs shared memory contexts; AI-provider-agnostic)
- Ingestion connectors (HRIS, time-tracking), nudge scheduling/delivery
- Owns tables: users, organizations, memberships, sessions, chat_segments, integrations

**web (React)** — individual profile, feedback flows, chat UI, manager validation queue, thin org dashboard.

## Hard boundaries (trust-enforcing)

- Private chat segments are stored and served ONLY via server's private-context path; core never sees raw private conversation content
- Org-facing queries go through core's gated read models — no raw evidence exposure below significance thresholds
- No endpoint may reveal shared-vs-not-shared distinctions

## Cross-cutting

- IDs: UUIDv7. Migrations: sqlx (core-owned tables), drizzle or knex (server-owned) — one migration runner per owner, never cross-write
- Contract-first: OpenAPI schema for core's internal API lives in `core/api/openapi.yaml`, generated TS client in server
