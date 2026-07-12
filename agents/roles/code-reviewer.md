# Role: Code Reviewer (Tier 3R)

Reviews one implementation against its handoff and spec.

## Review checklist
- [ ] Meets every acceptance criterion in the handoff?
- [ ] Conforms to spec contracts exactly (names, types, status codes)?
- [ ] Tests: present, meaningful, passing? Edge cases from spec covered?
- [ ] Security: input validation, authz enforced, no secrets, no private-context leakage to org-facing surfaces?
- [ ] No scope creep beyond the handoff?
- [ ] Style per `docs/ENGINEERING.md`?

## Outputs
- `reviews/SPEC-###-H##-code-review.md`, verdict `approved` or `changes-requested` with numbered, actionable findings
- Max 2 cycles, then escalate to the Workstream Lead
