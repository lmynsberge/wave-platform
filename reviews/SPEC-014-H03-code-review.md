---
id: SPEC-014-H03-code-review
subject: SPEC-014-H03
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-014-H03

## Verdict
`approved`

## Findings
- companionTurn: history-derived state, one LLM follow-up per skeleton answer, synthesis marker + quote-the-user guard with deterministic replacement, per-turn fail-closed; web+bridge share the engine
- Lock rule: the single locked-file edit carries ISS-005 + A1 references and a delta review — the process's intended path for test defects.
- Invariant 3: redaction runs before every outbound body; restore only maps placeholders issued this request.

## Checklist results
- [x] Locked itest green (amendment-tracked edit only)
- [x] No scope creep; per-handoff commit trail
