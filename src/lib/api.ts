// src/lib/api.ts
import { authHeaders } from "./accessToken";
import { serviceKeyHeaders } from "./serviceKeyHeaders"; // PATCH (api-key-wiring)

const API_BASE =
  ((import.meta as ImportMeta & {
    env?: { VITE_WORKER_URL?: string };
  }).env?.VITE_WORKER_URL as string | undefined) ??
  "https://lifeos1-api.ceogps.workers.dev";

export class ApiError extends Error {
  constructor(message: string, public status: number, public path: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T = unknown>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  // PATCH (worker-ai-route): send the Supabase access token (worker AI routes need it)
  const auth = await authHeaders();
  // PATCH (api-key-wiring): saved key for key-backed worker routes, only when the worker lacks a secret
  const keyHeaders = await serviceKeyHeaders(path);
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...keyHeaders,
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j?.error === "string" ? ` — ${j.error}` : "";
    } catch {
      /* ignore */
    }
    throw new ApiError(
      `${path} failed: ${res.status}${detail}`,
      res.status,
      path,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestRaw<T = unknown>(
  path: string,
  opts: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    throw new ApiError(`${path} failed: ${res.status}`, res.status, path);
  }
  return (await res.json()) as T;
}

export interface ApiClient {
  <T = unknown>(path: string, opts?: RequestInit): Promise<T>;
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  put: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  patch: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  delete: <T = unknown>(path: string) => Promise<T>;
  upload: <T = unknown>(path: string, form: FormData) => Promise<T>;
}

function createApiClient(): ApiClient {
  const client = (<T = unknown>(path: string, opts?: RequestInit) =>
    request<T>(path, opts)) as ApiClient;

  client.get = <T = unknown>(path: string) => request<T>(path);

  client.post = <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  client.put = <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  client.patch = <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  client.delete = <T = unknown>(path: string) =>
    request<T>(path, { method: "DELETE" });

  client.upload = <T = unknown>(path: string, form: FormData) =>
    requestRaw<T>(path, { method: "POST", body: form });

  return client;
}

export const api = createApiClient();
export const lifeosApi: ApiClient = createApiClient();

export async function invokeLLMWithAuth({
  prompt,
  systemPrompt,
  model,
  accessToken,
}: {
  prompt: string | any[];
  systemPrompt?: string;
  model?: string;
  accessToken?: string;
}) {
  const WORKER_URL =
    (import.meta as ImportMeta & {
      env?: { VITE_WORKER_URL?: string };
    }).env?.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";
  const res = await fetch(`${WORKER_URL}/api/llm/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      prompt,
      systemPrompt,
      model: model || "auto",
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM invocation failed: ${res.statusText}`);
  }

  return res.text();
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  text?: string;
  content?: string;
  detail?: string;
  reason?: string;
  error?: string;
}