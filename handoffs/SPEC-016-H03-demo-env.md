---
id: SPEC-016-H03
spec: SPEC-016
workstream: infra
status: merged
depends_on: []
assignee: implementer
---

# SPEC-016-H03

## Implementation record
Env root: AR repo, SA + least-privilege IAM, internal core / public server, allowlist envs (G5 STRUCTURAL), composed DB-URL secrets, migrate Job, paused Scheduler w/ generated bearer

## Follow-ups
- Seed against internal core: run seed as a Cloud Run Job (or temporary ingress toggle documented in DEPLOY.md) — smooth this before the first real demo day.
- Unpause scheduler only after gate G2 (opt-out) ships; replace REPLACE_WITH_ORG_ID after seeding.
- Vendor secret containers (slack/teams/llm) added to main.tf when integrations are enabled.
