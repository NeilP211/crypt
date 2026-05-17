# Crypt AWS infrastructure.
#
# This describes the production topology: a Fargate-hosted backend behind an
# ALB, an RDS PostgreSQL/PostGIS database, and S3 + CloudFront for imagery.
# It is written to be `terraform validate`-clean and reviewable; applying it
# requires AWS credentials and incurs cost, so CI only validates.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = var.project
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
