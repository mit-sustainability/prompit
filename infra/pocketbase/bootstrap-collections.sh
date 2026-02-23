#!/usr/bin/env bash
set -euo pipefail

# Idempotent PocketBase schema bootstrap for Prompit.
#
# Required env vars:
#   POCKETBASE_URL           e.g. http://127.0.0.1:8090
#   POCKETBASE_ADMIN_EMAIL
#   POCKETBASE_ADMIN_PASSWORD
# Optional:
#   COMPANY_DOMAIN           e.g. mit.edu (adds domain filter in rules)
#   STRICT_DOMAIN_RULE       set "true" to enforce domain in PB rules (default: false)

: "${POCKETBASE_URL:?POCKETBASE_URL is required}"
: "${POCKETBASE_ADMIN_EMAIL:?POCKETBASE_ADMIN_EMAIL is required}"
: "${POCKETBASE_ADMIN_PASSWORD:?POCKETBASE_ADMIN_PASSWORD is required}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed." >&2
  exit 1
fi

PB_URL="${POCKETBASE_URL%/}"
COMPANY_DOMAIN="${COMPANY_DOMAIN:-}"
STRICT_DOMAIN_RULE="${STRICT_DOMAIN_RULE:-false}"

AUTH_RESP=""
for endpoint in \
  "$PB_URL/api/collections/_superusers/auth-with-password" \
  "$PB_URL/api/admins/auth-with-password"; do
  set +e
  AUTH_RESP=$(curl -sS -X POST "$endpoint" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$POCKETBASE_ADMIN_EMAIL\",\"email\":\"$POCKETBASE_ADMIN_EMAIL\",\"password\":\"$POCKETBASE_ADMIN_PASSWORD\"}")
  RC=$?
  set -e
  if [ "$RC" -eq 0 ] && echo "$AUTH_RESP" | jq -e '.token' >/dev/null 2>&1; then
    break
  fi
  AUTH_RESP=""
done

if [ -z "$AUTH_RESP" ]; then
  echo "PocketBase admin auth failed." >&2
  exit 1
fi

PB_TOKEN=$(echo "$AUTH_RESP" | jq -r '.token')
AUTH_HEADER="Authorization: Bearer $PB_TOKEN"

BASE_AUTH_RULE='@request.auth.id != ""'
AUTH_RULE="$BASE_AUTH_RULE"

# Domain rule can be strict on PocketBase side, but some PB versions/configs
# can return generic 400 errors when evaluating auth email expressions.
# Keep it opt-in to prioritize reliability for local MVP bootstrap.
if [ -n "$COMPANY_DOMAIN" ] && [ "$STRICT_DOMAIN_RULE" = "true" ]; then
  AUTH_RULE="${BASE_AUTH_RULE} && @request.auth.email ~ \"%@${COMPANY_DOMAIN}\""
fi

PROMPTS_OWNER_RULE="author = @request.auth.id && ${AUTH_RULE}"
OWNER_DELETE_RULE="user = @request.auth.id && ${AUTH_RULE}"

api_request() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local response
  local status
  local body

  if [ -n "$payload" ]; then
    response=$(curl -sS -w $'\n%{http_code}' -X "$method" "$url" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "$payload")
  else
    response=$(curl -sS -w $'\n%{http_code}' -X "$method" "$url" \
      -H "$AUTH_HEADER")
  fi

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    printf '%s' "$body"
    return 0
  fi

  echo "PocketBase API error [$method $url] HTTP $status" >&2
  if [ -n "$body" ]; then
    echo "$body" | jq . >&2 2>/dev/null || echo "$body" >&2
  fi
  return 1
}

api_get() {
  api_request GET "$1"
}

api_write() {
  local method="$1"
  local url="$2"
  local payload="$3"
  api_request "$method" "$url" "$payload"
}

collection_id_by_name() {
  local name="$1"
  api_get "$PB_URL/api/collections?perPage=200&page=1" | jq -r --arg n "$name" '.items // [] | .[] | select(.name == $n) | .id' | head -n1
}

upsert_collection() {
  local name="$1"
  local payload_fields="$2"

  local payload_schema
  payload_schema=$(echo "$payload_fields" | jq 'if has("fields") then .schema = .fields | del(.fields) else . end')

  local existing_id
  existing_id=$(collection_id_by_name "$name")

  if [ -n "$existing_id" ]; then
    if api_write PATCH "$PB_URL/api/collections/$existing_id" "$payload_schema" >/dev/null; then
      echo "updated collection: $name"
      return
    fi
    if api_write PATCH "$PB_URL/api/collections/$existing_id" "$payload_fields" >/dev/null; then
      echo "updated collection (legacy fields payload): $name"
      return
    fi
    echo "failed to update collection: $name" >&2
    return 1
  else
    if api_write POST "$PB_URL/api/collections" "$payload_schema" >/dev/null; then
      echo "created collection: $name"
      return
    fi
    if api_write POST "$PB_URL/api/collections" "$payload_fields" >/dev/null; then
      echo "created collection (legacy fields payload): $name"
      return
    fi
    echo "failed to create collection: $name" >&2
    return 1
  fi
}

users_payload=$(jq -n --arg authRule "$AUTH_RULE" '{
  name: "users",
  type: "auth",
  listRule: $authRule,
  viewRule: $authRule,
  createRule: "",
  updateRule: $authRule,
  deleteRule: "",
  fields: []
}')

prompts_payload=$(jq -n \
  --arg authRule "$AUTH_RULE" \
  --arg ownerRule "$PROMPTS_OWNER_RULE" \
  '{
  name: "prompts",
  type: "base",
  listRule: $authRule,
  viewRule: $authRule,
  createRule: $authRule,
  updateRule: $ownerRule,
  deleteRule: $ownerRule,
  fields: [
    {name: "title", type: "text", required: true, options: {min: 1, max: 120}},
    {name: "category", type: "text", required: true, options: {min: 1, max: 40}},
    {name: "content", type: "text", required: true, options: {min: 1, max: 4000}},
    {name: "tags", type: "json", required: false, options: {maxSize: 2000000}},
    {name: "author", type: "text", required: true, options: {min: 1, max: 128}},
    {name: "author_name", type: "text", required: false, options: {max: 255}},
    {name: "forked_from", type: "text", required: false, options: {max: 128}}
  ]
}')

votes_payload=$(jq -n \
  --arg authRule "$AUTH_RULE" \
  --arg ownerDeleteRule "$OWNER_DELETE_RULE" \
  '{
  name: "prompt_votes",
  type: "base",
  listRule: $authRule,
  viewRule: $authRule,
  createRule: $authRule,
  updateRule: "",
  deleteRule: $ownerDeleteRule,
  fields: [
    {name: "prompt", type: "text", required: true, options: {min: 1, max: 128}},
    {name: "user", type: "text", required: true, options: {min: 1, max: 128}}
  ]
}')

copies_payload=$(jq -n \
  --arg authRule "$AUTH_RULE" \
  --arg ownerDeleteRule "$OWNER_DELETE_RULE" \
  '{
  name: "prompt_copies",
  type: "base",
  listRule: $authRule,
  viewRule: $authRule,
  createRule: $authRule,
  updateRule: "",
  deleteRule: $ownerDeleteRule,
  fields: [
    {name: "prompt", type: "text", required: true, options: {min: 1, max: 128}},
    {name: "user", type: "text", required: true, options: {min: 1, max: 128}}
  ]
}')

upsert_collection "users" "$users_payload"
upsert_collection "prompts" "$prompts_payload"
upsert_collection "prompt_votes" "$votes_payload"
upsert_collection "prompt_copies" "$copies_payload"

echo "PocketBase collections bootstrap complete."
