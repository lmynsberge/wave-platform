---
id: SPEC-018
title: Gate G4 — Slack signature verification over the true raw body
status: done
author: spec-architect
signed_off: true
workstreams: [server]
---

# SPEC-018: Slack raw-body signature hardening (G4)

## 1. Motivation
Launch gate G4 (SPEC-012 follow-up): the Slack adapter verifies HMAC over `rawBody ?? JSON.stringify(req.body)`. The fallback re-serializes parsed JSON, so any canonicalization difference from Slack's actual bytes (spacing, key order, unicode escapes, number formatting) makes valid requests fail — and verifying anything other than the received bytes is cryptographically wrong. Signatures must be computed over the exact bytes received, always.

## 2. Requirements
- R1: The server captures the raw request body string for JSON requests (custom content-type parser; no new dependency) and exposes it as `req.rawBody`
- R2: The Slack adapter verifies HMAC over `req.rawBody` ONLY. The re-serialization fallback is REMOVED; a missing raw body fails verification (fail closed, never fail open to a reconstruction)
- R3: Existing behavior is otherwise unchanged: JSON parsing, all routes, other adapters (Teams/test verify headers, not bodies — unaffected)

## 3. Trust invariant check
Strengthens the bridge's binding-as-authorization root: identity verification now stands on exact bytes. No data-surface changes.

## 4. Contracts
`req.rawBody?: string` available on JSON requests. Adapter behavior per SPEC-012 §4 otherwise unchanged.

## 5. Edge cases & failure modes
Non-JSON content types: untouched (Slack Events API is JSON). Empty body with JSON content-type: parser must preserve fastify's existing 400. Large bodies: fastify's default body limit still applies to the string parser.

## 6. Acceptance criteria (unit — crypto/byte-level is unit scope per SPEC-012 AC6 precedent; recorded delegation, no new itest)
- AC1: a Slack event whose raw JSON uses non-canonical spacing/key order, signed over those exact bytes, VERIFIES and is processed (fails today — the red)
- AC2: the same raw bytes with a tampered signature → 401; stale timestamp → 401 (regression from SPEC-012 suite holds)
- AC3: adapter with no rawBody available → verification fails (fallback removed)
- AC4: existing server suite green — JSON parsing behavior unchanged everywhere else (empty-body 400s, zod validation)

## 7. Out of scope
G7 rate limiting (deferred by decision), Slack slash-command form-encoding support, Teams AAD JWT.

## 8. Decomposition sketch
H01: raw-body parser + adapter change + green.

## 9. Integration test design
No new locked itest (no contract change; byte-level crypto is unit scope — same delegation as SPEC-012 AC6, pointer: server/test/slack-adapter.test.ts + new app-level cases). Red requirement applies to the unit tier: AC1 must fail against current main.
