---
id: SPEC-018-review
subject: SPEC-018
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-018 (Slack raw-body, gate G4)

## Verdict
`approved`

## Findings
1. (verified, A2) RED unit-tier per §9: AC1 fails (non-canonical bytes rejected — the exact bug), AC3 fails (fallback currently verifies WITHOUT raw bytes — worse than suspected: it's fail-open-to-reconstruction, not just fragile). Recorded.
2. (major, resolved in draft) R2 removes the fallback rather than patching it: verifying reconstructed bytes is wrong even when it happens to work. Fail closed is the only correct posture for signature material.
3. (minor) Custom string parser over a dependency: right for one behavior; §5 pins the empty-body-400 regression, AC4 pins everything else.

## Checklist results
- [x] Red both new cases, right reasons recorded (A2); delegation consistent with SPEC-012 AC6 precedent
- [x] No contract changes; locked itests unaffected by design
