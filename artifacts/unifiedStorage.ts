// src/lib/unifiedStorage.ts
// Local data wins. A remote empty copy must not erase what was typed.

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseClient } from "./supabaseClient";
import { getOwnerId } from "./owner";

const TABLE = "app_settings";
const OWNER_COL = "owner_id";
const LS_PREFIX = "lifeos_unified_";
const LOCAL_USER = "lifeos-local";
const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

interface UnifiedStorageOptions {
  useSupabase?: boolean;
  useWorkerKV?: boolean;
  userId?: string;
  preferRemote?: boolean;
}

function getUserId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("lifeos_user_id");
    if (stored && stored !== "anonymous") return stored;
  }
  return LOCAL_USER;
}

async function getUserIdAsync(): Promise<string> {
  try {
    const owner = await getOwnerId();
    if (owner && owner !== "anonymous") {
      if (typeof window !== "undefined") localStorage.setItem("lifeos_user_id", owner);
      return owner;
    }
  } catch {
    /* no session */
  }
  return getUserId();
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function lsRead(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, val: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
  } catch {
    // quota exceeded
  }
}

async function computerGet(key: string): Promise<unknown | null> {
  try {
    const res = await fetch(`/__lifeos/store?key=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}

async function computerSet(key: string, value: unknown): Promise<void> {
  try {
    await fetch("/__lifeos/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch {
    /* dev server not running */
  }
}
function lsDel(key: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(LS_PREFIX + key); } catch { /* ignore */ }
}

function kvHeaders(userId: string): Record<string, string> {
  const id = !userId || userId === "anonymous" ? LOCAL_USER : userId;
  return { "Content-Type": "application/json", "X-User-Id": id };
}

function kvUrl(key: string): string {
  return `${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`;
}

async function workerKVGet(key: string, userId: string): Promise<unknown | null> {
  try {
    const res = await fetch(kvUrl(key), { headers: kvHeaders(userId) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}

async function workerKVSet(key: string, value: unknown, userId: string): Promise<boolean> {
  try {
    const res = await fetch(kvUrl(key), {
      method: "POST",
      headers: kvHeaders(userId),
      body: JSON.stringify({ value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function workerKVDel(key: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(kvUrl(key), { method: "DELETE", headers: kvHeaders(userId) });
    return res.ok;
  } catch {
    return false;
  }
}

async function sbGet(key: string, userId: string): Promise<unknown | null> {
  if (!isUuid(userId)) return null;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.from(TABLE).select("value").eq(OWNER_COL, userId).eq("key", key).maybeSingle();
    if (error) return null;
    return (data as { value: unknown } | null)?.value ?? null;
  } catch {
    return null;
  }
}

async function sbSet(key: string, value: unknown, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  try {
    const client = await getSupabaseClient();
    const { error } = await (client as any).from(TABLE).upsert(
      { [OWNER_COL]: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,key" },
    );
    return !error;
  } catch {
    return false;
  }
}

async function sbDel(key: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  try {
    const client = await getSupabaseClient();
    const { error } = await (client as any).from(TABLE).delete().eq(OWNER_COL, userId).eq("key", key);
    return !error;
  } catch {
    return false;
  }
}

async function sbListKeys(prefix?: string, userId?: string): Promise<string[]> {
  const uid = userId || await getUserIdAsync();
  if (!isUuid(uid)) return [];
  try {
    const client = await getSupabaseClient();
    let query = (client as any).from(TABLE).select("key").eq(OWNER_COL, uid);
    if (prefix) query = query.like("key", `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r: { key: string }) => r.key);
  } catch {
    return [];
  }
}

export async function unifiedGet<T = unknown>(key: string, options: UnifiedStorageOptions = {}): Promise<T | null> {
  const userId = options.userId || await getUserIdAsync();
  const useSupabase = options.useSupabase !== false;
  const useWorkerKV = options.useWorkerKV !== false;
  const local = lsRead(key);
  const onThisComputer = await computerGet(key);
  if (onThisComputer !== null) {
    lsWrite(key, onThisComputer);
    return onThisComputer as T;
  }
  if (local !== null && !options.preferRemote) return local as T;

  if (useWorkerKV) {
    const remote = await workerKVGet(key, userId);
    if (remote !== null) {
      if (local === null) lsWrite(key, remote);
      return (local !== null ? local : remote) as T;
    }
  }

  if (useSupabase) {
    const remote = await sbGet(key, userId);
    if (remote !== null) {
      if (local === null) lsWrite(key, remote);
      return (local !== null ? local : remote) as T;
    }
  }

  if (local !== null) {
    if (useWorkerKV) void workerKVSet(key, local, userId);
    return local as T;
  }
  return null;
}

export async function unifiedSet<T = unknown>(key: string, value: T, options: UnifiedStorageOptions = {}): Promise<boolean> {
  const userId = options.userId || await getUserIdAsync();
  lsWrite(key, value);
  void computerSet(key, value);
  if (options.useWorkerKV !== false) void workerKVSet(key, value, userId);
  if (options.useSupabase !== false) void sbSet(key, value, userId);
  return true;
}

export async function unifiedRemove(key: string, options: UnifiedStorageOptions = {}): Promise<boolean> {
  const userId = options.userId || await getUserIdAsync();
  lsDel(key);
  if (options.useWorkerKV !== false) void workerKVDel(key, userId);
  if (options.useSupabase !== false) void sbDel(key, userId);
  return true;
}

export async function unifiedListKeys(prefix?: string, options: UnifiedStorageOptions = {}): Promise<string[]> {
  const userId = options.userId || await getUserIdAsync();
  const all: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) {
        const bare = k.slice(LS_PREFIX.length);
        if (!prefix || bare.startsWith(prefix)) all.push(bare);
      }
    }
  } catch { /* ignore */ }
  if (options.useWorkerKV !== false) {
    try {
      const res = await fetch(`${WORKER_BASE}/api/kv${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`, { headers: kvHeaders(userId) });
      if (res.ok) {
        const data = await res.json();
        const keys = Array.isArray(data.keys) ? data.keys as string[] : [];
        for (const r of keys) if (!all.includes(r)) all.push(r);
      }
    } catch { /* ignore */ }
  }
  if (options.useSupabase !== false) {
    for (const r of await sbListKeys(prefix, userId)) if (!all.includes(r)) all.push(r);
  }
  return all;
}

interface UseUnifiedStorageMeta {
  loaded: boolean;
  isSyncing: boolean;
  lastSynced: number | null;
  error: string | null;
  sync: () => Promise<void>;
}

export function useUnifiedStorage<T>(
  key: string,
  initialValue: T | (() => T),
  optionsArg: UnifiedStorageOptions = {}
): [T, (value: T | ((prev: T) => T)) => Promise<void>, UseUnifiedStorageMeta] {
  const optionsKey = JSON.stringify(optionsArg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => optionsArg, [optionsKey]);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue instanceof Function ? initialValue() : initialValue;
    const cached = lsRead(key);
    return cached !== null ? (cached as T) : (initialValue instanceof Function ? initialValue() : initialValue);
  });

  const [meta, setMeta] = useState<UseUnifiedStorageMeta>({
    loaded: false,
    isSyncing: false,
    lastSynced: null,
    error: null,
    sync: async () => {},
  });

  useEffect(() => {
    setMeta(prev => ({ ...prev, loaded: true }));
    (async () => {
      const local = lsRead(key);
      if (local !== null) return;
      const remote = await unifiedGet<T>(key, { ...options, preferRemote: true });
      if (remote !== null) {
        setStoredValue(remote);
        lsWrite(key, remote);
      }
    })();
  }, [key, options]);

  const sync = useCallback(async () => {
    setMeta(prev => ({ ...prev, isSyncing: true, error: null }));
    const local = lsRead(key);
    if (local !== null) {
      setStoredValue(local as T);
      setMeta(prev => ({ ...prev, isSyncing: false, lastSynced: Date.now(), error: null }));
      return;
    }
    try {
      const remote = await unifiedGet<T>(key, { ...options, preferRemote: true });
      if (remote !== null) {
        setStoredValue(remote);
        lsWrite(key, remote);
        setMeta(prev => ({ ...prev, isSyncing: false, lastSynced: Date.now(), error: null }));
      } else {
        setMeta(prev => ({ ...prev, isSyncing: false, error: null }));
      }
    } catch (e) {
      setMeta(prev => ({ ...prev, isSyncing: false, error: e instanceof Error ? e.message : "Sync failed" }));
    }
  }, [key, options]);

  const setValue = useCallback(async (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    lsWrite(key, valueToStore);
    unifiedSet(key, valueToStore, options).catch(() => {});
  }, [key, storedValue, options]);

  return [storedValue, setValue, { ...meta, sync }];
}

export function clearUnifiedStorage(key: string): void {
  if (typeof window !== "undefined") localStorage.removeItem(LS_PREFIX + key);
}

export type { UseUnifiedStorageMeta, UnifiedStorageOptions };
