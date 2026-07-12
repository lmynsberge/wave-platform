---
id: SPEC-007-H03
spec: SPEC-007
workstream: server
status: merged
depends_on: [SPEC-007-H01]
assignee: implementer
---

# SPEC-007-H03

## Implementation record
Share copies content at share time; visibility = self + upward chain, 404 outside (incl. admins); foreign/unknown messageId one indistinguishable 400

## Follow-ups
- LLM provider spec must contract the quote-the-user synthesis property (review finding 4).
- answersSinceSynthesis marker-string detection is provider-coupled; move to a message metadata column when a second provider lands.
