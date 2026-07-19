---
id: ISS-006
severity: deferred
raised_by: orchestrator
relates_to: SPEC-016 (deploy-images workflow), DEPLOY.md §6
status: open
---

# ISS-006: Wire CI → GCP image publishing (Workload Identity Federation)

## Status: DEFERRED (not needed for the demo)

The demo deploys images **manually from a laptop** (`DEPLOYMENT_PLAN.md` / `DEPLOY.md §2`),
so no CI→GCP credentials are required to stand it up. Until this issue is done, the
`build-and-push-images` GitHub Action is **manual-dispatch only** (its `push` trigger is
commented out in `.github/workflows/deploy-images.yml`) so pushes to `main` don't fail on
missing auth.

**Wake condition:** we want pushes to `main` to auto-build and push `:git-sha` images to
Artifact Registry (i.e. hands-off deploys). When that day comes, do the setup below and
un-comment the `push:` trigger.

## Why WIF (no key files)
Workload Identity Federation lets GitHub Actions impersonate a GCP service account via
short-lived OIDC tokens — no long-lived JSON key to store or leak. The `attribute-condition`
and scoped `principalSet` restrict impersonation to **this repo only**
(`lmynsberge/wave-platform`), not any repo on GitHub.

## GCP side — run once (after `infra/bootstrap` apply, which enables the IAM/STS APIs)
```bash
export PROJECT=<your-gcp-project-id>
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')

# 1. CI service account (the identity Actions impersonates)
gcloud iam service-accounts create wave-ci \
  --project=$PROJECT --display-name="Wave CI (image push)"
CI_SA="wave-ci@$PROJECT.iam.gserviceaccount.com"

# 2. Grant Artifact Registry push
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$CI_SA" --role="roles/artifactregistry.writer"

# 3. Workload Identity pool + GitHub OIDC provider (scoped to this repo)
gcloud iam workload-identity-pools create github \
  --project=$PROJECT --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --project=$PROJECT --location=global --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='lmynsberge/wave-platform'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4. Allow ONLY this repo to impersonate the CI SA
gcloud iam service-accounts add-iam-policy-binding $CI_SA \
  --project=$PROJECT --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/lmynsberge/wave-platform"

# 5. Print the values for the GitHub secrets
echo "GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-oidc"
echo "GCP_CI_SA        = $CI_SA"
echo "GCP_PROJECT      = $PROJECT"
```

## GitHub side — add three repo secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `GCP_WIF_PROVIDER` → the `projects/…/providers/github-oidc` string from step 5
- `GCP_CI_SA` → `wave-ci@<project>.iam.gserviceaccount.com`
- `GCP_PROJECT` → your project id

## Then
Un-comment the `push:` trigger in `.github/workflows/deploy-images.yml` and push — images
will publish automatically on changes under `server/**`, `core/**`, `web/**`.

## NOT part of this issue (important)
App/runtime secrets — Slack signing secret, LLM API keys, `KEY_ENCRYPTION_KEY`, DB password —
do **NOT** go in GitHub. Per `infra/README.md` rule 4 they live in GCP Secret Manager
(`gcloud secrets versions add …`) and Terraform wires them into Cloud Run. GitHub only ever
needs the three CI secrets above.
