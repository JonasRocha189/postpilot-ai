#!/bin/sh
# LocalStack "ready" hook: creates the private dev bucket and allows the
# Vite dev server to PUT/GET objects with presigned URLs (browser uploads).
set -e

BUCKET=postpilot-dev

awslocal s3 mb "s3://$BUCKET" || true
awslocal s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
echo "S3 bucket $BUCKET ready"
