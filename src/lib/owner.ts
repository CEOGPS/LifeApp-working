// src/lib/owner.ts
// Owner-stable identity for LifeOS data.
//
// The app signs in anonymously, and a lost browser session creates a NEW
// anonymous uid. Supabase links sessions to one stable owner uid
// (public.owner_links, migration 0007). app_owner_id() returns the linked
// owner (or the session uid when unlinked); RLS on public.keys and
// public.app_settings checks against it.
//
//   getOwnerId()        effective owner uid (cached per session uid)
//   claimOwner(code)    link this browser session to the owner via the owner code
//   isLinkedOwner()     true when the session uid differs from the owner uid
import { getSupabaseClient } from "./supabaseClient";

let cache: { sessionUid: string; ownerUid: string } | null = null;
let inflight: Promise<string | null> | null = null;

export const OWNER_CHANGED_EVENT = "lifeos:owner-changed";

async function sessionUid(): Promise<string | null> {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Effective owner uid for data (linked owner, else this session's uid). */
export async function getOwnerId(): Promise<string | null> {
  const uid = await sessionUid();
  if (!uid) return null;
  if (cache && cache.sessionUid === uid) return cache.ownerUid;
  if (!inflight) {
    inflight = (async () => {
      try {
        const client = await getSupabaseClient();
        const { data, error } = await (client as any).rpc("app_owner_id");
        const owner = !error && typeof data === "string" && data ? data : uid;
        cache = { sessionUid: uid, ownerUid: owner };
        return owner;
      } catch {
        return uid;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export async function isLinkedOwner(): Promise<boolean> {
  const uid = await sessionUid();
  const owner = await getOwnerId();
  return !!uid && !!owner && uid !== owner;
}

/** Links this browser session to the owner. Throws on a wrong code. */
export async function claimOwner(code: string): Promise<string> {
  const client = await getSupabaseClient();
  const { data, error } = await (client as any).rpc("claim_owner", { p_code: code.trim() });
  if (error) throw new Error(error.message || "Could not link owner");
  cache = null;
  const owner = String(data);
  try {
    window.dispatchEvent(new CustomEvent(OWNER_CHANGED_EVENT, { detail: owner }));
  } catch {
    /* ignore */
  }
  return owner;
}
