import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

// Service role client — full DB access, used server-side only
// NOTE: Supabase is used as a Postgres database only. Auth is handled by Stytch.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
