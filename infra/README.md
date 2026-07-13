# infra/ — Terraform for Wave (GCP)

## Rules (SPEC-016 R4–R8; violating these is a review rejection)
1. **One environment = one root directory** (`envs/<name>`). No workspaces, no Terragrunt.
2. **Modules encapsulate POLICY**, not DRY. If a convention must hold (scale-to-zero, ingress class), it lives in a module where misconfiguration is impossible.
3. **Terraform never builds images.** CI pushes `:<git-sha>` to Artifact Registry; roots take image refs as variables.
4. **Human/vendor secret VALUES never enter HCL or state** (Slack tokens, LLM keys): Terraform creates the Secret Manager containers; values are added with `gcloud secrets versions add`. **Generated infra-internal credentials** (DB password, dispatch token) are Terraform-generated and live in state — the state bucket is the security boundary for those.
5. **The env-var list in a service module call is the production allowlist** — anything not listed cannot reach the container (this is how `BRIDGE_TEST_SECRET` is structurally excluded, gate G5).
6. **State**: GCS bucket with versioning, created ONCE by `bootstrap/` (the only local-state apply).
7. `terraform fmt -check` + `validate` are CI-enforced.

## Layout
- `bootstrap/` — state bucket + API enablement. Apply once per project.
- `modules/run-service/` — opinionated Cloud Run v2 wrapper.
- `modules/database/` — Cloud SQL instance + databases + user + password-in-Secret-Manager.
- `envs/demo/` — the demo environment root.
