# The backend (Render) uses this user: only this bucket, only what the code needs
resource "aws_iam_user" "backend" {
  name = "postpilot-backend"
}

data "aws_iam_policy_document" "backend_s3" {
  statement {
    sid       = "Objects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.app.arn}/*"]
  }

  # Without ListBucket, HEAD on a missing object returns 403 instead of 404,
  # and POST /images would answer 500 instead of "Image was not uploaded"
  statement {
    sid       = "ListForNotFound"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.app.arn]
  }
}

resource "aws_iam_user_policy" "backend_s3" {
  name   = "postpilot-backend-s3"
  user   = aws_iam_user.backend.name
  policy = data.aws_iam_policy_document.backend_s3.json
}

# The key goes to Render. Its secret is stored in the (private, encrypted) state.
resource "aws_iam_access_key" "backend" {
  user = aws_iam_user.backend.name
}

# The scheduled backup (GitHub Actions) uses this user. It can only add files
# under backups/: a leaked key can't read, change or delete the app's files.
resource "aws_iam_user" "backup" {
  name = "postpilot-backup"
}

data "aws_iam_policy_document" "backup_s3" {
  statement {
    sid       = "WriteBackups"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.app.arn}/backups/*"]
  }
}

resource "aws_iam_user_policy" "backup_s3" {
  name   = "postpilot-backup-s3"
  user   = aws_iam_user.backup.name
  policy = data.aws_iam_policy_document.backup_s3.json
}

# The key goes to GitHub Secrets. Its secret is stored in the (private, encrypted) state.
resource "aws_iam_access_key" "backup" {
  user = aws_iam_user.backup.name
}
