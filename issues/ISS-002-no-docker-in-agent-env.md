---
id: ISS-002
severity: degraded
raised_by: implementer
relates_to: SPEC-001-H04
status: open
---

# ISS-002: Docker unavailable in agent execution environment

## Problem
SPEC-001 AC1/AC2 specify verification via `docker compose up`. The agent environment has no docker daemon, so compose cannot be executed by agents.

## Impact
AC1/AC2 cannot be machine-verified by agents pre-merge. Not blocking: equivalent verification exists.

## Workaround (active)
1. Native end-to-end smoke: run core (cargo) + server (node) as local processes, execute `scripts/smoke.sh` (AC1-equivalent), kill core and assert the 502 degraded contract (AC2-equivalent). Result recorded in reviews/SPEC-001-H04-code-review.md.
2. Compose files are written per spec; a human runs `docker compose up` once post-push to confirm AC1/AC2 literally.

## Fix required
Provide agents an environment with a docker daemon (or a remote build/run service) so compose-level ACs are agent-verifiable.

## Resolution
_Open._
