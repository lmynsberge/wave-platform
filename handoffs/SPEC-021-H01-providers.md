---
id: SPEC-021-H01
spec: SPEC-021
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-021-H01

## Implementation record
metrics counters; noop (structured log + email.sent.noop), test HTTP provider (send/fail counts), fail-soft resolution w/ unknown-provider warning

## Follow-ups
- Real vendor adapter (SES/SendGrid) drops in behind EmailProvider; HTML templates later; metrics HTTP exposure in an observability spec.
