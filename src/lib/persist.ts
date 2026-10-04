// Persistent memory for the sole local user. No login.
// Writes localStorage immediately, then Cloudflare KV at /api/kv/:key.
import { unifiedGet, unifiedSet } from "./unifiedStorage";

export async function getUserData<T = unknown>(dataKey: string): Promise<T | null> {
  return unifiedGet<T>(dataKey);
}

export async function setUserData<T = unknown>(dataKey: string, value: T): Promise<boolean> {
  return unifiedSet(dataKey, value);
}
