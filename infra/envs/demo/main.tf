provider "google" {
  project = var.project_id
  region  = var.region
}

locals { env = "demo" }

resource "google_artifact_registry_repository" "images" {
  repository_id = "wave"
  project       = var.project_id
  location      = var.region
  format        = "DOCKER"
  labels        = { app = "wave", managed-by = "terraform" }
}

resource "google_service_account" "run" {
  account_id   = "wave-${local.env}-run"
  display_name = "Wave ${local.env} Cloud Run"
}
resource "google_project_iam_member" "run_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}
resource "google_project_iam_member" "run_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run.email}"
}

module "db" {
  source     = "../../modules/database"
  project_id = var.project_id
  region     = var.region
  name       = "wave-${local.env}"
}

# Generated infra credentials (state-resident by rule 4): DATABASE_URLs + dispatch token
resource "google_secret_manager_secret" "server_db_url" {
  project   = var.project_id
  secret_id = "wave-${local.env}-server-database-url"
  replication {
    auto {}
  }
  labels = { app = "wave", managed-by = "terraform" }
}
resource "google_secret_manager_secret_version" "server_db_url" {
  secret      = google_secret_manager_secret.server_db_url.id
  secret_data = "postgres://wave:${module.db.app_password}@localhost/wave_srv?host=/cloudsql/${module.db.connection_name}"
}
resource "google_secret_manager_secret" "core_db_url" {
  project   = var.project_id
  secret_id = "wave-${local.env}-core-database-url"
  replication {
    auto {}
  }
  labels = { app = "wave", managed-by = "terraform" }
}
resource "google_secret_manager_secret_version" "core_db_url" {
  secret      = google_secret_manager_secret.core_db_url.id
  secret_data = "postgres://wave:${module.db.app_password}@localhost/wave_core?host=/cloudsql/${module.db.connection_name}"
}
resource "random_password" "kek" {
  length  = 32
  special = false
}
resource "google_secret_manager_secret" "kek" {
  project   = var.project_id
  secret_id = "wave-${local.env}-key-encryption-key"
  replication {
    auto {}
  }
  labels = { app = "wave", managed-by = "terraform" }
}
resource "google_secret_manager_secret_version" "kek" {
  secret      = google_secret_manager_secret.kek.id
  secret_data = base64encode(random_password.kek.result)
}

resource "random_password" "dispatch_token" {
  length  = 40
  special = false
}
resource "google_secret_manager_secret" "dispatch_token" {
  project   = var.project_id
  secret_id = "wave-${local.env}-dispatch-token"
  replication {
    auto {}
  }
  labels = { app = "wave", managed-by = "terraform" }
}
resource "google_secret_manager_secret_version" "dispatch_token" {
  secret      = google_secret_manager_secret.dispatch_token.id
  secret_data = random_password.dispatch_token.result
}

module "core" {
  source            = "../../modules/run-service"
  name              = "wave-${local.env}-core"
  project_id        = var.project_id
  region            = var.region
  image             = var.core_image
  ingress           = "internal" # server-only core: the trust boundary as network topology
  service_account   = google_service_account.run.email
  cloudsql_instance = module.db.connection_name
  env               = { CORE_PORT = "8080" }
  secret_env        = { DATABASE_URL = google_secret_manager_secret.core_db_url.secret_id }
  depends_on        = [module.db] # boot needs the SQL user, not just the instance (ISS-010)
}

module "server" {
  source            = "../../modules/run-service"
  name              = "wave-${local.env}-server"
  project_id        = var.project_id
  region            = var.region
  image             = var.server_image
  ingress           = "public"
  service_account   = google_service_account.run.email
  cloudsql_instance = module.db.connection_name
  # THE PRODUCTION ALLOWLIST (rule 5 / gate G5): BRIDGE_TEST_SECRET deliberately absent.
  env = {
    CORE_URL       = module.core.uri
    WEB_DIST       = "/app/web-dist"
    COOKIE_SECURE  = "1"                # gate G3
    EMAIL_PROVIDER = var.email_provider # SPEC-021: noop default (log + metrics)
    APP_BASE_URL   = var.app_base_url
  }
  secret_env = {
    DATABASE_URL         = google_secret_manager_secret.server_db_url.secret_id
    NUDGE_DISPATCH_TOKEN = google_secret_manager_secret.dispatch_token.secret_id
    KEY_ENCRYPTION_KEY   = google_secret_manager_secret.kek.secret_id # SPEC-017 G1
    # Vendor secrets (values added out-of-band, see DEPLOY.md; adapters self-disable when absent):
    # SLACK_SIGNING_SECRET / SLACK_BOT_TOKEN / TEAMS_SHARED_SECRET / LLM_API_KEY
  }
  depends_on = [module.db] # boot needs the SQL user, not just the instance (ISS-010)
}

resource "google_cloud_run_v2_job" "migrate" {
  name     = "wave-${local.env}-migrate"
  project  = var.project_id
  location = var.region
  template {
    template {
      service_account = google_service_account.run.email
      volumes {
        name = "cloudsql"
        cloud_sql_instance { instances = [module.db.connection_name] }
      }
      containers {
        image   = var.server_image
        command = ["node", "dist/migrate.js"]
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.server_db_url.secret_id
              version = "latest"
            }
          }
        }
        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }
  }
  labels = { app = "wave", managed-by = "terraform" }
}

resource "google_cloud_scheduler_job" "nudge_dispatch" {
  name     = "wave-${local.env}-nudge-dispatch"
  project  = var.project_id
  region   = var.region
  schedule = "0 14 * * 1" # Mondays 14:00 UTC
  paused   = true         # unpause after an org exists and opt-out (gate G2) ships
  http_target {
    http_method = "POST"
    uri         = "${module.server.uri}/api/orgs/REPLACE_WITH_ORG_ID/nudge-dispatch"
    headers     = { Authorization = "Bearer ${random_password.dispatch_token.result}" }
  }
}

output "app_url" { value = module.server.uri }
output "migrate_job" { value = google_cloud_run_v2_job.migrate.name }
