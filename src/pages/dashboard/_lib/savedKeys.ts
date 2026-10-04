// src/pages/dashboard/_lib/savedKeys.ts
// PATCH (home-page2): shared hook for the saved API keys in public.keys.
//
// Keys are stored client-side encrypted ("lifeos-enc:v1:", PBKDF2 + AES-GCM) under
// Chris's master password (see src/platform/integrations/integrationsSupabase.ts),
// so they can only be decrypted in the browser after the password is entered once
// per session (the Integrations page or the home Erebus panel). Nothing here
// writes, rewrites or deletes key rows, and decrypted values are never logged.
import { useEffect, useState } from "react";
import {
  KEYS_UNLOCKED_EVENT,
  getDecryptedKey,
  isKeyEncryptionUnlocked,
  listSavedKeyServices,
} from "@/platform/integrations/integrationsSupabase";
import { OWNER_CHANGED_EVENT } from "@/lib/owner";

export type SavedKeyStatus = "loading" | "missing" | "locked" | "ready" | "error";
export interface SavedKeyState {
  status: SavedKeyStatus;
  /** public.keys.service that matched (e.g. "youtube"). */
  service: string | null;
  /** Decrypted key (only when status === "ready"). Never render or log it. */
  key: string | null;
}

let servicesPromise: Promise<string[]> | null = null;
export function savedKeyServices(force = false): Promise<string[]> {
  if (!servicesPromise || force) {
    servicesPromise = listSavedKeyServices().catch(() => {
      servicesPromise = null;
      return [];
    });
  }
  return servicesPromise;
}

if (typeof window !== "undefined") {
  window.addEventListener(OWNER_CHANGED_EVENT, () => {
    servicesPromise = null;
  });
}

/** First saved key among `candidates` (public.keys.service ids, in priority order). */
export async function resolveSavedKey(candidates: string[]): Promise<SavedKeyState> {
  const services = await savedKeyServices();
  const service = candidates.find((c) => services.includes(c)) || null;
  if (!service) return { status: "missing", service: null, key: null };
  if (!isKeyEncryptionUnlocked()) return { status: "locked", service, key: null };
  const key = await getDecryptedKey(service);
  return key ? { status: "ready", service, key } : { status: "error", service, key: null };
}

/** All saved keys among `candidates` that can be used right now (unlocked), in order. */
export async function usableSavedKeys(candidates: string[]): Promise<Array<{ service: string; key: string }>> {
  if (!isKeyEncryptionUnlocked()) return [];
  const services = await savedKeyServices();
  const out: Array<{ service: string; key: string }> = [];
  for (const s of candidates) {
    if (!services.includes(s)) continue;
    const key = await getDecryptedKey(s);
    if (key) out.push({ service: s, key });
  }
  return out;
}

export function useSavedKey(candidates: string[]): SavedKeyState {
  const dep = candidates.join(",");
  const [state, setState] = useState<SavedKeyState>({ status: "loading", service: null, key: null });
  useEffect(() => {
    let alive = true;
    const run = (force = false) => {
      if (force) servicesPromise = null;
      resolveSavedKey(dep.split(",")).then((s) => alive && setState(s));
    };
    run();
    const onUnlock = () => run(true);
    const onOwner = () => run(true);
    window.addEventListener(KEYS_UNLOCKED_EVENT, onUnlock);
    window.addEventListener(OWNER_CHANGED_EVENT, onOwner);
    return () => {
      alive = false;
      window.removeEventListener(KEYS_UNLOCKED_EVENT, onUnlock);
      window.removeEventListener(OWNER_CHANGED_EVENT, onOwner);
    };
  }, [dep]);
  return state;
}

/** Short status text for a module footer (never includes the key). */
export function savedKeyLabel(s: SavedKeyState, what: string): string {
  switch (s.status) {
    case "ready":
      return `${what}: saved "${s.service}" key`;
    case "locked":
      return `${what}: saved "${s.service}" key locked (unlock in the Erebus panel)`;
    case "missing":
      return `${what}: no saved key`;
    case "error":
      return `${what}: saved "${s.service}" key could not be decrypted`;
    default:
      return `${what}: checking saved keys...`;
  }
}
