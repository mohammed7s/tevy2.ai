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
        } else {
          // API returned empty — clear stale localStorage
          localStorage.removeItem("tevy_instance_id");
          localStorage.removeItem("tevy_instance_name");
          localStorage.removeItem("tevy_webchat_url");
          localStorage.removeItem("tevy_business_name");
        }
      } catch {
        // API unreachable — don't fall back to localStorage (avoids stale state)
        // User will see the wizard; if they already have an instance it'll show on next load
        console.warn("Could not reach API to check instances");
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

/* ─── ONBOARDING PANEL (single page) ─── */
function OnboardingPanel({ onComplete }: { onComplete: (data: { id: string; name: string; webchatUrl: string }) => void }) {
  const [deploying, setDeploying] = useState(false);
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

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
          setDeploying(false);
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, [onComplete]);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    setBootStatus({ stage: "creating", progress: 5, message: "Creating your agent...", ready: false });

    if (process.env.NEXT_PUBLIC_MOCK_DEPLOY === "true") {
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
      setDeploying(false);
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
      pollBootStatus(result.instance.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      setError(msg);
      setDeploying(false);
    }
  };

  const canDeploy = form.businessName && (!form.addTelegram || form.telegramBotToken);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set up your marketing agent</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        Fill in your details and deploy. Takes about 60 seconds.
      </p>

      {/* Business Info */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Your name</label>
            <input
              className="input-field"
              placeholder="Jane Smith"
              value={form.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              disabled={deploying}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Business name *</label>
            <input
              className="input-field"
              placeholder="Sunrise Coffee Co"
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              disabled={deploying}
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
            disabled={deploying}
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
                  disabled={deploying}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Channel */}
      <div className="mb-8">
        <label className="text-xs text-[var(--muted)] mb-2 block uppercase tracking-wide font-semibold">Chat channel</label>

        <button
          onClick={() => !deploying && update("addTelegram", !form.addTelegram)}
          className={`w-full glass rounded-xl p-4 mb-3 text-left transition-all ${
            form.addTelegram ? "border border-[var(--accent)] glow" : "border border-transparent hover:border-[var(--border)]"
          } ${deploying ? "opacity-60 cursor-not-allowed" : ""}`}
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
              disabled={deploying}
            />
            <p className="text-xs text-[var(--muted)] mt-1.5">
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-light)] hover:underline">Create a bot</a> — takes 30 seconds
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {[
            { icon: "📱", name: "WhatsApp" },
            { icon: "🎮", name: "Discord" },
            { icon: "💬", name: "Slack" },
          ].map((ch) => (
            <div key={ch.name} className="glass rounded-lg px-3 py-2 opacity-40 text-xs flex items-center gap-1.5">
              <span>{ch.icon}</span>
              <span className="text-[var(--muted)]">{ch.name} — soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy button OR status bar */}
      {!deploying ? (
        <button
          onClick={handleDeploy}
          className="btn-primary w-full text-lg py-3"
          disabled={!canDeploy}
        >
          🚀 Deploy Agent
        </button>
      ) : (
        <div className="glass rounded-xl p-6">
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

          <div className="w-full h-2 bg-[var(--surface-light)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${bootStatus?.progress || 0}%`,
                background: error ? "#ef4444" : bootStatus?.ready ? "#22c55e" : "linear-gradient(90deg, var(--accent), var(--accent-light))",
              }}
            ></div>
          </div>

          <div className="flex justify-between mt-4 text-xs text-[var(--muted)]">
            {[
              { label: "Provision", threshold: 15 },
              { label: "Container", threshold: 30 },
              { label: "AI Engine", threshold: 50 },
              { label: "Channels", threshold: 70 },
              { label: "Ready", threshold: 100 },
            ].map((s) => (
              <span key={s.label} className={(bootStatus?.progress || 0) >= s.threshold ? "text-white font-medium" : ""}>
                {(bootStatus?.progress || 0) >= s.threshold ? "✓ " : ""}{s.label}
              </span>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => { setError(null); setDeploying(false); }} className="btn-secondary mt-2 text-sm">
                ← Try again
              </button>
            </div>
          )}

          {bootStatus?.ready && (
            <div className="mt-4 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <h2 className="text-lg font-bold">Tevy is live!</h2>
              <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── HOME TAB (dashboard + chat widget) ─── */
function HomeTab({ instanceData }: { instanceData: { id: string; name: string; webchatUrl: string } | null }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const instanceName = instanceData?.name || localStorage.getItem("tevy_instance_name") || "";

  return (
    <div className="h-full flex flex-col relative">
      {/* Dashboard content */}
      <div className="flex-1 overflow-auto p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-[var(--muted)] mb-8">Your marketing agent is live and ready.</p>

        {/* Status cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-[var(--muted)] mb-1">Agent Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-lg font-bold text-green-400">Online</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">Telegram connected</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-[var(--muted)] mb-1">Chat Channel</div>
            <div className="text-lg font-bold">Telegram</div>
            <div className="text-xs text-[var(--muted)] mt-1">Receiving messages</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-[var(--muted)] mb-1">Instance</div>
            <div className="text-sm font-bold font-mono truncate">{instanceName}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Amsterdam (AMS)</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="glass rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-3">Get started</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            Message Tevy on Telegram or use the chat below. Try these:
          </p>
          <div className="flex gap-2 flex-wrap">
            {[
              "Analyze my website",
              "Draft 3 social posts",
              "Research my competitors",
              "Run an SEO audit",
              "Create a content calendar",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setChatOpen(true); setChatInput(suggestion); }}
                className="px-3 py-1.5 rounded-full text-xs bg-[var(--surface-light)] text-[var(--muted)] hover:text-white hover:bg-[var(--surface)] border border-[var(--border)] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Activity placeholder */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <div className="text-center py-6">
            <div className="text-2xl mb-2">📋</div>
            <p className="text-sm text-[var(--muted)]">
              Activity will appear here once you start chatting with Tevy.
            </p>
          </div>
        </div>
      </div>

      {/* Chat widget — bottom right */}
      {chatOpen ? (
        <div className="absolute bottom-4 right-4 w-96 h-[28rem] glass rounded-xl border border-[var(--border)] flex flex-col shadow-2xl overflow-hidden" style={{ zIndex: 50 }}>
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-semibold">Tevy</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-[var(--muted)] hover:text-white text-lg"
            >
              ✕
            </button>
          </div>

          {/* Chat messages area */}
          <div className="flex-1 overflow-auto p-4">
            <div className="text-center py-8">
              <div className="text-2xl mb-2">💬</div>
              <p className="text-sm text-[var(--muted)]">
                Chat with Tevy here or via Telegram.
              </p>
              <p className="text-xs text-[var(--muted)] mt-2">
                Webchat integration coming soon.<br />
                For now, use your Telegram bot.
              </p>
            </div>
          </div>

          {/* Chat input */}
          <div className="px-3 py-3 border-t border-[var(--border)] shrink-0">
            <div className="flex gap-2">
              <input
                className="input-field !py-2 text-sm flex-1"
                placeholder="Message Tevy..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { /* TODO: send via API */ setChatInput(""); } }}
              />
              <button className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity">
                →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Chat toggle button */
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--accent)] text-white text-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          style={{ zIndex: 50 }}
        >
          💬
        </button>
      )}
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
