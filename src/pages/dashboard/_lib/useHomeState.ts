// src/pages/dashboard/_lib/useHomeState.ts
// PATCH (home-page2): persistent state for the home modules.
//
// Root cause of "Quick Links / Notes / Budget used to work and now show nothing":
// usePersistentState used to read/write the RAW localStorage key ("quick_links",
// "notes", "budget_bills", ...). It was switched to unifiedStorage, which reads
// "lifeos_unified_<key>" (+ Supabase public.app_settings), so every value saved
// before the switch became invisible. This hook copies a legacy raw value into the
// unified cache once (never deletes the legacy copy), then uses the shared
// usePersistentState, so the value also syncs to Supabase (owner-scoped RLS).
import { usePersistentState } from "@/lib/usePersistentState";

const LS_PREFIX = "lifeos_unified_";
const migrated = new Set<string>();

export function migrateLegacyHomeKey(key: string): void {
  if (migrated.has(key) || typeof window === "undefined") return;
  migrated.add(key);
  try {
    if (localStorage.getItem(LS_PREFIX + key) !== null) return;
    const legacy = localStorage.getItem(key);
    if (legacy === null) return;
    JSON.parse(legacy); // only copy valid JSON
    localStorage.setItem(LS_PREFIX + key, legacy);
  } catch {
    /* ignore corrupt legacy values */
  }
}

export function useHomeState<T>(key: string, initialValue: T) {
  migrateLegacyHomeKey(key);
  return usePersistentState<T>(key, initialValue);
}

/** Current cached value of a home store (same cache the hooks use). */
export function readHomeState<T>(key: string): T | null {
  migrateLegacyHomeKey(key);
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
