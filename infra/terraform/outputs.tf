# Values for the backend's environment variables on Render
output "s3_bucket" {
  value = aws_s3_bucket.app.bucket
}

output "s3_region" {
  value = var.region
}

output "backend_access_key_id" {
  value = aws_iam_access_key.backend.id
}

output "backend_secret_access_key" {
  value     = aws_iam_access_key.backend.secret
  sensitive = true # not printed by plan/apply
}

# Values for the GitHub Secrets of the backup workflow
output "backup_access_key_id" {
  value = aws_iam_access_key.backup.id
}

output "backup_secret_access_key" {
  value     = aws_iam_access_key.backup.secret
  sensitive = true
}
