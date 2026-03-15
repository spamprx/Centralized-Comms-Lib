#!/usr/bin/env bash

# check_api_health.sh
# Usage:
#   chmod +x check_api_health.sh
#   ./check_api_health.sh
#
# You can override BASE_URL and API_TOKEN when running:
#   BASE_URL="http://localhost:8000" API_TOKEN="your.jwt.token" ./check_api_health.sh
#
# If API_TOKEN is not set, the script auto-generates a short-lived JWT from
# the .env file (JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE) using Node.js.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/apps/api/.env}"

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_PREFIX="/api/v1"
TIMEOUT="${TIMEOUT:-5}"

CURL_BIN="$(command -v curl || true)"
if [[ -z "$CURL_BIN" ]]; then
  echo "Error: curl is not installed or not available in PATH." >&2
  exit 1
fi

# Auto-generate a JWT from .env when API_TOKEN is not already provided.
if [[ -z "$API_TOKEN" && -f "$ENV_FILE" ]]; then
  _jwt_secret="$(grep -E '^JWT_SECRET=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
  _jwt_issuer="$(grep -E '^JWT_ISSUER=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
  _jwt_audience="$(grep -E '^JWT_AUDIENCE=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"

  if [[ -n "$_jwt_secret" ]]; then
    API_TOKEN="$(NODE_PATH="${REPO_ROOT}/node_modules" node -e "
      const jwt = require('jsonwebtoken');
      const opts = { algorithm: 'HS256', expiresIn: '1h' };
      if ('${_jwt_issuer}') opts.issuer = '${_jwt_issuer}';
      if ('${_jwt_audience}') opts.audience = '${_jwt_audience}';
      const token = jwt.sign(
        { id: 'health-check', email: 'healthcheck@system', role: 'ADMIN' },
        '${_jwt_secret}',
        opts
      );
      process.stdout.write(token);
    " 2>/dev/null)"

    if [[ -n "$API_TOKEN" ]]; then
      echo "Auto-generated JWT from ${ENV_FILE} for health-check." >&2
    else
      echo "Warning: Failed to generate JWT via Node.js – protected routes will return 401." >&2
    fi
  else
    echo "Warning: JWT_SECRET not found in ${ENV_FILE} – protected routes will return 401." >&2
  fi
fi

AUTH_HEADER=()
if [[ -n "$API_TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${API_TOKEN}")
else
  echo "Note: API_TOKEN is not set and could not be auto-generated – protected routes under ${API_PREFIX} will likely return 401." >&2
fi

# One entry per endpoint: "METHOD PATH"
ENDPOINTS=(
  # Top-level health/dev endpoints
  "GET /health"
  "GET /health/db"
  "GET /dev/repo-check"

  # Public API routes (note: register/login are POST and expect bodies, so omitted here)
  # "POST ${API_PREFIX}/auth/register"
  # "POST ${API_PREFIX}/auth/login"

  # Protected read/list endpoints (usually require JWT)
  "GET ${API_PREFIX}/content"
  "GET ${API_PREFIX}/tags"
  "GET ${API_PREFIX}/reviews/my-assignments"
  "GET ${API_PREFIX}/admin/users"
  "GET ${API_PREFIX}/admin/roles"
  "GET ${API_PREFIX}/admin/groups"
  "GET ${API_PREFIX}/admin/logs"

  # Below are path-param endpoints – fill in IDs and uncomment if you want to check them:
  # "GET  ${API_PREFIX}/content/{contentId}"
  # "GET  ${API_PREFIX}/content/{contentId}/versions"
  # "GET  ${API_PREFIX}/tags/{tagId}"
  # "GET  ${API_PREFIX}/reviews/requests/{requestId}"
  # "GET  ${API_PREFIX}/reviews/content/{contentId}"
  # "GET  ${API_PREFIX}/admin/users/{userId}"
  # "GET  ${API_PREFIX}/admin/groups/{groupId}"
  # "GET  ${API_PREFIX}/admin/roles/{roleId}/permissions"
)

declare -A CODE_COUNTS
TOTAL=0

echo "Base URL: ${BASE_URL}"
echo "Checking ${#ENDPOINTS[@]} endpoints..."
echo

for entry in "${ENDPOINTS[@]}"; do
  read -r METHOD PATH _ <<<"$entry"

  ((TOTAL++))

  URL="${BASE_URL}${PATH}"

  # Build curl options
  CURL_OPTS=(
    -s -o /dev/null
    -m "$TIMEOUT"
    -w "%{http_code}"
    -X "$METHOD"
  )

  if ( [[ "$PATH" == "${API_PREFIX}/"* ]] || [[ "$PATH" == "${API_PREFIX}"* ]] ) && [[ -n "$API_TOKEN" ]]; then
    CURL_OPTS+=("${AUTH_HEADER[@]}")
  fi

  CODE=$("$CURL_BIN" "${CURL_OPTS[@]}" "$URL" || echo "000")

  printf "[%s] %s %s\n" "$CODE" "$METHOD" "$URL"

  if [[ -z "${CODE_COUNTS[$CODE]}" ]]; then
    CODE_COUNTS[$CODE]=1
  else
    CODE_COUNTS[$CODE]=$(( CODE_COUNTS[$CODE] + 1 ))
  fi
done

echo
echo "===== Summary ====="
echo "Total endpoints checked: $TOTAL"
for CODE in "${!CODE_COUNTS[@]}"; do
  printf "HTTP %s : %d\n" "$CODE" "${CODE_COUNTS[$CODE]}"
done