// Cloudflare Workers KV. localStorage is the cache. KV is the cross-login copy.
// X-User-Id must be the Supabase user id, never the email and never anonymous.

import { localStorageDB } from "@/platform/storage/localStorage";

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

async function userId(): Promise<string> {
  const { supabase } = await import("@/platform/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("no session");
  return id;
}

async function headers(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    "X-User-Id": await userId(),
  };
}

export async function kvLoad<T>(key: string, defaultValue: T): Promise<T> {
  const cached = localStorageDB.get<T | null>(key, null);
  try {
    const response = await fetch(`${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`, {
      headers: await headers(),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.value != null) {
        localStorageDB.set(key, data.value);
        return data.value as T;
      }
    }
  } catch {
    // offline or logged out: cache below
  }
  return cached ?? defaultValue;
}

export async function kvSave<T>(key: string, value: T): Promise<void> {
  localStorageDB.set(key, value);
  const response = await fetch(`${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ value }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function kvDelete(key: string): Promise<void> {
  localStorageDB.remove(key);
  const response = await fetch(`${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: await headers(),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function kvList(prefix?: string): Promise<string[]> {
  try {
    const url = prefix
      ? `${WORKER_BASE}/api/kv?prefix=${encodeURIComponent(prefix)}`
      : `${WORKER_BASE}/api/kv`;
    const response = await fetch(url, { headers: await headers() });
    if (response.ok) {
      const data = await response.json();
      return (data.keys as string[]) ?? [];
    }
  } catch {
    // fall through
  }
  const keys = localStorageDB.keys();
  return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
}