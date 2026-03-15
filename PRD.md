# tevy2.ai — Product Requirements Document

> AI Marketing Concierge for SMEs
> Status: In Development
> Last updated: 2026-03-15 23:30 UTC

---

## 1. Problem

Small and medium businesses need marketing but can't afford agencies or full-time marketers. They know their product but don't know how to position it, what to post, or what competitors are doing. They need a marketing person — not another tool with 50 buttons.

## 2. Solution

tevy2.ai is an AI marketing concierge powered by OpenClaw. Each SME gets a dedicated AI assistant that:
- Learns their brand from existing materials
- Drafts and schedules social media posts
- Conducts market research and competitor tracking
- Communicates like a human marketing consultant via chat

## 3. Core Principles

- **The bot is an employee, not a tool.** It has a role (marketing), reports to the admin, and acts like a human team member.
- **Concierge, not dashboard-first.** The chat IS the product. The dashboard supports it.
- **One VPS per user.** Full VM isolation. Their data, their server, their agent.
- **OpenClaw is the framework.** We don't rebuild what OpenClaw already handles. We provide a curated image on top of it.
- **VPS is the source of truth.** The backend just knows which VPS belongs to who. The agent manages its own state (skills, config, memory).
- **Platform agnostic.** User chooses their chat channel (Telegram, WhatsApp, or embedded webchat).

---

## 4. What the Product Actually Is

A curated OpenClaw image + a way to deploy and update it.

```
YOUR PRODUCT = Git repo with:
├── Custom SOUL.md (marketing concierge personality)
├── Custom AGENTS.md (agent behavior rules)
├── Custom memory structure (brand-profile.md, competitors.md, etc.)
├── Pre-installed custom skills (brand-analyzer, social-drafter, etc.)
├── Shared API keys (Tavily, Brave, etc.)
└── Scripts to provision, update, and backup
```

Deployed on a per-customer Hetzner VPS. Updated via git push + SSH.

---

## 5. Architecture

```
┌──────────────┐     ┌────────────────────────┐     ┌────────────────┐
│   Netlify    │     │   Railway (Platform)   │     │ Hetzner Cloud  │
│  Dashboard   │────▶│                        │────▶│                │
│  Next.js     │     │  2 DB tables:          │     │  VPS per user  │
│  Static      │     │  - accounts            │     │                │
│  Free        │     │  - agents              │     │  Each VPS:     │
│              │     │                        │     │  - OpenClaw    │
│              │     │  Thin API:             │     │  - Your skills │
│              │     │  - Hetzner proxy       │     │  - Their data  │
│              │     │  - Auth (Stytch)       │     │                │
│              │     │  - Billing (Stripe)    │     │  Updated via   │
│              │     │                        │     │  git push + SSH│
└──────────────┘     └────────────────────────┘     └────────────────┘
```

### Why 1:1 VPS

- **Simplicity**: No container orchestration, no bin-packing, no tracking which container is on which host
- **Security**: Full VM isolation (own kernel). One customer compromised ≠ all customers compromised
- **OpenClaw native**: It's just a normal OpenClaw install. No container quirks.
- **Portability**: tar the home directory → scp to new VPS → done
- **Customer gets**: 2 vCPU, 4GB RAM, 40GB SSD — a real machine

### Server Spec

**Hetzner CX23** (x86 Intel/AMD): 2 vCPU, 4GB RAM, 40GB NVMe, 20TB traffic, ~€4.49/mo

### Networking

- **DNS**: Wildcard `*.agents.tevy2.ai` → Hetzner Load Balancer IP
- **TLS**: Hetzner Load Balancer (€5.49/mo, handles all TLS)
- **Firewall**: Hetzner Cloud Firewall (free, API-managed)
  - SSH (22): Only from backend IP
  - Gateway (18789): Only from Load Balancer IP

---

## 6. Two Layers on Each VPS

```
/opt/tevy/  ← YOUR STUFF (updatable via git pull, shared across all customers)
├── version.txt
├── openclaw-version.txt
├── soul.md                    ← template (copied to workspace on first boot)
├── agents.md                  ← template (copied to workspace on first boot)
├── memory-template/           ← initial memory structure
│   ├── brand-profile.md
│   ├── competitors.md
│   └── content-calendar.md
├── skills/                    ← your custom skills (symlinked into workspace)
│   ├── brand-analyzer/SKILL.md
│   ├── social-drafter/SKILL.md
│   ├── seo-auditor/SKILL.md
│   ├── competitor-tracker/SKILL.md
│   ├── market-research/SKILL.md
│   ├── keyword-researcher/SKILL.md
│   └── content-seo/SKILL.md
├── shared-keys.env            ← Layer 2 API keys (Tavily, Brave, etc.)
├── provision.sh               ← first-time setup (run once)
└── update.sh                  ← update existing VPS (run many times)

/home/agent/.openclaw/  ← CUSTOMER'S STUFF (never touched by updates)
├── openclaw.json               ← their API keys, config
├── workspace/
│   ├── SOUL.md                 ← their copy (may have customized)
│   ├── AGENTS.md               ← their copy
│   ├── USER.md                 ← their profile
│   ├── MEMORY.md               ← their long-term memory
│   ├── memory/                 ← their daily notes, research, etc.
│   └── skills/ → /opt/tevy/skills  ← SYMLINK (updated via git pull)
├── agents/                     ← session data
└── settings/
```

**Skills are symlinked.** When you git push a skill update, all customers get it immediately on next gateway restart.

**SOUL.md / AGENTS.md** are copied once at first boot. After that, the customer's copy lives independently. Template updates only affect new customers.

---

## 7. Three API Key Types

### Layer 1: Platform (never on VPS)
Stytch, Stripe, Supabase, Hetzner API token → Railway env vars only.

### Layer 2: Shared Services (we pay, baked into image repo)
Tavily, Brave, Anthropic/OpenAI, AgentMail → in `/opt/tevy/shared-keys.env`, loaded by OpenClaw via environment. Updated via git push.

### Layer 3: Customer (injected at boot, their responsibility)
Telegram bot token, HubSpot, GitHub, Gmail → in `openclaw.json`, written by cloud-init at VPS creation.

---

## 8. Flows

### New Customer (60 seconds)

```
1. Customer signs up on dashboard
2. Backend: hcloud server create --image <base-snapshot> --user-data <cloud-init>
3. cloud-init writes openclaw.json (customer's keys) + runs provision.sh
4. provision.sh: clones Git repo → copies templates → symlinks skills → starts gateway
5. Backend: adds VPS to load balancer
6. Agent is live at customer-slug.agents.tevy2.ai
```

### Update All Customers (git push → done)

```
1. You edit skills, SOUL.md template, shared keys, or bump OpenClaw version
2. git push to tevy-agent-image repo
3. GitHub Action SSHs into each VPS and runs update.sh
4. update.sh: git pull → update OpenClaw if needed → restart gateway
5. Customer data untouched. Skills updated via symlink. Done.
```

update.sh:
```bash
#!/bin/bash
cd /opt/tevy && git pull origin main
WANTED=$(cat openclaw-version.txt)
CURRENT=$(openclaw --version 2>/dev/null || echo "none")
[ "$CURRENT" != "$WANTED" ] && npm install -g openclaw@$WANTED
cp shared-keys.env /etc/tevy/shared-keys.env
systemctl restart openclaw-gateway
```

### Migrate Customer (5 commands)

```
1. ssh old-vps "tar czf /tmp/backup.tar.gz -C /home/agent .openclaw/"
2. scp old-vps:/tmp/backup.tar.gz new-vps:/tmp/
3. ssh new-vps "tar xzf /tmp/backup.tar.gz -C /home/agent/"
4. ssh new-vps "systemctl restart openclaw-gateway"
5. Update load balancer target
```

### Dashboard Actions (all via SSH to VPS)

| Action | What happens |
|--------|-------------|
| Create agent | hcloud server create + cloud-init |
| Stop agent | hcloud server poweroff |
| Start agent | hcloud server poweron |
| Delete agent | backup + hcloud server delete |
| Install skill | ssh: clawhub install X |
| Change personality | ssh: write to SOUL.md + restart |
| Update API key | ssh: edit openclaw.json + restart |
| View logs | ssh: tail logs |
| Backup | ssh: tar + upload |

---

## 9. Hetzner Snapshot (the base image)

The snapshot is just **Ubuntu + Node.js + OpenClaw**. That's it. All Tevy-specific stuff comes from the Git repo at provision time.

### How to build it (one-time, ~5 minutes):

```bash
hcloud server create --name temp --type cx23 --image ubuntu-24.04
ssh root@<ip>
  apt update && apt install -y nodejs npm git curl jq
  npm install -g openclaw
  # create agent user, systemd service, etc.
  exit
hcloud server create-image temp --description "tevy-base-v1"
hcloud server delete temp
```

### When to rebuild:
- Ubuntu major version → rebuild (~2x/year)
- Node.js major version → rebuild (~1x/year)
- Everything else → git push + update.sh (no rebuild needed)

**The snapshot is dumber than a Docker image.** No Dockerfile, no layer caching, no registry. Just "Ubuntu with Node.js" frozen in time.

---

## 10. Database (minimal)

Two tables in Supabase. That's it.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  stytch_user_id TEXT,
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  slug TEXT NOT NULL,
  hetzner_server_id TEXT,
  hetzner_ip TEXT,
  state TEXT DEFAULT 'provisioning',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, slug)
);
```

No skills table — OpenClaw tracks skills on disk.
No keys table — openclaw.json on VPS.
No templates table — cloud-init scripts in codebase.
No usage table — Stripe handles billing.

---

## 11. Platform Backend (~50 lines of real logic)

```typescript
app.post("/v1/agents", auth, async (c) => {
  const server = await hetzner.createServer({ ... });
  await db.insert("agents", { account_id, slug, server_id, ip });
  return c.json({ id, slug, ip, status: "provisioning" });
});

app.get("/v1/agents", auth, async (c) => {
  return c.json(await db.query("SELECT * FROM agents WHERE account_id = $1", [id]));
});

app.delete("/v1/agents/:id", auth, async (c) => {
  await ssh(agent.ip, "bash /home/agent/backup.sh");
  await hetzner.deleteServer(agent.server_id);
  await db.delete("agents", id);
  return c.json({ ok: true });
});

app.post("/v1/agents/:id/actions/:action", auth, async (c) => {
  switch (action) {
    case "start":  await hetzner.poweron(server_id); break;
    case "stop":   await hetzner.poweroff(server_id); break;
    case "backup": await ssh(ip, "bash /home/agent/backup.sh"); break;
  }
});

app.post("/v1/agents/:id/ssh", auth, async (c) => {
  const result = await ssh(agent.ip, body.command);
  return c.json({ output: result });
});
```

Dual auth (Stytch sessions for dashboard, API keys for devs) can be added later with one middleware change. Same routes, same logic.

---

## 12. Skills

### Shipped in image repo (free for all customers)

| Skill | Purpose |
|-------|---------|
| brand-analyzer | Scrape website + socials → generate brand profile |
| social-drafter | Draft platform-specific posts from brand context |
| competitor-tracker | Monitor competitor social activity |
| market-research | Industry trends + audience insights |
| seo-auditor | Technical SEO audit |
| keyword-researcher | Discover target keywords |
| content-seo | Optimize content for SEO |

### Updated via git push
Skills live in the Git repo → symlinked into each customer's workspace. Update the repo, all customers get the new version on next restart.

### Future: premium skills
Can gate skills by checking plan tier in AGENTS.md or via a simple check script. No database needed — the plan info can be written to a file on the VPS at provisioning time.

---

## 13. Storage

- **Default**: 40GB NVMe (included with CX23)
- **Expansion**: Hetzner Volumes (€4.59/100GB), attachable via API
- **Backups**: tar + upload to Supabase Storage (cron on VPS)

---

## 14. Pricing

| | Starter | Pro | Business |
|---|---------|-----|----------|
| **Price** | €9.99/mo | €14.99/mo | €29.99/mo |
| **Resources** | 2 vCPU, 4GB, 40GB | 2 vCPU, 4GB, 100GB | 2 vCPU, 4GB, 256GB |
| **LLM** | Included (limited) | Included (higher) | BYOK |
| **Skills** | All shipped skills | All + future pro | All + custom upload |
| **Channels** | Webchat + 1 | Webchat + 3 | Unlimited |

### Unit Economics

| | Starter | Pro | Business |
|---|---------|-----|----------|
| Revenue | €9.99 | €14.99 | €29.99 |
| VPS (CX23) | €4.49 | €4.49 | €4.49 |
| Volume | — | €2.75 | €10.00 |
| LLM | ~€1.00 | ~€2.00 | €0 (BYOK) |
| APIs | ~€0.50 | ~€1.00 | ~€1.00 |
| LB share | ~€0.50 | ~€0.50 | ~€0.50 |
| **Cost** | **€6.49** | **€10.74** | **€15.99** |
| **Margin** | **35%** | **28%** | **47%** |

---

## 15. User Journey

### Onboarding
1. Sign up at tevy2.ai
2. Enter website URL + social links
3. Connect Telegram (provide bot token)
4. Agent provisions (~60 seconds)
5. Agent scrapes brand → sends first message: "Hey! Here's what I found about your brand..."

### Day-to-Day
Chat with your agent via Telegram or webchat. It drafts posts, tracks competitors, does SEO audits, and manages your content calendar — all through conversation.

### Dashboard
Overview, brand profile, content calendar, connected accounts, skills, analytics, embedded webchat, settings.

---

## 16. Dev Platform Future

The backend is already a generic agent provisioning API. To become a dev platform:
1. Add API key auth to the existing auth middleware
2. Add a "Generate API Key" button to the dashboard
3. Publish API docs

Same routes, same Hetzner calls, same everything. Tevy2 dashboard is just one consumer. External devs use the same API with API keys instead of Stytch sessions.

---

## 17. Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend | Next.js + Tailwind on Netlify | Free |
| Auth | Stytch (magic link) | Free tier |
| Backend | Hono on Railway | ~€5/mo |
| Database | Supabase (2 tables) | Free tier |
| Agent VPS | Hetzner CX23 per customer | €4.49/customer/mo |
| Load Balancer | Hetzner LB | €5.49/mo |
| AI Engine | OpenClaw (native on VPS) | Free (OSS) |
| LLM | Anthropic Claude | Usage-based |
| Web Search | Tavily API | Usage-based |
| Image repo | GitHub (tevy-agent-image) | Free |
| Domain | tevy2.ai | Registered ✅ |

---

## 18. Decisions Made

| Decision | Choice | Why |
|----------|--------|-----|
| Hosting | Hetzner CX23, 1:1 VPS | Simple, secure, no orchestration |
| Image | Git repo + Hetzner snapshot | Snapshot = just Ubuntu+Node. Git repo = everything else |
| Updates | git push → SSH update.sh | No rebuild needed for 95% of updates |
| Skills | Symlinked from /opt/tevy/skills/ | Updated via git pull, no per-customer management |
| State management | VPS is source of truth | No complex DB. OpenClaw manages its own state |
| Database | 2 Supabase tables | accounts + agents. That's it. |
| Backend | Thin Hetzner API proxy | ~50 lines of logic + auth + billing |
| Portability | tar ~/.openclaw/ → scp → untar | 5 commands to migrate |
| Containers | None | Not needed. Native install is simpler |
| Fly.io | Replaced | Cost + control + simplicity |
| Clawster | Shelved | Focus on Tevy2 |

## 19. Open Questions

1. Hetzner account — Boss needs to create + share API token
2. LLM model — Sonnet vs Opus for default instances?
3. Stripe account — needed for billing
4. Postiz account — needed for social posting
5. Demo business — which brand to test with?
6. X.com developer account — apply under Brain&Bot?

---

*Created: 2026-03-04 | Last updated: 2026-03-15 23:30 UTC*
