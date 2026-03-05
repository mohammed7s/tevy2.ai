# tevy2.ai — Product Requirements Document

> AI Marketing Concierge for SMEs
> Status: In Development | Hackathon MVP
> Last updated: 2026-03-04 23:00 UTC

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

- **The bot is an employee, not a tool.** It has a role (marketing), reports to the admin, and acts like a human team member. The admin manages it like they'd manage a junior marketer.
- **Concierge, not dashboard-first.** The chat IS the product. The dashboard supports it.
- **One instance per user.** Full isolation. Their data, their bot.
- **Opinionated defaults.** Pre-configured tools, skills, and prompts. User doesn't touch OpenClaw internals.
- **Platform agnostic.** User chooses their chat channel (Telegram, WhatsApp, or embedded webchat).

### Future Extension
The admin can configure the bot to interact with other team members (e.g., a designer, another marketer) or even other bots. Think of it as hiring more employees. Out of scope for MVP.

---

## 4. Architecture

```
┌─────────────────────────────┐
│     tevy2.ai Platform       │
│  (Provisioning + Dashboard) │
└──────────┬──────────────────┘
           │ spins up per user
           ▼
┌─────────────────────────────┐
│   OpenClaw Instance (per SME)│
│                              │
│  SOUL.md → Marketing persona │
│  Memory  → Brand profile,    │
│            competitors,       │
│            content history    │
│  Skills  → Social posting,   │
│            web research,      │
│            brand analysis     │
│  Tools   → Tavily, Postiz,   │
│            browser, web_fetch │
│  Channel → TG / WA / Webchat │
└─────────────────────────────┘
```

### Shared Resources (Master Accounts)
Each instance uses shared API keys managed by tevy2.ai platform:
- **Tavily** — web search / market research
- **Postiz** — social media scheduling & posting
- **LLM provider** — Anthropic/OpenAI (metered per user)

### Per-User Resources
- OpenClaw instance (containerized)
- Chat channel connection (user provides their TG bot token or WA number)
- Social account OAuth tokens (stored per instance)
- Brand memory files

---

## 5. User Journey

### 5.1 Onboarding (Dashboard)

1. User signs up at tevy2.ai
2. **Brand Setup:**
   - Paste website URL
   - Paste social media profile links (IG, TikTok, LinkedIn, X, FB)
   - Optionally upload brand guidelines (PDF/doc/images)
3. **Connect Platforms:**
   - OAuth connect to social accounts they want to post to
   - OR use pre-installed demo accounts for testing
4. **Choose Chat Channel:**
   - Telegram (provide bot token or we provision one)
   - WhatsApp
   - Embedded webchat on dashboard (always available)
5. **Agent activates:**
   - Scrapes website + social profiles
   - Generates Brand Profile (vibe, audience, value prop, tone)
   - Sends first message via chat: "Hey! I've analyzed your brand. Here's what I found: [summary]. Does this feel right?"

### 5.2 Day-to-Day (Chat — Concierge Mode)

User talks to the bot naturally:

```
User: "We're launching a new product next week, help me with posts"
Bot:  [Asks a few questions about the product]
Bot:  [Drafts platform-specific posts: IG carousel, TikTok script, LinkedIn text]
Bot:  "Here are 3 options. Want me to schedule them?"

User: "What are competitors doing?"
Bot:  [Pulls recent competitor posts, summarizes trends]
Bot:  "Competitor X is pushing sustainability hard. Want me to draft something in that angle?"

User: "Schedule option 2 for Tuesday 9am"
Bot:  "Done ✅ Scheduled for Tue 9am on IG and LinkedIn."

User: "How did last week do?"
Bot:  [Pulls analytics] "Your IG reel got 2.3K views, 45% above your average..."
```

### 5.3 Dashboard (Support & Visibility)

The dashboard provides:
- Overview of brand profile
- Content calendar (view + edit scheduled posts)
- Connected accounts status
- Analytics / performance
- Market research reports
- Embedded webchat widget (always available)

---

## 6. Features

### 6.1 Brand Analysis (Pillar 1)
- **Input:** Website URL, social links, uploaded brand guidelines
- **Process:** Scrape + analyze → extract vibe, audience, value prop, tone of voice, visual style
- **Output:** `brand-profile.md` stored in agent memory
- **Editable:** User can refine via chat ("Actually our target is more 30-45 age range") or dashboard
- **Updates:** Agent re-analyzes periodically or on request

### 6.2 Social Media Drafting & Posting (Pillar 2)
- **Drafting:** Agent proposes posts based on brand profile, trends, and user requests
- **Multi-platform adaptation:** Same content adapted per platform (IG visual, TikTok video script, LinkedIn professional, X concise)
- **Approval flow:** Draft → send to user via chat → user approves/edits → schedule/publish
- **Content calendar:** Visual calendar on dashboard, agent manages scheduling
- **Posting mechanism:** Postiz (self-hosted, multi-platform support)
- **Supported platforms (MVP):** Instagram, TikTok, LinkedIn, X
- **Future:** Facebook, YouTube, Pinterest

### 6.3 Market Research (Pillar 3)
- **Competitor tracking:** Monitor competitor social accounts (posts, engagement, themes)
- **Industry trends:** Web search for trending topics in user's niche
- **Audience insights:** Scrape reviews, forums, Reddit for pain points and language
- **Output:** Weekly research digest delivered via chat + viewable on dashboard
- **Framework:**
  1. Identify 3-5 competitors (user provides or agent discovers)
  2. Track their social posting cadence, themes, engagement
  3. Search for industry keywords weekly
  4. Summarize: "Here's what's happening in your space this week"

---

## 7. Dashboard Pages

| Page | Purpose |
|------|---------|
| **Home** | Overview: brand summary, upcoming posts, quick stats, recent research |
| **Brand** | Brand profile (editable), audience persona, voice guidelines |
| **Calendar** | Content calendar — view, edit, reschedule posts |
| **Connect** | Link social accounts (OAuth), manage chat channel, API status |
| **Analytics** | Post performance across platforms, trends over time |
| **Research** | Market research reports, competitor tracking, trend alerts |
| **Chat** | Embedded webchat widget — always-on fallback channel |

---

## 8. OpenClaw Preconfiguration (Per Instance)

### SOUL.md
- Persona: Friendly, knowledgeable marketing consultant
- Tone: Simple language, no jargon, actionable advice
- Role: "You are [Brand Name]'s dedicated marketing assistant"
- Boundaries: Only acts on marketing tasks, doesn't make financial decisions

### AGENTS.md
- On startup: Read brand-profile.md, check content calendar
- Proactive: Suggest posts based on calendar gaps, trending topics
- Approval required: Never post without explicit user approval
- Memory: Update brand profile as user provides new info

### Memory Structure
```
memory/
├── brand-profile.md      # Brand vibe, audience, value prop, tone
├── competitors.md        # Tracked competitors + notes
├── content-calendar.md   # Scheduled and past posts
├── research/
│   └── YYYY-MM-DD.md     # Research digests
└── conversations/
    └── key-decisions.md   # Important user preferences
```

### Pre-installed Tools
| Tool | Purpose | Account Type |
|------|---------|-------------|
| Tavily | Web search, market research | Master (shared) |
| Postiz | Social posting & scheduling | Master or per-user |
| web_fetch | Scrape websites, competitor pages | Built-in |
| Browser | Deep research, social scraping | Built-in |
| Image gen | Social media creatives | Master (shared) |

### Channel Config
- Telegram OR WhatsApp OR Webchat (user chooses during onboarding)
- Webchat always available on dashboard as fallback

---

## 9. Tech Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| Frontend | Next.js 16 + Tailwind | ✅ Built |
| Auth | Stytch (magic link) | 🔲 Wiring up |
| Backend/DB | Next.js API routes + TBD | 🔲 |
| AI Engine | OpenClaw (one container per user) | ✅ Configs ready |
| Social Posting | Postiz (master account, cloud) | 🔲 Need account |
| Web Search | Tavily API | ✅ Key available |
| LLM | Claude (model TBD) | 🔲 |
| Hosting (app) | Fly.io (Next.js app) | ✅ Decided |
| Hosting (instances) | Fly.io Machines (1 per user, lazy-start) | ✅ Decided |
| Database + Auth | Supabase (free tier) | ✅ Decided |
| Chat | OpenClaw webchat embed | 🔲 |
| Tunnel (dev) | localtunnel | ✅ Running |

---

## 10. MVP Scope (Hackathon — 1 Day, Solo)

### The Demo Story
"Paste your website URL, and in 60 seconds you have a marketing person who knows your brand."

### Must Have
- [ ] Onboarding form (simple web page or script) → generates USER.md → triggers brand analysis
- [ ] Brand analysis: agent scrapes website + social profiles → generates brand-profile.md → introduces itself via chat
- [ ] Chat concierge via OpenClaw webchat (embedded on a page or standalone)
- [ ] Social post drafting with approval flow (draft → present options → user approves/edits)
- [ ] Basic competitor research (user provides names → agent scrapes → summarizes)
- [ ] Pre-configured OpenClaw instance with SOUL.md, AGENTS.md, USER.md, memory templates
- [ ] Content calendar tracking in memory (markdown-based, not UI)

### Nice to Have (if time)
- [ ] Telegram bot as alternative channel
- [ ] Actual posting via Postiz API
- [ ] Simple landing page for tevy2.ai
- [ ] Multi-platform post adaptation (same content → IG/LinkedIn/X variants)

### Out of Scope
- [ ] Dashboard UI
- [ ] OAuth social account connections
- [ ] Analytics
- [ ] Multi-user provisioning / billing
- [ ] Image/video generation
- [ ] Ad campaigns, SEO, CRM

---

## 11. Skills Architecture

### Where Skills Live
Each tevy2.ai instance ships with pre-configured skills in `<workspace>/skills/`. This is the highest-precedence location — per-agent, isolated.

```
workspace/
├── skills/
│   ├── brand-analyzer/SKILL.md     # Scrape + analyze brand from URL
│   ├── social-drafter/SKILL.md     # Draft platform-specific posts
│   ├── competitor-tracker/SKILL.md # Monitor competitor social activity
│   ├── market-research/SKILL.md    # Industry trends + audience insights
│   └── postiz/SKILL.md            # Schedule/publish via Postiz API (Phase 2)
├── SOUL.md
├── AGENTS.md
├── USER.md
└── memory/
```

### Skills We Ship (MVP)

**brand-analyzer**
- Input: Website URL, social profile links
- Tools: web_fetch, browser
- Output: Writes memory/brand-profile.md
- Does: Scrapes site, extracts vibe/audience/value prop/tone, analyzes existing social posts

**social-drafter**
- Input: Topic/request + brand-profile.md context
- Tools: none (pure LLM generation)
- Output: 2-3 post drafts per platform
- Does: Adapts content per platform (IG caption, LinkedIn article, X thread, TikTok script)

**competitor-tracker**
- Input: Competitor names/URLs from competitors.md
- Tools: web_fetch, web_search (Tavily)
- Output: Updates memory/competitors.md + research digest
- Does: Scrapes competitor social accounts, identifies themes/cadence/engagement

**market-research**
- Input: Industry keywords from brand-profile.md
- Tools: web_search (Tavily), web_fetch
- Output: Writes memory/research/YYYY-MM-DD.md
- Does: Searches for trending topics, audience pain points, industry news

### Phase 2 Skills

**postiz** — Publish posts via Postiz API
**content-calendar-ui** — Sync calendar with external tools
**analytics** — Pull performance data from social platforms
**image-gen** — Generate social media creatives
**concierge-onboarding** — Guided setup bot (Option A architecture)

### Skill Management
- Skills are version-pinned per deployment
- Updates go through tevy2.ai platform, not individual instances
- ClawHub used for distribution if we open-source them later

---

## 12. Phases

### Phase 1 — Hackathon (NOW)
**Goal:** Production-level, ready to charge money.
- ✅ Landing page (hero, features, pricing, CTA)
- ✅ 4-step onboarding wizard (business info → socials → preferences → launch)
- ✅ Login page (magic link via Stytch)
- ✅ Launch API generates USER.md + brand-profile.md + competitors.md
- 🔲 Stytch auth wiring
- 🔲 Instance provisioning (deploy OpenClaw per user)
- 🔲 Postiz integration (master account, schedule + publish)
- 🔲 OpenClaw webchat embed in /chat
- 🔲 Stripe billing ($29/$79 tiers)
- Option C architecture (form → deploy → Tevy boots with data)

### Phase 2 — Post-Hackathon
- Option A concierge bot for guided onboarding via chat
- Dashboard (brand overview, content calendar, analytics)
- OAuth social account connections (user connects IG/TT/LI/X directly)
- Telegram/WhatsApp channel options
- Image/video generation for posts
- Advanced analytics + reporting

---

## 13. Decisions Made
- **Architecture:** Option C (form → deploy instance → Tevy boots with data). Option A concierge bot in Phase 2.
- **Postiz:** Master account (shared). User connects socials through our Postiz. No per-user Postiz instances.
- **Auth:** Stytch magic links (used before on Clawster)
- **Skills location:** `<workspace>/skills/` per instance (highest precedence)
- **Team:** Solo (Mohammed) + McClowin
- **Domain:** tevy2.ai (registered)
- **Pricing:** $29/mo Starter, $79/mo Pro

## 14. Open Questions
1. **Hosting:** VPS (Docker) vs HuggingFace Spaces vs Fly.io? — deciding
2. **Postiz account:** Need to create master account + API key
3. **LLM model:** Sonnet (cheaper) vs Opus (smarter) for Tevy instances?
4. **Stripe:** Need account + product/price IDs
5. **Demo business:** Which real/fake business to test with?

---

*Created: 2026-03-04 | Last updated: 2026-03-04*
