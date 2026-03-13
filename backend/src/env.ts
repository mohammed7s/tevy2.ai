import "dotenv/config";

// Typed env config — fails fast if missing
function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  PORT: parseInt(optional("PORT", "3001")),

  // Stytch (auth)
  STYTCH_PROJECT_ID: required("STYTCH_PROJECT_ID"),
  STYTCH_SECRET: required("STYTCH_SECRET"),

  // Supabase (DB only — not used for auth)
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Fly.io
  FLY_API_TOKEN: required("FLY_API_TOKEN"),
  FLY_APP_NAME: optional("FLY_APP_NAME", "tevy2-agents"),
  FLY_REGION: optional("FLY_REGION", "lhr"),

  // Agent
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  TAVILY_API_KEY: optional("TAVILY_API_KEY", ""),
  AGENT_IMAGE: optional("AGENT_IMAGE", "ghcr.io/mcclowin/tevy2.ai/agent:latest"),
  DEFAULT_MODEL: optional("DEFAULT_MODEL", "anthropic/claude-sonnet-4-20250514"),

  // Frontend
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3000"),
};
