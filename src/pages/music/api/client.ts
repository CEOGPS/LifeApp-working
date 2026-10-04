// src/pages/music/api/client.ts
// Typed fetch wrapper. Kept local so the panel doesn't depend on a shared module.
// - JSON bodies get Content-Type: application/json.
// - FormData bodies are passed through untouched (browser sets the boundary).
// - Error extraction handles JSON `{ message }`, plain text, and HTML bodies.

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  signal?: AbortSignal;
}

export async function lifeosApi<T>(input: string, init: ApiOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = init.body instanceof FormData;
  let body: BodyInit | undefined;

  if (init.body === undefined) {
    body = undefined;
  } else if (isFormData) {
    body = init.body as FormData;
  } else if (typeof init.body === "string") {
    body = init.body;
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  } else {
    body = JSON.stringify(init.body);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers, body });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    throw new ApiError(message, 0, null);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => "");
  }

  if (!response.ok) {
    throw new ApiError(extractError(payload, response.status), response.status, payload);
  }
  return payload as T;
}

function extractError(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload.trim()) {
    // If the Worker returned HTML, don't dump the whole document in the toast.
    if (payload.trimStart().startsWith("<")) return `Request failed (${status})`;
    return payload.slice(0, 300);
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.detail;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return `Request failed (${status})`;
}