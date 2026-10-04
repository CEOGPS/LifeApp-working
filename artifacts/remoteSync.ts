// src/pages/aihub/remoteSync.ts
// Supabase is source of truth. Cloudflare KV is the mirror. localStorage is cache only.
// Never seed until remote has been checked, or a fresh browser overwrites the account.

import { supabase } from "@/lib/supabase";

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function kvGet(key: string, userId: string): Promise<unknown | null> {
  try {
    const res = await fetch(
      `${WORKER_BASE}/api/kv/get?key=${encodeURIComponent(key)}&user_id=${encodeURIComponent(userId)}`,
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body.value ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, userId: string): Promise<void> {
  try {
    await fetch(`${WORKER_BASE}/api/kv/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, user_id: userId }),
    });
  } catch {
    // mirror is best-effort
  }
}

export async function remoteGet<T>(key: string): Promise<T | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (!error && data?.value != null) return data.value as T;

  const mirrored = await kvGet(key, userId);
  return (mirrored as T) ?? null;
}

export async function remoteSet(key: string, value: unknown): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("user_settings").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
  if (error) console.warn(`[aihub] supabase set ${key}:`, error.message);
  void kvSet(key, value, userId);
}
