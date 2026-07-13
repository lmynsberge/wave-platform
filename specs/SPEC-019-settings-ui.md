---
id: SPEC-019
title: Settings UI — linking, notifications, LLM config
status: approved
author: spec-architect
signed_off: true
workstreams: [web]
---

# SPEC-019: Settings UI

## 1. Motivation
Three shipped capabilities have no screens: bridge linking (SPEC-012 — users literally cannot connect Slack/Teams without curl), notification opt-out (SPEC-017 G2 — web surface deferred to here), and org LLM config (SPEC-014 — admin BYO setup is API-only). One coherent Settings view closes all three.

## 2. Requirements
- R1: Shell gains a "Settings" view (rail nav) with three sections
- R2: **Connect your chat app**: a "Generate link code" button mints via POST /api/bridge/link-codes; the code renders with expiry note and the exact bot instruction (`link <code>`). Codes are single-use/10-min — copy states this. Re-minting replaces the display
- R3: **Notifications**: current preference loaded from GET notification-prefs; a toggle PUTs {optedOut}; copy is consent-clear: what Wave will and won't send, and that everything else keeps working when off
- R4: **AI companion (admins only)**: section renders only when the member's role is owner/admin (role passed from shell's /api/me data). Shows current config from GET llm-config (masked key) or an unconfigured state; form (provider select, base URL, model, API key) PUTs; success re-renders masked. Helper copy states redaction-first + at-rest encryption facts plainly (trust must be legible, SPEC-015 precedent)
- R5: All mutations show inline errors without losing form state; no invariant-relevant data appears beyond what the contracted endpoints return

## 3. Trust invariant check
3: LLM section copy makes the redaction boundary legible; masked keys only, never plaintext echo. 5: notifications copy frames opt-out as neutral preference, not disengagement. No new surfaces.

## 4. Contracts
No new server API. Web: nav gains {settings}; SettingsView({orgId, role}).

## 5. Edge cases & failure modes
GET llm-config 404 (no_config) → unconfigured state, not an error banner. Mint failure → inline retry. Prefs PUT failure → toggle reverts.

## 6. Acceptance criteria (component suite web/test/settings.test.tsx — no new contracts, SPEC-QA-001 AC5 delegation; red = missing module)
- AC1: mint button POSTs to link-codes and renders the returned code + `link <code>` instruction
- AC2: toggle reflects GET state and PUTs the flipped value
- AC3: admin sees the LLM form; save PUTs {provider, baseUrl, model, apiKey}; masked key renders after; member role → section absent
- AC4: unconfigured LLM state (404) renders the setup prompt, not an error
- AC5: nav renders Settings entry (shell test)

## 7. Out of scope
Unlink-from-web (bridge `unlink` exists), KEK rotation UI, per-kind notification granularity, org profile settings.

## 8. Decomposition sketch
H01 view + sections; H02 shell nav + green.

## 9. Integration test design
No new itest. All ACs in the component suite, written FIRST, red (missing module), recorded.
