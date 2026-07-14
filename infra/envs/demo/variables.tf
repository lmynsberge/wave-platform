variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}
variable "server_image" {
  type        = string
  description = "Artifact Registry ref for wave-server (CI-built, :git-sha tag)"
}
variable "core_image" {
  type        = string
  description = "Artifact Registry ref for wave-core (CI-built, :git-sha tag)"
}
variable "app_base_url" {
  type        = string
  default     = ""
  description = "Public base URL for links in emails (set after first apply reveals the Cloud Run URL)"
}
variable "email_provider" {
  type        = string
  default     = "noop"
  description = "noop (log+count) until a real vendor adapter lands (SPEC-021)"
}
