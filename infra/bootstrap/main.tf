# Bootstrap: run ONCE per project with local state. Everything else uses the bucket this creates.
terraform {
  required_version = ">= 1.7"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "tf_state" {
  name                        = "${var.project_id}-wave-tf-state"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning { enabled = true }
  labels = { app = "wave", purpose = "tf-state" }
}

output "state_bucket" { value = google_storage_bucket.tf_state.name }
