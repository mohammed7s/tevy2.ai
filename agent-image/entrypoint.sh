#!/bin/bash
set -e

echo "=== tevy2.ai Agent Starting ==="
echo "OpenClaw version: $(openclaw --version 2>/dev/null || echo 'unknown')"
echo "Instance: ${INSTANCE_ID:-unknown}"
echo "Business: ${BUSINESS_NAME:-unknown}"

# --- 1. Generate workspace files from env vars ---

# SOUL.md is static (copied from templates)
cp /workspace/templates/SOUL.md /workspace/SOUL.md

# AGENTS.md is static
cp /workspace/templates/AGENTS.md /workspace/AGENTS.md

# USER.md — generated from env vars
cat > /workspace/USER.md <<EOF
# USER.md — About the Business Owner

- **Name:** ${OWNER_NAME:-Business Owner}
- **Business:** ${BUSINESS_NAME:-My Business}
- **Website:** ${WEBSITE_URL:-}
- **Timezone:** ${TIMEZONE:-UTC}
- **Chat channel:** ${CHAT_CHANNEL:-webchat}

## Social Accounts
${INSTAGRAM:+- **Instagram:** $INSTAGRAM}
${TIKTOK:+- **TikTok:** $TIKTOK}
${LINKEDIN:+- **LinkedIn:** $LINKEDIN}
${TWITTER:+- **X/Twitter:** $TWITTER}
${FACEBOOK:+- **Facebook:** $FACEBOOK}

## Posting Goal
${POSTING_GOAL:-3-4 posts per week}
EOF

# --- Memory files: only write if they DON'T already exist ---
# (Persistent volume preserves them across restarts/updates)

# Brand profile
if [ ! -f /workspace/memory/brand-profile.md ]; then
    if [ -n "$BRAND_PROFILE_B64" ]; then
        echo "$BRAND_PROFILE_B64" | base64 -d > /workspace/memory/brand-profile.md
    else
        cat > /workspace/memory/brand-profile.md <<EOF
# Brand Profile

> Pending analysis. Tevy will scrape ${WEBSITE_URL:-the website} and fill this in.

## Business
- **Name:** ${BUSINESS_NAME:-My Business}
- **Website:** ${WEBSITE_URL:-}
EOF
    fi
    echo "  brand-profile.md: created"
else
    echo "  brand-profile.md: exists (preserved)"
fi

# Competitors
if [ ! -f /workspace/memory/competitors.md ] && [ -n "$COMPETITORS_B64" ]; then
    echo "$COMPETITORS_B64" | base64 -d > /workspace/memory/competitors.md
    echo "  competitors.md: created"
else
    echo "  competitors.md: $([ -f /workspace/memory/competitors.md ] && echo 'exists (preserved)' || echo 'skipped')"
fi

# Content calendar
if [ ! -f /workspace/memory/content-calendar.md ]; then
    cat > /workspace/memory/content-calendar.md <<EOF
# Content Calendar

> Managed by Tevy. Posts are drafted, approved, then scheduled.

## Upcoming
(none yet)

## Published
(none yet)
EOF
    echo "  content-calendar.md: created"
else
    echo "  content-calendar.md: exists (preserved)"
fi

# --- 2. Configure OpenClaw via onboard ---
echo "Running OpenClaw onboard..."
GATEWAY_TOKEN=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
openclaw onboard \
    --non-interactive \
    --accept-risk \
    --auth-choice token \
    --token-provider anthropic \
    --token "${ANTHROPIC_API_KEY}" \
    --workspace /workspace \
    --gateway-bind custom \
    --gateway-port 18789 \
    --gateway-auth token \
    --gateway-token "${GATEWAY_TOKEN}" \
    --skip-channels \
    --flow quickstart
echo "  Gateway token: ${GATEWAY_TOKEN}"

# Set model
openclaw config set model "${MODEL:-claude-sonnet-4-20250514}" 2>/dev/null || true

# Bind to 0.0.0.0 so Docker can expose the port
openclaw config set gateway.bind custom 2>/dev/null || true
openclaw config set gateway.customBind "0.0.0.0" 2>/dev/null || true

# Enable webchat
openclaw config set channels.webchat.enabled true 2>/dev/null || true

# Enable Telegram if token provided
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    openclaw config set channels.telegram.enabled true 2>/dev/null || true
    openclaw config set channels.telegram.botToken "${TELEGRAM_BOT_TOKEN}" 2>/dev/null || true
    openclaw config set channels.telegram.dmPolicy open 2>/dev/null || true
    echo "  Telegram: enabled"
fi

# --- 3. Start OpenClaw gateway ---
echo "Starting OpenClaw gateway..."
exec openclaw gateway run
