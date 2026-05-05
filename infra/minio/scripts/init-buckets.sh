#!/bin/sh
set -eu

ALIAS_NAME="local"
MINIO_ENDPOINT="http://minio:9000"

until mc alias set "${ALIAS_NAME}" "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"; do
  echo "Waiting for MinIO..."
  sleep 2
done

echo "MinIO is ready. Setting up buckets..."

# Create buckets
mc mb --ignore-existing "${ALIAS_NAME}"/images
mc mb --ignore-existing "${ALIAS_NAME}"/documents
mc mb --ignore-existing "${ALIAS_NAME}"/videos
mc mb --ignore-existing "${ALIAS_NAME}"/backups
mc mb --ignore-existing "${ALIAS_NAME}"/temp

# Enable versioning for critical buckets
mc version enable "${ALIAS_NAME}"/images
mc version enable "${ALIAS_NAME}"/documents
mc version enable "${ALIAS_NAME}"/backups

# Lifecycle policies
mc ilm rule add --expiry-days 7 "${ALIAS_NAME}"/temp
mc ilm rule add --noncurrent-expire-days 30 "${ALIAS_NAME}"/documents
mc ilm rule add --noncurrent-expire-days 60 "${ALIAS_NAME}"/images

# Bucket quotas
mc quota set "${ALIAS_NAME}"/images --size 50GiB
mc quota set "${ALIAS_NAME}"/documents --size 20GiB
mc quota set "${ALIAS_NAME}"/videos --size 200GiB
mc quota set "${ALIAS_NAME}"/temp --size 5GiB

# Browser uploads from the SPA (presigned PUT) require permissive CORS on buckets.
cat >/tmp/comms-cors.json <<'EOF'
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id", "Content-Length"],
    "MaxAgeSeconds": 3000
  }
]
EOF
for b in images documents videos backups temp; do
  mc cors set "${ALIAS_NAME}/${b}" /tmp/comms-cors.json || true
done

# Create/update non-root app user
mc admin user add "${ALIAS_NAME}" "${MINIO_APP_USER}" "${MINIO_APP_PASSWORD}" || true

# Attach app policy and optional public-read policy
/bin/sh /scripts/setup-policies.sh "${ALIAS_NAME}"

echo "Buckets, policies, and users configured."
mc ls "${ALIAS_NAME}"
