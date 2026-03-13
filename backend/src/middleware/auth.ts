import type { Context, Next } from "hono";
import { stytchClient } from "../lib/stytch.js";
import { supabase } from "../lib/supabase.js";

// Middleware: verify Stytch session token from Authorization header
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authMiddleware(c: Context<any>, next: Next) {
  // Dev mode: bypass auth with mock user
  if (process.env.DEV_BYPASS_AUTH === "true") {
    c.set("userId", "00000000-0000-0000-0000-000000000000");
    c.set("userEmail", "dev@tevy2.ai");
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const sessionToken = authHeader.slice(7);

  try {
    // Verify session with Stytch
    const response = await stytchClient.sessions.authenticate({
      session_token: sessionToken,
    });

    const stytchUserId = response.user?.user_id || response.session?.user_id;
    const userEmail = response.user?.emails?.[0]?.email || "";

    if (!stytchUserId) {
      return c.json({ error: "Invalid session" }, 401);
    }

    // Look up our internal user ID
    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("stytch_user_id", stytchUserId)
      .single();

    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    // Attach user info to context
    c.set("userId", user.id);
    c.set("userEmail", user.email || userEmail);

    await next();
  } catch (err: unknown) {
    console.error("Auth middleware error:", err);
    return c.json({ error: "Unauthorized" }, 401);
  }
}
