# Deployment Plan — Wave demo on GCP

_Status: ready to execute. Companion docs: `DEPLOY.md` (exact commands), `infra/README.md` (Terraform rules), SPEC-016 (decisions + rationale)._

## Decisions this plan rests on
- **Platform: GCP** — Cloud Run scales to zero (cold starts ~5–10s, accepted), so idle cost is $0 and the built-ins (Scheduler, Secret Manager, Run Jobs) replace things we'd otherwise build.
- **No HCP Terraform, by design.** State is a plain versioned GCS bucket you own; `plan`/`apply` run locally (or later in GitHub Actions) with open-source Terraform or OpenTofu. Locking and versioning come from the bucket. There is no HCP account, runner, or pricing anywhere in this setup, and no scale before a design partner would require one.
- **Auth without key files:** local applies use your `gcloud` Application Default Credentials; CI (when enabled) uses Workload Identity Federation.
- **Cost target:** ~$10–12/month steady state — essentially all Cloud SQL `db-f1-micro`; both Cloud Run services are $0 idle.

## Architecture being deployed
- `wave-server` — public Cloud Run service: API + the built web app in one container (one URL, no CORS, no $18/mo load balancer)
- `wave-core` — Cloud Run service with **internal-only ingress** (the server-only trust boundary as network topology)
- Cloud SQL Postgres (one instance, `wave_srv` + `wave_core` databases)
- Secret Manager (generated infra credentials TF-managed; vendor secrets added out-of-band only)
- Cloud Run Job `wave-demo-migrate` (server migrations; core migrates itself on boot)
- Cloud Scheduler → nudge-dispatch via system bearer token — ships **paused** until opt-out (gate G2) lands

## Execution steps (~15–20 minutes total)
| # | Step | Time | Command sketch |
|---|---|---|---|
| 0 | Prereqs: GCP project w/ billing, `gcloud auth login` + `gcloud auth application-default login`, Terraform ≥1.7 (or OpenTofu), Docker; `export PROJECT=…` | 5m | — |
| 1 | Bootstrap (ONCE, local state): enables APIs, creates state bucket | 2m | `cd infra/bootstrap && terraform init && terraform apply -var project_id=$PROJECT` |
| 2 | First images: init env against bucket → targeted apply of the Artifact Registry repo → build+push server (repo-root context; ships the SPA) and core, tagged `:git-sha` | 5m | see DEPLOY.md §2 |
| 3 | Full apply: fill `terraform.tfvars` (project + both image refs) → `terraform apply` → note `app_url` output | 5m | see DEPLOY.md §3 |
| 4 | Migrate: execute the Run job and wait | 1m | `gcloud run jobs execute wave-demo-migrate --region us-central1 --wait` |
| 5 | Seed Meridian Consulting. KNOWN WRINKLE: seed's direct-core steps need core reachable; first-time path = temporarily flip core ingress to `public`, apply, seed, flip back, apply (follow-up: seed as a Run Job) | 4m | `node scripts/seed-demo.mjs $APP_URL` |
| 6 | Demo: open `app_url`, walk DEMO.md (Priya → Marcus → Dana → Ade), password `demo-password-1` | — | — |

## Ongoing deploy loop
1. Build + push a new `:git-sha` image (manual, or the `deploy-images` GitHub Actions workflow once WIF secrets are configured: `GCP_WIF_PROVIDER`, `GCP_CI_SA`, `GCP_PROJECT`).
2. Update the image tag in `terraform.tfvars`.
3. `terraform apply`.
Infra changes and code deploys stay separate, deliberate events; Terraform never builds images.

## Post-deploy checklist
- [ ] App URL loads; login works over HTTPS with Secure cookies (gate G3 — TF-enforced)
- [ ] Confirm `wave-core` is NOT reachable publicly
- [ ] Scheduler still paused (unpause only after gate G2 opt-out ships; set the real org id first)
- [ ] Vendor integrations (Slack/Teams/LLM) OFF until their secret containers + env entries are added deliberately (adapters self-disable when absent)
- [ ] Demo works → **wake condition met for the shelved design-partner target list**

## First upgrades when a real org signs
SQL tier + private IP, custom domain + managed cert, gates G1 (BYO-key envelope encryption) and G2 (opt-out), unpause scheduler, seed-as-Run-Job, GitHub Actions `plan`/`apply` (same GCS backend — still no HCP).
