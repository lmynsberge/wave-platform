# Prototype Learnings

Two prototypes feed this project. Neither is a code foundation; both are idea and domain-model inputs.

## wave-preview (Replit spike — org side + objective score)

Stack: React 18 + Vite + Shadcn/Tailwind, Express + Drizzle + Postgres (Neon), GPT-4 analysis, BullMQ workers, Culture Amp import.

**Keep (domain model & concepts):**
- Multi-tenant core: `organizations`, `users`, `user_organizations` junction, RBAC (4 roles, granular permissions, middleware enforcement)
- Performance data separation: financial metrics / performance stats / working scores / feedback as distinct tables
- Feedback modes: Basic (3q) / Advanced (10q) / Simple (intelligent balancing toward fewest-response areas) — the balancing mode prefigures our signal-gap nudging
- WAR score concept: composite with weighted sub-scores (contribution .25, leadership .20, client .20, productivity .15, conflict .10, collaboration .10) — weights are a starting hypothesis, not gospel
- AI review analysis extracting strengths/improvements + confidence — confidence prefigures significance gating
- HRIS ingestion path (Culture Amp bulk import + auto user creation) validates Layer 1 ingestion
- Public profile + "Find Where You Rank" assessment as an individual-acquisition hook

**Discard / rework:**
- Manager rating table where managers originate scores — violates the validator model; rework into validation records
- Hybrid assessment scoring (60% questionnaire / 40% AI) — replace with evidence-gated signal + significance thresholds
- Express/Drizzle implementation itself — we rebuild on Rust core + fastify BFF
- GPT-4/OpenAI coupling — model-agnostic AI layer in server

## journaling (personal reflection system — individual side)

A Claude-Code-skill-driven journaling repo: weekly sprint journals, performance reviews, growth goals, values framework, plans as context.

**Keep (the approach — this is the chatbot's DNA):**
- Guided interview → synthesis loop: 7 questions (mood, open reflection, shipped, learnings, hard stuff, team, process) → structured entry. This is the private-companion conversation model
- Context assembly before the interview: values + growth goals + plans + task-system data. The chatbot should assemble personal context the same way
- Values-in-action mapping: connecting concrete work to a named values framework — directly reusable for attribute evidence ("Go Beyond → See it through" maps to attribute taxonomy)
- Growth goals feeding reflections (semi-annual goals referenced weekly) — the iterative-goals loop
- Review generation from journal history: self/peer/manager drafts synthesized from accumulated entries — kills the recency-bias problem in reviews
- Enrichment via integrations (Slack interactions, Jira/Linear items) — optional signal sources, opt-in
- Voice & editorial rules: concise, results-first, honest, no flattery — matches "honest enough to say wrong fit"
- Mini retro pattern: what happened → what changes

**Notable structural idea:** plans/ directory as raw work context that journaling draws from — in-product analog: the chatbot can ingest the user's own artifacts as reflection context.

## Synthesis

wave-preview ≈ Layers 1, 2, 4 of the v1 scope (ingestion, feedback loop, org view). journaling ≈ Layer 3 (individual experience). The product is the marriage: journaling's private reflection generates candidate evidence; wave's validation and scoring pipeline turns shared evidence into portable signal.
