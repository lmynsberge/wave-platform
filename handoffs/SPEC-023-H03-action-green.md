---
id: SPEC-023-H03
spec: SPEC-023
workstream: server
status: merged
depends_on: [SPEC-023-H02]
assignee: implementer
---

# SPEC-023-H03: GitHub Action + green + future issues

## Objective
`workflow_dispatch` action wraps the script (AC6); all suites green; deferred questions filed as GitHub issues.

## Context
SPEC-023 R8, §7. WIF pattern: `.github/workflows/deploy-images.yml`. DB via Cloud SQL Auth Proxy; core via the documented demo-env ingress toggle (future issue tracks the Cloud Run Job path).

## Task
- `.github/workflows/merge-accounts.yml` (inputs from/into/dry_run; concurrency group to serialize merges)
- Full itest + component suites; traceability row; file §7 future issues (`ISS-###`)

## Acceptance criteria
1. AC6 reviewer-inspected; suites green; issues filed and linked in the PR

## Follow-ups (implementer notes)
—
