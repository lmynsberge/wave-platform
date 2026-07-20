# Committed pins so CI's terraform-plan has variable values (terraform.tfvars stays local-only).
# Deploys update the image tags here in a PR; apply remains a deliberate human step (DEPLOY.md).
project_id   = "wave-platform-112358"
server_image = "us-central1-docker.pkg.dev/wave-platform-112358/wave/server:df736e3a394c"
core_image   = "us-central1-docker.pkg.dev/wave-platform-112358/wave/core:df736e3a394c"
