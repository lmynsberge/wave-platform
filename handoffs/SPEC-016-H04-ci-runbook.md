---
id: SPEC-016-H04
spec: SPEC-016
workstream: infra
status: merged
depends_on: []
assignee: implementer
---

# SPEC-016-H04

## Implementation record
CI terraform fmt+validate job, WIF image publishing workflow, server image ships SPA, DEPLOY.md 15-min runbook; local tofu parse caught replication-block syntax errors pre-CI

## Follow-ups
- Seed against internal core: run seed as a Cloud Run Job (or temporary ingress toggle documented in DEPLOY.md) — smooth this before the first real demo day.
- Unpause scheduler only after gate G2 (opt-out) ships; replace REPLACE_WITH_ORG_ID after seeding.
- Vendor secret containers (slack/teams/llm) added to main.tf when integrations are enabled.
