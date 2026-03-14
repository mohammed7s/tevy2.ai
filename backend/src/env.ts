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

  // Infrastructure provider: "fly" or "docker"
  INFRA_PROVIDER: optional("INFRA_PROVIDER", "docker"),

  // Fly.io (only needed if INFRA_PROVIDER=fly)
  FLY_API_TOKEN: optional("FLY_API_TOKEN", ""),
  FLY_APP_NAME: optional("FLY_APP_NAME", "tevy2-agents"),
  FLY_REGION: optional("FLY_REGION", "lhr"),

  // Docker host (only needed if INFRA_PROVIDER=docker)
  // Point to Docker Engine API — e.g. http://your-hetzner-ip:2375 or via SSH tunnel http://localhost:2375
  DOCKER_HOST_URL: optional("DOCKER_HOST_URL", "http://localhost:2375"),
  // Public URL for the Docker host (used to generate webchat URLs)
  // e.g. https://bots.tevy2.ai or http://your-hetzner-ip
  DOCKER_HOST_PUBLIC_URL: optional("DOCKER_HOST_PUBLIC_URL", "http://localhost"),

  // Agent
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  TAVILY_API_KEY: optional("TAVILY_API_KEY", ""),
  AGENT_IMAGE: optional("AGENT_IMAGE", "ghcr.io/mcclowin/tevy2.ai/agent:latest"),
  DEFAULT_MODEL: optional("DEFAULT_MODEL", "anthropic/claude-sonnet-4-20250514"),

  // Frontend
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3000"),

  // Backend public URL (passed to bot containers for heartbeat sync)
  BACKEND_PUBLIC_URL: optional("BACKEND_PUBLIC_URL", "http://localhost:3001"),
};
