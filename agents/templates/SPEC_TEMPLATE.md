---
id: SPEC-###
title:
status: draft
author: spec-architect
signed_off: false
workstreams: [core, server, web]
---

# SPEC-###: <Title>

## 1. Motivation
Link to `docs/PROJECT_BRIEF.md` sections this serves. Why now (roadmap position).

## 2. Requirements
Numbered, testable. R1, R2, ... Each cites its brief grounding.

## 3. Trust invariant check
State explicitly how each of the 5 invariants (agents/roles/spec-architect.md) is upheld or why it is N/A.

## 4. Contracts
### 4.1 API (server-facing)
Endpoints, methods, request/response schemas, status codes, authz per endpoint.
### 4.2 Core service interface (Rust)
Functions/endpoints exposed by core to server, with types.
### 4.3 Data model
Tables/columns/migrations. Ownership: which service owns which table.
### 4.4 Events (if any)

## 5. Edge cases & failure modes
Empty states, authz failures, race conditions, partial data.

## 6. Acceptance criteria
Numbered, testable. AC1, AC2, ...

## 7. Out of scope
Explicit non-goals to prevent creep.

## 8. Decomposition sketch
Suggested handoff boundaries per workstream (leads may refine).

## 9. Integration test design
Path of the spec's itest file; helper/API design notes; which ACs are covered directly vs delegated (with pointers). File must be red pre-implementation.
