// src/lib/lifeosApi.ts
// Generic wrapper for LifeOS Worker API calls with auth and error handling

import { supabase } from "./supabaseClient";

export async function lifeosApi<T = unknown>(
  path: string,
  // body may be any JSON-serializable value; it is JSON.stringify'd below.
  options: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const { body, ...request } = options;

  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const headers = new Headers(request.headers);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // Resolve absolute URL from env
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";
  const url = path.startsWith("http") ? path : `${WORKER_URL}${path}`;

  const response = await fetch(url, {
    ...request,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as T;
}
