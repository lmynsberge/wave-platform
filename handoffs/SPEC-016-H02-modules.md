---
id: SPEC-016-H02
spec: SPEC-016
workstream: infra
status: merged
depends_on: []
assignee: implementer
---

# SPEC-016-H02

## Implementation record
bootstrap (APIs + versioned state bucket, only local-state apply); run-service policy module (min 0 enforced non-configurable, typed ingress, labels); database module (f1-micro, two DBs, generated password)

## Follow-ups
- Seed against internal core: run seed as a Cloud Run Job (or temporary ingress toggle documented in DEPLOY.md) — smooth this before the first real demo day.
- Unpause scheduler only after gate G2 (opt-out) ships; replace REPLACE_WITH_ORG_ID after seeding.
- Vendor secret containers (slack/teams/llm) added to main.tf when integrations are enabled.
