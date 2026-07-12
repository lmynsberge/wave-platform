---
id: SPEC-014
title: LLM companion provider — hybrid, multi-provider, redaction-first
status: approved
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-014: LLM companion provider

## 1. Motivation
Orchestrator decisions (recorded this session): providers = multi-provider + org-level BYO + self-hosted, delivered as one clean abstraction; conversation model = HYBRID (guided skeleton anchors, LLM deepens); privacy = REDACTION-FIRST (names/identifiers never reach a model). The guided interview (SPEC-007) remains the deterministic spine and the universal fallback — the LLM is an enhancement layer that can fail closed to guided at any moment.

## 2. Requirements
- R1: LLM client abstraction `LlmClient { complete(system, messages) -> text|null }` with adapters: `anthropic` (Messages API), `openai_compatible` (chat/completions against a configurable base URL — covers OpenAI, Ollama, vLLM, any compatible self-host). Adapter network behavior for real vendors is staging-verified (recorded delegation); the openai_compatible adapter IS exercised in CI against a scripted endpoint
- R2: Resolution order per org: org BYO config → platform env default (`LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) → none (pure guided). BYO config: PUT/GET /api/orgs/:orgId/llm-config (owner/admin); GET masks the key (`sk-…last4`). Key storage is plaintext-at-rest v1 with a NAMED follow-up for envelope encryption before design-partner launch
- R3: HYBRID turn engine: after a user answers a SKELETON question, the engine requests ONE LLM follow-up (probing deeper on that answer); after the user answers a FOLLOW-UP, the engine advances to the next skeleton question (deterministic). Exactly one follow-up per skeleton question, maximum. On the 7th skeleton answer (follow-ups don't count toward the seven), synthesis
- R4: SYNTHESIS: LLM-composed from the user's (redacted) answers, BUT must begin with the literal line `Here's your reflection` (the sharing-detection contract, now spec-stated rather than provider-coupled) AND must contain verbatim fragments of at least two user answers (quote-the-user, per SPEC-007 review finding 4). If the LLM output violates either check, or the LLM fails, the deterministic SPEC-007 synthesis is used instead — the user always gets a valid synthesis
- R5: REDACTION: before any text reaches an LLM: all org members' names → stable placeholders `[P1]`,`[P2]`… (per-request map), email addresses → `[EMAIL]`. Placeholders in LLM output are restored to real names on the way back. Redaction failures fail closed (guided). No raw identifier may appear in any outbound LLM request body
- R6: FAIL-CLOSED: any LLM error (network, non-200, empty) → the guided provider's deterministic behavior for that same turn. The interview never blocks and never surfaces an LLM error to the user
- R7: With no LLM resolved, behavior is byte-for-byte SPEC-007 guided (regression guard: SPEC-007's locked itest is the enforcement)

## 3. Trust invariant check
3 (private context): R5 — identifiers stripped before leaving the trust boundary; only the individual's own words (redacted) are ever sent; org-facing surfaces unchanged. 4: sharing contract strengthened — the marker line is now a spec-level contract (R4). 1/2/5: N/A (no scoring/visibility changes).

## 4. Contracts
### 4.1 Server API
- PUT /api/orgs/:orgId/llm-config (owner/admin) body {provider:"anthropic"|"openai_compatible", baseUrl?, model, apiKey} → 200 {provider, model, baseUrl?, apiKey:"masked"} | 400 | 401 | 403 | 404
- GET /api/orgs/:orgId/llm-config (owner/admin) → 200 masked | 404 no_config
- Companion endpoints unchanged (SPEC-007 contract holds for both engines)
### 4.2 Data model (migration 006_llm_config.sql)
org_llm_config(org_id pk fk, provider text check, base_url text, model text, api_key text, updated_at)
### 4.3 openai_compatible wire contract (what CI exercises)
POST {baseUrl}/chat/completions {model, messages:[{role,content}...]} → {choices:[{message:{content}}]}; Authorization: Bearer {apiKey} when key present
### 4.4 Skeleton
The 7 questions and deterministic synthesis of SPEC-007 §4.4 are unchanged and remain the fallback.

## 5. Edge cases & failure modes
LLM returns a follow-up that IS a question about a different person → still delivered (content moderation out of scope v1; redaction already prevents identifier leakage INTO the model). Placeholder collisions with user text (user literally types "[P1]") → restore only placeholders the redactor issued this request. Org config with unreachable base URL → R6 fail-closed per turn. Follow-up state derives from message history (which companion messages are skeleton questions vs not), not a stored flag.

## 6. Acceptance criteria (fake openai_compatible endpoint run by the itest; captures all requests)
- AC1 (hybrid flow): with LLM configured, answering skeleton Q1 yields the scripted follow-up; answering the follow-up yields skeleton Q2 verbatim; exactly one follow-up per skeleton question
- AC2 (redaction): a user answer containing a real member's name and an email produces captured LLM requests containing NEITHER, and containing a `[P` placeholder and `[EMAIL]`
- AC3 (restore): a scripted follow-up containing `[P1]` reaches the user with the real name restored
- AC4 (fail-closed): endpoint returns 500 → the turn produces the guided next question; interview continues
- AC5 (synthesis guard): scripted synthesis quoting two user fragments and starting with the marker is used verbatim; a scripted non-conforming synthesis is REPLACED by the deterministic one (marker line present either way)
- AC6 (BYO + authz): PUT config as admin routes subsequent requests to the org's base URL (captured); GET masks the key; member PUT → 403
- AC7 (no config): org without config and without platform env behaves guided — SPEC-007 locked itest remains green (pointer)

## 7. Out of scope
Envelope encryption of BYO keys (named follow-up), streaming, per-user model choice, content moderation, LLM-composed nudges, token budgeting, conversation summarization for long histories.

## 8. Decomposition sketch
H01 migration + config endpoints; H02 clients + redaction; H03 hybrid engine in companionTurn; H04 green.

## Amendments
- A1 (via ISS-005): AC4's test inserts one advancing turn (answering the pending follow-up) before the fail-closed probe, so the probe lands on a skeleton answer as R3 requires. Assertions unchanged.

## 9. Integration test design
itest/tests/spec-014.itest.ts pre-implementation. The test runs a scriptable OpenAI-compatible server (port 8190) capturing request bodies — redaction is asserted on real captured wire traffic. Org BYO config points at it. Expected red: 404 on llm-config, and guided (not scripted) replies in the flow assertions.
