---
id: SPEC-022-H02-code-review
subject: SPEC-022-H02
reviewer: code-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-022-H02

## Verdict
`approved`

## Findings
1. minor — `JoinOrgs` renders in the main pane for ANY zero-org state and hides orgs the user is already in; pending/declined chips match R6/R8. Rail copy updated to point at the panel.
2. nit — Approve/decline invalidate only the join-request query; the members list refreshes on its own next fetch. Acceptable — Settings doesn't render members.
3. nit — First join.test.tsx draft used a regex that matched both org name and slug; tightened to exact-text (test-only fix, pre-merge).

## Checklist results
- [x] Conforms to handoff (JoinOrgs.tsx, App.tsx zero-org branch, SettingsView admin section, join.test.tsx)
- [x] AC5 covered: directory render + POST fire; pending chip; Settings pending list + approve/decline fire
- [x] Query/mutation patterns match existing SettingsView conventions (TanStack Query, invalidation)
- [x] Web suite 30/30, lint clean
- [x] No scope creep; no locked-file diffs
