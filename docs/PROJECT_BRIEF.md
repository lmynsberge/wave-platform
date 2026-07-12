# Project Brief
_Last updated: June 27, 2026_

---

## Status
🟢 **Built through v1 + 4 post-v1 specs** — 14 feature specs + 1 QA spec done, every trust invariant enforced in code and locked tests (49 integration / 18 server / 14 web tests green). Updated July 12, 2026.

## What exists (one paragraph)
Multi-tenant identity with reporting chains; an evidence/validation engine where managers validate but never rate (direct AND transitive, enforced + tested); significance gating with diversity thresholds and drop-not-negative manager semantics; a private hybrid AI companion (guided skeleton + LLM follow-ups, multi-provider incl. org-BYO and self-hosted, redaction-first) with an explicit two-step sharing boundary; nudges that route around signal-starving managers without ever showing the org who has gaps; hard-metric ingestion with within-org percentile normalization; a deliberately thin manager view with a closed schema; and Slack/Teams bots sharing the same companion. See docs/ROADMAP.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.

## What building it taught us (brief-level learnings)
1. **The trust invariants are implementable as structure, not policy.** Validator-not-rater, absence-neutral, sharing-indistinguishability all became database constraints, closed schemas, and 404 semantics — and locked tests make regressions a build failure, not a judgment call.
2. **"Negative space" contracts are the anti-surveillance tool.** Specifying what a response may NOT contain (team-signal's exact five keys, dispatch's count-only) turned out stronger than specifying what it must.
3. **Absence-privacy goes further than the original brief said:** gaps aren't just neutral — they're the individual's private information. No org surface may enumerate who has them.
4. **The upward chain generalizes.** Manager assessments entering as invisible pending_upward until the manager's manager validates turned invariant 1 from a prohibition into a workflow.
5. **Redaction-first makes the LLM question tractable:** identifiers never leave the boundary, so provider flexibility (BYO, self-hosted) is a config choice rather than a privacy negotiation.

---

## The Idea
A two-sided platform: personal career growth tool for individuals + performance intelligence layer for organizations. Connected by a portable, org-agnostic rating/profile that travels with the person.

---

## Problem Being Solved
- **Individual:** People lack honest, emotionally intelligent guidance on career growth — including whether they're in the wrong role or company entirely.
- **Org:** Organizations lack objective insight into employee performance and fit, and struggle to find right-fit talent across company boundaries.

---

## Target User
- **Primary (individual):** Growth-minded professionals who want honest career feedback, not just validation.
- **Primary (org):** People managers / HR / leadership who want performance clarity and better hiring signal.

---

## Key Goals (Iterative)
1. *To be defined once idea is focused*

---

## Open Questions (revised)
- ~~Trust problem~~ → resolved in architecture (segmentation, sharing boundary, validator model) — remaining trust work is the arbitration process (still pinned) and bias instrumentation (BACKLOG "founding bets")
- ~~v1 sequencing~~ → built individual-first; manager UI is now the biggest product gap
- **The agnostic rating's public form**: scores exist per-attribute with normalization; the portable cross-org profile (form, governance, "drop worst of X" lifecycle) remains undesigned
- **"Wrong fit" honesty**: the companion has the private context to say it, but when/how it should is an unopened product+ethics design
- **Design-partner pursuit**: profile decided (150–1,000, growth culture, objective-metric industry); target list and pitch not started
- **Premium boundary**: principle decided (outward-facing free); the concrete feature split is not

---

## The Org-Agnostic Rating
- **Structure:** Overall score + competency breakdown (like LinkedIn endorsements but backed by real, longitudinal performance data)
- **Ownership:** Managers own/input the score. Individual cannot change it but can trigger an org review. Company (us) acts as initial arbiter.
- **Objectivity spectrum:**
  - Hard metrics (billable hours, sales, tickets) → objective, directly normalizable
  - Soft metrics (leadership, communication) → deferred to other signals where objective data unavailable
- **Normalization:** Scores normalized across orgs so ratings are comparable regardless of company size/prestige
- **Longitudinal:** Built across time, not a single snapshot

---

## Trust Model

**Individual data control**
- Segmented chatbot memory so private context doesn't bleed into shared/org-facing context
- Individual chooses what to share; feedback preferences configurable (anonymous vs. named)
- All feedback goes to individual + manager; individual can process it with the chatbot and choose whether to share the result

**Manager = validator, not rater (key constraint)**
- Managers CANNOT originate scores on non-objective attributes
- They can VALIDATE feedback (positive or constructive); non-validation = "drop / lack of signal," NEVER a negative
- Managers cannot introduce attributes the individual hasn't been objectively graded on by someone else
- Manager-originated attribute grades chain upward to their own manager to validate
- Net effect: score is additive + evidence-gated. A biased manager can suppress, never inflict.
- ⚠️ Residual risk: suppression is still power (manager can starve someone of signal). Mitigated by absence-detection + proactive AI nudges (see below).

**Absence handling (#4)**
- Lack of data is meaningful: neutral, not negative, but factored in
- AI proactively requests interactions to fill "lack of signal" gaps
- System notices signal-starvation and routes around a suppressing manager

**Privacy of sharing (#2)**
- Do NOT publish whether someone shared or not
- 📌 TODO: design so the system cannot tell the difference between shared vs. not-shared (prevent inference from absence of sharing)

**Disputes / arbitration (#3 — PINNED, needs better process)**
- Direction: dispute chains upward until both disagreeing parties agree on a chosen arbiter at the company
- "Proof" mechanism still unresolved — must avoid coercive reveal of private chatbot context
- Tied to score-dropping logic (see below)

**Score ownership & lifecycle (#5)**
- WE own the scores; all app users can see them
- Likely "drop worst of last X scores" mechanism
- Disputed scores generally get dropped (overlaps with #3 analysis)

---

**Statistical significance as gatekeeper (origination logic)**
- Hard metrics self-originate from system data (no human originator needed)
- Subjective attributes require a statistically significant volume of DIVERSE feedback before becoming signal
- High threshold is intentional — signal is meant to be hard to earn, which defeats friendly-farming
- When signal is absent or near-threshold, AI nudges interactions with other users to request feedback in that area → fills gaps + forces diversity of thought
- Peer-validates-peer: lightweight (yes / no / no-signal) validation on e.g. "has leadership" both validates the original signal AND serves as its own data point
- Validation and origination collapse into the same cheap primitive — chainable and defensible

---

**Adversarial robustness (this is a reputation/trust system, closer to fraud detection than HR software)**

- *Collusion rings (#2):* Circular/reciprocal feedback ("I'll yes yours, you yes mine") is a real farming vector. TODO: build reciprocity-detection (A & B disproportionately validating each other), weight validations by validator independence, investigate + report on rings. Flagged as an enhancement assuming we start with the right companies.
- *Correlated bias within a culture (#1):* Significance ≠ fairness. A whole team can share a blind spot (e.g. "assertive == leadership"), producing diverse-but-consistently-biased signal.
  - **Structural defense (strong):** Cross-org normalization. A single org's bias gets averaged against orgs that don't share it, so local biases diffuse/decay across companies. To persist, a bias would have to be hacked into *every* org on the platform.
  - **Residual gap — universal bias:** Biases shared across ALL cultures (e.g. gender/accent bias in leadership perception) survive cross-org normalization since there's no unbiased cohort to normalize against. Needs deliberate instrumentation:
    - *Outcome-anchoring:* periodically tie subjective attributes back to objective downstream outcomes (retention, delivery, promotion success). If "leadership" signal doesn't predict leadership outcomes, it's measuring vibes.
    - *Counterfactual auditing:* continuously check whether protected-attribute proxies predict scores after controlling for objective metrics (standard algorithmic-fairness tooling).
    - *Cold-start interference:* early on, normalization is weak — monitor and down-weight subjective attributes until enough cross-org mass exists.

---

## V1 Scope (First Org Deployment)

**Layer 1 — Ingestion & identity (unglamorous, mandatory)**
- SSO + org chart sync (reporting lines drive the validation chain)
- Hard-metric ingestion from ≥1 system of record (time-tracking/billing for professional services) — the objective-data spine
- Historical performance review import if available (jump-starts longitudinal picture)

**Layer 2 — Feedback + validation loop (core mechanic)**
- Lightweight feedback capture (peer, manager, report) tied to defined attributes
- Yes / no / no-signal validation primitive
- Manager-as-validator flow with upward chain
- Significance thresholds live from day one (attributes show "insufficient signal" rather than premature scores)

**Layer 3 — Individual experience (the reason people log in)**
- Segmented chatbot: private growth companion + sharing boundary
- Personal profile: attributes, signal status, trajectory
- Feedback processing flow: receive → discuss privately → choose what to share
- Proactive nudges to fill signal gaps

**Layer 4 — Org view (deliberately thin)**
- Manager dashboard: team signal health, validation queue
- NOT surveillance: no engagement metrics, no shared/not-shared visibility

**Explicitly out of v1:** cross-org normalization, arbitration process, automated collusion detection, full premium tier.

**Risk callouts:** riskiest build = chatbot; riskiest integration = hard-metric ingestion.

---

## Raw Notes & Ideas
- Most career tools are optimistically useless — this one should be honest enough to say "wrong fit"
- "Organization-agnostic rating" implies portability across companies — like a credit score for professional growth/fit
- Being human is part of a career — emotional intelligence is in scope, not a nice-to-have
- Potential dual-sided marketplace dynamic (individual ↔ org)
- Normalization is load-bearing — "100/500 billable hours" means different things across industries, seniority levels, company types. Likely needs cohort-based normalization (same role/industry/seniority)
- Arbitration position is powerful but creates legal/reputational exposure — bias disputes, wrongful rating claims, etc. May need to evolve toward self-governing over time
- **Key open question:** Does data get input natively in-platform, or ingested from existing HR tools (Workday, Lattice, etc.)?

---

## Decisions Made
1. **GTM sequencing: lead with both, focus on the individual.** The individual growth product is the center of gravity. Launch with a first organization that champions its employees — the org acts as distribution + data substrate, and its desire for employee success naturally carries us toward cross-org. Not org-as-customer vs. individual-as-customer; it's individual-first *through* an aligned org.
   - Implies: need to define free vs. premium tiers for individuals
   - Implies: first org is effectively a design partner — selection criteria matter enormously
2. **Design partner profile: 150–1,000 employees with an existing growth culture** (real 1:1s, development plans, coaching). Prefer industries with strong objective metrics (professional services / billable hours, sales / quota) so hard-metric normalization works from day one.
3. **Individual pricing principle: outward-facing value is always free.** The rating/profile (the network-effect asset) is free. Premium = deeper self-serve tools — coaching depth, emotionally intelligent guidance, fit analysis.

---
