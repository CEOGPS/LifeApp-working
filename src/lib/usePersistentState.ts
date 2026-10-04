// src/lib/usePersistentState.ts
// Persistent state hook with Supabase sync via unifiedStorage

import { useState, useEffect, useCallback } from "react";
import { useUnifiedStorage, type UseUnifiedStorageMeta } from "./unifiedStorage";

export type PersistentStateMeta = UseUnifiedStorageMeta;

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => Promise<void>, PersistentStateMeta] {
  const [storedValue, setValue, meta] = useUnifiedStorage<T>(key, initialValue);
  return [storedValue, setValue, meta];
}

export function clearPersistentState(key: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lifeos_unified_" + key);
  }
}