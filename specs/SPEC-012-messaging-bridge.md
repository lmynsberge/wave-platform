---
id: SPEC-012
title: Messaging bridge — Slack & Teams bots
status: approved
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-012: Messaging bridge — Slack & Teams bots

## 1. Motivation
Orchestrator direction: meet users where they work — Slack and Teams bots that collect feedback, give feedback, and run check-ins. Architecture: ONE channel-agnostic gateway + thin platform adapters, so both bots share identity, commands, and trust guarantees, and the gateway is black-box testable without platform accounts.

## 2. Requirements
- R1: Account linking: an authenticated web user mints a short-lived link code (10 min TTL, single-use) bound to (user, org). In the chat platform, `link <code>` binds that platform identity (platform, externalId) to the user+org. One external identity maps to at most one (user, org) binding; re-linking replaces it
- R2: Inbound gateway: POST /api/bridge/:platform/events. Adapters normalize platform payloads to {externalId, text} and verify authenticity BEFORE the gateway logic runs: Slack — HMAC-SHA256 signature per Slack's signing protocol (v0 scheme, timestamp tolerance 5 min); Teams — shared-secret header v1 (AAD JWT verification is a tracked follow-up); test adapter — X-Bridge-Secret header (enabled only when BRIDGE_TEST_SECRET is set; never in production config)
- R3: Unlinked identities receive only linking guidance — no data flows to an unlinked external identity, ever
- R4: Command set (linked users), all reusing existing engines — the bridge NEVER reimplements domain logic:
  - `checkin` / plain text → SPEC-007 companion (same segment as web: one companion, many doors)
  - `share` → shares the most recent synthesis message (two-step: `share` returns a confirmation prompt; `share confirm` executes — R3-of-SPEC-011 parity in chat)
  - `asks` → SPEC-009 open asks, numbered
  - `feedback <n> <text>` → answers ask number n from the last `asks` listing (per-binding ephemeral state)
  - `nudges` → gap feed summary
  - `unlink` → removes the binding
- R5: Replies are structured {text} the adapter formats per platform; the gateway emits no platform markup
- R6: Trust invariants hold across the bridge: companion content reaches only the linked owner's externalId (INVARIANT 3); `share` requires explicit confirm (sharing boundary); no command exposes another user's gaps, asks, or private data

## 3. Trust invariant check
3: R3+R6 — the binding IS the authorization; every gateway command resolves the acting user from the verified binding, never from message content. 4: bridge adds no org-visible surfaces. 1: feedback via bridge flows through SPEC-003's server gate (manager-origination still 403s, surfaced as a friendly text). 5: nudges via bridge remain self-only.

## 4. Contracts
### 4.1 Server API
- POST /api/bridge/link-codes (web session auth) body {orgId} → 201 {code, expiresAt}
- POST /api/bridge/:platform/events (adapter-verified) body per platform; test adapter body {externalId, text} → 200 {text}
- 401 on failed adapter verification; 400 unknown platform
### 4.2 Data model (server, migration 004_bridge.sql)
bridge_link_codes(code text pk, user_id fk, org_id fk, expires_at, used boolean default false); bridge_bindings(platform text, external_id text, user_id fk, org_id fk, created_at, PRIMARY KEY(platform, external_id)); bridge_ask_context(platform, external_id, ask_ids uuid[], PRIMARY KEY(platform, external_id))
### 4.3 Command grammar
First token case-insensitive keyword; unknown keyword for a linked user → companion message (conversation is the default verb).

## 5. Edge cases & failure modes
Expired/used code → guidance text, not error status (chat UX). `feedback 3` with no prior `asks` listing or out-of-range n → guidance. Share with no synthesis yet → guidance. Slack timestamp replay (>5 min) → 401. Malformed adapter payload → 400.

## 6. Acceptance criteria (test adapter unless noted)
- AC1: unlinked externalId gets linking guidance for every command; no data leaks pre-link
- AC2: mint code on web → `link <code>` binds; second use of the same code fails with guidance; expired code fails
- AC3: linked `checkin` + replies advance the SAME companion segment visible on web (one segment, two doors — asserted by reading the web thread)
- AC4: `asks` lists open asks numbered; `feedback 1 <text>` submits real evidence (requester's inbox/summary reflects it) and fulfills the request
- AC5: `share` → confirmation prompt with no share created; `share confirm` → share visible to the manager via SPEC-007 listing; manager-origination attempt via `feedback` on a report returns the friendly refusal (invariant 1 across the bridge)
- AC6: Slack adapter unit-level: valid v0 signature accepted, tampered body rejected, stale timestamp rejected (server/test/slack-adapter.test.ts — crypto is unit-scope; recorded delegation)
- AC7: `unlink` removes the binding; subsequent commands get linking guidance

## 7. Out of scope
Outbound/proactive messaging (nudge delivery — future spec), Teams AAD JWT verification (follow-up ISS), slash-command registration manifests, rich cards/blocks formatting, multi-org bindings per external identity.

## 8. Decomposition sketch
H01 migration + linking; H02 gateway + command router; H03 Slack/Teams/test adapters; H04 green.

## 9. Integration test design
itest/tests/spec-012.itest.ts pre-implementation, via test adapter (X-Bridge-Secret; BRIDGE_TEST_SECRET set by harness). Contract-only: command grammar and reply expectations from §4.3/§6. Slack crypto delegated to unit suite (AC6, pointer recorded). Expected red: 404 on bridge routes.
