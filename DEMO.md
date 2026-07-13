# Demo: Meridian Consulting

A full walkthrough deployment with believable data. Two ways to run it.

## Option A — docker compose (demo machine)
```bash
docker compose up -d --build
docker compose exec server node dist/migrate.js      # server-owned migrations (core migrates itself on boot)
node scripts/seed-demo.mjs http://localhost:8080     # CORE_URL=http://localhost:8081 if seeding from the host
```
Open http://localhost:5173. Password for everyone: `demo-password-1`.

## Option B — local processes (dev machine)
```bash
# postgres running with user/db wave; then:
(cd server && DATABASE_URL=postgres://wave:wave@localhost:5432/wave npx tsx src/migrate.ts)
(cd core && cargo run) &
(cd server && npx tsx src/index.ts) &
(cd web && npx vite) &
CORE_URL=http://localhost:8081 node scripts/seed-demo.mjs http://localhost:8080
```

## The walkthrough (12 minutes)

**1. Priya — the individual (log in as priya@meridian.demo)**
- *Profile*: three attribute cards. `Client communication` is **established, score 100** — point at the counts: 5 evidence, 4 voices, 5 validators, **and one "no"** that didn't move the score. That's drop-not-negative, live: Dana (skip-level) disagreed, and her disagreement is recorded but structurally cannot lower a report's score. `Billable hours` shows the objective spine: **67th percentile** in the org's established cohort. `Mentorship` is emerging — quiet badge, no red anywhere, "N more validators to established" from live policy.
- *Companion*: a completed check-in ending in a synthesis in Priya's own words, marked **Shared**. Emphasize: two clicks to share, private by default, the org cannot tell shared from unshared.
- *Give & Grow*: mentorship gap with one-tap ask buttons (note who's missing: her managers — the system won't suggest an invalid act), and Jonah's open ask with an inline composer.

**2. Marcus — the manager (marcus@meridian.demo)**
- *Team*: three reports with signal maturity; a real validation queue. Validate one item live — the count reconciles. Read the helper copy aloud: *"Disagreeing simply drops it from scoring — it never lowers anyone's score."* The invariant, made legible.
- Priya's shared reflection is visible via her profile shares — nothing else from her companion is.

**3. Dana — the skip-level (dana@meridian.demo)**
- *Team*: Marcus's pending **assessment of Elena** awaits her decision. Approve it live: it becomes real evidence. Or Drop it: *"identical to never submitted."* A manager's judgment needs a manager's validation — the upward chain.

**4. Ade — admin (ade@meridian.demo)**
- Ingestion (`POST /api/orgs/:id/ingest/metrics`) and, if configured, LLM config + nudge dispatch. With Slack linked, `checkin` in Slack continues the SAME companion thread — one companion, two doors.

## Reset
Drop and recreate the databases, re-migrate, re-seed.
