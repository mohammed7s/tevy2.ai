/**
 * Docker Host Provider — Replaces Fly.io with a self-managed Docker host (Hetzner VPS)
 *
 * Talks to Docker Engine API via HTTP.
 * The Docker host exposes its API on a port secured with mTLS or SSH tunnel.
 *
 * Setup on Hetzner VPS:
 *   1. Install Docker
 *   2. Expose Docker API on TCP (with TLS) or use SSH tunnel
 *   3. Set DOCKER_HOST_URL in backend env
 *
 * Container naming: tevy-{slug}-{timestamp}
 * Volume naming: tevy_{slug}_{timestamp}_memory
 * Network: all containers on "tevy-net" bridge network
 * Port mapping: each container gets a unique port (19000+) for gateway access
 */

import { env } from "../env.js";

const DOCKER_API = env.DOCKER_HOST_URL;
const AGENT_IMAGE = env.AGENT_IMAGE;
const NETWORK_NAME = "tevy-net";

// Port range for gateway WebSocket (one per bot)
const PORT_RANGE_START = 19000;
const PORT_RANGE_END = 19999;

// --- Types (matching Fly.io interface for drop-in replacement) ---

type Machine = {
  id: string;           // Docker container ID
  name: string;         // Container name
  state: string;        // started | stopped | unknown
  region: string;       // always "hetzner"
  instance_id: string;  // same as id
  private_ip: string;   // container IP on bridge network
  created_at: string;
  updated_at: string;
  volumeId?: string;
  hostPort?: number;    // mapped port on host for gateway access
};

// --- Internal helpers ---

async function dockerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${DOCKER_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

// Ensure the tevy bridge network exists
async function ensureNetwork(): Promise<void> {
  const res = await dockerFetch(`/networks/${NETWORK_NAME}`);
  if (res.ok) return; // already exists

  await dockerFetch("/networks/create", {
    method: "POST",
    body: JSON.stringify({
      Name: NETWORK_NAME,
      Driver: "bridge",
    }),
  });
}

// Find next available port in range
async function findAvailablePort(): Promise<number> {
  const res = await dockerFetch('/containers/json?all=true&filters={"label":["tevy.managed=true"]}');
  if (!res.ok) return PORT_RANGE_START;

  const containers = await res.json() as Array<{ Ports?: Array<{ PublicPort?: number }> }>;
  const usedPorts = new Set<number>();

  for (const c of containers) {
    for (const p of c.Ports || []) {
      if (p.PublicPort) usedPorts.add(p.PublicPort);
    }
  }

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedPorts.has(port)) return port;
  }

  throw new Error("No available ports in range");
}

// Map Docker container state to our state
function mapState(dockerState: string): string {
  switch (dockerState.toLowerCase()) {
    case "running": return "started";
    case "exited":
    case "dead": return "stopped";
    case "created":
    case "restarting": return "starting";
    default: return "unknown";
  }
}

// --- Public API (same interface as fly.ts) ---

export async function createVolume(name: string): Promise<{ id: string }> {
  const volName = `tevy_${name.replace(/[^a-z0-9_]/g, "_")}_memory`;

  const res = await dockerFetch("/volumes/create", {
    method: "POST",
    body: JSON.stringify({
      Name: volName,
      Labels: { "tevy.managed": "true", "tevy.instance": name },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Docker create volume failed (${res.status}): ${err}`);
  }

  const vol = await res.json() as { Name: string };
  return { id: vol.Name };
}

export async function deleteVolume(volumeId: string): Promise<void> {
  const res = await dockerFetch(`/volumes/${volumeId}`, { method: "DELETE" });
  if (!res.ok) {
    console.warn(`Docker delete volume returned ${res.status}`);
  }
}

export async function createMachine(opts: {
  name: string;
  envVars: Record<string, string>;
  region?: string;
}): Promise<Machine> {
  await ensureNetwork();

  // Create volume for persistent memory
  let volumeId: string | undefined;
  try {
    const vol = await createVolume(opts.name);
    volumeId = vol.id;
  } catch (err) {
    console.warn("Volume creation failed, running without persistence:", err);
  }

  // Find available port for gateway
  const hostPort = await findAvailablePort();

  // Build env array
  const envArray = Object.entries({
    ...opts.envVars,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    MODEL: env.DEFAULT_MODEL,
    ...(env.TAVILY_API_KEY && { TAVILY_API_KEY: env.TAVILY_API_KEY }),
  }).map(([k, v]) => `${k}=${v}`);

  // Volume mounts
  const binds: string[] = [];
  if (volumeId) {
    binds.push(`${volumeId}:/workspace/memory`);
  }

  // Pull image first
  const pullRes = await dockerFetch(`/images/create?fromImage=${encodeURIComponent(AGENT_IMAGE)}`, {
    method: "POST",
  });
  if (pullRes.ok) {
    // Consume the stream to completion
    await pullRes.text();
  }

  // Create container
  const createRes = await dockerFetch(`/containers/create?name=${opts.name}`, {
    method: "POST",
    body: JSON.stringify({
      Image: AGENT_IMAGE,
      Env: envArray,
      Labels: {
        "tevy.managed": "true",
        "tevy.instance": opts.name,
        "tevy.port": String(hostPort),
        ...(volumeId && { "tevy.volume": volumeId }),
      },
      ExposedPorts: {
        "18789/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "18789/tcp": [{ HostPort: String(hostPort) }],
        },
        Binds: binds,
        Memory: 2 * 1024 * 1024 * 1024, // 2GB
        RestartPolicy: { Name: "on-failure", MaximumRetryCount: 5 },
        NetworkMode: NETWORK_NAME,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    if (volumeId) await deleteVolume(volumeId).catch(() => {});
    throw new Error(`Docker create container failed (${createRes.status}): ${err}`);
  }

  const created = await createRes.json() as { Id: string };

  // Start container
  const startRes = await dockerFetch(`/containers/${created.Id}/start`, { method: "POST" });
  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Docker start container failed (${startRes.status}): ${err}`);
  }

  // Inspect for full details
  const inspectRes = await dockerFetch(`/containers/${created.Id}/json`);
  const info = await inspectRes.json() as {
    Id: string;
    Name: string;
    State: { Status: string };
    Created: string;
    NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
  };

  const privateIp = info.NetworkSettings?.Networks?.[NETWORK_NAME]?.IPAddress || "";

  return {
    id: created.Id.slice(0, 12),
    name: opts.name,
    state: mapState(info.State.Status),
    region: "hetzner",
    instance_id: created.Id.slice(0, 12),
    private_ip: privateIp,
    created_at: info.Created,
    updated_at: info.Created,
    volumeId,
    hostPort,
  };
}

export async function getMachine(machineId: string): Promise<Machine> {
  const res = await dockerFetch(`/containers/${machineId}/json`);
  if (!res.ok) throw new Error(`Docker inspect failed: ${res.status}`);

  const info = await res.json() as {
    Id: string;
    Name: string;
    State: { Status: string; StartedAt: string };
    Created: string;
    Config: { Labels: Record<string, string> };
    NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
  };

  const labels = info.Config?.Labels || {};
  const privateIp = info.NetworkSettings?.Networks?.[NETWORK_NAME]?.IPAddress || "";

  return {
    id: info.Id.slice(0, 12),
    name: info.Name.replace(/^\//, ""),
    state: mapState(info.State.Status),
    region: "hetzner",
    instance_id: info.Id.slice(0, 12),
    private_ip: privateIp,
    created_at: info.Created,
    updated_at: info.State.StartedAt || info.Created,
    volumeId: labels["tevy.volume"],
    hostPort: labels["tevy.port"] ? parseInt(labels["tevy.port"]) : undefined,
  };
}

export async function startMachine(machineId: string): Promise<void> {
  const res = await dockerFetch(`/containers/${machineId}/start`, { method: "POST" });
  // 304 = already started, that's fine
  if (!res.ok && res.status !== 304) throw new Error(`Docker start failed: ${res.status}`);
}

export async function stopMachine(machineId: string): Promise<void> {
  const res = await dockerFetch(`/containers/${machineId}/stop?t=10`, { method: "POST" });
  // 304 = already stopped
  if (!res.ok && res.status !== 304) throw new Error(`Docker stop failed: ${res.status}`);
}

export async function deleteMachine(machineId: string): Promise<void> {
  // Stop first, then remove
  await dockerFetch(`/containers/${machineId}/stop?t=5`, { method: "POST" }).catch(() => {});
  const res = await dockerFetch(`/containers/${machineId}?force=true&v=true`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Docker delete failed: ${res.status}`);
}

export async function execInMachine(machineId: string, cmd: string[]): Promise<string> {
  // Create exec instance
  const createRes = await dockerFetch(`/containers/${machineId}/exec`, {
    method: "POST",
    body: JSON.stringify({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Docker exec create failed (${createRes.status}): ${err}`);
  }

  const { Id: execId } = await createRes.json() as { Id: string };

  // Start exec and get output
  const startRes = await dockerFetch(`/exec/${execId}/start`, {
    method: "POST",
    body: JSON.stringify({ Detach: false, Tty: false }),
  });

  if (!startRes.ok) throw new Error(`Docker exec start failed: ${startRes.status}`);

  // Docker multiplexes stdout/stderr in the stream — for simplicity, read as text
  const output = await startRes.text();
  return output;
}

export async function listMachines(): Promise<Machine[]> {
  const res = await dockerFetch('/containers/json?all=true&filters={"label":["tevy.managed=true"]}');
  if (!res.ok) throw new Error(`Docker list containers failed: ${res.status}`);

  const containers = await res.json() as Array<{
    Id: string;
    Names: string[];
    State: string;
    Created: number;
    Labels: Record<string, string>;
    Ports: Array<{ PublicPort?: number }>;
    NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
  }>;

  return containers.map((c) => ({
    id: c.Id.slice(0, 12),
    name: (c.Names[0] || "").replace(/^\//, ""),
    state: mapState(c.State),
    region: "hetzner",
    instance_id: c.Id.slice(0, 12),
    private_ip: c.NetworkSettings?.Networks?.[NETWORK_NAME]?.IPAddress || "",
    created_at: new Date(c.Created * 1000).toISOString(),
    updated_at: new Date(c.Created * 1000).toISOString(),
    volumeId: c.Labels?.["tevy.volume"],
    hostPort: c.Labels?.["tevy.port"] ? parseInt(c.Labels["tevy.port"]) : undefined,
  }));
}

export async function updateMachine(
  machineId: string,
  opts: { image?: string; envVars?: Record<string, string> }
): Promise<Machine> {
  // Docker doesn't support in-place updates like Fly.
  // Strategy: get current config → stop → remove → recreate with new config
  const current = await getMachine(machineId);

  // Stop and remove old container
  await stopMachine(machineId);
  await dockerFetch(`/containers/${machineId}?force=true`, { method: "DELETE" });

  // Recreate with updated config
  const envVars = opts.envVars || {};
  const newMachine = await createMachine({
    name: current.name,
    envVars,
  });

  return newMachine;
}
