---
id: SPEC-007-H04
spec: SPEC-007
workstream: server
status: merged
depends_on: [SPEC-007-H01]
assignee: implementer
---

# SPEC-007-H04

## Implementation record
itest 7/7 green, zero edits to locked test file; full suite 23/23; server units 13/13

## Follow-ups
- LLM provider spec must contract the quote-the-user synthesis property (review finding 4).
- answersSinceSynthesis marker-string detection is provider-coupled; move to a message metadata column when a second provider lands.
