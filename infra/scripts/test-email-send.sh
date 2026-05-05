#!/usr/bin/env bash

set -uo pipefail

# Email send API smoke/integration test runner.
# Usage:
#   TOKEN="<jwt>" BASE_URL="http://localhost:8000/api/v1" EMAIL_TO="you@example.com" ./infra/scripts/test-email-send.sh

BASE_URL="${BASE_URL:-http://localhost:8000/api/v1}"
TOKEN="${TOKEN:-}"
EMAIL_TO="${EMAIL_TO:-}"
CLIENT_ID="${CLIENT_ID:-}"
EVENT_PREFIX="${EVENT_PREFIX:-EMAIL_E2E}"
STOP_ON_FAIL="${STOP_ON_FAIL:-0}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: TOKEN is required."
  echo "Example: TOKEN=\"<jwt>\" EMAIL_TO=\"you@example.com\" ./infra/scripts/test-email-send.sh"
  exit 1
fi

if [[ -z "$EMAIL_TO" ]]; then
  echo "ERROR: EMAIL_TO is required."
  echo "Example: TOKEN=\"<jwt>\" EMAIL_TO=\"you@example.com\" ./infra/scripts/test-email-send.sh"
  exit 1
fi

if [[ -n "$CLIENT_ID" ]]; then
  CLIENT_JSON=",\"client_id\":\"${CLIENT_ID}\""
else
  CLIENT_JSON=""
fi

PASS_COUNT=0
FAIL_COUNT=0

run_case() {
  local name="$1"
  local endpoint="$2"
  local expected_status="$3"
  local payload="$4"

  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl -sS -o "$body_file" -w "%{http_code}" \
    -X POST "${BASE_URL}${endpoint}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload")"

  if [[ "$status" == "$expected_status" ]]; then
    echo "PASS [$status] $name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL [expected $expected_status, got $status] $name"
    echo "---- response ----"
    sed -n '1,40p' "$body_file"
    echo "------------------"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    if [[ "$STOP_ON_FAIL" == "1" ]]; then
      rm -f "$body_file"
      exit 1
    fi
  fi

  rm -f "$body_file"
}

echo "Running email endpoint tests against: $BASE_URL"
echo

run_case \
  "Preview: plain text richText" \
  "/email-send/preview" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_PREVIEW_PLAIN\",
    \"subject\": \"Preview plain\",
    \"recipients\": [{ \"user_id\": \"u1\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"rt1\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Hello team\" }] }
      ] } }
    }]
  }"

run_case \
  "Preview: heading, bold, italic, underline, link" \
  "/email-send/preview" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_PREVIEW_RICHTEXT\",
    \"subject\": \"RichText preview\",
    \"recipients\": [{ \"user_id\": \"u1\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"rt2\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"heading\", \"attrs\": { \"level\": 2 }, \"content\": [{ \"type\": \"text\", \"text\": \"Weekly update\" }] },
        { \"type\": \"paragraph\", \"content\": [
          { \"type\": \"text\", \"text\": \"This is \" },
          { \"type\": \"text\", \"text\": \"bold\", \"marks\": [{ \"type\": \"bold\" }] },
          { \"type\": \"text\", \"text\": \", \" },
          { \"type\": \"text\", \"text\": \"italic\", \"marks\": [{ \"type\": \"italic\" }] },
          { \"type\": \"text\", \"text\": \", \" },
          { \"type\": \"text\", \"text\": \"underline\", \"marks\": [{ \"type\": \"underline\" }] },
          { \"type\": \"text\", \"text\": \" and a \" },
          { \"type\": \"text\", \"text\": \"link\", \"marks\": [{ \"type\": \"link\", \"attrs\": { \"href\": \"https://example.com\" } }] }
        ] }
      ] } }
    }]
  }"

run_case \
  "Preview: field token resolution" \
  "/email-send/preview" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_PREVIEW_FIELD\",
    \"subject\": \"Hello {{first_name}}\",
    \"field_values\": { \"first_name\": \"Priya\" },
    \"recipients\": [{ \"user_id\": \"u2\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [
      {
        \"id\": \"rt3\",
        \"type\": \"richText\",
        \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
          { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Hi {{first_name}}\" }] }
        ] } }
      },
      { \"id\": \"f1\", \"type\": \"field\", \"props\": { \"fieldKey\": \"first_name\" } }
    ]
  }"

run_case \
  "Preview: media attachment + caption" \
  "/email-send/preview" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_PREVIEW_MEDIA\",
    \"subject\": \"Media preview\",
    \"recipients\": [{ \"user_id\": \"u3\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"m1\",
      \"type\": \"media\",
      \"props\": {
        \"caption\": \"See attached release note\",
        \"url\": \"https://example.com/release-note.pdf\",
        \"name\": \"release-note.pdf\",
        \"mime_type\": \"application/pdf\",
        \"size_bytes\": 103424
      }
    }]
  }"

run_case \
  "Send: plain text" \
  "/email-send/send" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_SEND_PLAIN\",
    \"subject\": \"Send plain test\",
    \"recipients\": [{ \"user_id\": \"u4\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"rt4\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Email send plain test.\" }] }
      ] } }
    }]
  }"

run_case \
  "Send: list formatting" \
  "/email-send/send" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_SEND_LISTS\",
    \"subject\": \"Send list test\",
    \"recipients\": [{ \"user_id\": \"u5\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"rt5\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Highlights\" }] },
        { \"type\": \"bulletList\", \"content\": [
          { \"type\": \"listItem\", \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Search improvements\" }] }] },
          { \"type\": \"listItem\", \"content\": [{ \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"New analytics widgets\" }] }] }
        ] }
      ] } }
    }]
  }"

run_case \
  "Send: mixed richText + field + media" \
  "/email-send/send" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_SEND_MIXED\",
    \"subject\": \"Send mixed test\",
    \"field_values\": { \"first_name\": \"Riya\" },
    \"recipients\": [{ \"user_id\": \"u6\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [
      {
        \"id\": \"rt6\",
        \"type\": \"richText\",
        \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
          { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Hi {{first_name}}, weekly digest ready.\" }] }
        ] } }
      },
      { \"id\": \"f2\", \"type\": \"field\", \"props\": { \"fieldKey\": \"first_name\" } },
      {
        \"id\": \"m2\",
        \"type\": \"media\",
        \"props\": {
          \"caption\": \"Attached digest PDF\",
          \"url\": \"https://example.com/digest.pdf\",
          \"name\": \"digest.pdf\",
          \"mime_type\": \"application/pdf\",
          \"size_bytes\": 99888
        }
      }
    ]
  }"

run_case \
  "Send: subject fallback (no subject provided)" \
  "/email-send/send" \
  "200" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_SEND_FALLBACK_SUBJECT\",
    \"recipients\": [{ \"user_id\": \"u7\", \"email\": \"${EMAIL_TO}\" }]${CLIENT_JSON},
    \"blocks\": [{
      \"id\": \"rt7\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Subject fallback test\" }] }
      ] } }
    }]
  }"

run_case \
  "Validation: missing event_type should fail" \
  "/email-send/send" \
  "400" \
  "{
    \"subject\": \"Invalid\",
    \"recipients\": [{ \"user_id\": \"u8\", \"email\": \"${EMAIL_TO}\" }],
    \"blocks\": [{
      \"id\": \"rt8\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Missing event_type\" }] }
      ] } }
    }]
  }"

run_case \
  "Validation: missing recipients should fail" \
  "/email-send/send" \
  "400" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_INVALID_NO_RECIPIENTS\",
    \"subject\": \"Invalid\",
    \"blocks\": [{
      \"id\": \"rt9\",
      \"type\": \"richText\",
      \"props\": { \"doc\": { \"type\": \"doc\", \"content\": [
        { \"type\": \"paragraph\", \"content\": [{ \"type\": \"text\", \"text\": \"Missing recipients\" }] }
      ] } }
    }]
  }"

run_case \
  "Validation: empty blocks should fail" \
  "/email-send/send" \
  "400" \
  "{
    \"event_type\": \"${EVENT_PREFIX}_INVALID_NO_BLOCKS\",
    \"subject\": \"Invalid\",
    \"recipients\": [{ \"user_id\": \"u9\", \"email\": \"${EMAIL_TO}\" }],
    \"blocks\": []
  }"

echo
echo "========================================"
echo "Total: $((PASS_COUNT + FAIL_COUNT))"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "========================================"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
