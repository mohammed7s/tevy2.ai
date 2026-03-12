"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createInstance, listInstances } from "@/lib/api";
import { signOut } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type OnboardingData = {
  addTelegram: boolean;
  telegramBotToken: string;
  ownerName: string;
  businessName: string;
  websiteUrl: string;
  instagram: string;
  tiktok: string;
  linkedin: string;
  twitter: string;
  facebook: string;
};

const NAV_ITEMS = [
  { id: "home", icon: "🏠", label: "Home" },
  { id: "brand", icon: "🎯", label: "Brand" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "analytics", icon: "📊", label: "Analytics" },
  { id: "research", icon: "🔍", label: "Research" },
  { id: "seo", icon: "🔎", label: "SEO" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

export default function DashboardPage() {
  const [hasInstance, setHasInstance] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [instanceData, setInstanceData] = useState<{
    id: string;
    name: string;
    webchatUrl: string;
    config?: Record<string, unknown>;
  } | null>(null);

  // Hydrate from API on mount — checks if user already has an instance
  useEffect(() => {
    async function hydrate() {
      try {
        const { instances } = await listInstances();
        if (instances && instances.length > 0) {
          const inst = instances[0] as Record<string, string>;
          const data = {
            id: inst.id,
            name: inst.fly_machine_name || "",
            webchatUrl: inst.webchatUrl || `https://${inst.fly_machine_name}.fly.dev`,
            config: inst.config as unknown as Record<string, unknown>,
          };
          setInstanceData(data);
          setHasInstance(true);
          // Keep localStorage in sync
          localStorage.setItem("tevy_instance_id", data.id);
          localStorage.setItem("tevy_instance_name", data.name);
          localStorage.setItem("tevy_webchat_url", data.webchatUrl);
        }
      } catch {
        // Not logged in or API down — fall back to localStorage
        const savedId = localStorage.getItem("tevy_instance_id");
        if (savedId) {
          setInstanceData({
            id: savedId,
            name: localStorage.getItem("tevy_instance_name") || "",
            webchatUrl: localStorage.getItem("tevy_webchat_url") || "",
          });
          setHasInstance(true);
        }
      }
    }
    hydrate();
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
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
            <div className={`w-2 h-2 rounded-full ${hasInstance ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></div>
            <span className="text-sm font-semibold">{hasInstance ? "Agent Online" : "Setup Required"}</span>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                // Settings always accessible, others need instance
                if (item.id === "settings" || hasInstance) setActiveTab(item.id);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
                (!hasInstance && item.id !== "settings") ? "opacity-40 cursor-not-allowed" :
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

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[var(--border)]">
          <button
            onClick={async () => {
              await signOut();
              localStorage.removeItem("tevy_instance_id");
              localStorage.removeItem("tevy_instance_name");
              localStorage.removeItem("tevy_webchat_url");
              localStorage.removeItem("tevy_business_name");
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-red-400 hover:bg-[var(--surface-light)] transition-colors"
          >
            <span>🚪</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {!hasInstance ? (
          <OnboardingPanel onComplete={(data) => {
            setInstanceData(data);
            setHasInstance(true);
          }} />
        ) : (
          <>
            {activeTab === "home" && <HomeTab instanceData={instanceData} />}
            {activeTab === "brand" && <BrandTab instanceData={instanceData} />}
            {activeTab === "calendar" && <CalendarTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
            {activeTab === "research" && <ResearchTab />}
            {activeTab === "seo" && <SEOTab />}
            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
}

/* ─── ONBOARDING PANEL ─── */
function OnboardingPanel({ onComplete }: { onComplete: (data: { id: string; name: string; webchatUrl: string }) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bootStatus, setBootStatus] = useState<{
    stage: string;
    progress: number;
    message: string;
    ready: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState<OnboardingData>({
    addTelegram: false,
    telegramBotToken: "",
    ownerName: "",
    businessName: "",
    websiteUrl: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
    twitter: "",
    facebook: "",
  });

  const update = (field: keyof OnboardingData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollBootStatus = useCallback((instanceId: string) => {
    const token = localStorage.getItem("tevy_session_token") || "";

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/instances/${instanceId}/boot-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const status = await res.json();
        setBootStatus(status);

        if (status.ready) {
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.setItem("tevy_webchat_url", status.webchatUrl || "");
          setTimeout(() => {
            onComplete({
              id: instanceId,
              name: localStorage.getItem("tevy_instance_name") || "",
              webchatUrl: status.webchatUrl || "",
            });
          }, 1500);
        }

        if (status.stage === "error" || status.stage === "offline") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(status.message);
          setLoading(false);
        }
      } catch {
        // Network error, keep polling
      }
    }, 3000);
  }, [onComplete]);

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setStep(3);
    setBootStatus({ stage: "creating", progress: 5, message: "Creating your agent...", ready: false });

    if (process.env.NEXT_PUBLIC_MOCK_DEPLOY === "true") {
      // Mock mode
      const stages = [
        { stage: "provisioning", progress: 15, message: "Provisioning infrastructure..." },
        { stage: "starting", progress: 30, message: "Starting secure container..." },
        { stage: "booting", progress: 50, message: "Booting AI engine..." },
        { stage: "booting", progress: 70, message: "Connecting channels..." },
        { stage: "ready", progress: 100, message: "Agent online!" },
      ];
      for (const s of stages) {
        await new Promise((r) => setTimeout(r, 1200));
        setBootStatus({ ...s, ready: s.stage === "ready" });
      }
      setTimeout(() => onComplete({ id: "mock", name: "mock", webchatUrl: "" }), 1500);
      setLoading(false);
      return;
    }

    try {
      const result = await createInstance({
        ownerName: form.ownerName,
        businessName: form.businessName,
        websiteUrl: form.websiteUrl,
        instagram: form.instagram,
        tiktok: form.tiktok,
        linkedin: form.linkedin,
        twitter: form.twitter,
        facebook: form.facebook,
        postingGoal: "3-4 posts per week",
        chatChannel: form.addTelegram ? "telegram" : "webchat",
        telegramBotToken: form.addTelegram ? form.telegramBotToken : undefined,
      });

      localStorage.setItem("tevy_instance_id", result.instance.id);
      localStorage.setItem("tevy_instance_name", result.instance.name);
      localStorage.setItem("tevy_webchat_url", result.instance.webchatUrl);

      setBootStatus({ stage: "provisioning", progress: 15, message: "Provisioning infrastructure...", ready: false });

      // Start polling boot status
      pollBootStatus(result.instance.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8 text-sm">
        <span className={step >= 1 ? "text-white font-semibold" : "text-[var(--muted)]"}>① Business</span>
        <span className="text-[var(--border)]">—</span>
        <span className={step >= 2 ? "text-white font-semibold" : "text-[var(--muted)]"}>② Channel</span>
        <span className="text-[var(--border)]">—</span>
        <span className={step >= 3 ? "text-white font-semibold" : "text-[var(--muted)]"}>③ Deploy</span>
      </div>

      {/* STEP 1: Business Info (simplified — just name, website, socials) */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold mb-2">Tell Tevy about your business</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            Just the basics. You can add more details later in the Brand tab.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">Your name</label>
                <input
                  className="input-field"
                  placeholder="Jane Smith"
                  value={form.ownerName}
                  onChange={(e) => update("ownerName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">Business name *</label>
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
              <label className="text-xs text-[var(--muted)] mb-1 block">Website URL</label>
              <input
                className="input-field"
                placeholder="https://sunrisecoffee.com"
                value={form.websiteUrl}
                onChange={(e) => update("websiteUrl", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)] mb-1.5 block">Social accounts <span className="text-xs">(optional)</span></label>
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
                      className="input-field !py-2 text-sm"
                      placeholder={s.placeholder}
                      value={form[s.key]}
                      onChange={(e) => update(s.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="btn-primary w-full mt-6"
            disabled={!form.businessName}
          >
            Continue →
          </button>
        </div>
      )}

      {/* STEP 2: Channel */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-bold mb-2">How do you want to chat with Tevy?</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            Choose your preferred channel. You can add more later.
          </p>

          {/* Telegram */}
          <button
            onClick={() => update("addTelegram", !form.addTelegram)}
            className={`w-full glass rounded-xl p-4 mb-3 text-left transition-all ${
              form.addTelegram ? "border border-[var(--accent)] glow" : "border border-transparent hover:border-[var(--border)]"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#2AABEE] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  Telegram
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-light)] text-[var(--accent-light)]">Recommended</span>
                </div>
                <p className="text-xs text-[var(--muted)]">Chat with Tevy from your phone, anytime</p>
              </div>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                form.addTelegram ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)]"
              }`}>
                {form.addTelegram && <span className="text-xs">✓</span>}
              </div>
            </div>
          </button>

          {/* Telegram bot token input */}
          {form.addTelegram && (
            <div className="glass rounded-xl p-4 mb-3 ml-14">
              <label className="text-xs text-[var(--muted)] mb-1.5 block">
                Bot Token <span className="text-[var(--muted)]">(from @BotFather)</span>
              </label>
              <input
                className="input-field text-sm font-mono"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={form.telegramBotToken}
                onChange={(e) => update("telegramBotToken", e.target.value)}
                autoFocus
              />
              <p className="text-xs text-[var(--muted)] mt-1.5">
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-light)] hover:underline">Create a bot</a> — takes 30 seconds
              </p>
            </div>
          )}

          {/* Coming soon */}
          <div className="space-y-2 mt-4 mb-6">
            {[
              { icon: "📱", name: "WhatsApp", bg: "#25D366" },
              { icon: "🎮", name: "Discord", bg: "#5865F2" },
              { icon: "💬", name: "Slack", bg: "#4A154B" },
            ].map((ch) => (
              <div key={ch.name} className="glass rounded-xl p-3 opacity-40">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: ch.bg }}>
                    {ch.icon}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{ch.name}</span>
                    <span className="text-xs text-[var(--muted)] ml-2">Coming soon</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
            <button
              onClick={handleDeploy}
              className="btn-primary flex-1"
              disabled={form.addTelegram && !form.telegramBotToken}
            >
              🚀 Deploy Agent
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Deploy with real status bar */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-bold mb-2 text-center">Deploying your agent</h1>
          <p className="text-sm text-[var(--muted)] mb-8 text-center">
            This takes about 60 seconds. Hang tight!
          </p>

          {/* Progress bar */}
          <div className="glass rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              {bootStatus?.ready ? (
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              ) : error ? (
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
              ) : (
                <div className="w-3 h-3 rounded-full bg-[var(--accent)] animate-pulse"></div>
              )}
              <span className="text-sm font-semibold">
                {error ? "Deploy failed" : bootStatus?.message || "Initializing..."}
              </span>
            </div>

            {/* Bar */}
            <div className="w-full h-2 bg-[var(--surface-light)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${bootStatus?.progress || 0}%`,
                  background: error
                    ? "#ef4444"
                    : bootStatus?.ready
                    ? "#22c55e"
                    : "linear-gradient(90deg, var(--accent), var(--accent-light))",
                }}
              ></div>
            </div>

            {/* Stage indicators */}
            <div className="flex justify-between mt-4 text-xs text-[var(--muted)]">
              {[
                { label: "Provision", threshold: 15 },
                { label: "Container", threshold: 30 },
                { label: "AI Engine", threshold: 50 },
                { label: "Channels", threshold: 70 },
                { label: "Ready", threshold: 100 },
              ].map((s) => (
                <span
                  key={s.label}
                  className={
                    (bootStatus?.progress || 0) >= s.threshold
                      ? "text-white font-medium"
                      : ""
                  }
                >
                  {(bootStatus?.progress || 0) >= s.threshold ? "✓ " : ""}
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="glass rounded-xl p-4 border border-red-500/30 mb-4">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => { setError(null); setStep(2); }}
                className="btn-secondary mt-3 text-sm"
              >
                ← Try again
              </button>
            </div>
          )}

          {bootStatus?.ready && (
            <div className="glass rounded-xl p-6 text-center glow">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold mb-2">Tevy is live!</h2>
              <p className="text-sm text-[var(--muted)]">Loading your dashboard...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── HOME TAB (with embedded chat) ─── */
function HomeTab({ instanceData }: { instanceData: { id: string; name: string; webchatUrl: string } | null }) {
  const webchatUrl = instanceData?.webchatUrl || localStorage.getItem("tevy_webchat_url") || "";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Chat with Tevy</h1>
            <p className="text-[var(--muted)] text-sm">Your AI marketing assistant</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-[var(--muted)]">Online</span>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {[
            "Analyze my website",
            "Draft 3 social posts",
            "Research my competitors",
            "Run an SEO audit",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="px-3 py-1.5 rounded-full text-xs bg-[var(--surface-light)] text-[var(--muted)] hover:text-white hover:bg-[var(--surface)] border border-[var(--border)] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-h-0">
        {webchatUrl ? (
          <iframe
            src={webchatUrl}
            className="w-full h-full border-0"
            allow="clipboard-write"
            title="Tevy Chat"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <h2 className="text-lg font-semibold mb-2">Chat is connecting...</h2>
              <p className="text-sm text-[var(--muted)]">
                Use Telegram in the meantime — your bot is already live there.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── BRAND TAB (redesigned with inputs + analysis) ─── */
function BrandTab({ instanceData }: { instanceData: { id: string; name: string; webchatUrl: string } | null }) {
  // Load saved config from localStorage (set during onboarding)
  const [brandData, setBrandData] = useState({
    businessName: "",
    websiteUrl: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
    twitter: "",
    facebook: "",
    competitors: "",
    brandVoice: "",
    targetAudience: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // TODO: Load from backend GET /api/instances/:id
    // For now, hydrate from localStorage if available
    const name = localStorage.getItem("tevy_business_name");
    if (name) {
      setBrandData((prev) => ({ ...prev, businessName: name }));
    }
  }, []);

  const handleSave = async () => {
    // TODO: Save to backend PUT /api/instances/:id/config
    localStorage.setItem("tevy_business_name", brandData.businessName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Brand Profile</h1>
      <p className="text-[var(--muted)] mb-6">Your brand info and AI-generated analysis</p>

      {/* Brand Info Section */}
      <div className="glass rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          📝 Brand Details
          {saved && <span className="text-xs text-green-400">✓ Saved</span>}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Business name</label>
              <input
                className="input-field"
                value={brandData.businessName}
                onChange={(e) => setBrandData((prev) => ({ ...prev, businessName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Website</label>
              <input
                className="input-field"
                value={brandData.websiteUrl}
                onChange={(e) => setBrandData((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Social accounts</label>
            <div className="space-y-2">
              {[
                { key: "instagram", icon: "📸", placeholder: "@handle or URL" },
                { key: "tiktok", icon: "🎵", placeholder: "@handle or URL" },
                { key: "linkedin", icon: "💼", placeholder: "Company page URL" },
                { key: "twitter", icon: "𝕏", placeholder: "@handle" },
                { key: "facebook", icon: "📘", placeholder: "Page URL" },
              ].map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm">{s.icon}</span>
                  <input
                    className="input-field !py-2 text-sm"
                    placeholder={s.placeholder}
                    value={(brandData as Record<string, string>)[s.key] || ""}
                    onChange={(e) => setBrandData((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Competitors</label>
            <input
              className="input-field"
              placeholder="Blue Bottle, Stumptown, etc."
              value={brandData.competitors}
              onChange={(e) => setBrandData((prev) => ({ ...prev, competitors: e.target.value }))}
            />
            <p className="text-xs text-[var(--muted)] mt-1">Tevy will research these and track their activity</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Brand voice / tone</label>
              <textarea
                className="input-field text-sm"
                rows={2}
                placeholder="Professional but friendly, casual, authoritative..."
                value={brandData.brandVoice}
                onChange={(e) => setBrandData((prev) => ({ ...prev, brandVoice: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Target audience</label>
              <textarea
                className="input-field text-sm"
                rows={2}
                placeholder="Young professionals, small business owners..."
                value={brandData.targetAudience}
                onChange={(e) => setBrandData((prev) => ({ ...prev, targetAudience: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Logo / Brand images upload */}
          <div>
            <label className="text-xs text-[var(--muted)] mb-1.5 block">Brand images <span className="text-xs">(optional)</span></label>
            <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:border-[var(--accent)] transition-colors cursor-pointer">
              <div className="text-2xl mb-2">🖼️</div>
              <p className="text-sm text-[var(--muted)]">Drop your logo, brand images, or style guides here</p>
              <p className="text-xs text-[var(--muted)] mt-1">PNG, JPG, SVG up to 5MB</p>
              <input type="file" className="hidden" accept="image/*" multiple />
            </div>
          </div>

          <button onClick={handleSave} className="btn-primary">
            Save brand details
          </button>
        </div>
      </div>

      {/* Brand Analysis Section */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold mb-4">🎯 Brand Analysis</h3>
        <div className="text-center py-8">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold mb-2">No analysis yet</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            Save your brand details above, then ask Tevy to analyze your brand.
            The analysis will appear here.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Try telling Tevy: &quot;Analyze my website and create a brand profile&quot;
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── CALENDAR TAB ─── */
function CalendarTab() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Content Calendar</h1>
      <p className="text-[var(--muted)] mb-6">Managed by Tevy. Posts are drafted, approved, then scheduled.</p>

      <div className="glass rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">📅</div>
        <h2 className="text-lg font-semibold mb-2">No scheduled content yet</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Ask Tevy to draft posts and build your content calendar.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Try: &quot;Create a content calendar for this week&quot;
        </p>
      </div>
    </div>
  );
}

/* ─── SETTINGS TAB ─── */
function SettingsTab() {
  const socialChannels = [
    { icon: "📸", name: "Instagram", status: "disconnected", detail: "Connect account", color: "#E4405F" },
    { icon: "🎵", name: "TikTok", status: "disconnected", detail: "Connect account", color: "#000000" },
    { icon: "💼", name: "LinkedIn", status: "disconnected", detail: "Connect page", color: "#0A66C2" },
    { icon: "𝕏", name: "X / Twitter", status: "disconnected", detail: "Connect account", color: "#1DA1F2" },
    { icon: "📘", name: "Facebook", status: "disconnected", detail: "Connect page", color: "#1877F2" },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-[var(--muted)] mb-8">Manage your channels, connections, and account.</p>

      {/* Chat Channels */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Chat Channel</h3>
        <div className="glass rounded-xl p-4 flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#2AABEE] flex items-center justify-center text-white text-xl">✈️</div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Telegram</div>
            <div className="text-xs text-[var(--muted)]">Active — receiving messages</div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]">
            🟢 Connected
          </span>
        </div>
        {/* Coming soon channels */}
        {[
          { icon: "📱", name: "WhatsApp", bg: "#25D366" },
          { icon: "🎮", name: "Discord", bg: "#5865F2" },
          { icon: "💬", name: "Slack", bg: "#4A154B" },
        ].map((ch) => (
          <div key={ch.name} className="glass rounded-xl p-3 mb-2 opacity-40">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: ch.bg }}>
                {ch.icon}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">{ch.name}</span>
                <span className="text-xs text-[var(--muted)] ml-2">Coming soon</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Social Accounts */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Social Accounts</h3>
        <div className="space-y-2">
          {socialChannels.map((ch) => (
            <div key={ch.name} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl" style={{ background: ch.color }}>
                {ch.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{ch.name}</div>
                <div className="text-xs text-[var(--muted)]">{ch.detail}</div>
              </div>
              <button className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-light)] text-[var(--muted)] hover:text-white transition-colors">
                Connect →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Management */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Agent</h3>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-sm">Your Marketing Agent</div>
              <div className="text-xs text-[var(--muted)]">Powered by OpenClaw</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-green-400">Running</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-light)] text-[var(--muted)] hover:text-white transition-colors">
              Restart agent
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-light)] text-red-400/60 hover:text-red-400 transition-colors">
              Delete agent
            </button>
          </div>
        </div>
      </div>

      {/* Account */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Account</h3>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Plan: Starter</div>
              <div className="text-xs text-[var(--muted)]">1 agent included</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
              Upgrade plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ANALYTICS TAB ─── */
function AnalyticsTab() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Analytics</h1>
      <p className="text-[var(--muted)] mb-6">Performance tracking across your social accounts</p>

      <div className="glass rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h2 className="text-lg font-semibold mb-2">Analytics coming soon</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Once your social accounts are connected, Tevy will track impressions,
          engagement, and follower growth automatically.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Connect your social accounts in the Connect tab to get started.
        </p>
      </div>
    </div>
  );
}

/* ─── RESEARCH TAB ─── */
function ResearchTab() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Market Research</h1>
      <p className="text-[var(--muted)] mb-6">Competitor intel and market trends</p>

      <div className="glass rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="text-lg font-semibold mb-2">No research yet</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Ask Tevy to research your competitors and market trends.
          Research reports will appear here once generated.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Try: &quot;Research my top competitors and what they&apos;re posting&quot;
        </p>
      </div>
    </div>
  );
}

/* ─── SEO TAB ─── */
function SEOTab() {
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">SEO Audit</h1>
      <p className="text-[var(--muted)] mb-6">Website analysis and optimization recommendations</p>

      <div className="glass rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🔎</div>
        <h2 className="text-lg font-semibold mb-2">No audit yet</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Ask Tevy to run an SEO audit of your website.
          Results and recommendations will appear here.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Try: &quot;Run an SEO audit of my website&quot;
        </p>
      </div>
    </div>
  );
}
