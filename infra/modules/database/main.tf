# Cloud SQL at demo tier (SPEC-016 R6): db-f1-micro, non-HA, public IP + connector.
# First design-partner upgrade: tier + private IP.
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }

resource "google_sql_database_instance" "pg" {
  name             = var.name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_16"
  settings {
    tier    = "db-f1-micro"
    edition = "ENTERPRISE"
    ip_configuration { ipv4_enabled = true }
    user_labels = { app = "wave", managed-by = "terraform" }
  }
  deletion_protection = false # demo env; flip for real data
}

resource "google_sql_database" "srv" {
  name     = "wave_srv"
  project  = var.project_id
  instance = google_sql_database_instance.pg.name
}
resource "google_sql_database" "core" {
  name     = "wave_core"
  project  = var.project_id
  instance = google_sql_database_instance.pg.name
}

resource "random_password" "app" {
  length  = 32
  special = false
}
resource "google_sql_user" "app" {
  name     = "wave"
  project  = var.project_id
  instance = google_sql_database_instance.pg.name
  password = random_password.app.result
}
resource "google_secret_manager_secret" "db_password" {
  project   = var.project_id
  secret_id = "${var.name}-db-password"
  replication {
    auto {}
  }
  labels = { app = "wave", managed-by = "terraform" }
}
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.app.result
}

output "connection_name" { value = google_sql_database_instance.pg.connection_name }
output "app_password" {
  value     = random_password.app.result
  sensitive = true
}
output "db_password_secret" { value = google_secret_manager_secret.db_password.secret_id }
