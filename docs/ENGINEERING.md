# Engineering Standards

## All workstreams
- Contract-first: types generated from the spec's contracts; no hand-drift
- Tests accompany every handoff; no merge without passing CI
- Small PRs = one handoff. Branch: `spec-###/h##-<slug>`
- No secrets in repo. `.env.example` documents required env

## core (Rust)
- Edition 2021+, `cargo fmt` + `clippy -D warnings`
- axum for HTTP, sqlx (postgres, compile-time checked queries), thiserror for errors
- Domain logic pure and unit-tested independent of HTTP layer

## server (TS)
- Node 22+, strict TypeScript, ESM
- fastify + zod for validation at every boundary
- vitest for tests; no `any` in committed code

## web (React)
- React 18 + Vite + strict TS
- TanStack Query for server state; React Hook Form + zod
- Component tests with vitest + testing-library
