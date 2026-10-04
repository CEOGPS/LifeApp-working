// src/pages/dashboard/_lib/ownerHeaders.ts
// PATCH (home-page2): the worker's /api/agents and /api/activity routes reject requests
// without X-User-Id (401). Send the stable owner uid (+ the Supabase bearer token).
// The anonymous session may still be starting on first load, so wait for it (~8 s max).
import { getOwnerId, OWNER_CHANGED_EVENT } from "@/lib/owner";
import { authHeaders } from "@/lib/accessToken";

let ownerPromise: Promise<string | null> | null = null;
if (typeof window !== "undefined") window.addEventListener(OWNER_CHANGED_EVENT, () => (ownerPromise = null));

function waitForOwner(): Promise<string | null> {
  if (!ownerPromise) {
    ownerPromise = (async () => {
      for (let i = 0; i < 32; i++) {
        const id = await getOwnerId().catch(() => null);
        if (id) return id;
        await new Promise((r) => setTimeout(r, 250));
      }
      ownerPromise = null; // try again next call
      return null;
    })();
  }
  return ownerPromise;
}

export async function ownerHeaders(): Promise<Record<string, string>> {
  const owner = await waitForOwner();
  const auth = await authHeaders();
  return { ...auth, ...(owner ? { "X-User-Id": owner } : {}) };
}
