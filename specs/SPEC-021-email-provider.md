---
id: SPEC-021
title: Injectable email provider — invite delivery (no-op default)
status: approved
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-021: Injectable email provider

## 1. Motivation
SPEC-020 ships invite links without delivery. Orchestrator direction: make the email provider INJECTABLE with a NO-OP default that logs and counts metrics — the seam exists now, a real vendor (SES/SendGrid/Postmark) is a later drop-in, and nothing in the product path ever depends on email succeeding.

## 2. Requirements
- R1: `EmailProvider { send(msg: {to, subject, text}) -> Promise<boolean> }`. Providers: `noop` (DEFAULT — structured log line `email.noop` with to/subject + in-process metric increment; returns true) and `test` (POSTs the message to env `EMAIL_TEST_URL` — the harness listener pattern, and the template for any future HTTP vendor). Selection: env `EMAIL_PROVIDER` (default `noop`); unknown value → noop with a warning (fail soft, never fail closed on email)
- R2: Metrics: in-process counter module (`metrics.increment(name)`, `metrics.snapshot()`), counting `email.sent.<provider>` and `email.failed.<provider>`. Surfaced in logs per send; an exposure endpoint is explicitly deferred to an observability spec
- R3: Invitation creation sends the invite email: to the invited address, subject naming the org, body containing the accept link `${APP_BASE_URL}/invite/<token>` (path-only when APP_BASE_URL unset). Send runs AFTER the invitation is durably created and NEVER fails the request — a failed/no-op email still yields 201 with the copyable link (the SPEC-020 flow remains fully functional)
- R4: Terraform: `APP_BASE_URL` and `EMAIL_PROVIDER` join the server env allowlist as variables (defaults: computed URL left to operator, provider `noop`)

## 3. Trust invariant check
The email contains exactly what the admin can already copy (org name, role, link) — no scores, no gaps. Email-binding of acceptance (SPEC-020 R4) is unaffected. No new surfaces.

## 4. Contracts
See R1. Invitation endpoint contract unchanged (SPEC-020 §4 holds; locked spec-020 itest is the regression guard).

## 5. Edge cases & failure modes
Test provider unreachable → send false → `email.failed.test` incremented, invite still 201. Re-invite → new email with the new token. Noop in prod is a VALID launch configuration (admins copy links), not an error state.

## 6. Acceptance criteria
- AC1 (itest, test provider): creating an invite delivers a captured email to the invited address whose body contains `/invite/<token>` (the actual token) and whose subject contains the org name
- AC2 (itest): email listener DOWN → invite creation still 201 and the link works end-to-end (accept path unaffected)
- AC3 (unit): noop provider logs and increments `email.sent.noop`; resolve() defaults to noop; unknown EMAIL_PROVIDER → noop
- AC4 (unit): failed send increments `email.failed.<provider>` and never throws
- AC5: SPEC-020 locked itest remains green (contract untouched — pointer)

## 7. Out of scope
Real vendor adapters (SES/SendGrid — drop-in behind R1), HTML templates, retries/queues, metrics HTTP exposure, notification emails beyond invites.

## 8. Decomposition sketch
H01 email + metrics modules (unit-red); H02 invite wiring + harness env (itest-red); H03 TF vars + artifacts.

## 9. Integration test design
itest/tests/spec-021.itest.ts pre-implementation; listener on 8192 (harness exports EMAIL_TEST_URL, EMAIL_PROVIDER=test). AC2's listener-down case runs by closing the listener mid-file. Expected red: no emails captured. Noop/metrics are process-internal → unit tier (recorded delegation).
