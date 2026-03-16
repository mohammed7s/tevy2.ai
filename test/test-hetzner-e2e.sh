#!/bin/bash
# test-hetzner-e2e.sh — End-to-end test: provision a real agent VPS from snapshot
#
# Usage: ./test/test-hetzner-e2e.sh
#
# What it does:
#   1. Creates a Hetzner VPS from the base snapshot
#   2. Injects cloud-init with test business config
#   3. Waits for SSH + gateway to come up
#   4. Verifies agent is responding
#   5. Optionally cleans up (pass --keep to keep the server)
#
# Cost: ~€0.005 per test (~3 cents/hour for CX23)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.test"

# Load env
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "❌ Missing ${ENV_FILE} — copy from .env.test.example"
  exit 1
fi

# Load Hetzner token from file if path provided
if [ -n "${HETZNER_API_TOKEN_FILE:-}" ] && [ -f "$HETZNER_API_TOKEN_FILE" ]; then
  HETZNER_API_TOKEN=$(cat "$HETZNER_API_TOKEN_FILE")
fi

if [ -z "${HETZNER_API_TOKEN:-}" ]; then
  echo "❌ HETZNER_API_TOKEN not set"
  exit 1
fi

# Defaults
BUSINESS_NAME="${TEST_BUSINESS_NAME:-Demo Coffee Shop}"
WEBSITE_URL="${TEST_WEBSITE_URL:-https://bluebottlecoffee.com}"
OWNER_NAME="${TEST_OWNER_NAME:-Test User}"
SLUG="${TEST_SLUG:-demo-coffee}"
SERVER_NAME="tevy-test-${SLUG}-$(date +%s | tail -c 6)"
GATEWAY_TOKEN=$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32)
SSH_KEY="${HETZNER_SSH_KEY_PATH:-$HOME/.ssh/id_ed25519_hetzner}"
KEEP_SERVER="${1:-}"

echo "╔══════════════════════════════════════════════╗"
echo "║  tevy2 Hetzner E2E Test                      ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Business: ${BUSINESS_NAME}"
echo "║  Server:   ${SERVER_NAME}"
echo "║  Snapshot: ${HETZNER_SNAPSHOT_ID}"
echo "║  Location: ${HETZNER_LOCATION:-nbg1}"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Generate cloud-init ──────────────────────────────────────

echo "📝 Generating cloud-init script..."

# Build openclaw.json
OPENCLAW_JSON=$(cat << JSONEOF
{
  "system": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "gatewayToken": "${GATEWAY_TOKEN}"
  },
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}"
    }
  },
  "controlUi": {
    "enabled": true
  }
}
JSONEOF
)

OPENCLAW_JSON_B64=$(echo "$OPENCLAW_JSON" | base64 -w0)

# Build SOUL.md
SOUL_MD=$(cat << 'SOULEOF'
# SOUL.md — Marketing Concierge

You are a dedicated marketing assistant for **Demo Coffee Shop**.

## Your Role
- You're a marketing concierge — not a chatbot, not a tool
- You work as a team member who reports to the business owner
- You draft social media content, track competitors, do market research
- You communicate like a senior marketing consultant

## Communication Style
- Be concise and actionable
- Lead with recommendations, not questions
- When drafting posts, provide ready-to-publish content

## What You Do
1. Content Creation — Draft platform-specific social posts
2. Competitor Tracking — Monitor competitors
3. Market Research — Stay current on industry trends
4. Content Calendar — Maintain posting schedule

## What You Don't Do
- Never post without explicit approval
- Never make up metrics or data
SOULEOF
)
SOUL_MD_B64=$(echo "$SOUL_MD" | base64 -w0)

# Build USER.md
USER_MD=$(cat << USEREOF
# USER.md — About the Business Owner

- **Name:** ${OWNER_NAME}
- **Business:** ${BUSINESS_NAME}
- **Website:** ${WEBSITE_URL}
USEREOF
)
USER_MD_B64=$(echo "$USER_MD" | base64 -w0)

# Build cloud-init
CLOUD_INIT=$(cat << CIEOF
#!/bin/bash
set -euo pipefail
exec > /var/log/tevy-provision.log 2>&1

echo "=== tevy2 provisioning for ${SLUG} ==="
echo "Started: \$(date -u)"

# Create workspace
su - agent -c "mkdir -p /home/agent/.openclaw/workspace/memory"
su - agent -c "mkdir -p /home/agent/.openclaw/workspace/skills"
su - agent -c "mkdir -p /home/agent/.openclaw/settings"

# Write openclaw.json
echo '${OPENCLAW_JSON_B64}' | base64 -d > /home/agent/.openclaw/openclaw.json
chown agent:agent /home/agent/.openclaw/openclaw.json
chmod 600 /home/agent/.openclaw/openclaw.json

# Write workspace files
echo '${SOUL_MD_B64}' | base64 -d > /home/agent/.openclaw/workspace/SOUL.md
echo '${USER_MD_B64}' | base64 -d > /home/agent/.openclaw/workspace/USER.md

# Create AGENTS.md
cat > /home/agent/.openclaw/workspace/AGENTS.md << 'AGENTSEOF'
# AGENTS.md — Behavior Rules

## Every Session
1. Read SOUL.md — this is who you are
2. Read memory/brand-profile.md if it exists
3. Check memory/ for recent context

## Memory
- Daily notes: memory/YYYY-MM-DD.md
- Brand profile: memory/brand-profile.md

## Safety
- Never post content without owner approval
- Never share brand data externally
AGENTSEOF

# Create brand profile
cat > /home/agent/.openclaw/workspace/memory/brand-profile.md << BRANDEOF
# Brand Profile — ${BUSINESS_NAME}

- **Name:** ${BUSINESS_NAME}
- **Website:** ${WEBSITE_URL}
- **Industry:** (pending research)
- **Brand Voice:** (pending)
- **Target Audience:** (pending)

---
*Auto-generated during onboarding*
BRANDEOF

# Fix ownership
chown -R agent:agent /home/agent/.openclaw/

# Copy SSH keys for management
if [ -f /root/.ssh/authorized_keys ]; then
  su - agent -c "mkdir -p /home/agent/.ssh && chmod 700 /home/agent/.ssh"
  cp /root/.ssh/authorized_keys /home/agent/.ssh/authorized_keys
  chown agent:agent /home/agent/.ssh/authorized_keys
  chmod 600 /home/agent/.ssh/authorized_keys
fi

# Start gateway
systemctl daemon-reload
systemctl restart openclaw-gateway

# Wait for gateway
for i in \$(seq 1 12); do
  if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
    echo "Gateway active after ~\$((i * 5))s"
    break
  fi
  sleep 5
done

echo "=== Provisioning complete: \$(date -u) ==="
CIEOF
)

# ── Step 2: Create server ────────────────────────────────────────────

echo "🚀 Creating Hetzner VPS from snapshot..."

CLOUD_INIT_B64=$(echo "$CLOUD_INIT" | base64 -w0)

RESPONSE=$(curl -s -X POST https://api.hetzner.cloud/v1/servers \
  -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${SERVER_NAME}\",
    \"server_type\": \"cx23\",
    \"image\": ${HETZNER_SNAPSHOT_ID},
    \"location\": \"${HETZNER_LOCATION:-nbg1}\",
    \"ssh_keys\": [${HETZNER_SSH_KEY_ID}],
    \"start_after_create\": true,
    \"user_data\": $(echo "$CLOUD_INIT" | jq -Rs .),
    \"labels\": {\"managed_by\": \"tevy2\", \"env\": \"test\", \"slug\": \"${SLUG}\"}
  }")

SERVER_ID=$(echo "$RESPONSE" | jq -r '.server.id // empty')
SERVER_IP=$(echo "$RESPONSE" | jq -r '.server.public_net.ipv4.ip // empty')

if [ -z "$SERVER_ID" ] || [ "$SERVER_ID" = "null" ]; then
  echo "❌ Server creation failed:"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Server created: ID=${SERVER_ID}, IP=${SERVER_IP}"

# Save server info for cleanup
cat > "${SCRIPT_DIR}/.last-test-server" << EOF
SERVER_ID=${SERVER_ID}
SERVER_IP=${SERVER_IP}
SERVER_NAME=${SERVER_NAME}
GATEWAY_TOKEN=${GATEWAY_TOKEN}
CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

# ── Step 3: Wait for SSH ─────────────────────────────────────────────

echo "⏳ Waiting for SSH (max 90s)..."
SSH_READY=false
for i in $(seq 1 18); do
  if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 -o BatchMode=yes \
     -i "$SSH_KEY" "root@${SERVER_IP}" "echo ok" 2>/dev/null | grep -q ok; then
    SSH_READY=true
    echo "✅ SSH ready after ~$((i * 5))s"
    break
  fi
  sleep 5
done

if [ "$SSH_READY" != "true" ]; then
  echo "❌ SSH not ready after 90s"
  echo "   Server IP: ${SERVER_IP}"
  echo "   Try: ssh -i ${SSH_KEY} root@${SERVER_IP}"
  exit 1
fi

# ── Step 4: Wait for provisioning ────────────────────────────────────

echo "⏳ Waiting for provisioning to complete (max 120s)..."
PROVISIONED=false
for i in $(seq 1 24); do
  LOG=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
    "root@${SERVER_IP}" "tail -3 /var/log/tevy-provision.log 2>/dev/null || echo 'no log yet'" 2>/dev/null)
  
  if echo "$LOG" | grep -q "Provisioning complete"; then
    PROVISIONED=true
    echo "✅ Provisioning complete after ~$((i * 5))s"
    break
  fi
  echo "   ... still provisioning ($i/24)"
  sleep 5
done

if [ "$PROVISIONED" != "true" ]; then
  echo "⚠️  Provisioning may still be running. Checking gateway anyway..."
fi

# ── Step 5: Verify gateway ───────────────────────────────────────────

echo "🔍 Checking gateway status..."
GW_STATUS=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
  "agent@${SERVER_IP}" "systemctl is-active openclaw-gateway 2>/dev/null || echo inactive" 2>/dev/null)

if [ "$GW_STATUS" = "active" ]; then
  echo "✅ Gateway is ACTIVE"
else
  echo "⚠️  Gateway status: ${GW_STATUS}"
  echo "   Checking logs..."
  ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
    "root@${SERVER_IP}" "journalctl -u openclaw-gateway --no-pager -n 20" 2>/dev/null || true
fi

# ── Step 6: Verify workspace files ───────────────────────────────────

echo ""
echo "📁 Checking workspace files..."
FILES=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
  "agent@${SERVER_IP}" "ls -la /home/agent/.openclaw/workspace/ 2>/dev/null" 2>/dev/null)
echo "$FILES"

echo ""
echo "📄 SOUL.md content:"
ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
  "agent@${SERVER_IP}" "cat /home/agent/.openclaw/workspace/SOUL.md 2>/dev/null" 2>/dev/null || echo "(not found)"

echo ""
echo "📄 openclaw.json (redacted):"
ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
  "agent@${SERVER_IP}" "cat /home/agent/.openclaw/openclaw.json 2>/dev/null | jq '{system: .system, channels: (.channels // {} | keys), controlUi: .controlUi}'" 2>/dev/null || echo "(not found)"

# ── Step 7: Test gateway API ─────────────────────────────────────────

echo ""
echo "🌐 Testing gateway API..."
GW_HEALTH=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$SSH_KEY" \
  "agent@${SERVER_IP}" "curl -s http://localhost:18789/health 2>/dev/null || echo 'not responding'" 2>/dev/null)
echo "   Health: ${GW_HEALTH}"

# ── Summary ──────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  TEST RESULTS                                ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Server ID:     ${SERVER_ID}"
echo "║  Server IP:     ${SERVER_IP}"
echo "║  Gateway:       ${GW_STATUS}"
echo "║  Gateway Token: ${GATEWAY_TOKEN}"
echo "║  SSH:           ssh -i ${SSH_KEY} agent@${SERVER_IP}"
echo "║  Control UI:    http://${SERVER_IP}:18789"
echo "╚══════════════════════════════════════════════╝"

if [ "$KEEP_SERVER" = "--keep" ]; then
  echo ""
  echo "🔒 Server kept alive. To delete later:"
  echo "   ./test/cleanup-test-server.sh"
else
  echo ""
  echo "Server will be kept for manual testing."
  echo "To delete: ./test/cleanup-test-server.sh"
fi
