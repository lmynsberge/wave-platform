# Handoff → Local Terminal Agent

_Audience: an AI coding agent (Claude Code or similar) running locally in a terminal, with
shell access, a GitHub MCP server or the `gh` CLI, and the ability to run Docker, Node, Rust,
and `gcloud`/`terraform`. You are picking up a fully-built project. This document tells you
what exists, the three concrete jobs to do, and where the sharp edges are._

---

## 0. Orientation (read first)

**What this repo is.** Wave — an individual-first professional-growth platform with an
org-agnostic, evidence-gated performance signal. It is **built through SPEC-021** (21 feature
specs + 1 QA spec), all developed test-first. Full status: `docs/ROADMAP.md`. Product concept
and trust model: `docs/PROJECT_BRIEF.md`. Architecture + diagrams: `docs/ARCHITECTURE.md`,
`docs/diagrams/`. Everything remaining is catalogued in `docs/BACKLOG.md`.

**How this repo works (important — respect it).** All work flows through a written process:
spec → spec review → decomposition → implementation → code review. Nothing merges without a
spec and a review. The unit of truth is the `specs/` + `reviews/` + `handoffs/` trail, and
`docs/TRACEABILITY.md` maps specs → commits. **Integration tests in `itest/tests/` are
spec-locked** (SPEC-QA-001): one black-box file per spec, changed ONLY via a reviewed spec
amendment. If you touch a locked test without a spec reference, you are doing it wrong — see
`agents/WORKFLOW.md` "Locked-test defect path."

**Stack / layout.**
- `core/` — Rust (axum, tokio-postgres), the deterministic domain engine (scoring, significance,
  normalization). Migrates itself on boot. 4 migrations.
- `server/` — Node + TypeScript (fastify), the BFF/API, trust gates, companion engine, bridge,
  LLM layer, email. 8 migrations, run via `node dist/migrate.js` (or `npx tsx src/migrate.ts`).
- `web/` — React 18 + Vite.
- `itest/` — spec-locked integration harness (boots real core binary + server + fresh Postgres DBs).
- `infra/` — Terraform (opinionated; rules in `infra/README.md`). `bootstrap/` + `modules/` + `envs/demo/`.

**Test suites (all green at handoff — 58 integration / 29 server / 27 web):**
```bash
(cd server && npm test)     # vitest, needs local Postgres (user/db "wave")
(cd web && npm test)        # vitest, no DB
(cd itest && npm run itest) # boots the real stack; needs Postgres + a built core binary
```

**Current git state.** Branch `main`, tip is this commit. History is complete (~78 commits).
The repo was pushed to `github.com/lmynsberge/wave-platform` by the human using a git bundle
(their own credentials). Do NOT force-push or rewrite history.

---

## JOB 1 — Move issues from the repo into real GitHub Issues, then remove them

**Context.** During the build, issues were tracked as files in `issues/` (the agent environment
had no GitHub write access — see ISS-001). Now that we're on real GitHub, these should become
actual GitHub Issues for visibility, and the files removed from the repo so there's one source
of truth.

**Files to convert** (`issues/*.md`, each has YAML front-matter with `id`, `severity`, `status`):
- `ISS-001-github-write-access.md` — RESOLVED (write access now works); create as a closed issue
  or skip. Use judgment.
- `ISS-002-no-docker-in-agent-env.md` — environment-specific to the old agent; likely close/skip.
- `ISS-003-agent-env-volatility.md` — environment-specific; likely close/skip.
- `ISS-004-validation-subject-lookup.md` — real; check `status` field, create with matching state.
- `ISS-005-spec014-ac4-state.md` — RESOLVED via amendment; create as closed or skip.
- `ISS-006-ci-gcp-wif-setup.md` — OPEN and important (deferred CI→GCP setup). Create as an open issue.
- `issues/README.md` — explains the directory; delete last.

**Steps.**
1. For each `ISS-###` file: create a GitHub Issue whose **title** is the `#` heading, whose
   **body** is the file content below the front-matter, and whose **labels/state** reflect the
   `severity`/`status` fields (`status: open` → open; `status: resolved`/`deferred` → your call:
   create-then-close, or create open with a label. Prefer preserving history: create, and close
   the resolved ones with a comment noting they were resolved in-repo).
   - Via `gh`: `gh issue create --title "..." --body-file <(...) --label ...`
   - Via GitHub MCP: use the create-issue tool.
2. **Preserve the ISS-### numbers in the issue title** (e.g. title `ISS-006: Wire CI → GCP …`)
   because the codebase references them by that ID (grep shows references in `docs/`, workflow
   comments, `agents/`). GitHub will assign its own issue numbers; that's fine — keep the ISS-###
   in the title/body so in-code references still resolve for a human.
3. Once all issues are created, in a single commit:
   - `git rm -r issues/`
   - Update any references that point at the `issues/` path. Grep first:
     `grep -rn "issues/ISS" --include=*.md --include=*.yml .`
     The key ones: `.github/workflows/deploy-images.yml` (comment mentions `issues/ISS-006`),
     `DEPLOY.md`, and possibly `docs/`. Change them to point at the GitHub Issue (or just say
     "see GitHub Issues") — keep it truthful.
   - Update `README.md` repo-layout table: the `issues/` row should be removed or changed to
     "tracked in GitHub Issues."
   - Commit message suggestion: `chore: migrate issues/ to GitHub Issues; remove in-repo issue files`
4. Open a PR (or push to main if the human prefers direct commits — ask). This repo has no branch
   protection configured yet, so either works.

**Judgment call to surface to the human:** whether to recreate the already-resolved
environment-specific issues (ISS-001/002/003/005) at all. They document the *old agent
environment*, not the product. Recommendation: skip ISS-002/003 (pure agent-env artifacts),
create ISS-001 and ISS-005 as closed (they're part of the build narrative), create ISS-004 and
ISS-006 with their real status. Ask if unsure.

---

## JOB 2 — Stand up the demo locally (fastest path to "it runs")

**Goal:** a running Wave with believable data ("Meridian Consulting") you can click through.
The walkthrough script is in `DEMO.md` (Priya → Marcus → Dana → Ade; password `demo-password-1`).

### Fastest path — Docker Compose
```bash
docker compose up -d --build          # postgres, core, server, web
# server migrations (core self-migrates on boot):
docker compose exec server node dist/migrate.js
# seed the demo org (run from host; core is reachable on :8081 in compose):
CORE_URL=http://localhost:8081 node scripts/seed-demo.mjs http://localhost:8080
```
Then open **http://localhost:5173**. Logins are printed by the seed script.

### KNOWN WRINKLE #1 — two web-serving strategies (do not get confused)
`docker-compose.yml` builds `web/` as its own nginx container on `:5173` (proxying `/api` to
server). BUT `SPEC-016` also made the **server image serve the SPA** for the GCP deploy (one
public service, `WEB_DIST=/app/web-dist`). Both are valid; they're for different targets:
- **Compose (local demo):** separate `web` container → use `http://localhost:5173`.
- **GCP (SPEC-016):** server serves SPA → single Cloud Run URL.
If you rebuild images for GCP you use `server/Dockerfile` (multi-stage, bundles web). For local
compose, leave it as-is. Don't "fix" the divergence; it's intentional.

### KNOWN WRINKLE #2 — seed script talks directly to core
`scripts/seed-demo.mjs` calls the core API directly for a few setup steps (creating attributes,
writing objective evidence) in addition to the server API. In compose, core is on `:8081` and
reachable, so `CORE_URL=http://localhost:8081` works. **On GCP, core is internal-ingress-only**
(by design — the trust boundary is network topology), so the seed can't reach it from your
laptop. For the GCP demo, seed by either (a) temporarily flipping core's ingress to `public` in
`infra/envs/demo/main.tf`, apply, seed, flip back; or (b) running the seed as a Cloud Run Job.
This is documented in `DEPLOY.md §4` and `docs/DEPLOYMENT_PLAN.md`. It's a known follow-up
(smoothing it = "seed as a Run Job").

### Alternative — local processes (no Docker)
Requires local Postgres with a `wave` user + db, Rust toolchain, Node 22.
```bash
(cd server && DATABASE_URL=postgres://wave:wave@localhost:5432/wave npx tsx src/migrate.ts)
(cd core && cargo run) &                 # serves :8081
(cd server && npx tsx src/index.ts) &    # serves :8080
(cd web && npx vite) &                   # serves :5173 (dev)
CORE_URL=http://localhost:8081 node scripts/seed-demo.mjs http://localhost:8080
```

### Verify it worked
Log in as `priya@meridian.demo` / `demo-password-1`. Expect: a Profile with `client_communication`
**established, score 100** (with one manager "no" that didn't lower it — that's drop-not-negative),
`billable_hours` at ~67th percentile, a `mentorship` gap; a Companion thread with a shared
reflection; a Give & Grow view. As `marcus@meridian.demo`: a Team view with a validation queue.
As `dana@meridian.demo`: a pending upward decision. If those render, the demo is good.

---

## JOB 3 — GCP setup (only what's needed to deploy the demo)

**Platform decision (already made, don't relitigate):** GCP, Cloud Run (scale-to-zero) + Cloud SQL
`db-f1-micro`. ~$10–12/month, $0 idle. Portability is explicitly a non-goal. Rationale +
alternatives considered: `specs/SPEC-016-gcp-deployment.md`. Terraform strategy/rules:
`infra/README.md`. Step-by-step: `docs/DEPLOYMENT_PLAN.md` (the plan) and `DEPLOY.md` (exact commands).

**Minimum to deploy the demo — you do NOT need GitHub CI secrets for this.** Image build/push is
done manually from the laptop. (Automated CI publishing is deferred — see ISS-006 / JOB 1.)

**Prereqs:** a GCP project with billing enabled; `gcloud auth login` + `gcloud auth
application-default login` (Terraform uses ADC — no key files); Terraform ≥ 1.7 (or OpenTofu);
Docker; `export PROJECT=<project-id>`.

**Sequence (≈15–20 min; full detail in `DEPLOY.md`):**
1. **Bootstrap once** (local state; enables APIs + creates the TF state bucket):
   `cd infra/bootstrap && terraform init && terraform apply -var project_id=$PROJECT`
2. **First images** (chicken-and-egg: create just the Artifact Registry repo, then push):
   `cd infra/envs/demo && terraform init -backend-config="bucket=$PROJECT-wave-tf-state"`
   `terraform apply -target=google_artifact_registry_repository.images -var project_id=$PROJECT -var server_image=unused -var core_image=unused`
   then `docker build -f server/Dockerfile -t <REGION-AR>/wave/server:$SHA ../..` and
   `docker build -t <REGION-AR>/wave/core:$SHA ../../core`, and push both. (`SHA=$(git rev-parse --short=12 HEAD)`)
3. **Full apply:** `cp terraform.tfvars.example terraform.tfvars` (fill `project_id` + both image
   refs), `terraform apply`. Output: `app_url`.
4. **Migrate:** `gcloud run jobs execute wave-demo-migrate --region us-central1 --wait`
5. **Seed:** deal with the internal-core wrinkle (Job 2, Wrinkle #2), then run `scripts/seed-demo.mjs`
   against `app_url`.
6. Open `app_url`, walk `DEMO.md`.

**Secrets on GCP (only if you enable integrations — the demo runs WITHOUT them):** Slack signing
secret / bot token, Teams shared secret, LLM API key, and `KEY_ENCRYPTION_KEY` all live in **GCP
Secret Manager**, added out-of-band (`gcloud secrets versions add …`) and wired into Cloud Run by
Terraform. **They never go in GitHub.** The adapters self-disable when their secrets are absent,
so a bare demo (guided companion, no Slack/Teams, copy-paste invites) is a valid configuration.
`KEY_ENCRYPTION_KEY` and the DB password are Terraform-generated into Secret Manager automatically
(see `infra/envs/demo/main.tf`). Rule: `infra/README.md` rule 4 (generated infra creds are
state-resident; human/vendor secrets are Secret-Manager-only).

**After the demo works:** first upgrades for a real design partner are SQL tier + private IP,
custom domain + managed cert, and un-pausing the nudge Cloud Scheduler job (currently `paused =
true`; safe to unpause now that opt-out shipped in SPEC-017 — set the real org id first). All in
`docs/BACKLOG.md` under launch gates / first upgrades.

---

## Sharp edges & things to know (consolidated)

- **Locked integration tests.** `itest/tests/spec-###.itest.ts` are immutable without a reviewed
  spec amendment. The process for a genuine locked-test defect is in `agents/WORKFLOW.md`.
- **Trust invariants are enforced in code and tests**, not just docs. If you change feedback,
  scoring, sharing, nudges, team-signal, or the bridge, re-read the relevant spec's "Trust
  invariant check" section first. Examples: managers validate but never originate (direct AND
  transitive); scores are null below "established"; a manager "no" drops evidence, never lowers a
  score; the org can never enumerate who has gaps (nudge routes take no target userId; dispatch
  returns a count only); team-signal is a closed 5-key schema; LLM providers only ever receive
  redacted text.
- **Postgres for local tests** must have a role/db named `wave` (password `wave` in the test URLs).
  The itest harness creates/drops its own DBs; server unit tests create per-suite DBs.
- **`core` uses `tokio-postgres`, not `sqlx`** (an amendment; `docs/ENGINEERING.md` names sqlx as
  the original target). There's a backlog item to decide sqlx-vs-tokio-postgres. Don't "correct"
  it silently.
- **Email is no-op by default** (SPEC-021): invites generate copyable links; `EMAIL_PROVIDER=noop`
  logs + counts. A real vendor adapter (SES/SendGrid) is a drop-in behind the `EmailProvider`
  interface — that's a backlog item, not a bug.
- **`deploy-images` workflow is manual-dispatch only** right now (its `push` trigger is commented
  out) so pushes don't fail without CI secrets. Re-enable when ISS-006 is done.
- **Don't rewrite git history / force-push.** The human pushed via bundle with their own creds.

## Open questions to raise with the human (don't assume)
1. Issues migration (Job 1): recreate resolved/agent-env issues, or only the live ones (ISS-004,
   ISS-006)? Preserve `ISS-###` IDs in titles? (Recommendation given above.)
2. PRs vs direct-to-main? No branch protection is set. If they want PR review, configure it and
   work in branches; otherwise commit to `main`.
3. Which GCP project / region? Default region in the TF is `us-central1`. Confirm before applying.
4. Do they want any integrations on for the demo (Slack? a real LLM via Ollama/Anthropic?), or the
   bare guided-companion demo? That decides whether you touch Secret Manager at all.
5. Custom domain for the demo, or is the raw Cloud Run URL fine? (Raw URL is fine and free.)

## Pointers index
- Product & trust model: `docs/PROJECT_BRIEF.md`
- What's done / what's left: `docs/ROADMAP.md`, `docs/BACKLOG.md`
- Architecture: `docs/ARCHITECTURE.md`, `docs/diagrams/*.mermaid`
- Process rules: `agents/README.md`, `agents/WORKFLOW.md`
- Deploy: `docs/DEPLOYMENT_PLAN.md` (plan), `DEPLOY.md` (commands), `infra/README.md` (TF rules)
- Demo script: `DEMO.md`
- CI→GCP setup (deferred): `issues/ISS-006-ci-gcp-wif-setup.md` (until Job 1 moves it to GitHub Issues)
- Spec→commit map: `docs/TRACEABILITY.md`
