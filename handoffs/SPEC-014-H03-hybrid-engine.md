---
id: SPEC-014-H03
spec: SPEC-014
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-014-H03

## Implementation record
companionTurn: history-derived state, one LLM follow-up per skeleton answer, synthesis marker + quote-the-user guard with deterministic replacement, per-turn fail-closed; web+bridge share the engine

## Follow-ups
- Envelope encryption for BYO keys BEFORE design-partner launch (named gate).
- Staging verification: real Anthropic/OpenAI/self-hosted endpoints.
- Redaction currently name/email; consider phone numbers + free-text org terms later.
