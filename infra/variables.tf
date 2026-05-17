variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used to prefix resource names"
  type        = string
  default     = "crypt"
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL instance"
  type        = string
  sensitive   = true
  default     = "change-me-in-tfvars"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "container_image" {
  description = "Container image for the backend service"
  type        = string
  default     = "ghcr.io/neilpatel/crypt-server:latest"
}

variable "container_port" {
  description = "Port the backend listens on"
  type        = number
  default     = 8080
}

variable "desired_count" {
  description = "Number of backend tasks to run"
  type        = number
  default     = 2
}

variable "jwt_secret" {
  description = "Secret used to sign JWTs"
  type        = string
  sensitive   = true
  default     = "change-me-in-tfvars"
}

variable "domain_name" {
  description = "Custom domain for the service; leave empty to use the ALB DNS name"
  type        = string
  default     = ""
}
