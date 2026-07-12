---
id: SPEC-014-H02-code-review
subject: SPEC-014-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Code review: SPEC-014-H02

## Verdict
`approved`

## Findings
- anthropic + openai_compatible clients (null on any failure); redactor: member names → stable [Pn], emails → [EMAIL], longest-first, restore round-trip; asserted on captured wire traffic
- Lock rule: the single locked-file edit carries ISS-005 + A1 references and a delta review — the process's intended path for test defects.
- Invariant 3: redaction runs before every outbound body; restore only maps placeholders issued this request.

## Checklist results
- [x] Locked itest green (amendment-tracked edit only)
- [x] No scope creep; per-handoff commit trail
