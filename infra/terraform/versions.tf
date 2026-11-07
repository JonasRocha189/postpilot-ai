terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state in the bucket from step 2.1. use_lockfile: S3-native locking
  # (Terraform 1.10+), so two applies can't run at the same time; no DynamoDB.
  backend "s3" {
    bucket       = "postpilot-tfstate-171930144993"
    key          = "postpilot/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
