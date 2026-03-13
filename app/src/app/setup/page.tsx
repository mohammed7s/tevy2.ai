"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendMagicLink, isAuthenticated } from "@/lib/auth";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@") || cooldown > 0) return;

    try {
      setError(null);
      setLoading(true);
      await sendMagicLink(email);
      setSent(true);
      setCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send link";
      if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
        setError("Too many attempts. Please wait a minute and try again.");
        setCooldown(60);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10">
        <img src="/logo-wizard.jpg" alt="tevy2" className="w-10 h-10 rounded-xl" />
        <div className="text-2xl font-bold">
          <span className="gradient-text">tevy2</span>
          <span className="text-[var(--muted)]">.ai</span>
        </div>
      </Link>

      <div className="glass rounded-2xl p-8 max-w-md w-full">
        {sent ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-bold mb-2">Check your email</h2>
            <p className="text-sm text-[var(--muted)] mb-2">
              We sent a magic link to <strong className="text-white">{email}</strong>
            </p>
            <p className="text-xs text-[var(--muted)] mb-6">
              Click the link to sign in. You&apos;ll be redirected to your dashboard.
            </p>
            {cooldown > 0 && (
              <p className="text-xs text-[var(--muted)] mb-4">
                You can resend in {cooldown}s
              </p>
            )}
            <button
              onClick={() => { setSent(false); setError(null); }}
              className="text-sm text-[var(--accent-light)] hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Get started</h1>
              <p className="text-sm text-[var(--muted)]">
                Enter your email to create your marketing agent
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  className="input-field text-center text-lg"
                  type="email"
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={!email || !email.includes("@") || cooldown > 0 || loading}
              >
                {loading ? "Sending..." : cooldown > 0 ? `Wait ${cooldown}s` : "Continue →"}
              </button>

              <p className="text-center text-xs text-[var(--muted)]">
                We&apos;ll send you a magic link. No password needed.
              </p>
            </form>
          </>
        )}
      </div>

      <p className="text-sm text-[var(--muted)] mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent-light)] hover:underline">
          Log in
        </Link>
      </p>

      <div className="mt-6">
        <span className="powered-badge">
          <span style={{ fontSize: "14px" }}>🐾</span> Powered by OpenClaw
        </span>
      </div>
    </div>
  );
}
