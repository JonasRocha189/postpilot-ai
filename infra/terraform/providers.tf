provider "aws" {
  region = var.region

  # Every resource gets these tags (useful in the cost report)
  default_tags {
    tags = {
      Project   = "postpilot"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
