terraform {
  required_version = ">= 1.7"
  backend "gcs" {
    # bucket = "<project>-wave-tf-state"  — set via `terraform init -backend-config="bucket=..."`
    prefix = "envs/demo"
  }
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}
