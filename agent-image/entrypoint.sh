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

# --- 1b. Create memory subdirectories (match PRD memory architecture) ---
# These map to dashboard tabs:
#   memory/seo/          → SEO tab (audit.md, keywords.md, deltas)
#   memory/research/     → Research tab (YYYY-MM-DD.md digests)
#   memory/conversations/ → internal (key-decisions.md)
mkdir -p /workspace/memory/seo
mkdir -p /workspace/memory/research
mkdir -p /workspace/memory/conversations

# Seed placeholder files if they don't exist (so tabs aren't empty)
if [ ! -f /workspace/memory/seo/audit.md ]; then
    cat > /workspace/memory/seo/audit.md <<EOF
# SEO Audit

> No audit run yet. Ask Tevy to run an SEO audit of your website.
EOF
fi

if [ ! -f /workspace/memory/seo/keywords.md ]; then
    cat > /workspace/memory/seo/keywords.md <<EOF
# Keyword Research

> No keyword research yet. Ask Tevy to research keywords for your niche.
EOF
fi

if [ ! -f /workspace/memory/conversations/key-decisions.md ]; then
    cat > /workspace/memory/conversations/key-decisions.md <<EOF
# Key Decisions

> Important preferences and decisions made by the business owner.
EOF
fi

# --- 2. Write OpenClaw config directly ---
mkdir -p /root/.openclaw /root/.openclaw/agents/main/agent

GATEWAY_TOKEN=$(cat /proc/sys/kernel/random/uuid | tr -d '-')

# Use python3 to generate valid JSON (avoids shell escaping issues with tokens)
python3 -c "
import json, os

config = {
    'wizard': {
        'lastRunAt': '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)',
        'lastRunVersion': '2026.3.2',
        'lastRunCommand': 'onboard',
        'lastRunMode': 'local'
    },
    'auth': {
        'profiles': {
            'anthropic:default': {
                'provider': 'anthropic',
                'mode': 'token'
            }
        }
    },
    'gateway': {
        'port': 18789,
        'mode': 'local',
        'bind': 'lan',
        'auth': {
            'mode': 'token',
            'token': '${GATEWAY_TOKEN}'
        }
    },
    'agents': {
        'defaults': {
            'workspace': '/workspace',
            'model': os.environ.get('MODEL', 'claude-sonnet-4-20250514')
        }
    },
    'channels': {},
    'plugins': {'entries': {}}
}

tg_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
if tg_token:
    config['channels']['telegram'] = {
        'enabled': True,
        'botToken': tg_token,
        'dmPolicy': 'open',
        'allowFrom': ['*'],
        'streaming': 'partial'
    }
    config['plugins']['entries']['telegram'] = {'enabled': True}

with open('/root/.openclaw/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)

# Auth profiles
auth = {
    'version': 1,
    'profiles': {
        'anthropic:default': {
            'type': 'token',
            'provider': 'anthropic',
            'token': os.environ['ANTHROPIC_API_KEY']
        }
    },
    'lastGood': {'anthropic': 'anthropic:default'}
}

with open('/root/.openclaw/agents/main/agent/auth-profiles.json', 'w') as f:
    json.dump(auth, f, indent=2)
"

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "  Telegram: enabled"
fi
echo "  Config written to /root/.openclaw/openclaw.json"
echo "  Gateway token: ${GATEWAY_TOKEN}"

# --- 3. Fix permissions + create missing dirs ---
chmod 700 /root/.openclaw
chmod 600 /root/.openclaw/openclaw.json
mkdir -p /root/.openclaw/agents/main/sessions

# Set node optimization env vars
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
mkdir -p /var/tmp/openclaw-compile-cache
export OPENCLAW_NO_RESPAWN=1

# Limit Node.js heap to fit in container memory
export NODE_OPTIONS="--max-old-space-size=1024"

# --- 4. Start OpenClaw gateway (skip doctor to save memory) ---
echo "Starting OpenClaw gateway..."
exec openclaw gateway run
