---
id: SPEC-024
title: Demo mode (read-only persona session)
status: approved
author: spec-architect
signed_off: true
workstreams: [server, web]
---

# SPEC-024: Demo mode (read-only persona session)

## 1. Motivation
Orchestrator directive (2026-07-19): *"A new user might want to see what the page can look like. Offer the option to view in demo mode, which makes all the pages populated with data from a seeded demo environment."* A zero-org user (even one with a pending SPEC-022 join request) has empty pages; demo mode lets them see the product working with real server responses. The seeded demo environment already exists (Meridian Consulting, `scripts/seed-demo.mjs`, SPEC-016-H03); its hero persona has every surface populated. Approach (Orchestrator-selected): the user's session temporarily impersonates a configured demo persona, **read-only** — real pages, real API, zero mutation capability.

## 2. Requirements
- R1: Server config `DEMO_PERSONA_EMAIL` names the demo persona (demo env: `priya@meridian.demo`). Unset or unresolvable → demo mode unavailable
- R2: `GET /api/demo` reports `{available: boolean}` (config present AND persona user exists). No auth required; reveals nothing but feature availability
- R3: An authenticated user can enter demo mode: their SESSION is flagged (`sessions.demo`); their real identity and cookie are untouched. While flagged, identity resolution (`/api/me` and every session-authed route) acts as the persona and `/api/me` carries `demo: true`
- R4: Demo sessions are read-only: any non-GET `/api/*` request is rejected 403 `demo_read_only`, except the escape hatches `/api/demo/exit`, `/api/auth/logout`, `/api/auth/login`, `/api/auth/signup`. Enforced at ONE choke point (app-level hook), not per-route
- R5: `POST /api/demo/exit` clears the flag; the next `/api/me` is the real user again. Entering when unavailable → 404 `demo_unavailable`; enter/exit require auth (401 otherwise)
- R6: If the persona becomes unresolvable while a session is flagged, identity falls back to the real user (demo flag inert, `demo` absent/false) — never a 500, never a half-persona
- R7: Web — the zero-org panel offers "Explore demo mode" when available; in demo the shell shows a persistent banner ("Demo mode — read-only · seeded example data") with an Exit control; exiting restores the user's own (empty or real) state

## 3. Trust invariant check
1: demo users cannot validate/originate anything — R4 blocks all writes. 2: persona surfaces go through the same gated read models; nothing new is exposed below thresholds. 3: the persona's private companion thread IS visible to demo viewers — acceptable ONLY because the persona is synthetic by construction (R1 config points at seeded data; the demo env's persona exists solely for demonstration). The spec makes this explicit: `DEMO_PERSONA_EMAIL` must never name a real person's account; ops-level rule recorded in DEPLOY notes (H03). 4: sharing indistinguishability unaffected (no org-facing surface changes). 5: N/A. R4's single choke point makes "demo user mutates as persona" structurally impossible rather than per-route policy.

## 4. Contracts
### 4.1 API (server)
| Method/Path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| GET /api/demo | none | — | 200 {available} | — |
| POST /api/demo/enter | session | {} | 200 {demo:true} | 401; 404 demo_unavailable |
| POST /api/demo/exit | session | {} | 200 {demo:false} | 401 |
| GET /api/me (amended) | session | — | 200 {user, memberships, demo?:true} — persona identity while flagged | 401 |
| any non-GET /api/* while flagged | session(demo) | — | — | 403 demo_read_only (except escape hatches, R4) |

### 4.2 Core interface
None.
### 4.3 Data model (server-owned, migration 011_demo_sessions.sql)
`ALTER TABLE sessions ADD COLUMN demo boolean NOT NULL DEFAULT false;` (011 reserved here; 010 is allocated to SPEC-023, independent columns — either merge order is safe.)
### 4.4 Events
None.

## 5. Edge cases & failure modes
Enter twice → idempotent 200. Exit when not in demo → 200 {demo:false}. Persona deleted mid-session → R6 fallback. Logout during demo deletes the real session (token-keyed) and clears the cookie — no stranded state. Bearer-authed routes (bridge/outbound/dispatch) carry no session cookie → guard never triggers. GETs with side effects: none exist under /api (verified in review). Demo + join-request flow: entering demo does not cancel pending SPEC-022 requests (they belong to the real user).

## 6. Acceptance criteria
- AC1: `GET /api/demo` available:false before the persona exists; true after
- AC2: Zero-org user enters demo → /api/me shows persona identity + demo:true and the persona's memberships; a members list GET in the persona's org returns 200
- AC3: While in demo, a mutation (e.g. POST feedback in the persona's org) → 403 demo_read_only
- AC4: /api/demo/exit → /api/me is the real user again (no demo flag, own empty memberships)
- AC5: Enter unauthenticated → 401; enter with persona unset/unresolvable → 404 demo_unavailable
- AC6 (delegated → web suite `web/test/demo.test.tsx`): zero-org panel shows "Explore demo mode" when available and fires enter; demo banner renders and Exit fires /api/demo/exit

## 7. Out of scope
Multiple personas / persona chooser, demo for already-membered users (button lives on the zero-org panel only; the API doesn't forbid it), guided product tour overlays, seeding-on-demand (assumes the environment ran `scripts/seed-demo.mjs`), anonymous (logged-out) demo.

## 8. Decomposition sketch
H01 (server): migration 011, demo routes, currentUser persona resolution, read-only hook; itest green. H02 (web): explore button + banner + suite. H03: green + artifacts + DEPLOY note (persona must be synthetic).

## 9. Integration test design
`itest/tests/spec-024.itest.ts` black-box; harness exports `DEMO_PERSONA_EMAIL=priya@demo.itest` (env addition in `itest/src/global-setup.ts` — harness config, not a locked file). The test itself signs up the persona and dresses a minimal org through public APIs, so AC1 asserts false→true across that boundary. AC6 delegated by pointer. Expected red: /api/demo 404; enter/exit 404.
