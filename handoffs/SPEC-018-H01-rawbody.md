---
id: SPEC-018-H01
spec: SPEC-018
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-018-H01

## Implementation record
Custom application/json parser captures req.rawBody (string) then parses — empty-body 400 and all validation behavior preserved (full suite 25/25). Slack adapter verifies HMAC over req.rawBody exclusively; missing raw body → null (fail closed). Red run confirmed the old fallback was fail-OPEN (verified reconstructed bytes) — worse than the fragility G4 named.
