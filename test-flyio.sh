#!/bin/bash
# tevy2.ai — Fly.io Direct Test
# Tests Fly.io machine provisioning WITHOUT the backend.
# Talks directly to Fly Machines API to isolate deployment issues.
#
# Usage:
#   cp .env.test.example .env.test   # fill in FLY_API_TOKEN + ANTHROPIC_API_KEY
#   ./test-flyio.sh                  # create machine, wait for health, cleanup
#   ./test-flyio.sh --keep           # create but don't delete
#   ./test-flyio.sh --cleanup <id>   # delete a specific machine
#   ./test-flyio.sh --list           # list all machines in the app
#   ./test-flyio.sh --status <id>    # check machine status

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLY_API="https://api.machines.dev/v1"

# --- Load .env.test ---
if [ -f "$SCRIPT_DIR/.env.test" ]; then
    set -a
    source "$SCRIPT_DIR/.env.test"
    set +a
fi

# Required vars
FLY_API_TOKEN="${FLY_API_TOKEN:-}"
FLY_APP_NAME="${FLY_APP_NAME:-tevy2-agents}"
FLY_REGION="${FLY_REGION:-lhr}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
AGENT_IMAGE="${AGENT_IMAGE:-ghcr.io/mcclowin/tevy2.ai/agent:latest}"

# Test instance config
TEST_NAME="tevy-flytest-$(date +%s | tail -c 6)"
TEST_BUSINESS="${TEST_BUSINESS_NAME:-Fly Test Coffee}"
TEST_WEBSITE="${TEST_WEBSITE_URL:-https://bluebottlecoffee.com}"
SOAK_MINUTES="${SOAK_MINUTES:-20}"

# --- Helpers ---
fly_api() {
    local method=$1 path=$2 data=$3
    local url="${FLY_API}/apps/${FLY_APP_NAME}${path}"
    local args=(-s -w "\n%{http_code}" -X "$method" "$url" \
        -H "Authorization: Bearer $FLY_API_TOKEN" \
        -H "Content-Type: application/json")
    [ -n "$data" ] && args+=(-d "$data")
    curl "${args[@]}"
}

parse_response() {
    local response="$1"
    HTTP_CODE=$(echo "$response" | tail -1)
    BODY=$(echo "$response" | sed '$d')
}

check_prereqs() {
    local missing=()
    [ -z "$FLY_API_TOKEN" ] && missing+=("FLY_API_TOKEN")
    [ -z "$ANTHROPIC_API_KEY" ] && missing+=("ANTHROPIC_API_KEY")
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo "❌ Missing required env vars: ${missing[*]}"
        echo "   Set them in .env.test"
        exit 1
    fi
}

# --- Commands ---

cmd_list() {
    echo "📋 Listing machines in $FLY_APP_NAME..."
    RESPONSE=$(fly_api GET "/machines")
    parse_response "$RESPONSE"
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ Failed ($HTTP_CODE): $BODY"
        echo ""
        echo "If the app doesn't exist, create it: fly apps create $FLY_APP_NAME"
        exit 1
    fi
    
    echo "$BODY" | python3 -c "
import sys, json
machines = json.load(sys.stdin)
if not machines:
    print('   (no machines)')
else:
    for m in machines:
        print(f\"   {m['id']}  {m.get('name','?'):30s}  {m.get('state','?'):10s}  {m.get('region','?')}\")
" 2>/dev/null || echo "$BODY"
}

cmd_status() {
    local machine_id=$1
    echo "🔍 Machine $machine_id status..."
    RESPONSE=$(fly_api GET "/machines/$machine_id")
    parse_response "$RESPONSE"
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ Failed ($HTTP_CODE): $BODY"
        exit 1
    fi
    
    echo "$BODY" | python3 -c "
import sys, json
m = json.load(sys.stdin)
print(f\"   ID:      {m['id']}\")
print(f\"   Name:    {m.get('name','?')}\")
print(f\"   State:   {m.get('state','?')}\")
print(f\"   Region:  {m.get('region','?')}\")
print(f\"   Image:   {m.get('config',{}).get('image','?')}\")
print(f\"   Created: {m.get('created_at','?')}\")
" 2>/dev/null || echo "$BODY"
}

cmd_cleanup() {
    local machine_id=$1
    echo "🗑️  Deleting machine $machine_id..."
    RESPONSE=$(fly_api DELETE "/machines/${machine_id}?force=true")
    parse_response "$RESPONSE"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ Deleted."
    else
        echo "   ⚠️  Response ($HTTP_CODE): $BODY"
    fi
}

cmd_test() {
    local keep=$1
    
    echo ""
    echo "=== tevy2.ai Fly.io Direct Test ==="
    echo "App:      $FLY_APP_NAME"
    echo "Region:   $FLY_REGION"
    echo "Image:    $AGENT_IMAGE"
    echo "Instance: $TEST_NAME"
    echo "Business: $TEST_BUSINESS"
    echo ""
    
    # --- Step 1: Check app exists ---
    echo -n "1️⃣  Checking Fly app exists... "
    RESPONSE=$(fly_api GET "/machines")
    parse_response "$RESPONSE"
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌"
        echo "   App '$FLY_APP_NAME' not found or token invalid."
        echo "   HTTP $HTTP_CODE: $BODY"
        echo ""
        echo "   Fix: fly apps create $FLY_APP_NAME"
        exit 1
    fi
    echo "✅"
    
    # --- Step 2: Create volume ---
    echo -n "2️⃣  Creating persistent volume... "
    VOL_NAME=$(echo "$TEST_NAME" | tr '-' '_')
    RESPONSE=$(fly_api POST "/volumes" "{
        \"name\": \"$VOL_NAME\",
        \"region\": \"$FLY_REGION\",
        \"size_gb\": 1,
        \"encrypted\": true
    }")
    parse_response "$RESPONSE"
    
    VOLUME_ID=""
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        VOLUME_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
        echo "✅ ($VOLUME_ID)"
    else
        echo "⚠️  Skipping volume ($HTTP_CODE): $BODY"
    fi
    
    # --- Step 3: Create machine ---
    echo "3️⃣  Creating Fly machine..."
    
    # Build mounts array
    MOUNTS="[]"
    if [ -n "$VOLUME_ID" ]; then
        MOUNTS="[{\"volume\": \"$VOLUME_ID\", \"path\": \"/workspace/memory\"}]"
    fi
    
    MACHINE_CONFIG=$(cat <<EOF
{
    "name": "$TEST_NAME",
    "region": "$FLY_REGION",
    "config": {
        "image": "$AGENT_IMAGE",
        "env": {
            "INSTANCE_ID": "$TEST_NAME",
            "BUSINESS_NAME": "$TEST_BUSINESS",
            "WEBSITE_URL": "$TEST_WEBSITE",
            "OWNER_NAME": "Test User",
            "POSTING_GOAL": "3-4 posts per week",
            "CHAT_CHANNEL": "webchat",
            "TIMEZONE": "UTC",
            "ANTHROPIC_API_KEY": "$ANTHROPIC_API_KEY",
            "MODEL": "claude-sonnet-4-20250514",
            "TELEGRAM_BOT_TOKEN": "$TELEGRAM_BOT_TOKEN"
        },
        "mounts": $MOUNTS,
        "services": [
            {
                "ports": [
                    {"port": 443, "handlers": ["tls", "http"]},
                    {"port": 80, "handlers": ["http"]}
                ],
                "protocol": "tcp",
                "internal_port": 18789
            }
        ],
        "guest": {
            "cpu_kind": "shared",
            "cpus": 1,
            "memory_mb": 2048
        },
        "auto_destroy": false,
        "restart": {"policy": "on-failure"}
    }
}
EOF
)
    
    RESPONSE=$(fly_api POST "/machines" "$MACHINE_CONFIG")
    parse_response "$RESPONSE"
    
    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
        echo "   ❌ Machine creation failed ($HTTP_CODE):"
        echo "   $BODY"
        # Cleanup volume
        if [ -n "$VOLUME_ID" ]; then
            echo "   🗑️  Cleaning up volume..."
            fly_api DELETE "/volumes/$VOLUME_ID" >/dev/null 2>&1
        fi
        exit 1
    fi
    
    MACHINE_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
    MACHINE_STATE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','?'))" 2>/dev/null || echo "?")
    
    echo "   ✅ Machine created!"
    echo "   ID:    $MACHINE_ID"
    echo "   State: $MACHINE_STATE"
    echo "   URL:   https://$TEST_NAME.fly.dev"
    echo ""
    
    # --- Step 4: Wait for healthy ---
    echo "4️⃣  Waiting for agent to boot (up to 120s)..."
    AGENT_URL="https://$TEST_NAME.fly.dev"
    MAX_WAIT=120
    WAITED=0
    HEALTHY=false
    
    while [ $WAITED -lt $MAX_WAIT ]; do
        # Check machine state
        STATE_RESP=$(fly_api GET "/machines/$MACHINE_ID")
        STATE_CODE=$(echo "$STATE_RESP" | tail -1)
        STATE_BODY=$(echo "$STATE_RESP" | sed '$d')
        CURRENT_STATE=$(echo "$STATE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','?'))" 2>/dev/null || echo "?")
        
        # Check HTTP health
        HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$AGENT_URL/health" 2>/dev/null || echo "000")
        
        if [ "$HEALTH_CODE" = "200" ]; then
            echo ""
            echo "   ✅ Agent is healthy! (${WAITED}s)"
            HEALTHY=true
            break
        fi
        
        printf "\r   ⏳ ${WAITED}s — machine: %-12s  http: %s" "$CURRENT_STATE" "$HEALTH_CODE"
        sleep 5
        WAITED=$((WAITED + 5))
    done
    
    echo ""
    
    if [ "$HEALTHY" = false ]; then
        echo "   ⚠️  Agent didn't respond within ${MAX_WAIT}s"
        echo "   Machine state: $CURRENT_STATE"
        echo ""
        echo "   Debug:"
        echo "   fly logs -a $FLY_APP_NAME"
        echo "   fly machine status $MACHINE_ID -a $FLY_APP_NAME"
    fi
    
    # --- Step 5: Test chat (if healthy) ---
    if [ "$HEALTHY" = true ]; then
        echo ""
        echo "5️⃣  Testing webchat endpoint..."
        echo "   🌐 $AGENT_URL"
        CHAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$AGENT_URL" 2>/dev/null || echo "000")
        echo "   Homepage: HTTP $CHAT_CODE"
    fi
    
    # --- Step 6: Soak test or keep ---
    echo ""
    if [ "$keep" = true ]; then
        echo "6️⃣  --keep flag set. Instance left running."
        echo ""
        echo "   Webchat: $AGENT_URL"
        echo "   Machine: $MACHINE_ID"
        echo "   Volume:  $VOLUME_ID"
        echo ""
        echo "   To clean up later:"
        echo "   ./test-flyio.sh --cleanup $MACHINE_ID"
    else
        echo "6️⃣  Soak test — running for ${SOAK_MINUTES} minutes before cleanup..."
        echo "   Webchat: $AGENT_URL"
        echo "   Machine: $MACHINE_ID"
        echo "   Press Ctrl+C to skip wait and cleanup now."
        echo ""
        
        SOAK_SECS=$((SOAK_MINUTES * 60))
        ELAPSED=0
        
        trap 'echo ""; echo "   ⏩ Skipping wait, cleaning up..."; break' INT
        while [ $ELAPSED -lt $SOAK_SECS ]; do
            REMAINING=$(( (SOAK_SECS - ELAPSED) / 60 ))
            REMAIN_SEC=$(( (SOAK_SECS - ELAPSED) % 60 ))
            
            # Quick health ping
            HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$AGENT_URL/health" 2>/dev/null || echo "000")
            
            printf "\r   ⏳ %02d:%02d remaining — health: %s  " "$REMAINING" "$REMAIN_SEC" "$HEALTH_CODE"
            sleep 30
            ELAPSED=$((ELAPSED + 30))
        done
        trap - INT
        
        echo ""
        echo ""
        echo "7️⃣  Cleaning up..."
        
        echo -n "   Deleting machine... "
        fly_api DELETE "/machines/${MACHINE_ID}?force=true" >/dev/null 2>&1
        echo "✅"
        
        if [ -n "$VOLUME_ID" ]; then
            echo -n "   Deleting volume... "
            sleep 3
            fly_api DELETE "/volumes/$VOLUME_ID" >/dev/null 2>&1
            echo "✅"
        fi
        
        echo "   Done."
    fi
    
    echo ""
    echo "=== Test Complete ==="
}

# --- Main ---
check_prereqs

case "${1:-}" in
    --list)
        cmd_list
        ;;
    --status)
        [ -z "$2" ] && echo "Usage: $0 --status <machine-id>" && exit 1
        cmd_status "$2"
        ;;
    --cleanup)
        [ -z "$2" ] && echo "Usage: $0 --cleanup <machine-id>" && exit 1
        cmd_cleanup "$2"
        ;;
    --keep)
        cmd_test true
        ;;
    *)
        cmd_test false
        ;;
esac
