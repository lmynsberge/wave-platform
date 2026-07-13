---
id: SPEC-016-H01
spec: SPEC-016
workstream: server
status: merged
depends_on: []
assignee: implementer
---

# SPEC-016-H01

## Implementation record
Static SPA serving w/ /api-safe fallback, Secure cookies (G3 CLOSED), WEB_DIST/COOKIE_SECURE wiring; H01b dispatch bearer for Scheduler — all unit-tested red-first

## Follow-ups
- Seed against internal core: run seed as a Cloud Run Job (or temporary ingress toggle documented in DEPLOY.md) — smooth this before the first real demo day.
- Unpause scheduler only after gate G2 (opt-out) ships; replace REPLACE_WITH_ORG_ID after seeding.
- Vendor secret containers (slack/teams/llm) added to main.tf when integrations are enabled.
