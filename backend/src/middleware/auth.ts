import type { Context, Next } from "hono";
import { supabase } from "../lib/supabase.js";

// Middleware: verify Supabase JWT from Authorization header
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authMiddleware(c: Context<any>, next: Next) {
  // Dev mode: bypass auth with mock user
  if (process.env.DEV_BYPASS_AUTH === "true") {
    c.set("userId", "dev-user-00000000-0000-0000-0000-000000000000");
    c.set("userEmail", "dev@tevy2.ai");
    c.set("accessToken", "dev-token");
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return c.json({ error: "Unauthorized", details: error?.message }, 401);
    }

    // Attach user info to context
    c.set("userId", data.user.id);
    c.set("userEmail", data.user.email || "");
    c.set("accessToken", token);

    await next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return c.json({ error: "Unauthorized", details: message }, 401);
  }
}
