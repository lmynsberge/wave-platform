# Deploying Wave to GCP (demo tier, ~$10–12/mo)

Prereqs: a GCP project with billing, `gcloud` authed as owner, Terraform ≥ 1.7, Docker.

## 1. Bootstrap (once per project, local state)
```bash
cd infra/bootstrap
terraform init
terraform apply -var project_id=$PROJECT     # enables APIs, creates the state bucket
```

## 2. First images (before CI exists, push manually)
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev -q
# Artifact Registry repo is created by the env apply; chicken-and-egg is resolved by
# creating just the repo first:
cd infra/envs/demo
terraform init -backend-config="bucket=$PROJECT-wave-tf-state"
terraform apply -target=google_artifact_registry_repository.images -var project_id=$PROJECT \
  -var server_image=unused -var core_image=unused
# build + push
SHA=$(git rev-parse --short=12 HEAD)
docker build -f server/Dockerfile -t us-central1-docker.pkg.dev/$PROJECT/wave/server:$SHA ../..
docker build -t us-central1-docker.pkg.dev/$PROJECT/wave/core:$SHA ../../core
docker push us-central1-docker.pkg.dev/$PROJECT/wave/server:$SHA
docker push us-central1-docker.pkg.dev/$PROJECT/wave/core:$SHA
```

## 3. Full apply
```bash
cp terraform.tfvars.example terraform.tfvars   # fill project + both image refs
terraform apply
```

## 4. Migrate + seed
```bash
gcloud run jobs execute wave-demo-migrate --region us-central1 --wait   # server migrations (core migrates on boot)
APP_URL=$(terraform output -raw app_url)
node ../../scripts/seed-demo.mjs $APP_URL      # NOTE: seed's direct-core steps (attributes, objective evidence)
                                               # need core reachable; for the demo env run the seed from a
                                               # Cloud Run job or temporarily set core ingress=public — simplest:
                                               # `terraform apply -var ...` with module.core ingress toggled, seed, toggle back.
```
Open `$APP_URL`. Logins in DEMO.md (password `demo-password-1`).

## 5. Vendor secrets (only when enabling integrations; adapters self-disable when absent)
```bash
echo -n "$SLACK_SIGNING_SECRET" | gcloud secrets versions add wave-demo-slack-signing --data-file=-   # after adding the container + secret_env entry in main.tf
```
Rule: vendor/human secrets NEVER go in tfvars or HCL (infra/README.md rule 4).

## 6. CI wiring (optional now)
Create a CI service account with Artifact Registry writer, set up Workload Identity Federation for the GitHub repo, and add `GCP_WIF_PROVIDER`, `GCP_CI_SA`, `GCP_PROJECT` repo secrets. Pushes to main then publish `:git-sha` images; deploys remain a deliberate `terraform apply` with the new tag.

## Costs & knobs
Cloud Run: $0 idle (scale-to-zero, ~5–10s cold start — accepted). Cloud SQL db-f1-micro: ~$9–10/mo (the whole bill, basically). First design-partner upgrades: SQL tier + private IP, custom domain, unpause scheduler AFTER opt-out (gate G2).
