---
id: SPEC-011
title: Companion, nudges & asks UI (web)
status: done
author: spec-architect
signed_off: true
workstreams: [web]
---

# SPEC-011: Companion, nudges & asks UI (web)

## 1. Motivation
PROJECT_BRIEF Layer 3: the companion is "the reason people log in" — SPEC-007/009 built the APIs; this gives them a face. Design language continues SPEC-006 (paper/slate, tidal accent, signal meter vocabulary).

## 2. Requirements
- R1: Shell gains three views: Profile (existing), Companion, Give & Grow (nudges + asks). Navigation in the rail; active view state client-side
- R2: Companion view: message thread (user right/companion left), input with send; synthesis messages (companion messages beginning "Here's your reflection") render distinctly and carry a "Share with your manager" action calling SPEC-007 share; shared state confirmed in-thread ("Shared" marker on that message, session-local)
- R3: Sharing requires explicit confirmation (one click to intend, one to confirm) — sharing is consequential; no accidental single-click leak of private reflection
- R4: Give & Grow: gaps list (attribute, status badge reusing SPEC-006 language, live counts, hint) each with suggested recipients as one-tap "Ask" buttons calling SPEC-009 requests; asks list showing requester + attribute with an inline feedback composer submitting via SPEC-003 feedback endpoint; fulfilled asks disappear on refetch
- R5: All invariant presentation rules carry over: no deficit language, neutral insufficient styling, no author identity invented anywhere

## 3. Trust invariant check
3: companion view is the private surface — no org-facing component imports its queries. 4: share confirmation (R3) protects the sharing boundary; UI shows shared state only to the sharer. 5: R5. 1–2: N/A beyond existing API guarantees.

## 4. Contracts
No new server API. Web routes: rail nav {profile|companion|grow}.

## 5. Edge cases & failure modes
Send while pending → input disabled. Share failure → inline error, message remains unshared. Empty gaps → "Your signal is established across the board" celebration empty-state. Empty asks → invitation empty-state.

## 6. Acceptance criteria (component-level; delegation per SPEC-QA-001 AC5)
- AC1: thread renders roles on correct sides; synthesis message shows share action; ordinary companion messages do not → web/test/companion.test.tsx
- AC2: share flow requires two clicks (intent → confirm); confirm fires POST to the share endpoint; marker appears → companion.test.tsx
- AC3: gaps render with suggested recipients; tapping Ask fires POST feedback-requests with recipientId+attributeKey → grow.test.tsx
- AC4: ask card's composer submits feedback with the requester as subject and the ask's attribute → grow.test.tsx
- AC5: send disabled while pending; empty states render invitation/celebration copy → both suites

## 7. Out of scope
Streaming replies, message history pagination UI, mobile polish, share revocation UI, LLM provider.

## 8. Decomposition sketch
H01 companion view; H02 grow view; H03 shell nav + suites green.

## 9. Integration test design
No new server contracts → no new itest file (SPEC-QA-001 AC5 delegation): ALL ACs live in component suites, written FIRST and red (missing components) before implementation. Red equivalence for web specs: failing component suites at review, recorded.
