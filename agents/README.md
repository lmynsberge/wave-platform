# Agent Team

This repo is built by a tiered team of AI agents coordinated like a dev team. This directory is the **source of truth for how work happens**. Every agent reads this before acting. Every coordination artifact (spec, review, handoff, issue) is written down in the repo — if it isn't written down, it didn't happen.

## Tier structure

```
Tier 0  Orchestrator (human + lead agent)
        └── owns priorities, approves specs, resolves escalations
Tier 1  Spec Architect
        └── turns brief/roadmap items into specs (specs/)
Tier 1R Spec Reviewer
        └── adversarial review of every spec before work starts (reviews/)
Tier 2  Workstream Leads: core-rust | server-ts | web-react
        └── decompose approved specs into small task handoffs (handoffs/)
Tier 3  Implementer agents
        └── execute one handoff each; small, bounded scope
Tier 3R Code Reviewer agents
        └── review every implementation against its handoff + spec (reviews/)
```

## Roles

Each role has a charter in `agents/roles/`:

- `orchestrator.md` — priority setting, spec approval, escalation resolution
- `spec-architect.md` — writes specs from `docs/PROJECT_BRIEF.md` + roadmap
- `spec-reviewer.md` — reviews specs adversarially before approval
- `workstream-lead.md` — decomposition, handoff writing, integration ownership
- `implementer.md` — bounded execution of a single handoff
- `code-reviewer.md` — verification against handoff, spec, and repo standards

## Non-negotiable rules

1. **No work without a spec.** Every feature starts as a spec in `specs/`, status-tracked in its frontmatter.
2. **No spec proceeds unreviewed.** A Tier 1R review record must exist in `reviews/` with verdict `approved` before decomposition.
3. **Handoffs are small.** An implementer task should be completable in one focused session. If a handoff needs sub-decomposition, it goes back to the lead.
4. **Every implementation is reviewed.** Code review records live in `reviews/`, referencing the handoff ID.
5. **Blockers become issues.** Any ambiguity, spec conflict, or blocker is filed in `issues/` using the template — never silently resolved by an implementer. Escalation is one tier up.
6. **Spec changes re-trigger review.** If implementation reveals the spec is wrong, the spec is amended and re-reviewed; implementers do not deviate unilaterally.
7. **IDs everywhere.** Specs: `SPEC-###`. Handoffs: `SPEC-###-H##`. Issues: `ISS-###`. Reviews reference the ID they review.

## Artifact flow

```
docs/PROJECT_BRIEF.md
   └─> specs/SPEC-001-*.md            (Spec Architect)
        └─> reviews/SPEC-001-review.md (Spec Reviewer: approved | changes-requested)
             └─> handoffs/SPEC-001-H01-*.md ... (Workstream Lead)
                  └─> implementation (Implementer, on a branch)
                       └─> reviews/SPEC-001-H01-code-review.md (Code Reviewer)
                            └─> merge (Workstream Lead integrates)
issues/ISS-###.md at any point something blocks or conflicts
```

## Templates

- `agents/templates/SPEC_TEMPLATE.md`
- `agents/templates/HANDOFF_TEMPLATE.md`
- `agents/templates/REVIEW_TEMPLATE.md`
- `agents/templates/ISSUE_TEMPLATE.md`
