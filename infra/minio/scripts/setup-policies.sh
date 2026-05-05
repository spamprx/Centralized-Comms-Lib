#!/bin/sh
set -eu

ALIAS_NAME="${1:-local}"

cat > /tmp/app-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::images",
        "arn:aws:s3:::images/*",
        "arn:aws:s3:::documents",
        "arn:aws:s3:::documents/*",
        "arn:aws:s3:::videos",
        "arn:aws:s3:::videos/*",
        "arn:aws:s3:::temp",
        "arn:aws:s3:::temp/*"
      ]
    }
  ]
}
EOF

mc admin policy create "${ALIAS_NAME}" app-policy /tmp/app-policy.json || true
mc admin policy attach "${ALIAS_NAME}" app-policy --user "${MINIO_APP_USER}"

if [ "${MINIO_PUBLIC_IMAGES:-false}" = "true" ]; then
  cat > /tmp/public-read.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::images/*"]
    }
  ]
}
EOF
  mc anonymous set-json /tmp/public-read.json "${ALIAS_NAME}"/images
fi
