#!/bin/bash
# cleanup-test-server.sh — Delete the last test server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAST_SERVER="${SCRIPT_DIR}/.last-test-server"

if [ ! -f "$LAST_SERVER" ]; then
  echo "❌ No test server found. Run test-hetzner-e2e.sh first."
  exit 1
fi

source "$LAST_SERVER"

# Load Hetzner token
ENV_FILE="${SCRIPT_DIR}/.env.test"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi
if [ -n "${HETZNER_API_TOKEN_FILE:-}" ] && [ -f "$HETZNER_API_TOKEN_FILE" ]; then
  HETZNER_API_TOKEN=$(cat "$HETZNER_API_TOKEN_FILE")
fi

echo "🗑️  Deleting test server: ${SERVER_NAME} (ID: ${SERVER_ID}, IP: ${SERVER_IP})"
echo "   Created: ${CREATED:-unknown}"
read -p "   Continue? [y/N] " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  RESULT=$(curl -s -X DELETE "https://api.hetzner.cloud/v1/servers/${SERVER_ID}" \
    -H "Authorization: Bearer ${HETZNER_API_TOKEN}" | jq -r '.action.status // "error"')
  
  if [ "$RESULT" = "running" ] || [ "$RESULT" = "success" ]; then
    echo "✅ Server deleted"
    rm -f "$LAST_SERVER"
  else
    echo "❌ Delete failed: ${RESULT}"
  fi
else
  echo "Cancelled."
fi
