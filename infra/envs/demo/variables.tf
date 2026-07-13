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
