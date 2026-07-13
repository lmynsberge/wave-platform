variable "name" { type = string }
variable "project_id" { type = string }
variable "region" { type = string }
variable "image" {
  type        = string
  description = "Full Artifact Registry image ref incl. tag (built by CI, never by Terraform)"
}
variable "ingress" {
  type        = string
  description = "public | internal — the only two postures Wave services may have"
  validation {
    condition     = contains(["public", "internal"], var.ingress)
    error_message = "ingress must be 'public' or 'internal'."
  }
}
variable "env" {
  type        = map(string)
  default     = {}
  description = "Plain env vars. THIS LIST IS THE PRODUCTION ALLOWLIST (SPEC-016 R8)."
}
variable "secret_env" {
  type        = map(string) # ENV_NAME => secret_id
  default     = {}
  description = "Env vars sourced from Secret Manager (latest version)."
}
variable "cloudsql_instance" {
  type        = string
  default     = ""
  description = "Cloud SQL connection name to attach via unix socket, if any."
}
variable "max_instances" {
  type    = number
  default = 2 # cost ceiling; raise deliberately
}
variable "service_account" { type = string }
