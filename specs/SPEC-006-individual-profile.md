---
id: SPEC-006
title: Individual profile (web)
status: approved
author: spec-architect
signed_off: true
workstreams: [server, web]
---

# SPEC-006: Individual profile (web)

## 1. Motivation
PROJECT_BRIEF V1 Layer 3 ("Personal profile: attributes, signal status, trajectory" + "the reason people log in"). First real UI since the walking skeleton. Trajectory (history over time) is deferred — no longitudinal storage yet.

## 2. Requirements
- R1: Auth screens: signup + login (SPEC-002 endpoints, cookie session), logout; unauthenticated users see auth, authenticated see the app shell
- R2: Org context: shell shows the user's orgs from /api/me; selecting one sets active org for all views (first org auto-selected)
- R3: Profile view: attribute cards showing name, kind, signal status, evidence/diversity/validation counts. Score renders ONLY at `established` (INVARIANT 2 in the UI); below that the card shows progress, never a number
- R4: Signal meter (signature element): per-card progress visualization against live policy from /api/signal-policy — subjective: evidence→authors→validators ticks; objective: datapoint ticks. Hints derived from policy deltas ("2 more validators to established"). Policy is fetched, never hardcoded in the web layer
- R5: `insufficient_signal` presents as NEUTRAL (quiet styling, "building signal" language) — never error/red/negative treatment (INVARIANT 5); absence of attributes shows an empty-state inviting action, not a warning
- R6: Inbox panel: caller's own feedback (SPEC-005 inbox), author shown only as "peer feedback" / "system"; pending_upward items labeled "awaiting upward validation"
- R7: Server: GET /api/signal-policy passthrough of core /v1/signal-policy (auth required, no org gate — policy is platform-public to users)
- R8: Component tests: score hidden below established; established shows score; insufficient uses neutral styling class; policy-derived hint math

## 3. Trust invariant check
2: R3 — UI cannot display a score the API sent as null; test-asserted. 5: R5 neutral framing; empty ≠ negative. 1,3,4: N/A (no origination, chat, or sharing surfaces; inbox already anonymized server-side per SPEC-005).

## 4. Contracts
### 4.1 Server API
GET /api/signal-policy → 200 (core §4.2 shape) | 401. All other endpoints existing (SPEC-002/003/005).
### 4.2 Core interface
Unchanged.
### 4.3 Data model
None.
### 4.4 Web routes
`/` → auth or shell; shell views: Profile (default). State: TanStack Query, active org in React state.

## 5. Edge cases & failure modes
Core down → profile shows a degraded banner (reuse SPEC-001 pattern), never fabricated zeros. No orgs → empty-state prompting org creation/joining (out of scope to build creation UI beyond a minimal form). Session expiry mid-use → 401 responses route back to auth.

## 6. Acceptance criteria
- AC1: signup/login/logout flows render and drive session (mocked fetch component tests)
- AC2: profile renders attribute cards from summary fixture; established card shows score; emerging/insufficient cards show NO score element
- AC3: signal meter hint math: fixture (evidence 5/5, authors 3/3, validators 3/5) → "2 more validators to established"
- AC4: insufficient card carries neutral styling (no `--negative` styles); empty profile shows invitation empty-state
- AC5: inbox renders anonymized items; pending_upward labeled distinctly
- AC6: server passthrough returns core policy (mocked core); 401 unauthenticated; typecheck+tests green across web/server

## 7. Out of scope
Trajectory/history charts, giving-feedback UI (SPEC-005 flows UI arrives with SPEC-009 nudge surfaces), org admin UI, manager queue UI, responsive polish beyond basic stacking, theming.

## 8. Decomposition sketch
H01 (server): policy passthrough; H02 (web): auth + shell + org context; H03 (web): profile cards + signal meter; H04 (web): inbox panel + test suite.
