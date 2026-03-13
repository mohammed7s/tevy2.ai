import { Hono } from "hono";
import { stytchClient } from "../lib/stytch.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../env.js";

const auth = new Hono();

// POST /api/auth/magic-link — send magic link via Stytch
auth.post("/magic-link", async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !email.includes("@")) {
    return c.json({ error: "Valid email required" }, 400);
  }

  try {
    await stytchClient.magicLinks.email.loginOrCreate({
      email,
      login_magic_link_url: `${env.FRONTEND_URL}/auth/callback`,
      signup_magic_link_url: `${env.FRONTEND_URL}/auth/callback`,
    });

    return c.json({ success: true, message: "Magic link sent" });
  } catch (err: unknown) {
    console.error("Stytch magic link error:", err);
    const message = err instanceof Error ? err.message : "Failed to send magic link";
    return c.json({ error: message }, 500);
  }
});

// POST /api/auth/authenticate — verify magic link token from Stytch redirect
auth.post("/authenticate", async (c) => {
  const { token } = await c.req.json<{ token: string }>();

  if (!token) {
    return c.json({ error: "Token required" }, 400);
  }

  try {
    // Authenticate the magic link token with Stytch
    const response = await stytchClient.magicLinks.authenticate({
      token,
      session_duration_minutes: 60 * 24 * 7, // 7 day session
    });

    const stytchUserId = response.user_id;
    const userEmail = response.user.emails?.[0]?.email || "";

    // Upsert user in our DB
    const { data: user, error: dbError } = await supabase
      .from("users")
      .upsert(
        {
          stytch_user_id: stytchUserId,
          email: userEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stytch_user_id" }
      )
      .select()
      .single();

    if (dbError) {
      console.error("DB upsert error:", dbError);
      throw new Error("Failed to create user record");
    }

    return c.json({
      success: true,
      session_token: response.session_token,
      session_jwt: response.session_jwt,
      user: {
        id: user.id,
        email: userEmail,
      },
    });
  } catch (err: unknown) {
    console.error("Stytch authenticate error:", err);
    const message = err instanceof Error ? err.message : "Authentication failed";
    return c.json({ error: message }, 401);
  }
});

// POST /api/auth/logout — revoke Stytch session
auth.post("/logout", async (c) => {
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (sessionToken) {
    try {
      await stytchClient.sessions.revoke({ session_token: sessionToken });
    } catch {
      // Session might already be expired
    }
  }
  return c.json({ success: true });
});

// GET /api/auth/me — get current user (validates session)
auth.get("/me", async (c) => {
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  try {
    const response = await stytchClient.sessions.authenticate({
      session_token: sessionToken,
    });

    const stytchUserId = response.user?.user_id || response.session?.user_id;
    const userEmail = response.user?.emails?.[0]?.email || "";

    // Get our internal user record
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("stytch_user_id", stytchUserId)
      .single();

    return c.json({
      id: user?.id || stytchUserId,
      email: userEmail,
      name: user?.name || null,
    });
  } catch {
    return c.json({ error: "Not authenticated" }, 401);
  }
});

export default auth;
