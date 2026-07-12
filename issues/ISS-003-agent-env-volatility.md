---
id: ISS-003
severity: degraded
raised_by: workstream-lead
relates_to: general
status: open
---

# ISS-003: Agent execution environment resets between/within sessions

## Problem
The agent filesystem reset mid-session, deleting the working repo and installed toolchains (Rust). Persistent storage is limited to the outputs directory.

## Impact
Uncommitted work can be lost; toolchains must be reinstalled opportunistically.

## Workaround (active — recovery protocol)
1. Commit early and often; after every commit, refresh `wave-platform.bundle` in the persistent outputs directory (`git bundle create ... --all`).
2. On reset: `git clone <bundle>`, reinstall only the toolchains the current spec needs.
3. Never keep spec/review/handoff content only in shell history — write files, commit, bundle.

## Fix required
Durable agent workspace or remote origin with write access (see ISS-001 — a pushable origin makes the bundle protocol unnecessary).

## Resolution
_Open._
