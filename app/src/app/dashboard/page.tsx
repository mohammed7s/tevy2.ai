"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInstance } from "@/lib/api";

type OnboardingData = {
  channel: string;
  telegramBotToken: string;
  ownerName: string;
  businessName: string;
  websiteUrl: string;
  instagram: string;
  tiktok: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  competitors: string;
  brandNotes: string;
};

export default function DashboardPage() {
  // TODO: Check if user has an active instance
  // If not, show onboarding. If yes, show dashboard.
  const [hasInstance, setHasInstance] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (!hasInstance && !onboardingComplete) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setHasInstance(true);
          setOnboardingComplete(true);
        }}
      />
    );
  }

  return <DashboardView />;
}

/* ─── ONBOARDING FLOW ─── */
function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deployLog, setDeployLog] = useState<string[]>([]);

  const [form, setForm] = useState<OnboardingData>({
    channel: "",
    telegramBotToken: "",
    ownerName: "",
    businessName: "",
    websiteUrl: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
    twitter: "",
    facebook: "",
    competitors: "",
    brandNotes: "",
  });

  const update = (field: keyof OnboardingData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeploy = async () => {
    setLoading(true);
    setStep(4); // Show deploy animation

    const steps = [
      "Initializing agent workspace...",
      `Scanning ${form.websiteUrl || "website"}...`,
      "Analyzing brand voice & audience...",
      "Loading skills: content-drafting, competitor-watch, calendar...",
      `Configuring ${form.channel === "telegram" ? "Telegram" : "webchat"} channel...`,
      "Deploying agent instance...",
    ];

    for (const line of steps) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      setDeployLog((prev) => [...prev, line]);
    }

    try {
      await createInstance({
        ownerName: form.ownerName,
        businessName: form.businessName,
        websiteUrl: form.websiteUrl,
        instagram: form.instagram,
        tiktok: form.tiktok,
        linkedin: form.linkedin,
        twitter: form.twitter,
        facebook: form.facebook,
        competitors: form.competitors,
        brandNotes: form.brandNotes,
        postingGoal: "3-4 posts per week",
        chatChannel: form.channel || "webchat",
        telegramBotToken: form.telegramBotToken || undefined,
      });
      setDeployLog((prev) => [...prev, "✓ Agent deployed successfully!"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      setDeployLog((prev) => [...prev, `✗ Error: ${msg}`]);
    }

    setLoading(false);
    setTimeout(onComplete, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 max-w-4xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo-wizard.jpg" alt="tevy2" className="w-7 h-7 rounded-lg" />
          <span className="text-xl font-bold">
            <span className="gradient-text">tevy2</span>
            <span className="text-[var(--muted)]">.ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className={step >= 1 ? "text-white" : ""}>Channel</span>
          <span>→</span>
          <span className={step >= 2 ? "text-white" : ""}>Brand</span>
          <span>→</span>
          <span className={step >= 3 ? "text-white" : ""}>Launch</span>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-8 pb-20">
        <div className="max-w-lg w-full">

          {/* STEP 1: Choose Channel */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">How do you want to chat with Tevy?</h1>
                <p className="text-sm text-[var(--muted)]">
                  Pick your preferred channel. You can always change this later.
                </p>
              </div>

              <div className="space-y-3">
                {/* Telegram — primary */}
                <button
                  onClick={() => { update("channel", "telegram"); }}
                  className={`w-full glass rounded-xl p-5 text-left transition-all hover:border-[var(--accent)] ${
                    form.channel === "telegram" ? "border border-[var(--accent)] glow" : "border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#2AABEE] flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        Telegram
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--green-dim)] text-[var(--green)]">Recommended</span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mt-0.5">
                        Chat with Tevy right from your phone. Fastest setup.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Webchat */}
                <button
                  onClick={() => { update("channel", "webchat"); }}
                  className={`w-full glass rounded-xl p-5 text-left transition-all hover:border-[var(--accent)] ${
                    form.channel === "webchat" ? "border border-[var(--accent)] glow" : "border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--surface-light)] flex items-center justify-center text-2xl">
                      💬
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Webchat</div>
                      <p className="text-sm text-[var(--muted)] mt-0.5">
                        Chat with Tevy right here in your dashboard.
                      </p>
                    </div>
                  </div>
                </button>

                {/* WhatsApp — coming soon */}
                <div className="w-full glass rounded-xl p-5 text-left opacity-50 cursor-not-allowed">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center text-2xl">
                      📱
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        WhatsApp
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-light)] text-[var(--muted)]">Coming soon</span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mt-0.5">
                        Chat with Tevy on WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Discord — coming soon */}
                <div className="w-full glass rounded-xl p-5 text-left opacity-50 cursor-not-allowed">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#5865F2] flex items-center justify-center text-2xl">
                      🎮
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        Discord
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-light)] text-[var(--muted)]">Coming soon</span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mt-0.5">
                        Add Tevy to your Discord server.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Telegram bot token input (shown when telegram selected) */}
              {form.channel === "telegram" && (
                <div className="glass rounded-xl p-5 mt-2">
                  <label className="text-sm text-[var(--muted)] mb-2 block">
                    Telegram Bot Token <span className="text-xs">(from @BotFather)</span>
                  </label>
                  <input
                    className="input-field text-sm font-mono"
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={form.telegramBotToken}
                    onChange={(e) => update("telegramBotToken", e.target.value)}
                  />
                  <p className="text-xs text-[var(--muted)] mt-2">
                    Don&apos;t have one? <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-light)] hover:underline">Create a bot with @BotFather</a> — it takes 30 seconds.
                  </p>
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                className="btn-primary w-full"
                disabled={!form.channel || (form.channel === "telegram" && !form.telegramBotToken)}
              >
                Continue →
              </button>
            </div>
          )}

          {/* STEP 2: Brand Info */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Tell Tevy about your brand</h1>
                <p className="text-sm text-[var(--muted)]">
                  The more you share, the better your agent gets. You can always update this later.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--muted)] mb-1 block">Your name</label>
                    <input
                      className="input-field"
                      placeholder="Jane Smith"
                      value={form.ownerName}
                      onChange={(e) => update("ownerName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)] mb-1 block">Business name *</label>
                    <input
                      className="input-field"
                      placeholder="Sunrise Coffee Co"
                      value={form.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] mb-1 block">Website URL</label>
                  <input
                    className="input-field"
                    placeholder="https://sunrisecoffee.com"
                    value={form.websiteUrl}
                    onChange={(e) => update("websiteUrl", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] mb-2 block">Social accounts <span className="text-xs">(optional)</span></label>
                  <div className="space-y-2">
                    {[
                      { key: "instagram" as const, icon: "📸", placeholder: "@handle or URL" },
                      { key: "tiktok" as const, icon: "🎵", placeholder: "@handle or URL" },
                      { key: "linkedin" as const, icon: "💼", placeholder: "Company page URL" },
                      { key: "twitter" as const, icon: "𝕏", placeholder: "@handle" },
                      { key: "facebook" as const, icon: "📘", placeholder: "Page URL" },
                    ].map((s) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="w-6 text-center text-sm">{s.icon}</span>
                        <input
                          className="input-field !py-2.5 text-sm"
                          placeholder={s.placeholder}
                          value={form[s.key]}
                          onChange={(e) => update(s.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] mb-1 block">
                    Competitors <span className="text-xs">(comma-separated, optional)</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="Blue Bottle, Stumptown, intelligentsia.com"
                    value={form.competitors}
                    onChange={(e) => update("competitors", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--muted)] mb-1 block">
                    Anything else? <span className="text-xs">(optional)</span>
                  </label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Brand voice, target audience, goals..."
                    value={form.brandNotes}
                    onChange={(e) => update("brandNotes", e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary flex-1"
                  disabled={!form.businessName}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Launch */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Ready to launch</h1>
                <p className="text-sm text-[var(--muted)]">
                  Review your setup and deploy your marketing agent.
                </p>
              </div>

              <div className="terminal-block">
                <div className="terminal-header">
                  <div className="terminal-dot" style={{ background: "#ff5f57" }}></div>
                  <div className="terminal-dot" style={{ background: "#febc2e" }}></div>
                  <div className="terminal-dot" style={{ background: "#28c840" }}></div>
                  <span className="text-xs text-[var(--muted)] ml-2 font-mono">agent.config</span>
                </div>
                <div className="terminal-body text-sm">
                  <div><span className="text-[var(--terminal-green)]">business:</span> {form.businessName}</div>
                  <div><span className="text-[var(--terminal-green)]">owner:</span> {form.ownerName || "—"}</div>
                  <div><span className="text-[var(--terminal-green)]">website:</span> {form.websiteUrl || "—"}</div>
                  <div><span className="text-[var(--terminal-green)]">channel:</span> {form.channel === "telegram" ? "Telegram" : "Webchat"}</div>
                  <div><span className="text-[var(--terminal-green)]">socials:</span> {
                    [form.instagram && "IG", form.tiktok && "TT", form.linkedin && "LI", form.twitter && "X", form.facebook && "FB"]
                      .filter(Boolean).join(", ") || "none yet"
                  }</div>
                  {form.competitors && (
                    <div><span className="text-[var(--terminal-green)]">competitors:</span> {form.competitors}</div>
                  )}
                  <div className="mt-2 text-[var(--muted)]">
                    <span className="text-[var(--terminal-green)]">skills:</span> content-drafting, competitor-watch, calendar, brand-analysis
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">
                  ← Back
                </button>
                <button
                  onClick={handleDeploy}
                  className="btn-primary flex-1 text-lg"
                  disabled={loading}
                >
                  🚀 Deploy Agent
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Deploying */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="terminal-block glow">
                <div className="terminal-header">
                  <div className="terminal-dot" style={{ background: "#ff5f57" }}></div>
                  <div className="terminal-dot" style={{ background: "#febc2e" }}></div>
                  <div className="terminal-dot" style={{ background: "#28c840" }}></div>
                  <span className="text-xs text-[var(--muted)] ml-2 font-mono">tevy2 deploy --brand &quot;{form.businessName}&quot;</span>
                </div>
                <div className="terminal-body">
                  {deployLog.map((line, i) => (
                    <div key={i} className={`${
                      line.startsWith("✓") ? "text-[var(--terminal-green)] font-bold mt-2" :
                      line.startsWith("✗") ? "text-red-400 font-bold mt-2" :
                      "text-[var(--muted)]"
                    }`}>
                      {!line.startsWith("✓") && !line.startsWith("✗") && (
                        <span className="text-[var(--terminal-green)]">→ </span>
                      )}
                      {line}
                    </div>
                  ))}
                  {loading && <div className="cursor-blink text-[var(--muted)] mt-1"></div>}
                </div>
              </div>

              {!loading && deployLog.some(l => l.startsWith("✓")) && (
                <div className="glass rounded-2xl p-8 text-center glow">
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold mb-3">Tevy is live!</h2>
                  <p className="text-[var(--muted)] text-sm mb-4">
                    Redirecting to your dashboard...
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ─── MAIN DASHBOARD VIEW ─── */
function DashboardView() {
  const [activeTab, setActiveTab] = useState("home");

  const NAV_ITEMS = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "brand", icon: "🎯", label: "Brand" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "connect", icon: "🔗", label: "Connect" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "research", icon: "🔍", label: "Research" },
    { id: "chat", icon: "💬", label: "Chat" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-wizard.jpg" alt="tevy2" className="w-7 h-7 rounded-lg" />
            <span className="text-lg font-bold">
              <span className="gradient-text">tevy2</span>
              <span className="text-[var(--muted)]">.ai</span>
            </span>
          </Link>
          <div className="mt-2 powered-badge text-xs">
            <span style={{ fontSize: "11px" }}>🐾</span> Powered by OpenClaw
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-semibold">Agent Online</span>
          </div>
          <p className="text-xs text-[var(--muted)] font-mono">your-business</p>
        </div>

        <nav className="flex-1 py-3 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
                activeTab === item.id
                  ? "bg-[rgba(34,197,94,0.15)] text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-light)]"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {activeTab === "home" && <HomeTab />}
        {activeTab === "chat" && <ChatTab />}
        {activeTab !== "home" && activeTab !== "chat" && (
          <div className="p-8 max-w-4xl">
            <h1 className="text-2xl font-bold mb-2 capitalize">{activeTab}</h1>
            <p className="text-[var(--muted)]">Coming soon — Tevy is setting things up.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function HomeTab() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Welcome!</h1>
      <p className="text-[var(--muted)] mb-8">Your marketing agent is live. Here&apos;s what&apos;s happening.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Agent Status", value: "🟢 Online", sub: "Ready to chat" },
          { label: "Posts Drafted", value: "0", sub: "Chat with Tevy to start" },
          { label: "Channel", value: "Telegram", sub: "Connected" },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="text-xs text-[var(--muted)] mb-1">{stat.label}</div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-[var(--muted)] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold mb-3">Get started</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Open Telegram and send a message to your bot. Tevy will introduce itself, analyze your brand, and start drafting content.
        </p>
        <div className="terminal-block">
          <div className="terminal-body text-sm">
            <div className="text-[var(--muted)]"># Try saying:</div>
            <div className="mt-1">&quot;Analyze my website and tell me what you think&quot;</div>
            <div>&quot;Draft 3 Instagram posts about our new product&quot;</div>
            <div>&quot;What are my competitors posting this week?&quot;</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatTab() {
  return (
    <div className="p-8 max-w-3xl h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-1">Chat with Tevy</h1>
      <p className="text-[var(--muted)] mb-6">Webchat — your agent also lives on Telegram</p>

      <div className="glass rounded-2xl flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <img src="/logo-wizard.jpg" alt="Tevy" className="w-16 h-16 rounded-full mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Chat widget loading...</h3>
            <p className="text-sm text-[var(--muted)]">
              The webchat will be embedded here from your agent instance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
