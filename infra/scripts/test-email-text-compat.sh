#!/usr/bin/env bash

set -euo pipefail

# Sends one exhaustive rich-text compatibility test email via backend endpoint.
# Usage:
#   TOKEN="<jwt>" TO_EMAIL="you@example.com" ./infra/scripts/test-email-text-compat.sh
#
# Optional:
#   BASE_URL="http://localhost:8000/api/v1"
#   USER_ID="u_text_1"
#   EVENT_TYPE="EMAIL_COMPAT_TEXT_FULL"
#   SUBJECT="Email Text Compatibility Check"

BASE_URL="${BASE_URL:-http://localhost:8000/api/v1}"
TOKEN="${TOKEN:-}"
TO_EMAIL="${TO_EMAIL:-}"
USER_ID="${USER_ID:-u_text_1}"
EVENT_TYPE="${EVENT_TYPE:-EMAIL_COMPAT_TEXT_FULL}"
SUBJECT="${SUBJECT:-Email Text Compatibility Check}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: TOKEN is required."
  echo "Example: TOKEN=\"<jwt>\" TO_EMAIL=\"you@example.com\" ./infra/scripts/test-email-text-compat.sh"
  exit 1
fi

if [[ -z "$TO_EMAIL" ]]; then
  echo "ERROR: TO_EMAIL is required."
  echo "Example: TOKEN=\"<jwt>\" TO_EMAIL=\"you@example.com\" ./infra/scripts/test-email-text-compat.sh"
  exit 1
fi

echo "Sending compatibility test email to: $TO_EMAIL"
echo "Endpoint: ${BASE_URL}/email-send/send"

TMP_BODY="$(mktemp)"
HTTP_CODE="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
  -X POST "${BASE_URL}/email-send/send" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_type\": \"${EVENT_TYPE}\",
    \"subject\": \"${SUBJECT}\",
    \"recipients\": [{ \"user_id\": \"${USER_ID}\", \"email\": \"${TO_EMAIL}\" }],
    \"field_values\": {
      \"first_name\": \"Priya\",
      \"doc_link\": \"https://example.com/docs/release-notes\"
    },
    \"blocks\": [
      {
        \"id\": \"rt_all_text\",
        \"type\": \"richText\",
        \"props\": {
          \"doc\": {
            \"type\": \"doc\",
            \"content\": [
              {
                \"type\": \"heading\",
                \"attrs\": { \"level\": 1 },
                \"content\": [{ \"type\": \"text\", \"text\": \"Compatibility Test\" }]
              },
              {
                \"type\": \"heading\",
                \"attrs\": { \"level\": 2 },
                \"content\": [{ \"type\": \"text\", \"text\": \"Hi {{first_name}}\" }]
              },
              {
                \"type\": \"paragraph\",
                \"content\": [
                  { \"type\": \"text\", \"text\": \"This has \" },
                  { \"type\": \"text\", \"text\": \"bold\", \"marks\": [{ \"type\": \"bold\" }] },
                  { \"type\": \"text\", \"text\": \", \" },
                  { \"type\": \"text\", \"text\": \"italic\", \"marks\": [{ \"type\": \"italic\" }] },
                  { \"type\": \"text\", \"text\": \", \" },
                  { \"type\": \"text\", \"text\": \"underline\", \"marks\": [{ \"type\": \"underline\" }] },
                  { \"type\": \"text\", \"text\": \", \" },
                  { \"type\": \"text\", \"text\": \"strikethrough\", \"marks\": [{ \"type\": \"strike\" }] },
                  { \"type\": \"text\", \"text\": \", and \" },
                  { \"type\": \"text\", \"text\": \"inline-code\", \"marks\": [{ \"type\": \"code\" }] },
                  { \"type\": \"text\", \"text\": \".\" }
                ]
              },
              {
                \"type\": \"paragraph\",
                \"content\": [
                  { \"type\": \"text\", \"text\": \"Official docs link\", \"marks\": [{ \"type\": \"link\", \"attrs\": { \"href\": \"https://example.com/docs\" } }] },
                  { \"type\": \"text\", \"text\": \" | token link: \" },
                  { \"type\": \"text\", \"text\": \"{{doc_link}}\" }
                ]
              },
              {
                \"type\": \"paragraph\",
                \"content\": [
                  { \"type\": \"text\", \"text\": \"Line 1\" },
                  { \"type\": \"hardBreak\" },
                  { \"type\": \"text\", \"text\": \"Line 2 after hardBreak\" }
                ]
              },
              {
                \"type\": \"bulletList\",
                \"content\": [
                  {
                    \"type\": \"listItem\",
                    \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Bullet one\" }] }]
                  },
                  {
                    \"type\": \"listItem\",
                    \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Bullet two\" }] }]
                  }
                ]
              },
              {
                \"type\": \"orderedList\",
                \"content\": [
                  {
                    \"type\": \"listItem\",
                    \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Step one\" }] }]
                  },
                  {
                    \"type\": \"listItem\",
                    \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Step two\" }] }]
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  }")"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "PASS [200] Compatibility email sent."
  echo "Response:"
  sed -n '1,80p' "$TMP_BODY"
else
  echo "FAIL [${HTTP_CODE}] API returned non-200."
  echo "Response:"
  sed -n '1,120p' "$TMP_BODY"
  rm -f "$TMP_BODY"
  exit 1
fi

rm -f "$TMP_BODY"
