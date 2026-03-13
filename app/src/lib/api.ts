import { getAccessToken, signOut } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ApiOptions = {
  method?: string;
  body?: unknown;
};

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const token = await getAccessToken();

  if (!token && !path.startsWith("/api/auth")) {
    // Not authenticated — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Not authenticated");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle auth expiry
  if (res.status === 401) {
    signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data as T;
}

// Instances
export function createInstance(data: Record<string, unknown>) {
  return api<{
    success: boolean;
    instance: {
      id: string;
      name: string;
      status: string;
      webchatUrl: string;
      flyMachineId: string;
      region: string;
    };
  }>("/api/instances", { method: "POST", body: data });
}

export function listInstances() {
  return api<{ instances: Array<Record<string, unknown>> }>("/api/instances");
}

export function getInstance(id: string) {
  return api<Record<string, unknown>>(`/api/instances/${id}`);
}

export function startInstance(id: string) {
  return api(`/api/instances/${id}/start`, { method: "POST" });
}

export function stopInstance(id: string) {
  return api(`/api/instances/${id}/stop`, { method: "POST" });
}

export function deleteInstance(id: string) {
  return api(`/api/instances/${id}`, { method: "DELETE" });
}

export function triggerTask(id: string, task: string) {
  return api<{ success: boolean; message: string; telegramMessage?: string }>(
    `/api/instances/${id}/trigger`,
    { method: "POST", body: { task } }
  );
}

export function readAgentFile(id: string, filePath: string) {
  return api<{ path: string; content: string }>(
    `/api/instances/${id}/files/${filePath}`
  );
}
