# Opinionated Cloud Run wrapper (SPEC-016 R5).
# ENFORCED, not configurable: scale-to-zero (min 0), typed ingress, mandatory labels.
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

resource "google_cloud_run_v2_service" "this" {
  name     = var.name
  project  = var.project_id
  location = var.region

  ingress = var.ingress == "public" ? "INGRESS_TRAFFIC_ALL" : "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = var.service_account
    scaling {
      min_instance_count = 0 # cold starts accepted by decision; not a variable on purpose
      max_instance_count = var.max_instances
    }
    dynamic "volumes" {
      for_each = var.cloudsql_instance == "" ? [] : [1]
      content {
        name = "cloudsql"
        cloud_sql_instance { instances = [var.cloudsql_instance] }
      }
    }
    containers {
      image = var.image
      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
      dynamic "volume_mounts" {
        for_each = var.cloudsql_instance == "" ? [] : [1]
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
    }
  }
  labels = { app = "wave", managed-by = "terraform" }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.ingress == "public" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "uri" { value = google_cloud_run_v2_service.this.uri }
output "name" { value = google_cloud_run_v2_service.this.name }
