---
id: SPEC-007-H02
spec: SPEC-007
workstream: server
status: merged
depends_on: [SPEC-007-H01]
assignee: implementer
---

# SPEC-007-H02

## Implementation record
GET/POST companion routes, owner-only with 404 semantics, segment auto-creation with opening question

## Follow-ups
- LLM provider spec must contract the quote-the-user synthesis property (review finding 4).
- answersSinceSynthesis marker-string detection is provider-coupled; move to a message metadata column when a second provider lands.
