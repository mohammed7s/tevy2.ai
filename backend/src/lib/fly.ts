import { env } from "../env.js";

const FLY_API = "https://api.machines.dev/v1";

type FlyMachineConfig = {
  name: string;
  region: string;
  config: {
    image: string;
    env: Record<string, string>;
    services: Array<{
      ports: Array<{ port: number; handlers: string[] }>;
      protocol: string;
      internal_port: number;
    }>;
    guest: {
      cpu_kind: string;
      cpus: number;
      memory_mb: number;
    };
    auto_destroy: boolean;
    restart: { policy: string };
  };
};

type FlyMachine = {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id: string;
  private_ip: string;
  created_at: string;
  updated_at: string;
};

async function flyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${FLY_API}/apps/${env.FLY_APP_NAME}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

// Create a persistent volume for agent memory
async function createVolume(name: string, region: string): Promise<{ id: string }> {
  const res = await flyFetch("/volumes", {
    method: "POST",
    body: JSON.stringify({
      name,
      region,
      size_gb: 1, // 1GB is plenty for markdown files
      encrypted: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fly create volume failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<{ id: string }>;
}

export async function deleteVolume(volumeId: string): Promise<void> {
  const res = await flyFetch(`/volumes/${volumeId}`, { method: "DELETE" });
  if (!res.ok) {
    // Volume might already be gone
    console.warn(`Fly delete volume returned ${res.status}`);
  }
}

export async function createMachine(opts: {
  name: string;
  envVars: Record<string, string>;
  region?: string;
}): Promise<FlyMachine & { volumeId?: string }> {
  const region = opts.region || env.FLY_REGION;

  // Create a persistent volume for memory/
  const volName = opts.name.replace(/[^a-z0-9_]/g, "_");
  let volumeId: string | undefined;
  try {
    const vol = await createVolume(volName, region);
    volumeId = vol.id;
  } catch (err) {
    console.warn("Volume creation failed, running without persistence:", err);
  }

  const mounts = volumeId
    ? [{ volume: volumeId, path: "/workspace/memory" }]
    : [];

  const payload = {
    name: opts.name,
    region,
    config: {
      image: env.AGENT_IMAGE,
      env: {
        ...opts.envVars,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        MODEL: env.DEFAULT_MODEL,
        ...(env.TAVILY_API_KEY && { TAVILY_API_KEY: env.TAVILY_API_KEY }),
      },
      mounts,
      services: [
        {
          ports: [
            { port: 443, handlers: ["tls", "http"] },
            { port: 80, handlers: ["http"] },
          ],
          protocol: "tcp",
          internal_port: 18789,
        },
      ],
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 2048,
      },
      auto_destroy: false,
      restart: { policy: "on-failure" },
    },
  };

  const res = await flyFetch("/machines", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    // Clean up volume if machine creation fails
    if (volumeId) await deleteVolume(volumeId).catch(() => {});
    throw new Error(`Fly create machine failed (${res.status}): ${err}`);
  }

  const machine = await res.json() as FlyMachine;
  return { ...machine, volumeId };
}

export async function getMachine(machineId: string): Promise<FlyMachine> {
  const res = await flyFetch(`/machines/${machineId}`);
  if (!res.ok) throw new Error(`Fly get machine failed: ${res.status}`);
  return res.json() as Promise<FlyMachine>;
}

export async function startMachine(machineId: string): Promise<void> {
  const res = await flyFetch(`/machines/${machineId}/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Fly start failed: ${res.status}`);
}

export async function stopMachine(machineId: string): Promise<void> {
  const res = await flyFetch(`/machines/${machineId}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`Fly stop failed: ${res.status}`);
}

export async function deleteMachine(machineId: string): Promise<void> {
  const res = await flyFetch(`/machines/${machineId}?force=true`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Fly delete failed: ${res.status}`);
}

// Execute a command inside a running machine and return stdout
export async function execInMachine(machineId: string, cmd: string[]): Promise<string> {
  const res = await flyFetch(`/machines/${machineId}/exec`, {
    method: "POST",
    body: JSON.stringify({ cmd, timeout: 5 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fly exec failed (${res.status}): ${err}`);
  }
  const result = await res.json() as { stdout: string; stderr: string; exit_code: number };
  return result.stdout || "";
}

export async function listMachines(): Promise<FlyMachine[]> {
  const res = await flyFetch("/machines");
  if (!res.ok) throw new Error(`Fly list machines failed: ${res.status}`);
  return res.json() as Promise<FlyMachine[]>;
}

// Update a machine's image (rolling update)
// Fly replaces the machine in-place: stop → update config → start
export async function updateMachine(
  machineId: string,
  opts: { image?: string; envVars?: Record<string, string> }
): Promise<FlyMachine> {
  // Get current config first
  const current = await getMachine(machineId);

  const res = await flyFetch(`/machines/${machineId}`, {
    method: "POST",
    body: JSON.stringify({
      config: {
        image: opts.image || env.AGENT_IMAGE,
        env: opts.envVars, // pass full env — Fly replaces, doesn't merge
        services: [
          {
            ports: [
              { port: 443, handlers: ["tls", "http"] },
              { port: 80, handlers: ["http"] },
            ],
            protocol: "tcp",
            internal_port: 18789,
          },
        ],
        guest: {
          cpu_kind: "shared",
          cpus: 1,
          memory_mb: 2048,
        },
        auto_destroy: false,
        restart: { policy: "on-failure" },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fly update machine failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<FlyMachine>;
}
