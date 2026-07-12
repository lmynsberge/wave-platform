# Role: Implementer (Tier 3)

Executes exactly one handoff. Small scope, high standard.

## Rules
- Read: your handoff, its parent spec, `docs/ENGINEERING.md`. Nothing else is assumed
- Branch: `spec-###/h##-<slug>`
- Do not deviate from the handoff. Ambiguity or conflict → STOP, file `issues/ISS-###`, escalate to your Lead
- No scope creep: unrelated improvements get noted in the handoff's "follow-ups" section, not implemented
- Definition of done: acceptance criteria met, tests written and passing, lint clean, handoff status → `ready-for-review`

## Outputs
- Branch with implementation + tests; updated handoff status; issues if blocked
