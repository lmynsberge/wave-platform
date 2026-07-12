---
id: SPEC-014-H02
spec: SPEC-014
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-014-H02

## Implementation record
anthropic + openai_compatible clients (null on any failure); redactor: member names → stable [Pn], emails → [EMAIL], longest-first, restore round-trip; asserted on captured wire traffic

## Follow-ups
- Envelope encryption for BYO keys BEFORE design-partner launch (named gate).
- Staging verification: real Anthropic/OpenAI/self-hosted endpoints.
- Redaction currently name/email; consider phone numbers + free-text org terms later.
