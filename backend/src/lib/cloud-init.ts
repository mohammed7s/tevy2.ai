/**
 * Cloud-init template generator
 *
 * Generates user-data scripts for Hetzner VPS provisioning.
 * Two modes:
 *   1. buildBaseImageScript() — for creating the base snapshot (Ubuntu + Node + OpenClaw)
 *   2. buildProvisionScript() — for per-customer provisioning from snapshot
 *
 * LESSONS FROM TESTING (2026-03-16):
 *   - openclaw.json uses: auth, agents, channels, gateway, plugins (NOT system/providers/controlUi)
 *   - API key goes in ~/.openclaw/settings/.credentials-anthropic-default (NOT in openclaw.json)
 *   - systemd ExecStart must be: /usr/bin/openclaw gateway run (NOT gateway start --foreground)
 *   - npm install -g openclaw can produce 0-byte .mjs — run `openclaw --version` to verify
 *   - systemd service can get masked during snapshot — unmask in provision script
 *   - gateway.bind must be "lan" for external access (not "loopback")
 *   - CX22 deprecated → use CX23 (2 vCPU, 4GB, 40GB, €2.99/mo)
 *   - fsn1 location disabled → use nbg1 (Nuremberg)
 */

export type CustomerConfig = {
  slug: string;
  businessName: string;
  ownerName: string;
  websiteUrl?: string;
  gatewayToken: string;
  anthropicApiKey: string;
  defaultModel?: string;
  telegramBotToken?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  socials?: {
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  competitors?: string;
  postingGoal?: string;
  tevy2BackendUrl: string;
  tevy2DashboardUrl: string;
  gitRepoUrl?: string;
};

/**
 * Script to create the base Hetzner snapshot.
 * Run once on a temp server, then snapshot it.
 */
export function buildBaseImageScript(): string {
  return `#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "=== tevy2 base image builder ==="

# System updates
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git jq unzip wget ca-certificates gnupg

# Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Verify
node --version
npm --version

# Install OpenClaw globally
npm install -g openclaw

# Verify binary is not 0 bytes (npm install quirk)
BINARY_SIZE=\$(wc -c < /usr/lib/node_modules/openclaw/openclaw.mjs)
if [ "\$BINARY_SIZE" -lt 100 ]; then
  echo "WARNING: openclaw.mjs is \$BINARY_SIZE bytes, reinstalling..."
  npm install -g openclaw
fi
openclaw --version

# Create agent user (non-root, with home dir)
useradd -m -s /bin/bash agent

# Allow agent to restart its own service + read logs
cat > /etc/sudoers.d/agent-openclaw << 'SUDOERS'
agent ALL=(ALL) NOPASSWD: /bin/systemctl restart openclaw-gateway, /bin/systemctl stop openclaw-gateway, /bin/systemctl start openclaw-gateway, /bin/systemctl status openclaw-gateway, /bin/journalctl *
SUDOERS
chmod 440 /etc/sudoers.d/agent-openclaw

# Create directories
mkdir -p /opt/tevy
mkdir -p /etc/tevy
touch /etc/tevy/shared-keys.env
chmod 600 /etc/tevy/shared-keys.env

# Systemd service — uses 'gateway run' (foreground mode)
cat > /etc/systemd/system/openclaw-gateway.service << 'SYSTEMD'
[Unit]
Description=OpenClaw Gateway (tevy2 agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=agent
Group=agent
WorkingDirectory=/home/agent
ExecStart=/usr/bin/openclaw gateway run
Restart=on-failure
RestartSec=10
Environment=NODE_OPTIONS=--max-old-space-size=1536
EnvironmentFile=-/etc/tevy/shared-keys.env
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable openclaw-gateway

# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/*

echo "=== Base image ready. Snapshot this server. ==="
`;
}

/**
 * Per-customer cloud-init script.
 * Runs on first boot after creating a server from the base snapshot.
 */
export function buildProvisionScript(config: CustomerConfig): string {
  const openclawJson = buildOpenClawConfig(config);
  const openclawJsonB64 = Buffer.from(JSON.stringify(openclawJson, null, 2)).toString("base64");

  const soulMd = buildSoulMd(config);
  const soulMdB64 = Buffer.from(soulMd).toString("base64");

  const agentsMd = buildAgentsMd(config);
  const agentsMdB64 = Buffer.from(agentsMd).toString("base64");

  const userMd = buildUserMd(config);
  const userMdB64 = Buffer.from(userMd).toString("base64");

  const brandProfileMd = buildBrandProfileMd(config);
  const brandProfileB64 = Buffer.from(brandProfileMd).toString("base64");

  const competitorsMd = buildCompetitorsMd(config.competitors);
  const competitorsB64 = Buffer.from(competitorsMd).toString("base64");

  // API key goes in auth-profiles.json (agents/main/agent/), not openclaw.json
  const authProfiles = JSON.stringify({
    version: 1,
    profiles: {
      "anthropic:default": {
        type: "token",
        provider: "anthropic",
        token: config.anthropicApiKey,
      },
    },
    lastGood: { anthropic: "anthropic:default" },
  });
  const authProfilesB64 = Buffer.from(authProfiles).toString("base64");

  const gitRepo = config.gitRepoUrl || "https://github.com/mcclowin/tevy-agent-image.git";

  return `#!/bin/bash
set -euo pipefail
exec > /var/log/tevy-provision.log 2>&1

echo "=== tevy2 provisioning for ${config.slug} ==="
echo "Started: $(date -u)"

# Unmask service if needed (snapshot quirk)
systemctl unmask openclaw-gateway 2>/dev/null || true

# Verify openclaw binary is intact
BINARY_SIZE=$(wc -c < /usr/lib/node_modules/openclaw/openclaw.mjs 2>/dev/null || echo 0)
if [ "$BINARY_SIZE" -lt 100 ]; then
  echo "Reinstalling openclaw (binary was $BINARY_SIZE bytes)..."
  npm install -g openclaw
fi

# Re-create systemd service (in case unmask removed it)
if [ ! -f /etc/systemd/system/openclaw-gateway.service ]; then
  cat > /etc/systemd/system/openclaw-gateway.service << 'SYSTEMD'
[Unit]
Description=OpenClaw Gateway (tevy2 agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=agent
Group=agent
WorkingDirectory=/home/agent
ExecStart=/usr/bin/openclaw gateway run
Restart=on-failure
RestartSec=10
Environment=NODE_OPTIONS=--max-old-space-size=1536
EnvironmentFile=-/etc/tevy/shared-keys.env
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
SYSTEMD
  systemctl daemon-reload
  systemctl enable openclaw-gateway
fi

# Clone the tevy agent image repo (skills, shared keys, update script)
if [ ! -d /opt/tevy/.git ]; then
  git clone ${gitRepo} /opt/tevy 2>/dev/null || echo "Git clone failed — continuing without repo"
else
  cd /opt/tevy && git pull origin main 2>/dev/null || true
fi

# Create workspace directories
su - agent -c "mkdir -p /home/agent/.openclaw/workspace/memory"
su - agent -c "mkdir -p /home/agent/.openclaw/workspace/skills"
su - agent -c "mkdir -p /home/agent/.openclaw/settings"

# Write openclaw.json (config — NO API keys here)
echo '${openclawJsonB64}' | base64 -d > /home/agent/.openclaw/openclaw.json
chmod 600 /home/agent/.openclaw/openclaw.json

# Write API key to auth-profiles.json (correct OpenClaw credential store path)
mkdir -p /home/agent/.openclaw/agents/main/agent
echo '${authProfilesB64}' | base64 -d > /home/agent/.openclaw/agents/main/agent/auth-profiles.json
chmod 600 /home/agent/.openclaw/agents/main/agent/auth-profiles.json

# Write workspace files (customer's copies — independent after first boot)
echo '${soulMdB64}' | base64 -d > /home/agent/.openclaw/workspace/SOUL.md
echo '${agentsMdB64}' | base64 -d > /home/agent/.openclaw/workspace/AGENTS.md
echo '${userMdB64}' | base64 -d > /home/agent/.openclaw/workspace/USER.md
echo '${brandProfileB64}' | base64 -d > /home/agent/.openclaw/workspace/memory/brand-profile.md
echo '${competitorsB64}' | base64 -d > /home/agent/.openclaw/workspace/memory/competitors.md

# Copy shared keys from repo
if [ -f /opt/tevy/shared-keys.env ]; then
  cp /opt/tevy/shared-keys.env /etc/tevy/shared-keys.env
  chmod 600 /etc/tevy/shared-keys.env
fi

# Symlink skills from repo into workspace
if [ -d /opt/tevy/skills ]; then
  for skill_dir in /opt/tevy/skills/*/; do
    skill_name=$(basename "$skill_dir")
    ln -sfn "$skill_dir" "/home/agent/.openclaw/workspace/skills/$skill_name"
  done
fi

# Fix ownership
chown -R agent:agent /home/agent/.openclaw/

# Copy SSH authorized keys for management access
if [ -f /root/.ssh/authorized_keys ]; then
  su - agent -c "mkdir -p /home/agent/.ssh && chmod 700 /home/agent/.ssh"
  cp /root/.ssh/authorized_keys /home/agent/.ssh/authorized_keys
  chown agent:agent /home/agent/.ssh/authorized_keys
  chmod 600 /home/agent/.ssh/authorized_keys
fi

# Start the gateway
systemctl daemon-reload
systemctl restart openclaw-gateway

# Wait for gateway to be ready (max 90s — OpenClaw takes ~60s to init)
for i in $(seq 1 18); do
  if systemctl is-active openclaw-gateway >/dev/null 2>&1; then
    echo "Gateway is active after ~$((i * 5))s"
    break
  fi
  sleep 5
done

echo "=== Provisioning complete: $(date -u) ==="
`;
}

// ── Config builders ────────────────────────────────────────────────────

/**
 * Build openclaw.json with correct schema.
 * API key is NOT stored here — it goes in the credential store.
 */
function buildOpenClawConfig(config: CustomerConfig): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    auth: {
      profiles: {
        "anthropic:default": {
          provider: "anthropic",
          mode: "token",
        },
      },
    },
    agents: {
      defaults: {
        workspace: "/home/agent/.openclaw/workspace",
        maxConcurrent: 4,
      },
    },
    gateway: {
      port: 18789,
      mode: "local",
      bind: "lan",  // Must be "lan" for external access through LB
      auth: {
        mode: "token",
        token: config.gatewayToken,
      },
    },
    plugins: {
      entries: {} as Record<string, { enabled: boolean }>,
    },
  };

  // Add Telegram channel if provided
  if (config.telegramBotToken) {
    (cfg as any).channels = {
      telegram: {
        enabled: true,
        botToken: config.telegramBotToken,
        streaming: true,
        dmPolicy: "open",
        allowFrom: ["*"],  // Required when dmPolicy is "open"
      },
    };
    ((cfg as any).plugins.entries as Record<string, { enabled: boolean }>).telegram = { enabled: true };
  }

  // Add control UI config
  if (config.tevy2DashboardUrl) {
    (cfg as any).gateway.controlUi = {
      enabled: true,
      allowedOrigins: [config.tevy2DashboardUrl],
    };
  }

  return cfg;
}

function buildSoulMd(config: CustomerConfig): string {
  return `# SOUL.md — Marketing Concierge

You are a dedicated marketing assistant for **${config.businessName}**.

## Your Role
- You're a marketing concierge — not a chatbot, not a tool
- You work as a team member who reports to ${config.ownerName || "the business owner"}
- You draft social media content, track competitors, do market research, and manage the content calendar
- You communicate like a senior marketing consultant — clear, actionable, proactive

## Communication Style
- Be concise and actionable
- Lead with recommendations, not questions
- When drafting posts, provide ready-to-publish content
- Flag important competitor moves and market shifts proactively
- Use the brand voice defined in memory/brand-profile.md

## What You Do
1. **Content Creation** — Draft platform-specific social posts based on the brand profile
2. **Competitor Tracking** — Monitor competitors and report changes
3. **Market Research** — Stay current on industry trends
4. **SEO** — Audit the website and suggest improvements
5. **Content Calendar** — Maintain and propose a posting schedule
6. **Analytics Review** — Track what's working and adjust strategy

## What You Don't Do
- Never post without explicit approval from ${config.ownerName || "the owner"}
- Never make up metrics or data
- Never send external emails/messages without approval
- Never access systems not explicitly configured

## Daily Rhythm
- Morning: Check if any scheduled posts need review, flag competitor updates
- When asked: Draft posts, run research, do SEO audits
- Proactively: Suggest content ideas, flag opportunities
`;
}

function buildAgentsMd(config: CustomerConfig): string {
  return `# AGENTS.md — Behavior Rules

## Every Session
1. Read SOUL.md — this is who you are
2. Read memory/brand-profile.md — the brand you're working for
3. Read memory/competitors.md — who you're competing against
4. Check memory/content-calendar.md — what's scheduled

## Memory
- Daily notes: memory/YYYY-MM-DD.md
- Brand profile: memory/brand-profile.md
- Competitors: memory/competitors.md
- Content calendar: memory/content-calendar.md
- Research: memory/research/*.md

## Safety
- Never post content without owner approval
- Never share brand data externally
- Never run destructive commands

## Tools
Use your installed skills for specific tasks. Check each skill's SKILL.md for usage.
`;
}

function buildUserMd(config: CustomerConfig): string {
  const lines = [
    `# USER.md — About the Business Owner`,
    ``,
    `- **Name:** ${config.ownerName || "Business Owner"}`,
    `- **Business:** ${config.businessName}`,
  ];

  if (config.websiteUrl) lines.push(`- **Website:** ${config.websiteUrl}`);

  const socials = config.socials || {};
  if (socials.instagram) lines.push(`- **Instagram:** ${socials.instagram}`);
  if (socials.linkedin) lines.push(`- **LinkedIn:** ${socials.linkedin}`);
  if (socials.twitter) lines.push(`- **Twitter/X:** ${socials.twitter}`);
  if (socials.tiktok) lines.push(`- **TikTok:** ${socials.tiktok}`);
  if (socials.facebook) lines.push(`- **Facebook:** ${socials.facebook}`);

  if (config.postingGoal) lines.push(`- **Posting Goal:** ${config.postingGoal}`);

  lines.push("", "---", "*Update as I learn more about the business.*");
  return lines.join("\n");
}

function buildBrandProfileMd(config: CustomerConfig): string {
  return `# Brand Profile — ${config.businessName}

> Auto-generated during onboarding. Update as you learn more.

## Business
- **Name:** ${config.businessName}
- **Website:** ${config.websiteUrl || "(not provided)"}
- **Industry:** (pending research)

## Brand Voice
- **Tone:** (pending — will be determined after analyzing website and socials)
- **Style:** (pending)

## Target Audience
- (pending research)

## Value Proposition
- (pending — will be determined from website analysis)

## Social Presence
${config.socials?.instagram ? `- Instagram: ${config.socials.instagram}` : ""}
${config.socials?.linkedin ? `- LinkedIn: ${config.socials.linkedin}` : ""}
${config.socials?.twitter ? `- Twitter/X: ${config.socials.twitter}` : ""}
${config.socials?.tiktok ? `- TikTok: ${config.socials.tiktok}` : ""}
${config.socials?.facebook ? `- Facebook: ${config.socials.facebook}` : ""}

## Posting Goal
${config.postingGoal || "3-4 posts per week"}

---
*Last updated: ${new Date().toISOString().split("T")[0]}*
`;
}

function buildCompetitorsMd(competitors?: string): string {
  if (!competitors) {
    return `# Competitors\n\n> No competitors provided yet. Add them via the dashboard.\n`;
  }

  const list = competitors
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c, i) => `## Competitor ${i + 1}: ${c}\n- **Recent activity:** (pending research)\n- **Strengths:** (pending)\n- **Weaknesses:** (pending)\n`)
    .join("\n");

  return `# Competitors\n\n> Tracked competitors. Updated during research.\n\n${list}`;
}
