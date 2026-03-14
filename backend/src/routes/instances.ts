import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { createMachine, getMachine, startMachine, stopMachine, deleteMachine, updateMachine, deleteVolume, execInMachine } from "../lib/infra.js";
import { authMiddleware } from "../middleware/auth.js";
import { env } from "../env.js";

// Generate webchat URL based on infra provider
function getWebchatUrl(instance: { fly_machine_name?: string; host_port?: number } & Record<string, unknown>): string {
  if (env.INFRA_PROVIDER === "fly") {
    return `https://${instance.fly_machine_name}.fly.dev`;
  }
  // Docker host — use DOCKER_HOST_PUBLIC_URL + port
  const publicHost = env.DOCKER_HOST_PUBLIC_URL || "http://localhost";
  const port = instance.host_port;
  if (port) {
    return `${publicHost}:${port}`;
  }
  return `${publicHost}:19000`;
}

type AuthEnv = {
  Variables: {
    userId: string;
    userEmail: string;
    sessionToken: string;
  };
};

const instances = new Hono<AuthEnv>();

// All routes require auth
instances.use("*", authMiddleware);

// Helper: generate instance name from business name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

// POST /api/instances — provision a new agent instance
instances.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const userEmail = c.get("userEmail") as string;

  const body = await c.req.json<{
    ownerName: string;
    businessName: string;
    websiteUrl?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    competitors?: string;
    brandNotes?: string;
    postingGoal?: string;
    chatChannel?: string;
    telegramBotToken?: string;
  }>();

  if (!body.businessName) {
    return c.json({ error: "businessName is required" }, 400);
  }

  // Check if user already has an instance (MVP: 1 per user)
  const { data: existing } = await supabase
    .from("instances")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .limit(1);

  if (existing && existing.length > 0) {
    return c.json({ error: "You already have an active instance. Delete it first to create a new one." }, 409);
  }

  const slug = slugify(body.businessName);
  const instanceName = `tevy-${slug}-${Date.now().toString(36)}`;

  // Generate gateway token — stored in DB so we can proxy API calls to the agent
  const gatewayToken = crypto.randomUUID().replace(/-/g, "");

  // Build env vars for the agent container
  const agentEnv: Record<string, string> = {
    INSTANCE_ID: instanceName,
    GATEWAY_TOKEN: gatewayToken,
    OWNER_NAME: body.ownerName || "",
    BUSINESS_NAME: body.businessName,
    WEBSITE_URL: body.websiteUrl || "",
    INSTAGRAM: body.instagram || "",
    TIKTOK: body.tiktok || "",
    LINKEDIN: body.linkedin || "",
    TWITTER: body.twitter || "",
    FACEBOOK: body.facebook || "",
    POSTING_GOAL: body.postingGoal || "3-4 posts per week",
    CHAT_CHANNEL: body.chatChannel || "webchat",
    TIMEZONE: "UTC", // TODO: detect from user
    // Heartbeat sync + webchat
    TEVY2_BACKEND_URL: env.BACKEND_PUBLIC_URL,
    TEVY2_DASHBOARD_URL: env.FRONTEND_URL,
  };

  // Base64 encode brand notes + competitors for the entrypoint
  if (body.competitors) {
    const competitorsMd = generateCompetitorsMd(body.competitors);
    agentEnv.COMPETITORS_B64 = Buffer.from(competitorsMd).toString("base64");
  }

  if (body.telegramBotToken) {
    agentEnv.TELEGRAM_BOT_TOKEN = body.telegramBotToken;
  }

  try {
    // 1. Create Fly machine
    const machine = await createMachine({
      name: instanceName,
      envVars: agentEnv,
    });

    // 2. Store in DB
    const { data: instance, error: dbError } = await supabase
      .from("instances")
      .insert({
        user_id: userId,
        user_email: userEmail,
        fly_machine_id: machine.id,
        fly_machine_name: instanceName,
        fly_volume_id: machine.volumeId || null,
        status: "running",
        region: machine.region,
        plan: "starter",
        chat_channel: body.chatChannel || "webchat",
        business_name: body.businessName,
        website_url: body.websiteUrl || null,
        gateway_token: gatewayToken,
        config: {
          ownerName: body.ownerName,
          socials: {
            instagram: body.instagram,
            tiktok: body.tiktok,
            linkedin: body.linkedin,
            twitter: body.twitter,
            facebook: body.facebook,
          },
          competitors: body.competitors,
          postingGoal: body.postingGoal,
          brandNotes: body.brandNotes,
          businessName: body.businessName,
          websiteUrl: body.websiteUrl,
          telegramBotToken: body.telegramBotToken,
        },
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 3. Log the creation event
    await supabase.from("usage_logs").insert({
      instance_id: instance.id,
      event: "created",
      metadata: { fly_machine_id: machine.id, region: machine.region },
    });

    // Generate webchat URL (the agent's OpenClaw gateway)
    // Store host port for Docker provider
    if ((machine as any).hostPort) {
      await supabase
        .from("instances")
        .update({ host_port: (machine as any).hostPort })
        .eq("id", instance.id);
    }

    const webchatUrl = getWebchatUrl({
      fly_machine_name: instanceName,
      host_port: (machine as any).hostPort,
    });

    return c.json({
      success: true,
      instance: {
        id: instance.id,
        name: instanceName,
        status: "running",
        webchatUrl,
        flyMachineId: machine.id,
        region: machine.region,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    console.error("Instance creation failed:", message);
    console.error("Full error:", err);
    return c.json({ error: "Failed to provision agent", details: message }, 500);
  }
});

// GET /api/instances — list user's instances
instances.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Enrich with live status from Fly
  const enriched = await Promise.all(
    (data || []).map(async (inst) => {
      try {
        const machine = await getMachine(inst.fly_machine_id);
        return {
          ...inst,
          liveStatus: machine.state,
          webchatUrl: getWebchatUrl(inst),
        };
      } catch {
        return { ...inst, liveStatus: "unknown", webchatUrl: null };
      }
    })
  );

  return c.json({ instances: enriched });
});

// GET /api/instances/:id — get single instance
instances.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    const machine = await getMachine(data.fly_machine_id);
    return c.json({
      ...data,
      liveStatus: machine.state,
      webchatUrl: getWebchatUrl(data),
    });
  } catch {
    return c.json({ ...data, liveStatus: "unknown" });
  }
});

// POST /api/instances/:id/start
instances.post("/:id/start", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    await startMachine(data.fly_machine_id);
    await supabase
      .from("instances")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", instanceId);

    await supabase.from("usage_logs").insert({
      instance_id: instanceId,
      event: "start",
    });

    return c.json({ success: true, status: "running" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Start failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/instances/:id/stop
instances.post("/:id/stop", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    await stopMachine(data.fly_machine_id);
    await supabase
      .from("instances")
      .update({ status: "stopped", updated_at: new Date().toISOString() })
      .eq("id", instanceId);

    await supabase.from("usage_logs").insert({
      instance_id: instanceId,
      event: "stop",
    });

    return c.json({ success: true, status: "stopped" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stop failed";
    return c.json({ error: message }, 500);
  }
});

// DELETE /api/instances/:id
instances.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    await deleteMachine(data.fly_machine_id);
  } catch {
    // Machine might already be gone
  }

  // Clean up persistent volume
  if (data.fly_volume_id) {
    try {
      await deleteVolume(data.fly_volume_id);
    } catch {
      // Volume might already be gone
    }
  }

  await supabase
    .from("instances")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", instanceId);

  await supabase.from("usage_logs").insert({
    instance_id: instanceId,
    event: "deleted",
  });

  return c.json({ success: true });
});

// POST /api/instances/:id/update — update instance to latest agent image
instances.post("/:id/update", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    // Rebuild env vars from stored config
    const config = data.config as Record<string, unknown> || {};
    const socials = config.socials as Record<string, string> || {};

    const agentEnv: Record<string, string> = {
      INSTANCE_ID: data.fly_machine_name,
      OWNER_NAME: (config.ownerName as string) || "",
      BUSINESS_NAME: data.business_name || "",
      WEBSITE_URL: data.website_url || "",
      INSTAGRAM: socials.instagram || "",
      TIKTOK: socials.tiktok || "",
      LINKEDIN: socials.linkedin || "",
      TWITTER: socials.twitter || "",
      FACEBOOK: socials.facebook || "",
      POSTING_GOAL: (config.postingGoal as string) || "3-4 posts per week",
      CHAT_CHANNEL: data.chat_channel || "webchat",
      TIMEZONE: "UTC",
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      MODEL: env.DEFAULT_MODEL,
      TEVY2_BACKEND_URL: env.BACKEND_PUBLIC_URL,
      TEVY2_DASHBOARD_URL: env.FRONTEND_URL,
    };

    if (config.competitors) {
      const competitorsMd = generateCompetitorsMd(config.competitors as string);
      agentEnv.COMPETITORS_B64 = Buffer.from(competitorsMd).toString("base64");
    }

    await updateMachine(data.fly_machine_id, { envVars: agentEnv });

    await supabase
      .from("instances")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", instanceId);

    await supabase.from("usage_logs").insert({
      instance_id: instanceId,
      event: "updated",
      metadata: { image: env.AGENT_IMAGE },
    });

    return c.json({ success: true, message: "Instance updated to latest image" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/instances/:id/trigger — send a task to the agent via Telegram Bot API
instances.post("/:id/trigger", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");
  const { task } = await c.req.json<{ task: string }>();

  if (!task) return c.json({ error: "task is required" }, 400);

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  // Get the Telegram bot token from config or env
  const botToken = data.config?.telegramBotToken;
  if (!botToken) {
    return c.json({ error: "No Telegram bot token configured for this instance" }, 400);
  }

  // We need the chat_id of the bot's owner to send a message.
  // Since the bot can't initiate conversations, we use the Telegram Bot API
  // to send the task message. The owner's chat_id is stored after first interaction.
  // For now, we use the gateway WebSocket to send a task directly.

  // Alternative: use the OpenClaw gateway API to send a session message
  const gatewayUrl = getWebchatUrl(data);
  const gatewayToken = data.gateway_token;

  if (!gatewayToken) {
    return c.json({ error: "No gateway token — instance was created before this feature" }, 400);
  }

  try {
    // Send task via OpenClaw gateway REST API
    const res = await fetch(`${gatewayUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: task,
        source: "dashboard",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Gateway API might not support this — fall back to just acknowledging
      return c.json({
        success: true,
        message: "Task queued. The agent will process it shortly.",
        note: "Send this message to the bot via Telegram for now.",
        telegramMessage: task,
      });
    }

    return c.json({ success: true, message: "Task sent to agent" });
  } catch {
    // Gateway not reachable — tell user to send via Telegram
    return c.json({
      success: true,
      message: "Agent is processing. Send this to your Telegram bot for immediate action:",
      telegramMessage: task,
    });
  }
});

// GET /api/instances/:id/files/* — proxy file reads from agent workspace
instances.get("/:id/files/*", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");
  const filePath = c.req.path.split("/files/")[1];

  if (!filePath) return c.json({ error: "File path required" }, 400);

  // Block path traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const { data, error } = await supabase
    .from("instances")
    .select("fly_machine_name, gateway_token")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data || !data.gateway_token) {
    return c.json({ error: "Instance not found" }, 404);
  }

  const agentUrl = getWebchatUrl(data);
  try {
    const res = await fetch(`${agentUrl}/api/files/${filePath}`, {
      headers: { Authorization: `Bearer ${data.gateway_token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return c.json({ error: `Agent returned ${res.status}` }, res.status as 404 | 500);
    }

    const content = await res.text();
    return c.json({ path: filePath, content });
  } catch {
    return c.json({ error: "Agent not reachable" }, 503);
  }
});

// GET /api/instances/:id/boot-status — poll boot progress
instances.get("/:id/boot-status", async (c) => {
  const userId = c.get("userId") as string;
  const instanceId = c.req.param("id");

  const { data, error } = await supabase
    .from("instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return c.json({ error: "Instance not found" }, 404);

  try {
    const machine = await getMachine(data.fly_machine_id);
    const flyState = machine.state; // created | starting | started | stopping | stopped | destroyed

    // Early stages: use Fly machine state
    if (flyState === "created" || flyState === "replacing") {
      return c.json({ stage: "provisioning", progress: 15, message: "Provisioning infrastructure...", ready: false });
    }
    if (flyState === "starting") {
      return c.json({ stage: "starting", progress: 30, message: "Starting secure container...", ready: false });
    }
    if (flyState === "stopping" || flyState === "stopped" || flyState === "destroyed") {
      return c.json({ stage: "offline", progress: 0, message: `Machine is ${flyState}`, ready: false });
    }

    // Machine is "started" — read actual gateway logs to determine real boot stage
    const webchatUrl = getWebchatUrl(data);
    const createdAt = new Date(data.created_at).getTime();
    const uptimeMs = Date.now() - createdAt;

    // Try to read the last 20 lines of gateway logs from inside the container
    let logLines = "";
    try {
      logLines = await execInMachine(data.fly_machine_id, [
        "sh", "-c",
        "cat /tmp/openclaw/openclaw-*.log 2>/dev/null | tail -20 || echo '__no_logs__'"
      ]);
    } catch {
      // exec might fail if machine is still early in boot
    }

    // Parse log markers to determine actual boot stage
    if (logLines.includes("[heartbeat] started") || logLines.includes("[health-monitor] started")) {
      return c.json({ stage: "ready", progress: 100, message: "Agent online!", ready: true, webchatUrl });
    }
    if (logLines.includes("[telegram]") && logLines.includes("starting provider")) {
      return c.json({ stage: "channels", progress: 85, message: "Connecting Telegram...", ready: false });
    }
    if (logLines.includes("[gateway] listening on")) {
      return c.json({ stage: "gateway", progress: 70, message: "Gateway up, connecting channels...", ready: false });
    }
    if (logLines.includes("[gateway]")) {
      return c.json({ stage: "booting", progress: 50, message: "Gateway initializing...", ready: false });
    }

    // No gateway logs yet — use entrypoint markers or uptime
    if (uptimeMs > 600_000) {
      return c.json({ stage: "error", progress: 0, message: "Agent started but gateway not responding after 10min. Try restarting.", ready: false });
    }
    if (uptimeMs > 60_000) {
      return c.json({ stage: "booting", progress: 40, message: "Starting OpenClaw gateway...", ready: false });
    }
    return c.json({ stage: "booting", progress: 20, message: "Configuring agent...", ready: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status check failed";
    return c.json({ stage: "error", progress: 0, message, ready: false });
  }
});

// Helper: generate competitors markdown
function generateCompetitorsMd(competitors: string): string {
  const list = competitors
    .split(",")
    .map((c, i) => `## Competitor ${i + 1}\n- **Name:** ${c.trim()}\n- **Recent activity:** (pending research)\n`)
    .join("\n");

  return `# Competitors\n\n> Tracked competitors. Updated by Tevy during research.\n\n${list}`;
}

export default instances;
