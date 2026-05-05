#!/usr/bin/env bash
set -euo pipefail

# End-to-end verification for file/media sends via notification-framework.
# Requires:
#   - notification-framework running and reachable at NOTIFY_SERVER_URL
#   - valid NOTIFY_API_KEY and NOTIFY_CLIENT_ID
#   - at least one recipient set (email or WhatsApp)

NOTIFY_SERVER_URL="${NOTIFY_SERVER_URL:-http://143.110.244.195:8000/notify}"
NOTIFY_API_KEY="${NOTIFY_API_KEY:-nf_3cad56a9b5a25b739bb85ebf9b3b80dd19cf828b1f481553e82c862dac6da484}"
NOTIFY_CLIENT_ID="${NOTIFY_CLIENT_ID:-a4913c575dc82083b27155c471dbe6d0}"
EVENT_TYPE="${EVENT_TYPE:-MEDIA_FLOW_TEST}"
REMOTE_URL="${REMOTE_URL:-https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf}"
CHANNELS="${CHANNELS:-whatsapp}"
TEST_USER_ID="${TEST_USER_ID:-media-test-user}"
TEST_WA_NUMBER="${TEST_WA_NUMBER:-+918885496881}"
TEST_EMAIL="${TEST_EMAIL:-}"

if [[ -z "${NOTIFY_API_KEY}" || -z "${NOTIFY_CLIENT_ID}" ]]; then
  echo "Set NOTIFY_API_KEY and NOTIFY_CLIENT_ID before running."
  exit 1
fi

MEDIA_UPLOAD_URL="${NOTIFY_SERVER_URL%/notify}/media/upload"
echo "Using notify endpoint: ${NOTIFY_SERVER_URL}"
echo "Using media upload endpoint: ${MEDIA_UPLOAD_URL}"

UPLOAD_RESPONSE="$(
  curl -sS -X POST "${MEDIA_UPLOAD_URL}" \
    -H "X-API-Key: ${NOTIFY_API_KEY}" \
    -F "remote_url=${REMOTE_URL}" \
    -F "name=flow-test.pdf" \
    -F "mime_type=application/pdf" \
    -F "delivery_mode=auto"
)"

FILE_ID="$(printf '%s' "${UPLOAD_RESPONSE}" | python -c 'import json,sys; print(json.load(sys.stdin).get("file_id",""))')"
if [[ -z "${FILE_ID}" ]]; then
  echo "Media upload did not return file_id. Response:"
  echo "${UPLOAD_RESPONSE}"
  exit 1
fi

echo "Uploaded media. file_id=${FILE_ID}"
export FILE_ID CHANNELS TEST_USER_ID TEST_WA_NUMBER TEST_EMAIL NOTIFY_CLIENT_ID EVENT_TYPE

NOTIFY_PAYLOAD="$(
python - <<'PY'
import json
import os

channels = [x.strip() for x in os.environ["CHANNELS"].split(",") if x.strip()]
recipient = {
    "user_id": os.environ["TEST_USER_ID"],
}
if os.environ.get("TEST_WA_NUMBER"):
    recipient["wa_number"] = os.environ["TEST_WA_NUMBER"]
if os.environ.get("TEST_EMAIL"):
    recipient["email"] = os.environ["TEST_EMAIL"]

payload = {
    "client_id": os.environ["NOTIFY_CLIENT_ID"],
    "event_type": os.environ["EVENT_TYPE"],
    "channels_requested": channels,
    "recipients": [recipient],
    "content": {
        "subject": "Media flow verification",
        "body": "This is an automated media/file flow verification message.",
        "attachments": [
            {
                "file_id": os.environ["FILE_ID"],
                "delivery_mode": "auto"
            }
        ]
    }
}
print(json.dumps(payload))
PY
)"

echo "Dispatching /notify request..."
NOTIFY_RESPONSE="$(
  curl -sS -X POST "${NOTIFY_SERVER_URL}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${NOTIFY_API_KEY}" \
    -d "${NOTIFY_PAYLOAD}"
)"

echo "Notify response:"
echo "${NOTIFY_RESPONSE}"
echo "Done. If jobs_created is non-empty, full media flow is working."
