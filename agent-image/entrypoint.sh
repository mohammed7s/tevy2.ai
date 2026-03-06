#!/bin/bash
set -e

echo "=== tevy2.ai Agent Starting ==="
echo "OpenClaw version: $(openclaw --version 2>/dev/null || echo 'unknown')"
echo "Instance: ${INSTANCE_ID:-unknown}"
echo "Business: ${BUSINESS_NAME:-unknown}"

# --- 1. Generate workspace files from env vars ---

# SOUL.md + AGENTS.md are static (from templates)
cp /workspace/templates/SOUL.md /workspace/SOUL.md
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

if [ ! -f /workspace/memory/competitors.md ] && [ -n "$COMPETITORS_B64" ]; then
    echo "$COMPETITORS_B64" | base64 -d > /workspace/memory/competitors.md
    echo "  competitors.md: created"
else
    echo "  competitors.md: $([ -f /workspace/memory/competitors.md ] && echo 'exists (preserved)' || echo 'skipped')"
fi

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

# --- 2. Write OpenClaw config directly ---
# Using the exact JSON format OpenClaw expects (openclaw.json, not yaml)
mkdir -p /root/.openclaw

GATEWAY_TOKEN=$(cat /proc/sys/kernel/random/uuid | tr -d '-')

# Build telegram channel config if token provided
TELEGRAM_CONFIG=""
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    TELEGRAM_CONFIG=$(cat <<EOJSON
,
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "dmPolicy": "open",
      "streaming": true
    }
EOJSON
)
    echo "  Telegram: enabled"
fi

cat > /root/.openclaw/openclaw.json <<EOJSON
{
  "wizard": {
    "lastRunAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "lastRunVersion": "2026.3.2",
    "lastRunCommand": "onboard",
    "lastRunMode": "local"
  },
  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "token"
      }
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "custom",
    "customBind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "${GATEWAY_TOKEN}"
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/workspace"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true
    }${TELEGRAM_CONFIG}
  },
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": ${TELEGRAM_BOT_TOKEN:+true}${TELEGRAM_BOT_TOKEN:-false}
      }
    }
  },
  "model": "${MODEL:-claude-sonnet-4-20250514}"
}
EOJSON

echo "  Config written to /root/.openclaw/openclaw.json"
echo "  Gateway token: ${GATEWAY_TOKEN}"

# Store API key where OpenClaw expects it (auth-profiles.json per agent)
mkdir -p /root/.openclaw/agents/main/agent
cat > /root/.openclaw/agents/main/agent/auth-profiles.json <<EOJSON
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "token",
      "provider": "anthropic",
      "token": "${ANTHROPIC_API_KEY}"
    }
  },
  "lastGood": {
    "anthropic": "anthropic:default"
  }
}
EOJSON

# --- 3. Start OpenClaw gateway ---
echo "Starting OpenClaw gateway..."
exec openclaw gateway run
