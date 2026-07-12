---
id: SPEC-013-H02
spec: SPEC-013
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-013-H02

## Implementation record
Scan bindings → gap_checkin + asks_reminder candidates → 7-day dedup log → send; failures uncounted+unlogged for retry; {notified} closed schema

## Follow-ups
- Per-user notification opt-out REQUIRED before broad rollout (review finding 3).
- Cron/scheduler wrapper for the trigger endpoint.
- Staging verification of Slack/Teams transports with real credentials.
