"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts tokens in the URL hash after magic link click
    // The Supabase client auto-detects and exchanges them
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Always go to dashboard — onboarding happens there
        router.push("/dashboard");
      }
    });

    // Also handle errors from the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDesc = hashParams.get("error_description");
    if (errorDesc) {
      setError(errorDesc);
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Verification failed</h2>
          <p className="text-[var(--muted)] text-sm mb-6">{error}</p>
          <button onClick={() => router.push("/login")} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[var(--muted)]">Verifying your email...</p>
      </div>
    </div>
  );
}
