---
id: ISS-005
severity: blocking
raised_by: implementer
relates_to: SPEC-014 (locked itest, AC4)
status: resolved
---

# ISS-005: SPEC-014 AC4 test sequence contradicts R3

## Problem
AC4 sends its message immediately after the AC2 redaction test, whose turn ended on an LLM FOLLOW-UP. Per R3, the turn after a follow-up answer is a deterministic skeleton advance — no LLM call. AC4 asserts a captured LLM attempt, so the locked test encodes a state R3 forbids. The implementation is spec-conformant; the test's interview arithmetic is wrong.

## Options
A) Weaken AC4 (drop the captured-attempt assertion) — REJECTED: reintroduces the red-quality flaw the review fixed.
B) Amend the locked test to insert one advancing turn (answer the pending follow-up) so AC4's message is a skeleton answer — minimal, preserves the strengthened assertion. ✅

## Resolution
Option B via SPEC-014 amendment A1. Spec Reviewer delta-reviewed: the edit adds one turn of setup and no assertion changes; approved. Locked file modified WITH this issue + amendment reference (lock rule satisfied).
