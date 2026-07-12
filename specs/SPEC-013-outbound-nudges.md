---
id: SPEC-013
title: Outbound nudge delivery via the bridge
status: done
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-013: Outbound nudge delivery via the bridge

## 1. Motivation
PROJECT_BRIEF Trust Model: "prioritizing our AI tools' proactive requests of interactions to discuss those lack-of-signal places." SPEC-009 built detection and SPEC-012 built the channel; this connects them: Wave initiates check-ins and reminders through the user's linked chat platform. The bots stop being reactive.

## 2. Requirements
- R1: Outbound transport interface per platform. `test` transport POSTs {externalId, text} to env `BRIDGE_TEST_OUTBOUND_URL` (harness-provided listener). Slack transport (chat.postMessage, env `SLACK_BOT_TOKEN`) and Teams transport (env `TEAMS_WEBHOOK_URL`) implemented behind the same interface; their network calls are follow-up-verified in a staging environment (recorded delegation — no platform accounts in CI)
- R2: Two nudge kinds v1, both addressed ONLY to the individual about their own data: `gap_checkin` (user has subjective attributes below established → invite to `checkin`) and `asks_reminder` (user has open asks → point to `asks`). Message text includes the actionable command
- R3: Dispatch trigger: POST /api/orgs/:orgId/nudge-dispatch — owner/admin only. Response is a CLOSED schema of exactly `{notified: number}` (aggregate count of messages sent). No userIds, kinds, or content: telling an org WHO has gaps would convert absence into an org-visible signal (INVARIANT 5); the count is the operational minimum
- R4: Delivery constraints: only linked identities receive anything; per (user, org, kind) dedup window of 7 days via a nudge log — re-triggering is safe and idempotent within the window
- R5: Scheduling is out of scope (the trigger is cron-callable); v1 dispatch is synchronous

## 3. Trust invariant check
5: R3 closed count-only response; gap content flows solely to the individual's own verified binding. 3: nudge text derives from the user's own gaps/asks, delivered to their externalId only — never aggregated, never org-visible. 1/2/4: N/A beyond existing guarantees.

## 4. Contracts
### 4.1 Server API
POST /api/orgs/:orgId/nudge-dispatch → 200 {notified} | 401 | 403 insufficient_role | 404 non-member
### 4.2 Data model (migration 005_nudge_log.sql)
bridge_nudge_log(user_id fk, org_id fk, kind text, sent_at timestamptz default now(), PRIMARY KEY(user_id, org_id, kind))
### 4.3 Outbound transport
interface OutboundTransport { send(externalId: string, text: string): Promise<boolean> } — selected by binding.platform.

## 5. Edge cases & failure modes
Transport failure → that message uncounted and NOT logged (retried next dispatch). User with both kinds pending → up to two messages (each deduped independently). Unlinked gap-holders contribute nothing to `notified`. Empty org → {notified: 0}.

## 6. Acceptance criteria
- AC1: linked user with subjective gaps → dispatch delivers a message to THEIR externalId containing "checkin"; response is exactly {notified: <n>} (closed keys asserted)
- AC2: linked user with an open ask → receives a message containing "asks"
- AC3: an unlinked user with identical gaps receives nothing and inflates no counts
- AC4: immediate re-dispatch → {notified: 0} and no new deliveries at the listener (7-day dedup)
- AC5: member trigger 403; anonymous 401
- AC6: every delivered payload's externalId belongs to the expected user — no cross-user leakage (asserted over the full captured set)

## 7. Out of scope
Cron/scheduler, per-user notification preferences/opt-out (follow-up before design-partner launch — flagged), digest batching, LLM-composed nudge text, staging verification of Slack/Teams transports.

## 8. Decomposition sketch
H01 migration + transports; H02 dispatch scan + dedup; H03 green.

## 9. Integration test design
itest/tests/spec-013.itest.ts pre-implementation. The test RUNS AN HTTP LISTENER (node:http, port 8189) capturing test-transport deliveries; global-setup exports BRIDGE_TEST_OUTBOUND_URL. Contract-only: message-content assertions limited to the command words R2 contracts. Expected red: 404 on dispatch route.
